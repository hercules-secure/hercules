
// Вспомогательная функция для нормализации URL
function normalizeUrl(baseUrl, path) {
    let normalizedBase = baseUrl.replace(/\/+$/, '');
    let normalizedPath = path.replace(/^\/+/, '');
    return `${normalizedBase}/${normalizedPath}`;
}

// Функция проверки одного URL
async function checkUrl(url, timeout = 3000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, { 
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)' }
        });
        clearTimeout(timeoutId);
        return { url, status: response.status, success: response.status >= 200 && response.status < 400 };
    } catch (error) {
        clearTimeout(timeoutId);
        return { url, status: null, success: false };
    }
}

// Параллельная проверка нескольких URL
async function checkUrlsParallel(urls, concurrency = 15, timeout = 3000) {
    const results = [];
    const chunks = [];
    
    for (let i = 0; i < urls.length; i += concurrency) {
        chunks.push(urls.slice(i, i + concurrency));
    }
    
    for (const chunk of chunks) {
        const chunkResults = await Promise.all(
            chunk.map(url => checkUrl(url, timeout))
        );
        results.push(...chunkResults);
    }
    
    return results;
}

export async function scanAPIEndpoints(baseUrl) {
    const endpoints = [
        '/swagger', '/swagger.json', '/swagger-ui', '/swagger-ui.html',
        '/api-docs', '/api-docs.json', '/v2/api-docs', '/v3/api-docs',
        '/openapi', '/openapi.json', '/openapi.yaml', '/openapi.yml',
        '/docs', '/api', '/graphql', '/graphiql', '/redoc', '/rapidoc'
    ];
    
    const urls = endpoints.map(endpoint => normalizeUrl(baseUrl, endpoint));
    const results = await checkUrlsParallel(urls, 10, 3000);
    
    const findings = [];
    for (let i = 0; i < endpoints.length; i++) {
        const result = results[i];
        if (result.success && result.status >= 200 && result.status < 300) {
            findings.push({
                severity: 'high',
                message: `Найден API endpoint: ${endpoints[i]}`,
                location: result.url,
                status: result.status,
                remediation: 'Ограничьте доступ к API документации (аутентификация, IP белый список)'
            });
        }
    }
    
    return { issues: findings, found: findings.length };
}

export async function bruteForceDirectories(baseUrl) {
    const commonPaths = [
        { path: '.env', risk: 'critical', description: 'Файл окружения с секретами' },
        { path: '.git/config', risk: 'critical', description: 'Git конфигурация' },
        { path: 'backup', risk: 'critical', description: 'Резервные копии' },
        { path: 'backups', risk: 'critical', description: 'Резервные копии' },
        { path: 'phpmyadmin', risk: 'critical', description: 'Управление БД' },
        { path: 'shell', risk: 'critical', description: 'Web shell' },
        { path: 'cmd', risk: 'critical', description: 'Command execution' },
        { path: 'admin', risk: 'critical', description: 'Панель администратора' },
        { path: 'administrator', risk: 'critical', description: 'Панель администратора' },
        { path: 'wp-admin', risk: 'critical', description: 'WordPress админка' },
        { path: 'api', risk: 'high', description: 'API endpoint' },
        { path: 'graphql', risk: 'high', description: 'GraphQL endpoint' },
        { path: 'swagger', risk: 'high', description: 'Swagger документация' },
        { path: 'config', risk: 'high', description: 'Конфигурационные файлы' },
        { path: 'phpinfo', risk: 'high', description: 'Информация о PHP' },
        { path: 'debug', risk: 'high', description: 'Debug режим' },
        { path: 'test', risk: 'high', description: 'Тестовые страницы' },
        { path: 'login', risk: 'medium', description: 'Страница входа' },
        { path: 'signin', risk: 'medium', description: 'Страница входа' },
        { path: 'auth', risk: 'medium', description: 'Авторизация' },
        { path: 'oauth', risk: 'medium', description: 'OAuth endpoint' },
        { path: 'docs', risk: 'medium', description: 'Документация' },
        { path: 'robots.txt', risk: 'low', description: 'Robots.txt файл' },
        { path: 'sitemap.xml', risk: 'low', description: 'Sitemap файл' },
        { path: 'crossdomain.xml', risk: 'low', description: 'Crossdomain политика' }
    ];
    
    const urls = commonPaths.map(item => normalizeUrl(baseUrl, item.path));
    const results = await checkUrlsParallel(urls, 15, 3000);
    
    const findings = [];
    const foundPaths = [];
    
    for (let i = 0; i < commonPaths.length; i++) {
        const item = commonPaths[i];
        const result = results[i];
        
        if (result.success && result.status >= 200 && result.status < 400) {
            findings.push({
                severity: item.risk,
                message: `Найден путь: /${item.path}`,
                location: result.url,
                status: result.status,
                description: item.description,
                remediation: `Проверьте, нужно ли ограничить доступ к /${item.path}`
            });
            
            foundPaths.push({ 
                path: `/${item.path}`, 
                status: result.status, 
                risk: item.risk,
                description: item.description
            });
        }
    }
    
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    foundPaths.sort((a, b) => severityOrder[a.risk] - severityOrder[b.risk]);
    
    // Возвращаем ТОЛЬКО найденные пути, без словарей
    return { 
        issues: findings, 
        found: foundPaths
    };
}

export async function scanSQLInjection(baseUrl) {
    return { 
        issues: [{
            severity: 'info',
            message: 'Для проверки SQL инъекций требуется активное тестирование форм',
            remediation: 'Используйте специализированные инструменты (sqlmap)'
        }]
    };
}

export async function scanXSSInjection(baseUrl) {
    return { 
        issues: [{
            severity: 'info',
            message: 'Для проверки XSS требуется активное тестирование форм',
            remediation: 'Проверьте ввод пользователя и экранирование вывода'
        }]
    };
}

export default {
    scanAPIEndpoints,
    bruteForceDirectories,
    scanSQLInjection,
    scanXSSInjection
};