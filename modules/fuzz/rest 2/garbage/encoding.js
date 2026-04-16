function generateEncodingTests(operation) {
    const testCases = [];
    const baseUrl = this.baseUrl;
    const pathUrl = operation.path;
    const method = operation.method;
    
    const encodings = [
        { name: 'url_encoded', value: '%00%01%02%03%04%05' },
        { name: 'double_url_encoded', value: '%2500%2501%2502' },
        { name: 'unicode_escape', value: '\\u0000\\u0001\\u0002' },
        { name: 'base64', value: Buffer.from('test injection').toString('base64') },
        { name: 'hex', value: '0x00 0x01 0x02' },
        { name: 'octal', value: '\\000\\001\\002' },
        { name: 'null_byte', value: 'test\x00injection' },
        { name: 'newline', value: 'test\r\ninjection' },
        { name: 'tab', value: 'test\tinjection' },
        { name: 'backspace', value: 'test\binjection' },
        { name: 'form_feed', value: 'test\finjection' },
        { name: 'vertical_tab', value: 'test\vinjection' },
        { name: 'bell', value: 'test\ainjection' }
    ];
    
    for (const param of operation.parameters || []) {
        if (param.in === 'query' || param.in === 'path') {
            for (const encoding of encodings) {
                const params = {};
                params[param.name] = encoding.value;
                
                testCases.push({
                    id: `${method}_${pathUrl}_encoding_${param.name}_${encoding.name}`,
                    method: method,
                    url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
                    path: pathUrl,
                    type: 'encoding',
                    queryParams: params,
                    expectedStatus: [200, 400, 404, 422],
                    encoding: encoding.name,
                    paramName: param.name
                });
            }
        }
    }
    
    return testCases;
}