function generateProtocolViolationTests(operation) {
    const testCases = [];
    const baseUrl = this.baseUrl;
    const pathUrl = operation.path;
    const method = operation.method;
    
    const violations = [
        {
            name: 'invalid_method',
            method: 'INVALID',
            expectedStatus: [400, 405]
        },
        {
            name: 'wrong_content_type',
            headers: { 'Content-Type': 'text/plain' },
            body: 'This is plain text, not JSON',
            expectedStatus: [400, 415]
        },
        {
            name: 'malformed_json',
            body: '{invalid json: }',
            expectedStatus: [400]
        },
        {
            name: 'extra_fields',
            body: { __proto__: { polluted: true }, constructor: { prototype: { polluted: true } } },
            expectedStatus: [400, 422]
        },
        {
            name: 'negative_content_length',
            headers: { 'Content-Length': '-1' },
            expectedStatus: [400, 411]
        },
        {
            name: 'chunked_encoding_malformed',
            headers: { 'Transfer-Encoding': 'chunked' },
            body: '0\r\n\r\n',
            expectedStatus: [400]
        },
        {
            name: 'invalid_encoding',
            headers: { 'Accept-Encoding': 'gzip, deflate, br, invalid' },
            expectedStatus: [400, 406]
        },
        {
            name: 'http_version_0.9',
            httpVersion: '0.9',
            expectedStatus: [400, 505]
        }
    ];
    
    for (const violation of violations) {
        testCases.push({
            id: `${method}_${pathUrl}_protocol_${violation.name}`,
            method: violation.method || method,
            url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
            path: pathUrl,
            type: 'protocol_violation',
            headers: violation.headers || {},
            body: violation.body || null,
            expectedStatus: violation.expectedStatus,
            violation: violation.name
        });
    }
    
    return testCases;
}