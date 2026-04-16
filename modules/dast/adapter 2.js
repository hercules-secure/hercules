// dast-scanner.js
import { SecurityTests, HTTPRequester } from './security-tests.js';

async function scanWebApplication(targetUrl) {
    console.log(`\n🚀 ЗАПУСК DAST СКАНА ДЛЯ: ${targetUrl}`);
    console.log('='.repeat(70));
    
    // Создаем HTTP адаптер для целевого приложения
    const requester = new HTTPRequester(targetUrl, {
        headers: {
            'User-Agent': 'DAST-Scanner/1.0',
            'Accept': 'application/json, text/html'
        }
    });
    
    const scanner = new SecurityTests(requester, {
        concurrency: 10,
        delayBetweenRequests: 50,
        timeout: 10000
    });
    
    // ===== БАЗОВЫЕ ТЕСТЫ =====
    console.log('\n📋 ФАЗА 1: Базовые тесты безопасности');
    
    // Rate limiting (100 запросов за 2 секунды)
    await scanner.testRateLimit('/login', 100, 20);
    
    // Race condition (конкурентные запросы)
    await scanner.testRaceCondition({ method: 'POST', path: '/api/resource', body: { id: 1 } }, 15, 5);
    
    // Brute force защита (словарь паролей)
    const weakPasswords = ['123456', 'password', 'admin', 'qwerty', 'admin123'];
    await scanner.testBruteForce(
        { method: 'POST', path: '/login', body: { username: 'admin' } },
        weakPasswords,
        'password',
        100
    );
    
    // Timing attack (разница между существующим и несуществующим пользователем)
    await scanner.testTimingAttack([
        { method: 'POST', path: '/login', body: { username: 'admin', password: 'wrong' } },
        { method: 'POST', path: '/login', body: { username: 'nonexistent', password: 'wrong' } }
    ], 30);
    
    // ===== ТЕСТЫ КЭШИРОВАНИЯ =====
    console.log('\n📋 ФАЗА 2: Тесты кэширования');
    
    await scanner.testCachePoisoning('/api/profile');
    await scanner.testCacheDeception('/api/user/123');
    
    // ===== АУТЕНТИФИКАЦИЯ И СЕССИИ =====
    console.log('\n📋 ФАЗА 3: Тесты аутентификации');
    
    // Session fixation (сначала логинимся, потом проверяем)
    await scanner.testSessionFixation(
        { method: 'POST', path: '/login', body: { username: 'test', password: 'test' } },
        { path: '/api/profile' },
        'evil_session_123'
    );
    
    // JWT безопасность (если есть токен)
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    await scanner.testJwtSecurity(fakeToken, { path: '/api/protected' });
    
    // CSRF защита
    await scanner.testCSRF({ method: 'POST', path: '/api/settings', body: { email: 'attacker@evil.com' } });
    
    // ===== ВНЕШНИЕ АТАКИ =====
    console.log('\n📋 ФАЗА 4: Атаки на бэкенд');
    
    // SSRF (попытка доступа к внутренним ресурсам)
    await scanner.testSSRF({ method: 'POST', path: '/api/fetch', body: { url: '' } });
    
    // XXE (если есть XML эндпоинты)
    await scanner.testXXE({ method: 'POST', path: '/api/xml', headers: { 'Content-Type': 'application/xml' } });
    
    // Open redirect
    await scanner.testOpenRedirect({ path: '/redirect' });
    
    // ===== КОНФИГУРАЦИЯ =====
    console.log('\n📋 ФАЗА 5: Тесты конфигурации');
    
    // CORS
    await scanner.testCORS('/api/data');
    
    // Resource exhaustion (DoS)
    await scanner.testResourceExhaustion(
        (i) => ({ method: 'GET', path: `/api/search?q=${'A'.repeat(1000)}&page=${i}` }),
        50,
        10
    );
    
    // ===== ОТЧЕТ =====
    scanner.printReport();
    
    // Сохраняем результат
    const fs = await import('fs/promises');
    await fs.writeFile(`dast-report-${Date.now()}.json`, JSON.stringify(scanner.exportResults(), null, 2));
    console.log(`\n💾 Отчет сохранен: dast-report-${Date.now()}.json`);
    
    return scanner.exportResults();
}

// Запуск сканирования
const target = process.argv[2] || 'http://localhost:3000';
scanWebApplication(target).catch(console.error);