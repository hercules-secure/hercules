import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs/promises';
import pkg from 'winston';
const { createLogger, format, transports } = pkg;
import { GitHubDownloader } from './modules/downloader.js';
//import { DependencyAnalyzer } from './modules/sca/dependency-analyzer.js';
import { analyzeRepository } from './modules/sca/sca.js'
import { ArchiveReceiver } from './modules/sast/archive/index.js';
import { ArchiveExtractor } from './modules/sast/archive/extractor.js'; 
import { analyzeCode } from './modules/sast/sast.js';
import APIFuzzer from './modules/fuzz/rest/fuzz.js';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import * as tar from 'tar';

// Загружаем переменные окружения
dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const receiver = new ArchiveReceiver({
    storageDir: path.join(__dirname, 'storage')
});

const extractor = new ArchiveExtractor({
    extractDir: path.join(__dirname, 'extracted'),
    deleteAfter: false
});

// ======================
// ФУНКЦИИ ДЛЯ РАСПАКОВКИ АРХИВОВ - временно тут
// ======================

async function extractZip(zipPath, extractDir) {
    try {
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractDir, true);

    } catch (error) {
        console.error('Ошибка распаковки ZIP:', error);
        throw new Error(`Не удалось распаковать ZIP: ${error.message}`);
    }
}

async function extractTar(tarPath, extractDir) {

    await execAsync(`tar -xzf "${tarPath}" -C "${extractDir}"`);
   
}

async function extractArchive(archivePath, originalName, extractDir) {
        const stats = await fs.stat(archivePath);
    if (stats.size > 500 * 1024 * 1024) { // 500MB лимит
        throw new Error('Архив слишком большой');
    }
    await ensureDir(extractDir);
    
    // Проверяем по оригинальному имени файла
    const fileName = originalName.toLowerCase();
    
    const isZip = fileName.endsWith('.zip');
    const isTarGz = fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz');
    const isTar = fileName.endsWith('.tar');
    
    if (isZip) {
        await extractZip(archivePath, extractDir);
    } else if (isTarGz) {
        await extractTar(archivePath, extractDir);
    } else if (isTar) {
        await extractTar(archivePath, extractDir);
    } else {
        throw new Error(`Неподдерживаемый формат архива: ${fileName}. Поддерживаются: .zip, .tar, .tar.gz, .tgz`);
    }
}

// ======================
// Настройка multer для разных типов файлов
// ======================

// Multer для загрузки архивов (SAST)
const uploadArchive = multer({ 
    dest: path.join(__dirname, 'temp'),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.zip', '.tar', '.gz', '.tgz', '.7z'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        // Расширенный список разрешенных MIME типов
        const allowedMimes = [
            'application/zip',
            'application/x-zip-compressed',
            'application/x-tar',
            'application/gzip',
            'application/x-gzip',
            'application/octet-stream', // Добавляем application/octet-stream
            'multipart/x-zip'
        ];
        
        // Проверяем расширение
        const isValidExt = allowedExtensions.includes(ext);
        
        // Проверяем MIME тип (если не прошел, но расширение правильное - пропускаем)
        const isValidMime = allowedMimes.includes(file.mimetype);
        
        /*console.log(`📁 Загрузка файла: ${file.originalname}`);
        console.log(`   Расширение: ${ext}, допустимо: ${isValidExt}`);
        console.log(`   MIME тип: ${file.mimetype}, допустимо: ${isValidMime}`);
        */
        if (isValidExt) {
            // Если расширение правильное - пропускаем (даже если MIME тип не в списке)
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый формат файла. Разрешены: .zip, .tar, .gz, .tgz, .7z'));
        }
    }
});

const uploadSCA = multer({ 
    dest: path.join(__dirname, 'temp', 'sca'),
    limits: { 
        fileSize: 200 * 1024 * 1024,
        fieldSize: 200 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.zip', '.tar', '.gz', '.tgz', '.7z'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedExtensions.includes(ext) || file.originalname.endsWith('.tar.gz')) {
            cb(null, true);
        } else {
            cb(new Error('Поддерживаются только ZIP, TAR, GZ, TGZ, 7Z архивы'));
        }
    }
});

// Multer для загрузки спецификаций (FUZZ)
const uploadSpec = multer({ 
    dest: path.join(__dirname, 'temp', 'fuzz'),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.json', '.yaml', '.yml'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Поддерживаются только JSON, YAML, YML файлы'));
        }
    }
});

// Общий multer для простых загрузок
const upload = multer({ 
    dest: path.join(__dirname, 'temp'),
    limits: { fileSize: 100 * 1024 * 1024 }
});

// ======================
// Конфигурация
// ======================
const PORT = process.env.PORT || 6565;
const HOST = process.env.HOST || 'localhost';
const LOG_DIR = process.env.LOG_DIR || './logs';
const STORAGE_DIR = path.join(__dirname, 'storage');
const EXTRACTED_DIR = path.join(__dirname, 'extracted');
const TEMP_DIR = path.join(__dirname, 'temp');
const FUZZ_TEMP_DIR = path.join(__dirname, 'temp', 'fuzz');

// ======================
// Логгер
// ======================
const logger = createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.File({ 
      filename: join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new transports.File({ 
      filename: join(LOG_DIR, 'combined.log') 
    }),
  ],
});

// ======================
// Инициализация сервера
// ======================
const app = express();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:6565',
  credentials: true,
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After']
}));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(compression());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Лимит запросов
app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_REQUESTS || 100,
  message: 'Слишком много запросов с вашего IP, попробуйте позже',
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      error: 'TOO_MANY_REQUESTS',
      message: options.message,
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

const sastLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Меньше лимит для SAST
  message: 'Слишком много запросов SAST анализа'
});

app.use('/api/', limiter);

// Статические файлы
app.use(express.static(join(__dirname, '/public')));


// ======================
// Вспомогательные функции
// ======================
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

function errorResponse(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
  logger.error(`${statusCode}: ${message}`, { errors });
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
  });
}

async function downloadSpecFromUrl(url) {
    try {

            const parsedUrl = new URL(url);
            const allowedDomains = ['raw.githubusercontent.com', 'api.github.com', 'gitlab.com'];
            if (!allowedDomains.includes(parsedUrl.hostname)) {
                throw new Error(`Домен ${parsedUrl.hostname} не разрешен`);
            }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const content = await response.text();
        const filename = url.split('/').pop() || 'spec.yaml';
        const tempPath = path.join(FUZZ_TEMP_DIR, `${Date.now()}-${filename}`);
        await fs.writeFile(tempPath, content, 'utf8');
        return { path: tempPath, filename, content };
    } catch (error) {
        throw new Error(`Ошибка загрузки спецификации: ${error.message}`);
    }
}

// ======================
// Инициализация модулей
// ======================
const githubDownloader = new GitHubDownloader({
  logger: logger,
});

/*const dependencyAnalyzer = new DependencyAnalyzer({
  logger: logger,
});*/

// ======================
// Маршруты API
// ======================

// pages

app.get('/', (req, res) => { res.sendFile(join(__dirname, 'public', '/html/sca.html'));})
   .get('/sca', (req, res) => {res.sendFile(join(__dirname, 'public', '/html/sca.html'));})
   .get('/sast', (req, res) => {res.sendFile(join(__dirname, 'public', '/html/sast.html'));})
   .get('/dast', (req, res) => {res.sendFile(join(__dirname, 'public', '/html/dast.html'));})
   .get('/fuzz', (req, res) => {res.sendFile(join(__dirname, 'public', '/html/fuzz.html'));})


//app.get(['/', '/sca', '/sast', '/dast', '/fuzz'], (req, res) => {
//    res.sendFile(join(__dirname, 'public', '/html/index.html'));
//});
app.post('/api/sca', async (req, res) => {
  try {
    const { url, name } = req.body;
    
    if (!url) {
      return errorResponse(res, 'URL репозитория обязателен', 400);
    }
     
    let bom = await analyzeRepository(url, name);
    res.send(bom);
  } catch (error) {
    if (error.message.includes('не найден')) {
      return errorResponse(res, error.message, 404);
    } else if (error.message.includes('лимит')) {
      return errorResponse(res, error.message, 429);
    } else if (error.message.includes('формат')) {
      return errorResponse(res, error.message, 400);
    }
    errorResponse(res, error.message, 500);
  }
});

// ======================
// SCA UPLOAD - ЗАГРУЗКА И РАСПАКОВКА АРХИВА
// ======================
app.post('/api/sca/upload', uploadSCA.single('archive'), async (req, res) => {
    let extractDir = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'NO_FILE',
                message: 'Файл не загружен'
            });
        }
        
        // Создаем директорию для распаковки
        const extractId = uuidv4();
        extractDir = path.join(__dirname, 'temp', 'extracted', extractId);
        
        // Распаковываем архив (передаем originalname)
        await extractArchive(req.file.path, req.file.originalname, extractDir);
        
        // Вызываем анализатор
        const bom = await analyzeRepository(`file://${extractDir}`, req.file.originalname);
        
        // Очистка
        await fs.unlink(req.file.path).catch(() => {});
        
        res.json(bom);
        
    } catch (error) {
        console.error('Ошибка:', error);
        
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        if (extractDir) {
            await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
        }
        
        errorResponse(res, error.message, 500);
    }
});


app.post('/api/fuzz', uploadSpec.single('spec'), async (req, res) => {
    let specFilePath = null;
    let tempFiles = [];
    
    try {
        const { specUrl, baseUrl, timeout = 5000, concurrency = 5 } = req.body;
        
        if (!req.file && !specUrl) {
            return errorResponse(res, 'Необходимо предоставить файл спецификации или URL', 400);
        }
        
        if (!baseUrl) {
            return errorResponse(res, 'Необходимо указать базовый URL API', 400);
        }
        
        await ensureDir(FUZZ_TEMP_DIR);
        
        if (req.file) {
            specFilePath = req.file.path;
            tempFiles.push(specFilePath);
            logger.info(`Получен файл спецификации: ${req.file.originalname}`);
        } else {
            logger.info(`Загрузка спецификации по URL: ${specUrl}`);
            const downloaded = await downloadSpecFromUrl(specUrl);
            specFilePath = downloaded.path;
            tempFiles.push(specFilePath);
        }
        
        const fuzzer = new APIFuzzer(specFilePath, {
            baseUrl: baseUrl,
            timeout: parseInt(timeout),
            concurrency: parseInt(concurrency),
            format: 'auto'
        });
        
        logger.info(`Запуск фаззинг тестирования для ${baseUrl}`);
        const report = await fuzzer.run();

        res.json({
            success: true,
            message: 'Фаззинг тестирование завершено',
            summary: report.summary,
            vulnerabilities: report.vulnerabilities,
            byEndpoint: report.byEndpoint,
            spec: report.spec,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Ошибка фаззинга:', error);
        errorResponse(res, `Ошибка при выполнении фаззинга: ${error.message}`, 500);
    } finally {
        for (const filePath of tempFiles) {
            try {
                await fs.unlink(filePath).catch(() => {});
            } catch (e) {}
        }
    }
});

app.post('/api/sast/url', sastLimiter, async (req, res) => {
    const { url, branch } = req.body;
    
    if (!url) {
        return res.status(400).json({ 
            error: 'URL не указан',
            message: 'Необходимо передать ссылку на репозиторий'
        });
    }

    try {
        const result = await receiver.getFromUrl(url, { branch });
        
        res.json({
            success: true,
            message: 'Архив успешно загружен',
            archive: {
                id: result.id,
                filename: result.filename,
                size: result.size,
                source: result.source,
                url: result.url,
                createdAt: result.createdAt
            }
        });

    } catch (error) {
        console.error('Ошибка:', error.message);
        res.status(500).json({ 
            error: 'Ошибка при загрузке архива',
            message: error.message
        });
    }
});

app.post('/api/sast/upload', uploadArchive.single('archive'), async (req, res) => {
    if (!req.file) {
        console.error('[upload] Файл не загружен');
        return res.status(400).json({ 
            error: 'Файл не загружен',
            message: 'Необходимо выбрать файл для загрузки'
        });
    }

    try {
        
        const result = await receiver.getFromFile(req.file.path, req.file.originalname);
        
        res.json({
            success: true,
            message: 'Файл успешно загружен',
            archive: {
                id: result.id,
                filename: result.filename,
                originalName: result.originalName,
                size: result.size,
                source: result.source,
                createdAt: result.createdAt
            }
        });

    } catch (error) {
        console.error('[upload] Ошибка:', error.message);
        
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        
        res.status(500).json({ 
            error: 'Ошибка при загрузке файла',
            message: error.message
        });
    }
});

app.post('/api/sast/analyze/:archiveId', async (req, res) => {
    const { archiveId } = req.params;

     if (!/^[a-f0-9-]{16}$/.test(archiveId)) {
        return res.status(400).json({ error: 'Invalid archive ID format' });
    }

    const rulesPath = req.body.rulesPath || './modules/sast/rules/all-rules.json';
    
    let archiveInfo = null;
    let extractPath = null;
    let archivePath = null;

    try {
        archiveInfo = await receiver.getInfo(archiveId);
        
        if (!archiveInfo) {
            console.error('[sast] Архив не найден:', archiveId);
            return res.status(404).json({ 
                error: 'Архив не найден',
                message: `Архив с ID ${archiveId} не существует`
            });
        }
        
        archivePath = archiveInfo.path;
        const extractResult = await extractor.extract(archivePath, archiveId);
        extractPath = extractResult.extractPath;
        
        const sastResults = await analyzeCode(extractPath, rulesPath, { verbose: true });
      
        sastResults.metadata = {
            ...sastResults.metadata,
            archiveId,
            archiveName: archiveInfo.filename,
            fileCount: extractResult.fileCount,
            scanTime: new Date().toISOString()
        };

        res.json({
            success: true,
            message: 'SAST анализ успешно завершен',
            results: sastResults
        });

    } catch (error) {
        console.error('[sast] Ошибка:', error);
        res.status(500).json({ 
            error: 'Ошибка при SAST анализе',
            message: error.message,
            details: error.stack
        });
    } finally {
        const cleanupPromises = [];
        
        if (extractPath) {
            cleanupPromises.push(fs.rm(extractPath, { recursive: true, force: true }).catch(err => 
                console.error('Ошибка при удалении распакованных файлов:', err.message)
            ));
        }
        
        if (archivePath) {
            cleanupPromises.push(fs.unlink(archivePath).catch(err => 
                console.error('Ошибка при удалении архива:', err.message)
            ));
        }
        
        if (archiveId) {
            cleanupPromises.push(receiver.delete(archiveId).catch(err => 
                console.error('   ⚠️ Ошибка при удалении метаданных:', err.message)
            ));
        }
        
        await Promise.all(cleanupPromises);
    }
});

app.get('/api/sast/results/:archiveId', async (req, res) => {
    const { archiveId } = req.params;
    
    try {
        const resultsPath = path.join(EXTRACTED_DIR, archiveId, 'sast-results.json');
        const results = await fs.readFile(resultsPath, 'utf-8');
        
        res.json({
            success: true,
            results: JSON.parse(results)
        });
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ 
                error: 'Результаты не найдены',
                message: 'Анализ еще не завершен или не запускался'
            });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.get('/api/archive/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const info = await receiver.getInfo(id);
        
        if (!info) {
            return res.status(404).json({ 
                error: 'Архив не найден',
                message: `Архив с ID ${id} не существует`
            });
        }

        let hasResults = false;
        try {
            await fs.access(path.join(EXTRACTED_DIR, id, 'sast-results.json'));
            hasResults = true;
        } catch {}

        res.json({
            success: true,
            archive: {
                id: info.id,
                filename: info.filename,
                size: info.size,
                source: info.source,
                createdAt: info.createdAt,
                expiresAt: info.expiresAt,
                hasResults
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/archive/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await receiver.delete(id);
        
        const extractPath = path.join(EXTRACTED_DIR, id);
        await fs.rm(extractPath, { recursive: true, force: true }).catch(() => {});
        
        res.json({ 
            success: true, 
            message: `Архив ${id} и результаты удалены` 
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 404 обработчик
app.use((req, res) => {
  res.status(404).sendFile(join(__dirname, 'public', '/html/preview.html'));
});

// Обработчик ошибок
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  errorResponse(res, 'Внутренняя ошибка сервера', 500);
});

// ======================
// Инициализация и запуск
// ======================
async function initialize() {
  try {
    //await ensureDir(UPLOAD_DIR);
    //await ensureDir(DOWNLOAD_DIR);
    //await ensureDir(CACHE_DIR);
    await ensureDir(LOG_DIR);
    await ensureDir(STORAGE_DIR);
    await ensureDir(EXTRACTED_DIR);
    await ensureDir(TEMP_DIR);
    await ensureDir(FUZZ_TEMP_DIR);
    await ensureDir(path.join(__dirname, 'temp', 'sca'));
    await ensureDir(join(__dirname, 'public'));
    
    logger.info('Директории созданы');
    
    await githubDownloader.initialize();
    
    logger.info('Модули инициализированы');
    
    return true;
  } catch (error) {
    logger.error('Ошибка инициализации:', error);
    throw error;
  }
}

// Запуск сервера
async function startServer() {
  try {
    await initialize();
    
    const server = app.listen(PORT, HOST, () => {
      logger.info(`Сервер запущен на порту ${PORT}`);
    });
    
    const shutdown = async (signal) => {
      logger.info(`${signal} получен: завершаем работу сервера`);
      
      server.close(async () => {
        logger.info('HTTP сервер закрыт');
        
        try {
          await githubDownloader.cleanup();
          logger.info('Ресурсы освобождены');
        } catch (error) {
          logger.error('Ошибка при очистке ресурсов:', error);
        }
        
        process.exit(0);
      });
      
      setTimeout(() => {
        logger.error('Принудительное завершение работы');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Не удалось запустить сервер:', error);
    process.exit(1);
  }
}

// Экспортируем app для тестирования
export { app, logger, githubDownloader};

// Запускаем сервер
startServer();