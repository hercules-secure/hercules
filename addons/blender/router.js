import express from 'express';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import multer from 'multer';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { saveToHistory } from '../../hercules/history/history.js';

import {
    generateId,
    cloneRepository,
    extractArchive,
    cleanupTempDir,
    createTempDir,
    log
} from './utils.js';

// Импорт анализаторов
import { analyzeSCA } from './sca/sca.js';
import { analyzeSAST } from './sast/sast.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к папке history (рядом со скриптом) - для детальных отчетов
const HISTORY_DIR = path.join(__dirname, 'history');

// ==================== ЛИМИТЕРЫ ====================
// Лимитер для Git репозиториев
const gitLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 минута
    max: 10, // максимум 10 запросов в минуту
    message: {
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Слишком много запросов. Попробуйте позже.'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
});

// Лимитер для загрузки архивов
const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: {
        success: false,
        error: 'TOO_MANY_UPLOADS',
        message: 'Слишком много загрузок. Попробуйте позже.'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
});

// Лимитер для получения результатов
const resultLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: {
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Слишком много запросов. Попробуйте позже.'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
});

// Общий лимитер для всех запросов
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: {
        success: false,
        error: 'GLOBAL_RATE_LIMIT_EXCEEDED',
        message: 'Слишком много запросов. Попробуйте позже.'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
});

// Функция для проверки и создания папки history
async function ensureHistoryDir() {
    try {
        await fsPromises.access(HISTORY_DIR);
        log(`[Blender] Папка history существует: ${HISTORY_DIR}`, 'INFO');
    } catch (error) {
        log(`[Blender] Папка history не найдена, создаем: ${HISTORY_DIR}`, 'INFO');
        await fsPromises.mkdir(HISTORY_DIR, { recursive: true });
        log(`[Blender] Папка history успешно создана`, 'INFO');
    }
}

// Вызываем при старте
await ensureHistoryDir();

// Загрузка публичного ключа
let PUBLIC_KEY = null;
try {
    const publicKeyPath = path.join(process.cwd(), 'hercules', 'public.pem');
    PUBLIC_KEY = fs.readFileSync(publicKeyPath, 'utf8');
    log('[Blender] Public key loaded', 'INFO');
} catch (error) {
    log(`[Blender] Public key not found: ${error.message}`, 'ERROR');
}

// Настройка multer
const upload = multer({ 
    dest: '/tmp/uploads/',
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.zip', '.tar', '.gz', '.tgz', '.7z'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext) || file.originalname.endsWith('.tar.gz')) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый формат архива'));
        }
    }
});

// Хранилище результатов анализа (временное)
const analysisResults = new Map();

// Middleware проверки JWT (для защищенных эндпоинтов)
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        log('[Blender] Missing or invalid Authorization header', 'WARN');
        return res.status(401).json({
            success: false,
            error: 'Требуется авторизация',
            needLicense: true
        });
    }
    
    const token = authHeader.substring(7);
    
    if (!PUBLIC_KEY) {
        log('[Blender] Public key not available', 'ERROR');
        return res.status(500).json({
            success: false,
            error: 'Ошибка конфигурации сервера'
        });
    }
    
    try {
        const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
        
        if (decoded.expiresAt && new Date(decoded.expiresAt) < new Date()) {
            log(`[Blender] Token expired for ${decoded.licenceKey}`, 'WARN');
            return res.status(403).json({
                success: false,
                error: 'Срок действия лицензии истёк',
                needRenew: true
            });
        }
        
        req.license = {
            licenceKey: decoded.licenceKey,
            productId: decoded.productId,
            expiresAt: decoded.expiresAt,
            remainingDays: decoded.remainingDays
        };
        
        log(`[Blender] Token verified for ${decoded.licenceKey}, remaining days: ${decoded.remainingDays}`, 'INFO');
        next();
    } catch (error) {
        log(`[Blender] Token verification error: ${error.message}`, 'ERROR');
        
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({
                success: false,
                error: 'Токен истёк, требуется повторная активация',
                needReauth: true
            });
        }
        
        return res.status(401).json({
            success: false,
            error: 'Недействительный токен',
            needLicense: true
        });
    }
}

async function analyzeProject(projectPath) {
    log(`[Analyzer] Запуск анализа проекта: ${projectPath}`);
    const startTime = Date.now();
    
    const [scaResult, sastResult] = await Promise.allSettled([
        (async () => {
            log(`[Analyzer] Запуск SCA анализа...`);
            const start = Date.now();
            const result = await analyzeSCA(projectPath);
            log(`[Analyzer] SCA завершён за ${Date.now() - start}ms, найдено зависимостей: ${result.statistics?.totalDependencies || 0}`);
            return result;
        })(),
        
        (async () => {
            log(`[Analyzer] Запуск SAST анализа...`);
            const start = Date.now();
            const result = await analyzeSAST(projectPath);
            log(`[Analyzer] SAST завершён за ${Date.now() - start}ms, найдено проблем: ${result.statistics?.total || 0}`);
            return result;
        })()
    ]);
    
    const totalTime = Date.now() - startTime;
    log(`[Analyzer] Все анализы завершены за ${totalTime}ms`, 'INFO');
    
    return {
        sca: scaResult.status === 'fulfilled' ? scaResult.value : { error: scaResult.reason?.message },
        sast: sastResult.status === 'fulfilled' ? sastResult.value : { error: sastResult.reason?.message }
    };
}

async function processGitRepository(repoUrl, branch = null) {
    const taskId = generateId();
    const startTime = new Date().toISOString();
    const tempPath = createTempDir(taskId);
    
    try {
        log(`[${taskId}] Клонирование ${repoUrl}`);
        const cloneStart = Date.now();
        await cloneRepository(repoUrl, branch, tempPath);
        log(`[${taskId}] Клонирование завершено за ${Date.now() - cloneStart}ms`);
        
        const analysis = await analyzeProject(tempPath);
        
        const result = {
            success: true,
            taskId,
            status: 'completed',
            source: repoUrl,
            branch: branch || 'default',
            ...analysis,
            analyzedAt: new Date().toISOString()
        };
        
        analysisResults.set(taskId, result);
        
        // Сохраняем детальный отчет
        const historyFilePath = path.join(HISTORY_DIR, `${taskId}.json`);
        await fsPromises.writeFile(historyFilePath, JSON.stringify(result, null, 2), 'utf8');
        log(`[Blender] Детальный отчет сохранен в: ${historyFilePath}`, 'INFO');
        
        // Сохраняем запись в общую историю
        await saveToHistory(
            'blender',
            'repository',
            repoUrl,
            startTime,
            'success',
            taskId,
            branch || 'main',
            null
        );
        log(`[Blender] Запись в общую историю сохранена для ${taskId}`, 'INFO');
        
        cleanupTempDir(tempPath);
        
        return result;
        
    } catch (error) {
        log(`[${taskId}] Ошибка: ${error.message}`, 'ERROR');
        cleanupTempDir(tempPath);
        
        const errorResult = {
            success: false,
            taskId,
            status: 'error',
            error: error.message,
            source: repoUrl,
            analyzedAt: new Date().toISOString()
        };
        
        const historyFilePath = path.join(HISTORY_DIR, `${taskId}.json`);
        await fsPromises.writeFile(historyFilePath, JSON.stringify(errorResult, null, 2), 'utf8');
        
        await saveToHistory(
            'blender',
            'repository',
            repoUrl,
            startTime,
            'error',
            taskId,
            branch || 'main',
            error.message
        );
        
        return errorResult;
    }
}

async function processArchive(archivePath, originalName = null) {
    const taskId = generateId();
    const startTime = new Date().toISOString();
    const tempPath = createTempDir(taskId);
    
    try {
        log(`[${taskId}] Распаковка архива ${originalName || archivePath}`);
        const extractStart = Date.now();
        await extractArchive(archivePath, tempPath, originalName);
        log(`[${taskId}] Распаковка завершена за ${Date.now() - extractStart}ms`);
        
        let analysisPath = tempPath;
        const files = fs.readdirSync(tempPath);
        log(`[${taskId}] Распаковано элементов: ${files.length}`);
        
        if (files.length === 1) {
            const singleItem = path.join(tempPath, files[0]);
            try {
                const stat = fs.statSync(singleItem);
                if (stat.isDirectory()) {
                    analysisPath = singleItem;
                    log(`[${taskId}] Архив содержит папку '${files[0]}', анализируем внутри`);
                }
            } catch (err) {
                log(`[${taskId}] Ошибка проверки элемента: ${err.message}`, 'ERROR');
            }
        }
        
        const analysis = await analyzeProject(analysisPath);
        
        const result = {
            success: true,
            taskId,
            status: 'completed',
            source: originalName || archivePath,
            ...analysis,
            analyzedAt: new Date().toISOString()
        };
        
        analysisResults.set(taskId, result);
        
        const historyFilePath = path.join(HISTORY_DIR, `${taskId}.json`);
        await fsPromises.writeFile(historyFilePath, JSON.stringify(result, null, 2), 'utf8');
        log(`[Blender] Детальный отчет сохранен в: ${historyFilePath}`, 'INFO');
        log(`[Blender] Анализ завершен, SCA: ${analysis.sca?.statistics?.totalDependencies || 0} компонентов, SAST: ${analysis.sast?.statistics?.total || 0} проблем`);
        
        await saveToHistory(
            'blender',
            'archive',
            originalName || archivePath,
            startTime,
            'success',
            taskId,
            null,
            null
        );
        log(`[Blender] Запись в общую историю сохранена для ${taskId}`, 'INFO');
        
        cleanupTempDir(tempPath);
        
        if (fs.existsSync(archivePath)) {
            fs.unlinkSync(archivePath);
        }
        
        return result;
        
    } catch (error) {
        log(`[${taskId}] Ошибка: ${error.message}`, 'ERROR');
        cleanupTempDir(tempPath);
        
        const errorResult = {
            success: false,
            taskId,
            status: 'error',
            error: error.message,
            source: originalName || archivePath,
            analyzedAt: new Date().toISOString()
        };
        
        const historyFilePath = path.join(HISTORY_DIR, `${taskId}.json`);
        await fsPromises.writeFile(historyFilePath, JSON.stringify(errorResult, null, 2), 'utf8');
        
        await saveToHistory(
            'blender',
            'archive',
            originalName || archivePath,
            startTime,
            'error',
            taskId,
            null,
            error.message
        );
        
        return errorResult;
    }
}

// ========== createRouter ==========

export function createRouter({ logger, extension }) {
    const router = express.Router();
    
    if (logger) {
        logger.info(`Инициализация роутера для ${extension.name}`);
    }
    
    // Применяем глобальный лимитер ко всем запросам
    router.use(globalLimiter);
    
    // Защищенные эндпоинты (требуют токен)
    router.post('/analyze/git', verifyToken, gitLimiter, async (req, res) => {
        const { url, branch } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL репозитория обязателен' });
        }
        
        const taskId = generateId();
        
        res.json({
            success: true,
            taskId,
            message: 'Анализ запущен',
            status: 'processing',
            license: req.license
        });
        
        (async () => {
            const result = await processGitRepository(url, branch);
            analysisResults.set(taskId, result);
            log(`[${taskId}] Анализ репозитория завершен`, 'INFO');
        })();
    });
    
    router.post('/analyze/archive/upload', verifyToken, uploadLimiter, upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Файл не загружен' });
            }

            log(`[UPLOAD] Архив загружен: ${req.file.originalname}, размер: ${req.file.size} bytes`, 'INFO');
            
            const taskId = generateId();
            const fileName = req.file.originalname;
            
            processArchive(req.file.path, fileName)
                .then(async (result) => {
                    analysisResults.set(taskId, result);
                    log(`[UPLOAD] Анализ завершен для ${fileName}, taskId: ${taskId}`, 'INFO');
                })
                .catch(async (error) => {
                    log(`[UPLOAD] Ошибка анализа для ${fileName}: ${error.message}`, 'ERROR');
                    analysisResults.set(taskId, {
                        success: false,
                        taskId,
                        status: 'error',
                        error: error.message,
                        source: fileName
                    });
                });
            
            res.json({
                success: true,
                taskId,
                message: 'Анализ запущен',
                status: 'processing',
                license: req.license
            });
            
        } catch (error) {
            log(`[UPLOAD] Ошибка в /analyze/archive/upload: ${error.message}`, 'ERROR');
            res.status(500).json({ error: error.message });
        }
    });
    
    router.get('/result/:id', verifyToken, resultLimiter, (req, res) => {
        const { id } = req.params;
        const result = analysisResults.get(id);
        
        if (!result) {
            return res.status(404).json({ error: 'Результат не найден' });
        }
        
        res.json(result);
    });
    
    // Публичный эндпоинт для просмотра истории (БЕЗ проверки токена)
    router.get('/history/:reportId', resultLimiter, async (req, res) => {
        const { reportId } = req.params;
        
        try {
            const reportPath = path.join(HISTORY_DIR, `${reportId}.json`);
            const reportData = await fsPromises.readFile(reportPath, 'utf-8');
            const report = JSON.parse(reportData);
            
            // Генерируем HTML отчет для удобного просмотра
            const { generateHTMLReport } = await import('./history.js');
            const html = generateHTMLReport(report);
            
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
        } catch (error) {
            log(`[Blender] Отчет ${reportId} не найден: ${error.message}`, 'WARN');
            res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Отчет не найден</title>
                    <style>
                        body { font-family: 'Ubuntu', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                        .error-container { text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                        h1 { color: #ef4444; margin-bottom: 16px; }
                        p { color: #666; margin-bottom: 24px; }
                        a { color: #667eea; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div class="error-container">
                        <h1>Отчет не найден</h1>
                        <p>Отчет с ID <strong>${reportId}</strong> не существует или был удален.</p>
                        <a href="/blender">← Вернуться к анализатору</a>
                    </div>
                </body>
                </html>
            `);
        }
    });
    
    return router;
}