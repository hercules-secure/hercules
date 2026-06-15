// addons/scout/analyzer/wcag.js

export async function analyzeWCAG(baseUrl) {
    const findings = [];
    const checks = [];
    
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        
        // Проверка альтернативного текста для изображений
        const images = html.match(/<img[^>]*>/gi) || [];
        const imagesWithoutAlt = [];
        
        for (const img of images) {
            if (!/alt=["'][^"']*["']/i.test(img)) {
                imagesWithoutAlt.push(img);
            }
        }
        
        checks.push({ name: 'Images have alt text', passed: imagesWithoutAlt.length === 0 });
        if (imagesWithoutAlt.length > 0) {
            findings.push({
                severity: 'medium',
                message: `${imagesWithoutAlt.length} изображений без alt-текста`,
                remediation: 'Добавьте атрибут alt для всех изображений'
            });
        }
        
        // Проверка заголовков
        const hasH1 = /<h1[^>]*>/i.test(html);
        checks.push({ name: 'Has H1 heading', passed: hasH1 });
        if (!hasH1) {
            findings.push({
                severity: 'medium',
                message: 'Отсутствует H1 заголовок',
                remediation: 'Добавьте основной заголовок H1 на страницу'
            });
        }
        
        // Проверка языка
        const hasLang = /<html[^>]*lang=["'][a-z]{2}["']/i.test(html);
        checks.push({ name: 'Language attribute', passed: hasLang });
        if (!hasLang) {
            findings.push({
                severity: 'medium',
                message: 'Отсутствует атрибут lang у тега html',
                remediation: 'Добавьте lang="ru" для указания языка страницы'
            });
        }
        
        // Проверка форм с лейблами
        const inputs = html.match(/<input[^>]*>/gi) || [];
        const inputsWithoutLabel = [];
        
        for (const input of inputs) {
            const id = input.match(/id=["']([^"']+)["']/i);
            if (id && !new RegExp(`<label[^>]*for=["']${id[1]}["']`, 'i').test(html)) {
                inputsWithoutLabel.push(input);
            }
        }
        
        checks.push({ name: 'Form inputs have labels', passed: inputsWithoutLabel.length === 0 });
        if (inputsWithoutLabel.length > 0) {
            findings.push({
                severity: 'low',
                message: `${inputsWithoutLabel.length} полей ввода без связанных лейблов`,
                remediation: 'Свяжите лейблы с полями ввода через атрибут for'
            });
        }
        
        // Проверка кнопок с текстом
        const buttons = html.match(/<button[^>]*>/gi) || [];
        const buttonsWithoutText = buttons.filter(b => !/>\s*[^<]+\s*</.test(b));
        
        if (buttonsWithoutText.length > 0) {
            findings.push({
                severity: 'low',
                message: `${buttonsWithoutText.length} кнопок без текста`,
                remediation: 'Добавьте текст или aria-label для кнопок'
            });
        }
        
        const passedCount = checks.filter(c => c.passed).length;
        const score = Math.round((passedCount / checks.length) * 100);
        
        return { 
            issues: findings, 
            checks, 
            score, 
            level: score >= 80 ? 'AA' : (score >= 60 ? 'A' : 'Не соответствует')
        };
        
    } catch (error) {
        return { 
            issues: [{
                severity: 'error',
                message: `Ошибка анализа доступности: ${error.message}`,
                remediation: 'Проверьте доступность сайта'
            }],
            checks: [],
            score: 0,
            level: 'Ошибка'
        };
    }
}