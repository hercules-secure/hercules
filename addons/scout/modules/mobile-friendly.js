// addons/scout/analyzer/mobile-friendly.js

export async function analyzeMobileFriendly(baseUrl) {
    const findings = [];
    const checks = [];
    
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        
        // Проверка viewport
        const hasViewport = /<meta name=["']viewport["']/i.test(html);
        checks.push({ name: 'Viewport meta tag', passed: hasViewport });
        if (!hasViewport) {
            findings.push({
                severity: 'medium',
                message: 'Отсутствует viewport meta-тег для адаптивности',
                remediation: 'Добавьте <meta name="viewport" content="width=device-width, initial-scale=1">'
            });
        }
        
        // Проверка медиа-запросов в CSS
        const hasMediaQueries = /@media\s*\(/i.test(html);
        checks.push({ name: 'Media queries', passed: hasMediaQueries });
        if (!hasMediaQueries) {
            findings.push({
                severity: 'low',
                message: 'Возможно отсутствие адаптивного дизайна (нет медиа-запросов)',
                remediation: 'Добавьте CSS медиа-запросы для разных разрешений экрана'
            });
        }
        
        // Проверка относительных единиц
        const hasRelativeUnits = /(rem|em|vw|vh|%)/i.test(html);
        checks.push({ name: 'Relative units', passed: hasRelativeUnits });
        
        // Проверка на наличие горизонтальной прокрутки (признак)
        const hasHorizontalOverflow = /overflow-x:\s*auto|overflow-x:\s*scroll/i.test(html);
        if (hasHorizontalOverflow) {
            findings.push({
                severity: 'low',
                message: 'Возможны проблемы с горизонтальной прокруткой на мобильных',
                remediation: 'Проверьте отображение на мобильных устройствах'
            });
        }
        
        const passedCount = checks.filter(c => c.passed).length;
        const score = Math.round((passedCount / checks.length) * 100);
        
        return { 
            issues: findings, 
            checks, 
            score, 
            isMobileFriendly: score >= 50 
        };
        
    } catch (error) {
        return { 
            issues: [{
                severity: 'error',
                message: `Ошибка анализа адаптивности: ${error.message}`,
                remediation: 'Проверьте доступность сайта'
            }],
            checks: [],
            score: 0,
            isMobileFriendly: false
        };
    }
}