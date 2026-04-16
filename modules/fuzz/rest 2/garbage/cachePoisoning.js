function generateCachePoisoningTests(operation) {
    const testCases = [];
    const baseUrl = this.baseUrl;
    const pathUrl = operation.path;
    const method = operation.method;
    
    const cacheTests = [
        {
            name: 'cache_key_poisoning',
            headers: { 'X-Forwarded-Host': 'evil.com', 'X-Forwarded-Path': '/admin' },
            expectedStatus: [200, 400]
        },
        {
            name: 'cache_buster',
            queryParams: { _: Date.now(), cachebuster: Math.random() },
            expectedStatus: [200]
        },
        {
            name: 'vary_poisoning',
            headers: { 'Vary': 'X-Custom-Header', 'X-Custom-Header': 'evil' },
            expectedStatus: [200, 400]
        },
        {
            name: 'cache_control_injection',
            headers: { 'Cache-Control': 'no-cache, no-store, max-age=0, private, must-revalidate' },
            expectedStatus: [200]
        }
    ];
    
    for (const test of cacheTests) {
        testCases.push({
            id: `${method}_${pathUrl}_cache_${test.name}`,
            method: method,
            url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
            path: pathUrl,
            type: 'cache_poisoning',
            headers: test.headers || {},
            queryParams: test.queryParams || {},
            expectedStatus: test.expectedStatus,
            cacheTest: test.name
        });
    }
    
    return testCases;
}