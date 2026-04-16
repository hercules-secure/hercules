async function generateIdempotencyTests(operation) {
    const testCases = [];
    const baseUrl = this.baseUrl;
    const pathUrl = operation.path;
    const method = operation.method;
    
    // Только для idempotent методов
    const idempotentMethods = ['GET', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'];
    if (!idempotentMethods.includes(method.toUpperCase())) {
        return testCases;
    }
    
    const repetitions = [2, 5, 10];
    const delays = [0, 100, 1000];
    
    for (const repeat of repetitions) {
        for (const delay of delays) {
            for (let i = 0; i < repeat; i++) {
                testCases.push({
                    id: `${method}_${pathUrl}_idempotent_${repeat}_${delay}_${i}`,
                    method: method,
                    url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
                    path: pathUrl,
                    type: 'idempotency',
                    repetition: repeat,
                    repetitionIndex: i,
                    delay: delay,
                    expectedStatus: [200, 204, 404],
                    checkConsistency: true
                });
            }
        }
    }
    
    return testCases;
}