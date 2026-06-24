// addons/scout/analyzer/quality.js

export async function analyzeQuality(baseUrl) {
    const findings = [];
    const qualityChecks = [];
    
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        
        // Проверка HTML валидации
        const hasDoctype = /<!DOCTYPE html>/i.test(html);
        if (!hasDoctype) {
            findings.push({
                severity: 'low',
                message: 'Отсутствует DOCTYPE',
                remediation: 'Добавьте <!DOCTYPE html> в начало страницы'
            });
        }
        
        // Проверка мета-тегов
        const hasViewport = /<meta name=["']viewport["']/i.test(html);
        if (!hasViewport) {
            findings.push({
                severity: 'medium',
                message: 'Отсутствует viewport meta-тег',
                remediation: 'Добавьте <meta name="viewport" content="width=device-width, initial-scale=1">'
            });
        }
        
        const hasDescription = /<meta name=["']description["']/i.test(html);
        if (!hasDescription) {
            findings.push({
                severity: 'low',
                message: 'Отсутствует meta-описание',
                remediation: 'Добавьте <meta name="description" content="..."> для SEO'
            });
        }
        
        const hasTitle = /<title>/i.test(html);
        if (!hasTitle) {
            findings.push({
                severity: 'medium',
                message: 'Отсутствует заголовок страницы (title)',
                remediation: 'Добавьте <title>...</title>'
            });
        }
        
        // Проверка языка
        const hasLang = /<html[^>]*lang=["'][a-z]{2}["']/i.test(html);
        if (!hasLang) {
            findings.push({
                severity: 'low',
                message: 'Отсутствует атрибут lang у тега html',
                remediation: 'Добавьте lang="ru" или lang="en"'
            });
        }
        
        qualityChecks.push({ check: 'DOCTYPE', passed: hasDoctype });
        qualityChecks.push({ check: 'Viewport', passed: hasViewport });
        qualityChecks.push({ check: 'Meta Description', passed: hasDescription });
        qualityChecks.push({ check: 'Title', passed: hasTitle });
        qualityChecks.push({ check: 'HTML Lang', passed: hasLang });
        
        return { issues: findings, qualityChecks, score: qualityChecks.filter(c => c.passed).length };
        
    } catch (error) {
        return { 
            issues: [{
                severity: 'error',
                message: `Ошибка анализа качества: ${error.message}`,
                remediation: 'Проверьте доступность сайта'
            }],
            qualityChecks: [],
            score: 0
        };
    }
}