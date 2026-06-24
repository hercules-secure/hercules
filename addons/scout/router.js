import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { saveToHistory } from '../../hercules/history/history.js';
import { analyzeWebsite } from './modules/index.js';
import { fileURLToPath } from 'url';
import { generateScoutReportHTML } from './history.js';

// ==================== ПУТИ ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к папке history для отчетов (рядом с router.js)
const REPORTS_DIR = path.join(__dirname, 'history');
const LOG_DIR = './logs/scout';
const LOG_FILE = './logs/scout/log.txt';
const PUBLIC_KEY_PATH = path.join(process.cwd(), 'hercules', 'public.pem');

// Загрузка публичного ключа для JWT
let PUBLIC_KEY = null;
try {
    if (fs.existsSync(PUBLIC_KEY_PATH)) {
        PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
       // log('Публичный ключ загружен', 'INFO');
    } else {
        log('Публичный ключ не найден, JWT проверка будет недоступна', 'WARN');
    }
} catch (error) {
    log(`Ошибка загрузки публичного ключа: ${error.message}`, 'ERROR');
}

// Убедимся, что директории существуют
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Хранилище результатов анализа (кэш в памяти)
const analysisResults = new Map();

// ==================== ЛОГИРОВАНИЕ ====================
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] [Scout] ${message}\n`;
    
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
        fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
    } catch (err) {}
}

// ==================== ПРОВЕРКА ЛИЦЕНЗИИ ====================
function verifyLicense(req, res, next) {
    // Если нет публичного ключа, пропускаем проверку (режим разработки)
    if (!PUBLIC_KEY) {
        log('JWT проверка отключена (нет публичного ключа)', 'WARN');
        req.license = { isPlus: true, licenseType: 'plus' };
        return next();
    }
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        log('Отсутствует или некорректный Authorization header', 'WARN');
        return res.status(401).json({
            success: false,
            error: 'Требуется авторизация',
            needLicense: true
        });
    }
    
    const token = authHeader.substring(7);
    
    try {
        const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
        
        // Проверка срока действия
        if (decoded.expiresAt && new Date(decoded.expiresAt) < new Date()) {
            log(`Токен истёк для ${decoded.licenceKey}`, 'WARN');
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
            remainingDays: decoded.remainingDays,
            isPlus: true
        };
        
        //log(`Токен проверен для ${decoded.licenceKey}, осталось дней: ${decoded.remainingDays}`, 'INFO');
        next();
        
    } catch (error) {
        log(`Ошибка проверки токена: ${error.message}`, 'ERROR');
        
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

// ==================== ЛИМИТЕРЫ ====================
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Слишком много запросов, попробуйте позже' },
    standardHeaders: true,
    legacyHeaders: false
});

const analyzeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Лимит запусков анализа. Попробуйте через минуту' },
    standardHeaders: true,
    legacyHeaders: false
});

const resultLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Слишком много запросов результатов' },
    standardHeaders: true,
    legacyHeaders: false
});

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function generateId() {
    return crypto.randomBytes(16).toString('hex');
}

function saveReportToFile(reportId, result) {
    try {
        const reportFile = path.join(REPORTS_DIR, `${reportId}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(result, null, 2), 'utf8');
       // log(`Отчет сохранен в файл: ${reportFile}`);
    } catch (err) {
        log(`Ошибка сохранения отчета: ${err.message}`, 'ERROR');
    }
}

// ==================== createRouter ====================

export function createRouter({ logger, extension, settings }) {
    const router = express.Router();
    
   // log(`Инициализация роутера для ${extension.name}`);
    
    // Применяем глобальный лимитер
    router.use(globalLimiter);
    
    // ========== ПУБЛИЧНЫЕ ЭНДПОИНТЫ (БЕЗ ТОКЕНА) ==========
    
    // Получение отчета для просмотра (HTML)
    router.get('/history/:reportId', async (req, res) => {
        const { reportId } = req.params;
        
        try {
            const reportPath = path.join(REPORTS_DIR, `${reportId}.json`);
            
            if (!fs.existsSync(reportPath)) {
                return res.status(404).send('Отчет не найден');
            }
            
            const reportData = fs.readFileSync(reportPath, 'utf-8');
            const report = JSON.parse(reportData);
            const html = generateScoutReportHTML(report);
            
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
            
        } catch (error) {
            log(`Ошибка получения отчета: ${error.message}`, 'ERROR');
            res.status(500).send('Ошибка генерации отчета');
        }
    });
    
    // Получение JSON отчета из истории (публичный для просмотра)
    router.get('/history/:reportId/json', async (req, res) => {
        const { reportId } = req.params;
        
        try {
            const reportPath = path.join(REPORTS_DIR, `${reportId}.json`);
            
            if (!fs.existsSync(reportPath)) {
                return res.status(404).json({ error: 'Отчет не найден' });
            }
            
            const reportData = fs.readFileSync(reportPath, 'utf-8');
            const report = JSON.parse(reportData);
            
            res.json(report);
        } catch (error) {
            log(`Ошибка получения отчета: ${error.message}`, 'ERROR');
            res.status(500).json({ error: error.message });
        }
    });
    
    // ========== ЗАЩИЩЕННЫЕ ЭНДПОИНТЫ (ТРЕБУЮТ ТОКЕН) ==========
    
    // Запуск анализа (требует лицензию)
    router.post('/analyze', verifyLicense, analyzeLimiter, async (req, res) => {
        const { url } = req.body;
        const startTime = new Date().toISOString();
        
        if (!url) {
            return res.status(400).json({ error: 'URL обязателен' });
        }
        
        // Валидация URL
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: 'Некорректный URL' });
        }
        
        const taskId = generateId();
        
        //log(`[${taskId}] Запуск анализа: ${url}`);
        
        // Отправляем ответ сразу
        res.json({
            success: true,
            taskId,
            message: 'Анализ запущен',
            status: 'processing',
            license: {
                type: 'Геркулес Плюс',
                remainingDays: req.license.remainingDays
            }
        });
        
        // Запускаем анализ в фоне
        (async () => {
            try {
                const result = await analyzeWebsite(url, {}, (step, current, total, message) => {
                 //   log(`[${taskId}] ${message}`);
                });
                
                result.taskId = taskId;
                result.timestamp = new Date().toISOString();
                result.licenseUsed = {
                    licenceKey: req.license.licenceKey,
                    remainingDays: req.license.remainingDays
                };
                
                // Сохраняем результат
                analysisResults.set(taskId, result);
                saveReportToFile(taskId, result);
                
                // Сохраняем в историю
                await saveToHistory(
                    'scout', 'url', url, startTime, 'success', taskId,
                    { summary: result.summary, totalIssues: result.allIssues.length },
                    null
                );
                
                //log(`[${taskId}] Анализ завершен. Critical: ${result.summary.critical}, High: ${result.summary.high}`);
            } catch (error) {
                log(`[${taskId}] Ошибка анализа: ${error.message}`, 'ERROR');
                
                const errorResult = {
                    success: false,
                    taskId,
                    target: url,
                    timestamp: new Date().toISOString(),
                    error: error.message
                };
                
                analysisResults.set(taskId, errorResult);
                saveReportToFile(taskId, errorResult);
                
                await saveToHistory('scout', 'url', url, startTime, 'error', taskId, null, error.message);
            }
        })();
    });
    
    // Получение результата (требует лицензию)
    router.get('/result/:id', verifyLicense, resultLimiter, (req, res) => {
        const { id } = req.params;
        const result = analysisResults.get(id);
        
        if (!result) {
            return res.status(200).json({ error: 'Результат не найден' });
        }
        
        res.json(result);
    });
    
    // Получение статуса (требует лицензию)
    router.get('/status/:id', verifyLicense, resultLimiter, (req, res) => {
        const { id } = req.params;
        const result = analysisResults.get(id);
        
        if (!result) {
            return res.status(200).json({ error: 'Задача не найдена' });
        }
        
        res.json({
            taskId: id,
            completed: result.success !== undefined,
            success: result.success || false,
            error: result.error || null
        });
    });
    
    return router;
}

export default { createRouter };