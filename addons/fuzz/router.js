// addons/fuzz/router.js
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import APIFuzzer from './fuzz.js';
import { saveToHistory } from '../../hercules/history/history.js';

const TEMP_FUZZ_DIR = path.join(process.cwd(), 'temp', 'fuzz');

// Настройка multer для загрузки спецификаций
const uploadSpec = multer({
    dest: TEMP_FUZZ_DIR,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
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

async function downloadSpecFromUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const allowedDomains = ['raw.githubusercontent.com', 'api.github.com', 'gitlab.com'];
        if (!allowedDomains.includes(parsedUrl.hostname)) {
            throw new Error(`Домен ${parsedUrl.hostname} не разрешен`);
        }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const content = await response.text();
        const filename = url.split('/').pop() || 'spec.yaml';
        const tempPath = path.join(TEMP_FUZZ_DIR, `${Date.now()}-${filename}`);
        await fs.writeFile(tempPath, content, 'utf8');
        return { path: tempPath, filename, content };
    } catch (error) {
        throw new Error(`Ошибка загрузки спецификации: ${error.message}`);
    }
}

// Функция для динамической загрузки - должна называться createRouter
export function createRouter(options = {}) {
    const { logger = console, extension = {} } = options;

    // Создаём НОВЫЙ роутер для каждого экземпляра
    const router = express.Router();

    logger.info(`[${extension.id || 'FUZZ'}] Инициализация роутера`);

    // POST / - запуск фаззинга (с файлом или URL)
    router.post('/', uploadSpec.single('spec'), async (req, res) => {
        let specFilePath = null;
        let tempFiles = [];
        const startTime = new Date().toISOString();
        const { specUrl, baseUrl, timeout = 5000, concurrency = 5 } = req.body;
        const sourceName = req.file ? req.file.originalname : (specUrl || 'unknown');
        const sourceType = req.file ? 'archive' : 'url';

        try {
            if (!req.file && !specUrl) {
                return errorResponse(res, 'Необходимо предоставить файл спецификации или URL', 400);
            }

            if (!baseUrl) {
                return errorResponse(res, 'Необходимо указать базовый URL API', 400);
            }

            await ensureDir(TEMP_FUZZ_DIR);

            if (req.file) {
                specFilePath = req.file.path;
                tempFiles.push(specFilePath);
                logger.info(`[FUZZ] Получен файл спецификации: ${req.file.originalname}`);
            } else {
                logger.info(`[FUZZ] Загрузка спецификации по URL: ${specUrl}`);
                const downloaded = await downloadSpecFromUrl(specUrl);
                specFilePath = downloaded.path;
                tempFiles.push(specFilePath);
            }

            const fuzzer = new APIFuzzer(specFilePath, {
                baseUrl: baseUrl,
                timeout: parseInt(timeout),
                concurrency: parseInt(concurrency),
                format: 'auto'
            });

            logger.info(`[FUZZ] Запуск тестирования для ${baseUrl}`);
            const report = await fuzzer.run();

            // Сохраняем в историю
            await saveToHistory(
                'fuzz',
                sourceType,
                sourceName,
                startTime,
                'success',
                null,
                null,
                null
            );

            res.json({
                success: true,
                message: 'Фаззинг тестирование завершено',
                summary: report.summary,
                vulnerabilities: report.vulnerabilities,
                byEndpoint: report.byEndpoint,
                spec: report.spec,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('[FUZZ] Ошибка:', error);

            // Сохраняем ошибку в историю
            await saveToHistory(
                'fuzz',
                sourceType,
                sourceName,
                startTime,
                'error',
                null,
                null,
                error.message
            );

            errorResponse(res, `Ошибка при выполнении фаззинга: ${error.message}`, 500);
        } finally {
            for (const filePath of tempFiles) {
                try {
                    await fs.unlink(filePath).catch(() => { });
                } catch (e) { }
            }
        }
    });

    // // Health check
    // router.get('/health', (req, res) => {
    //     res.json({
    //         status: 'ok',
    //         extension: extension.id,
    //         version: extension.version
    //     });
    // });

    return router;
}

export default createRouter;