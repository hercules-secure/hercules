class GraphQLFuzzer {
    constructor(endpoint, options = {}) {
        this.endpoint = endpoint;
        this.headers = options.headers || {};
        this.timeout = options.timeout || 5000;
        this.concurrency = options.concurrency || 3;
        this.results = [];
        
        // Интроспекционные данные
        this.schema = null;
        this.types = new Map();
        this.queries = [];
        this.mutations = [];
    }

    // ========== ИНТРОСПЕКЦИЯ ==========
    async introspect() {
        const introspectionQuery = `
            query IntrospectionQuery {
                __schema {
                    types {
                        name
                        kind
                        description
                        fields {
                            name
                            type {
                                name
                                kind
                                ofType {
                                    name
                                    kind
                                }
                            }
                        }
                        inputFields {
                            name
                            type {
                                name
                                kind
                                ofType {
                                    name
                                    kind
                                }
                            }
                        }
                    }
                    queryType {
                        name
                        fields {
                            name
                            args {
                                name
                                type {
                                    name
                                    kind
                                    ofType {
                                        name
                                        kind
                                    }
                                }
                            }
                        }
                    }
                    mutationType {
                        name
                        fields {
                            name
                            args {
                                name
                                type {
                                    name
                                    kind
                                    ofType {
                                        name
                                        kind
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;

        try {
            const response = await this.send(introspectionQuery);
            this.schema = response.data.__schema;
            this.parseSchema();
            console.log(`[✓] Интроспекция завершена. Найдено: ${this.queries.length} queries, ${this.mutations.length} mutations`);
            return true;
        } catch (error) {
            console.error('[✗] Интроспекция не удалась:', error.message);
            return false;
        }
    }

    parseSchema() {
        // Парсим типы
        for (const type of this.schema.types) {
            if (!type.name.startsWith('__')) {
                this.types.set(type.name, type);
            }
        }

        // Парсим Query поля
        if (this.schema.queryType?.fields) {
            for (const field of this.schema.queryType.fields) {
                this.queries.push({
                    name: field.name,
                    args: field.args || []
                });
            }
        }

        // Парсим Mutation поля
        if (this.schema.mutationType?.fields) {
            for (const field of this.schema.mutationType.fields) {
                this.mutations.push({
                    name: field.name,
                    args: field.args || []
                });
            }
        }
    }

    // ========== ГЕНЕРАЦИЯ ФАЗЗ-ДАННЫХ ==========
    generateFuzzValue(type) {
        const fuzzPatterns = {
            String: [
                '',                                    // Пустая строка
                'a'.repeat(10000),                    // Очень длинная строка
                '\x00\x01\x02\x03',                   // Null bytes
                'DROP TABLE users; --',                // SQL Injection
                '<script>alert(1)</script>',           // XSS
                '../../../../etc/passwd',              // Path Traversal
                '${7*7}',                              // Template Injection
                '{"__proto__": {"evil": true}}',       // Prototype Pollution
                '᠎',                                   // Zero-width chars
                '🎉' + 'a'.repeat(1000) + '🎉',        // Emoji + long string
                'null',
                'undefined',
                'NaN',
                'Infinity',
                '{"key": "value"}',                    // JSON injection
                'file:///etc/passwd',
                '\\\\localhost\\\\share'
            ],
            Int: [
                0, -1, 1,
                2147483647,                           // MAX INT
                -2147483648,                          // MIN INT
                99999999999999999999,                  // Overflow
                NaN,
                Infinity,
                -Infinity,
                1.5,                                   // Float вместо Int
                'string_instead_of_int'
            ],
            Float: [
                0, -1, 1,
                1.7976931348623157e+308,              // MAX
                -1.7976931348623157e+308,             // MIN
                1e-324,                               // MIN POSITIVE
                NaN,
                Infinity,
                -Infinity,
                'not_a_number'
            ],
            Boolean: [true, false, null, 'true', 'false', 1, 0, 'yes', 'no'],
            ID: [
                '',
                '1',
                '99999999999999999999',
                'null',
                'undefined',
                '../../etc/passwd',
                '<script>alert(1)</script>'
            ],
            Enum: [null, 'INVALID_VALUE', '', '___'],
            List: [
                [],
                [null],
                [''],
                [1, 'two', true],
                Array(100).fill('x')
            ]
        };

        const typeName = this.extractTypeName(type);
        
        if (typeName === 'String') return this.randomItem(fuzzPatterns.String);
        if (typeName === 'Int') return this.randomItem(fuzzPatterns.Int);
        if (typeName === 'Float') return this.randomItem(fuzzPatterns.Float);
        if (typeName === 'Boolean') return this.randomItem(fuzzPatterns.Boolean);
        if (typeName === 'ID') return this.randomItem(fuzzPatterns.ID);
        if (type.kind === 'LIST') return this.generateListValue(type.ofType);
        if (type.kind === 'INPUT_OBJECT') return this.generateInputObject(type);
        
        return null;
    }

    generateListValue(itemType) {
        const size = Math.floor(Math.random() * 10);
        const list = [];
        for (let i = 0; i < size; i++) {
            list.push(this.generateFuzzValue(itemType));
        }
        return list;
    }

    generateInputObject(inputType) {
        const typeDef = this.types.get(inputType.name);
        if (!typeDef || !typeDef.inputFields) return {};
        
        const obj = {};
        for (const field of typeDef.inputFields) {
            if (Math.random() > 0.3) { // 70% полей заполняем
                obj[field.name] = this.generateFuzzValue(field.type);
            }
        }
        return obj;
    }

    extractTypeName(type) {
        if (type.ofType) return this.extractTypeName(type.ofType);
        return type.name;
    }

    randomItem(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ========== ГЕНЕРАЦИЯ ЗАПРОСОВ ==========
    buildQuery(field, args = null) {
        let argsStr = '';
        
        if (args) {
            const argsList = [];
            for (const [key, value] of Object.entries(args)) {
                argsList.push(`${key}: ${JSON.stringify(value)}`);
            }
            argsStr = `(${argsList.join(', ')})`;
        } else if (field.args && field.args.length > 0) {
            // Генерируем аргументы если не переданы
            const generatedArgs = {};
            for (const arg of field.args) {
                generatedArgs[arg.name] = this.generateFuzzValue(arg.type);
            }
            argsStr = `(${Object.entries(generatedArgs).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})`;
        }
        
        return `{ ${field.name}${argsStr} { ...fragment } }`;
    }

    async fuzzQuery(field) {
        const query = `
            query FuzzTest {
                ${field.name} {
                    __typename
                }
            }
        `;
        
        return this.sendWithRetry(query);
    }

    async fuzzQueryWithArgs(field) {
        const results = [];
        
        // Генерируем разные комбинации аргументов
        for (let i = 0; i < 20; i++) {
            const args = {};
            for (const arg of field.args) {
                args[arg.name] = this.generateFuzzValue(arg.type);
            }
            
            const query = `
                query FuzzTest {
                    ${field.name}(${Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}) {
                        __typename
                    }
                }
            `;
            
            const result = await this.sendWithRetry(query);
            results.push({
                field: field.name,
                args,
                result
            });
        }
        
        return results;
    }

    // ========== ПРОВЕРКА УЯЗВИМОСТЕЙ ==========
    detectVulnerabilities(response, query, field) {
        const vulnerabilities = [];
        
        // 1. Проверка на ошибки в ответе
        if (response.errors) {
            for (const error of response.errors) {
                if (error.message?.includes('stack trace') || error.message?.includes('at ')) {
                    vulnerabilities.push({
                        type: 'STACK_TRACE_EXPOSURE',
                        severity: 'HIGH',
                        field,
                        message: error.message,
                        description: 'Стек трейд утек в ответ'
                    });
                }
                
                if (error.message?.includes('SQL') || error.message?.includes('syntax')) {
                    vulnerabilities.push({
                        type: 'SQL_ERROR_EXPOSURE',
                        severity: 'MEDIUM',
                        field,
                        message: error.message,
                        description: 'SQL ошибка раскрывает структуру БД'
                    });
                }
            }
        }
        
        // 2. Проверка на медленные запросы (DoS)
        if (response.responseTime && response.responseTime > 3000) {
            vulnerabilities.push({
                type: 'SLOW_QUERY_DOS',
                severity: 'MEDIUM',
                field,
                responseTime: response.responseTime,
                description: 'Запрос выполняется более 3 секунд'
            });
        }
        
        // 3. Проверка на большие ответы
        const responseSize = JSON.stringify(response).length;
        if (responseSize > 1024 * 1024) { // > 1MB
            vulnerabilities.push({
                type: 'LARGE_RESPONSE_DOS',
                severity: 'LOW',
                field,
                size: responseSize,
                description: 'Ответ превышает 1MB'
            });
        }
        
        // 4. Проверка на раскрытие внутренних данных
        const responseStr = JSON.stringify(response);
        if (responseStr.includes('password') || responseStr.includes('token') || responseStr.includes('secret')) {
            vulnerabilities.push({
                type: 'SENSITIVE_DATA_EXPOSURE',
                severity: 'CRITICAL',
                field,
                description: 'Возможное раскрытие чувствительных данных'
            });
        }
        
        // 5. Проверка на GraphQL специфичные атаки
        if (query.includes('__typename') && !response.errors && response.data) {
            vulnerabilities.push({
                type: 'INFO_DISCLOSURE',
                severity: 'LOW',
                field,
                description: 'Типы GraphQL раскрыты'
            });
        }
        
        return vulnerabilities;
    }

    // ========== АТАКИ SPESIFIC ==========
    async aliasAttack() {
        // Атака с множественными алиасами (DoS)
        const aliases = [];
        for (let i = 0; i < 100; i++) {
            aliases.push(`a${i}: __typename`);
        }
        
        const query = `{ ${aliases.join(' ')} }`;
        return this.sendWithRetry(query);
    }
    
    async depthAttack(maxDepth = 50) {
        // Рекурсивный запрос большой глубины
        let deepQuery = 'field';
        for (let i = 0; i < maxDepth; i++) {
            deepQuery = `field { ${deepQuery} }`;
        }
        
        const query = `{ ${deepQuery} }`;
        return this.sendWithRetry(query);
    }
    
    async batchAttack(batchSize = 100) {
        // Batch запрос с множеством операций
        const operations = [];
        for (let i = 0; i < batchSize; i++) {
            operations.push(`q${i}: __typename`);
        }
        
        const query = `{ ${operations.join(' ')} }`;
        return this.sendWithRetry(query);
    }
    
    async circularFragmentAttack() {
        // Циклические фрагменты
        const fragments = `
            fragment A on Query { ...B }
            fragment B on Query { ...A }
            { __typename ...A }
        `;
        return this.sendWithRetry(fragments);
    }

    // ========== ОТПРАВКА ЗАПРОСОВ ==========
    async send(query) {
        const startTime = Date.now();
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.headers
                },
                body: JSON.stringify({ query }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const data = await response.json();
            const responseTime = Date.now() - startTime;
            
            return {
                status: response.status,
                statusText: response.statusText,
                data,
                responseTime,
                headers: Object.fromEntries(response.headers)
            };
        } catch (error) {
            clearTimeout(timeoutId);
            return {
                status: 0,
                statusText: error.name === 'AbortError' ? 'Timeout' : error.message,
                data: null,
                responseTime: Date.now() - startTime,
                error: error.message
            };
        }
    }
    
    async sendWithRetry(query, maxRetries = 2) {
        for (let i = 0; i < maxRetries; i++) {
            const result = await this.send(query);
            if (result.status !== 0 && result.status < 500) {
                return result;
            }
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
        return await this.send(query);
    }

    // ========== ОСНОВНОЙ ЗАПУСК ==========
    async run() {
        console.log('\n🔍 НАЧАЛО ФАЗЗИНГА GRAPHQL API');
        console.log(`📍 Endpoint: ${this.endpoint}\n`);
        
        // Шаг 1: Интроспекция
        const introspected = await this.introspect();
        if (!introspected) {
            console.log('\n⚠️  Интроспекция отключена. Использую базовые тесты...\n');
            return this.runBasicTests();
        }
        
        const allFields = [...this.queries, ...this.mutations];
        console.log(`\n📊 Найдено полей: ${allFields.length}\n`);
        
        // Шаг 2: Фаззинг каждого поля
        for (const field of allFields) {
            console.log(`\n🎯 Тестирование: ${field.name} (args: ${field.args.length})`);
            
            // Тест без аргументов
            const basicResult = await this.fuzzQuery(field);
            const vulns = this.detectVulnerabilities(basicResult, `{ ${field.name} }`, field.name);
            
            if (vulns.length) {
                console.log(`   ⚠️  Найдено ${vulns.length} проблем:`);
                vulns.forEach(v => console.log(`      - [${v.severity}] ${v.type}: ${v.description}`));
                this.results.push(...vulns);
            } else if (basicResult.status === 200) {
                console.log(`   ✓ Базовый запрос успешен`);
            } else {
                console.log(`   ✗ Базовый запрос: ${basicResult.statusText}`);
            }
            
            // Тест с аргументами
            if (field.args.length > 0) {
                const argResults = await this.fuzzQueryWithArgs(field);
                for (const argResult of argResults) {
                    const argVulns = this.detectVulnerabilities(argResult.result, 
                        `{ ${field.name}(${JSON.stringify(argResult.args)}) }`, 
                        field.name);
                    this.results.push(...argVulns);
                }
                console.log(`   ✓ Протестировано ${argResults.length} вариаций аргументов`);
            }
            
            // Небольшая задержка между запросами
            await new Promise(r => setTimeout(r, 100));
        }
        
        // Шаг 3: Специфичные атаки
        console.log('\n🚀 ЗАПУСК СПЕЦИФИЧНЫХ АТАК\n');
        
        const attacks = [
            { name: 'Alias Attack (DoS)', fn: () => this.aliasAttack() },
            { name: 'Depth Attack', fn: () => this.depthAttack(100) },
            { name: 'Batch Attack', fn: () => this.batchAttack(200) },
            { name: 'Circular Fragment Attack', fn: () => this.circularFragmentAttack() }
        ];
        
        for (const attack of attacks) {
            console.log(`🎯 ${attack.name}...`);
            const result = await attack.fn();
            
            if (result.responseTime > 10000) {
                this.results.push({
                    type: attack.name.toUpperCase().replace(/ /g, '_'),
                    severity: 'HIGH',
                    description: `Атака вызвала задержку ${result.responseTime}ms`,
                    responseTime: result.responseTime
                });
                console.log(`   ⚠️  Критическая задержка: ${result.responseTime}ms`);
            } else if (result.status === 0 || result.status >= 500) {
                console.log(`   ⚠️  Сервер упал/ошибка: ${result.statusText}`);
                this.results.push({
                    type: attack.name.toUpperCase().replace(/ /g, '_'),
                    severity: 'CRITICAL',
                    description: `Атака вызвала ошибку сервера: ${result.statusText}`
                });
            } else {
                console.log(`   ✓ Завершено (${result.responseTime}ms)`);
            }
            
            await new Promise(r => setTimeout(r, 500));
        }
        
        // Шаг 4: Отчет
        this.printReport();
        
        return this.results;
    }
    
    async runBasicTests() {
        // Базовые тесты без интроспекции
        const testQueries = [
            '{ __typename }',
            '{ __schema { types { name } } }',
            'query { __typename }',
            'mutation { __typename }',
            '{ nonexistentField }',
            '{ "invalid": "query" }',
            '{ field: __typename }',
            '{ ...fragment } fragment f on Query { __typename }'
        ];
        
        for (const query of testQueries) {
            console.log(`\n🎯 Тест: ${query.substring(0, 50)}...`);
            const result = await this.send(query);
            const vulns = this.detectVulnerabilities(result, query, 'basic_test');
            this.results.push(...vulns);
            
            if (result.status === 200) {
                console.log(`   ✓ Успешно (${result.responseTime}ms)`);
            } else {
                console.log(`   ✗ Ошибка: ${result.statusText}`);
            }
            
            await new Promise(r => setTimeout(r, 500));
        }
        
        this.printReport();
        return this.results;
    }
    
    printReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ОТЧЕТ О ФАЗЗИНГЕ');
        console.log('='.repeat(60));
        
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
            this.results.forEach((r, i) => {
                console.log(`\n${i + 1}. [${r.severity}] ${r.type}`);
                console.log(`   ${r.description}`);
                if (r.field) console.log(`   Field: ${r.field}`);
                if (r.responseTime) console.log(`   Response time: ${r.responseTime}ms`);
            });
        } else {
            console.log('\n✅ Уязвимостей не обнаружено');
        }
        
        console.log('\n' + '='.repeat(60));
    }
}

// ========== ПРИМЕР ИСПОЛЬЗОВАНИЯ ==========
async function main() {
    const fuzzer = new GraphQLFuzzer('https://your-graphql-endpoint.com/graphql', {
        headers: {
            'Authorization': 'Bearer your-token'
        },
        timeout: 10000,
        concurrency: 5
    });
    
    const vulnerabilities = await fuzzer.run();
    
    // Экспорт результатов
    console.log('\n💾 Экспорт результатов:');
    console.log(JSON.stringify(vulnerabilities, null, 2));
}

// Запуск (раскомментировать для использования)
// main();

/* intergration
const fuzzer = new GraphQLFuzzer('https://api.example.com/graphql', {
    headers: { 'Authorization': 'Bearer token' },
    timeout: 10000
});
const results = await fuzzer.run();
*/