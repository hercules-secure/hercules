// routes/sast.js
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ArchiveReceiver } from '../modules/sast/archive/index.js';
import { ArchiveExtractor } from '../modules/sast/archive/extractor.js';
import { analyzeCode } from '../modules/sast/sast.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const TEMP_DIR = path.join(process.cwd(), 'temp');
const EXTRACTED_DIR = path.join(TEMP_DIR, 'sast/extracted');
const STORAGE_DIR = path.join(TEMP_DIR, 'sast/storage');

// Инициализация классов
const receiver = new ArchiveReceiver({ storageDir: STORAGE_DIR });
const extractor = new ArchiveExtractor({ extractDir: EXTRACTED_DIR, deleteAfter: false });

// Настройка multer для загрузки архивов
const uploadArchive = multer({ 
    dest: TEMP_DIR,
    limits: { fileSize: 100 * 1024 * 1024 },
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

export function createSASTRouter(options = {}) {
    const { logger = console } = options;

    // ======================
    // POST /upload - загрузка архива
    // ======================
    router.post('/upload', uploadArchive.single('archive'), async (req, res) => {
        if (!req.file) {
            logger.error('[SAST] Файл не загружен');
            return res.status(400).json({ 
                success: false,
                error: 'NO_FILE',
                message: 'Файл не загружен'
            });
        }

        try {
            logger.info(`[SAST] Загружен архив: ${req.file.originalname}`);
            const result = await receiver.getFromFile(req.file.path, req.file.originalname);
            
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

    // ======================
    // POST /url - анализ репозитория по URL
    // ======================
    router.post('/url', async (req, res) => {
        const { url, branch } = req.body;
        
        if (!url) {
            return res.status(400).json({ 
                success: false,
                error: 'URL_REQUIRED',
                message: 'Необходимо передать ссылку на репозиторий'
            });
        }

        try {
            logger.info(`[SAST] Анализ URL: ${url}`);
            const result = await receiver.getFromUrl(url, { branch });
            
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
            res.status(500).json({ 
                success: false,
                error: 'URL_ERROR',
                message: error.message
            });
        }
    });

    // ======================
    // POST /analyze/:archiveId - запуск анализа
    // ======================
    router.post('/analyze/:archiveId', async (req, res) => {
        const { archiveId } = req.params;

        if (!archiveId || archiveId.length < 10 || archiveId.length > 100) {
            logger.warn(`[SAST] Invalid archive ID format: ${archiveId}`);
            return res.status(400).json({ 
                success: false,
                error: 'INVALID_ID',
                message: 'Invalid archive ID format' 
            });
        }

        const rulesPath = req.body.rulesPath || './modules/sast/rules/all-rules.json';
        
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
            // Асинхронная очистка (не блокируем ответ)
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

    // ======================
    // GET /results/:archiveId - получение результатов
    // ======================
    router.get('/results/:archiveId', async (req, res) => {
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


    return router;
}