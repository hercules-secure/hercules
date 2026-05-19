import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import AdmZip from 'adm-zip';
import * as tar from 'tar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// ======================
// ЛОГГЕР В ФАЙЛ
// ======================
const LOG_DIR = path.join(process.cwd(), 'logs', 'addons');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

async function ensureLogDir() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (err) {}
}

async function log(message, level = 'INFO') {
    try {
        await ensureLogDir();
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message}\n`;
        await fs.appendFile(LOG_FILE, logLine);
    } catch (err) {}
}

// ======================
// РАБОТА С ФАЙЛАМИ
// ======================
const addonsDir = path.join(process.cwd(), 'addons');
const catalogFilePath = path.join(addonsDir, 'catalog.json');
const installedFilePath = path.join(addonsDir, 'installed.json');

async function ensureAddonsDir() {
    try {
        await fs.mkdir(addonsDir, { recursive: true });
    } catch (err) {}
}

// Загрузка каталога доступных расширений
async function loadCatalog() {
    try {
        await ensureAddonsDir();
        const data = await fs.readFile(catalogFilePath, 'utf-8');
        const catalog = JSON.parse(data);
        return catalog.addons || [];
    } catch (err) {
        if (err.code === 'ENOENT') {
            await log(`Catalog file not found: ${catalogFilePath}`, 'WARN');
            return [];
        }
        await log(`Error loading catalog: ${err.message}`, 'ERROR');
        return [];
    }
}

// Загрузка установленных расширений
async function loadInstalledExtensions() {
    try {
        await ensureAddonsDir();
        const data = await fs.readFile(installedFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await fs.writeFile(installedFilePath, '[]');
            return [];
        }
        await log(`Error loading installed extensions: ${err.message}`, 'ERROR');
        return [];
    }
}

// Сохранение установленных расширений
async function saveInstalledExtensions(installed) {
    await ensureAddonsDir();
    await fs.writeFile(installedFilePath, JSON.stringify(installed, null, 2));
}

// Проверка обновлений
function checkForUpdate(available, installed) {
    if (!installed) return false;
    return available.version !== installed.version;
}

// Функция для загрузки полного каталога
async function loadCatalogData() {
    try {
        await ensureAddonsDir();
        const data = await fs.readFile(catalogFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return { addons: [], categories: [] };
        }
        return { addons: [], categories: [] };
    }
}

// ======================
// ДИНАМИЧЕСКАЯ ЗАГРУЗКА UI МАРШРУТОВ
// ======================

export async function loadUIRoutes(app) {
    const installed = await loadInstalledExtensions();
    
    if (!installed.length) {
        await log('Нет установленных расширений для UI', 'WARN');
        return;
    }
    
    await log(`Загрузка UI маршрутов для ${installed.length} расширений...`, 'INFO');
    
    for (const extension of installed) {
        if (extension.enabled === false) {
            await log(`${extension.id}: отключён, UI пропускаем`, 'INFO');
            continue;
        }
        
        if (!extension.ui) {
            await log(`${extension.id}: UI не указан, пропускаем`, 'WARN');
            continue;
        }
        
        const uiPath = path.resolve(process.cwd(), extension.ui);
        
        try {
            await fs.access(uiPath);
            const routePath = extension.url || `/${extension.id}`;
            app.get(routePath, (req, res) => {
                res.sendFile(uiPath);
            });
            await log(`UI маршрут загружен: ${routePath} -> ${extension.ui}`, 'INFO');
        } catch (err) {
            await log(`${extension.id}: UI файл не найден - ${extension.ui}`, 'WARN');
        }
    }
    
    await log('Загрузка UI маршрутов завершена', 'INFO');
}

// ======================
// ДИНАМИЧЕСКАЯ ЗАГРУЗКА РОУТЕРОВ
// ======================

export async function loadExtensionRoutes(app) {
    const installed = await loadInstalledExtensions();
    
    if (!installed.length) {
        await log('Нет установленных расширений', 'WARN');
        return;
    }
    
    await log(`Загрузка ${installed.length} расширений...`, 'INFO');
    
    const loadedRoutes = [];
    
    for (const extension of installed) {
        if (extension.enabled === false) {
            await log(`${extension.id}: отключён, пропускаем`, 'INFO');
            continue;
        }
        
        const routerPath = path.resolve(process.cwd(), extension.router);
        
        try {
            await fs.access(routerPath);
            
            const module = await import(`file://${routerPath}`);
            
            let routerInstance = null;
            
            if (module.createRouter && typeof module.createRouter === 'function') {
                routerInstance = module.createRouter({ 
                    logger: { 
                        info: (msg) => log(msg, 'INFO'), 
                        error: (msg) => log(msg, 'ERROR'), 
                        warn: (msg) => log(msg, 'WARN') 
                    }, 
                    extension 
                });
            } else if (module.default && typeof module.default === 'function') {
                routerInstance = module.default({ 
                    logger: { 
                        info: (msg) => log(msg, 'INFO'), 
                        error: (msg) => log(msg, 'ERROR'), 
                        warn: (msg) => log(msg, 'WARN') 
                    }, 
                    extension 
                });
            } else if (module.default && typeof module.default === 'object') {
                routerInstance = module.default;
            }
            
            if (routerInstance) {
                const apiPath = `/api/${extension.id}`;
                app.use(apiPath, routerInstance);
                loadedRoutes.push({ id: extension.id, apiPath, routerPath: extension.router });
                await log(`Роутер загружен: ${extension.id} -> ${apiPath} (${extension.router})`, 'INFO');
            } else {
                await log(`${extension.id}: Не найден валидный роутер в ${extension.router}`, 'WARN');
            }
            
        } catch (err) {
            if (err.code === 'ENOENT') {
                await log(`${extension.id}: Файл не найден - ${extension.router}`, 'WARN');
            } else {
                await log(`${extension.id}: Ошибка загрузки - ${err.message}`, 'ERROR');
            }
        }
    }
    
    await log(`Загрузка расширений завершена. Загружено: ${loadedRoutes.length}`, 'INFO');
    await log(`Загруженные роутеры: ${loadedRoutes.map(r => `${r.id} -> ${r.apiPath}`).join(', ')}`, 'INFO');
}

// ======================
// ЗАГРУЗКА АРХИВА С РАСШИРЕНИЕМ
// ======================

const TEMP_ADDONS_DIR = path.join(process.cwd(), 'temp', 'addons');

async function ensureCleanExtractDir(extractDir) {
    // Удаляем директорию если она существует
    try {
        await fs.rm(extractDir, { recursive: true, force: true });
    } catch (err) {
        // Игнорируем ошибку, если директории нет
    }
    // Создаём заново
    await fs.mkdir(extractDir, { recursive: true });
}

const uploadAddonArchive = multer({
    dest: TEMP_ADDONS_DIR,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.zip', '.tar', '.gz', '.tgz'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext) || file.originalname.endsWith('.tar.gz')) {
            cb(null, true);
        } else {
            cb(new Error('Поддерживаются только ZIP, TAR, TAR.GZ архивы'));
        }
    }
});

async function extractZipArchive(zipPath, extractDir) {
    // Проверяем существование файла
    await fs.access(zipPath);
    
    const zip = new AdmZip(zipPath);
    
    // Получаем список записей в архиве
    const entries = zip.getEntries();
    
    // Проверяем, нет ли проблем с путями
    for (const entry of entries) {
        const entryPath = path.join(extractDir, entry.entryName);
        if (entry.isDirectory) {
            await fs.mkdir(entryPath, { recursive: true }).catch(() => {});
        }
    }
    
    // Распаковываем
    zip.extractAllTo(extractDir, true);
}


async function extractTarArchive(tarPath, extractDir) {
    await tar.x({
        file: tarPath,
        cwd: extractDir,
        strict: true
    });
}

async function extractAddonArchive(archivePath, originalName, extractDir) {
    // Очищаем целевую директорию
    await ensureCleanExtractDir(extractDir);
    
    const fileName = originalName.toLowerCase();
    const isZip = fileName.endsWith('.zip');
    const isTarGz = fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz');
    const isTar = fileName.endsWith('.tar');
    
    try {
        if (isZip) {
            await extractZipArchive(archivePath, extractDir);
        } else if (isTarGz || isTar) {
            await extractTarArchive(archivePath, extractDir);
        } else {
            throw new Error(`Формат архива не поддерживается: ${fileName}`);
        }
    } catch (err) {
        // При ошибке удаляем частично распакованную директорию
        await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
        throw err;
    }
}

router.post('/api/extensions/upload', uploadAddonArchive.single('archive'), async (req, res) => {
    let extractDir = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'NO_FILE',
                message: 'Файл не загружен'
            });
        }
        
        await log(`[Extensions] Загружен архив: ${req.file.originalname}, размер: ${req.file.size} bytes`);
        
        // Уникальный ID для распаковки (используем имя файла без расширения + timestamp)
        const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
        const uniqueId = `${baseName}_${Date.now()}`;
        extractDir = path.join(TEMP_ADDONS_DIR, uniqueId);
        
        await log(`[Extensions] Распаковка в: ${extractDir}`);
        
        // Распаковываем архив
        await extractAddonArchive(req.file.path, req.file.originalname, extractDir);
        
        // Проверяем manifest.json
        const manifestPath = path.join(extractDir, 'manifest.json');
        let manifest;
        try {
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            manifest = JSON.parse(manifestContent);
        } catch (err) {
            throw new Error('manifest.json не найден или невалидный');
        }
        
        if (!manifest.id || !manifest.name || !manifest.version) {
            throw new Error('manifest.json должен содержать id, name, version');
        }
        
        // Проверяем router.js
        const routerPath = path.join(extractDir, manifest.router || 'addon/router.js');
        try {
            await fs.access(routerPath);
        } catch (err) {
            throw new Error(`Файл роутера не найден: ${manifest.router || 'addon/router.js'}`);
        }
        
        await log(`[Extensions] Архив проверен: ${manifest.id} v${manifest.version}`, 'INFO');
        
        res.json({
            success: true,
            message: 'Архив успешно загружен и проверен',
            extractPath: extractDir,
            manifest: manifest,
            requiresConfirmation: true
        });
        
    } catch (error) {
        await log(`[Extensions] Ошибка загрузки: ${error.message}`, 'ERROR');
        
        // Очистка при ошибке
        if (extractDir) {
            await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
        }
        
        res.status(500).json({
            success: false,
            error: 'UPLOAD_ERROR',
            message: error.message
        });
    } finally {
        if (req.file?.path) {

            fs.unlink(req.file.path).catch((err) => {
                log(`[Extensions] Не удалось удалить временный файл: ${err.message}`, 'WARN');
            });
        }

    }
});

// ======================
// API МАРШРУТЫ
// ======================

router.get('/api/extensions', async (req, res) => {
    try {
        await log('[Extensions] GET /api/extensions');
        
        const catalogData = await loadCatalogData();
        const catalog = catalogData.addons || [];
        const categories = catalogData.categories || [];
        
        const installed = await loadInstalledExtensions();
        const installedMap = new Map(installed.map(ext => [ext.id, ext]));
        
        const extensionsWithStatus = catalog.map(ext => ({
            ...ext,
            installed: installedMap.has(ext.id),
            hasUpdate: checkForUpdate(ext, installedMap.get(ext.id)),
            newVersion: installedMap.get(ext.id)?.version !== ext.version ? ext.version : null
        }));
        
        res.json({ 
            success: true, 
            extensions: extensionsWithStatus,
            categories: categories
        });
    } catch (error) {
        await log(`[Extensions] Error: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/api/extensions/installed', async (req, res) => {
    try {
        const installed = await loadInstalledExtensions();
        res.json({ success: true, extensions: installed });
    } catch (error) {
        await log(`[Extensions] Error in GET /api/extensions/installed: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/api/extensions/catalog', async (req, res) => {
    try {
        const catalog = await loadCatalog();
        res.json({ success: true, catalog });
    } catch (error) {
        await log(`[Extensions] Error in GET /api/extensions/catalog: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/api/extensions/routes', async (req, res) => {
    try {
        const installed = await loadInstalledExtensions();
        const routes = [];
        
        for (const extension of installed) {
            const routerPath = path.resolve(process.cwd(), extension.router);
            let routerExists = false;
            try {
                await fs.access(routerPath);
                routerExists = true;
            } catch {
                routerExists = false;
            }
            
            routes.push({
                id: extension.id,
                name: extension.name,
                enabled: extension.enabled !== false,
                routerPath: extension.router,
                routerExists: routerExists,
                apiPath: `/api/${extension.id}`
            });
        }
        
        res.json({ success: true, routes });
    } catch (error) {
        await log(`[Extensions] Error in GET /api/extensions/routes: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/extensions/install', async (req, res) => {
    try {
        const { extensionId } = req.body;
        
        if (!extensionId) {
            return res.status(400).json({ success: false, error: 'extensionId required' });
        }
        
        await log(`[Extensions] Installing: ${extensionId}`);
        
        const catalog = await loadCatalog();
        const extension = catalog.find(ext => ext.id === extensionId);
        
        if (!extension) {
            return res.status(404).json({ success: false, error: 'Extension not found in catalog' });
        }
        
        const installed = await loadInstalledExtensions();
        
        if (installed.some(ext => ext.id === extensionId)) {
            return res.status(400).json({ success: false, error: 'Extension already installed' });
        }
        
        const maxOrder = installed.reduce((max, ext) => {
            const order = ext.order || 0;
            return order > max ? order : max;
        }, 0);
        
        const newExtension = {
            id: extension.id,
            name: extension.name,
            version: extension.version,
            description: extension.description || '',
            icon: extension.icon || 'fa-puzzle-piece',
            url: extension.url || `/addon/view/${extension.id}`,
            router: extension.router || `./addons/${extension.id}/router.js`,
            ui: extension.ui,
            enabled: true,
            order: maxOrder + 1
        };
        
        installed.push(newExtension);
        await saveInstalledExtensions(installed);
        await log(`[Extensions] Installed: ${extensionId} (${extension.name})`);
        
        res.json({ 
            success: true, 
            message: `Extension ${extension.name} installed successfully`,
            extension: newExtension,
            requiresRestart: true
        });
        
    } catch (error) {
        await log(`[Extensions] Error installing: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/extensions/uninstall', async (req, res) => {
    try {
        const { extensionId } = req.body;
        
        if (!extensionId) {
            return res.status(400).json({ success: false, error: 'extensionId required' });
        }
        
        await log(`[Extensions] Uninstalling: ${extensionId}`);
        
        const installed = await loadInstalledExtensions();
        const filtered = installed.filter(ext => ext.id !== extensionId);
        
        if (filtered.length === installed.length) {
            return res.status(404).json({ success: false, error: 'Extension not installed' });
        }
        
        await saveInstalledExtensions(filtered);
        await log(`[Extensions] Uninstalled: ${extensionId}`);
        
        res.json({ success: true, message: 'Extension uninstalled successfully', requiresRestart: true });
    } catch (error) {
        await log(`[Extensions] Error uninstalling: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/extensions/update', async (req, res) => {
    try {
        const { extensionId } = req.body;
        
        if (!extensionId) {
            return res.status(400).json({ success: false, error: 'extensionId required' });
        }
        
        await log(`[Extensions] Updating: ${extensionId}`);
        
        const catalog = await loadCatalog();
        const installed = await loadInstalledExtensions();
        const extensionIndex = installed.findIndex(ext => ext.id === extensionId);
        
        if (extensionIndex === -1) {
            return res.status(404).json({ success: false, error: 'Extension not installed' });
        }
        
        const availableExt = catalog.find(ext => ext.id === extensionId);
        if (availableExt) {
            const oldVersion = installed[extensionIndex].version;
            installed[extensionIndex].version = availableExt.version;
            installed[extensionIndex].updatedAt = new Date().toISOString();
            await saveInstalledExtensions(installed);
            await log(`[Extensions] Updated: ${extensionId} ${oldVersion} → ${availableExt.version}`);
        }
        
        res.json({ success: true, message: 'Extension updated successfully', requiresRestart: true });
    } catch (error) {
        await log(`[Extensions] Error updating: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/extensions/toggle', async (req, res) => {
    try {
        const { extensionId, enabled } = req.body;
        
        if (!extensionId) {
            return res.status(400).json({ success: false, error: 'extensionId required' });
        }
        
        await log(`[Extensions] Toggling: ${extensionId} -> ${enabled ? 'enabled' : 'disabled'}`);
        
        const installed = await loadInstalledExtensions();
        const extensionIndex = installed.findIndex(ext => ext.id === extensionId);
        
        if (extensionIndex === -1) {
            return res.status(404).json({ success: false, error: 'Extension not installed' });
        }
        
        installed[extensionIndex].enabled = enabled;
        await saveInstalledExtensions(installed);
        
        res.json({ success: true, message: `Extension ${enabled ? 'enabled' : 'disabled'}`, requiresRestart: true });
    } catch (error) {
        await log(`[Extensions] Error toggling: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/extensions/refresh', async (req, res) => {
    try {
        await log('[Extensions] Refreshing catalog');
        res.json({ success: true, message: 'Catalog refreshed' });
    } catch (error) {
        await log(`[Extensions] Error refreshing catalog: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;