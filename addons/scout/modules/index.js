import { analyzeRobots, analyzeSitemap } from './robots.js';
import { analyzeScripts, analyzeDOM } from './client.js';
import { analyzeForms } from './forms.js';
import { analyzeCookies } from './cookies.js';
import { analyzeSecurityHeaders, analyzeCORS } from './http.js';
import { scanAPIEndpoints, bruteForceDirectories } from './attacks.js';
import { scanS3Buckets, scanSubdomains, testOpenPorts } from './recon.js';
import { detectTechnologies } from './tech.js';
import { scanSecrets } from './secrets.js';
import { analyzeSSL } from './ssl.js';
import { analyzeQuality } from './quality.js';
import { scanBrokenLinks } from './broken-links.js';
import { analyzePerformance } from './performance.js';
import { analyzeMobileFriendly } from './mobile-friendly.js';
import { analyzeWCAG } from './wcag.js';
import { scanApiFromJS } from './api-scanner.js';

export async function analyzeWebsite(targetUrl, options = {}, progressCallback = null) {
    const startTime = Date.now();
    
    let baseUrl = targetUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'https://' + baseUrl;
    }
    
    const urlObj = new URL(baseUrl);
    const hostname = urlObj.hostname;
    
    const results = {
        success: true,
        target: baseUrl,
        hostname: hostname,
        timestamp: new Date().toISOString(),
        duration: 0,
        summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
        findings: {},
        allIssues: [],
        recommendations: []
    };
    
    function sendProgress(step, current, total, message) {
        if (progressCallback) progressCallback(step, current, total, message);
    }
    
    const steps = [
        { name: 'robots', label: 'Анализ robots.txt', fn: () => analyzeRobots(baseUrl) },
        { name: 'sitemap', label: 'Анализ sitemap.xml', fn: () => analyzeSitemap(baseUrl) },
        { name: 'headers', label: 'Анализ заголовков', fn: () => analyzeSecurityHeaders(baseUrl) },
        { name: 'cors', label: 'Проверка CORS', fn: () => analyzeCORS(baseUrl) },
        { name: 'cookies', label: 'Анализ cookies', fn: () => analyzeCookies(baseUrl) },
        { name: 'ssl', label: 'Анализ SSL/TLS', fn: () => analyzeSSL(baseUrl) },
        { name: 'tech', label: 'Определение технологий', fn: () => detectTechnologies(baseUrl) },
        { name: 'secrets', label: 'Поиск секретов', fn: () => scanSecrets(baseUrl) },
        { name: 'forms', label: 'Анализ форм', fn: () => analyzeForms(baseUrl) },
        { name: 'scripts', label: 'Анализ скриптов', fn: () => analyzeScripts(baseUrl) },
        { name: 'dom', label: 'Анализ DOM', fn: () => analyzeDOM(baseUrl) },
        { name: 'apiFromJS', label: 'Поиск API в JS файлах', fn: () => scanApiFromJS(baseUrl) },
        { name: 'api', label: 'API эндпоинты (swagger/docs)', fn: () => scanAPIEndpoints(baseUrl) },
        { name: 'dirs', label: 'Brute force директорий', fn: () => bruteForceDirectories(baseUrl) },
        { name: 'ports', label: 'Сканирование портов', fn: () => testOpenPorts(hostname) },
        { name: 'subdomains', label: 'Поиск субдоменов', fn: () => scanSubdomains(hostname) },
        { name: 's3', label: 'Проверка S3 бакетов', fn: () => scanS3Buckets(hostname) },
        { name: 'quality', label: 'Тестирование качества', fn: () => analyzeQuality(baseUrl) },
        { name: 'links', label: 'Проверка ссылок', fn: () => scanBrokenLinks(baseUrl) },
        { name: 'performance', label: 'Анализ производительности', fn: () => analyzePerformance(baseUrl) },
        { name: 'mobile', label: 'Адаптивность', fn: () => analyzeMobileFriendly(baseUrl) },
        { name: 'wcag', label: 'Доступность WCAG', fn: () => analyzeWCAG(baseUrl) }
    ];
    
    let currentStep = 0;
    const totalSteps = steps.length;
    
    for (const step of steps) {
        currentStep++;
        sendProgress(step.name, currentStep, totalSteps, `${step.label}...`);
        
        try {
            const result = await step.fn();
            results.findings[step.name] = result;
            
            const issues = result.issues || result || [];
            if (Array.isArray(issues)) {
                results.allIssues.push(...issues);
            }
            
            sendProgress(step.name, currentStep, totalSteps, `${step.label} завершен`);
        } catch (error) {
            console.error(`Ошибка в ${step.name}:`, error);
            results.findings[step.name] = { error: error.message, issues: [] };
            sendProgress(step.name, currentStep, totalSteps, `${step.label} - ошибка`);
        }
    }
    
    // Подсчет статистики
    for (const issue of results.allIssues) {
        const severity = issue.severity || 'info';
        if (results.summary[severity] !== undefined) results.summary[severity]++;
        else results.summary.info++;
        results.summary.total++;
    }
    
    // Формирование рекомендаций
    if (results.summary.critical > 0) {
        results.recommendations.push('Критические уязвимости! Требуется немедленное исправление.');
    }
    if (results.summary.high > 0) {
        results.recommendations.push('Высокорисковые уязвимости. Рекомендуется исправить в ближайшее время.');
    }
    if (results.findings.headers?.missing > 0) {
        results.recommendations.push('Настройте заголовки безопасности: CSP, X-Frame-Options, HSTS');
    }
    if (results.findings.ssl?.issues?.length > 0) {
        results.recommendations.push('Проверьте SSL/TLS сертификат и настройки HTTPS');
    }
    if (results.findings.quality?.score < 3) {
        results.recommendations.push('Улучшите качество сайта: добавьте мета-теги, DOCTYPE, title');
    }
    if (results.findings.mobile?.isMobileFriendly === false) {
        results.recommendations.push('Сделайте сайт адаптивным для мобильных устройств');
    }
    if (results.findings.wcag?.score < 60) {
        results.recommendations.push('Улучшите доступность сайта (WCAG) для людей с ограниченными возможностями');
    }
    
    // Рекомендация по API из JS
    if (results.findings.apiFromJS?.totalEndpointsFound > 0) {
        results.recommendations.push(`Обнаружено ${results.findings.apiFromJS.totalEndpointsFound} API вызовов в JS файлах. Проверьте их безопасность.`);
    }
    
    results.duration = ((Date.now() - startTime) / 1000).toFixed(2);
    results.discoveredPaths = results.findings.dirs?.paths || [];
    results.accessiblePaths = results.findings.dirs?.found || [];
    
    return results;
}

export default { analyzeWebsite };