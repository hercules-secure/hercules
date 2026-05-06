// routes/extensions.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// ======================
// ЛОГГЕР В ФАЙЛ
// ======================
const LOG_DIR = path.join(process.cwd(), 'logs', 'addons');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

async function ensureLogDir() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (err) {}
}

async function log(message, level = 'INFO') {
    try {
        await ensureLogDir();
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message}\n`;
        await fs.appendFile(LOG_FILE, logLine);
    } catch (err) {}
}

// ======================
// РАБОТА С ФАЙЛАМИ
// ======================
const addonsDir = path.join(process.cwd(), 'addons');
const catalogFilePath = path.join(addonsDir, 'catalog.json');
const installedFilePath = path.join(addonsDir, 'installed.json');

async function ensureAddonsDir() {
    try {
        await fs.mkdir(addonsDir, { recursive: true });
    } catch (err) {}
}

// Загрузка каталога доступных расширений
async function loadCatalog() {
    try {
        await ensureAddonsDir();
        const data = await fs.readFile(catalogFilePath, 'utf-8');
        const catalog = JSON.parse(data);
        return catalog.addons || [];
    } catch (err) {
        if (err.code === 'ENOENT') {
            await log(`Catalog file not found: ${catalogFilePath}`, 'WARN');
            return [];
        }
        await log(`Error loading catalog: ${err.message}`, 'ERROR');
        return [];
    }
}

// Загрузка установленных расширений
async function loadInstalledExtensions() {
    try {
        await ensureAddonsDir();
        const data = await fs.readFile(installedFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await fs.writeFile(installedFilePath, '[]');
            return [];
        }
        await log(`Error loading installed extensions: ${err.message}`, 'ERROR');
        return [];
    }
}

// Сохранение установленных расширений
async function saveInstalledExtensions(installed) {
    await ensureAddonsDir();
    await fs.writeFile(installedFilePath, JSON.stringify(installed, null, 2));
}

// Проверка обновлений
function checkForUpdate(available, installed) {
    if (!installed) return false;
    return available.version !== installed.version;
}

// ======================
// API МАРШРУТЫ
// ======================

// GET /api/extensions - список всех расширений с статусом установки
router.get('/api/extensions', async (req, res) => {
    try {
        await log('[Extensions] GET /api/extensions');
        
        const catalogData = await loadCatalogData(); // Загружаем полный catalog.json
        const catalog = catalogData.addons || [];
        const categories = catalogData.categories || [];
        
        const installed = await loadInstalledExtensions();
        const installedMap = new Map(installed.map(ext => [ext.id, ext]));
        
        const extensionsWithStatus = catalog.map(ext => ({
            ...ext,
            installed: installedMap.has(ext.id),
            hasUpdate: checkForUpdate(ext, installedMap.get(ext.id)),
            newVersion: installedMap.get(ext.id)?.version !== ext.version ? ext.version : null
        }));
        
        res.json({ 
            success: true, 
            extensions: extensionsWithStatus,
            categories: categories
        });
    } catch (error) {
        await log(`[Extensions] Error: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

// Новая функция для загрузки полного каталога
async function loadCatalogData() {
    try {
        await ensureAddonsDir();
        const data = await fs.readFile(catalogFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return { addons: [], categories: [] };
        }
        return { addons: [], categories: [] };
    }
}

// GET /api/extensions/installed - список установленных
router.get('/api/extensions/installed', async (req, res) => {
    try {
        const installed = await loadInstalledExtensions();
        res.json({ success: true, extensions: installed });
    } catch (error) {
        await log(`[Extensions] Error in GET /api/extensions/installed: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/extensions/catalog - получение чистого каталога (без статусов)
router.get('/api/extensions/catalog', async (req, res) => {
    try {
        const catalog = await loadCatalog();
        res.json({ success: true, catalog });
    } catch (error) {
        await log(`[Extensions] Error in GET /api/extensions/catalog: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/extensions/install - установка расширения
router.post('/api/extensions/install', async (req, res) => {
    try {
        const { extensionId } = req.body;
        
        if (!extensionId) {
            return res.status(400).json({ success: false, error: 'extensionId required' });
        }
        
        await log(`[Extensions] Installing: ${extensionId}`);
        
        const catalog = await loadCatalog();
        const extension = catalog.find(ext => ext.id === extensionId);
        
        if (!extension) {
            return res.status(404).json({ success: false, error: 'Extension not found in catalog' });
        }
        
        const installed = await loadInstalledExtensions();
        
        if (installed.some(ext => ext.id === extensionId)) {
            return res.status(400).json({ success: false, error: 'Extension already installed' });
        }
        
        installed.push({
            id: extension.id,
            name: extension.name,
            version: extension.version,
            installedAt: new Date().toISOString(),
            enabled: true
        });
        
        await saveInstalledExtensions(installed);
        await log(`[Extensions] Installed: ${extensionId} (${extension.name})`);
        
        res.json({ success: true, message: `Extension ${extension.name} installed successfully` });
    } catch (error) {
        await log(`[Extensions] Error installing: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/extensions/uninstall - удаление расширения
router.post('/api/extensions/uninstall', async (req, res) => {
    try {
        const { extensionId } = req.body;
        
        if (!extensionId) {
            return res.status(400).json({ success: false, error: 'extensionId required' });
        }
        
        await log(`[Extensions] Uninstalling: ${extensionId}`);
        
        const installed = await loadInstalledExtensions();
        const filtered = installed.filter(ext => ext.id !== extensionId);
        
        if (filtered.length === installed.length) {
            return res.status(404).json({ success: false, error: 'Extension not installed' });
        }
        
        await saveInstalledExtensions(filtered);
        await log(`[Extensions] Uninstalled: ${extensionId}`);
        
        res.json({ success: true, message: 'Extension uninstalled successfully' });
    } catch (error) {
        await log(`[Extensions] Error uninstalling: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/extensions/update - обновление расширения
router.post('/api/extensions/update', async (req, res) => {
    try {
        const { extensionId } = req.body;
        
        if (!extensionId) {
            return res.status(400).json({ success: false, error: 'extensionId required' });
        }
        
        await log(`[Extensions] Updating: ${extensionId}`);
        
        const catalog = await loadCatalog();
        const installed = await loadInstalledExtensions();
        const extensionIndex = installed.findIndex(ext => ext.id === extensionId);
        
        if (extensionIndex === -1) {
            return res.status(404).json({ success: false, error: 'Extension not installed' });
        }
        
        const availableExt = catalog.find(ext => ext.id === extensionId);
        if (availableExt) {
            const oldVersion = installed[extensionIndex].version;
            installed[extensionIndex].version = availableExt.version;
            installed[extensionIndex].updatedAt = new Date().toISOString();
            await saveInstalledExtensions(installed);
            await log(`[Extensions] Updated: ${extensionId} ${oldVersion} → ${availableExt.version}`);
        }
        
        res.json({ success: true, message: 'Extension updated successfully' });
    } catch (error) {
        await log(`[Extensions] Error updating: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/extensions/toggle - включение/выключение расширения
router.post('/api/extensions/toggle', async (req, res) => {
    try {
        const { extensionId, enabled } = req.body;
        
        if (!extensionId) {
            return res.status(400).json({ success: false, error: 'extensionId required' });
        }
        
        await log(`[Extensions] Toggling: ${extensionId} -> ${enabled ? 'enabled' : 'disabled'}`);
        
        const installed = await loadInstalledExtensions();
        const extensionIndex = installed.findIndex(ext => ext.id === extensionId);
        
        if (extensionIndex === -1) {
            return res.status(404).json({ success: false, error: 'Extension not installed' });
        }
        
        installed[extensionIndex].enabled = enabled;
        await saveInstalledExtensions(installed);
        
        res.json({ success: true, message: `Extension ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error) {
        await log(`[Extensions] Error toggling: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/extensions/refresh - обновление каталога из внешнего источника
router.post('/api/extensions/refresh', async (req, res) => {
    try {
        await log('[Extensions] Refreshing catalog');
        
        // Здесь можно добавить загрузку из внешнего API
        // const remoteCatalog = await fetch('https://hercules-web.ru/api/addons/catalog');
        // await fs.writeFile(catalogFilePath, JSON.stringify(remoteCatalog, null, 2));
        
        res.json({ success: true, message: 'Catalog refreshed' });
    } catch (error) {
        await log(`[Extensions] Error refreshing catalog: ${error.message}`, 'ERROR');
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;