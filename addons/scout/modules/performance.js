// addons/scout/analyzer/performance.js

export async function analyzePerformance(baseUrl) {
    const findings = [];
    const metrics = {};
    
    try {
        const startTime = Date.now();
        const response = await fetch(baseUrl);
        const endTime = Date.now();
        
        const loadTime = endTime - startTime;
        metrics.loadTime = loadTime;
        
        if (loadTime > 3000) {
            findings.push({
                severity: 'medium',
                message: `Время загрузки страницы: ${loadTime}мс`,
                remediation: 'Оптимизируйте загрузку страницы (кэширование, сжатие, CDN)'
            });
        } else if (loadTime > 1000) {
            findings.push({
                severity: 'low',
                message: `Время загрузки страницы: ${loadTime}мс`,
                remediation: 'Рекомендуется ускорить загрузку'
            });
        }
        
        // Размер страницы
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
            const sizeMB = parseInt(contentLength) / (1024 * 1024);
            metrics.size = parseFloat(sizeMB.toFixed(2));
            
            if (sizeMB > 2) {
                findings.push({
                    severity: 'low',
                    message: `Размер страницы: ${sizeMB}MB`,
                    remediation: 'Оптимизируйте размер страницы (сжатие, минификация)'
                });
            }
        }
        
        // Проверка сжатия
        const contentEncoding = response.headers.get('content-encoding');
        if (!contentEncoding) {
            findings.push({
                severity: 'low',
                message: 'Страница не использует сжатие',
                remediation: 'Включите gzip или brotli сжатие'
            });
        }
        
        return { issues: findings, metrics };
        
    } catch (error) {
        return { 
            issues: [{
                severity: 'error',
                message: `Ошибка анализа производительности: ${error.message}`,
                remediation: 'Проверьте доступность сайта'
            }],
            metrics: {}
        };
    }
}