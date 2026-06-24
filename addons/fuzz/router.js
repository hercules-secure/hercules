// addons/fuzz/router.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import jsyaml from 'js-yaml';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import APIFuzzer from './fuzz.js';
import { saveToHistory } from '../../hercules/history/history.js';
import { generateHtmlReport } from './history.js';
import BrowserFuzzer from './bloom.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_FUZZ_DIR = path.join(process.cwd(), 'temp', 'fuzz');
const HISTORY_DIR = path.join(__dirname, 'history');

// ============================================================
// ЛИМИТЕРЫ
// ============================================================
const fuzzLimiter = rateLimit({
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

const statusLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: {
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Слишком много запросов статуса. Попробуйте позже.'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
});

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

// ============================================================
// ЛИЦЕНЗИЯ - ЗАГРУЗКА ПУБЛИЧНОГО КЛЮЧА
// ============================================================
let PUBLIC_KEY = null;
try {
    const publicKeyPath = path.join(process.cwd(), 'hercules', 'public.pem');
    PUBLIC_KEY = fs.readFileSync(publicKeyPath, 'utf8');
} catch (error) {
    logger.error(`[FUZZ] Public key not found: ${error.message}`)
    
}

// ============================================================
// MIDDLEWARE ПРОВЕРКИ JWT
// ============================================================
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('[FUZZ] Missing or invalid Authorization header');
        return res.status(401).json({
            success: false,
            error: 'Требуется авторизация',
            needLicense: true
        });
    }
    
    const token = authHeader.substring(7);
    
    if (!PUBLIC_KEY) {
        console.error('[FUZZ] Public key not available');
        return res.status(500).json({
            success: false,
            error: 'Ошибка конфигурации сервера'
        });
    }
    
    try {
        const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
        
        if (decoded.expiresAt && new Date(decoded.expiresAt) < new Date()) {
            console.error(`[FUZZ] Token expired for ${decoded.licenceKey}`);
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
        
        logger.info(`[FUZZ] Token verified for ${decoded.licenceKey}, remaining days: ${decoded.remainingDays}`);
        next();
    } catch (error) {
        console.error(`[FUZZ] Token verification error: ${error.message}`);
        
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

// ============================================================
// ПРОСТОЙ ЛОГГЕР
// ============================================================
const LOG_DIR = path.join(process.cwd(), 'logs', 'fuzz');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

await fsPromises.mkdir(LOG_DIR, { recursive: true });

function writeLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data !== null) {
        if (typeof data === 'object') {
            try {
                logEntry += `\n${JSON.stringify(data, null, 2)}`;
            } catch (e) {
                logEntry += `\n${String(data)}`;
            }
        } else {
            logEntry += `\n${String(data)}`;
        }
    }
    
    logEntry += '\n' + '='.repeat(80) + '\n';
    
    try {
        fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
    } catch (err) {}
}

const logger = {
    info: (msg, data) => writeLog('info', msg, data),
    error: (msg, data) => writeLog('error', msg, data),
    warn: (msg, data) => writeLog('warn', msg, data),
    debug: (msg, data) => writeLog('debug', msg, data)
};

logger.info('=== СЕРВЕР ЗАПУЩЕН ===');

// ============================================================
// ХРАНИЛИЩЕ ЗАДАНИЙ
// ============================================================
const tasks = {};

await fsPromises.mkdir(TEMP_FUZZ_DIR, { recursive: true });
await fsPromises.mkdir(HISTORY_DIR, { recursive: true });

const uploadSpec = multer({
    dest: TEMP_FUZZ_DIR,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: function(req, file, cb) {
        const allowedExtensions = ['.json', '.yaml', '.yml'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Поддерживаются только JSON, YAML, YML файлы'));
        }
    }
});

async function ensureDir(dirPath) {
    try {
        await fsPromises.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}

function errorResponse(res, message, statusCode = 500) {
    return res.status(statusCode).json({
        success: false,
        message,
        timestamp: new Date().toISOString()
    });
}

// ============================================================
// ФУНКЦИЯ ЗАГРУЗКИ СПЕЦИФИКАЦИИ ПО HTTP
// ============================================================
async function fetchSpecFromUrl(url) {
    try {
        logger.info(`Загрузка: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Hercules/Cyclone - 1.0',
                'Accept': 'application/json, application/yaml, text/yaml, */*'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const status = response.status;
            let errorMessage = '';
            
            switch (status) {
                case 400: errorMessage = 'Ошибка 400: Некорректный запрос. Проверьте URL.'; break;
                case 401: errorMessage = 'Ошибка 401: Требуется авторизация.'; break;
                case 403: errorMessage = 'Ошибка 403: Доступ запрещен.'; break;
                case 404: errorMessage = 'Ошибка 404: Файл не найден. Проверьте URL.'; break;
                case 408: errorMessage = 'Ошибка 408: Превышено время ожидания.'; break;
                case 429: errorMessage = 'Ошибка 429: Слишком много запросов.'; break;
                case 500: errorMessage = 'Ошибка 500: Внутренняя ошибка сервера.'; break;
                case 502: errorMessage = 'Ошибка 502: Сервер временно недоступен.'; break;
                case 503: errorMessage = 'Ошибка 503: Сервис временно недоступен.'; break;
                case 504: errorMessage = 'Ошибка 504: Превышено время ожидания.'; break;
                default: errorMessage = `Ошибка HTTP ${status}: ${response.statusText}`;
            }
            
            throw new Error(errorMessage);
        }
        
        const content = await response.text();
        
        if (!content || content.trim().length === 0) {
            throw new Error('Файл пустой.');
        }
        
        let spec;
        try {
            spec = JSON.parse(content);
        } catch (e) {
            try {
                spec = jsyaml.load(content);
            } catch (e2) {
                throw new Error('Файл не является валидным JSON или YAML.');
            }
        }
        
        const isSwagger = spec.swagger === '2.0' || (spec.openapi && spec.openapi.startsWith('3.'));
        if (!isSwagger) {
            throw new Error('Файл не является Swagger/OpenAPI спецификацией.');
        }
        
        logger.info('Спецификация загружена');
        return spec;
        
    } catch (error) {
        let errorMessage = error.message;
        
        if (error.name === 'AbortError') {
            errorMessage = 'Превышено время ожидания (30 секунд).';
        } else if (error.message.includes('fetch failed')) {
            errorMessage = 'Не удалось подключиться к серверу.';
        } else if (error.message.includes('ENOTFOUND')) {
            errorMessage = 'Хост не найден. Проверьте URL.';
        } else if (error.message.includes('ECONNREFUSED')) {
            errorMessage = 'Сервер отказал в соединении.';
        } else if (error.message.includes('ETIMEDOUT')) {
            errorMessage = 'Превышено время ожидания ответа.';
        }
        
        throw new Error(errorMessage);
    }
}

// ============================================================
// ФУНКЦИЯ ИЗВЛЕЧЕНИЯ BASE URL ИЗ СПЕЦИФИКАЦИИ
// ============================================================
function extractBaseUrlFromSpec(spec) {
    let baseUrl = '';
    
    if (spec.openapi && spec.servers && spec.servers.length > 0) {
        baseUrl = spec.servers[0].url;
    } else if (spec.swagger && spec.host) {
        const scheme = spec.schemes?.[0] || 'https';
        baseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
    }
    
    return baseUrl.replace(/\/$/, '');
}

// ============================================================
// ФУНКЦИЯ СОХРАНЕНИЯ ОТЧЕТА В HISTORY
// ============================================================
async function saveReportToHistory(taskId, report) {
    const reportFile = path.join(HISTORY_DIR, `${taskId}.json`);
    await fsPromises.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf-8');
    logger.info(`Отчет сохранен: ${reportFile}`);
    return reportFile;
}

// ============================================================
// ФУНКЦИЯ СОЗДАНИЯ РОУТЕРА
// ============================================================
export function createRouter(options = {}) {
    const { extension = {}, logger: extLogger } = options;
    const router = express.Router();

    if (extLogger) {
        extLogger.info(`[${extension.id || 'FUZZ'}] Инициализация роутера`);
    }
    logger.info(`[${extension.id || 'FUZZ'}] Инициализация роутера`);

    // Применяем глобальный лимитер ко всем запросам
    router.use(globalLimiter);

    // ============================================================
    // GET /status/:taskId - ПОЛУЧЕНИЕ СТАТУСА (публичный)
    // ============================================================
    router.get('/status/:taskId', statusLimiter, async (req, res) => {
        const { taskId } = req.params;
        
        logger.info(`Запрос статуса для taskId: ${taskId}`);
        
        const task = tasks[taskId];
        if (!task) {
            return errorResponse(res, 'Задание не найдено', 404);
        }
        
        res.json({
            success: true,
            taskId: taskId,
            status: task.status,
            message: task.message || '',
            report: task.report || null,
            timestamp: new Date().toISOString()
        });
    });

    // ============================================================
    // GET /history/:taskId - ПОЛУЧЕНИЕ ОТЧЕТА В HTML (публичный)
    // ============================================================
    router.get('/history/:taskId', async (req, res) => {
        const { taskId } = req.params;
        
        logger.info(`Запрос отчета для taskId: ${taskId}`);
        
        const reportFile = path.join(HISTORY_DIR, `${taskId}.json`);
        let report = null;
        
        try {
            const content = await fsPromises.readFile(reportFile, 'utf-8');
            report = JSON.parse(content);
            logger.info(`Отчет загружен из файла: ${reportFile}`);
        } catch (e) {
            const task = tasks[taskId];
            if (task && task.report) {
                report = task.report;
                logger.info('Отчет взят из памяти');
                await saveReportToHistory(taskId, report);
            }
        }
        
        if (!report) {
            logger.error(`Отчет не найден для taskId: ${taskId}`);
            return errorResponse(res, 'Отчет не найден', 404);
        }
        
        try {
            const html = await generateHtmlReport(report);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } catch (error) {
            logger.error(`Ошибка генерации отчета: ${error.message}`);
            errorResponse(res, `Ошибка генерации отчета: ${error.message}`, 500);
        }
    });
    
    // ============================================================
    // POST / - ЗАПУСК ФАЗЗИНГА (защищенный)
    // ============================================================
    router.post('/', verifyToken, fuzzLimiter, uploadSpec.single('spec'), async (req, res) => {
        let specFilePath = null;
        const startTime = new Date().toISOString();
        const { specUrl, baseUrl, timeout = 5000, concurrency = 50, authToken, mode, url } = req.body;
        const sourceName = req.file ? req.file.originalname : (specUrl || 'unknown');
        const sourceType = req.file ? 'file' : 'url';
        
        const taskId = `fuzz_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        logger.info('=== НАЧАЛО ===');
        logger.info(`taskId: ${taskId}`);
        logger.info(`mode: ${mode}`);
        logger.info(`url: ${url}`);
        logger.info(`specUrl: ${specUrl}`);
        logger.info(`baseUrl: ${baseUrl}`);
        logger.info(`req.file: ${req.file ? req.file.originalname : 'нет'}`);
        logger.info(`license: ${req.license?.licenceKey || 'неизвестно'}`);

        // ============================================================
        // РЕЖИМ 1 - БАБА ЯГА (BrowserFuzzer)
        // ============================================================
        if (mode === 1) {
            logger.info('=== РЕЖИМ БАБА ЯГА ===');
            
            const targetUrl = url || req.body.targetUrl;
            
            if (!targetUrl) {
                logger.error('Нет targetUrl для режима Баба Яга');
                return errorResponse(res, 'Не указан URL для перехвата', 400);
            }
            
            try {
                tasks[taskId] = {
                    status: 'running',
                    message: 'Баба Яга запущена, перехват выполняется...',
                    report: null,
                    startTime: startTime,
                    sourceType: 'baba_yaga',
                    sourceName: targetUrl,
                    reportFile: null,
                    license: req.license
                };

                logger.info(`Запуск BrowserFuzzer для ${targetUrl}`);
                
                // Отправляем ответ клиенту с информацией о лицензии
                res.json({
                    success: true,
                    status: 'started',
                    message: 'Баба Яга запущена',
                    taskId: taskId,
                    timestamp: new Date().toISOString(),
                    license: {
                        licenceKey: req.license.licenceKey,
                        remainingDays: req.license.remainingDays
                    }
                });

                setImmediate(async () => {
                    try {
                        const browserFuzzer = new BrowserFuzzer({
                            targetUrl: targetUrl,
                            headless: true,
                            timeout: parseInt(timeout) || 30000
                        });

                        logger.info('Запуск BrowserFuzzer...');
                        const report = await browserFuzzer.run();
                        logger.info('BrowserFuzzer завершен');
                        
                        // Добавляем информацию о лицензии в отчет
                        report.license = {
                            licenceKey: req.license.licenceKey,
                            productId: req.license.productId,
                            remainingDays: req.license.remainingDays
                        };
                        
                        const reportFile = await saveReportToHistory(taskId, report);
                        
                        tasks[taskId].status = 'completed';
                        tasks[taskId].message = 'Метла успешно завершена';
                        tasks[taskId].report = report;
                        tasks[taskId].reportFile = reportFile;

                        await saveToHistory(
                            'fuzz',
                            'baba_yaga',
                            targetUrl,
                            startTime,
                            'success',
                            taskId,
                            null,
                            null
                        );
                        
                        logger.info(`Результат Метлы сохранен: ${reportFile}`);
                        
                    } catch (error) {
                        logger.error(`Ошибка BrowserFuzzer: ${error.message}`);
                        logger.error(error.stack);
                        
                        tasks[taskId].status = 'error';
                        tasks[taskId].message = error.message || 'Ошибка выполнения Метлы';
                        
                        await saveToHistory(
                            'fuzz',
                            'baba_yaga',
                            targetUrl,
                            startTime,
                            'error',
                            taskId,
                            null,
                            error.message
                        );
                    }
                });

            } catch (error) {
                logger.error(`Ошибка запуска Бабы Яги: ${error.message}`);
                return errorResponse(res, `Ошибка: ${error.message}`, 500);
            }
            
            return;
        }

        // ============================================================
        // РЕЖИМ 0 - ДОМОВОЙ (APIFuzzer)
        // ============================================================
        logger.info('=== РЕЖИМ ДОМОВОЙ ===');

        try {
            if (!req.file && !specUrl) {
                return errorResponse(res, 'Необходимо предоставить файл или URL спецификации', 400);
            }

            let spec;
            
            if (req.file) {
                specFilePath = req.file.path;
                logger.info(`Файл от клиента: ${req.file.originalname}`);
                
                const content = await fsPromises.readFile(specFilePath, 'utf-8');
                try {
                    spec = JSON.parse(content);
                } catch (e) {
                    spec = jsyaml.load(content);
                }
                
                logger.info('Спецификация распарсена из файла');
                
                try {
                    await fsPromises.unlink(specFilePath).catch(() => {});
                } catch (e) {}
                
            } else {
                logger.info(`Загрузка по ссылке: ${specUrl}`);
                
                try {
                    spec = await fetchSpecFromUrl(specUrl);
                    logger.info('Спецификация загружена');
                } catch (downloadError) {
                    logger.error(`Ошибка загрузки: ${downloadError.message}`);

                    await saveToHistory(
                        'fuzz',
                        sourceType,
                        sourceName,
                        startTime,
                        'error',
                        taskId,
                        null,
                        downloadError.message
                    );
                    
                    return errorResponse(res, downloadError.message, 400);
                }
            }

            let finalBaseUrl = baseUrl;
            
            if (!finalBaseUrl) {
                finalBaseUrl = extractBaseUrlFromSpec(spec);
                logger.info(`baseUrl из спецификации: ${finalBaseUrl}`);
            }
            
            if (!finalBaseUrl) {
                const errMsg = 'Не удалось определить базовый URL. Укажите его вручную.';
                
                await saveToHistory(
                    'fuzz',
                    sourceType,
                    sourceName,
                    startTime,
                    'error',
                    taskId,
                    null,
                    errMsg
                );
                
                return errorResponse(res, errMsg, 400);
            }

            await ensureDir(TEMP_FUZZ_DIR);
            const tempFilePath = path.join(TEMP_FUZZ_DIR, `${Date.now()}-spec.json`);
            await fsPromises.writeFile(tempFilePath, JSON.stringify(spec, null, 2), 'utf8');
            

            tasks[taskId] = {
                status: 'running',
                message: 'Фаззинг выполняется...',
                report: null,
                startTime: startTime,
                sourceType: sourceType,
                sourceName: sourceName,
                reportFile: null,
                license: req.license
            };

            logger.info('Отправка клиенту статуса "запущен"');
            res.json({
                success: true,
                status: 'started',
                message: 'Фаззинг запущен',
                taskId: taskId,
                timestamp: new Date().toISOString(),
                license: {
                    licenceKey: req.license.licenceKey,
                    remainingDays: req.license.remainingDays
                }
            });


            logger.info(`Запуск фаззинга для ${finalBaseUrl}`);
            
            setImmediate(async () => {
                try {
                    const fuzzer = new APIFuzzer(tempFilePath, {
                        baseUrl: finalBaseUrl,
                        timeout: parseInt(timeout),
                        concurrency: parseInt(concurrency),
                        format: 'auto',
                        authToken: authToken
                    });

                    logger.info('Ожидание завершения фаззинга...');
                    const report = await fuzzer.run();
                    logger.info('Фаззинг завершен');
                    
                    // Добавляем информацию о лицензии в отчет
                    report.license = {
                        licenceKey: req.license.licenceKey,
                        productId: req.license.productId,
                        remainingDays: req.license.remainingDays
                    };
                    
                    try {
                        await fsPromises.unlink(tempFilePath).catch(() => {});
                    } catch (e) {}


                    const reportFile = await saveReportToHistory(taskId, report);
                    
                    tasks[taskId].status = 'completed';
                    tasks[taskId].message = 'Фаззинг успешно завершен';
                    tasks[taskId].report = report;
                    tasks[taskId].reportFile = reportFile;

                    await saveToHistory(
                        'fuzz',
                        sourceType,
                        sourceName,
                        startTime,
                        'success',
                        taskId,
                        null,
                        null
                    );
                    
                    logger.info(`Результат сохранен: ${reportFile}`);
                    
                } catch (error) {
                    logger.error(`Ошибка выполнения фаззинга: ${error.message}`);
                    
                    tasks[taskId].status = 'error';
                    tasks[taskId].message = error.message || 'Ошибка выполнения фаззинга';
                    
                    await saveToHistory(
                        'fuzz',
                        sourceType,
                        sourceName,
                        startTime,
                        'error',
                        taskId,
                        null,
                        error.message
                    );
                    
                    try {
                        await fsPromises.unlink(tempFilePath).catch(() => {});
                    } catch (e) {}
                }
            });

        } catch (error) {
            logger.error(`Ошибка: ${error.message}`);
            const errorMessage = error.message || 'Неизвестная ошибка';

            await saveToHistory(
                'fuzz',
                sourceType,
                sourceName,
                startTime,
                'error',
                taskId,
                null,
                errorMessage
            );

            if (!res.headersSent) {
                errorResponse(res, `Ошибка: ${errorMessage}`, 500);
            }
        } finally {
            logger.info('=== ЗАВЕРШЕНО ===');
        }
    });

    return router;
}

export default createRouter;