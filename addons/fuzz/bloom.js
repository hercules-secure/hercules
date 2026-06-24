// addons/metla/BrowserFuzzer.js
import puppeteer from 'puppeteer';

function isStatic(url) {
    const urlLower = url.toLowerCase();
    
    if (urlLower.startsWith('data:') || urlLower.startsWith('blob:') || 
        urlLower.startsWith('javascript:') || urlLower.startsWith('about:')) {
        return true;
    }
    
    const staticExts = [
        '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 
        '.woff', '.woff2', '.ttf', '.map', '.txt', '.xml'
    ];
    for (const ext of staticExts) {
        if (urlLower.endsWith(ext)) {
            return true;
        }
    }
    const staticPatterns = [
        'static.', 'cdn.', 'assets.', 'fonts.', 'images.',
        'analytics', 'google-analytics', 'gtag', 'facebook.com/tr',
        'yandex', 'metrika', '.min.css', '.min.js',
        'getstyles', 'frontend', 'wp-content/plugins', 'wp-includes/js', 
        'wp-admin/images', 'advancedcf/assets', 'acf-global', 'acf-input'
    ];
    for (const pattern of staticPatterns) {
        if (urlLower.includes(pattern)) {
            return true;
        }
    }
    return false;
}

function isUsefulMethod(method) {
    const useful = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'];
    return useful.includes(method.toUpperCase());
}

class BrowserFuzzer {
    constructor(options = {}) {
        this.headless = options.headless !== undefined ? options.headless : true;
        this.targetUrl = options.targetUrl || null;
        this.username = options.username || 'test@example.com';
        this.password = options.password || 'test123456';
        this.timeout = options.timeout || 30000;
        this.browser = null;
        this.page = null;
        this.client = null;
        this.sessionId = Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
        
        this.allRequests = [];
        this.uniqueEndpoints = new Map();
        this.authRequests = [];
        this.servers = new Set();
        this.allPostRequests = [];
        this.capturedAuth = null;
        this.foundForms = [];
        this.processedUrls = new Set();
        this.authLinks = [];
        this.formTypes = {
            login: [],
            register: [],
            recover: [],
            change_password: []
        };
        this.loginPageUrl = null;
    }

    async run() {
        console.log('\n========================================');
        console.log('METLA - COLLECT ALL FORMS & FUZZ TARGETS');
        console.log('========================================');
        console.log('Target URL:', this.targetUrl);
        console.log('========================================\n');
        
        this.allRequests = [];
        this.uniqueEndpoints = new Map();
        this.authRequests = [];
        this.servers = new Set();
        this.allPostRequests = [];
        this.capturedAuth = null;
        this.foundForms = [];
        this.processedUrls = new Set();
        this.authLinks = [];
        this.formTypes = {
            login: [],
            register: [],
            recover: [],
            change_password: []
        };
        this.loginPageUrl = this.targetUrl;
        
        try {
            console.log('Launching browser...');
            this.browser = await puppeteer.launch({
                headless: this.headless,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            this.page = await this.browser.newPage();
            
            console.log('Connecting CDP...');
            this.client = await this.page.target().createCDPSession();
            await this.client.send('Network.enable');
            
            let requestCount = 0;
            
            this.client.on('Network.requestWillBeSent', (event) => {
                const reqUrl = event.request.url;
                const method = event.request.method;
                const postData = event.request.postData;
                const headers = event.request.headers;
                requestCount++;
                
                if (isStatic(reqUrl)) {
                    return;
                }
                
                if (!isUsefulMethod(method)) {
                    return;
                }
                
                console.log(`  [${requestCount}] ${method} ${reqUrl}`);
                
                const requestData = {
                    url: reqUrl,
                    method: method,
                    headers: headers,
                    body: postData,
                    timestamp: new Date().toISOString()
                };
                
                this.allRequests.push(requestData);
                
                if (method === 'POST') {
                    this.allPostRequests.push(requestData);
                    if (postData) {
                        console.log(`     POST BODY: ${postData.substring(0, 200)}`);
                    }
                }
                
                const key = method + '|' + reqUrl;
                if (!this.uniqueEndpoints.has(key)) {
                    this.uniqueEndpoints.set(key, {
                        url: reqUrl,
                        method: method,
                        headers: headers,
                        body: postData
                    });
                }
                
                try {
                    const urlObj = new URL(reqUrl);
                    this.servers.add(urlObj.origin);
                } catch (e) {}
                
                if (method === 'POST' && postData) {
                    const dataLower = postData.toLowerCase();
                    const hasLogin = dataLower.includes('login') || 
                                     dataLower.includes('email') || 
                                     dataLower.includes('username') ||
                                     dataLower.includes('log') ||
                                     dataLower.includes('user');
                    const hasPassword = dataLower.includes('password') || 
                                        dataLower.includes('pwd') || 
                                        dataLower.includes('pass');
                    
                    if (hasLogin && hasPassword) {
                        this.authRequests.push(requestData);
                        this.capturedAuth = requestData;
                        console.log(`     AUTH FOUND: ${method} ${reqUrl}`);
                        console.log(`     AUTH BODY: ${postData}`);
                    }
                }
                
                if (method === 'POST' && reqUrl.includes('tildaapi.com')) {
                    console.log(`     TILDA API: ${reqUrl}`);
                    if (postData && (postData.includes('login') || postData.includes('password') || postData.includes('email'))) {
                        this.authRequests.push(requestData);
                        this.capturedAuth = requestData;
                        console.log(`     AUTH FOUND (TILDA): ${reqUrl}`);
                    }
                }
            });
            
            // ===== ЗАГРУЗКА СТРАНИЦЫ =====
            console.log('\nLoading page...');
            await this.page.goto(this.targetUrl, { 
                waitUntil: 'networkidle2', 
                timeout: this.timeout 
            });
            
            const urlObj = new URL(this.targetUrl);
            this.servers.add(urlObj.origin);
            const title = await this.page.title();
            console.log(`Page loaded: "${title}"`);
            
            // ===== ПОИСК И ОБРАБОТКА ФОРМЫ ЛОГИНА (без редиректа) =====
            await this.findAndProcessLoginForm();
            
            // ===== ВОЗВРАЩАЕМСЯ НА СТРАНИЦУ ЛОГИНА, ЕСЛИ УШЛИ =====
            const currentUrl = this.page.url();
            if (currentUrl !== this.targetUrl && !currentUrl.includes('wp-login.php')) {
                console.log(`\nReturning to login page...`);
                await this.page.goto(this.targetUrl, { 
                    waitUntil: 'networkidle2', 
                    timeout: this.timeout 
                });
            }
            
            // ===== ПОИСК ССЫЛОК =====
            console.log('\n========================================');
            console.log('SEARCHING FOR AUTH LINKS');
            console.log('========================================');
            
            this.authLinks = await this.findAuthLinks();
            console.log(`Found ${this.authLinks.length} auth-related links`);
            
            // ===== ПЕРЕХОД ПО ССЫЛКАМ =====
            console.log('\n========================================');
            console.log('VISITING AUTH PAGES');
            console.log('========================================');
            
            for (const link of this.authLinks) {
                await this.visitAndProcessPage(link);
            }
            
            await this.browser.close();
            
            // ===== ВЫВОД =====
            console.log('\n========================================');
            console.log('SCAN COMPLETE - SUMMARY');
            console.log('========================================');
            console.log(`  Pages visited: ${this.processedUrls.size}`);
            console.log(`  Total forms found: ${this.foundForms.length}`);
            console.log(`  Login forms: ${this.formTypes.login.length}`);
            console.log(`  Register forms: ${this.formTypes.register.length}`);
            console.log(`  Recover forms: ${this.formTypes.recover.length}`);
            console.log(`  Change password forms: ${this.formTypes.change_password.length}`);
            console.log(`  Total requests: ${this.allRequests.length}`);
            console.log(`  Auth requests: ${this.authRequests.length}`);
            console.log(`  Servers: ${Array.from(this.servers).join(', ')}`);
            console.log('========================================\n');
            
            console.log('FORMS FOUND:');
            for (const form of this.foundForms) {
                console.log(`  ${form.type}: ${form.url}`);
            }
            console.log('========================================\n');
            
            const targets = this.generateFuzzTargets();
            
            console.log('FUZZ TARGETS:');
            console.log(`  Total targets: ${targets.length}`);
            console.log('========================================\n');
            
            return targets;
            
        } catch (error) {
            console.error('ERROR:', error.message);
            if (this.browser) {
                await this.browser.close();
            }
            throw error;
        }
    }

    // ============================================================
    // ПОИСК И ОБРАБОТКА ФОРМЫ ЛОГИНА (БЕЗ РЕДИРЕКТА)
    // ============================================================
    // addons/metla/BrowserFuzzer.js - обновленный метод findAndProcessLoginForm

async findAndProcessLoginForm() {
    console.log('\n========================================');
    console.log('FINDING LOGIN FORM');
    console.log('========================================');
    
    try {
        // ===== ПОИСК ПОЛЕЙ =====
        const emailField = await this.page.waitForSelector(
            'input[name="USER_LOGIN"], input[name="login"], input[name="log"], input[name="email"], input[type="email"], input[type="text"]', 
            { timeout: 10000 }
        ).catch(() => null);
        
        const passwordField = await this.page.waitForSelector(
            'input[name="USER_PASSWORD"], input[name="password"], input[type="password"], input[name="pwd"]', 
            { timeout: 10000 }
        ).catch(() => null);
        
        if (emailField && passwordField) {
            console.log('Login form found!');
            
            await emailField.click({ clickCount: 3 });
            await emailField.type(this.username);
            await passwordField.click({ clickCount: 3 });
            await passwordField.type(this.password);
            console.log('Credentials entered');
            
            // ===== ПОИСК КНОПКИ =====
            const button = await this.page.waitForSelector(
                'input[type="submit"][name="Login"], input[type="submit"], button[type="submit"], button.tlk-btn, button[data-testid="auth-loginButton"], button[name="wp-submit"], #wp-submit, .button-primary',
                { timeout: 10000 }
            ).catch(() => null);
            
            if (button) {
                // ===== ЖДЕМ ЛЮБОЙ POST ЗАПРОС К TILDA =====
                console.log('  Waiting for any POST request to Tilda...');
                
                const postPromise = this.page.waitForResponse(
                    res => {
                        const method = res.request().method();
                        const url = res.url();
                        return method === 'POST' && (
                            url.includes('tildaapi.com/api') ||
                            url.includes('/api/login') ||
                            url.includes('/api/getcaptcha')
                        );
                    },
                    { timeout: 15000 } // Увеличиваем до 15 секунд
                ).catch(() => null);
                
                await button.click();
                console.log('Login button clicked');
                
                // Ждем все POST запросы
                let response = await postPromise;
                let attempts = 0;
                const maxAttempts = 3;
                
                // Собираем все POST запросы к Tilda
                while (response && attempts < maxAttempts) {
                    const postData = response.request().postData();
                    const url = response.url();
                    console.log(`  POST captured: ${url}`);
                    if (postData) {
                        console.log(`    DATA: ${postData.substring(0, 200)}`);
                    }
                    
                    // Сохраняем запрос
                    const requestData = {
                        url: url,
                        method: 'POST',
                        headers: response.request().headers(),
                        body: postData,
                        timestamp: new Date().toISOString()
                    };
                    
                    this.allRequests.push(requestData);
                    this.allPostRequests.push(requestData);
                    
                    const key = 'POST|' + url;
                    if (!this.uniqueEndpoints.has(key)) {
                        this.uniqueEndpoints.set(key, {
                            url: url,
                            method: 'POST',
                            headers: response.request().headers(),
                            body: postData
                        });
                    }
                    
                    // Проверяем на auth
                    if (postData) {
                        const dataLower = postData.toLowerCase();
                        const hasLogin = dataLower.includes('login') || 
                                         dataLower.includes('email') || 
                                         dataLower.includes('username') ||
                                         dataLower.includes('log') ||
                                         dataLower.includes('user');
                        const hasPassword = dataLower.includes('password') || 
                                            dataLower.includes('pwd') || 
                                            dataLower.includes('pass');
                        
                        if (hasLogin && hasPassword) {
                            this.authRequests.push(requestData);
                            this.capturedAuth = requestData;
                            console.log(`  AUTH FOUND: ${url}`);
                        }
                    }
                    
                    attempts++;
                    // Ждем следующий POST запрос
                    response = await this.page.waitForResponse(
                        res => {
                            const method = res.request().method();
                            const url = res.url();
                            return method === 'POST' && url.includes('tildaapi.com/api');
                        },
                        { timeout: 5000 }
                    ).catch(() => null);
                }
                
                this.foundForms.push({
                    type: 'login',
                    form: { action: this.targetUrl, method: 'post' },
                    url: this.targetUrl
                });
                this.formTypes.login.push({ action: this.targetUrl });
            }
        } else {
            console.log('Login form not found');
        }
        
    } catch (error) {
        console.log(`Login form error: ${error.message}`);
    }
}

    // ============================================================
    // ПОИСК ССЫЛОК
    // ============================================================
    async findAuthLinks() {
        // Перезагружаем страницу, если контекст уничтожен
        try {
            await this.page.evaluate(() => document.title);
        } catch (e) {
            console.log('  Page context destroyed, reloading...');
            await this.page.goto(this.targetUrl, { waitUntil: 'networkidle2' });
        }
        
        const links = await this.page.evaluate(() => {
            const result = [];
            const keywords = [
                'register', 'signup', 'sign-up', 'sign_up', 'регистрация', 'зарегистрироваться',
                'recover', 'reset', 'forgot', 'lostpassword', 'reset-credentials', 'reset_credentials',
                'восстановление', 'восстановить', 'забыли', 'сбросить',
                'забыл пароль', 'забыли пароль', 'восстановить пароль',
                'password reset', 'reset password', 'forgot password',
                'change-password', 'change_password', 'change password', 'смена-пароля', 'смена пароля'
            ];
            
            document.querySelectorAll('a[href]').forEach(el => {
                const href = el.getAttribute('href');
                const text = (el.textContent || '').toLowerCase();
                const hrefLower = (href || '').toLowerCase();
                
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                    for (const kw of keywords) {
                        if (hrefLower.includes(kw) || text.includes(kw)) {
                            result.push({
                                href: href,
                                text: text,
                                keyword: kw
                            });
                            break;
                        }
                    }
                }
            });
            return result;
        });
        
        const absoluteLinks = [];
        const seen = new Set();
        
        for (const link of links) {
            try {
                const fullUrl = new URL(link.href, this.targetUrl).href;
                if (!seen.has(fullUrl) && fullUrl !== this.targetUrl) {
                    seen.add(fullUrl);
                    absoluteLinks.push({
                        url: fullUrl,
                        text: link.text,
                        keyword: link.keyword
                    });
                }
            } catch (e) {}
        }
        
        return absoluteLinks;
    }

    // ============================================================
    // ПЕРЕХОД И ОБРАБОТКА СТРАНИЦЫ
    // ============================================================
    async visitAndProcessPage(link) {
        const url = link.url;
        
        try {
            const urlObj = new URL(url);
            const targetObj = new URL(this.targetUrl);
            
            if (urlObj.hostname !== targetObj.hostname) {
                console.log(`Skip external: ${url}`);
                return;
            }
            
            if (this.processedUrls.has(url)) {
                return;
            }
            
            this.processedUrls.add(url);
            console.log(`\n========================================`);
            console.log(`VISITING: ${url}`);
            console.log(`  (found by: ${link.keyword})`);
            console.log('========================================');
            
            await this.page.goto(url, { 
                waitUntil: 'networkidle2', 
                timeout: 15000 
            });
            
            // ===== ИЩЕМ ФОРМУ НА СТРАНИЦЕ =====
            console.log('  Searching for form...');
            
            const emailField = await this.page.waitForSelector(
                'input[name="USER_LOGIN"], input[name="login"], input[name="log"], input[name="email"], input[type="email"], input[type="text"]', 
                { timeout: 5000 }
            ).catch(() => null);
            
            const passwordField = await this.page.waitForSelector(
                'input[name="USER_PASSWORD"], input[name="password"], input[type="password"], input[name="pwd"]', 
                { timeout: 5000 }
            ).catch(() => null);
            
            let formType = 'unknown';
            const keyword = link.keyword || '';
            
            if (keyword.includes('register') || keyword.includes('регистрац')) {
                formType = 'register';
            } else if (keyword.includes('recover') || keyword.includes('reset') || keyword.includes('forgot') || 
                       keyword.includes('восстанов') || keyword.includes('забыли') || keyword.includes('сброс')) {
                formType = 'recover';
            } else if (keyword.includes('change') || keyword.includes('смен')) {
                formType = 'change_password';
            }
            
            if (emailField && passwordField) {
                console.log(`  Found ${formType} form with fields`);
                
                await emailField.click({ clickCount: 3 });
                await emailField.type(this.username);
                await passwordField.click({ clickCount: 3 });
                await passwordField.type(this.password);
                console.log('  Credentials entered');
                
                const button = await this.page.waitForSelector(
                    'input[type="submit"], button[type="submit"], button.tlk-btn',
                    { timeout: 5000 }
                ).catch(() => null);
                
                if (button) {
                    const postPromise = this.page.waitForResponse(
                        res => {
                            const method = res.request().method();
                            const url = res.url();
                            return method === 'POST' && !isStatic(url);
                        },
                        { timeout: 5000 }
                    ).catch(() => null);
                    
                    await button.click();
                    console.log('  Form submitted');
                    
                    const response = await postPromise;
                    
                    if (response) {
                        const postData = response.request().postData();
                        const url = response.url();
                        console.log(`  POST captured: ${url}`);
                        
                        if (postData) {
                            const requestData = {
                                url: url,
                                method: 'POST',
                                headers: response.request().headers(),
                                body: postData,
                                timestamp: new Date().toISOString()
                            };
                            
                            this.allRequests.push(requestData);
                            this.allPostRequests.push(requestData);
                            
                            const dataLower = postData.toLowerCase();
                            const hasLogin = dataLower.includes('login') || 
                                             dataLower.includes('email') || 
                                             dataLower.includes('username') ||
                                             dataLower.includes('log') ||
                                             dataLower.includes('user');
                            const hasPassword = dataLower.includes('password') || 
                                                dataLower.includes('pwd') || 
                                                dataLower.includes('pass');
                            
                            if (hasLogin && hasPassword) {
                                this.authRequests.push(requestData);
                                this.capturedAuth = requestData;
                                console.log(`  AUTH FOUND: ${url}`);
                            }
                            
                            const key = 'POST|' + url;
                            if (!this.uniqueEndpoints.has(key)) {
                                this.uniqueEndpoints.set(key, {
                                    url: url,
                                    method: 'POST',
                                    headers: response.request().headers(),
                                    body: postData
                                });
                            }
                        }
                    }
                    
                    this.foundForms.push({
                        type: formType,
                        form: { action: url, method: 'post' },
                        url: url
                    });
                    
                    if (this.formTypes[formType]) {
                        this.formTypes[formType].push({ action: url });
                    }
                }
            } else if (emailField && !passwordField) {
                console.log('  Found recover form (email only)');
                
                await emailField.click({ clickCount: 3 });
                await emailField.type(this.username);
                console.log('  Email entered');
                
                const button = await this.page.waitForSelector(
                    'input[type="submit"], button[type="submit"], button.tlk-btn',
                    { timeout: 5000 }
                ).catch(() => null);
                
                if (button) {
                    const postPromise = this.page.waitForResponse(
                        res => {
                            const method = res.request().method();
                            const url = res.url();
                            return method === 'POST' && !isStatic(url);
                        },
                        { timeout: 5000 }
                    ).catch(() => null);
                    
                    await button.click();
                    console.log('  Form submitted');
                    
                    const response = await postPromise;
                    
                    if (response) {
                        const postData = response.request().postData();
                        const url = response.url();
                        console.log(`  POST captured: ${url}`);
                        
                        if (postData) {
                            const requestData = {
                                url: url,
                                method: 'POST',
                                headers: response.request().headers(),
                                body: postData,
                                timestamp: new Date().toISOString()
                            };
                            
                            this.allRequests.push(requestData);
                            this.allPostRequests.push(requestData);
                            
                            const key = 'POST|' + url;
                            if (!this.uniqueEndpoints.has(key)) {
                                this.uniqueEndpoints.set(key, {
                                    url: url,
                                    method: 'POST',
                                    headers: response.request().headers(),
                                    body: postData
                                });
                            }
                        }
                    }
                    
                    this.foundForms.push({
                        type: 'recover',
                        form: { action: url, method: 'post' },
                        url: url
                    });
                    this.formTypes.recover.push({ action: url });
                }
            } else {
                console.log('  No form found on this page');
            }
            
            // ВОЗВРАЩАЕМСЯ НА СТРАНИЦУ ЛОГИНА
            console.log('  Returning to login page...');
            await this.page.goto(this.targetUrl, { 
                waitUntil: 'networkidle2', 
                timeout: this.timeout 
            });
            await new Promise(r => setTimeout(r, 1000));
            
        } catch (error) {
            console.log(`  Error: ${error.message}`);
            // Пробуем вернуться
            try {
                await this.page.goto(this.targetUrl, { waitUntil: 'networkidle2' });
            } catch (e) {}
        }
    }

    // ============================================================
    // ГЕНЕРАЦИЯ ЦЕЛЕЙ
    // ============================================================
    generateFuzzTargets() {
        const targets = [];
        const garbagePatterns = [
            '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 
            '.woff', '.woff2', '.ttf', '.map', '.txt', '.xml',
            'wp-content/plugins', 'wp-includes/js', 'wp-admin/images',
            'advancedcf/assets', 'acf-global', 'acf-input'
        ];
        
        for (const [key, endpoint] of this.uniqueEndpoints) {
            try {
                const urlLower = endpoint.url.toLowerCase();
                let isGarbage = false;
                for (const pattern of garbagePatterns) {
                    if (urlLower.includes(pattern)) {
                        isGarbage = true;
                        break;
                    }
                }
                if (isGarbage) {
                    continue;
                }
                
                const urlObj = new URL(endpoint.url);
                const path = urlObj.pathname;
                const method = endpoint.method.toLowerCase();
                
                let bodySchema = null;
                let contentType = 'application/x-www-form-urlencoded';
                
                if (endpoint.body) {
                    try {
                        const json = JSON.parse(endpoint.body);
                        bodySchema = {
                            type: 'json',
                            fields: Object.keys(json).reduce((acc, key) => {
                                acc[key] = {
                                    type: typeof json[key] === 'string' ? 'string' : 'object',
                                    example: json[key]
                                };
                                return acc;
                            }, {})
                        };
                        contentType = 'application/json';
                    } catch (e) {
                        if (endpoint.body.includes('=')) {
                            const params = new URLSearchParams(endpoint.body);
                            bodySchema = {
                                type: 'form',
                                fields: {}
                            };
                            for (const [name, value] of params) {
                                bodySchema.fields[name] = {
                                    type: 'string',
                                    example: value
                                };
                            }
                            contentType = 'application/x-www-form-urlencoded';
                        } else {
                            bodySchema = {
                                type: 'raw',
                                value: endpoint.body
                            };
                        }
                    }
                }
                
                const target = {
                    id: key,
                    url: endpoint.url,
                    path: path,
                    method: method,
                    headers: endpoint.headers || {},
                    contentType: contentType,
                    body: endpoint.body || null,
                    bodySchema: bodySchema,
                    isAuth: this.authRequests.some(r => r.url === endpoint.url),
                    server: new URL(endpoint.url).origin
                };
                
                targets.push(target);
                
            } catch (e) {
                console.log('Error adding target:', e.message);
            }
        }
        
        return targets;
    }
}

export default BrowserFuzzer;