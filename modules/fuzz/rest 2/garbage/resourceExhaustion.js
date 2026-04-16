function generateResourceExhaustionTests(operation) {
    const testCases = [];
    const baseUrl = this.baseUrl;
    const pathUrl = operation.path;
    const method = operation.method;
    
    const resourceTests = [
        {
            name: 'memory_exhaustion',
            body: { data: 'X'.repeat(100 * 1024 * 1024) }, // 100MB
            expectedStatus: [413, 500]
        },
        {
            name: 'cpu_exhaustion',
            body: { iterations: 10000000 },
            expectedStatus: [500, 504]
        },
        {
            name: 'connection_exhaustion',
            concurrentConnections: 1000,
            expectedStatus: [200, 429, 503]
        },
        {
            name: 'file_descriptor_exhaustion',
            repeatedRequests: 5000,
            expectedStatus: [200, 500]
        },
        {
            name: 'stack_exhaustion',
            body: { recursion: 10000 },
            expectedStatus: [500]
        },
        {
            name: 'regex_dos',
            body: { pattern: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!', text: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
            expectedStatus: [500, 504]
        }
    ];
    
    for (const test of resourceTests) {
        testCases.push({
            id: `${method}_${pathUrl}_resource_${test.name}`,
            method: method,
            url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
            path: pathUrl,
            type: 'resource_exhaustion',
            body: test.body || null,
            headers: test.headers || {},
            expectedStatus: test.expectedStatus,
            resourceType: test.name
        });
    }
    
    return testCases;
}