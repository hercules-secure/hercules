import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as archiver from 'archiver';
import { createWriteStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Путь к папке с логами
const LOG_DIR = './logs/hercules';
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

// ======================
// ЛОГГЕР
// ======================

async function writeLog(level, message, data = null) {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
        
        const timestamp = new Date().toISOString();
        let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        if (data !== null) {
            const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            logEntry += `\n${dataStr}`;
        }
        
        logEntry += '\n';
        await fs.appendFile(LOG_FILE, logEntry, 'utf-8');
    } catch (err) {
        // Тихая ошибка логирования
    }
}

// ======================
// API ДЛЯ НАСТРОЕК
// ======================

const CONFIG_PATH = path.join(__dirname, 'config.json');
let configCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 60 * 1000;

async function loadConfig() {
    if (configCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL) {
        return configCache;
    }
    
    try {
        const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(configData);
        
        configCache = config;
        cacheTimestamp = Date.now();
        
        return config;
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Config file not found at ${CONFIG_PATH}`);
        }
        throw new Error(`Failed to read config: ${error.message}`);
    }
}

async function saveConfig(config) {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

router.get('/', async (req, res) => {
    try {
        const config = await loadConfig();
        
        res.json({ 
            success: true, 
            settings: config  // возвращаем весь конфиг целиком
        });
    } catch (error) {
        await writeLog('error', `Error loading settings: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

router.patch('/', async (req, res) => {
    try {
        const { items } = req.body;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Требуется массив items для обновления'
            });
        }
        
        const config = await loadConfig();
        const updatedItems = [];
        
        for (const update of items) {
            const { item, ...updates } = update;
            
            if (!item) continue;
            
            // Обновляем или создаём объект
            for (const [key, value] of Object.entries(updates)) {
                if (!config[item]) config[item] = {};
                config[item][key] = value;
            }
            
            updatedItems.push(item);
        }
        
        await saveConfig(config);
        
        await writeLog('info', `Updated blocks: ${updatedItems.join(', ')}`);
        
        res.json({
            success: true,
            message: `Обновлены настройки: ${updatedItems.join(', ')}`,
            updated: updatedItems
        });
        
    } catch (error) {
        await writeLog('error', `Error updating config: ${error.message}`);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// ======================
// API ДЛЯ ЛОГОВ
// ======================

router.delete('/logs/clear', async (req, res) => {
    try {
        const logDirs = ['sca', 'sast', 'fuzz'];
        
        for (const dir of logDirs) {
            const dirPath = path.join(LOG_DIR, '..', dir);
            try {
                const files = await fs.readdir(dirPath);
                for (const file of files) {
                    await fs.unlink(path.join(dirPath, file));
                }
                await writeLog('info', `Cleared logs folder: ${dir}`);
            } catch (err) {
                // Папка не существует - пропускаем
            }
        }
        
        res.json({ success: true, message: 'Логи успешно очищены' });
    } catch (error) {
        await writeLog('error', `Error clearing logs: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/logs/download', async (req, res) => {
    try {
        const tempDir = path.join(__dirname, '..', 'temp');
        await fs.mkdir(tempDir, { recursive: true });
        
        const archivePath = path.join(tempDir, `logs_${Date.now()}.zip`);
        const output = createWriteStream(archivePath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        output.on('close', () => {
            res.download(archivePath, `hercules_logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`, (err) => {
                fs.unlink(archivePath).catch(() => {});
                if (err) writeLog('error', `Error sending archive: ${err.message}`);
            });
        });
        
        archive.on('error', async (err) => {
            await writeLog('error', `Archive error: ${err.message}`);
            throw err;
        });
        
        archive.pipe(output);
        
        const logDirs = ['sca', 'sast', 'fuzz'];
        let hasLogs = false;
        
        for (const dir of logDirs) {
            const dirPath = path.join(LOG_DIR, '..', dir);
            try {
                const stats = await fs.stat(dirPath);
                if (stats.isDirectory()) {
                    archive.directory(dirPath, dir);
                    hasLogs = true;
                }
            } catch (err) {
                // Папка не существует
            }
        }
        
        if (!hasLogs) {
            archive.append('Нет логов для скачивания', { name: 'README.txt' });
        }
        
        await archive.finalize();
        
    } catch (error) {
        await writeLog('error', `Error creating log archive: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ======================
// API ДЛЯ ОБНОВЛЕНИЙ
// ======================

router.get('/check', async (req, res) => {
    try {
        const channel = req.query.channel || 'stable';
        const currentVersion = '1.0.0';
        
        const updates = {
            stable: { latest: '1.0.0', available: false },
            beta: { latest: '1.1.0-beta', available: true },
            dev: { latest: '1.2.0-dev', available: true }
        };
        
        const update = updates[channel] || updates.stable;
        
        res.json({
            success: true,
            updateAvailable: update.available,
            currentVersion: currentVersion,
            latestVersion: update.latest,
            releaseDate: '2026-05-25',
            changelog: update.available ? ['Новая функция: ...', 'Исправление багов'] : []
        });
        
    } catch (error) {
        await writeLog('error', `Error checking updates: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ======================
// API ДЛЯ ИСТОРИИ
// ======================

router.get('/history', async (req, res) => {
    try {
        const filter = req.query.filter || 'all';
        res.json({ success: true, history: [] });
    } catch (error) {
        await writeLog('error', `Error loading history: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/history', async (req, res) => {
    try {
        const analysisData = req.body;
        res.json({ success: true, message: 'Результат сохранён' });
    } catch (error) {
        await writeLog('error', `Error saving history: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/history', async (req, res) => {
    try {
        res.json({ success: true, message: 'История очищена' });
    } catch (error) {
        await writeLog('error', `Error clearing history: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});



export default router;