// addons/scout/analyzer/ssl.js

export async function analyzeSSL(baseUrl) {
    const findings = [];
    const url = new URL(baseUrl);
    
    if (url.protocol !== 'https:') {
        return { 
            issues: [{
                severity: 'high',
                message: 'Сайт не использует HTTPS',
                remediation: 'Включите HTTPS и настройте редирект с HTTP'
            }],
            certificate: null
        };
    }
    
    try {
        // Используем внешний API для проверки SSL (требуется на сервере)
        // Или парсим через fetch
        const response = await fetch(baseUrl);
        const tlsVersion = response.headers.get('X-TLS-Version') || 'unknown';
        
        findings.push({
            severity: 'low',
            message: `Используется TLS версия: ${tlsVersion}`,
            remediation: 'Используйте TLS 1.2 или выше'
        });
        
        // Проверка HSTS
        const hsts = response.headers.get('strict-transport-security');
        if (!hsts) {
            findings.push({
                severity: 'medium',
                message: 'Отсутствует HSTS (HTTP Strict Transport Security)',
                remediation: 'Добавьте заголовок HSTS для принудительного HTTPS'
            });
        }
        
        return { issues: findings, certificate: { valid: true, tlsVersion: tlsVersion } };
        
    } catch (error) {
        return { 
            issues: [{
                severity: 'error',
                message: `Ошибка анализа SSL: ${error.message}`,
                remediation: 'Проверьте SSL сертификат'
            }],
            certificate: null
        };
    }
}