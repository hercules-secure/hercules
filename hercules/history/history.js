// hercules/history/history.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HISTORY_FILE = path.join(__dirname, 'history.json');
const HERCULES_LOG_FILE = './logs/hercules/log.txt';

// Функция логирования в файл Геркулеса
async function herculesLog(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] [HISTORY] ${message}\n`;
    
    try {
        await fs.mkdir('./logs/hercules', { recursive: true });
        await fs.appendFile(HERCULES_LOG_FILE, logLine);
    } catch (err) {
        // Тихая ошибка
    }
}

export async function saveToHistory(tool, sourceType, sourceName, startTime, status, reportId, branch = null, error = null) {
    try {
        // Проверяем настройки истории
        let config = {};
        try {
            const configData = await fs.readFile('./hercules/config.json', 'utf-8');
            config = JSON.parse(configData);
        } catch {}
        
        if (!config.history?.enabled) {
            await herculesLog(`History disabled, skipping save for ${tool}`, 'DEBUG');
            return;
        }
        
        const endTime = new Date().toISOString();
        const duration = new Date(endTime) - new Date(startTime);
        
        const record = {
            id: Date.now().toString(),
            tool,
            sourceType,
            sourceName,
            startTime,
            endTime,
            duration,
            reportId,
            status,
            error: error || null
        };
        
        let history = { records: [] };
        try {
            const data = await fs.readFile(HISTORY_FILE, 'utf-8');
            history = JSON.parse(data);
        } catch {}
        
        history.records.unshift(record);
        
        if (history.records.length > 500) {
            history.records = history.records.slice(0, 500);
        }
        
        await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
        
        await herculesLog(`Saved: ${tool} | ${sourceType} | ${sourceName} | ${status} | ${duration}ms`, 'INFO');
        
    } catch (err) {
        await herculesLog(`Error saving to history: ${err.message}`, 'ERROR');
    }
}

export async function getHistory(limit = 25) {
    try {
        let history = { records: [] };
        try {
            const data = await fs.readFile(HISTORY_FILE, 'utf-8');
            history = JSON.parse(data);
        } catch {}
        
        const records = history.records.slice(0, limit);
        
        await herculesLog(`History requested, returned ${records.length} records`, 'DEBUG');
        
        return { success: true, records, total: history.records.length };
        
    } catch (err) {
        await herculesLog(`Error getting history: ${err.message}`, 'ERROR');
        return { success: false, records: [], total: 0 };
    }
}

// ==================== ОЧИСТКА ИСТОРИИ ====================
export async function deleteHistory() {
    try {
        // Проверяем настройки истории
        let config = {};
        try {
            const configData = await fs.readFile('./hercules/config.json', 'utf-8');
            config = JSON.parse(configData);
        } catch {}
        
        if (!config.history?.enabled) {
            await herculesLog(`History disabled, skipping delete`, 'DEBUG');
            return { success: false, error: 'History is disabled' };
        }
        
        const addonsPath = './addons';
        let totalDeleted = 0;
        
        // Получаем список всех папок в addons
        const addons = await fs.readdir(addonsPath);
        
        for (const addon of addons) {
            const historyPath = path.join(addonsPath, addon, 'history');
            
            // Проверяем существует ли папка history
            try {
                await fs.access(historyPath);
            } catch {
                continue; // папки history нет, пропускаем
            }
            
            // Получаем все файлы в папке history
            const files = await fs.readdir(historyPath);
            
            for (const file of files) {
                const filePath = path.join(historyPath, file);
                const stat = await fs.stat(filePath);
                
                if (stat.isFile()) {
                    await fs.unlink(filePath);
                    totalDeleted++;
                }
            }
        }
        
        // Очищаем JSON файл истории
        const emptyHistory = { records: [] };
        await fs.writeFile(HISTORY_FILE, JSON.stringify(emptyHistory, null, 2));
        
        await herculesLog(`History cleared: ${totalDeleted} files deleted`, 'INFO');
        
        return { success: true, message: `History cleared, deleted ${totalDeleted} files` };
        
    } catch (err) {
        await herculesLog(`Error clearing history: ${err.message}`, 'ERROR');
        return { success: false, error: err.message };
    }
}