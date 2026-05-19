#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

// Определяем корень проекта
const findProjectRoot = () => {
    let current = __dirname;
    while (current !== path.parse(current).root) {
        try {
            const testPath = path.join(current, 'server.js');
            require.resolve(testPath);
            return current;
        } catch {}
        try {
            const testPath = path.join(current, 'package.json');
            require.resolve(testPath);
            return current;
        } catch {}
        current = path.dirname(current);
    }
    return process.cwd();
};

const PROJECT_ROOT = findProjectRoot();
const ADDONS_DIR = path.join(PROJECT_ROOT, 'addons');
const CATALOG_FILE = path.join(ADDONS_DIR, 'catalog.json');
const INSTALLED_FILE = path.join(ADDONS_DIR, 'installed.json');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs', 'addons');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

// ======================
// ЛОГГЕР (только в файл)
// ======================
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

async function logError(message) {
    await log(message, 'ERROR');
}

async function logWarn(message) {
    await log(message, 'WARN');
}

async function logInfo(message) {
    await log(message, 'INFO');
}

// ======================
// ПРОВЕРКА СТРУКТУРЫ
// ======================
async function validateAddon(addonPath) {
    const required = ['manifest.json', 'addon/router.js'];
    const missing = [];
    
    for (const file of required) {
        const filePath = path.join(addonPath, file);
        try {
            await fs.access(filePath);
        } catch {
            missing.push(file);
        }
    }
    
    if (missing.length > 0) {
        await logError(`Отсутствуют обязательные файлы: ${missing.join(', ')}`);
        return false;
    }
    
    return true;
}

// ======================
// ЗАПОЛНЕНИЕ МАНИФЕСТА
// ======================
async function fillManifest(addonPath) {
    const manifestPath = path.join(addonPath, 'manifest.json');
    let manifest = {};
    
    try {
        const content = await fs.readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(content);
        await logInfo(`Манифест загружен: ${manifestPath}`);
    } catch {
        await logInfo(`Создание нового манифеста: ${manifestPath}`);
    }
    
    if (!manifest.id) {
        manifest.id = await question('ID addon (a-z, 0-9, -, _): ');
        await logInfo(`ID: ${manifest.id}`);
    }
    if (!manifest.name) {
        manifest.name = await question('Название addon: ');
        await logInfo(`Название: ${manifest.name}`);
    }
    if (!manifest.version) {
        manifest.version = await question('Версия (1.0.0): ') || '1.0.0';
        await logInfo(`Версия: ${manifest.version}`);
    }
    if (!manifest.description) {
        manifest.description = await question('Описание: ');
        await logInfo(`Описание: ${manifest.description}`);
    }
    if (!manifest.author) {
        manifest.author = await question('Автор: ');
        await logInfo(`Автор: ${manifest.author}`);
    }
    if (!manifest.icon) {
        manifest.icon = 'fa-puzzle-piece';
    }
    
    manifest.router = `./addons/${manifest.id}/addon/router.js`;
    
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await logInfo(`Манифест сохранён: ${manifestPath}`);
    
    return manifest;
}

// ======================
// КОПИРОВАНИЕ В ADDONS
// ======================
async function copyToAddons(addonPath, manifest) {
    const targetPath = path.join(ADDONS_DIR, manifest.id);
    const targetAddonDir = path.join(targetPath, 'addon');
    await fs.mkdir(targetAddonDir, { recursive: true });
    
    const sourceRouter = path.join(addonPath, 'addon', 'router.js');
    const targetRouter = path.join(targetAddonDir, 'router.js');
    await fs.copyFile(sourceRouter, targetRouter);
    
    const targetManifest = path.join(targetPath, 'manifest.json');
    await fs.writeFile(targetManifest, JSON.stringify(manifest, null, 2));
    
    await logInfo(`Скопировано в addons/${manifest.id}`);
    return targetPath;
}

// ======================
// РЕГИСТРАЦИЯ В CATALOG.JSON
// ======================
async function registerInCatalog(manifest) {
    let catalog = { addons: [] };
    try {
        const content = await fs.readFile(CATALOG_FILE, 'utf-8');
        catalog = JSON.parse(content);
        await logInfo(`catalog.json загружен`);
    } catch {
        await logInfo(`Создан новый catalog.json`);
    }
    
    const existing = catalog.addons.find(a => a.id === manifest.id);
    if (existing) {
        await logWarn(`Addon ${manifest.id} уже есть в каталоге, обновляем`);
        Object.assign(existing, manifest);
    } else {
        catalog.addons.push(manifest);
        await logInfo(`Addon ${manifest.id} добавлен в каталог`);
    }
    
    await fs.writeFile(CATALOG_FILE, JSON.stringify(catalog, null, 2));
    await logInfo(`catalog.json сохранён`);
}

// ======================
// УСТАНОВКА В INSTALLED.JSON
// ======================
async function installAddon(manifest) {
    let installed = [];
    try {
        const content = await fs.readFile(INSTALLED_FILE, 'utf-8');
        installed = JSON.parse(content);
        await logInfo(`installed.json загружен`);
    } catch {
        await logInfo(`Создан новый installed.json`);
    }
    
    const existingIndex = installed.findIndex(a => a.id === manifest.id);
    if (existingIndex !== -1) {
        await logWarn(`Addon ${manifest.id} уже установлен, обновляем`);
        installed[existingIndex] = {
            ...installed[existingIndex],
            ...manifest,
            enabled: true,
            updatedAt: new Date().toISOString()
        };
    } else {
        installed.push({
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            icon: manifest.icon,
            router: manifest.router,
            enabled: true,
            order: installed.length + 1,
            installedAt: new Date().toISOString()
        });
        await logInfo(`Addon ${manifest.id} установлен`);
    }
    
    await fs.writeFile(INSTALLED_FILE, JSON.stringify(installed, null, 2));
    await logInfo(`installed.json сохранён`);
}

// ======================
// УДАЛЕНИЕ ADDON
// ======================
async function removeAddon(addonId) {
    let installed = [];
    try {
        const content = await fs.readFile(INSTALLED_FILE, 'utf-8');
        installed = JSON.parse(content);
        const filtered = installed.filter(a => a.id !== addonId);
        await fs.writeFile(INSTALLED_FILE, JSON.stringify(filtered, null, 2));
        await logInfo(`Addon ${addonId} удалён из installed.json`);
    } catch (err) {
        await logError(`Ошибка при удалении из installed.json: ${err.message}`);
    }
    
    try {
        const content = await fs.readFile(CATALOG_FILE, 'utf-8');
        const catalog = JSON.parse(content);
        catalog.addons = catalog.addons.filter(a => a.id !== addonId);
        await fs.writeFile(CATALOG_FILE, JSON.stringify(catalog, null, 2));
        await logInfo(`Addon ${addonId} удалён из catalog.json`);
    } catch (err) {
        await logError(`Ошибка при удалении из catalog.json: ${err.message}`);
    }
    
    const addonPath = path.join(ADDONS_DIR, addonId);
    try {
        await fs.rm(addonPath, { recursive: true, force: true });
        await logInfo(`Директория addon удалена: ${addonPath}`);
    } catch (err) {
        await logError(`Ошибка при удалении директории: ${err.message}`);
    }
}

// ======================
// ОСНОВНАЯ ФУНКЦИЯ
// ======================
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const param = args[1];
    
    await logInfo(`=== Команда: ${command} ${param || ''} ===`);
    
    switch (command) {
        case 'add':
            if (!param) {
                console.log('Usage: hercules addon add <path-to-addon>');
                await logError('Не указан путь к addon');
                rl.close();
                return;
            }
            
            const addonPath = path.resolve(param);
            await logInfo(`Путь к addon: ${addonPath}`);
            
            const isValid = await validateAddon(addonPath);
            if (!isValid) {
                console.log('Ошибка: неверная структура addon');
                await logError('Неверная структура addon');
                rl.close();
                return;
            }
            
            console.log('Структура addon корректна');
            
            const manifest = await fillManifest(addonPath);
            await copyToAddons(addonPath, manifest);
            await registerInCatalog(manifest);
            await installAddon(manifest);
            
            console.log(`Готово! Addon ${manifest.id} опубликован`);
            await logInfo(`Addon опубликован: ${manifest.id} v${manifest.version}`);
            break;
            
        case 'remove':
            if (!param) {
                console.log('Usage: hercules addon remove <addon-id>');
                await logError('Не указан ID addon');
                rl.close();
                return;
            }
            
            await removeAddon(param);
            console.log(`Addon ${param} удалён`);
            await logInfo(`Addon удалён: ${param}`);
            break;
            
        case 'list':
            try {
                const content = await fs.readFile(INSTALLED_FILE, 'utf-8');
                const installed = JSON.parse(content);
                console.log('Установленные addon:');
                for (const a of installed) {
                    console.log(`  ${a.id} - ${a.name} v${a.version} [${a.enabled ? 'включён' : 'отключён'}]`);
                }
                await logInfo('Выполнен список addon');
            } catch (err) {
                console.log('Нет установленных addon');
                await logInfo('Нет установленных addon');
            }
            break;
            
        default:
            console.log(`
Управление addon для платформы Геркулес

Команды:
  hercules addon add <path>    - добавить addon из локальной директории
  hercules addon remove <id>   - удалить addon
  hercules addon list          - список установленных addon

Примеры:
  hercules addon add ./my-analyzer
  hercules addon remove blender
  hercules addon list
            `);
            await logInfo('Показана справка');
            break;
    }
    
    rl.close();
}

main().catch(async (error) => {
    console.error('Ошибка:', error.message);
    await logError(`Критическая ошибка: ${error.message}`);
    rl.close();
    process.exit(1);
});