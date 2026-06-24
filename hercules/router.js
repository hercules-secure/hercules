import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { requireAuth, isAuthEnabled } from './auth.js';
import rateLimit from 'express-rate-limit';
import { performUpdate, getUpdateStatus } from './updater.js';
import { getHistory, deleteHistory } from './history/history.js';
import { handleGitWebhook } from './integration/git.js';

import { 
    isValidLicenseKey, 
    validateLicenseKey, 
    saveLicenseInfo, 
    getCurrentLicense,
    hasPlusAccess,
    PLUS_FEATURES 
} from './license.js';

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // максимум 5 попыток за 15 минут
    message: {
        success: false,
        error: 'Too many login attempts',
        message: 'Слишком много попыток входа. Попробуйте через 15 минут.'
    },
    skipSuccessfulRequests: true, // не считать успешные входы
    standardHeaders: true, // отправлять RateLimit-заголовки
    legacyHeaders: false,
});

const licenseLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // максимум 5 попыток за 15 минут
    message: {
        success: false,
        error: 'Too many activation attempts',
        message: 'Слишком много попыток активации. Попробуйте через 15 минут.'
    },
    skipSuccessfulRequests: true, // успешные активации не считаем
    standardHeaders: true,
    legacyHeaders: false,
});

const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 минута
    max: 10, // максимум 10 запросов в минуту
    message: {
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Слишком много webhook запросов. Попробуйте позже.'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();


const HERCULES_LOG_DIR = path.join(process.cwd(), 'logs', 'hercules');
const HERCULES_LOG_FILE = path.join(HERCULES_LOG_DIR, 'log.txt');


async function herculesLog(message, level = 'INFO') {
    try {
        await fs.mkdir(HERCULES_LOG_DIR, { recursive: true });
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message}\n`;
        await fs.appendFile(HERCULES_LOG_FILE, logLine);
    } catch (err) {
        // Тихая ошибка
    }
}

// ======================
// ГЛОБАЛЬНЫЕ НАСТРОЙКИ
// ======================

// Кэш настроек
let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5000; // 5 секунд
const CONFIG_PATH = path.join(__dirname, 'config.json');

async function loadGlobalSettings() {
    const now = Date.now();
    if (settingsCache && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
        return settingsCache;
    }
    
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        settingsCache = JSON.parse(data);
        settingsCacheTime = now;
        return settingsCache;
    } catch (err) {
        return {};
    }
}

// Проверка глобальных настроек (авторизация, логи и т.д.)
async function checkGlobalSettings() {
    const config = await loadGlobalSettings();
    
    return {
        auth: {
            enabled: config.auth?.authEnabled || false,
            sessionTimeout: config.auth?.users?.sessionTimeout || config.auth?.sessionTimeout || '30'
        },
        logs: {
            enabled: config.logs?.enabled || false,
            level: config.logs?.level || 'info',
            retention: config.logs?.retention || 30
        },
        system: {
            maintenance: config.system?.maintenance || false,
            debugMode: config.system?.debugMode || false
        }
    };
}

// ======================
// ЛОГГЕР В ФАЙЛ (учитывает настройки)
// ======================
const LOG_DIR = path.join(process.cwd(), 'logs', 'addons');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

let logLevelCache = 'info';
let lastLevelCheck = 0;

async function shouldLog(level) {
    // Проверяем уровень логов из настроек каждые 10 секунд
    const now = Date.now();
    if (now - lastLevelCheck > 10000) {
        const settings = await loadGlobalSettings();
        logLevelCache = settings.logs?.level || 'info';
        lastLevelCheck = now;
    }
    
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[logLevelCache];
}

async function log(message, level = 'INFO') {
    try {
        const levelLower = level.toLowerCase();
        
        // Проверяем нужно ли логировать
        if (!(await shouldLog(levelLower))) {
            return;
        }
        
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message}\n`;
        
        await fs.mkdir(LOG_DIR, { recursive: true });
        await fs.appendFile(LOG_FILE, logLine);
    } catch (err) {
        // Тихая ошибка
    }
}

// ======================
// MIDDLEWARE ДЛЯ ЗАЩИТЫ API
// ======================
async function protectApi(req, res, next) {

    const config = await loadGlobalSettings();
    const authEnabled = config.auth?.authEnabled || false;
    
    if (!authEnabled) {
        return next();
    }
    
    // Проверяем сессию
    if (req.session && req.session.authenticated) {
        return next();
    }
    
    res.status(401).json({
        success: false,
        error: 'Unauthorized',
        needAuth: true,
        message: 'Требуется авторизация'
    });
}

// Проверка сессии
router.get('/auth/check', async (req, res) => {
    const config = await loadGlobalSettings();
    const authEnabled = config.auth?.authEnabled || false;
    
    if (!authEnabled) {
        return res.json({ success: true, authenticated: true, authEnabled: false });
    }
    
    const authenticated = !!(req.session && req.session.authenticated);
    res.json({ success: true, authenticated, authEnabled: true });
});

// ======================
// КОНСТАНТЫ И ПУТИ
// ======================
const addonsDir = path.join(process.cwd(), 'addons');
const installedFilePath = path.join(addonsDir, 'installed.json');
const catalogFilePath = path.join(addonsDir, 'catalog.json');
const TEMP_ADDONS_DIR = path.join(process.cwd(), 'temp', 'addons');

// Кэш для ускорения
let installedCache = null;
let catalogCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 5000;

// ======================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ======================

async function ensureAddonsDir() {
    await fs.mkdir(addonsDir, { recursive: true });
}

async function loadInstalledExtensions(force = false) {
    const now = Date.now();
    if (!force && installedCache && (now - lastCacheTime) < CACHE_TTL) {
        return installedCache;
    }
    
    try {
        await ensureAddonsDir();
        const data = await fs.readFile(installedFilePath, 'utf-8');
        installedCache = JSON.parse(data);
        lastCacheTime = now;
        return installedCache;
    } catch (err) {
        if (err.code === 'ENOENT') {
            const empty = [];
            await fs.writeFile(installedFilePath, JSON.stringify(empty, null, 2));
            installedCache = empty;
            return empty;
        }
        await log(`Error loading installed: ${err.message}`, 'ERROR');
        return [];
    }
}

async function saveInstalledExtensions(installed) {
    installedCache = installed;
    await ensureAddonsDir();
    await fs.writeFile(installedFilePath, JSON.stringify(installed, null, 2));
}

async function loadCatalog(force = false) {
    if (!force && catalogCache) return catalogCache;
    
    try {
        await ensureAddonsDir();
        const data = await fs.readFile(catalogFilePath, 'utf-8');
        const parsed = JSON.parse(data);
        catalogCache = parsed.addons || [];
        return catalogCache;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return [];
        }
        await log(`Error loading catalog: ${err.message}`, 'ERROR');
        return [];
    }
}


// ======================
// ПУБЛИЧНЫЕ РОУТЫ АВТОРИЗАЦИИ (БЕЗ ЗАЩИТЫ)
// ======================

// Логин
router.post('/auth/login', loginLimiter, async (req, res) => {
    
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {

            return res.status(400).json({
                success: false,
                error: 'Username and password required'
            });
        }
        
        const config = await loadGlobalSettings();
        
        const authConfig = config.auth || {};
        const authEnabled = authConfig.authEnabled || false;
    
        
        if (!authEnabled) {
            return res.json({ success: true, message: 'Auth disabled', authEnabled: false });
        }
        
        const storedUsername = authConfig.loginUsername || authConfig.users?.loginUsername || '';
        const storedPassword = authConfig.loginPassword || authConfig.users?.loginPassword || '';
        
        
        if (storedUsername === username && storedPassword === password) {
            req.session.authenticated = true;
            req.session.username = username;
            
            const sessionTimeout = parseInt(authConfig.sessionTimeout || authConfig.users?.sessionTimeout || '30');
            req.session.cookie.maxAge = sessionTimeout * 60 * 1000;
            
            
            res.json({
                success: true,
                message: 'Login successful',
                sessionTimeout: sessionTimeout
            });
        } else {
    
            res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                message: 'Неверный логин или пароль'
            });
        }
    } catch (error) {
    
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Проверка сессии
router.get('/check', async (req, res) => {
    const config = await loadGlobalSettings();
    const authEnabled = config.auth?.authEnabled || false;
    
    if (!authEnabled) {
        return res.json({
            success: true,
            authenticated: true,
            authEnabled: false
        });
    }
    
    const authenticated = !!(req.session && req.session.authenticated === true);
    
    res.json({
        success: true,
        authenticated: authenticated,
        authEnabled: true,
        username: authenticated ? req.session.username : null
    });
});


// Загрузка API маршрутов (с защитой)
export async function loadExtensionRoutes(app) {
    const installed = await loadInstalledExtensions();
    
    if (!installed.length) {
        await log('Нет установленных расширений', 'WARN');
        return;
    }
    
    let loadedCount = 0;
    
    for (const extension of installed) {
        if (extension.enabled === false) {
            await log(`${extension.id}: отключён`, 'INFO');
            continue;
        }
        
        const apiPath = `/api/${extension.id}`;
        
        // Создаем промежуточный роутер с защитой
        const lazyRouter = express.Router();
        
        // Применяем защиту API
        lazyRouter.use(protectApi);
        
        // Проксируем запросы
        lazyRouter.use(async (req, res, next) => {
            try {
                const realRouter = await getRouterForExtension(extension);
                if (realRouter) {
                    realRouter(req, res, next);
                } else {
                    res.status(503).json({ error: `Extension ${extension.id} not available` });
                }
            } catch (err) {
                await log(`Ошибка в ${extension.id}: ${err.message}`, 'ERROR');
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        
        app.use(apiPath, lazyRouter);
        loadedCount++;
        await log(`API маршрут: ${apiPath} (защищён: ${await isAuthEnabled()})`, 'INFO');
    }
    
    await log(`Загружено API маршрутов: ${loadedCount}`, 'INFO');
}


const loadedRouters = new Map();

async function getRouterForExtension(extension) {
    if (loadedRouters.has(extension.id)) {
        return loadedRouters.get(extension.id);
    }
    
    const routerPath = path.resolve(process.cwd(), extension.router);
    
    try {
        await fs.access(routerPath);
        const module = await import(`file://${routerPath}`);
        
        let routerInstance = null;
        
        if (module.createRouter && typeof module.createRouter === 'function') {
            routerInstance = module.createRouter({ 
                logger: { info: log, error: log, warn: log }, 
                extension,
                settings: await loadGlobalSettings()
            });
        } else if (module.default && typeof module.default === 'function') {
            routerInstance = module.default({ logger: log, extension, settings: await loadGlobalSettings() });
        } else if (module.default && typeof module.default === 'object') {
            routerInstance = module.default;
        }
        
        if (routerInstance) {
            loadedRouters.set(extension.id, routerInstance);
            await log(`Роутер загружен: ${extension.id}`, 'INFO');
            return routerInstance;
        }
    } catch (err) {
        await log(`Ошибка загрузки роутера ${extension.id}: ${err.message}`, 'ERROR');
    }
    
    return null;
}

// Загрузка UI маршрутов (с защитой если включена авторизация)
export async function loadUIRoutes(app) {
    const installed = await loadInstalledExtensions();
    const globalSettings = await loadGlobalSettings();
    const authEnabled = globalSettings.auth?.authEnabled || false;
    
    if (!installed.length) {
        await log('Нет установленных расширений для UI', 'WARN');
        return;
    }
    
    for (const extension of installed) {
        if (extension.enabled === false) continue;
        if (!extension.ui) continue;
        
        const uiPath = path.resolve(process.cwd(), extension.ui);
        const routePath = extension.url || `/${extension.id}`;
        
        let exists = false;
        try {
            await fs.access(uiPath);
            exists = true;
        } catch {
            exists = false;
        }
        
        if (exists) {
            // Если авторизация включена - защищаем UI маршрут
            if (authEnabled) {
                app.get(routePath, requireAuth, (req, res) => {
                    res.sendFile(uiPath);
                });
            } else {
                app.get(routePath, (req, res) => {
                    res.sendFile(uiPath);
                });
            }
            await log(`UI маршрут: ${routePath} ${authEnabled ? '(защищён)' : '(открыт)'}`, 'INFO');
        }
    }
}


// ======================
// API МАРШРУТЫ (ЗАЩИЩЁННЫЕ)
// ======================

// Получение глобальных настроек
router.get('/api/extensions/settings', async (req, res) => {
    try {
        const settings = await checkGlobalSettings();
        res.json({ success: true, settings });
    } catch (error) {
        await log(`Error: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получение списка расширений
// router.get('/api/extensions', protectApi, async (req, res) => {
//     try {
//         const [catalog, installed] = await Promise.all([
//             loadCatalog(),
//             loadInstalledExtensions()
//         ]);
        
//         const installedMap = new Map(installed.map(ext => [ext.id, ext]));
        
//         const extensionsWithStatus = catalog.map(ext => ({
//             ...ext,
//             installed: installedMap.has(ext.id),
//             hasUpdate: installedMap.get(ext.id)?.version !== ext.version,
//             newVersion: installedMap.get(ext.id)?.version !== ext.version ? ext.version : null,
//             enabled: installedMap.get(ext.id)?.enabled !== false
//         }));
        
//         res.json({ success: true, extensions: extensionsWithStatus, categories: [] });
//     } catch (error) {
//         await log(`Error: ${error.message}`, 'ERROR');
//         res.status(500).json({ success: false, error: error.message });
//     }
// });

// Остальные API маршруты также защищаем
router.get('/api/extensions/installed', protectApi, async (req, res) => {
    try {
        const extensions = await loadInstalledExtensions();
        
        // Загружаем лицензию из config.json
        let licence = null;
        const configPath = path.join(__dirname, 'config.json');
        
        try {
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            
            // Берём expiresAt (адаптируй под свой формат)
            const expiresAt = config.info?.licenseExpiry || config.licenseExpiry || null;
            
            if (expiresAt) {
                licence = { expiresAt: expiresAt };
            }
        } catch (configErr) {
            // config.json не найден — просто игнорируем
            if (configErr.code !== 'ENOENT') {
                await log(`Error loading config.json: ${configErr.message}`, 'WARN');
            }
        }
        
        res.json({ 
            success: true, 
            extensions: extensions,
            licence: licence
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/api/extensions/routes', protectApi, async (req, res) => {
    try {
        const installed = await loadInstalledExtensions();
        const routes = installed.map(ext => ({
            id: ext.id,
            name: ext.name,
            enabled: ext.enabled !== false,
            apiPath: `/api/${ext.id}`,
            routerExists: true
        }));
        
        res.json({ success: true, routes });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ======================
// РОУТЫ ПРОВЕРКИ ОБНОВЛЕНИЙ
// ======================

// Получение текущей версии платформы
async function getCurrentVersion() {
    try {
        const config = await loadGlobalSettings();
        return config.info?.versionNumber ||  '1.0.0';
    } catch (err) {
        return '1.0.0';
    }
}

// Получение последней версии с удалённого репозитория
async function fetchLatestVersion() {
    // GitHub репозиторий (замените на ваш)
    const GITHUB_REPO = 'hercules-secure/hercules';
    const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(GITHUB_API, {
            headers: {
                'User-Agent': 'Hercules'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();

            return data.tag_name
                
        }
    } catch (err) {
        await herculesLog('error', `GitHub API error: ${err.message}`);
    }
    
    return await getCurrentVersion();
    
}

router.get('/version/check', async (req, res) => {
    const currentVersion = await getCurrentVersion();  // из config.json
    const latestVersion = await fetchLatestVersion();   // из GitHub
    
    const hasUpdate = currentVersion.split('.').map(Number).join('.') < latestVersion.split('.').map(Number).join('.')
    
    res.json({
        hasUpdate: hasUpdate,        // ← клиенту главное это
        currentVersion: currentVersion,
        latestVersion: latestVersion,
        // changelog: "Обновления есть"


    });
});

// ======================
// РОУТЫ ОБНОВЛЕНИЯ ПЛАТФОРМЫ
// ======================

// Роут: обновление платформы
router.post('/update', async (req, res) => {
    // Сразу отвечаем, что обновление запущено
    res.json({ 
        success: true, 
        message: 'Обновление запущено',
        status: 'processing'
    });
    
    // Запускаем обновление в фоне
    (async () => {
        const result = await performUpdate();
        if (!result.success) {
            await herculesLog(`Update failed: ${result.error}`, 'ERROR');
        }
    })();
});

// Роут: получение статуса обновления
router.get('/update/status', async (req, res) => {
    try {
        const status = await getUpdateStatus();
        res.json({ success: true, ...status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/license/activate', licenseLimiter, async (req, res) => {
    const { licenseKey } = req.body;
    
    if (!licenseKey || typeof licenseKey !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Лицензионный ключ обязателен'
        });
    }
    
    const trimmedKey = licenseKey.trim();
    
    if (!isValidLicenseKey(trimmedKey)) {
        await herculesLog(`Неверный формат ключа: ${trimmedKey}`, 'WARN');
        return res.status(400).json({
            success: false,
            error: 'Неверный формат лицензионного ключа'
        });
    }
    
    try {
        const validation = await validateLicenseKey(trimmedKey);
        
        if (!validation.valid) {
            await herculesLog(`Недействительный ключ: ${trimmedKey}`, 'WARN');
            return res.status(401).json({
                success: false,
                error: 'Недействительный лицензионный ключ'
            });
        }
        
        if (validation.expiresAt && new Date(validation.expiresAt) < new Date()) {
            await herculesLog(`Просроченный ключ: ${trimmedKey}`, 'WARN');
            return res.status(401).json({
                success: false,
                error: 'Срок действия лицензии истёк'
            });
        }
        
        // Сохраняем лицензию в config.json
        const CONFIG_PATH = path.join(process.cwd(), 'hercules', 'config.json');
        
        let config = {};
        try {
            const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
            config = JSON.parse(configData);
        } catch {
            config = { info: {} };
        }
        
        if (!config.info) config.info = {};
        
        config.info.licenseType = validation.licenseType === 'plus' ? 'Геркулес Плюс' : 'Геркулес Бесплатная';
        config.info.licenseExpiry = validation.expiresAt || 'Бессрочно';
        config.info.licenseToken = validation.token;
        config.info.licenseActivatedAt = new Date().toISOString();
        config.info.remainingDays = validation.remainingDays || null;
        
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
        
        await herculesLog(`Лицензия активирована, сохранена в config.json`, 'INFO');
        
        res.json({
            success: true,
            message: 'Лицензия успешно активирована',
            licenseType: validation.licenseType === 'plus' ? 'Геркулес Плюс' : 'Геркулес Бесплатная',
            expiresAt: validation.expiresAt,
            remainingDays: validation.remainingDays || 365,
            token: validation.token
        });
        
    } catch (error) {
        await herculesLog(`Ошибка активации лицензии: ${error.message}`, 'ERROR');
        res.status(500).json({
            success: false,
            error: 'Ошибка активации лицензии'
        });
    }
});


router.get('/license/status/:tool', async (req, res) => {
    const { tool } = req.params;
    
    try {
        const configPath = path.join(process.cwd(), 'hercules', 'config.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configData);
        
        const tools = config.tools || [];
        const toolData = tools.find(t => t.id === tool);
        
        if (toolData && toolData.state === 'active') {
            res.json({
                success: true,
                active: true,
                licenseType: toolData.licenseType,
                expiresAt: toolData.expiresAt
            });
        } else {
            res.json({
                success: true,
                active: false,
                message: `Инструмент ${tool} не активирован`
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});



router.get('/history', async (req, res) => {
    try {
        let history = { records: [] };
        
        try {
            // Просто await, без лишней обёртки
            const data = await getHistory();
            history = data;
        } catch (err) {
            console.error('Error loading history:', err);
            history = { records: [] };
        }
    
        // Берём первые 25 свежих записей
        const records = history.records.slice(0, 25);
        
        res.json({ 
            success: true, 
            records,
            total: history.records.length
        });
        
    } catch (error) {
        await herculesLog(`Error getting history: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});


router.delete('/history', async (req, res) => {
    try {
        const result = await deleteHistory();
        
        if (result.success) {
            res.json({ success: true, message: 'History cleared' });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        await herculesLog(`Error in DELETE /api/history: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/webhook', 
    express.raw({ type: 'application/json' }), 
    webhookLimiter, 
    async (req, res) => {
        req.rawBody = req.body.toString();
        try {
            req.body = JSON.parse(req.rawBody);
        } catch {}
        await handleGitWebhook(req, res);
    }
);
export default router;