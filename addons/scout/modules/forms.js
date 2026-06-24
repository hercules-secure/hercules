// addons/scout/analyzer/forms.js

export async function analyzeForms(baseUrl) {
    const findings = [];
    
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        
        // Ищем формы
        const formRegex = /<form[^>]*>/gi;
        let match;
        let formIndex = 0;
        
        while ((match = formRegex.exec(html)) !== null) {
            formIndex++;
            const formTag = match[0];
            const method = (formTag.match(/method=["'](get|post)["']/i) || [])[1]?.toLowerCase() || 'get';
            const action = (formTag.match(/action=["']([^"']+)["']/i) || [])[1] || 'current page';
            
            // Получаем содержимое формы (следующие 2000 символов)
            const formContent = html.substring(match.index, match.index + 2000);
            const hasCsrf = /name=["'](csrf|_token|csrf_token|authenticity_token)["']/i.test(formContent);
            
            if (method === 'post' && !hasCsrf) {
                findings.push({
                    severity: 'medium',
                    message: `Отсутствует CSRF токен в форме ${formIndex}`,
                    location: action,
                    remediation: 'Добавьте CSRF токен для защиты от подделки запросов'
                });
            }
            
            // Проверка пароля в GET
            if (method === 'get' && /type=["']password["']/i.test(formContent)) {
                findings.push({
                    severity: 'high',
                    message: `Пароль отправляется через GET запрос в форме ${formIndex} (виден в URL)`,
                    location: action,
                    remediation: 'Используйте метод POST для отправки паролей'
                });
            }
        }
        
        // Поиск полей пароля без autocomplete
        const passwordFields = html.match(/<input[^>]*type=["']password["'][^>]*>/gi) || [];
        for (const field of passwordFields) {
            const hasAutocomplete = /autocomplete=["']off["']/i.test(field) || /autocomplete=["']new-password["']/i.test(field);
            if (!hasAutocomplete) {
                findings.push({
                    severity: 'low',
                    message: 'Поле пароля имеет включённое автозаполнение',
                    remediation: 'Добавьте autocomplete="off" или autocomplete="new-password"'
                });
            }
        }
        
        return { issues: findings, formsFound: formIndex };
        
    } catch (error) {
        return { 
            issues: [{
                severity: 'error',
                message: `Ошибка анализа форм: ${error.message}`,
                remediation: 'Проверьте доступность сайта'
            }], 
            formsFound: 0 
        };
    }
}