
export function generateRateLimitTests(operation) {
    const testCases = [];
    const baseUrl = this.baseUrl;
    const pathUrl = operation.path;
    const method = operation.method;
    
    // Быстрая серия запросов (100 запросов за 1 секунду)
    const rapidRequests = [];
    for (let i = 0; i < 100; i++) {
        rapidRequests.push({
            id: `${method}_${pathUrl}_rate_rapid_${i}`,
            method: method,
            url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
            path: pathUrl,
            type: 'rate_limit_rapid',
            delay: 0,
            expectedStatus: [200, 429, 503]
        });
    }
    testCases.push(...rapidRequests);
    
    // Постепенное увеличение нагрузки
    const delays = [100, 50, 25, 10, 5, 2, 1, 0];
    for (let i = 0; i < delays.length; i++) {
        testCases.push({
            id: `${method}_${pathUrl}_rate_ramp_${i}`,
            method: method,
            url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
            path: pathUrl,
            type: 'rate_limit_ramp',
            delay: delays[i],
            burstSize: 10,
            expectedStatus: [200, 429, 503]
        });
    }
    
    return testCases;
}