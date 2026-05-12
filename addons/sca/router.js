// routes/sca.js
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { analyzeRepository } from './sca.js';
import AdmZip from 'adm-zip';
import * as tar from 'tar';

const router = express.Router();

const TEMP_SCA_DIR = path.join(process.cwd(), 'temp', 'sca');
const EXTRACTED_DIR = path.join(TEMP_SCA_DIR, 'extracted');

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
            cb(new Error('Поддерживается только ZIP, TAR, GZ, TGZ, 7Z arhivy'));
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
    } else if (isTarGz) {
        await extractTar(archivePath, extractDir);
    } else if (isTar) {
        await extractTar(archivePath, extractDir);
    } else {
        throw new Error(`Формат архива не поддерживается: ${fileName}`);
    }
}

export function createSCARouter(options = {}) {
    const { logger = console } = options;

    router.post('/upload', uploadSCA.single('archive'), async (req, res) => {
        let extractDir = null;
        
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'NO_FILE',
                    message: 'Fayl ne zagruzhen'
                });
            }
            
            logger.info(`[SCA] Загружен архив: ${req.file.originalname}`);
            
            const extractId = uuidv4();
            extractDir = path.join(EXTRACTED_DIR, extractId);
            
            await extractArchive(req.file.path, req.file.originalname, extractDir);
            
            const bom = await analyzeRepository(`file://${extractDir}`, req.file.originalname);
            
            await fs.unlink(req.file.path).catch(() => {});
            
            res.json(bom);
            
        } catch (error) {
            logger.error('[SCA] Ошибка загрузки:', error);
            
            if (req.file?.path) {
                await fs.unlink(req.file.path).catch(() => {});
            }
            if (extractDir) {
                await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
            }
            
            errorResponse(res, error.message, 500);
        }
    });

    
    router.post('/', async (req, res) => {
        try {
            const { url, name } = req.body;
            
            if (!url) {
                return errorResponse(res, 'URL репозитория обязателен', 400);
            }
            
            logger.info(`[SCA] Анализ репозитория: ${url}`);
            const bom = await analyzeRepository(url, name);
            res.json(bom);
            
        } catch (error) {
            logger.error('[SCA] Ошибка анализа:', error);
            errorResponse(res, error.message, 500);
        }
    });

    return router;
}