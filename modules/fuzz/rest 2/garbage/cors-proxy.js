// cors-proxy-server.js
// Запуск: node cors-proxy-server.js

import express from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import { URL } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;

// ============= КОНФИГУРАЦИЯ =============
const CONFIG = {
    timeout: 15000,
    maxBodySize: '10mb',
    userAgent: 'Mozilla/5.0 (compatible; CORS-Proxy/1.0)'
};

// ============= МИДЛВАРЫ =============

// CORS заголовки
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: '*',
    exposedHeaders: '*',
    credentials: true
}));

// Парсинг тела запроса
app.use(express.json({ limit: CONFIG.maxBodySize }));
app.use(express.text({ limit: CONFIG.maxBodySize }));
app.use(express.urlencoded({ extended: true, limit: CONFIG.maxBodySize }));

// ============= ГЛАВНАЯ СТРАНИЦА =============

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>CORS Proxy Server</title>
            <meta charset="utf-8">
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    max-width: 900px; 
                    margin: 40px auto; 
                    padding: 0 20px;
                    line-height: 1.6;
                    color: #333;
                }
                h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
                .card {
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                    border-left: 5px solid #3498db;
                }
                code { 
                    background: #e9ecef; 
                    padding: 3px 8px; 
                    border-radius: 5px;
                    font-family: 'Courier New', monospace;
                    font-size: 0.9em;
                }
                .url-box {
                    background: #fff;
                    border: 1px solid #dee2e6;
                    padding: 15px;
                    border-radius: 5px;
                    word-break: break-all;
                }
                .btn {
                    display: inline-block;
                    background: #3498db;
                    color: white;
                    padding: 10px 20px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 5px;
                }
                .btn:hover { background: #2980b9; }
            </style>
        </head>
        <body>
            <h1>🔄 CORS Proxy Server</h1>
            <p>Сервер успешно запущен на порту ${PORT} без использования устаревших API</p>
            
            <div class="card">
                <h3>📌 Использование:</h3>
                <p><strong>GET запрос через query параметр:</strong><br>
                <code>/proxy?url=https://example.com</code></p>
                
                <p><strong>POST запрос с данными:</strong><br>
                <code>POST /proxy?url=https://example.com/api</code><br>
                <small>Тело запроса будет передано в целевой URL</small></p>
            </div>
            
            <div class="card">
                <h3>🔗 Примеры для tedo.ru:</h3>
                <div class="url-box">
                    <p><strong>robots.txt:</strong><br>
                    <a href="/proxy?url=https://tedo.ru/robots.txt" target="_blank">
                        /proxy?url=https://tedo.ru/robots.txt
                    </a></p>
                    
                    <p><strong>sitemap.xml:</strong><br>
                    <a href="/proxy?url=https://tedo.ru/sitemap.xml" target="_blank">
                        /proxy?url=https://tedo.ru/sitemap.xml
                    </a></p>
                </div>
                <p>
                    <a href="/proxy?url=https://tedo.ru/robots.txt" class="btn" target="_blank">📄 robots.txt</a>
                    <a href="/proxy?url=https://tedo.ru/sitemap.xml" class="btn" target="_blank">🗺️ sitemap.xml</a>
                </p>
            </div>
            
            <div class="card">
                <h3>📊 Проверка сервера:</h3>
                <p><a href="/health" target="_blank">/health</a> - состояние сервера</p>
                <p><a href="/stats" target="_blank">/stats</a> - статистика запросов</p>
            </div>
            
            <p style="color: #27ae60; font-weight: bold;">✅ Сервер работает без deprecated API</p>
        </body>
        </html>
    `);
});

// ============= СТАТИСТИКА =============
const stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    startTime: Date.now(),
    requests: []
};

// ============= ОСНОВНАЯ ПРОКСИ ФУНКЦИЯ =============

/**
 * Функция для проксирования HTTP/HTTPS запросов без использования устаревших API
 */
function proxyRequest(targetUrl, method, headers, body, res) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new URL(targetUrl);
            
            // Определяем протокол
            const httpModule = parsedUrl.protocol === 'https:' ? https : http;
            
            // Подготавливаем заголовки
            const requestHeaders = Object.assign({}, headers, {
                'Host': parsedUrl.host,
                'User-Agent': CONFIG.userAgent,
                'Accept': headers['accept'] || '*/*',
                'Accept-Encoding': 'gzip, deflate, br'
            });
            
            // Удаляем заголовки, которые могут вызвать проблемы
            delete requestHeaders['origin'];
            delete requestHeaders['referer'];
            delete requestHeaders['host'];
            
            // Настройки запроса
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: method,
                headers: requestHeaders,
                timeout: CONFIG.timeout
            };
            
            // Создаем запрос
            const proxyReq = httpModule.request(options, (proxyRes) => {
                let data = [];
                
                proxyRes.on('data', (chunk) => {
                    data.push(chunk);
                });
                
                proxyRes.on('end', () => {
                    const buffer = Buffer.concat(data);
                    
                    // Копируем заголовки ответа
                    const responseHeaders = Object.assign({}, proxyRes.headers);
                    
                    // Добавляем CORS заголовки
                    responseHeaders['Access-Control-Allow-Origin'] = '*';
                    responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
                    responseHeaders['Access-Control-Allow-Headers'] = '*';
                    responseHeaders['Access-Control-Expose-Headers'] = '*';
                    
                    // Удаляем проблемные заголовки
                    delete responseHeaders['content-security-policy'];
                    delete responseHeaders['x-frame-options'];
                    
                    res.writeHead(proxyRes.statusCode, responseHeaders);
                    res.end(buffer);
                    
                    console.log(`← Ответ: ${proxyRes.statusCode} (${buffer.length} bytes)`);
                    resolve();
                });
            });
            
            proxyReq.on('error', (error) => {
                console.error('Proxy request error:', error.message);
                reject(error);
            });
            
            proxyReq.on('timeout', () => {
                proxyReq.destroy();
                reject(new Error('Request timeout'));
            });
            
            // Отправляем тело запроса, если есть
            if (body) {
                proxyReq.write(body);
            }
            
            proxyReq.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

// ============= ПРОКСИ ЭНДПОИНТ =============

app.all('/proxy', async (req, res) => {
    stats.totalRequests++;
    
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        stats.failedRequests++;
        return res.status(400).json({
            error: 'Missing url parameter',
            example: '/proxy?url=https://example.com'
        });
    }
    
    try {
        const decodedUrl = decodeURIComponent(targetUrl);
        
        // Проверяем валидность URL
        new URL(decodedUrl);
        
        // Получаем тело запроса в зависимости от типа контента
        let body = null;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            if (req.is('json')) {
                body = JSON.stringify(req.body);
            } else if (req.is('text')) {
                body = req.body;
            } else {
                body = req.body;
            }
        }
        
        // Проксируем запрос
        await proxyRequest(
            decodedUrl,
            req.method,
            req.headers,
            body,
            res
        );
        
        stats.successfulRequests++;
        
        // Сохраняем в историю (последние 10 запросов)
        stats.requests.unshift({
            url: decodedUrl,
            method: req.method,
            time: new Date().toISOString()
        });
        if (stats.requests.length > 10) stats.requests.pop();
        
    } catch (error) {
        stats.failedRequests++;
        console.error('Ошибка прокси:', error);
        
        res.status(500).json({
            error: 'Proxy error',
            message: error.message,
            url: targetUrl
        });
    }
});

// ============= ПРОВЕРКА ЗДОРОВЬЯ =============

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
    });
});

// ============= СТАТИСТИКА =============

app.get('/stats', (req, res) => {
    res.json({
        ...stats,
        uptime: Date.now() - stats.startTime,
        uptimeHuman: formatUptime(Date.now() - stats.startTime),
        timestamp: new Date().toISOString(),
        recentRequests: stats.requests
    });
});

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

// ============= ОБРАБОТКА OPTIONS =============

app.options('/proxy', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Max-Age', '86400');
    res.sendStatus(204);
});

// ============= ОБРАБОТКА 404 =============

app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'Используйте /proxy?url=URL для проксирования запросов'
    });
});

// ============= ОБРАБОТКА ОШИБОК =============

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Server error',
        message: err.message
    });
});

// ============= ЗАПУСК СЕРВЕРА =============

try {
    const server = app.listen(PORT, () => {
        console.log('\n' + '⭐'.repeat(30));
        console.log('✅ CORS PROXY SERVER ЗАПУЩЕН');
        console.log('⭐'.repeat(30));
        console.log(`📍 Порт: ${PORT}`);
        console.log(`📍 URL: http://localhost:${PORT}`);
        console.log(`📍 Node.js: ${process.version}`);
        console.log(`📍 Режим: ${process.env.NODE_ENV || 'development'}`);
        console.log('\n📌 Примеры запросов:');
        console.log(`   http://localhost:${PORT}/proxy?url=https://tedo.ru/robots.txt`);
        console.log(`   http://localhost:${PORT}/proxy?url=https://tedo.ru/sitemap.xml`);
        console.log('\n📊 Статистика:');
        console.log(`   http://localhost:${PORT}/health`);
        console.log(`   http://localhost:${PORT}/stats`);
        console.log('⭐'.repeat(30) + '\n');
    });

    // Обработка сигналов завершения
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server));

} catch (error) {
    console.error('❌ Ошибка при запуске сервера:');
    console.error(error);
    process.exit(1);
}

function gracefulShutdown(signal, server) {
    console.log(`\n🛑 Получен сигнал ${signal}, закрываем сервер...`);
    server.close(() => {
        console.log('✅ Сервер остановлен');
        process.exit(0);
    });
    
    // Принудительное закрытие через 5 секунд
    setTimeout(() => {
        console.error('⚠️ Принудительное завершение');
        process.exit(1);
    }, 5000);
}