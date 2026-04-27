import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import * as tar from 'tar'; // ИСПРАВЛЕНО: используем * as tar вместо default
import unzipper from 'unzipper';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

const execAsync = promisify(exec);

export class ArchiveExtractor {
    constructor(options = {}) {
        this.extractDir = options.extractDir || './temp/sast/extracted';
        this.deleteAfter = options.deleteAfter || false;
    }

    /**
     * Основной метод распаковки
     * @param {string} archivePath - путь к архиву
     * @param {string} sessionId - ID сессии
     * @returns {Promise<Object>} - информация о распакованных файлах
     */
    async extract(archivePath, sessionId = null) {
        if (!sessionId) {
            sessionId = this.generateSessionId();
        }

        const extractPath = path.join(this.extractDir, sessionId);
        await fs.mkdir(extractPath, { recursive: true });

        const format = this.detectFormat(archivePath);
        //console.log(`📦 Распаковка [${sessionId}]: ${path.basename(archivePath)} (${format})`);

        try {
            // Вызываем соответствующий метод
            await this[`extract${format}`](archivePath, extractPath);
            
            // Собираем информацию о файлах
            const files = await this.scanFiles(extractPath);
            
            // Создаем мета-информацию
            const metadata = {
                sessionId,
                archiveName: path.basename(archivePath),
                archiveSize: (await fs.stat(archivePath)).size,
                extractPath,
                fileCount: files.length,
                files: files.slice(0, 1000), // Топ-1000 файлов
                stats: this.generateStats(files)
            };

            // Сохраняем метаданные
            await fs.writeFile(
                path.join(extractPath, 'metadata.json'),
                JSON.stringify(metadata, null, 2)
            );

            // Если нужно удалить архив после распаковки
            if (this.deleteAfter) {
                await fs.unlink(archivePath).catch(() => {});
            }

            return metadata;

        } catch (error) {
            // Очищаем при ошибке
            await fs.rm(extractPath, { recursive: true, force: true }).catch(() => {});
            throw new Error(`Ошибка распаковки: ${error.message}`);
        }
    }

    /**
     * Очистка директории сессии
     */
    async cleanup(sessionId) {
        const extractPath = path.join(this.extractDir, sessionId);
        await fs.rm(extractPath, { recursive: true, force: true }).catch(() => {});
    }

    /**
     * Определение формата архива
     */
    detectFormat(filePath) {
        if (filePath.endsWith('.zip')) return 'Zip';
        if (filePath.endsWith('.tar')) return 'Tar';
        if (filePath.endsWith('.tar.gz') || filePath.endsWith('.tgz')) return 'TarGz';
        if (filePath.endsWith('.gz')) return 'Gz';
        if (filePath.endsWith('.7z')) return 'Seven';
        throw new Error('Неподдерживаемый формат архива');
    }

    /**
     * Распаковка ZIP
     */
    async extractZip(archivePath, extractPath) {
        await createReadStream(archivePath)
            .pipe(unzipper.Extract({ path: extractPath }))
            .promise();
    }

    /**
     * Распаковка TAR
     */
    async extractTar(archivePath, extractPath) {
        await tar.extract({
            file: archivePath,
            cwd: extractPath,
            preservePaths: true
        });
    }

    /**
     * Распаковка TAR.GZ
     */
    async extractTarGz(archivePath, extractPath) {
        await tar.extract({
            file: archivePath,
            cwd: extractPath,
            preservePaths: true
        });
    }

    /**
     * Распаковка GZ (один файл)
     */
    async extractGz(archivePath, extractPath) {        
        const outputFile = path.join(
            extractPath,
            path.basename(archivePath, '.gz')
        );
        
        await pipeline(
            createReadStream(archivePath),
            createGunzip(),
            fs.createWriteStream(outputFile)
        );
    }

    /**
     * Распаковка 7z (требуется 7z в системе)
     */
    async extractSeven(archivePath, extractPath) {
        try {
            await execAsync(`7z x "${archivePath}" -o"${extractPath}" -y`);
        } catch (error) {
            throw new Error('Для распаковки 7z требуется установленный 7-Zip');
        }
    }

    /**
     * Сканирование распакованных файлов
     */
    async scanFiles(dir, relativePath = '') {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = path.join(relativePath, entry.name);

            if (entry.isDirectory()) {
                // Пропускаем служебные директории
                if (this.shouldIgnoreDir(entry.name)) {
                    continue;
                }
                const subFiles = await this.scanFiles(fullPath, relPath);
                files.push(...subFiles);
            } else {
                const stat = await fs.stat(fullPath);
                files.push({
                    path: relPath,
                    name: entry.name,
                    size: stat.size,
                    extension: path.extname(entry.name).toLowerCase(),
                    isBinary: await this.isBinaryFile(fullPath)
                });
            }
        }

        return files;
    }

    /**
     * Проверка на игнорируемые директории
     */
    shouldIgnoreDir(name) {
        const ignoreDirs = [
            'node_modules', '.git', '__pycache__', 'venv', 'env',
            'target', 'build', 'dist', '.idea', '.vscode',
            'coverage', '.next', '.nuxt', 'cache'
        ];
        return ignoreDirs.includes(name);
    }

    /**
     * Проверка на бинарный файл
     */
    async isBinaryFile(filePath) {
        try {
            const fd = await fs.open(filePath, 'r');
            const buffer = Buffer.alloc(1024);
            const { bytesRead } = await fd.read(buffer, 0, 1024, 0);
            await fd.close();
            
            for (let i = 0; i < bytesRead; i++) {
                if (buffer[i] === 0) return true;
            }
            return false;
        } catch {
            return true;
        }
    }

    /**
     * Генерация статистики по файлам
     */
    generateStats(files) {
        const stats = {
            totalSize: 0,
            byExtension: {},
            byDirectory: {}
        };

        for (const file of files) {
            stats.totalSize += file.size;
            
            if (file.extension) {
                stats.byExtension[file.extension] = (stats.byExtension[file.extension] || 0) + 1;
            }
            
            const dir = path.dirname(file.path).split('/')[0] || '/';
            stats.byDirectory[dir] = (stats.byDirectory[dir] || 0) + 1;
        }

        return stats;
    }

    /**
     * Генерация ID сессии
     */
    generateSessionId() {
        return crypto.randomBytes(8).toString('hex');
    }
}