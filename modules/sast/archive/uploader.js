
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class FileUploader {
    constructor(storageDir, maxSize = 100 * 1024 * 1024) {
        this.storageDir = storageDir;
        this.maxSize = maxSize;
        this.allowedExtensions = ['.zip', '.tar', '.gz', '.tgz', '.7z'];
    }

    /**
     * Сохранение загруженного файла
     * @param {Buffer|string} fileData - данные файла или путь к временному файлу
     * @param {string} originalName - оригинальное имя файла
     */
    async save(fileData, originalName) {
        // Проверяем расширение
        const ext = path.extname(originalName).toLowerCase();
        if (!this.allowedExtensions.includes(ext) && !originalName.endsWith('.tar.gz')) {
            throw new Error('Неподдерживаемый формат архива. Разрешены: ZIP, TAR, GZ, 7Z');
        }

        // Генерируем ID и пути
        const archiveId = this.generateId();
        const filename = `${archiveId}${ext}`;
        const archivePath = path.join(this.storageDir, filename);
        const infoPath = path.join(this.storageDir, `${archiveId}.info.json`);

        let size = 0;

        // Сохраняем файл
        if (Buffer.isBuffer(fileData)) {
            // Данные в буфере
            if (fileData.length > this.maxSize) {
                throw new Error(`Файл слишком большой (макс. ${this.maxSize / 1024 / 1024} МБ)`);
            }
            await fs.writeFile(archivePath, fileData);
            size = fileData.length;
        } else if (typeof fileData === 'string') {
            // Путь к временному файлу (например от multer)
            const stat = await fs.stat(fileData);
            if (stat.size > this.maxSize) {
                throw new Error(`Файл слишком большой (макс. ${this.maxSize / 1024 / 1024} МБ)`);
            }
            await fs.rename(fileData, archivePath);
            size = stat.size;
        } else {
            throw new Error('Неверный формат данных');
        }

        // Создаем информацию об архиве
        const info = {
            id: archiveId,
            source: 'upload',
            originalName,
            filename,
            path: archivePath,
            size,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        // Сохраняем информацию
        await fs.writeFile(infoPath, JSON.stringify(info, null, 2));

        return info;
    }

    /**
     * Генерация уникального ID
     */
    generateId() {
        return crypto.randomBytes(8).toString('hex');
    }
}