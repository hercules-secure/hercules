// StructureMutator.js
export default class StructureMutator {
    mutateObjectExtreme(obj, depth = 0, maxDepth = 10, seen = new WeakSet()) {
        if (obj === null || obj === undefined) return null;

        if (typeof obj === 'object') {
            if (seen.has(obj)) return null; // защита от повторов
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

            // Случайные циклы в нескольких полях
            if (Math.random() < 0.3 && keys.length > 0) {
                const cycleKey = keys[Math.floor(Math.random() * keys.length)];
                mutated[cycleKey] = mutated;
            }

            return mutated;
        }

        // Примитивы
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

    /**
     * Рекурсивно мутирует объект или массив для injection / large payload
     * @param {object|array} obj
     * @param {string} mode 'injection' | 'large'
     */
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
}