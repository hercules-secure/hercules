// addons/scout/analyzer/broken-links.js

export async function scanBrokenLinks(baseUrl, maxLinks = 50) {
    const findings = [];
    const brokenLinks = [];
    
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        
        // Поиск всех ссылок
        const linkRegex = /<a[^>]*href=["']([^"']+)["']/gi;
        const links = [];
        let match;
        
        while ((match = linkRegex.exec(html)) !== null) {
            const href = match[1];
            if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                links.push(href);
            }
        }
        
        // Ограничиваем количество проверяемых ссылок
        const uniqueLinks = [...new Set(links)].slice(0, maxLinks);
        
        for (const link of uniqueLinks) {
            try {
                let fullUrl = link;
                if (!fullUrl.startsWith('http')) {
                    fullUrl = new URL(link, baseUrl).href;
                }
                
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                const linkResponse = await fetch(fullUrl, { method: 'HEAD', signal: controller.signal });
                clearTimeout(timeout);
                
                if (linkResponse.status === 404) {
                    brokenLinks.push({ url: fullUrl, status: 404 });
                    findings.push({
                        severity: 'medium',
                        message: `Битая ссылка: ${fullUrl}`,
                        location: fullUrl,
                        remediation: 'Обновите или удалите ссылку'
                    });
                } else if (linkResponse.status >= 500) {
                    brokenLinks.push({ url: fullUrl, status: linkResponse.status });
                    findings.push({
                        severity: 'low',
                        message: `Ссылка возвращает ошибку ${linkResponse.status}: ${fullUrl}`,
                        remediation: 'Проверьте доступность ресурса'
                    });
                }
            } catch (e) {
                brokenLinks.push({ url: link, status: 'timeout' });
            }
        }
        
        return { issues: findings, brokenLinks, totalChecked: uniqueLinks.length };
        
    } catch (error) {
        return { 
            issues: [{
                severity: 'error',
                message: `Ошибка сканирования ссылок: ${error.message}`,
                remediation: 'Проверьте доступность сайта'
            }],
            brokenLinks: [],
            totalChecked: 0
        };
    }
}