import axios from 'axios';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import path from 'path';
import { URL } from 'url';

export class GitHubDownloader {
    constructor(storageDir) {
        this.storageDir = storageDir;
        this.apiBase = 'https://api.github.com';
    }

    /**
     * Скачивание архива с GitHub
     */
    async download(repoUrl, branch = null) {
        // Парсим URL
        const { owner, repo } = this.parseUrl(repoUrl);
        
        // Получаем информацию о репозитории
        const repoInfo = await this.getRepoInfo(owner, repo);
        
        // Определяем ветку
        const targetBranch = branch || repoInfo.default_branch;
        
        // Формируем ссылку на архив
        const archiveUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${targetBranch}.zip`;
        
        // Генерируем ID и имена файлов
        const archiveId = this.generateId();
        const filename = `${owner}-${repo}-${targetBranch}-${archiveId}.zip`;
        const archivePath = path.join(this.storageDir, filename);
        const infoPath = path.join(this.storageDir, `${archiveId}.info.json`);
        
        // убрать в лог
        //console.log(`GitHub: ${owner}/${repo}`);
        //console.log(`Ветка: ${targetBranch}`);
        //console.log(`Загрузка: ${archiveUrl}`);

        // Скачиваем архив
        const stats = await this.downloadFile(archiveUrl, archivePath);

        // Создаем информацию об архиве
        const info = {
            id: archiveId,
            source: 'github',
            owner,
            repo,
            branch: targetBranch,
            url: repoUrl,
            filename,
            path: archivePath,
            size: stats.size,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            metadata: repoInfo
        };

        // Сохраняем информацию
        await fs.writeFile(infoPath, JSON.stringify(info, null, 2));

        return info;
    }

    /**
     * Парсинг GitHub URL
     */
    parseUrl(url) {
        const urlObj = new URL(url);
        const parts = urlObj.pathname.split('/').filter(p => p);
        
        if (parts.length < 2) {
            throw new Error('Неверный формат GitHub URL');
        }

        return {
            owner: parts[0],
            repo: parts[1].replace('.git', '')
        };
    }

    /**
     * Получение информации о репозитории через GitHub API
     */
    async getRepoInfo(owner, repo) {
        try {
            const response = await axios.get(`${this.apiBase}/repos/${owner}/${repo}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Hercules-SAST'
                },
                timeout: 5000
            });

            return {
                name: response.data.name,
                full_name: response.data.full_name,
                private: response.data.private,
                default_branch: response.data.default_branch,
                size: response.data.size,
                language: response.data.language,
                updated_at: response.data.updated_at
            };
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error(`Репозиторий ${owner}/${repo} не найден`);
            }
            if (error.response?.status === 403) {
                return { default_branch: 'main' };
            }
            throw error;
        }
    }

    /**
     * Скачивание файла
     */
    async downloadFile(url, outputPath) {
        const response = await axios({
            method: 'GET',
            url,
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 5
        });

        const writer = createWriteStream(outputPath);
        await pipeline(response.data, writer);
        
        return fs.stat(outputPath);
    }

    /**
     * Генерация уникального ID
     */
    generateId() {
        return crypto.randomBytes(8).toString('hex');
    }
}