// addons/scout/analyzer/tech.js

export async function detectTechnologies(baseUrl) {
    const findings = [];
    const technologies = [];
    
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        const headers = response.headers;
        
        // Определение сервера
        const server = headers.get('server');
        if (server) {
            technologies.push({ name: 'Сервер', version: server, confidence: 'high' });
        }
        
        // Определение CMS по мета-тегам
        const cmsPatterns = [
            { name: 'WordPress', patterns: ['/wp-content/', '/wp-includes/', 'wp-admin'], generator: 'WordPress' },
            { name: 'Drupal', patterns: ['/sites/default/files/', 'Drupal'], generator: 'Drupal' },
            { name: 'Joomla', patterns: ['/media/jui/', '/components/com_'], generator: 'Joomla' },
            { name: 'Bitrix', patterns: ['/bitrix/', 'bitrix:'], generator: 'Bitrix' },
            { name: '1C-Bitrix', patterns: ['/bitrix/templates/', 'bitrix:'], generator: '1C-Bitrix' },
            { name: 'Magento', patterns: ['/skin/frontend/', 'Magento'], generator: 'Magento' },
            { name: 'OpenCart', patterns: ['/catalog/view/', 'OpenCart'], generator: 'OpenCart' },
            { name: 'Shopify', patterns: ['/cdn.shopify.com/', 'Shopify'], generator: 'Shopify' }
        ];
        
        for (const cms of cmsPatterns) {
            for (const pattern of cms.patterns) {
                if (html.includes(pattern)) {
                    technologies.push({ name: 'CMS', version: cms.name, confidence: 'medium' });
                    break;
                }
            }
        }
        
        // Определение фреймворков
        const frameworkPatterns = [
            { name: 'React', patterns: ['react', '_reactRootContainer', 'ReactDOM'] },
            { name: 'Vue.js', patterns: ['vue', 'Vue', 'v-'] },
            { name: 'Angular', patterns: ['ng-', 'angular', 'ng-app'] },
            { name: 'Laravel', patterns: ['laravel', 'csrf-token', '_token'] },
            { name: 'Django', patterns: ['csrftoken', 'djdt'] },
            { name: 'Spring', patterns: ['_csrf', 'X-Application-Context'] },
            { name: 'Ruby on Rails', patterns: ['authenticity_token', 'rails'] },
            { name: 'Next.js', patterns: ['/_next/', 'next/'] },
            { name: 'Nuxt.js', patterns: ['/_nuxt/', 'nuxt'] }
        ];
        
        for (const framework of frameworkPatterns) {
            for (const pattern of framework.patterns) {
                if (html.includes(pattern) || headers.get('x-powered-by')?.includes(pattern)) {
                    technologies.push({ name: 'Framework', version: framework.name, confidence: 'medium' });
                    break;
                }
            }
        }
        
        // Уникальные технологии
        const uniqueTech = [];
        const seen = new Set();
        for (const tech of technologies) {
            const key = `${tech.name}-${tech.version}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueTech.push(tech);
            }
        }
        
        if (uniqueTech.length === 0) {
            findings.push({
                severity: 'info',
                message: 'Не удалось определить технологии сайта',
                remediation: 'Проверьте заголовки и исходный код вручную'
            });
        }
        
        return { technologies: uniqueTech, issues: findings };
        
    } catch (error) {
        return { 
            technologies: [], 
            issues: [{
                severity: 'error',
                message: `Ошибка определения технологий: ${error.message}`,
                remediation: 'Проверьте доступность сайта'
            }]
        };
    }
}