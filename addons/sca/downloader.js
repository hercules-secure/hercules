// downloader.js - скачивание архива вместо git clone
import fs from 'fs/promises';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import AdmZip from 'adm-zip';
import * as tar from 'tar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const LOG_DIR = join(process.cwd(), 'logs', 'sca');
const LOG_FILE = join(LOG_DIR, 'log.txt');

async function logToFile(message, level = 'INFO') {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message}\n`;
        await fs.appendFile(LOG_FILE, logLine);
    } catch (err) {}
}

class GitHubDownloader {
    constructor(options = {}) {
        this.downloadDir = options.downloadDir || null;
        this.githubToken = options.githubToken || null;
        this.logger = {
            info: (msg) => logToFile(msg, 'INFO'),
            warn: (msg) => logToFile(msg, 'WARN'),
            error: (msg) => logToFile(msg, 'ERROR'),
            debug: (msg) => logToFile(msg, 'DEBUG')
        };
        this.history = [];
    }

    async initialize() {
        if (this.downloadDir) {
            await this.ensureDir(this.downloadDir);
        }
        this.logger.info('GitHub Downloader (archive mode) инициализирован');
    }

    async ensureDir(path) {
        try {
            await fs.mkdir(path, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
        }
    }

    extractRepoInfo(url) {
        url = url.trim().replace(/\.git$/, '').split('#')[0].split('?')[0];
        
        const patterns = [
            /github\.com[/:]([^/]+)\/([^/?#]+)/,
            /github\.com[:/]([^/]+)\/([^/]+)/,
            /^([^/]+)\/([^/]+)$/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                const [, owner, repoWithExt] = match;
                const repo = repoWithExt.replace(/\.git$/, '').split(/[?#]/)[0];
                return { owner, repo };
            }
        }

        throw new Error('Неверный формат GitHub URL');
    }

    async downloadArchive(url, branch = 'main') {
    const { owner, repo } = this.extractRepoInfo(url);
    const cleanRepo = repo.replace(/\.git$/, '');
    
    // Используем надёжный URL
    const archiveUrl = `https://github.com/${owner}/${cleanRepo}/zipball/${branch}`;
    
    this.logger.info(`Скачивание архива: ${archiveUrl}`);
    
    const timestamp = Date.now();
    const downloadPath = join(this.downloadDir, `${owner}_${cleanRepo}_${branch}_${timestamp}`);
    const zipPath = `${downloadPath}.zip`;
    
    const response = await fetch(archiveUrl, {
        headers: this.githubToken ? {
            'Authorization': `token ${this.githubToken}`
        } : {}
    });
    
    if (!response.ok) {
        // Пробуем master, если main не сработал
        if (branch === 'main') {
            this.logger.warn(`main не найден, пробуем master`);
            return this.downloadArchive(url, 'master');
        }
        throw new Error(`Не удалось скачать архив: HTTP ${response.status}`);
    }
        // Сохраняем zip файл
        const fileStream = createWriteStream(zipPath);
        await pipeline(response.body, fileStream);
        
        // Распаковываем
        await this.ensureDir(downloadPath);
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(downloadPath, true);
        
        // Находим реальную папку (архив создаёт подпапку)
        const extractedFiles = await fs.readdir(downloadPath);
        let actualPath = downloadPath;
        
        if (extractedFiles.length === 1) {
            const singleItem = join(downloadPath, extractedFiles[0]);
            const stat = await fs.stat(singleItem);
            if (stat.isDirectory()) {
                actualPath = singleItem;
            }
        }
        
        // Удаляем zip
        await fs.unlink(zipPath).catch(() => {});
        
        // Подсчитываем размер и файлы
        const size = await this.getDirectorySize(actualPath);
        const files = await this.countFiles(actualPath);
        
        const result = {
            id: `${owner}_${repo}_${timestamp}`,
            owner,
            repo,
            requestedBranch: branch,
            actualBranch: branch,
            downloadPath: actualPath,
            path: actualPath,
            size,
            files,
            timestamp,
            downloadTime: 0,
            url: `https://github.com/${owner}/${repo}`,
            cloneUrl: archiveUrl,
            cleanup: async () => {
                await fs.rm(downloadPath, { recursive: true, force: true });
            }
        };
        
        this.logger.info(`Архив скачан и распакован: ${owner}/${repo}`);
        
        return result;
    }

    async downloadRepository(url, options = {}) {
        if (!this.downloadDir) {
            throw new Error('downloadDir не указан');
        }
        
        const branch = options.branch || 'main';
        const depth = options.depth || 1; // не используется, но оставляем для совместимости
        
        this.logger.info(`Скачивание репозитория через архив: ${url} (branch: ${branch})`);
        
        try {
            const result = await this.downloadArchive(url, branch);
            
            this.history.push({
                ...result,
                url,
                date: new Date().toISOString()
            });
            
            return result;
            
        } catch (error) {
            this.logger.error('Ошибка скачивания:', error.message);
            throw new Error(`Не удалось скачать репозиторий: ${error.message}`);
        }
    }

    async getDirectorySize(path) {
        try {
            let totalSize = 0;
            
            const calculateSize = async (dir) => {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = join(dir, entry.name);
                    
                    if (entry.isDirectory()) {
                        await calculateSize(fullPath);
                    } else {
                        const stats = await fs.stat(fullPath);
                        totalSize += stats.size;
                    }
                }
            };
            
            await calculateSize(path);
            return totalSize;
        } catch (error) {
            return 0;
        }
    }

    async countFiles(path) {
        try {
            let count = 0;
            
            const countFilesRecursive = async (dir) => {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = join(dir, entry.name);
                    
                    if (entry.isDirectory()) {
                        await countFilesRecursive(fullPath);
                    } else {
                        count++;
                    }
                }
            };
            
            await countFilesRecursive(path);
            return count;
        } catch (error) {
            return 0;
        }
    }

    async getRepositoryInfo(url) {
        const { owner, repo } = this.extractRepoInfo(url);
        return {
            owner,
            repo,
            defaultBranch: 'main',
            url: `https://github.com/${owner}/${repo}`
        };
    }

    async cleanup() {
        this.logger.info('GitHub Downloader завершил работу');
    }
}

export { GitHubDownloader };