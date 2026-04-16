// grpc-fuzzer.js
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class GRPCFuzzer {
    constructor(target, options = {}) {
        this.target = target;
        this.client = null;
        this.protoPath = options.protoPath;
        this.packageName = options.packageName;
        this.serviceName = options.serviceName;
        this.metadata = options.metadata || {};
        this.timeout = options.timeout || 5000;
        this.deadline = options.deadline || 10000;
        this.maxMessageSize = options.maxMessageSize || 10 * 1024 * 1024;
        this.results = [];
        this.methods = [];
        this.services = new Map();
        this.protoRoot = null;
        
        // Фаззинг паттерны (синхронные)
        this.fuzzPatterns = {
            strings: [
                '',                                      // Пустая строка
                'A'.repeat(10000),                      // Очень длинная
                'A'.repeat(100 * 1024),                 // 100KB строка
                '\x00\x01\x02\x03\x04\x05',              // Null bytes
                'DROP TABLE users; --',                  // SQL Injection
                '<script>alert(1)</script>',             // XSS
                '../../../../etc/passwd',                // Path Traversal
                '${7*7}',                                // Template Injection
                '{{7*7}}',                               // Template Injection (Jinja)
                '\x1b[31mRED\x1b[0m',                   // ANSI escape codes
                'null',
                'undefined',
                'NaN',
                'Infinity',
                '-Infinity',
                '{"__proto__": {"polluted": true}}',     // Prototype Pollution
                'constructor.prototype.polluted=true',
                '__proto__.polluted=true',
                'process.env.PATH',
                'require("child_process").exec("id")',
                'file:///etc/passwd',
                '\\\\localhost\\\\share\\file',
                '😀'.repeat(1000),                       // Эмодзи
                'नमस्ते'.repeat(100),                    // Unicode
                'ｱｲｳｴｵ'.repeat(200),                     // Half-width katakana
                '𐐷' + 'a'.repeat(5000),                  // Supplementary plane
                String.fromCharCode(0x1F600, 0x1F601),  // Surrogate pairs
                '\u0000\u0001\u0002\u0003',             // Control chars
                '\r\n', '\t\n\r', '\n\n\n',
                '%00', '%0a', '%0d', '%25', '%2e%2e%2f',
                '`id`', '$(id)', '; id', '| id', '|| id',
                '<img src=x onerror=alert(1)>',
                'javascript:alert(1)',
                'data:text/html,<script>alert(1)</script>'
            ],
            ints: [
                0, -1, 1,
                2147483647,        // MAX INT32
                -2147483648,       // MIN INT32
                4294967295,        // MAX UINT32
                9223372036854775807,  // MAX INT64
                -9223372036854775808, // MIN INT64
                18446744073709551615, // MAX UINT64
                9999999999999999999,
                -9999999999999999999,
                NaN,
                Infinity,
                -Infinity,
                1.5, 2.7, 3.14,
                1e308, -1e308,
                1e-324,
                '123', '0xFF', '0b1010', '0o777',
                'not_a_number',
                null,
                undefined
            ],
            floats: [
                0, -1, 1,
                3.4028234663852886e+38,   // MAX FLOAT
                -3.4028234663852886e+38,  // MIN FLOAT
                1.1754943508222875e-38,   // MIN POSITIVE FLOAT
                1.7976931348623157e+308,  // MAX DOUBLE
                -1.7976931348623157e+308, // MIN DOUBLE
                5e-324,                   // MIN POSITIVE DOUBLE
                NaN,
                Infinity,
                -Infinity,
                1.5, 0.1, 0.3333333333,
                '3.14', '0.5', 'not_a_float',
                null
            ],
            bools: [true, false, null, undefined, 1, 0, 'true', 'false', 'yes', 'no', ''],
            bytes: [], // Заполняется синхронно в конструкторе
            enums: [] // Заполняется из proto
        };
        
        // Синхронное заполнение bytes
        this.initBytesPatterns();
        
        // Уязвимости для детектирования
        this.vulnerabilitySignatures = {
            stackTrace: [/stack trace/i, /at [A-Za-z0-9_.]+ \(/i, /Error:\s+\n\s+at/i],
            sqlError: [/sql/i, /mysql/i, /postgres/i, /ora-[0-9]{5}/i, /syntax error/i],
            pathTraversal: [/\.\.\/\.\.\//i, /etc\/passwd/i, /windows\\win\.ini/i],
            commandInjection: [/exec\(/i, /eval\(/i, /child_process/i, /system\(/i],
            memoryIssue: [/out of memory/i, /memory limit/i, /heap/i],
            timeout: [/deadline exceeded/i, /timeout/i, /context deadline/i],
            internalError: [/internal server error/i, /500/i, /panic/i],
            nullPointer: [/null pointer/i, /nil pointer/i, /undefined/i],
            typeMismatch: [/cannot unmarshal/i, /type mismatch/i, /invalid type/i]
        };
    }

    // Синхронная инициализация паттернов для bytes
    initBytesPatterns() {
        // Создание больших буферов синхронно
        const createLargeBuffer = (size, fillChar = 0x41) => {
            return Buffer.alloc(size, fillChar);
        };
        
        this.fuzzPatterns.bytes = [
            Buffer.from(''),
            Buffer.from([0x00, 0x01, 0x02, 0x03]),
            Buffer.from('A'.repeat(10000)),
            Buffer.from([0xFF, 0xFE, 0xFD, 0xFC]),
            Buffer.from('DROP TABLE users; --'),
            Buffer.from('<script>alert(1)</script>'),
            Buffer.from('../../../../etc/passwd'),
            Buffer.from([0x00] * 1024 * 1024), // 1MB нулей
            Buffer.from('{"__proto__": {"polluted": true}}'),
            createLargeBuffer(5 * 1024 * 1024), // 5MB буфер
            createLargeBuffer(10 * 1024 * 1024), // 10MB буфер
            createLargeBuffer(1024, 0x42) // 1KB буфер из 'B'
        ];
    }

    // ========== ЗАГРУЗКА PROTO ФАЙЛОВ ==========
    async loadProto(protoPath) {
        try {
            const packageDefinition = await protoLoader.load(protoPath, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
                includeDirs: [dirname(protoPath)]
            });
            
            this.protoRoot = grpc.loadPackageDefinition(packageDefinition);
            
            // Навигация по пакетам
            let current = this.protoRoot;
            if (this.packageName) {
                const parts = this.packageName.split('.');
                for (const part of parts) {
                    current = current[part];
                    if (!current) throw new Error(`Package ${this.packageName} not found`);
                }
            }
            
            // Получение сервиса
            if (this.serviceName) {
                this.client = new current[this.serviceName](this.target, 
                    grpc.credentials.createInsecure(),
                    {
                        'grpc.max_receive_message_length': this.maxMessageSize,
                        'grpc.max_send_message_length': this.maxMessageSize
                    }
                );
                this.extractMethods(this.client);
            } else {
                // Автоматически находим первый сервис
                for (const [name, service] of Object.entries(current)) {
                    if (typeof service === 'function' && service.service) {
                        this.serviceName = name;
                        this.client = new service(this.target, grpc.credentials.createInsecure());
                        this.extractMethods(this.client);
                        break;
                    }
                }
            }
            
            console.log(`✓ Proto загружен: ${protoPath}`);
            console.log(`✓ Сервис: ${this.serviceName}`);
            console.log(`✓ Найдено методов: ${this.methods.length}`);
            
            return true;
        } catch (error) {
            console.error(`✗ Ошибка загрузки proto: ${error.message}`);
            return false;
        }
    }

    extractMethods(client) {
        const proto = Object.getPrototypeOf(client);
        const methodNames = Object.getOwnPropertyNames(proto)
            .filter(name => name !== 'constructor' && typeof client[name] === 'function');
        
        for (const name of methodNames) {
            this.methods.push({
                name: name,
                type: this.detectMethodType(name),
                fuzzed: 0,
                errors: 0,
                vulnerabilities: []
            });
        }
    }

    detectMethodType(methodName) {
        if (methodName.startsWith('unary')) return 'unary';
        if (methodName.startsWith('clientStream')) return 'clientStream';
        if (methodName.startsWith('serverStream')) return 'serverStream';
        if (methodName.startsWith('bidi')) return 'bidiStream';
        return 'unary';
    }

    // ========== ГЕНЕРАЦИЯ ФАЗЗ-ДАННЫХ ДЛЯ ТИПОВ ==========
    generateFuzzForType(type, depth = 0) {
        if (depth > 5) return null;
        
        switch (type) {
            case 'string':
                return this.randomItem(this.fuzzPatterns.strings);
            case 'int32':
            case 'sint32':
            case 'sfixed32':
                return this.randomItem(this.fuzzPatterns.ints);
            case 'int64':
            case 'sint64':
            case 'sfixed64':
                return this.randomItem(this.fuzzPatterns.ints);
            case 'uint32':
            case 'fixed32':
                const val = this.randomItem(this.fuzzPatterns.ints);
                return typeof val === 'number' ? Math.abs(val) : val;
            case 'uint64':
            case 'fixed64':
                const val64 = this.randomItem(this.fuzzPatterns.ints);
                return typeof val64 === 'number' ? Math.abs(val64) : val64;
            case 'float':
            case 'double':
                return this.randomItem(this.fuzzPatterns.floats);
            case 'bool':
                return this.randomItem(this.fuzzPatterns.bools);
            case 'bytes':
                return this.randomItem(this.fuzzPatterns.bytes);
            case 'enum':
                return this.randomItem(this.fuzzPatterns.enums);
            default:
                return this.generateNestedMessage(type, depth);
        }
    }

    generateNestedMessage(messageType, depth) {
        const result = {};
        
        const messageFields = this.getMessageFields(messageType);
        
        if (messageFields) {
            for (const [fieldName, fieldType] of Object.entries(messageFields)) {
                if (Math.random() > 0.3) {
                    result[fieldName] = this.generateFuzzForType(fieldType, depth + 1);
                }
            }
        }
        
        return result;
    }

    getMessageFields(messageType) {
        return {
            'id': 'string',
            'name': 'string',
            'value': 'int32',
            'active': 'bool',
            'data': 'bytes',
            'count': 'int64'
        };
    }

    randomItem(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ========== ОТПРАВКА ЗАПРОСОВ ==========
    async callUnary(method, request) {
        return new Promise((resolve, reject) => {
            const deadline = new Date();
            deadline.setSeconds(deadline.getSeconds() + this.deadline / 1000);
            
            const metadata = new grpc.Metadata();
            for (const [key, value] of Object.entries(this.metadata)) {
                metadata.add(key, value);
            }
            
            const timer = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, this.timeout);
            
            this.client[method.name](request, metadata, { deadline }, (error, response) => {
                clearTimeout(timer);
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    async callClientStream(method, requests) {
        return new Promise((resolve, reject) => {
            const deadline = new Date();
            deadline.setSeconds(deadline.getSeconds() + this.deadline / 1000);
            
            const metadata = new grpc.Metadata();
            for (const [key, value] of Object.entries(this.metadata)) {
                metadata.add(key, value);
            }
            
            const call = this.client[method.name](metadata, { deadline }, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
            
            for (const req of requests) {
                call.write(req);
            }
            call.end();
        });
    }

    async callServerStream(method, request) {
        return new Promise((resolve, reject) => {
            const deadline = new Date();
            deadline.setSeconds(deadline.getSeconds() + this.deadline / 1000);
            
            const metadata = new grpc.Metadata();
            for (const [key, value] of Object.entries(this.metadata)) {
                metadata.add(key, value);
            }
            
            const call = this.client[method.name](request, metadata, { deadline });
            const responses = [];
            
            call.on('data', (data) => {
                responses.push(data);
            });
            
            call.on('end', () => {
                resolve(responses);
            });
            
            call.on('error', (error) => {
                reject(error);
            });
        });
    }

    async callBidiStream(method, requests) {
        return new Promise((resolve, reject) => {
            const deadline = new Date();
            deadline.setSeconds(deadline.getSeconds() + this.deadline / 1000);
            
            const metadata = new grpc.Metadata();
            for (const [key, value] of Object.entries(this.metadata)) {
                metadata.add(key, value);
            }
            
            const call = this.client[method.name](metadata, { deadline });
            const responses = [];
            
            call.on('data', (data) => {
                responses.push(data);
            });
            
            call.on('end', () => {
                resolve(responses);
            });
            
            call.on('error', (error) => {
                reject(error);
            });
            
            for (const req of requests) {
                call.write(req);
            }
            call.end();
        });
    }

    // ========== ДЕТЕКЦИЯ УЯЗВИМОСТЕЙ ==========
    detectVulnerabilities(error, response, methodName, request) {
        const vulnerabilities = [];
        const errorStr = error ? error.message : '';
        const responseStr = response ? JSON.stringify(response) : '';
        const combined = (errorStr + responseStr).toLowerCase();
        
        for (const [vulnType, patterns] of Object.entries(this.vulnerabilitySignatures)) {
            for (const pattern of patterns) {
                if (pattern.test(combined)) {
                    vulnerabilities.push({
                        type: vulnType,
                        severity: this.getSeverity(vulnType),
                        method: methodName,
                        request: JSON.stringify(request).substring(0, 200),
                        error: errorStr.substring(0, 500),
                        response: responseStr.substring(0, 500),
                        timestamp: new Date().toISOString()
                    });
                    break;
                }
            }
        }
        
        if (error) {
            if (error.code === grpc.status.DEADLINE_EXCEEDED) {
                vulnerabilities.push({
                    type: 'TIMEOUT',
                    severity: 'MEDIUM',
                    method: methodName,
                    description: 'Запрос превысил deadline',
                    error: error.message
                });
            }
            
            if (error.code === grpc.status.RESOURCE_EXHAUSTED) {
                vulnerabilities.push({
                    type: 'RESOURCE_EXHAUSTION',
                    severity: 'HIGH',
                    method: methodName,
                    description: 'Исчерпание ресурсов',
                    error: error.message
                });
            }
            
            if (error.code === grpc.status.INTERNAL) {
                vulnerabilities.push({
                    type: 'INTERNAL_ERROR',
                    severity: 'MEDIUM',
                    method: methodName,
                    description: 'Внутренняя ошибка сервера',
                    error: error.message
                });
            }
        }
        
        return vulnerabilities;
    }

    getSeverity(vulnType) {
        const severities = {
            stackTrace: 'HIGH',
            sqlError: 'CRITICAL',
            pathTraversal: 'HIGH',
            commandInjection: 'CRITICAL',
            memoryIssue: 'HIGH',
            timeout: 'LOW',
            internalError: 'MEDIUM',
            nullPointer: 'MEDIUM',
            typeMismatch: 'LOW'
        };
        return severities[vulnType] || 'MEDIUM';
    }

    // ========== ФАЗЗИНГ МЕТОДА ==========
    async fuzzMethod(method, iterations = 50) {
        console.log(`\n🎯 Фаззинг: ${method.name} (${method.type})`);
        
        for (let i = 0; i < iterations; i++) {
            const request = this.generateFuzzForType('message');
            const startTime = Date.now();
            
            try {
                let response;
                
                switch (method.type) {
                    case 'unary':
                        response = await this.callUnary(method, request);
                        break;
                    case 'clientStream':
                        const requests = Array(10).fill().map(() => this.generateFuzzForType('message'));
                        response = await this.callClientStream(method, requests);
                        break;
                    case 'serverStream':
                        response = await this.callServerStream(method, request);
                        break;
                    case 'bidiStream':
                        const bidiRequests = Array(5).fill().map(() => this.generateFuzzForType('message'));
                        response = await this.callBidiStream(method, bidiRequests);
                        break;
                }
                
                const duration = Date.now() - startTime;
                method.fuzzed++;
                
                if (duration > 3000) {
                    console.log(`   ⚠️ Медленный ответ: ${duration}ms (итерация ${i + 1})`);
                }
                
            } catch (error) {
                method.errors++;
                const vulnerabilities = this.detectVulnerabilities(error, null, method.name, request);
                
                if (vulnerabilities.length > 0) {
                    method.vulnerabilities.push(...vulnerabilities);
                    this.results.push(...vulnerabilities);
                    
                    for (const vuln of vulnerabilities) {
                        console.log(`   🔴 [${vuln.severity}] ${vuln.type}: ${vuln.description || vuln.error?.substring(0, 100)}`);
                    }
                } else if (error.code !== grpc.status.INVALID_ARGUMENT) {
                    console.log(`   ⚠️ Ошибка: ${error.code} - ${error.message.substring(0, 100)}`);
                }
            }
            
            await new Promise(r => setTimeout(r, 100));
        }
        
        console.log(`   📊 Результаты: успешно=${method.fuzzed}, ошибок=${method.errors}, уязвимостей=${method.vulnerabilities.length}`);
    }

    // ========== ТЕСТЫ НА НАГРУЗКУ ==========
    async loadTest(method, concurrency = 10, iterationsPerClient = 10) {
        console.log(`\n🚀 Нагрузочное тестирование: ${method.name}`);
        console.log(`   Конкурентность: ${concurrency}, запросов на клиент: ${iterationsPerClient}`);
        
        const promises = [];
        const startTime = Date.now();
        
        for (let i = 0; i < concurrency; i++) {
            promises.push(this.runLoadTestClient(method, iterationsPerClient));
        }
        
        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;
        const totalRequests = concurrency * iterationsPerClient;
        const successful = results.reduce((sum, r) => sum + r.successful, 0);
        const failed = results.reduce((sum, r) => sum + r.failed, 0);
        
        console.log(`   📊 Результаты нагрузочного теста:`);
        console.log(`      Всего запросов: ${totalRequests}`);
        console.log(`      Успешно: ${successful}`);
        console.log(`      Ошибок: ${failed}`);
        console.log(`      Общее время: ${totalTime}ms`);
        console.log(`      RPS: ${(totalRequests / (totalTime / 1000)).toFixed(2)}`);
        
        if (failed > totalRequests * 0.1) {
            this.results.push({
                type: 'LOAD_TEST_FAILURE',
                severity: 'HIGH',
                method: method.name,
                description: `Высокий процент ошибок при нагрузке: ${(failed/totalRequests*100).toFixed(1)}%`
            });
        }
    }

    async runLoadTestClient(method, iterations) {
        let successful = 0;
        let failed = 0;
        
        for (let i = 0; i < iterations; i++) {
            const request = this.generateFuzzForType('message');
            
            try {
                await this.callUnary(method, request);
                successful++;
            } catch (error) {
                failed++;
            }
        }
        
        return { successful, failed };
    }

    // ========== ОСНОВНОЙ ЗАПУСК ==========
    async run() {
        console.log('\n🔍 НАЧАЛО ФАЗЗИНГА GRPC API');
        console.log(`📍 Target: ${this.target}`);
        console.log(`📦 Package: ${this.packageName || 'auto'}`);
        console.log(`🔧 Service: ${this.serviceName || 'auto'}\n`);
        
        if (this.protoPath) {
            const loaded = await this.loadProto(this.protoPath);
            if (!loaded) {
                console.error('Не удалось загрузить proto файл');
                return this.results;
            }
        } else {
            console.warn('⚠️ Proto файл не указан, фаззинг без структуры данных будет ограничен');
        }
        
        for (const method of this.methods) {
            await this.fuzzMethod(method, 30);
            
            if (method.errors > 10) {
                await this.loadTest(method, 5, 20);
            }
        }
        
        this.printReport();
        
        return this.results;
    }

    printReport() {
        console.log('\n' + '='.repeat(70));
        console.log('📊 ОТЧЕТ О ФАЗЗИНГЕ GRPC');
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
                if (v.description) console.log(`   Описание: ${v.description}`);
                if (v.error) console.log(`   Ошибка: ${v.error.substring(0, 200)}`);
            });
        } else {
            console.log('\n✅ Уязвимостей не обнаружено');
        }
        
        console.log('\n' + '='.repeat(70));
    }

    // ========== ЭКСПОРТ РЕЗУЛЬТАТОВ ==========
    exportResults(format = 'json') {
        const report = {
            target: this.target,
            timestamp: new Date().toISOString(),
            totalMethods: this.methods.length,
            totalVulnerabilities: this.results.length,
            vulnerabilities: this.results,
            methods: this.methods.map(m => ({
                name: m.name,
                type: m.type,
                fuzzed: m.fuzzed,
                errors: m.errors,
                vulnerabilitiesCount: m.vulnerabilities.length
            }))
        };
        
        if (format === 'json') {
            return JSON.stringify(report, null, 2);
        } else if (format === 'csv') {
            const headers = ['type', 'severity', 'method', 'description', 'timestamp'];
            const rows = this.results.map(r => 
                [r.type, r.severity, r.method, r.description || '', r.timestamp].map(cell => `"${cell}"`).join(',')
            );
            return [headers.join(','), ...rows].join('\n');
        }
        
        return report;
    }
}

// ========== ПРИМЕР ИСПОЛЬЗОВАНИЯ ==========
export async function main() {
    const fuzzer = new GRPCFuzzer('localhost:50051', {
        protoPath: './proto/service.proto',
        packageName: 'com.example.api',
        serviceName: 'UserService',
        metadata: {
            'authorization': 'Bearer test-token',
            'x-request-id': 'fuzz-test'
        },
        timeout: 5000,
        deadline: 10000,
        maxMessageSize: 50 * 1024 * 1024
    });
    
    const results = await fuzzer.run();
    
    await writeFile('./grpc-fuzzer-report.json', fuzzer.exportResults('json'));
    await writeFile('./grpc-fuzzer-report.csv', fuzzer.exportResults('csv'));
    
    console.log('\n💾 Отчеты сохранены:');
    console.log('   - grpc-fuzzer-report.json');
    console.log('   - grpc-fuzzer-report.csv');
}

// Запуск (раскомментировать для использования)
// main();
/*
import { GRPCFuzzer, main } from './grpc-fuzzer.js';

// Базовое использование
const fuzzer = new GRPCFuzzer('localhost:50051', {
    protoPath: './api.proto',
    packageName: 'myapp',
    serviceName: 'MyService',
    metadata: { 'authorization': 'Bearer token' },
    timeout: 5000
});

await fuzzer.run();
*/