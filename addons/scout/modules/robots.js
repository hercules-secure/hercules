// addons/scout/analyzer/robots.js

export async function analyzeRobots(baseUrl) {
    const results = { exists: false, disallowed: [], sitemaps: [], issues: [] };
    
    try {
        const response = await fetch(`${baseUrl}/robots.txt`);
        if (response.ok) {
            results.exists = true;
            const content = await response.text();
            parseRobotsContent(content, results, baseUrl);
        } else {
            results.issues.push({
                severity: 'info',
                message: 'robots.txt не найден',
                remediation: 'Рекомендуется добавить robots.txt'
            });
        }
    } catch (e) {
        results.issues.push({
            severity: 'info',
            message: 'Не удалось получить robots.txt',
            remediation: 'Проверьте доступность файла'
        });
    }
    
    return results;
}

export async function analyzeSitemap(baseUrl) {
    const results = { exists: false, urls: [], issues: [] };
    const sitemapUrls = [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/sitemap_index.xml`,
        `${baseUrl}/sitemap/sitemap.xml`
    ];
    
    for (const url of sitemapUrls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                results.exists = true;
                const content = await response.text();
                const urls = extractUrlsFromSitemap(content);
                results.urls = urls;
                
                // Проверка на чувствительные URL в sitemap
                const sensitive = ['admin', 'api', 'login', 'config', '.env', 'backup', 'phpmyadmin', '.git'];
                for (const u of urls) {
                    for (const s of sensitive) {
                        if (u.toLowerCase().includes(s)) {
                            results.issues.push({
                                severity: 'medium',
                                message: `Обнаружен чувствительный URL в sitemap: ${u}`,
                                remediation: 'Проверьте, нужно ли включать этот URL в sitemap'
                            });
                            break;
                        }
                    }
                }
                break;
            }
        } catch (e) {}
    }
    
    return results;
}

function parseRobotsContent(content, results, baseUrl) {
    const lines = content.split('\n');
    const sensitivePaths = ['/admin', '/wp-admin', '/.env', '/backup', '/.git', '/phpmyadmin', '/api', '/config'];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.toLowerCase().startsWith('disallow:')) {
            const path = trimmed.split(':')[1].trim();
            if (path && path !== '/') {
                results.disallowed.push(path);
                for (const sensitive of sensitivePaths) {
                    if (path.includes(sensitive)) {
                        results.issues.push({
                            severity: 'high',
                            path: baseUrl + path,
                            message: `Обнаружен чувствительный путь в robots.txt: ${path}`,
                            remediation: 'Проверьте, нужно ли скрывать этот путь'
                        });
                        break;
                    }
                }
            }
        } else if (trimmed.toLowerCase().startsWith('sitemap:')) {
            results.sitemaps.push(trimmed.split(':')[1].trim());
        }
    }
}

function extractUrlsFromSitemap(content) {
    const urls = [];
    const locRegex = /<loc>([^<]+)<\/loc>/gi;
    let match;
    while ((match = locRegex.exec(content)) !== null) {
        urls.push(match[1]);
    }
    return urls;
}