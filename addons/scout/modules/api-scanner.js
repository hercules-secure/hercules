// api-scanner.js - полная версия с фильтрацией статики
import puppeteer from 'puppeteer';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const DEBUG = true;

// ========== ФИЛЬТРАЦИЯ СТАТИЧЕСКИХ РЕСУРСОВ ==========
const STATIC_EXTENSIONS = [
    '.css', '.scss', '.sass', '.less',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp3', '.mp4', '.webm', '.ogg',
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
    '.map', '.js', '.min.js'
];

const EXCLUDE_WORDS = [
    'jquery', 'swiper', 'flatpickr', 'select2', 'nouislider', 'tippy', 'popper',
    'fancybox', 'lazyload', 'lazy-load', 'magnific-popup',
    'metrika', 'analytics', 'gtag', 'counter', 'pixel', 'tracker',
    'webbankirCrossId', 'webbankirSmartBanner', 'webbankirSiteReferer',
    'wp-content/plugins', 'wp-content/themes', 'wp-includes',
    'assets-6.12.0', 'openapi', 'uxfeedback', 'jivosite', 'jivo',
    'widget.js', 'bundle.js', 'chunk', 'vendor', 'runtime',
    'google', 'yandex', 'vk.com', 'mail.ru', 'facebook', 'appmetrica'
];

function isStaticResource(url) {
    const urlLower = url.toLowerCase();
    
    for (const ext of STATIC_EXTENSIONS) {
        if (urlLower.endsWith(ext)) return true;
    }
    
    for (const word of EXCLUDE_WORDS) {
        if (urlLower.includes(word)) return true;
    }
    
    return false;
}

// ========== ПРОВЕРКА НА API ==========
function isApiUrl(url, method) {
    const urlLower = url.toLowerCase();
    
    // Сначала отфильтровываем статику
    if (isStaticResource(urlLower)) return false;
    
    // API индикаторы
    const apiIndicators = [
        '/api/', '/rest/', '/rpc', '/graphql', '/gql', '/grpc',
        '/jsonrpc', '/xmlrpc', '/soap',
        '/v1/', '/v2/', '/v3/', '/v4/', '/v5/',
        '/v1.0/', '/v2.0/', '/1.0/', '/2.0/',
        '/wp-json/', '/admin-ajax.php',
        '/_next/data/', '__data.json'
    ];
    
    for (const indicator of apiIndicators) {
        if (urlLower.includes(indicator)) return true;
    }
    
    // Не-GET запросы
    if (method !== 'GET') return true;
    
    // Паттерны API путей
    const apiPatterns = [
        /\/[a-z0-9]+\.(json|xml)$/i,
        /\/(auth|login|logout|register|signin|signup|user|users|profile|account|session)/i,
        /\/(payment|order|billing|cart|checkout|invoice)/i,
        /\/(lead|form|application|request|callback)/i,
        /\/(calculator|credit|loan|money|finance|bank)/i
    ];
    
    for (const pattern of apiPatterns) {
        if (pattern.test(urlLower)) return true;
    }
    
    return false;
}

// ========== ЗАГРУЗКА JS ФАЙЛОВ ==========
function fetchJsContent(url) {
    return new Promise((resolve) => {
        try {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const req = protocol.request({
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname,
                method: 'GET',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 10000,
                rejectUnauthorized: false
            }, (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ success: true, content: data }));
            });
            req.on('error', () => resolve({ success: false, content: '' }));
            req.on('timeout', () => { req.destroy(); resolve({ success: false, content: '' }); });
            req.end();
        } catch(e) {
            resolve({ success: false, content: '' });
        }
    });
}

// ========== ПОИСК API В JS КОДЕ ==========
function findApiInJs(content, sourceUrl, baseHost) {
    const found = new Map();
    
    const patterns = [
        /fetch\s*\(\s*["'`]([^"']+)["'`]/gi,
        /fetch\s*\(\s*`([^`]+)`/gi,
        /axios\.(get|post|put|delete|patch)\s*\(\s*["'`]([^"']+)["'`]/gi,
        /[a-z]\.[A-Z]\.(post|get|put|delete)\s*\(\s*["'`]([^"']+)["'`]/gi,
        /\.(post|get|put|delete)\s*\(\s*["'`]([^"']+)["'`]/gi,
        /["'`](\/(?:api|rest|rpc|v\d)[a-zA-Z0-9\/\-_.?&=]+)["'`]/gi,
        /["'`](https?:\/\/[^"']+\/(?:api|rest|rpc|v\d)[a-zA-Z0-9\/\-_.?&=]+)["'`]/gi
    ];
    
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            let apiPath = match[2] || match[1];
            if (!apiPath || apiPath.length < 5) continue;
            
            apiPath = apiPath.replace(/^['"`]|['"`]$/g, '');
            
            // Пропускаем статику
            if (isStaticResource(apiPath)) continue;
            if (apiPath.includes('.css') || apiPath.includes('.js')) continue;
            
            // Пропускаем шаблонные строки
            if (apiPath.includes('${')) continue;
            
            let fullUrl = apiPath;
            if (apiPath.startsWith('/')) {
                fullUrl = `https://${baseHost}${apiPath}`;
            } else if (!apiPath.startsWith('http')) {
                fullUrl = `https://${baseHost}/${apiPath}`;
            }
            
            fullUrl = fullUrl.split('?')[0].split('#')[0];
            
            if (fullUrl && fullUrl.length > 10 && fullUrl.length < 300) {
                const method = match[1]?.toUpperCase() === 'POST' ? 'POST' : 
                              match[1]?.toUpperCase() === 'PUT' ? 'PUT' :
                              match[1]?.toUpperCase() === 'DELETE' ? 'DELETE' : 'GET';
                const key = `${method}|${fullUrl}`;
                
                if (!found.has(key)) {
                    found.set(key, {
                        url: fullUrl,
                        method: method,
                        source: sourceUrl.split('/').pop(),
                        type: 'js_string'
                    });
                }
            }
        }
    }
    
    return Array.from(found.values());
}

// ========== ОСНОВНАЯ ФУНКЦИЯ СКАНЕРА ==========
export async function scanApiFromJS(targetUrl) {
   
    const results = {
        apiEndpoints: [],
        htmlLinks: [],
        jsFilesAnalyzed: [],
        totalEndpointsFound: 0,
        totalLinksFound: 0,
        issues: []
    };
    
    let browser = null;
    const allApiEndpoints = new Map();
    const jsFilesSet = new Set();
    
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Перехват запросов
        await page.setRequestInterception(true);
        
        page.on('request', (request) => {
            const url = request.url();
            const method = request.method();
            const resourceType = request.resourceType();
            
            // Сохраняем JS файлы для анализа
            if (resourceType === 'script' && url.includes('.js')) {
                const cleanUrl = url.split('?')[0];
                if (!isStaticResource(cleanUrl)) {
                    jsFilesSet.add(cleanUrl);
                }
                request.continue();
                return;
            }
            
            // Проверяем на API
            if (isApiUrl(url, method)) {
                const cleanUrl = url.split('?')[0].split('#')[0];
                const key = `${method}|${cleanUrl}`;
                if (!allApiEndpoints.has(key)) {
                    allApiEndpoints.set(key, {
                        url: cleanUrl,
                        method: method,
                        source: 'network',
                        type: 'api'
                    });
            
                }
            }
            
            request.continue();
        });
        

        await page.goto(targetUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Прокрутка страницы
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Собираем ссылки из DOM
        const links = await page.evaluate(() => {
            const anchors = document.querySelectorAll('a[href]');
            const results = [];
            anchors.forEach(a => {
                const href = a.getAttribute('href');
                if (href && href.length > 1 && href.length < 500 && 
                    !href.startsWith('#') && !href.startsWith('javascript:')) {
                    results.push({ url: href, text: a.innerText?.slice(0, 50) || '' });
                }
            });
            return results;
        });
        
        const baseUrl = new URL(targetUrl);
        for (const link of links) {
            let fullUrl;
            if (link.url.startsWith('/')) {
                fullUrl = `${baseUrl.protocol}//${baseUrl.host}${link.url}`;
            } else if (link.url.startsWith('http')) {
                fullUrl = link.url;
            } else {
                fullUrl = new URL(link.url, targetUrl).href;
            }
            
            results.htmlLinks.push({
                url: fullUrl,
                path: link.url,
                text: link.text
            });
        }
        results.totalLinksFound = results.htmlLinks.length;

        
        // Анализ JS файлов
        const jsFiles = Array.from(jsFilesSet);

        
        const baseHost = baseUrl.host;
        
        for (let i = 0; i < Math.min(jsFiles.length, 50); i++) {
            const jsUrl = jsFiles[i];

            
            const jsContent = await fetchJsContent(jsUrl);
            if (jsContent.success && jsContent.content) {
                const apiFromJs = findApiInJs(jsContent.content, jsUrl, baseHost);
                for (const api of apiFromJs) {
                    const key = `${api.method}|${api.url}`;
                    if (!allApiEndpoints.has(key)) {
                        allApiEndpoints.set(key, api);

                    }
                }
                results.jsFilesAnalyzed.push(jsUrl);
            }
        }
        
        // Формируем финальный результат
        for (const [key, api] of allApiEndpoints) {
            // Финальная фильтрация перед добавлением
            if (isStaticResource(api.url)) continue;
            if (api.url.includes('.css') || api.url.includes('.js')) continue;
            if (api.url.includes('webbankirCrossId')) continue;
            if (api.url.includes('webbankirSmartBanner')) continue;
            if (api.url.includes('webbankirSiteReferer')) continue;
            
            results.apiEndpoints.push(api);
        }
        
        results.totalEndpointsFound = results.apiEndpoints.length;

        
        if (results.totalEndpointsFound > 0) {

            const uniqueUrls = new Set();
            for (const api of results.apiEndpoints) {
                if (!uniqueUrls.has(api.url)) {
                    uniqueUrls.add(api.url);

                }
            }
        } else {

        }
        
    } catch (error) {
  
        results.issues.push({ severity: 'error', message: error.message });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    return results;
}

export default { scanApiFromJS };