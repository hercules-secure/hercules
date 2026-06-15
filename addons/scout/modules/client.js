// addons/scout/analyzer/client.js

/**
 * Анализ скриптов через HTML парсинг
 * (серверная версия - парсим HTML, ищем скрипты)
 */
export async function analyzeScripts(baseUrl) {
    const findings = [];
    
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        
        // Ищем скрипты через регулярные выражения
        const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
        const scripts = [];
        let match;
        
        while ((match = scriptRegex.exec(html)) !== null) {
            scripts.push(match[1]);
        }
        
        // Анализ скриптов
        for (const src of scripts) {
            if (src.startsWith('http://')) {
                findings.push({
                    severity: 'high',
                    message: `Небезопасный протокол (HTTP): ${src}`,
                    remediation: 'Используйте HTTPS для загрузки скриптов'
                });
            }
            
            // Проверка на устаревшие версии
            if (src.includes('jquery') && (src.includes('1.') || src.includes('2.'))) {
                findings.push({
                    severity: 'medium',
                    message: `Устаревшая jQuery: ${src}`,
                    remediation: 'Обновите jQuery до версии 3.x'
                });
            }
            
            if (src.includes('angular') && src.includes('1.')) {
                findings.push({
                    severity: 'medium',
                    message: `Устаревший AngularJS: ${src}`,
                    remediation: 'Обновите Angular или мигрируйте на современную версию'
                });
            }
        }
        
        return { issues: findings, total: scripts.length };
        
    } catch (error) {
        return { issues: [{ severity: 'error', message: `Ошибка анализа: ${error.message}` }], total: 0 };
    }
}

/**
 * Анализ DOM на наличие потенциальных XSS (серверная версия)
 */
export async function analyzeDOM(baseUrl) {
    const findings = [];
    
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        
        // Поиск опасных паттернов в HTML
        const dangerousPatterns = [
            { pattern: /onload\s*=/i, severity: 'high', message: 'Обнаружен onload обработчик' },
            { pattern: /onerror\s*=/i, severity: 'high', message: 'Обнаружен onerror обработчик' },
            { pattern: /eval\s*\(/i, severity: 'critical', message: 'Использование eval()' },
            { pattern: /document\.write\s*\(/i, severity: 'high', message: 'Использование document.write()' },
            { pattern: /innerHTML\s*=/, severity: 'medium', message: 'Прямое присвоение innerHTML' },
            { pattern: /<script[^>]*>.*?<\//i, severity: 'info', message: 'Инлайн скрипт' }
        ];
        
        for (const pattern of dangerousPatterns) {
            if (pattern.pattern.test(html)) {
                findings.push({
                    severity: pattern.severity,
                    message: pattern.message,
                    remediation: getRemediation(pattern.message)
                });
            }
        }
        
        // Поиск встроенных скриптов с опасным содержимым
        const inlineScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
        for (const script of inlineScripts) {
            if (script.includes('eval(')) {
                findings.push({
                    severity: 'critical',
                    message: 'eval() в инлайн скрипте',
                    remediation: 'Удалите eval(), используйте безопасные альтернативы'
                });
            }
            if (script.includes('document.write(')) {
                findings.push({
                    severity: 'high',
                    message: 'document.write() в инлайн скрипте',
                    remediation: 'Используйте DOM методы (createElement, appendChild)'
                });
            }
        }
        
    } catch (error) {
        findings.push({
            severity: 'error',
            message: `Ошибка анализа DOM: ${error.message}`,
            remediation: 'Проверьте доступность сайта'
        });
    }
    
    return findings;
}

function getRemediation(message) {
    const remediations = {
        'Использование eval()': 'Удалите eval(), используйте безопасные альтернативы',
        'Использование document.write()': 'Используйте DOM методы (createElement, appendChild)',
        'Прямое присвоение innerHTML': 'Используйте textContent вместо innerHTML или санитизируйте данные',
        'Обнаружен onload обработчик': 'Используйте addEventListener вместо инлайн-обработчиков',
        'Обнаружен onerror обработчик': 'Используйте addEventListener вместо инлайн-обработчиков',
        'Инлайн скрипт': 'Вынесите скрипты в отдельные файлы и используйте CSP'
    };
    return remediations[message] || 'Проверьте и исправьте уязвимость';
}