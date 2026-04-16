function generateBoundaryTests(operation) {
    const testCases = [];
    const baseUrl = this.baseUrl;
    const pathUrl = operation.path;
    const method = operation.method;
    
    // Определяем граничные значения для каждого параметра
    for (const param of operation.parameters || []) {
        const paramName = param.name;
        const paramSchema = param.schema;
        
        if (!paramSchema) continue;
        
        const boundaryValues = [];
        
        // Числовые параметры
        if (paramSchema.type === 'integer' || paramSchema.type === 'number') {
            const min = paramSchema.minimum !== undefined ? paramSchema.minimum : -999999;
            const max = paramSchema.maximum !== undefined ? paramSchema.maximum : 999999;
            
            boundaryValues.push(
                min - 1,           // Ниже минимума
                min,               // Минимум
                min + 1,           // Выше минимума
                -1, 0, 1,          // Около нуля
                max - 1,           // Ниже максимума
                max,               // Максимум
                max + 1,           // Выше максимума
                Math.floor((min + max) / 2), // Середина
                Number.MAX_SAFE_INTEGER,
                Number.MIN_SAFE_INTEGER,
                Infinity,
                -Infinity,
                NaN
            );
        }
        
        // Строковые параметры
        if (paramSchema.type === 'string') {
            const minLength = paramSchema.minLength || 0;
            const maxLength = paramSchema.maxLength || 1000;
            
            boundaryValues.push(
                '',                      // Пустая строка
                'A'.repeat(minLength),   // Минимальная длина
                'A'.repeat(minLength + 1),
                'A'.repeat(maxLength - 1),
                'A'.repeat(maxLength),   // Максимальная длина
                'A'.repeat(maxLength + 1), // Превышение максимума
                'A'.repeat(10000),       // Очень длинная строка
                'null',
                'undefined',
                'NaN',
                'Infinity'
            );
        }
        
        // Массивы
        if (paramSchema.type === 'array') {
            const minItems = paramSchema.minItems || 0;
            const maxItems = paramSchema.maxItems || 100;
            
            const sampleItem = this.generatePayload(paramSchema.items);
            
            boundaryValues.push(
                [],                                    // Пустой массив
                Array(minItems).fill(sampleItem),      // Минимум элементов
                Array(minItems + 1).fill(sampleItem),
                Array(maxItems - 1).fill(sampleItem),
                Array(maxItems).fill(sampleItem),      // Максимум элементов
                Array(maxItems + 1).fill(sampleItem),  // Превышение
                Array(1000).fill(sampleItem)           // Очень большой массив
            );
        }
        
        // Для каждого граничного значения создаем тест
        for (let i = 0; i < boundaryValues.length; i++) {
            const params = {};
            if (param.in === 'query') {
                params[paramName] = boundaryValues[i];
            }
            
            testCases.push({
                id: `${method}_${pathUrl}_boundary_${paramName}_${i}`,
                method: method,
                url: this.normalizeUrl(`${baseUrl}${pathUrl}`),
                path: pathUrl,
                type: 'boundary',
                queryParams: params,
                expectedStatus: [200, 400, 422],
                boundaryValue: boundaryValues[i],
                paramName: paramName
            });
        }
    }
    
    return testCases;
}