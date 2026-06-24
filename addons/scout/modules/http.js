// addons/scout/analyzer/http.js

/**
 * Анализ заголовков безопасности через HTTP запрос
 */
export async function analyzeSecurityHeaders(baseUrl) {
    const findings = [];
    
    try {
        const response = await fetch(baseUrl);
        const headers = response.headers;
        
        // Проверка CSP
        const csp = headers.get('content-security-policy');
        if (!csp) {
            findings.push({
                severity: 'high',
                message: 'Отсутствует Content-Security-Policy (CSP)',
                remediation: 'Добавьте CSP для защиты от XSS и инъекций'
            });
        } else if (csp.includes("'unsafe-inline'")) {
            findings.push({
                severity: 'high',
                message: 'CSP использует unsafe-inline, что ослабляет защиту',
                remediation: 'Замените unsafe-inline на nonce или hash'
            });
        }
        
        // Проверка X-Frame-Options
        const xfo = headers.get('x-frame-options');
        if (!xfo) {
            findings.push({
                severity: 'medium',
                message: 'Отсутствует X-Frame-Options',
                remediation: 'Добавьте X-Frame-Options: DENY или SAMEORIGIN для защиты от clickjacking'
            });
        }
        
        // Проверка X-Content-Type-Options
        const xcto = headers.get('x-content-type-options');
        if (!xcto || xcto !== 'nosniff') {
            findings.push({
                severity: 'low',
                message: 'Отсутствует X-Content-Type-Options: nosniff',
                remediation: 'Добавьте X-Content-Type-Options: nosniff'
            });
        }
        
        // Проверка Strict-Transport-Security
        const hsts = headers.get('strict-transport-security');
        if (!hsts) {
            findings.push({
                severity: 'medium',
                message: 'Отсутствует HSTS (Strict-Transport-Security)',
                remediation: 'Добавьте HSTS для принудительного HTTPS'
            });
        }
        
        // Проверка Referrer-Policy
        const referrer = headers.get('referrer-policy');
        if (!referrer) {
            findings.push({
                severity: 'low',
                message: 'Отсутствует Referrer-Policy',
                remediation: 'Добавьте Referrer-Policy: strict-origin-when-cross-origin'
            });
        }
        
        // Проверка Permissions-Policy
        const permissions = headers.get('permissions-policy');
        if (!permissions) {
            findings.push({
                severity: 'low',
                message: 'Отсутствует Permissions-Policy',
                remediation: 'Ограничьте доступ к функциям браузера через Permissions-Policy'
            });
        }
        
    } catch (error) {
        findings.push({
            severity: 'error',
            message: `Не удалось получить заголовки: ${error.message}`,
            remediation: 'Проверьте доступность сайта'
        });
    }
    
    return { issues: findings, missing: findings.filter(f => f.severity !== 'error').length };
}

/**
 * Анализ CORS
 */
export async function analyzeCORS(baseUrl) {
    const findings = [];
    
    try {
        const response = await fetch(baseUrl, { method: 'OPTIONS' });
        const acao = response.headers.get('access-control-allow-origin');
        
        if (acao === '*') {
            findings.push({
                severity: 'critical',
                message: 'CORS разрешает любые источники (*)',
                location: acao,
                remediation: 'Укажите конкретные доверенные домены вместо *'
            });
        } else if (acao && acao !== baseUrl && acao !== new URL(baseUrl).origin) {
            findings.push({
                severity: 'medium',
                message: `CORS разрешает доступ с: ${acao}`,
                location: acao,
                remediation: 'Убедитесь, что это доверенный источник'
            });
        }
        
        // Проверка методов
        const acam = response.headers.get('access-control-allow-methods');
        if (acam && acam.includes('*')) {
            findings.push({
                severity: 'medium',
                message: 'CORS разрешает все методы (*)',
                remediation: 'Ограничьте разрешенные методы (GET, POST, PUT, DELETE)'
            });
        }
        
    } catch (e) {
        // CORS может быть не настроен, это нормально
    }
    
    return findings;
}