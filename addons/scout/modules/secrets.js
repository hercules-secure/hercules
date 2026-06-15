// addons/scout/analyzer/secrets.js

export async function scanSecrets(baseUrl) {
    const findings = [];
    const secretsFound = [];
    
    try {
        const response = await fetch(baseUrl);
        const html = await response.text();
        
        // Паттерны для поиска секретов
        const secretPatterns = [
            { pattern: /api[_-]?key["']?\s*[:=]\s*["']([a-zA-Z0-9]{16,})["']/gi, name: 'API Key', severity: 'critical' },
            { pattern: /secret["']?\s*[:=]\s*["']([a-zA-Z0-9]{16,})["']/gi, name: 'Secret Key', severity: 'critical' },
            { pattern: /token["']?\s*[:=]\s*["']([a-zA-Z0-9]{16,})["']/gi, name: 'Token', severity: 'high' },
            { pattern: /password["']?\s*[:=]\s*["']([^"'\s]{6,})["']/gi, name: 'Password', severity: 'critical' },
            { pattern: /Authorization["']?\s*[:=]\s*["']Bearer\s+([a-zA-Z0-9._-]+)/gi, name: 'Bearer Token', severity: 'critical' },
            { pattern: /AKIA[0-9A-Z]{16}/g, name: 'AWS Access Key', severity: 'critical' },
            { pattern: /-----BEGIN RSA PRIVATE KEY-----/g, name: 'RSA Private Key', severity: 'critical' },
            { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: 'GitHub Token', severity: 'critical' },
            { pattern: /sk-[a-zA-Z0-9]{48}/g, name: 'OpenAI API Key', severity: 'critical' }
        ];
        
        for (const pattern of secretPatterns) {
            const matches = html.match(pattern.pattern) || [];
            for (const match of matches) {
                const value = match.split(/[:=]/)[1]?.trim().replace(/["']/g, '') || match;
                secretsFound.push({ type: pattern.name, value: value.substring(0, 20) + '...' });
                findings.push({
                    severity: pattern.severity,
                    message: `Обнаружен секрет: ${pattern.name}`,
                    location: value.substring(0, 50),
                    remediation: 'Удалите секреты из кода, используйте переменные окружения'
                });
            }
        }
        
        // Поиск в комментариях
        const commentPattern = /<!--([\s\S]*?)-->/g;
        let commentMatch;
        while ((commentMatch = commentPattern.exec(html)) !== null) {
            const comment = commentMatch[1];
            if (/(password|secret|key|token|pass)/i.test(comment)) {
                findings.push({
                    severity: 'medium',
                    message: 'Возможный секрет в HTML комментарии',
                    location: comment.substring(0, 100),
                    remediation: 'Удалите комментарии с чувствительной информацией'
                });
            }
        }
        
        return { secrets: secretsFound, issues: findings };
        
    } catch (error) {
        return { 
            secrets: [], 
            issues: [{
                severity: 'error',
                message: `Ошибка поиска секретов: ${error.message}`,
                remediation: 'Проверьте доступность сайта'
            }]
        };
    }
}