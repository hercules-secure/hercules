function generateTimeoutTests(operation) {
    const testCases = [];
    const baseUrl = this.baseUrl;
    const pathUrl = operation.path;
    const method = operation.method;
    
    const timeouts = [1, 10, 100, 500, 1000, 5000];
    const longRunning = [10000, 30000, 60000];
    
    // Тесты с разными таймаутами
    for (const timeout of timeouts) {
        testCases.push({
            id: `${method}_${pathUrl}_timeout_${timeout}`,
            method: method,
            url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
            path: pathUrl,
            type: 'timeout',
            timeout: timeout,
            expectedStatus: [200, 408, 504]
        });
    }
    
    // Тесты с долгим выполнением
    for (const duration of longRunning) {
        testCases.push({
            id: `${method}_${pathUrl}_longrunning_${duration}`,
            method: method,
            url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
            path: pathUrl,
            type: 'long_running',
            longRunning: true,
            duration: duration,
            expectedStatus: [200, 202, 504]
        });
    }
    
    return testCases;
}