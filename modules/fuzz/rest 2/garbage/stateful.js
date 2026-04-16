async function generateStatefulTests(operations) {
    const testCases = [];
    
    // Создаем последовательности операций
    const sequences = [
        // CREATE -> READ -> UPDATE -> DELETE
        [
            { method: 'POST', type: 'create' },
            { method: 'GET', type: 'read' },
            { method: 'PUT', type: 'update' },
            { method: 'DELETE', type: 'delete' }
        ],
        // Неправильный порядок
        [
            { method: 'DELETE', type: 'delete' },
            { method: 'GET', type: 'read' }
        ],
        // Дублирование
        [
            { method: 'POST', type: 'create' },
            { method: 'POST', type: 'create' }
        ],
        // UPDATE без CREATE
        [
            { method: 'PUT', type: 'update' },
            { method: 'GET', type: 'read' }
        ]
    ];
    
    for (let seqIdx = 0; seqIdx < sequences.length; seqIdx++) {
        const sequence = sequences[seqIdx];
        const sequenceTestCases = [];
        
        for (let stepIdx = 0; stepIdx < sequence.length; stepIdx++) {
            const step = sequence[stepIdx];
            
            // Находим соответствующую операцию в спецификации
            const operation = this.findOperationByMethod(step.method);
            if (!operation) continue;
            
            sequenceTestCases.push({
                id: `stateful_${seqIdx}_${stepIdx}`,
                method: step.method,
                url: this.normalizeUrl(`${this.baseUrl}${operation.path}`),
                path: operation.path,
                type: 'stateful',
                sequenceId: seqIdx,
                step: stepIdx,
                expectedStatus: this.getExpectedStatefulStatus(step.type, stepIdx),
                dependsOn: stepIdx > 0 ? `stateful_${seqIdx}_${stepIdx - 1}` : null
            });
        }
        
        testCases.push(...sequenceTestCases);
    }
    
    return testCases;
}

function getExpectedStatefulStatus(operationType, step) {
    switch(operationType) {
        case 'create': return [200, 201, 202];
        case 'read': return [200, 404];
        case 'update': return [200, 404];
        case 'delete': return [200, 204, 404];
        default: return [200];
    }
}