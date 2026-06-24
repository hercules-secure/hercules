// addons/metla/apiCollector.js
import BrowserFuzzer from './BrowserFuzzer.js';
import fs from 'fs/promises';
import path from 'path';

class APICollector {
    constructor(options = {}) {
        this.targetUrl = options.targetUrl;
        this.username = options.username || 'test@example.com';
        this.password = options.password || 'test123456';
        this.headless = options.headless !== undefined ? options.headless : true;
        this.outputDir = options.outputDir || './temp/collected';
        this.browserFuzzer = null;
        this.collectedTargets = [];
    }

    // ============================================================
    // ЗАПУСК СБОРА
    // ============================================================
    async run() {
        console.log('\n========================================');
        console.log('API COLLECTOR - COLLECT ALL ENDPOINTS');
        console.log('========================================');
        console.log(`Target URL: ${this.targetUrl}`);
        console.log('========================================\n');

        // 1. Запускаем Метлу для сбора целей
        this.browserFuzzer = new BrowserFuzzer({
            targetUrl: this.targetUrl,
            username: this.username,
            password: this.password,
            headless: this.headless
        });

        const targets = await this.browserFuzzer.run();
        this.collectedTargets = targets;

        console.log(`\n✅ Collected ${targets.length} targets`);

        // 2. Парсим и структурируем
        const parsed = this.parseTargets(targets);

        // 3. Сохраняем результат
        await this.saveResults(parsed);

        // 4. Выводим статистику
        this.printStats(parsed);

        return parsed;
    }

    // ============================================================
    // ПАРСИНГ ЦЕЛЕЙ
    // ============================================================
    parseTargets(targets) {
        const parsed = {
            endpoints: [],
            authEndpoints: [],
            servers: new Set(),
            stats: {
                total: targets.length,
                methods: {},
                auth: 0,
                byServer: {}
            }
        };

        for (const target of targets) {
            try {
                const urlObj = new URL(target.url);
                const path = urlObj.pathname;
                const method = target.method.toLowerCase();

                // Собираем статистику по методам
                if (!parsed.stats.methods[method]) {
                    parsed.stats.methods[method] = 0;
                }
                parsed.stats.methods[method]++;

                // Собираем сервера
                const server = target.server || urlObj.origin;
                parsed.servers.add(server);
                if (!parsed.stats.byServer[server]) {
                    parsed.stats.byServer[server] = 0;
                }
                parsed.stats.byServer[server]++;

                // Парсим параметры
                const parameters = this.parseParameters(target, urlObj);

                // Парсим тело запроса
                const body = this.parseBody(target);

                // Определяем тип эндпоинта
                const type = this.detectEndpointType(path, target);

                const endpoint = {
                    id: target.id || `${method}_${path}`,
                    url: target.url,
                    path: path,
                    method: method,
                    server: server,
                    headers: target.headers || {},
                    parameters: parameters,
                    body: body,
                    bodySchema: target.bodySchema || null,
                    contentType: target.contentType || 'application/x-www-form-urlencoded',
                    type: type,
                    isAuth: target.isAuth || false,
                    originalBody: target.body || null
                };

                parsed.endpoints.push(endpoint);

                if (target.isAuth) {
                    parsed.authEndpoints.push(endpoint);
                    parsed.stats.auth++;
                }

            } catch (e) {
                console.log(`Error parsing target: ${e.message}`);
            }
        }

        parsed.servers = Array.from(parsed.servers);

        return parsed;
    }

    // ============================================================
    // ПАРСИНГ ПАРАМЕТРОВ
    // ============================================================
    parseParameters(target, urlObj) {
        const parameters = [];

        // Query параметры
        if (urlObj.search) {
            const params = new URLSearchParams(urlObj.search);
            for (const [name, value] of params) {
                parameters.push({
                    name: name,
                    in: 'query',
                    type: 'string',
                    example: value,
                    required: false
                });
            }
        }

        // Path параметры
        const path = urlObj.pathname;
        const pathMatches = path.match(/\{([^}]+)\}/g) || [];
        for (const match of pathMatches) {
            const name = match.slice(1, -1);
            if (!parameters.find(p => p.name === name && p.in === 'path')) {
                parameters.push({
                    name: name,
                    in: 'path',
                    type: 'string',
                    example: 'value',
                    required: true
                });
            }
        }

        // FormData параметры
        if (target.bodySchema?.type === 'form' && target.bodySchema.fields) {
            for (const [name, field] of Object.entries(target.bodySchema.fields)) {
                parameters.push({
                    name: name,
                    in: 'formData',
                    type: field.type || 'string',
                    example: field.example || '',
                    required: true
                });
            }
        }

        return parameters;
    }

    // ============================================================
    // ПАРСИНГ ТЕЛА ЗАПРОСА
    // ============================================================
    parseBody(target) {
        if (!target.body) return null;

        // Пробуем JSON
        try {
            return {
                type: 'json',
                data: JSON.parse(target.body)
            };
        } catch (e) {
            // Пробуем form-data
            try {
                const params = new URLSearchParams(target.body);
                const fields = {};
                for (const [name, value] of params) {
                    fields[name] = value;
                }
                return {
                    type: 'form',
                    data: fields,
                    raw: target.body
                };
            } catch (e2) {
                return {
                    type: 'raw',
                    data: target.body
                };
            }
        }
    }

    // ============================================================
    // ОПРЕДЕЛЕНИЕ ТИПА ЭНДПОИНТА
    // ============================================================
    detectEndpointType(path, target) {
        const pathLower = path.toLowerCase();

        if (target.isAuth) return 'auth';
        if (pathLower.includes('/login') || pathLower.includes('/auth')) return 'auth';
        if (pathLower.includes('/register') || pathLower.includes('/signup')) return 'register';
        if (pathLower.includes('/reset') || pathLower.includes('/recover')) return 'recover';
        if (pathLower.includes('/admin') || pathLower.includes('/manage')) return 'admin';
        if (pathLower.includes('/api/v1')) return 'api_v1';
        if (pathLower.includes('/api/v2')) return 'api_v2';
        if (pathLower.includes('/graphql')) return 'graphql';
        if (pathLower.includes('/oauth')) return 'oauth';
        if (pathLower.includes('/token')) return 'token';

        return 'api';
    }

    // ============================================================
    // СОХРАНЕНИЕ РЕЗУЛЬТАТОВ
    // ============================================================
    async saveResults(parsed) {
        await fs.mkdir(this.outputDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = `api_collection_${timestamp}`;

        // Полный результат
        await fs.writeFile(
            path.join(this.outputDir, `${baseName}.json`),
            JSON.stringify(parsed, null, 2),
            'utf8'
        );

        // Только эндпоинты (для фаззинга)
        await fs.writeFile(
            path.join(this.outputDir, `${baseName}_targets.json`),
            JSON.stringify(parsed.endpoints, null, 2),
            'utf8'
        );

        // Auth эндпоинты отдельно
        if (parsed.authEndpoints.length > 0) {
            await fs.writeFile(
                path.join(this.outputDir, `${baseName}_auth.json`),
                JSON.stringify(parsed.authEndpoints, null, 2),
                'utf8'
            );
        }

        // Краткий обзор
        const summary = {
            timestamp: new Date().toISOString(),
            source: this.targetUrl,
            stats: parsed.stats,
            servers: parsed.servers,
            authCount: parsed.authEndpoints.length,
            endpoints: parsed.endpoints.map(e => ({
                path: e.path,
                method: e.method,
                type: e.type,
                isAuth: e.isAuth
            }))
        };

        await fs.writeFile(
            path.join(this.outputDir, `${baseName}_summary.json`),
            JSON.stringify(summary, null, 2),
            'utf8'
        );

        console.log(`\n📁 Results saved to: ${this.outputDir}`);
        console.log(`   Full: ${baseName}.json`);
        console.log(`   Targets: ${baseName}_targets.json`);
        console.log(`   Auth: ${baseName}_auth.json`);
        console.log(`   Summary: ${baseName}_summary.json`);
    }

    // ============================================================
    // ВЫВОД СТАТИСТИКИ
    // ============================================================
    printStats(parsed) {
        console.log('\n========================================');
        console.log('📊 COLLECTION STATISTICS');
        console.log('========================================');
        console.log(`  Total endpoints: ${parsed.stats.total}`);
        console.log(`  Auth endpoints: ${parsed.stats.auth}`);
        console.log(`  Unique servers: ${parsed.servers.length}`);
        console.log('  Methods:');
        for (const [method, count] of Object.entries(parsed.stats.methods)) {
            console.log(`    ${method.toUpperCase()}: ${count}`);
        }
        console.log('  Servers:');
        for (const server of parsed.servers) {
            console.log(`    ${server}: ${parsed.stats.byServer[server]} endpoints`);
        }
        console.log('========================================\n');

        // Выводим эндпоинты по типам
        const types = {};
        for (const endpoint of parsed.endpoints) {
            if (!types[endpoint.type]) types[endpoint.type] = 0;
            types[endpoint.type]++;
        }
        console.log('  By type:');
        for (const [type, count] of Object.entries(types)) {
            console.log(`    ${type}: ${count}`);
        }
        console.log('========================================\n');
    }

    // ============================================================
    // ГЕНЕРАЦИЯ СВОДНОГО ОТЧЕТА
    // ============================================================
    generateReport(parsed) {
        return {
            meta: {
                source: this.targetUrl,
                collectedAt: new Date().toISOString(),
                totalEndpoints: parsed.stats.total,
                authEndpoints: parsed.stats.auth,
                servers: parsed.servers
            },
            endpoints: parsed.endpoints.map(e => ({
                path: e.path,
                method: e.method,
                type: e.type,
                isAuth: e.isAuth,
                parameters: e.parameters,
                body: e.body,
                contentType: e.contentType
            })),
            authEndpoints: parsed.authEndpoints.map(e => ({
                path: e.path,
                method: e.method,
                parameters: e.parameters,
                body: e.body
            }))
        };
    }

    // ============================================================
    // ЗАГРУЗКА СОХРАНЕННЫХ ЦЕЛЕЙ
    // ============================================================
    async loadTargets(filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    }
}

export default APICollector;