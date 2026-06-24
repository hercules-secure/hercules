import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ArchiveReceiver } from './archive/index.js';
import { ArchiveExtractor } from './archive/extractor.js';
import { analyzeCode } from './sast.js';
import { saveToHistory } from '../../hercules/history/history.js';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(process.cwd(), 'temp');
const EXTRACTED_DIR = path.join(TEMP_DIR, 'sast/extracted');
const STORAGE_DIR = path.join(TEMP_DIR, 'sast/storage');

// Путь к rules.json - рядом с текущим файлом
const DEFAULT_RULES_PATH = path.join(__dirname, 'rules.json');

// Путь к папке history
const HISTORY_DIR = path.join(__dirname, 'history');

// ==================== НАСТРОЙКА ЛОГГЕРА ====================
const LOG_DIR = path.join(process.cwd(), 'logs', 'sast');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

async function ensureLogDir() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (err) {}
}

await ensureLogDir();

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: LOG_FILE })
    ]
});

// Функция для проверки и создания папки history
async function ensureHistoryDir() {
    try {
        await fs.access(HISTORY_DIR);
        logger.info(`[SAST] Папка history существует: ${HISTORY_DIR}`);
    } catch (error) {
        logger.info(`[SAST] Папка history не найдена, создаем: ${HISTORY_DIR}`);
        await fs.mkdir(HISTORY_DIR, { recursive: true });
        logger.info(`[SAST] Папка history успешно создана`);
    }
}

// Вызываем функцию при старте
await ensureHistoryDir();

// ========== ЛИМИТЕРЫ ==========
// Ограничение на количество запросов
const rateLimiters = {
    // Для загрузки архивов - 5 запросов в минуту
    uploadLimiter: (req, res, next) => {
        if (!global.uploadRequests) global.uploadRequests = new Map();
        
        const clientIp = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowMs = 60 * 1000;
        const maxRequests = 5;
        
        const requests = global.uploadRequests.get(clientIp) || [];
        const validRequests = requests.filter(time => now - time < windowMs);
        
        if (validRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'TOO_MANY_REQUESTS',
                message: `Слишком много запросов. Максимум ${maxRequests} в минуту`,
                retryAfter: Math.ceil((windowMs - (now - validRequests[0])) / 1000)
            });
        }
        
        validRequests.push(now);
        global.uploadRequests.set(clientIp, validRequests);
        next();
    },
    
    // Для анализа - 3 запроса в минуту
    analyzeLimiter: (req, res, next) => {
        if (!global.analyzeRequests) global.analyzeRequests = new Map();
        
        const clientIp = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowMs = 60 * 1000;
        const maxRequests = 3;
        
        const requests = global.analyzeRequests.get(clientIp) || [];
        const validRequests = requests.filter(time => now - time < windowMs);
        
        if (validRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'TOO_MANY_ANALYSIS_REQUESTS',
                message: `Слишком много запросов анализа. Максимум ${maxRequests} в минуту`
            });
        }
        
        validRequests.push(now);
        global.analyzeRequests.set(clientIp, validRequests);
        next();
    },
    
    // Для Git репозиториев - 10 запросов в минуту
    gitLimiter: (req, res, next) => {
        if (!global.gitRequests) global.gitRequests = new Map();
        
        const clientIp = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowMs = 60 * 1000;
        const maxRequests = 10;
        
        const requests = global.gitRequests.get(clientIp) || [];
        const validRequests = requests.filter(time => now - time < windowMs);
        
        if (validRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'TOO_MANY_GIT_REQUESTS',
                message: `Слишком много запросов к Git. Максимум ${maxRequests} в минуту`
            });
        }
        
        validRequests.push(now);
        global.gitRequests.set(clientIp, validRequests);
        next();
    },
    
    // Общий лимитер для всех запросов
    globalLimiter: (req, res, next) => {
        if (!global.globalRequests) global.globalRequests = new Map();
        
        const clientIp = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowMs = 60 * 1000;
        const maxRequests = 30;
        
        const requests = global.globalRequests.get(clientIp) || [];
        const validRequests = requests.filter(time => now - time < windowMs);
        
        if (validRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'GLOBAL_RATE_LIMIT_EXCEEDED',
                message: `Слишком много запросов. Максимум ${maxRequests} в минуту`
            });
        }
        
        validRequests.push(now);
        global.globalRequests.set(clientIp, validRequests);
        next();
    }
};

// Middleware для ограничения размера тела запроса
const bodySizeLimiter = (req, res, next) => {
    const maxSize = 1 * 1024 * 1024;
    
    if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
        return res.status(413).json({
            success: false,
            error: 'PAYLOAD_TOO_LARGE',
            message: `Размер запроса превышает ${maxSize / 1024 / 1024}MB`
        });
    }
    
    next();
};

// ========== НАСТРОЙКА MULTER С ЛИМИТАМИ ==========
const uploadArchive = multer({ 
    dest: TEMP_DIR,
    limits: { 
        fileSize: 100 * 1024 * 1024,
        files: 1,
        fieldSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.zip', '.tar', '.gz', '.tgz', '.7z'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedExtensions.includes(ext) || file.originalname.endsWith('.tar.gz')) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый формат файла. Разрешены: .zip, .tar, .gz, .tgz, .7z'));
        }
    }
});

function errorResponse(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    return res.status(statusCode).json({
        success: false,
        message,
        errors,
        timestamp: new Date().toISOString(),
    });
}

// Функция для динамической загрузки
export function createRouter(options = {}) {
    const { extension = {} } = options;
    
    const router = express.Router();
    
    const receiver = new ArchiveReceiver({ storageDir: STORAGE_DIR });
    const extractor = new ArchiveExtractor({ extractDir: EXTRACTED_DIR, deleteAfter: false });
    
    logger.info(`[${extension.id || 'SAST'}] Инициализация роутера`);

    // Применяем глобальный лимитер ко всем запросам
    router.use(rateLimiters.globalLimiter);

    // Загрузка архива с лимитером
    router.post('/upload', rateLimiters.uploadLimiter, uploadArchive.single('archive'), async (req, res) => {
        if (!req.file) {
            logger.error('[SAST] Файл не загружен');
            return res.status(400).json({ 
                success: false,
                error: 'NO_FILE',
                message: 'Файл не загружен'
            });
        }

        const startTime = new Date().toISOString();
        const fileName = req.file.originalname;

        try {
            logger.info(`[SAST] Загружен архив: ${fileName}`);
            const result = await receiver.getFromFile(req.file.path, fileName);
            
            await saveToHistory(
                'sast',
                'archive',
                fileName,
                startTime,
                'success',
                result.id,
                result.id,
                null
            );
            
            res.json({
                success: true,
                message: 'Файл успешно загружен',
                archive: {
                    id: result.id,
                    filename: result.filename,
                    originalName: result.originalName,
                    size: result.size,
                    source: result.source,
                    createdAt: result.createdAt
                }
            });

        } catch (error) {
            logger.error('[SAST] Ошибка загрузки:', error.message);
            
            await saveToHistory(
                'sast',
                'archive',
                fileName,
                startTime,
                'error',
                null,
                null,
                error.message
            );
            
            if (req.file?.path) {
                await fs.unlink(req.file.path).catch(() => {});
            }
            
            res.status(500).json({ 
                success: false,
                error: 'UPLOAD_ERROR',
                message: error.message
            });
        }
    });

    // Анализ URL репозитория с лимитером
    router.post('/git', rateLimiters.gitLimiter, async (req, res) => {
        const { url, branch } = req.body;
        const startTime = new Date().toISOString();
        
        if (!url) {
            return res.status(400).json({ 
                success: false,
                error: 'URL_REQUIRED',
                message: 'Необходимо передать ссылку на репозиторий'
            });
        }
        
        const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        if (!urlRegex.test(url)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_URL',
                message: 'Некорректный формат URL'
            });
        }

        try {
            logger.info(`[SAST] Анализ URL: ${url}`);
            const result = await receiver.getFromUrl(url, { branch });
            
            await saveToHistory(
                'sast',
                'repository',
                url,
                startTime,
                'success',
                result.id,
                branch || 'main',
                result.id,
                null
            );
            
            res.json({
                success: true,
                message: 'Архив успешно загружен',
                archive: {
                    id: result.id,
                    filename: result.filename,
                    size: result.size,
                    source: result.source,
                    url: result.url,
                    createdAt: result.createdAt
                }
            });

        } catch (error) {
            logger.error('[SAST] Ошибка URL:', error.message);
            
            await saveToHistory(
                'sast',
                'repository',
                url,
                startTime,
                'error',
                branch || 'main',
                null,
                error.message
            );
            
            res.status(500).json({ 
                success: false,
                error: 'URL_ERROR',
                message: error.message
            });
        }
    });

    // Анализ с лимитером
    router.post('/analyze/:archiveId', rateLimiters.analyzeLimiter, async (req, res) => {
        const { archiveId } = req.params;

        if (!archiveId || archiveId.length < 10 || archiveId.length > 100) {
            logger.warn(`[SAST] Invalid archive ID format: ${archiveId}`);
            return res.status(400).json({ 
                success: false,
                error: 'INVALID_ID',
                message: 'Invalid archive ID format' 
            });
        }

        let rulesPath = req.body.rulesPath;
        
        if (!rulesPath) {
            rulesPath = DEFAULT_RULES_PATH;
            logger.info(`[SAST] Using default rules path: ${rulesPath}`);
        }
        
        try {
            await fs.access(rulesPath);
            logger.info(`[SAST] Rules file found at: ${rulesPath}`);
        } catch (error) {
            logger.warn(`[SAST] Rules file not found at: ${rulesPath}, will use built-in patterns`);
            rulesPath = null;
        }
        
        let archiveInfo = null;
        let extractPath = null;
        let archivePath = null;

        try {
            archiveInfo = await receiver.getInfo(archiveId);
            
            if (!archiveInfo) {
                logger.error(`[SAST] Архив не найден: ${archiveId}`);
                return res.status(404).json({ 
                    success: false,
                    error: 'ARCHIVE_NOT_FOUND',
                    message: `Архив с ID ${archiveId} не существует`
                });
            }
            
            archivePath = archiveInfo.path;
            const extractResult = await extractor.extract(archivePath, archiveId);
            extractPath = extractResult.extractPath;
            
            logger.info(`[SAST] Запуск анализа для ${archiveId}`);
            const sastResults = await analyzeCode(extractPath, rulesPath, { verbose: true });
          
            sastResults.metadata = {
                ...sastResults.metadata,
                archiveId,
                archiveName: archiveInfo.filename,
                fileCount: extractResult.fileCount,
                scanTime: new Date().toISOString()
            };

            // Сохраняем результат в папку history
            const historyFilePath = path.join(HISTORY_DIR, `${archiveId}.json`);
            
            // Проверяем существование папки перед записью
            try {
                await fs.access(HISTORY_DIR);
            } catch (err) {
                await fs.mkdir(HISTORY_DIR, { recursive: true });
                logger.info(`[SAST] Папка history создана при сохранении: ${HISTORY_DIR}`);
            }
            
            await fs.writeFile(historyFilePath, JSON.stringify(sastResults, null, 2), 'utf8');
            logger.info(`[SAST] Результат сохранен в: ${historyFilePath}`);

            res.json({
                success: true,
                message: 'SAST анализ успешно завершен',
                results: sastResults
            });

        } catch (error) {
            logger.error('[SAST] Ошибка анализа:', error);
            res.status(500).json({ 
                success: false,
                error: 'ANALYSIS_ERROR',
                message: error.message,
                details: error.stack
            });
        } finally {
            const cleanupPromises = [];
            
            if (extractPath) {
                cleanupPromises.push(fs.rm(extractPath, { recursive: true, force: true }).catch(err => 
                    logger.error('[SAST] Ошибка удаления распакованных файлов:', err.message)
                ));
            }
            
            if (archivePath) {
                cleanupPromises.push(fs.unlink(archivePath).catch(err => 
                    logger.error('[SAST] Ошибка удаления архива:', err.message)
                ));
            }
            
            if (archiveId) {
                cleanupPromises.push(receiver.delete(archiveId).catch(err => 
                    logger.error('[SAST] Ошибка удаления метаданных:', err.message)
                ));
            }
            
            Promise.all(cleanupPromises);
        }
    });

    router.get('/results/:archiveId', rateLimiters.gitLimiter, async (req, res) => {
        const { archiveId } = req.params;
        
        try {
            const resultsPath = path.join(EXTRACTED_DIR, archiveId, 'sast-results.json');
            const results = await fs.readFile(resultsPath, 'utf-8');
            
            res.json({
                success: true,
                results: JSON.parse(results)
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ 
                    success: false,
                    error: 'RESULTS_NOT_FOUND',
                    message: 'Анализ еще не завершен или не запускался'
                });
            } else {
                res.status(500).json({ 
                    success: false,
                    error: 'READ_ERROR',
                    message: error.message 
                });
            }
        }
    });

    router.get('/history/:reportId', rateLimiters.gitLimiter, async (req, res) => {
        const { reportId } = req.params;
        
        logger.info(`[SAST] Поиск отчета: ${reportId}`);
        
        const paths = [
            path.join(HISTORY_DIR, `${reportId}.json`),
            path.join(__dirname, 'history', `${reportId}.json`),
            path.join(process.cwd(), 'history', `${reportId}.json`),
            path.join(__dirname, '..', '..', 'history', `${reportId}.json`)
        ];
        
        let report = null;
        let usedPath = null;
        
        for (const p of paths) {
            try {
                const data = await fs.readFile(p, 'utf-8');
                report = JSON.parse(data);
                usedPath = p;
                logger.info(`[SAST] Файл найден: ${p}`);
                break;
            } catch (err) {
                // Файл не найден, пробуем следующий путь
            }
        }
        
        if (!report) {
            // Логируем содержимое папок для отладки
            for (const dir of [HISTORY_DIR, path.join(__dirname, 'history'), path.join(process.cwd(), 'history')]) {
                try {
                    const files = await fs.readdir(dir);
                    logger.info(`[SAST] В ${dir} найдены файлы: ${files.join(', ')}`);
                } catch (err) {
                    logger.info(`[SAST] Папка ${dir} не существует`);
                }
            }
            
            return res.status(404).send(`Отчёт ${reportId} не найден. Проверьте что файл существует в одной из папок history`);
        }
        
        try {
            const { generateHTMLReport } = await import('./history.js');
            const html = generateHTMLReport(report);
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
        } catch (err) {
            logger.error(`[SAST] Ошибка генерации HTML:`, err);
            res.status(500).send('Ошибка генерации отчета');
        }
    });

    return router;
}

export default createRouter;