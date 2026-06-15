import { GitHubDownloader } from './github.js';
import { GitLabDownloader } from './gitlab.js';
import { FileUploader } from './uploader.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Абсолютный путь к storage
const STORAGE_DIR = path.join(process.cwd(), 'temp', 'sast', 'storage');

const LOG_DIR = path.join(process.cwd(), 'logs', 'sast');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

async function ensureLogDir() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (error) {
        // Игнорируем ошибку
    }
}

async function ensureStorageDir() {
    try {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
        await writeLog(`Storage директория: ${STORAGE_DIR}`, 'INFO');
    } catch (error) {
        await writeLog(`Ошибка создания storage: ${error.message}`, 'ERROR');
    }
}

async function writeLog(message, level = 'INFO') {
    try {
        await ensureLogDir();
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;
        await fs.appendFile(LOG_FILE, logEntry);
    } catch (error) {
        // Игнорируем ошибку логирования
    }
}

export class ArchiveReceiver {
    constructor(options = {}) {
        // Используем абсолютный путь
        this.storageDir = options.storageDir || STORAGE_DIR;
        this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100 MB
        
        // Инициализируем директорию асинхронно
        ensureStorageDir().catch(() => {});
        
        // Инициализируем загрузчики
        this.github = new GitHubDownloader(this.storageDir);
        this.gitlab = new GitLabDownloader(this.storageDir);
        this.uploader = new FileUploader(this.storageDir, this.maxSize);
    }

    /**
     * Получение архива по ссылке на репозиторий
     */
    async getFromUrl(repoUrl, options = {}) {
        await writeLog(`Получение архива из репозитория: ${repoUrl}`);
        
        // Определяем платформу
        const platform = this.detectPlatform(repoUrl);
        
        // Выбираем нужный загрузчик
        let downloader;
        switch (platform) {
            case 'github':
                downloader = this.github;
                break;
            case 'gitlab':
                downloader = this.gitlab;
                break;
            default:
                const error = `Платформа ${platform} не поддерживается`;
                await writeLog(error, 'ERROR');
                throw new Error(error);
        }

        // Скачиваем архив
        const result = await downloader.download(repoUrl, options.branch);
        
        await writeLog(`Архив получен: ${result.filename} (${(result.size / 1024 / 1024).toFixed(2)} МБ)`);
        
        return result;
    }

    /**
     * Получение архива через загрузку файла
     */
    async getFromFile(fileData, originalName) {
        await writeLog(`Получение архива через загрузку: ${originalName}`);
        
        const result = await this.uploader.save(fileData, originalName);
        
        await writeLog(`Файл сохранен: ${result.filename} (${(result.size / 1024 / 1024).toFixed(2)} МБ)`);
        
        return result;
    }

    /**
     * Определение платформы по URL
     */
    detectPlatform(url) {
        if (url.includes('github.com')) return 'github';
        if (url.includes('gitlab.com')) return 'gitlab';
        if (url.includes('bitbucket.org')) return 'bitbucket';
        throw new Error('Не удалось определить платформу. Поддерживаются: GitHub, GitLab');
    }

    /**
     * Получение информации об архиве
     */
    async getInfo(archiveId) {
        const infoPath = path.join(this.storageDir, `${archiveId}.info.json`);
        try {
            const info = await fs.readFile(infoPath, 'utf-8');
            return JSON.parse(info);
        } catch {
            return null;
        }
    }

    /**
     * Удаление архива
     */
    async delete(archiveId) {
        const archivePath = path.join(this.storageDir, `${archiveId}.zip`);
        const infoPath = path.join(this.storageDir, `${archiveId}.info.json`);
        
        await Promise.all([
            fs.unlink(archivePath).catch(() => {}),
            fs.unlink(infoPath).catch(() => {})
        ]);
        
        await writeLog(`Архив ${archiveId} удален`);
    }

    async cleanup(maxAge = 24 * 60 * 60 * 1000) { 
        try {
            const files = await fs.readdir(this.storageDir);
            const now = Date.now();
            let deleted = 0;

            for (const file of files) {
                if (!file.endsWith('.zip') && !file.endsWith('.info.json')) continue;
                
                const filePath = path.join(this.storageDir, file);
                const stat = await fs.stat(filePath);
                
                if (now - stat.mtimeMs > maxAge) {
                    await fs.unlink(filePath);
                    deleted++;
                }
            }

            if (deleted > 0) {
                await writeLog(`Очистка: удалено ${deleted} старых файлов`);
            }
            return deleted;
        } catch (error) {
            await writeLog(`Ошибка очистки: ${error.message}`, 'ERROR');
            return 0;
        }
    }
}

// Экспортируем путь для внешнего использования
export { STORAGE_DIR };