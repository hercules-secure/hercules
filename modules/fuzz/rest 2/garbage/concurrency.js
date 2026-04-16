'use strict'

async function generateConcurrencyTests(operation) {
    const testCases = [];
    const baseUrl = this.baseUrl;
    const pathUrl = operation.path;
    const method = operation.method;
    
    // Различные уровни параллелизма
    const concurrencyLevels = [10, 50, 100, 200, 500];
    
    for (const level of concurrencyLevels) {
        const concurrentRequests = [];
        for (let i = 0; i < level; i++) {
            concurrentRequests.push({
                id: `${method}_${pathUrl}_concurrency_${level}_${i}`,
                method: method,
                url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
                path: pathUrl,
                type: 'concurrency',
                concurrencyLevel: level,
                expectedStatus: [200, 429, 503, 500]
            });
        }
        testCases.push(...concurrentRequests);
    }
    
    return testCases;
}