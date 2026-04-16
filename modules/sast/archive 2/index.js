// modules/archive-receiver/index.js
import { GitHubDownloader } from './github.js';
import { GitLabDownloader } from './gitlab.js';
import { FileUploader } from './uploader.js';
import path from 'path';
import fs from 'fs/promises';

export class ArchiveReceiver {
    constructor(options = {}) {
        this.storageDir = options.storageDir || './storage';
        this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100 MB
        
        // Инициализируем загрузчики
        this.github = new GitHubDownloader(this.storageDir);
        this.gitlab = new GitLabDownloader(this.storageDir);
        this.uploader = new FileUploader(this.storageDir, this.maxSize);
    }

    /**
     * Получение архива по ссылке на репозиторий
     */
    async getFromUrl(repoUrl, options = {}) {
        console.info(`\nПолучение архива из репозитория: ${repoUrl}`);
        
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
                throw new Error(`Платформа ${platform} не поддерживается`);
        }

        // Скачиваем архив
        const result = await downloader.download(repoUrl, options.branch);
        
        console.info(`Архив получен: ${result.filename} (${(result.size / 1024 / 1024).toFixed(2)} МБ)`);
        
        return result;
    }

    /**
     * Получение архива через загрузку файла
     */
    async getFromFile(fileData, originalName) {
        console.info(`\nПолучение архива через загрузку: ${originalName}`);
        
        const result = await this.uploader.save(fileData, originalName);
        
        console.info(`Файл сохранен: ${result.filename} (${(result.size / 1024 / 1024).toFixed(2)} МБ)`);
        
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
        
        console.info(`Архив ${archiveId} удален`);
    }

    /**
     * Очистка старых архивов (можно вызвать по расписанию)
     */
    async cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 часа по умолчанию
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

        console.info(`Очистка: удалено ${deleted} старых файлов`);
        return deleted;
    }
}