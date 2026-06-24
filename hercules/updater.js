// updater.js - исправленная версия с сохранением конфигов

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

// Пути к файлам
const ENV_FILE = path.join(process.cwd(), '.env');
const PID_FILE = path.join(process.cwd(), '.pid');
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_COMBINED = path.join(LOG_DIR, 'hercules', 'log.txt');
const CONFIG_PATH = path.join(process.cwd(), 'hercules', 'config.json');
const VERSION_FILE = path.join(process.cwd(), '.current_version');
const PACKAGE_PATH = path.join(process.cwd(), 'package.json');

// Список важных файлов для сохранения
const IMPORTANT_FILES = [
    'config.json',
    'hercules/config.json',
    'hercules/history/history.json',
    'hercules/license.json',
    'hercules/public.pem',
    'hercules/private.pem',
    '.env'
];

// Задержки
const SHUTDOWN_DELAY = 2000;
const RELOAD_DELAY = 3000;

// Функция для записи в лог
async function writeUpdateLog(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] [UPDATE] ${message}\n`;
    
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
        await fs.appendFile(LOG_COMBINED, logLine);
    } catch (err) {
        // Тихая ошибка
    }
}

// Выполнение команды с логированием
async function execWithLog(cmd, successMsg, errorMsg) {
    try {
        await writeUpdateLog(`Выполнение: ${cmd}`, 'DEBUG');
        const { stdout, stderr } = await execAsync(cmd);
        if (stdout && stdout.trim()) await writeUpdateLog(stdout.trim(), 'DEBUG');
        if (stderr && stderr.trim()) await writeUpdateLog(stderr.trim(), 'WARN');
        if (successMsg) await writeUpdateLog(successMsg, 'INFO');
        return { success: true, stdout, stderr };
    } catch (error) {
        await writeUpdateLog(`${errorMsg || 'Ошибка'}: ${error.message}`, 'ERROR');
        throw error;
    }
}

// Получение текущей ветки Git
async function getCurrentBranch() {
    try {
        const { stdout } = await execAsync('git branch --show-current');
        return stdout.trim() || 'main';
    } catch (error) {
        await writeUpdateLog(`Ошибка получения ветки: ${error.message}`, 'ERROR');
        return 'main';
    }
}

// Сохранение всех важных файлов
async function backupImportantFiles() {
    const backupDir = path.join(os.tmpdir(), `hercules_backup_${Date.now()}`);
    await fs.mkdir(backupDir, { recursive: true });
    
    const savedFiles = [];
    
    for (const file of IMPORTANT_FILES) {
        const fullPath = path.join(process.cwd(), file);
        try {
            await fs.access(fullPath);
            const backupPath = path.join(backupDir, file);
            const backupDirPath = path.dirname(backupPath);
            await fs.mkdir(backupDirPath, { recursive: true });
            await fs.copyFile(fullPath, backupPath);
            savedFiles.push(file);
            await writeUpdateLog(`Сохранён: ${file}`, 'INFO');
        } catch (err) {
            if (err.code !== 'ENOENT') {
                await writeUpdateLog(`Ошибка сохранения ${file}: ${err.message}`, 'WARN');
            }
        }
    }
    
    await writeUpdateLog(`Сохранено ${savedFiles.length} файлов в ${backupDir}`, 'INFO');
    return backupDir;
}

// Восстановление важных файлов
async function restoreImportantFiles(backupDir) {
    if (!backupDir) return 0;
    
    let restored = 0;
    
    for (const file of IMPORTANT_FILES) {
        const backupPath = path.join(backupDir, file);
        const fullPath = path.join(process.cwd(), file);
        
        try {
            await fs.access(backupPath);
            const destDir = path.dirname(fullPath);
            await fs.mkdir(destDir, { recursive: true });
            await fs.copyFile(backupPath, fullPath);
            restored++;
            await writeUpdateLog(`Восстановлен: ${file}`, 'INFO');
        } catch (err) {
            // Файла нет в бэкапе - пропускаем
            if (err.code !== 'ENOENT') {
                await writeUpdateLog(`Ошибка восстановления ${file}: ${err.message}`, 'WARN');
            }
        }
    }
    
    await writeUpdateLog(`Восстановлено ${restored} файлов из ${backupDir}`, 'INFO');
    return restored;
}

// Сохранение параметров из .env
async function saveEnvParams() {
    let savedPort = '6565';
    let savedHost = 'localhost';
    
    try {
        const envContent = await fs.readFile(ENV_FILE, 'utf-8').catch(() => '');
        
        const portMatch = envContent.match(/^PORT=(.+)$/m);
        if (portMatch) {
            savedPort = portMatch[1].split('#')[0].trim().replace(/["']/g, '');
        }
        
        const hostMatch = envContent.match(/^HOST=(.+)$/m);
        if (hostMatch) {
            savedHost = hostMatch[1].split('#')[0].trim().replace(/["']/g, '');
        }
        
        await writeUpdateLog(`Сохранены параметры: PORT=${savedPort}, HOST=${savedHost}`, 'INFO');
        return { port: savedPort, host: savedHost };
    } catch (error) {
        await writeUpdateLog(`Ошибка чтения .env: ${error.message}`, 'ERROR');
        return { port: '6565', host: 'localhost' };
    }
}

// Восстановление параметров в .env
async function restoreEnvParams(port, host) {
    try {
        let envContent = '';
        try {
            envContent = await fs.readFile(ENV_FILE, 'utf-8');
        } catch {
            envContent = '';
        }
        
        const lines = envContent.split('\n');
        let hasPort = false;
        let hasHost = false;
        
        const newLines = lines.map(line => {
            if (line.startsWith('PORT=')) {
                hasPort = true;
                return `PORT=${port}`;
            }
            if (line.startsWith('HOST=')) {
                hasHost = true;
                return `HOST=${host}`;
            }
            return line;
        });
        
        if (!hasPort) newLines.push(`PORT=${port}`);
        if (!hasHost) newLines.push(`HOST=${host}`);
        
        await fs.writeFile(ENV_FILE, newLines.join('\n'));
        await writeUpdateLog(`Восстановлены параметры: PORT=${port}, HOST=${host}`, 'INFO');
    } catch (error) {
        await writeUpdateLog(`Ошибка восстановления .env: ${error.message}`, 'ERROR');
        throw error;
    }
}

// Обновление версии в config.json
async function updateConfigVersion(version) {
    try {
        const versionNumber = version.replace(/^v/, '');
        
        let config = {};
        try {
            const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
            config = JSON.parse(configData);
        } catch {
            await writeUpdateLog(`config.json не найден, будет создан новый`, 'WARN');
        }
        
        if (config.info) {
            config.info.versionNumber = versionNumber;
            config.info.updatedAt = new Date().toISOString();
        } else {
            config.info = { 
                versionNumber: versionNumber,
                updatedAt: new Date().toISOString()
            };
        }
        
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
        await writeUpdateLog(`config.json обновлён: versionNumber = ${versionNumber}`, 'INFO');
        return true;
    } catch (error) {
        await writeUpdateLog(`Ошибка обновления config.json: ${error.message}`, 'ERROR');
        return false;
    }
}

// Получение новой версии после обновления
async function getNewVersion() {
    try {
        const packageData = await fs.readFile(PACKAGE_PATH, 'utf-8');
        const pkg = JSON.parse(packageData);
        if (pkg.version) return pkg.version;
    } catch {
        // Игнорируем
    }
    
    try {
        const { stdout } = await execAsync('git describe --tags --abbrev=0 2>/dev/null || echo ""');
        const tag = stdout.trim();
        if (tag) return tag.replace(/^v/, '');
    } catch {
        // Игнорируем
    }
    
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 14);
    return timestamp;
}

// Остановка сервера
async function stopServer() {
    try {
        const pid = await fs.readFile(PID_FILE, 'utf-8');
        if (pid && parseInt(pid)) {
            process.kill(parseInt(pid), 'SIGTERM');
            await writeUpdateLog(`Сервер остановлен (PID: ${pid})`, 'INFO');
            await new Promise(resolve => setTimeout(resolve, SHUTDOWN_DELAY));
        }
    } catch (err) {
        if (err.code !== 'ENOENT') {
            await writeUpdateLog(`Ошибка остановки: ${err.message}`, 'WARN');
        }
    }
}

// Git обновление с сохранением конфигов
async function gitUpdate(branch, backupDir) {
    // Сначала сохраняем важные файлы во временную папку
    await writeUpdateLog('Временное перемещение конфигурационных файлов...', 'INFO');
    
    const tempDir = path.join(os.tmpdir(), `hercules_temp_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Копируем важные файлы во временную папку
    for (const file of IMPORTANT_FILES) {
        const fullPath = path.join(process.cwd(), file);
        try {
            await fs.access(fullPath);
            const tempPath = path.join(tempDir, path.basename(file));
            await fs.copyFile(fullPath, tempPath);
            await writeUpdateLog(`Скопирован: ${file}`, 'DEBUG');
        } catch (err) {
            // Файл не существует
        }
    }
    
    // Fetch
    await execWithLog(
        `git fetch origin ${branch}`,
        `Git fetch завершён`,
        `Ошибка git fetch`
    );
    
    // Reset hard (теперь важные файлы не потеряются, но их нужно вернуть)
    await execWithLog(
        `git reset --hard origin/${branch}`,
        `Git reset завершён`,
        `Ошибка git reset`
    );
    
    // Возвращаем конфигурационные файлы из временной папки
    await writeUpdateLog('Восстановление конфигурационных файлов...', 'INFO');
    
    for (const file of IMPORTANT_FILES) {
        const tempPath = path.join(tempDir, path.basename(file));
        const fullPath = path.join(process.cwd(), file);
        
        try {
            await fs.access(tempPath);
            const destDir = path.dirname(fullPath);
            await fs.mkdir(destDir, { recursive: true });
            await fs.copyFile(tempPath, fullPath);
            await writeUpdateLog(`Восстановлен: ${file}`, 'INFO');
        } catch (err) {
            // Файла нет во временной папке - пропускаем
            if (err.code !== 'ENOENT') {
                await writeUpdateLog(`Ошибка восстановления ${file}: ${err.message}`, 'WARN');
            }
        }
    }
    
    // Удаляем временную папку
    await fs.rm(tempDir, { recursive: true, force: true });
}

// Обновление зависимостей
async function updateDependencies() {
    try {
        const { stdout } = await execAsync('git diff HEAD@{1} --name-only | grep -E "package(-lock)?\\.json" || true');
        
        if (stdout.includes('package.json') || stdout.includes('package-lock.json')) {
            await writeUpdateLog('Обновление зависимостей...', 'INFO');
            await execWithLog('npm install --production', 'NPM install завершён', 'Ошибка npm install');
        } else {
            await writeUpdateLog('Зависимости не изменились', 'INFO');
        }
    } catch (error) {
        await writeUpdateLog(`Ошибка проверки зависимостей: ${error.message}`, 'WARN');
    }
}

// Запуск сервера
async function startServer(port, host) {
    const { spawn } = await import('child_process');
    
    const serverProcess = spawn('node', ['server.js'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, PORT: port, HOST: host }
    });
    serverProcess.unref();
    
    await fs.writeFile(PID_FILE, String(serverProcess.pid));
    await writeUpdateLog(`Сервер запущен (PID: ${serverProcess.pid})`, 'INFO');
    
    return serverProcess.pid;
}

// Основная функция обновления
export async function performUpdate(versionFromClient = null) {
    let backupDir = null;
    
    try {
        await writeUpdateLog('=== НАЧАЛО ОБНОВЛЕНИЯ ПЛАТФОРМЫ ===', 'INFO');
        
        // 1. Сохраняем все важные файлы (на случай ошибки)
        backupDir = await backupImportantFiles();
        
        // 2. Сохраняем текущие параметры
        const { port, host } = await saveEnvParams();
        
        // 3. Останавливаем сервер
        await stopServer();
        
        // 4. Получаем текущую ветку
        const branch = await getCurrentBranch();
        
        // 5. Git обновление (с сохранением конфигов)
        await gitUpdate(branch, backupDir);
        
        // 6. Обновляем .env
        await restoreEnvParams(port, host);
        
        // 7. Обновление зависимостей
        await updateDependencies();
        
        // 8. Обновляем config.json с новой версией
        let newVersion = versionFromClient;
        if (!newVersion) {
            newVersion = await getNewVersion();
        }
        if (newVersion) {
            await updateConfigVersion(newVersion);
        }
        
        // 9. Сохраняем версию в файл
        const versionTimestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 14);
        await fs.writeFile(VERSION_FILE, versionTimestamp);
        await writeUpdateLog(`Версия сохранена: ${versionTimestamp}`, 'INFO');
        
        // 10. Запускаем сервер
        const pid = await startServer(port, host);
        
        // 11. Удаляем временную папку с бэкапом
        if (backupDir) {
            await fs.rm(backupDir, { recursive: true, force: true });
            await writeUpdateLog('Временные файлы удалены', 'INFO');
        }
        
        await writeUpdateLog(`=== ОБНОВЛЕНИЕ ЗАВЕРШЕНО (PID: ${pid}, версия: ${newVersion || versionTimestamp}) ===`, 'INFO');
        
        return { success: true, message: 'Обновление завершено', version: newVersion };
        
    } catch (error) {
        await writeUpdateLog(`ОШИБКА ОБНОВЛЕНИЯ: ${error.message}`, 'ERROR');
        if (error.stderr) {
            await writeUpdateLog(`STDERR: ${error.stderr}`, 'ERROR');
        }
        
        // Попытка восстановить файлы из бэкапа
        if (backupDir) {
            await writeUpdateLog('Попытка восстановления файлов из бэкапа...', 'WARN');
            try {
                await restoreImportantFiles(backupDir);
                await writeUpdateLog('Файлы восстановлены из бэкапа', 'INFO');
            } catch (restoreError) {
                await writeUpdateLog(`Ошибка восстановления: ${restoreError.message}`, 'ERROR');
            }
            
            // Удаляем временную папку
            try {
                await fs.rm(backupDir, { recursive: true, force: true });
            } catch (e) {}
        }
        
        // Попытка перезапустить сервер в случае ошибки
        try {
            await writeUpdateLog('Попытка перезапуска сервера после ошибки...', 'WARN');
            const { port, host } = await saveEnvParams();
            await startServer(port, host);
        } catch (restartError) {
            await writeUpdateLog(`Не удалось перезапустить сервер: ${restartError.message}`, 'ERROR');
        }
        
        return { success: false, error: error.message };
    }
}

// Функция для получения статуса
export async function getUpdateStatus() {
    try {
        const lastUpdate = await fs.readFile(VERSION_FILE, 'utf-8').catch(() => null);
        return {
            isUpdating: false,
            lastUpdate: lastUpdate,
            canUpdate: true
        };
    } catch (error) {
        return {
            isUpdating: false,
            canUpdate: true,
            error: error.message
        };
    }
}