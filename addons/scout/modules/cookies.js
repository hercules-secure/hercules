// addons/scout/analyzer/cookies.js

/**
 * Анализ cookies через HTTP заголовки
 */
export async function analyzeCookies(baseUrl) {
    const findings = [];
    
    try {
        const response = await fetch(baseUrl);
        const setCookieHeaders = response.headers.getSetCookie?.() || [];
        
        if (setCookieHeaders.length === 0) {
            findings.push({
                severity: 'info',
                message: 'Cookies не найдены',
                remediation: 'Проверьте, что cookies установлены с правильными флагами'
            });
            return { issues: findings, cookies: [] };
        }
        
        const sensitiveKeywords = ['session', 'token', 'auth', 'jwt', 'sid', 'user', 'access', 'refresh'];
        
        for (const cookie of setCookieHeaders) {
            const [namePart] = cookie.split(';');
            const name = namePart.split('=')[0];
            const hasHttpOnly = /HttpOnly/i.test(cookie);
            const hasSecure = /Secure/i.test(cookie);
            const hasSameSite = /SameSite=/i.test(cookie);
            
            // Проверка на чувствительность
            const isSensitive = sensitiveKeywords.some(keyword => name.toLowerCase().includes(keyword));
            
            if (isSensitive) {
                findings.push({
                    severity: 'medium',
                    message: `Обнаружена чувствительная cookie: ${name}`,
                    remediation: 'Установите флаги HttpOnly, Secure, SameSite=Strict/Lax'
                });
            }
            
            // Проверка флагов безопасности
            if (!hasHttpOnly) {
                findings.push({
                    severity: 'medium',
                    message: `Cookie ${name} не имеет флага HttpOnly`,
                    remediation: 'Добавьте флаг HttpOnly для защиты от XSS'
                });
            }
            
            if (!hasSecure && baseUrl.startsWith('https://')) {
                findings.push({
                    severity: 'high',
                    message: `Cookie ${name} не имеет флага Secure на HTTPS сайте`,
                    remediation: 'Добавьте флаг Secure для защиты от перехвата'
                });
            }
            
            if (!hasSameSite) {
                findings.push({
                    severity: 'low',
                    message: `Cookie ${name} не имеет флага SameSite`,
                    remediation: 'Добавьте SameSite=Lax или SameSite=Strict'
                });
            }
        }
        
    } catch (error) {
        findings.push({
            severity: 'error',
            message: `Ошибка анализа cookies: ${error.message}`,
            remediation: 'Проверьте доступность сайта'
        });
    }
    
    return { issues: findings, cookiesCount: findings.length };
}