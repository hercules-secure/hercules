// modules/archive-receiver/gitlab.js
import axios from 'axios';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import path from 'path';
import { URL } from 'url';

export class GitLabDownloader {
    constructor(storageDir) {
        this.storageDir = storageDir;
        this.apiBase = 'https://gitlab.com/api/v4';
    }

    /**
     * Скачивание архива с GitLab
     */
    async download(repoUrl, branch = null) {
        // Парсим URL
        const { projectPath } = this.parseUrl(repoUrl);
        
        // Пытаемся получить информацию о проекте, но не падаем при ошибке
        let projectInfo = { default_branch: 'main' };
        try {
            projectInfo = await this.getProjectInfo(projectPath);
        } catch (error) {
            console.log(`   ⚠️ Не удалось получить информацию о проекте: ${error.message}`);
            console.log(`   ⚠️ Пробуем скачать без метаданных`);
        }
        
        // Определяем ветку
        const targetBranch = branch || projectInfo.default_branch || 'main';
        
        // Формируем ссылку на архив (простой и надежный вариант)
        const archiveUrl = `https://gitlab.com/${projectPath}/-/archive/${targetBranch}/${projectPath.split('/').pop()}-${targetBranch}.zip`;
        
        // Альтернативный вариант для корпоративных GitLab
        const altArchiveUrl = `https://gitlab.com/${projectPath}/repository/archive.zip?ref=${targetBranch}`;
        
        // Генерируем ID и имена файлов
        const archiveId = this.generateId();
        const filename = `${projectPath.replace(/\//g, '-')}-${targetBranch}-${archiveId}.zip`;
        const archivePath = path.join(this.storageDir, filename);
        const infoPath = path.join(this.storageDir, `${archiveId}.info.json`);

        console.log(`   🔗 GitLab: ${projectPath}`);
        console.log(`   🌿 Ветка: ${targetBranch}`);
        console.log(`   📥 Попытка 1: ${archiveUrl}`);

        // Скачиваем архив с первой попытки
        let stats;
        try {
            stats = await this.downloadFile(archiveUrl, archivePath);
        } catch (error) {
            console.log(`   ⚠️ Не удалось скачать по первой ссылке, пробуем альтернативную: ${altArchiveUrl}`);
            try {
                stats = await this.downloadFile(altArchiveUrl, archivePath);
            } catch (secondError) {
                throw new Error(`Не удалось скачать архив. Убедитесь, что репозиторий публичный или у вас есть доступ.`);
            }
        }

        // Создаем информацию об архиве
        const info = {
            id: archiveId,
            source: 'gitlab',
            projectPath,
            branch: targetBranch,
            url: repoUrl,
            filename,
            path: archivePath,
            size: stats.size,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            metadata: projectInfo
        };

        // Сохраняем информацию
        await fs.writeFile(infoPath, JSON.stringify(info, null, 2));

        return info;
    }

    /**
     * Парсинг GitLab URL
     */
    parseUrl(url) {
        const urlObj = new URL(url);
        let projectPath = urlObj.pathname.replace(/^\//, '').replace(/\.git$/, '');
        
        if (!projectPath) {
            throw new Error('Неверный формат GitLab URL');
        }

        return { projectPath };
    }

    /**
     * Получение информации о проекте через GitLab API
     */
    async getProjectInfo(projectPath) {
        try {
            const encodedPath = encodeURIComponent(projectPath);
            const response = await axios.get(`${this.apiBase}/projects/${encodedPath}`, {
                timeout: 5000
            });

            return {
                name: response.data.name,
                path: response.data.path,
                default_branch: response.data.default_branch,
                visibility: response.data.visibility,
                ssh_url: response.data.ssh_url_to_repo,
                http_url: response.data.http_url_to_repo
            };
        } catch (error) {
            // Вместо throw просто возвращаем пустой объект
            console.log(`   ⚠️ GitLab API ошибка: ${error.message}`);
            return { default_branch: 'main' };
        }
    }

    /**
     * Скачивание файла
     */
    async downloadFile(url, outputPath) {
        try {
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
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error('Архив не найден');
            }
            throw error;
        }
    }

    /**
     * Генерация уникального ID
     */
    generateId() {
        return crypto.randomBytes(8).toString('hex');
    }
}