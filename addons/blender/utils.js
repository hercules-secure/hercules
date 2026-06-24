import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { createWriteStream, createReadStream } from 'fs';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = promisify(exec);

// ========== ЛОГИРОВАНИЕ ==========

const PROJECT_ROOT = path.join(__dirname, '../..');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs', 'blender');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

function ensureLogDirectory() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

export function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    ensureLogDirectory();
    fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
}

ensureLogDirectory();
log('Логгер инициализирован', 'INFO');

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Извлечение owner и repo из URL (универсальный вариант)
function extractRepoInfo(repoUrl) {
    const url = repoUrl.trim().replace(/\.git$/, '').split('#')[0].split('?')[0];
    
    // Паттерны для разных платформ
    const patterns = [
        // GitHub
        /github\.com[/:]([^/]+)\/([^/?#]+)/,
        /github\.com[:/]([^/]+)\/([^/]+)/,
        // GitLab
        /gitlab\.com[/:]([^/]+)\/([^/?#]+)/,
        /gitlab\.com[:/]([^/]+)\/([^/]+)/,
        // Bitbucket
        /bitbucket\.org[/:]([^/]+)\/([^/?#]+)/,
        /bitbucket\.org[:/]([^/]+)\/([^/]+)/,
        // Gitee
        /gitee\.com[/:]([^/]+)\/([^/?#]+)/,
        // Общий паттерн для любых Git репозиториев (owner/repo)
        /^([^\/\s@]+)\/([^\/\s@]+)$/,
        // Для URL вида https://domain.com/owner/repo
        /https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            let owner, repo;
            
            if (pattern.source.includes('github') || pattern.source.includes('gitlab') || 
                pattern.source.includes('bitbucket') || pattern.source.includes('gitee')) {
                owner = match[1];
                repo = match[2];
            } else {
                // Для универсальных паттернов
                owner = match[1];
                repo = match[2];
            }
            
            repo = repo.replace(/\.git$/, '').split(/[?#]/)[0];
            return { owner, repo, platform: detectPlatform(url) };
        }
    }
    
    // Если не удалось распарсить, пробуем извлечь последние два сегмента пути
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        if (pathParts.length >= 2) {
            const owner = pathParts[pathParts.length - 2];
            const repo = pathParts[pathParts.length - 1].replace(/\.git$/, '');
            return { owner, repo, platform: 'generic' };
        }
    } catch (err) {}
    
    throw new Error('Не удалось извлечь информацию о репозитории из URL');
}

// Определение платформы
function detectPlatform(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('github.com')) return 'github';
    if (urlLower.includes('gitlab.com')) return 'gitlab';
    if (urlLower.includes('bitbucket.org')) return 'bitbucket';
    if (urlLower.includes('gitee.com')) return 'gitee';
    return 'generic';
}

// Скачивание и распаковка архива
// Скачивание и распаковка архива
async function downloadAndExtract(archiveUrl, outputPath) {
    const zipPath = `${outputPath}.zip`;
    
    const response = await fetch(archiveUrl);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    // Получаем данные как Buffer (правильный способ для Node.js)
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Сохраняем zip файл
    fs.writeFileSync(zipPath, buffer);
    
    // Распаковываем
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(outputPath, true);
    
    // Удаляем zip
    fs.unlinkSync(zipPath);
    
    // Если архив создал подпапку, перемещаем содержимое
    const files = fs.readdirSync(outputPath);
    if (files.length === 1) {
        const singleItem = path.join(outputPath, files[0]);
        const stat = fs.statSync(singleItem);
        if (stat.isDirectory()) {
            const subFiles = fs.readdirSync(singleItem);
            for (const file of subFiles) {
                const src = path.join(singleItem, file);
                const dest = path.join(outputPath, file);
                fs.renameSync(src, dest);
            }
            fs.rmdirSync(singleItem);
        }
    }
}

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

// Генерация ID
export function generateId() {
    const id = Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
    log(`Сгенерирован ID: ${id}`);
    return id;
}

// Клонирование репозитория через скачивание архива (без git)
export async function cloneRepository(repoUrl, branch, outputPath) {
    const { owner, repo } = extractRepoInfo(repoUrl);
    const cleanRepo = repo.replace(/\.git$/, '');
    const targetBranch = branch || 'main';
    const archiveUrl = `https://github.com/${owner}/${cleanRepo}/zipball/${targetBranch}`;
    
    log(`Скачивание архива репозитория: ${repoUrl}, ветка: ${targetBranch}`);
    
    // Создаём папку
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }
    
    try {
        await downloadAndExtract(archiveUrl, outputPath);
        log(`Архив скачан и распакован: ${outputPath}`);
        return outputPath;
    } catch (error) {
        // Если main не сработал, пробуем master
        if (targetBranch === 'main') {
            log(`Ветка main не найдена, пробуем master`, 'WARN');
            const masterUrl = `https://github.com/${owner}/${cleanRepo}/zipball/master`;
            try {
                await downloadAndExtract(masterUrl, outputPath);
                log(`Архив (master) скачан и распакован: ${outputPath}`);
                return outputPath;
            } catch (masterError) {
                log(`Ошибка скачивания архива: ${masterError.message}`, 'ERROR');
                throw new Error(`Не удалось скачать репозиторий: ${masterError.message}`);
            }
        }
        log(`Ошибка скачивания архива: ${error.message}`, 'ERROR');
        throw new Error(`Не удалось скачать репозиторий: ${error.message}`);
    }
}

// Определение типа архива
function getArchiveType(filePath, originalName) {
    const fileName = originalName || path.basename(filePath);
    const lowerName = fileName.toLowerCase();
    
    if (lowerName.endsWith('.zip')) return 'zip';
    if (lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tgz')) return 'tar.gz';
    if (lowerName.endsWith('.tar')) return 'tar';
    
    try {
        const buffer = fs.readFileSync(filePath);
        const bytes = buffer.subarray(0, 4);
        
        if (bytes[0] === 0x50 && bytes[1] === 0x4B) return 'zip';
        if (bytes[0] === 0x1F && bytes[1] === 0x8B) return 'tar.gz';
    } catch (err) {
        log(`Ошибка чтения магических байтов: ${err.message}`, 'ERROR');
    }
    
    return null;
}

// Распаковка ZIP архива
async function extractZip(zipPath, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(outputPath, true);
            log(`ZIP архив распакован: ${zipPath} -> ${outputPath}`);
            resolve();
        } catch (error) {
            log(`Ошибка распаковки ZIP: ${error.message}`, 'ERROR');
            reject(error);
        }
    });
}

// Распаковка TAR.GZ
async function extractTarGz(tarPath, outputPath) {
    return new Promise((resolve, reject) => {
        import('tar-stream').then(tarStream => {
            const extract = tarStream.extract();
            const gunzip = zlib.createGunzip();
            const readStream = createReadStream(tarPath);
            
            extract.on('entry', (header, stream, next) => {
                const fullPath = path.join(outputPath, header.name);
                const dir = path.dirname(fullPath);
                
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                if (header.type === 'directory') {
                    if (!fs.existsSync(fullPath)) {
                        fs.mkdirSync(fullPath, { recursive: true });
                    }
                    stream.resume();
                    next();
                } else {
                    const writeStream = createWriteStream(fullPath);
                    stream.pipe(writeStream);
                    stream.on('end', next);
                }
            });
            
            extract.on('finish', () => {
                log(`TAR.GZ архив распакован: ${tarPath} -> ${outputPath}`);
                resolve();
            });
            extract.on('error', (error) => {
                log(`Ошибка распаковки TAR.GZ: ${error.message}`, 'ERROR');
                reject(error);
            });
            
            readStream.pipe(gunzip).pipe(extract);
        }).catch(reject);
    });
}

// Распаковка TAR архива
async function extractTar(tarPath, outputPath) {
    return new Promise((resolve, reject) => {
        import('tar-stream').then(tarStream => {
            const extract = tarStream.extract();
            const readStream = createReadStream(tarPath);
            
            extract.on('entry', (header, stream, next) => {
                const fullPath = path.join(outputPath, header.name);
                const dir = path.dirname(fullPath);
                
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                if (header.type === 'directory') {
                    if (!fs.existsSync(fullPath)) {
                        fs.mkdirSync(fullPath, { recursive: true });
                    }
                    stream.resume();
                    next();
                } else {
                    const writeStream = createWriteStream(fullPath);
                    stream.pipe(writeStream);
                    stream.on('end', next);
                }
            });
            
            extract.on('finish', () => {
                log(`TAR архив распакован: ${tarPath} -> ${outputPath}`);
                resolve();
            });
            extract.on('error', (error) => {
                log(`Ошибка распаковки TAR: ${error.message}`, 'ERROR');
                reject(error);
            });
            
            readStream.pipe(extract);
        }).catch(reject);
    });
}

// Основная функция распаковки
export async function extractArchive(archivePath, outputPath, originalName = null) {
    log(`Начало распаковки: ${originalName || archivePath}`);
    
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }
    
    const archiveType = getArchiveType(archivePath, originalName);
    
    if (!archiveType) {
        const error = `Неподдерживаемый формат архива: ${originalName || archivePath}`;
        log(error, 'ERROR');
        throw new Error(error);
    }
    
    log(`Определен тип архива: ${archiveType}`);
    
    if (archiveType === 'zip') {
        await extractZip(archivePath, outputPath);
    } 
    else if (archiveType === 'tar.gz') {
        await extractTarGz(archivePath, outputPath);
    }
    else if (archiveType === 'tar') {
        await extractTar(archivePath, outputPath);
    }
    
    log(`Распаковка завершена: ${outputPath}`);
    return outputPath;
}

// Сканирование проекта
export async function scanProject(projectPath) {
    let files = 0;
    let directories = 0;
    
    function scan(dir) {
        try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    directories++;
                    scan(fullPath);
                } else {
                    files++;
                }
            }
        } catch (err) {
            log(`Ошибка сканирования ${dir}: ${err.message}`, 'ERROR');
        }
    }
    
    scan(projectPath);
    log(`Сканирование завершено: ${files} файлов, ${directories} директорий`);
    return { files, directories };
}

// Поиск зависимостей
export async function findDependencies(projectPath) {
    const manifests = [];
    const packages = [];
    
    const packageJson = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJson)) {
        manifests.push('package.json');
        try {
            const content = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
            if (content.dependencies) {
                Object.entries(content.dependencies).forEach(([name, version]) => {
                    packages.push({ name, version, type: 'dependency' });
                });
            }
            if (content.devDependencies) {
                Object.entries(content.devDependencies).forEach(([name, version]) => {
                    packages.push({ name, version, type: 'devDependency' });
                });
            }
            log(`Найдено зависимостей: ${packages.length} (package.json)`);
        } catch (err) {
            log(`Ошибка парсинга package.json: ${err.message}`, 'ERROR');
        }
    } else {
        log(`package.json не найден в ${projectPath}`);
    }
    
    return { manifests, packages };
}

// Анализ кода
export async function analyzeCode(projectPath) {
    const extensions = ['.js', '.ts', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h'];
    let filesProcessed = 0;
    let totalLines = 0;
    
    function scan(dir) {
        try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    scan(fullPath);
                } else if (extensions.includes(path.extname(item))) {
                    filesProcessed++;
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        totalLines += content.split('\n').length;
                    } catch (err) {
                        log(`Ошибка чтения ${fullPath}: ${err.message}`, 'ERROR');
                    }
                }
            }
        } catch (err) {
            log(`Ошибка сканирования ${dir}: ${err.message}`, 'ERROR');
        }
    }
    
    scan(projectPath);
    log(`Анализ кода: ${filesProcessed} файлов, ${totalLines} строк`);
    return { filesProcessed, totalLines };
}

// Поиск API эндпоинтов
export async function findApiEndpoints(projectPath) {
    const endpoints = [];
    const patterns = [
        /@(?:Get|Post|Put|Delete|Patch)\((?:'|")([^'"]+)(?:'|")\)/g,
        /app\.(?:get|post|put|delete|patch)\((?:'|")([^'"]+)(?:'|")/g,
        /router\.(?:get|post|put|delete|patch)\((?:'|")([^'"]+)(?:'|")/g,
        /@RequestMapping\((?:'|")([^'"]+)(?:'|")\)/g,
        /@(?:GetMapping|PostMapping|PutMapping|DeleteMapping)\((?:'|")([^'"]+)(?:'|")\)/g
    ];
    
    function scan(dir) {
        try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    scan(fullPath);
                } else if (['.js', '.ts', '.py', '.java', '.go'].includes(path.extname(item))) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        for (const pattern of patterns) {
                            let match;
                            while ((match = pattern.exec(content)) !== null) {
                                endpoints.push(match[1]);
                            }
                        }
                    } catch (err) {
                        log(`Ошибка чтения ${fullPath}: ${err.message}`, 'ERROR');
                    }
                }
            }
        } catch (err) {
            log(`Ошибка сканирования ${dir}: ${err.message}`, 'ERROR');
        }
    }
    
    scan(projectPath);
    const uniqueEndpoints = [...new Set(endpoints)];
    log(`Найдено API эндпоинтов: ${uniqueEndpoints.length}`);
    return uniqueEndpoints;
}

// Полный анализ проекта
export async function analyzeProject(projectPath, options = {}) {
    log(`Начало анализа проекта: ${projectPath}`);
    
    const structure = await scanProject(projectPath);
    const dependencies = await findDependencies(projectPath);
    const codeAnalysis = await analyzeCode(projectPath);
    const apiEndpoints = await findApiEndpoints(projectPath);
    
    log(`Анализ проекта завершен`);
    
    return {
        structure,
        dependencies,
        codeAnalysis,
        apiEndpoints
    };
}

// Очистка временной директории
export function cleanupTempDir(tempPath) {
    if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { recursive: true, force: true });
        log(`Очищена временная директория: ${tempPath}`);
    }
}

// Создание временной директории
export function createTempDir(taskId) {
    const tempPath = path.join(process.env.TEMP || '/tmp', 'hercules', taskId);
    if (!fs.existsSync(tempPath)) {
        fs.mkdirSync(tempPath, { recursive: true });
        log(`Создана временная директория: ${tempPath}`);
    }
    return tempPath;
}