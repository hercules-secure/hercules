// addons/sca/router.js
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { analyzeRepository } from './sca.js';
import { GitHubDownloader } from './downloader.js';
import AdmZip from 'adm-zip';
import * as tar from 'tar';
import { saveToHistory } from '../../hercules/history/history.js';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import winston from 'winston';

const TEMP_SCA_DIR = path.join(process.cwd(), 'temp', 'sca');
const EXTRACTED_DIR = path.join(TEMP_SCA_DIR, 'extracted');
const LOG_DIR = path.join(process.cwd(), 'logs', 'sca');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к папке history
const HISTORY_DIR = path.join(__dirname, 'history');

// ==================== НАСТРОЙКА ЛОГГЕРА ====================
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
        logger.info(`[SCA] Папка history существует: ${HISTORY_DIR}`);
    } catch (error) {
        logger.info(`[SCA] Папка history не найдена, создаем: ${HISTORY_DIR}`);
        await fs.mkdir(HISTORY_DIR, { recursive: true });
        logger.info(`[SCA] Папка history успешно создана`);
    }
}

// Вызываем функцию при старте
await ensureHistoryDir();

// ==================== ЛИМИТЕРЫ ====================
// Лимитер для Git webhook
const gitLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
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

// Создаём директории при старте
await fs.mkdir(TEMP_SCA_DIR, { recursive: true }).catch(() => {});
await fs.mkdir(EXTRACTED_DIR, { recursive: true }).catch(() => {});

// Настройка multer
const uploadSCA = multer({ 
    dest: TEMP_SCA_DIR,
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.zip', '.tar', '.gz', '.tgz', '.7z'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedExtensions.includes(ext) || file.originalname.endsWith('.tar.gz')) {
            cb(null, true);
        } else {
            cb(new Error('Поддерживается только ZIP, TAR, GZ, TGZ, 7Z архивы'));
        }
    }
});

async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}

function errorResponse(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    return res.status(statusCode).json({
        success: false,
        message,
        errors,
        timestamp: new Date().toISOString(),
    });
}

async function extractZip(zipPath, extractDir) {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractDir, true);
}

async function extractTar(tarPath, extractDir) {
    await tar.x({
        file: tarPath,
        cwd: extractDir,
        strict: true
    });
}

async function extractArchive(archivePath, originalName, extractDir) {
    const stats = await fs.stat(archivePath);
    if (stats.size > 500 * 1024 * 1024) {
        throw new Error('Архив слишком большой');
    }
    await ensureDir(extractDir);
    
    const fileName = originalName.toLowerCase();
    
    const isZip = fileName.endsWith('.zip');
    const isTarGz = fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz');
    const isTar = fileName.endsWith('.tar');
    
    if (isZip) {
        await extractZip(archivePath, extractDir);
    } else if (isTarGz || isTar) {
        await extractTar(archivePath, extractDir);
    } else {
        throw new Error(`Формат архива не поддерживается: ${fileName}`);
    }
}

// Функция для динамической загрузки
export function createRouter(options = {}) {
    const { extension = {} } = options;
    
    const router = express.Router();
    
    logger.info(`[${extension.id || 'SCA'}] Инициализация роутера`);

    // Обработка загрузки архива (с лимитером)
    router.post('/upload', uploadLimiter, uploadSCA.single('archive'), async (req, res) => {
        let extractDir = null;
        let reportId = null;
        const startTime = new Date().toISOString();
        const fileName = req.file?.originalname || 'unknown';
        
        try {
            if (!req.file) {
                logger.warn('[SCA] Файл не загружен');
                return res.status(400).json({
                    success: false,
                    error: 'NO_FILE',
                    message: 'Файл не загружен'
                });
            }
            
            logger.info(`[SCA] Загружен архив: ${req.file.originalname}, размер: ${req.file.size} bytes`);
            
            const extractId = uuidv4();
            extractDir = path.join(EXTRACTED_DIR, extractId);
            
            await extractArchive(req.file.path, req.file.originalname, extractDir);
            logger.info(`[SCA] Архив распакован в: ${extractDir}`);
            
            const bom = await analyzeRepository(`file://${extractDir}`, req.file.originalname);
            
            reportId = Date.now().toString();
            
            // Проверяем существование папки history перед записью
            try {
                await fs.access(HISTORY_DIR);
            } catch (err) {
                await fs.mkdir(HISTORY_DIR, { recursive: true });
                logger.info(`[SCA] Папка history создана при сохранении: ${HISTORY_DIR}`);
            }
            
            const historyFilePath = path.join(HISTORY_DIR, `${reportId}.json`);
            await fs.writeFile(historyFilePath, JSON.stringify(bom, null, 2), 'utf8');
            logger.info(`[SCA] Результат сохранен в: ${historyFilePath}`);

            logger.info(`[SCA] Анализ завершен, компонентов: ${bom.components?.length || 0}`);
            
            await saveToHistory(
                'sca', 
                'archive', 
                fileName, 
                startTime, 
                'success',
                reportId,
                null,
                null,
                null
            );
            
            await fs.unlink(req.file.path).catch(() => {});
            
            res.json(bom);
            
        } catch (error) {
            logger.error(`[SCA] Ошибка загрузки: ${error.message}`);
            
            await saveToHistory(
                'sca', 
                'archive', 
                fileName, 
                startTime, 
                'error',
                reportId,
                null,
                null,
                error.message
            );
            
            if (req.file?.path) {
                await fs.unlink(req.file.path).catch(() => {});
            }
            if (extractDir) {
                await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
            }
            
            errorResponse(res, error.message, 500);
        }
    });
    
    router.get('/history/:reportId', gitLimiter, async (req, res) => {
        const { reportId } = req.params;
        
        logger.info(`[SCA] Поиск отчета: ${reportId}`);
        
        // Пробуем разные пути
        const paths = [
            path.join(HISTORY_DIR, `${reportId}.json`),
            path.join(__dirname, 'history', `${reportId}.json`),
            path.join(process.cwd(), 'history', `${reportId}.json`),
            path.join(__dirname, '..', '..', 'history', `${reportId}.json`)
        ];
        
        let report = null;
        
        for (const p of paths) {
            try {
                const data = await fs.readFile(p, 'utf-8');
                report = JSON.parse(data);
                logger.info(`[SCA] Файл найден: ${p}`);
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
                    logger.info(`[SCA] В ${dir} найдены файлы: ${files.join(', ')}`);
                } catch (err) {
                    logger.info(`[SCA] Папка ${dir} не существует`);
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
            logger.error(`[SCA] Ошибка генерации HTML:`, err);
            res.status(500).send('Ошибка генерации отчета');
        }
    });

    router.post('/git', gitLimiter, async (req, res) => {
        let downloaded = null;
        let reportId = null;
        const tempDownloadDir = path.join(TEMP_SCA_DIR, 'downloads', Date.now().toString());
        const startTime = new Date().toISOString();
        const { url, name, token } = req.body;
        
        try {
            logger.info(`[SCA] POST /git вызван, URL: ${url || 'не указан'}`);
            
            if (!url) {
                logger.warn('[SCA] Ошибка: URL не указан');
                return errorResponse(res, 'URL репозитория обязателен', 400);
            }
            
            logger.info(`[SCA] Анализ репозитория: ${url}`);
            
            await ensureDir(tempDownloadDir);
            
            const downloader = new GitHubDownloader({
                downloadDir: tempDownloadDir,
                githubToken: token || process.env.GITHUB_TOKEN,
                logger: {
                    info: (msg) => logger.info(msg),
                    warn: (msg) => logger.warn(msg),
                    error: (msg) => logger.error(msg),
                    debug: (msg) => logger.debug(msg)
                },
                generateSbom: false
            });
            
            await downloader.initialize();
            logger.info('[SCA] GitHubDownloader инициализирован');
            
            downloaded = await downloader.downloadRepository(url, {
                depth: 1,
                generateSbom: false
            });
            
            if (!downloaded || !downloaded.path) {
                throw new Error('Не удалось получить путь к скачанному репозиторию');
            }
            
            logger.info(`[SCA] Репозиторий скачан в: ${downloaded.path}`);
            
            try {
                await fs.access(downloaded.path);
                logger.info(`[SCA] Директория существует: ${downloaded.path}`);
            } catch (err) {
                throw new Error(`Директория не найдена: ${downloaded.path}`);
            }
            
            const files = await fs.readdir(downloaded.path);
            logger.info(`[SCA] Скачано файлов: ${files.length}`);
            
            const packageJsonPath = path.join(downloaded.path, 'package.json');
            try {
                await fs.access(packageJsonPath);
                logger.info('[SCA] package.json найден!');
                const content = await fs.readFile(packageJsonPath, 'utf-8');
                const pkg = JSON.parse(content);
                const depsCount = Object.keys(pkg.dependencies || {}).length;
                logger.info(`[SCA] Зависимостей в package.json: ${depsCount}`);
            } catch (err) {
                logger.warn('[SCA] package.json НЕ найден');
            }
            
            logger.info('[SCA] Запуск analyzeRepository...');
            const bom = await analyzeRepository(`file://${downloaded.path}`, name);
            
            reportId = Date.now().toString();
            
            // Проверяем существование папки history перед записью
            try {
                await fs.access(HISTORY_DIR);
            } catch (err) {
                await fs.mkdir(HISTORY_DIR, { recursive: true });
                logger.info(`[SCA] Папка history создана при сохранении: ${HISTORY_DIR}`);
            }
            
            const historyFilePath = path.join(HISTORY_DIR, `${reportId}.json`);
            await fs.writeFile(historyFilePath, JSON.stringify(bom, null, 2), 'utf8');
            logger.info(`[SCA] Результат сохранен в: ${historyFilePath}`);

            logger.info(`[SCA] Анализ завершен, компонентов: ${bom.components?.length || 0}`);
            logger.info(`[SCA] Уязвимостей: ${bom.vulnerabilities?.length || 0}`);
            
            await saveToHistory(
                'sca',
                'repository',
                url,
                startTime,
                'success',
                reportId,
                null,
                null,
                null
            );
            
            res.json(bom);
            
        } catch (error) {
            logger.error(`[SCA] Ошибка анализа: ${error.message}`);
            logger.error(`[SCA] Stack: ${error.stack || 'нет стека'}`);
            
            await saveToHistory(
                'sca',
                'repository',
                url,
                startTime,
                'error',
                null,
                null,
                error.message
            );
            
            errorResponse(res, error.message, 500);
        } finally {
            if (downloaded?.path) {
                logger.info('[SCA] Очистка временных файлов...');
                if (downloaded.cleanup) {
                    await downloaded.cleanup();
                } else {
                    await fs.rm(downloaded.path, { recursive: true, force: true }).catch(() => {});
                }
            }
            await fs.rm(tempDownloadDir, { recursive: true, force: true }).catch(() => {});
        }
    });
    
    return router;
}

export default createRouter;