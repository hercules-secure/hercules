// ============================================================
// VISUALIZATION.JS - ВИЗУАЛИЗАЦИЯ КОДА
// ============================================================

// Глобальные переменные
var selectedCodeFile = null;
var selectedDiagramType = 'dependency';
var selectedSourceType = 'file';

// ============================================================
// 1. ОСНОВНАЯ ФУНКЦИЯ ПАРСИНГА
// ============================================================
// Принимает код и расширение файла, возвращает структуру с функциями, вызовами и импортами
// ============================================================

function parseCodeForCallGraph(code, ext) {
    var result = {
        functions: [],
        calls: [],
        imports: [],
        exports: [],
        classFields: {} 
    };
    
    var lang = ext.toLowerCase();
    var codeWithoutComments = removeComments(code, lang);
    var lines = codeWithoutComments.split('\n');
    
    // Парсим импорты для всех языков
    result.imports = parseImports(code, lang);
    
    // Выбираем парсер в зависимости от языка
    switch(lang) {
        case 'js':
        case 'javascript':
        case 'ts':
        case 'typescript':
            parseJavaScript(code, lines, result);
            break;
        case 'py':
        case 'python':
            parsePython(code, lines, result);
            break;
        case 'java':
            parseJava(code, lines, result);
            break;
        case 'go':
            parseGo(code, lines, result);
            break;
        case 'rs':
        case 'rust':
            parseRust(code, lines, result);
            break;
        default:
            parseGeneric(code, lines, result);
    }
    result.classFields = extractClassFields(code, lang, result.functions);
    return result;
}

// ============================================================
// 2. УДАЛЕНИЕ КОММЕНТАРИЕВ
// ============================================================
// Удаляет комментарии из кода для чистого парсинга
// ============================================================

function removeComments(code, lang) {
    var result = code;
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');      // /* ... */
    result = result.replace(/\/\/.*$/gm, '');              // // ...
    result = result.replace(/#.*$/gm, '');                 // # ...
    result = result.replace(/""".*?"""/gs, '');            // """ ... """
    result = result.replace(/'''.*?'''/gs, '');            // ''' ... '''
    return result;
}

// ============================================================
// 3. ПАРСИНГ JAVASCRIPT / TYPESCRIPT
// ============================================================
// Находит функции (function, arrow, class, method) и вызовы
// ============================================================

function parseJavaScript(code, lines, result) {
    // Поиск функций: function name(params) { ... }
    var functionRegex = /function\s+(\w+)\s*\(([^)]*)\)/g;
    var arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\(([^)]*)\)\s*=>|([^=]+)\s*=>)/g;
    var classRegex = /class\s+(\w+)/g;
    
    var match;
    
    // Ищем обычные функции
    while ((match = functionRegex.exec(code)) !== null) {
        var params = match[2] ? match[2].split(',').map(function(p) { return p.trim(); }) : [];
        result.functions.push({
            name: match[1],
            params: params,
            type: 'function',
            line: getLineNumber(code, match.index)
        });
    }
    
    // Ищем стрелочные функции
    while ((match = arrowRegex.exec(code)) !== null) {
        var name = match[1] || match[3];
        if (name) {
            var params = [];
            if (match[2]) {
                params = match[2].split(',').map(function(p) { return p.trim(); });
            }
            result.functions.push({
                name: name.trim(),
                params: params,
                type: 'arrow',
                line: getLineNumber(code, match.index)
            });
        }
    }
    
    // Ищем классы
    while ((match = classRegex.exec(code)) !== null) {
        result.functions.push({
            name: match[1],
            params: [],
            type: 'class',
            line: getLineNumber(code, match.index)
        });
    }
    
    // Ищем методы (исключаем ключевые слова)
    var methodRegex = /(\w+)\s*\([^)]*\)\s*\{/g;
    var reservedMethods = ['if', 'for', 'while', 'switch', 'catch', 'try', 'else', 'case', 'default', 'with'];
    
    while ((match = methodRegex.exec(code)) !== null) {
        var methodName = match[1];
        if (reservedMethods.indexOf(methodName) !== -1) {
            continue; // Пропускаем ключевые слова
        }
        var existing = result.functions.some(function(f) { return f.name === methodName && f.type === 'method'; });
        if (!existing) {
            result.functions.push({
                name: methodName,
                params: [],
                type: 'method',
                line: getLineNumber(code, match.index)
            });
        }
    }
    
    // Поиск вызовов функций
    var callRegex = /(\w+)\s*\([^)]*\)/g;
    var callSet = new Set();
    
    // Все зарезервированные слова JavaScript
    var reserved = [
        'if', 'for', 'while', 'switch', 'return', 'console', 
        'require', 'import', 'export', 'new', 'throw', 
        'catch', 'finally', 'typeof', 'instanceof', 
        'void', 'delete', 'yield', 'await', 'async',
        'try', 'else', 'case', 'default', 'break', 'continue',
        'debugger', 'function', 'class', 'interface', 'extends',
        'implements', 'package', 'private', 'protected', 'public',
        'static', 'this', 'super', 'with', 'let', 'var', 'const',
        'get', 'set', 'of', 'from', 'as', 'in', 'is', 'new',
        'target', 'arguments', 'eval', 'has', 'own', 'property',
        'enumerable', 'configurable', 'writable', 'value',
        'getPrototypeOf', 'setPrototypeOf', 'getOwnPropertyDescriptor',
        'getOwnPropertyNames', 'create', 'defineProperty', 'defineProperties',
        'seal', 'freeze', 'preventExtensions', 'isSealed', 'isFrozen',
        'isExtensible', 'keys', 'values', 'entries'
    ];
    
    while ((match = callRegex.exec(code)) !== null) {
        var caller = match[1];
        if (reserved.indexOf(caller) !== -1) {
            continue; // Пропускаем зарезервированные слова
        }
        if (!callSet.has(caller)) {
            callSet.add(caller);
            var calledFrom = findCallingFunction(code, match.index, result.functions);
            // Проверяем, что вызываемая функция существует
            var isFunctionCall = result.functions.some(function(f) { return f.name === caller; });
            if (isFunctionCall) {
                result.calls.push({
                    from: calledFrom || 'global',
                    to: caller,
                    line: getLineNumber(code, match.index)
                });
            }
        }
    }
}

// ============================================================
// 4. ПАРСИНГ PYTHON
// ============================================================
// Находит функции (def, class) и вызовы с определением контекста
// ============================================================

function parsePython(code, lines, result) {
    // Поиск функций: def name(params):
    var funcRegex = /def\s+(\w+)\s*\(([^)]*)\)/g;
    var classRegex = /class\s+(\w+)/g;
    var callRegex = /(\w+)\s*\([^)]*\)/g;
    
    var match;
    
    // Ищем функции
    while ((match = funcRegex.exec(code)) !== null) {
        var params = match[2] ? match[2].split(',').map(function(p) { return p.trim(); }) : [];
        result.functions.push({
            name: match[1],
            params: params,
            type: 'function',
            line: getLineNumber(code, match.index)
        });
    }
    
    // Ищем классы
    while ((match = classRegex.exec(code)) !== null) {
        result.functions.push({
            name: match[1],
            params: [],
            type: 'class',
            line: getLineNumber(code, match.index)
        });
    }
    
    // Поиск вызовов
    var callSet = new Set();
    var reserved = ['if', 'for', 'while', 'return', 'print', 'len', 'range', 'type', 'isinstance', 'super', 'self', 'cls', 'import', 'from', 'as', 'with', 'except', 'finally', 'raise', 'assert', 'lambda', 'yield', 'global', 'nonlocal'];
    
    while ((match = callRegex.exec(code)) !== null) {
        var caller = match[1];
        if (reserved.indexOf(caller) !== -1) {
            continue;
        }
        if (!callSet.has(caller)) {
            callSet.add(caller);
            var calledFrom = findCallingFunctionPython(code, match.index, result.functions);
            var isFunctionCall = result.functions.some(function(f) { return f.name === caller; });
            if (isFunctionCall) {
                result.calls.push({
                    from: calledFrom || 'global',
                    to: caller,
                    line: getLineNumber(code, match.index)
                });
            }
        }
    }
}

// ============================================================
// 5. ПОИСК ВЫЗЫВАЮЩЕЙ ФУНКЦИИ ДЛЯ PYTHON
// ============================================================
// Определяет, из какой функции был сделан вызов (по отступам)
// ============================================================

function findCallingFunctionPython(code, index, functions) {
    var before = code.substring(0, index);
    var lines = before.split('\n');
    var currentLine = lines.length;
    
    var bestMatch = null;
    var bestLine = -1;
    
    for (var i = 0; i < functions.length; i++) {
        var fn = functions[i];
        if (fn.line < currentLine) {
            var fnStart = getFunctionStartPython(code, fn.name);
            var fnEnd = getFunctionEndPython(code, fnStart);
            if (index > fnStart && index < fnEnd) {
                if (fn.line > bestLine) {
                    bestLine = fn.line;
                    bestMatch = fn.name;
                }
            }
        }
    }
    
    return bestMatch || 'global';
}

function getFunctionStartPython(code, name) {
    var regex = new RegExp('def\\s+' + name + '\\s*\\(', 'g');
    var match = regex.exec(code);
    return match ? match.index : -1;
}

function getFunctionEndPython(code, start) {
    if (start === -1) return -1;
    
    var indent = null;
    var lines = code.substring(start).split('\n');
    var result = start;
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (i === 0) continue;
        
        var leadingSpaces = line.length - line.trimLeft().length;
        if (indent === null && line.trim() !== '') {
            indent = leadingSpaces;
        }
        
        if (indent !== null && line.trim() !== '' && leadingSpaces < indent) {
            result = start + lines.slice(0, i).join('\n').length;
            break;
        }
    }
    
    return result;
}

// ============================================================
// 6. ПАРСИНГ JAVA
// ============================================================
// Находит классы, методы и вызовы
// ============================================================

function parseJava(code, lines, result) {
    var methodRegex = /(?:public|private|protected)?\s*(?:static)?\s*(\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    var classRegex = /class\s+(\w+)/g;
    var match;
    
    // Ищем классы
    while ((match = classRegex.exec(code)) !== null) {
        result.functions.push({
            name: match[1],
            params: [],
            type: 'class',
            line: getLineNumber(code, match.index)
        });
    }
    
    // Ищем методы
    while ((match = methodRegex.exec(code)) !== null) {
        var returnType = match[1];
        var methodName = match[2];
        if (returnType === 'if' || returnType === 'for' || returnType === 'while' || returnType === 'switch') continue;
        var params = match[3] ? match[3].split(',').map(function(p) { return p.trim(); }).filter(function(p) { return p !== ''; }) : [];
        result.functions.push({
            name: methodName,
            params: params,
            type: 'method',
            line: getLineNumber(code, match.index)
        });
    }
    
    // Поиск вызовов
    var callRegex = /(\w+)\s*\([^)]*\)/g;
    var callSet = new Set();
    var reserved = ['if', 'for', 'while', 'switch', 'return', 'new', 'throw', 'catch', 'try', 'finally', 'super', 'this', 'class', 'interface', 'extends', 'implements'];
    
    while ((match = callRegex.exec(code)) !== null) {
        var caller = match[1];
        if (reserved.indexOf(caller) !== -1) continue;
        if (!callSet.has(caller)) {
            callSet.add(caller);
            var calledFrom = findCallingFunction(code, match.index, result.functions);
            var isFunctionCall = result.functions.some(function(f) { return f.name === caller; });
            if (isFunctionCall) {
                result.calls.push({
                    from: calledFrom || 'global',
                    to: caller,
                    line: getLineNumber(code, match.index)
                });
            }
        }
    }
}

// ============================================================
// 7. ПАРСИНГ GO

// ============================================================
// ПАРСИНГ GO - УЛУЧШЕННЫЙ
// ============================================================

function parseGo(code, lines, result) {
    var funcRegex = /func\s+(\w+)\s*\(([^)]*)\)\s*(?:\([^)]*\))?\s*\{/g;
    var methodRegex = /func\s+\([^)]+\)\s+(\w+)\s*\(([^)]*)\)\s*(?:\([^)]*\))?\s*\{/g;
    var typeRegex = /type\s+(\w+)\s+(?:struct|interface)/g;
    var match;
    
    // Ищем структуры
    parseGoStructs(code, result);
    
    // Ищем функции
    while ((match = funcRegex.exec(code)) !== null) {
        var params = match[2] ? match[2].split(',').map(function(p) { return p.trim(); }).filter(function(p) { return p !== '' && !p.includes(' '); }) : [];
        result.functions.push({
            name: match[1],
            params: params,
            type: 'function',
            line: getLineNumber(code, match.index)
        });
    }
    
    // Ищем методы
    while ((match = methodRegex.exec(code)) !== null) {
        var params = match[2] ? match[2].split(',').map(function(p) { return p.trim(); }).filter(function(p) { return p !== '' && !p.includes(' '); }) : [];
        result.functions.push({
            name: match[1],
            params: params,
            type: 'method',
            line: getLineNumber(code, match.index)
        });
    }
    
    // ============================================================
    // ПОИСК ВЫЗОВОВ (включая методы)
    // ============================================================
    var callSet = new Set();
    var reserved = ['if', 'for', 'switch', 'return', 'go', 'defer', 'select', 'close', 'panic', 'recover', 'make', 'new', 'cap', 'len', 'append', 'copy', 'delete', 'print', 'println', 'range', 'fmt'];
    
    // Ищем вызовы функций и методов: name(...) или obj.Method(...)
    var callRegex = /(\w+)\.?(\w+)?\s*\([^)]*\)/g;
    
    while ((match = callRegex.exec(code)) !== null) {
        var caller = match[1];      // имя функции или объекта
        var method = match[2];       // имя метода (если есть)
        var callName = method || caller;
        
        // Пропускаем зарезервированные слова
        if (reserved.indexOf(callName) !== -1) {
            continue;
        }
        if (reserved.indexOf(caller) !== -1) {
            continue;
        }
        
        // Пропускаем если это вызов через точку (obj.Method) - сохраняем только метод
        if (method) {
            callName = method;
        }
        
        // Проверяем, что вызываемая функция существует
        var isFunctionCall = result.functions.some(function(f) { return f.name === callName; });
        if (!isFunctionCall) {
            // Проверяем, может это функция из импорта (например, fmt.Println)
            var isExternal = callName === 'Println' || callName === 'Printf' || callName === 'Errorf' || callName === 'Wrap' || callName === 'New';
            if (!isExternal) {
                continue;
            }
        }
        
        if (!callSet.has(callName)) {
            callSet.add(callName);
            var calledFrom = findCallingFunction(code, match.index, result.functions);
            
            // Добавляем вызов, даже если вызываемая функция не найдена (для внешних функций)
            result.calls.push({
                from: calledFrom || 'global',
                to: callName,
                line: getLineNumber(code, match.index)
            });
        }
    }
}
// ============================================================
// 8. ПАРСИНГ RUST
// ============================================================
// Находит функции, структуры и вызовы
// ============================================================

function parseRust(code, lines, result) {
    var funcRegex = /fn\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*[^{]+)?\s*\{/g;
    var structRegex = /struct\s+(\w+)/g;
    var implRegex = /impl\s+([^{]+)\s*\{/g;
    var match;
    
    // Ищем структуры
    while ((match = structRegex.exec(code)) !== null) {
        result.functions.push({
            name: match[1],
            params: [],
            type: 'struct',
            line: getLineNumber(code, match.index)
        });
    }
    
    // Ищем функции
    while ((match = funcRegex.exec(code)) !== null) {
        var params = match[2] ? match[2].split(',').map(function(p) { return p.trim(); }).filter(function(p) { return p !== '' && !p.includes(':'); }) : [];
        result.functions.push({
            name: match[1],
            params: params,
            type: 'function',
            line: getLineNumber(code, match.index)
        });
    }
    
    // Поиск вызовов
    var callRegex = /(\w+)\s*\([^)]*\)/g;
    var callSet = new Set();
    var reserved = ['if', 'for', 'while', 'return', 'match', 'loop', 'continue', 'break', 'unsafe', 'pub', 'use', 'mod', 'crate', 'self', 'super', 'struct', 'enum', 'impl', 'trait', 'fn', 'let', 'mut', 'const', 'static', 'type', 'where', 'async', 'await', 'move', 'ref', 'dyn', 'impl', 'box', 'in', 'as', 'from', 'into'];
    
    while ((match = callRegex.exec(code)) !== null) {
        var caller = match[1];
        if (reserved.indexOf(caller) !== -1) continue;
        if (!callSet.has(caller)) {
            callSet.add(caller);
            var calledFrom = findCallingFunction(code, match.index, result.functions);
            var isFunctionCall = result.functions.some(function(f) { return f.name === caller; });
            if (isFunctionCall) {
                result.calls.push({
                    from: calledFrom || 'global',
                    to: caller,
                    line: getLineNumber(code, match.index)
                });
            }
        }
    }
}

// ============================================================
// 9. УНИВЕРСАЛЬНЫЙ ПАРСИНГ (ДЛЯ ДРУГИХ ЯЗЫКОВ)
// ============================================================
// Используется если язык не распознан
// ============================================================

function parseGeneric(code, lines, result) {
    var funcKeywords = ['function', 'def', 'func', 'fn', 'public', 'private', 'protected'];
    var regex = new RegExp('(?:' + funcKeywords.join('|') + ')\\s+(\\w+)\\s*\\(([^)]*)\\)', 'g');
    
    var match;
    while ((match = regex.exec(code)) !== null) {
        var params = match[2] ? match[2].split(',').map(function(p) { return p.trim(); }) : [];
        result.functions.push({
            name: match[1],
            params: params,
            type: 'function',
            line: getLineNumber(code, match.index)
        });
    }
    
    var callRegex = /(\w+)\s*\([^)]*\)/g;
    var callSet = new Set();
    var reserved = ['if', 'for', 'while', 'switch', 'return', 'new', 'throw'];
    
    while ((match = callRegex.exec(code)) !== null) {
        var caller = match[1];
        if (reserved.indexOf(caller) !== -1) continue;
        if (!callSet.has(caller)) {
            callSet.add(caller);
            var calledFrom = findCallingFunction(code, match.index, result.functions);
            var isFunctionCall = result.functions.some(function(f) { return f.name === caller; });
            if (isFunctionCall) {
                result.calls.push({
                    from: calledFrom || 'global',
                    to: caller,
                    line: getLineNumber(code, match.index)
                });
            }
        }
    }
}

// ============================================================
// 10. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПАРСИНГА
// ============================================================
// Определяют номер строки, начало и конец функции
// ============================================================

function getLineNumber(code, index) {
    var before = code.substring(0, index);
    return before.split('\n').length;
}

// Поиск функции, из которой был сделан вызов (по номеру строки)
function findCallingFunction(code, index, functions) {
    var before = code.substring(0, index);
    var lines = before.split('\n');
    var currentLine = lines.length;
    
    var bestMatch = null;
    var bestLine = -1;
    
    for (var i = 0; i < functions.length; i++) {
        var fn = functions[i];
        if (fn.line < currentLine) {
            var fnStart = getFunctionStart(code, fn.name);
            var fnEnd = getFunctionEnd(code, fnStart);
            if (index > fnStart && index < fnEnd) {
                if (fn.line > bestLine) {
                    bestLine = fn.line;
                    bestMatch = fn.name;
                }
            }
        }
    }
    
    return bestMatch || 'global';
}

// Поиск начала функции
function getFunctionStart(code, name) {
    var patterns = [
        'function\\s+' + name + '\\s*\\(',
        'def\\s+' + name + '\\s*\\(',
        'func\\s+' + name + '\\s*\\(',
        'fn\\s+' + name + '\\s*\\(',
        name + '\\s*\\([^)]*\\)\\s*\\{'
    ];
    for (var i = 0; i < patterns.length; i++) {
        var regex = new RegExp(patterns[i], 'g');
        var match = regex.exec(code);
        if (match) return match.index;
    }
    return -1;
}

// Поиск конца функции (по скобкам)
function getFunctionEnd(code, start) {
    if (start === -1) return -1;
    
    var brackets = 0;
    var inString = false;
    var inComment = false;
    var inRegex = false;
    
    for (var i = start; i < code.length; i++) {
        var char = code[i];
        var nextChar = code[i + 1] || '';
        var prevChar = code[i - 1] || '';
        
        // Обработка строк
        if (char === '"' || char === "'" || char === '`') {
            if (!inComment && !inRegex && prevChar !== '\\') {
                inString = !inString;
            }
        }
        
        // Обработка комментариев
        if (!inString && !inRegex) {
            if (char === '/' && nextChar === '/') {
                inComment = true;
            }
            if (char === '\n') {
                inComment = false;
            }
            if (char === '/' && nextChar === '*') {
                inComment = true;
            }
            if (char === '*' && nextChar === '/') {
                inComment = false;
                i++;
            }
        }
        
        // Обработка регулярных выражений
        if (!inString && !inComment && char === '/' && prevChar !== '\\' && !/[a-zA-Z0-9_]/.test(prevChar)) {
            inRegex = !inRegex;
        }
        
        // Подсчет скобок
        if (!inString && !inComment && !inRegex) {
            if (char === '{' || char === '(' || char === '[') {
                brackets++;
            }
            if (char === '}' || char === ')' || char === ']') {
                brackets--;
                if (brackets === 0) {
                    return i;
                }
            }
        }
    }
    return code.length;
}


// ============================================================
// ИЗВЛЕЧЕНИЕ ПОЛЕЙ КЛАССОВ ДЛЯ ВСЕХ ЯЗЫКОВ
// ============================================================

function extractClassFields(code, lang, functions) {
    var classFields = {};
    
    // Находим все классы
    var classes = functions.filter(function(f) { 
        return f.type === 'class' || f.type === 'struct'; 
    });
    
    classes.forEach(function(cls) {
        classFields[cls.name] = [];
    });
    
    switch(lang) {
        case 'js':
        case 'javascript':
        case 'ts':
        case 'typescript':
            extractJSFields(code, classFields);
            break;
        case 'py':
        case 'python':
            extractPythonFields(code, classFields);
            break;
        case 'java':
            extractJavaFields(code, classFields);
            break;
        case 'go':
            extractGoFields(code, classFields);
            break;
        case 'php':
            extractPHPFields(code, classFields);
            break;
        case 'rs':
        case 'rust':
            extractRustFields(code, classFields);
            break;
    }
    
    return classFields;
}

// ============================================================
// ПОЛЯ ДЛЯ JAVASCRIPT / TYPESCRIPT
// ============================================================

function extractJSFields(code, classFields) {
    // this.field = value;
    var fieldRegex = /this\.(\w+)\s*=\s*[^;]+;/g;
    var match;
    while ((match = fieldRegex.exec(code)) !== null) {
        var fieldName = match[1];
        var className = findCurrentClass(code, match.index);
        if (className && classFields[className]) {
            if (classFields[className].indexOf(fieldName) === -1) {
                classFields[className].push(fieldName);
            }
        }
    }
}

// ============================================================
// ПОЛЯ ДЛЯ PYTHON
// ============================================================

function extractPythonFields(code, classFields) {
    // self.field = value
    var fieldRegex = /self\.(\w+)\s*=\s*[^;\n]+/g;
    var match;
    while ((match = fieldRegex.exec(code)) !== null) {
        var fieldName = match[1];
        var className = findCurrentClassPython(code, match.index);
        if (className && classFields[className]) {
            if (classFields[className].indexOf(fieldName) === -1) {
                classFields[className].push(fieldName);
            }
        }
    }
}

function findCurrentClassPython(code, index) {
    var before = code.substring(0, index);
    var classRegex = /class\s+(\w+)\s*[:\(]/g;
    var match;
    var lastClass = null;
    var lastIndex = -1;
    while ((match = classRegex.exec(before)) !== null) {
        if (match.index < index && match.index > lastIndex) {
            lastIndex = match.index;
            lastClass = match[1];
        }
    }
    return lastClass;
}

// ============================================================
// ПОЛЯ ДЛЯ JAVA
// ============================================================

function extractJavaFields(code, classFields) {
    var fieldRegex = /(?:private|public|protected)?\s*(?:static)?\s*(?:final)?\s*(\w+)\s+(\w+)\s*[;=]/g;
    var match;
    while ((match = fieldRegex.exec(code)) !== null) {
        var fieldType = match[1];
        var fieldName = match[2];
        var className = findCurrentClassJava(code, match.index);
        if (className && classFields[className]) {
            var reserved = ['if', 'for', 'while', 'switch', 'return', 'new', 'throw', 'catch', 'try', 'finally'];
            if (reserved.indexOf(fieldName) === -1) {
                var display = fieldName + (fieldType ? ': ' + fieldType : '');
                if (classFields[className].indexOf(display) === -1) {
                    classFields[className].push(display);
                }
            }
        }
    }
}

function findCurrentClassJava(code, index) {
    var before = code.substring(0, index);
    var classRegex = /class\s+(\w+)/g;
    var match;
    var lastClass = null;
    var lastIndex = -1;
    while ((match = classRegex.exec(before)) !== null) {
        if (match.index < index && match.index > lastIndex) {
            lastIndex = match.index;
            lastClass = match[1];
        }
    }
    return lastClass;
}

// ============================================================
// ПОЛЯ ДЛЯ GO
// ============================================================

// ============================================================
// ПАРСИНГ GO - СТРУКТУРЫ ИЗ БЛОКОВ
// ============================================================

function parseGoStructs(code, result) {
    // 1. Обычные структуры: type Name struct { ... }
    var structRegex = /type\s+(\w+)\s+struct\s*\{([^}]*)\}/g;
    var match;
    while ((match = structRegex.exec(code)) !== null) {
        var structName = match[1];
        var body = match[2];
        result.functions.push({
            name: structName,
            params: [],
            type: 'struct',
            line: getLineNumber(code, match.index)
        });
        // Сохраняем тело структуры для полей
        if (!result._structBodies) result._structBodies = {};
        result._structBodies[structName] = body;
    }
    
    // 2. Блочные структуры: type ( Name struct { ... } )
    var blockRegex = /type\s*\(\s*([^)]*)\s*\)/g;
    while ((match = blockRegex.exec(code)) !== null) {
        var blockContent = match[1];
        // Ищем структуры внутри блока
        var innerStructRegex = /(\w+)\s+struct\s*\{([^}]*)\}/g;
        var innerMatch;
        while ((innerMatch = innerStructRegex.exec(blockContent)) !== null) {
            var structName = innerMatch[1];
            var body = innerMatch[2];
            result.functions.push({
                name: structName,
                params: [],
                type: 'struct',
                line: getLineNumber(code, match.index + innerMatch.index)
            });
            if (!result._structBodies) result._structBodies = {};
            result._structBodies[structName] = body;
        }
    }
}

// ============================================================
// ИЗВЛЕЧЕНИЕ ПОЛЕЙ ДЛЯ GO (ОБНОВЛЕННОЕ)
// ============================================================

function extractGoFields(code, classFields) {
    // 1. Обычные структуры
    var structRegex = /type\s+(\w+)\s+struct\s*\{([^}]*)\}/g;
    var match;
    while ((match = structRegex.exec(code)) !== null) {
        var structName = match[1];
        var body = match[2];
        if (classFields[structName]) {
            extractFieldsFromStructBody(body, classFields[structName]);
        }
    }
    
    // 2. Блочные структуры: type ( ... )
    var blockRegex = /type\s*\(\s*([^)]*)\s*\)/g;
    while ((match = blockRegex.exec(code)) !== null) {
        var blockContent = match[1];
        var innerStructRegex = /(\w+)\s+struct\s*\{([^}]*)\}/g;
        var innerMatch;
        while ((innerMatch = innerStructRegex.exec(blockContent)) !== null) {
            var structName = innerMatch[1];
            var body = innerMatch[2];
            if (classFields[structName]) {
                extractFieldsFromStructBody(body, classFields[structName]);
            }
        }
    }
}

function extractFieldsFromStructBody(body, fieldList) {
    var fieldRegex = /(\w+)\s+(\w+)/g;
    var fMatch;
    while ((fMatch = fieldRegex.exec(body)) !== null) {
        var fieldName = fMatch[1];
        var fieldType = fMatch[2];
        // Пропускаем теги
        if (fieldName !== 'json' && fieldName !== 'xml' && fieldName !== 'yaml' && fieldName !== 'db') {
            var display = fieldName + ': ' + fieldType;  // ← формат "Имя: Тип"
            if (fieldList.indexOf(display) === -1) {
                fieldList.push(display);
            }
        }
    }
}

// ============================================================
// ПОЛЯ ДЛЯ PHP
// ============================================================

function extractPHPFields(code, classFields) {
    var fieldRegex = /(?:public|private|protected)\s+\$(\w+)\s*[;=]/g;
    var match;
    while ((match = fieldRegex.exec(code)) !== null) {
        var fieldName = match[1];
        var className = findCurrentClassPHP(code, match.index);
        if (className && classFields[className]) {
            if (classFields[className].indexOf(fieldName) === -1) {
                classFields[className].push(fieldName);
            }
        }
    }
}

function findCurrentClassPHP(code, index) {
    var before = code.substring(0, index);
    var classRegex = /class\s+(\w+)/g;
    var match;
    var lastClass = null;
    var lastIndex = -1;
    while ((match = classRegex.exec(before)) !== null) {
        if (match.index < index && match.index > lastIndex) {
            lastIndex = match.index;
            lastClass = match[1];
        }
    }
    return lastClass;
}

// ============================================================
// ПОЛЯ ДЛЯ RUST
// ============================================================

function extractRustFields(code, classFields) {
    var structRegex = /struct\s+(\w+)\s*\{([^}]*)\}/g;
    var match;
    while ((match = structRegex.exec(code)) !== null) {
        var structName = match[1];
        var body = match[2];
        if (classFields[structName]) {
            var fieldRegex = /(\w+)\s*:\s*[^,}]+/g;
            var fMatch;
            while ((fMatch = fieldRegex.exec(body)) !== null) {
                var fieldName = fMatch[1];
                if (classFields[structName].indexOf(fieldName) === -1) {
                    classFields[structName].push(fieldName);
                }
            }
        }
    }
}

// ============================================================
// ПОИСК ТЕКУЩЕГО КЛАССА ДЛЯ JS
// ============================================================

function findCurrentClass(code, index) {
    var before = code.substring(0, index);
    var classRegex = /class\s+(\w+)/g;
    var match;
    var lastClass = null;
    var lastIndex = -1;
    while ((match = classRegex.exec(before)) !== null) {
        if (match.index < index && match.index > lastIndex) {
            lastIndex = match.index;
            lastClass = match[1];
        }
    }
    return lastClass;
}


// ============================================================
// 11. ПАРСИНГ ИМПОРТОВ (ЗАВИСИМОСТЕЙ) - ВСЕ ЯЗЫКИ
// ============================================================
// Находит импорты/зависимости в коде
// ============================================================

function parseImports(code, lang) {
    var imports = [];
    
    // ============================================================
    // JAVASCRIPT / TYPESCRIPT
    // ============================================================
    if (lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'typescript' || 
        lang === 'jsx' || lang === 'tsx') {
        
        // import ... from '...'
        var importRegex = /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
        var match;
        while ((match = importRegex.exec(code)) !== null) {
            var items = [];
            if (match[1]) {
                items = match[1].split(',').map(function(i) { return i.trim(); });
            } else if (match[2]) {
                items = [match[2]];
            }
            var modulePath = match[3];
            var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..') || modulePath.startsWith('/');
            imports.push({
                module: modulePath,
                items: items,
                type: 'named',
                isLocal: isLocal,
                isExternal: !isLocal,
                language: 'javascript'
            });
        }
        
        // import * as ... from '...'
        var starRegex = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
        while ((match = starRegex.exec(code)) !== null) {
            var modulePath = match[2];
            var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..') || modulePath.startsWith('/');
            imports.push({
                module: modulePath,
                items: [match[1]],
                type: 'star',
                isLocal: isLocal,
                isExternal: !isLocal,
                language: 'javascript'
            });
        }
        
        // require('...')
        var requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = requireRegex.exec(code)) !== null) {
            var modulePath = match[1];
            var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..') || modulePath.startsWith('/');
            imports.push({
                module: modulePath,
                items: ['*'],
                type: 'require',
                isLocal: isLocal,
                isExternal: !isLocal,
                language: 'javascript'
            });
        }
    }
    
    // ============================================================
    // PYTHON
    // ============================================================
    if (lang === 'py' || lang === 'python') {
        // import module
        var importRegex = /import\s+(\w+)/g;
        var match;
        while ((match = importRegex.exec(code)) !== null) {
            var modulePath = match[1];
            imports.push({
                module: modulePath,
                items: ['*'],
                type: 'import',
                isLocal: modulePath.startsWith('.'),
                isExternal: !modulePath.startsWith('.'),
                language: 'python'
            });
        }
        
        // from module import ...
        var fromRegex = /from\s+([^\s]+)\s+import\s+([^\n]+)/g;
        while ((match = fromRegex.exec(code)) !== null) {
            var modulePath = match[1];
            var items = match[2].split(',').map(function(i) { return i.trim(); });
            imports.push({
                module: modulePath,
                items: items,
                type: 'from',
                isLocal: modulePath.startsWith('.'),
                isExternal: !modulePath.startsWith('.'),
                language: 'python'
            });
        }
    }
    
    // ============================================================
    // JAVA
    // ============================================================
    if (lang === 'java') {
        var importRegex = /import\s+([^;]+);/g;
        var match;
        while ((match = importRegex.exec(code)) !== null) {
            var modulePath = match[1];
            imports.push({
                module: modulePath,
                items: ['*'],
                type: 'import',
                isLocal: modulePath.startsWith('com.') || modulePath.startsWith('org.') || modulePath.startsWith('net.'),
                isExternal: !(modulePath.startsWith('com.') || modulePath.startsWith('org.') || modulePath.startsWith('net.')),
                language: 'java'
            });
        }
    }
    
    // ============================================================
    // GO
    // ============================================================
    // ============================================================
// GO (.go)
// ============================================================
if (lang === 'go') {
    // Обычный импорт: import "module"
    var importRegex = /import\s+["']([^"']+)["']/g;
    var match;
    while ((match = importRegex.exec(code)) !== null) {
        var modulePath = match[1];
        var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..');
        imports.push({
            module: modulePath,
            items: ['*'],
            type: 'import',
            isLocal: isLocal,
            isExternal: !isLocal,
            language: 'go'
        });
    }
    
    // Импорт с точкой: import . "module"
    var dotRegex = /import\s+\.\s+["']([^"']+)["']/g;
    while ((match = dotRegex.exec(code)) !== null) {
        var modulePath = match[1];
        var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..');
        imports.push({
            module: modulePath,
            items: ['*'],
            type: 'dot-import',
            isLocal: isLocal,
            isExternal: !isLocal,
            language: 'go',
            isDotImport: true  // помечаем, что это импорт с точкой
        });
    }
    
    // Импорт с алиасом: import alias "module"
    var aliasRegex = /import\s+(\w+)\s+["']([^"']+)["']/g;
    while ((match = aliasRegex.exec(code)) !== null) {
        var alias = match[1];
        var modulePath = match[2];
        var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..');
        imports.push({
            module: modulePath,
            items: ['*'],
            type: 'alias-import',
            alias: alias,
            isLocal: isLocal,
            isExternal: !isLocal,
            language: 'go'
        });
    }
    
    // Блочный импорт: import ( "module1" "module2" )
    var blockRegex = /import\s*\(\s*([^)]+)\s*\)/g;
    while ((match = blockRegex.exec(code)) !== null) {
        var lines = match[1].split('\n');
        lines.forEach(function(line) {
            line = line.trim();
            if (!line) return;
            
            // Проверяем на импорт с точкой
            var dotMatch = line.match(/^\.\s+["']([^"']+)["']/);
            if (dotMatch) {
                var modulePath = dotMatch[1];
                var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..');
                imports.push({
                    module: modulePath,
                    items: ['*'],
                    type: 'dot-import',
                    isLocal: isLocal,
                    isExternal: !isLocal,
                    language: 'go',
                    isDotImport: true
                });
                return;
            }
            
            // Проверяем на импорт с алиасом
            var aliasMatch = line.match(/^(\w+)\s+["']([^"']+)["']/);
            if (aliasMatch) {
                var alias = aliasMatch[1];
                var modulePath = aliasMatch[2];
                var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..');
                imports.push({
                    module: modulePath,
                    items: ['*'],
                    type: 'alias-import',
                    alias: alias,
                    isLocal: isLocal,
                    isExternal: !isLocal,
                    language: 'go'
                });
                return;
            }
            
            // Обычный импорт
            var normalMatch = line.match(/["']([^"']+)["']/);
            if (normalMatch) {
                var modulePath = normalMatch[1];
                var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..');
                imports.push({
                    module: modulePath,
                    items: ['*'],
                    type: 'import',
                    isLocal: isLocal,
                    isExternal: !isLocal,
                    language: 'go'
                });
            }
        });
    }
}
    
    // ============================================================
    // RUST
    // ============================================================
    if (lang === 'rs' || lang === 'rust') {
        var useRegex = /use\s+([^;]+);/g;
        var match;
        while ((match = useRegex.exec(code)) !== null) {
            var modulePath = match[1];
            var isLocal = modulePath.startsWith('crate::') || modulePath.startsWith('super::') || modulePath.startsWith('self::');
            imports.push({
                module: modulePath,
                items: ['*'],
                type: 'use',
                isLocal: isLocal,
                isExternal: !isLocal && !modulePath.startsWith('std::'),
                language: 'rust'
            });
        }
    }
    
    // ============================================================
    // C / C++
    // ============================================================
    if (lang === 'c' || lang === 'cpp' || lang === 'h' || lang === 'hpp') {
        var includeRegex = /#include\s+[<"]([^>"]+)[>"]/g;
        var match;
        while ((match = includeRegex.exec(code)) !== null) {
            var modulePath = match[1];
            var isLocal = modulePath.startsWith('"');
            imports.push({
                module: modulePath,
                items: ['*'],
                type: 'include',
                isLocal: isLocal,
                isExternal: !isLocal,
                language: 'c/cpp'
            });
        }
    }
    
    // ============================================================
    // C#
    // ============================================================
    if (lang === 'cs' || lang === 'csharp') {
        var usingRegex = /using\s+([^;]+);/g;
        var match;
        while ((match = usingRegex.exec(code)) !== null) {
            var modulePath = match[1];
            imports.push({
                module: modulePath,
                items: ['*'],
                type: 'using',
                isLocal: modulePath.startsWith('MyProject.') || modulePath.startsWith('App.'),
                isExternal: !(modulePath.startsWith('MyProject.') || modulePath.startsWith('App.')),
                language: 'csharp'
            });
        }
    }
    
    // ============================================================
    // PHP
    // ============================================================
    // ============================================================
// PHP (.php) С ОТЛАДКОЙ
// ============================================================
if (lang === 'php') {

    
    // 1. Ищем use
    var useRegex = /use\s+([^;]+);/g;
    var match;
    var useCount = 0;
    
    // Временно сохраняем код для отладки
    var debugCode = code;
    
    while ((match = useRegex.exec(debugCode)) !== null) {
        useCount++;
        var fullPath = match[1].trim();

        
        var alias = null;
        var className = fullPath;
        
        // Проверяем на алиас: use Namespace\Class as Alias;
        var asMatch = fullPath.match(/^(.+?)\s+as\s+(\w+)$/);
        if (asMatch) {
            className = asMatch[1].trim();
            alias = asMatch[2].trim();

        }
        
        // Определяем, локальный это импорт или внешний
        var isLocal = fullPath.startsWith('App\\') || 
                      fullPath.startsWith('My\\') || 
                      fullPath.startsWith('src\\') ||
                      fullPath.startsWith('app\\');
        
        var isNamed = fullPath.includes('\\');
        
        imports.push({
            module: className,
            items: [alias || className.split('\\').pop()],
            type: 'use',
            alias: alias,
            isLocal: isLocal,
            isExternal: !isLocal,
            language: 'php',
            fullPath: fullPath,
            isNamed: isNamed
        });
    }

    
    // 2. Ищем require
    var requireRegex = /require(?:_once)?\s+['"]([^'"]+)['"]/g;
    var requireCount = 0;
    while ((match = requireRegex.exec(code)) !== null) {
        requireCount++;
        var modulePath = match[1];

        
        var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..') || modulePath.startsWith('/');
        imports.push({
            module: modulePath,
            items: ['*'],
            type: 'require',
            isLocal: isLocal,
            isExternal: !isLocal,
            language: 'php'
        });
    }

    
    // 3. Если ничего не найдено - проверяем код вручную
    if (useCount === 0 && requireCount === 0) {

        // Проверяем, есть ли вообще слово "use"
        var hasUse = code.includes('use ');

        
        // if (hasUse) {
        //     // Показываем все строки с "use"
        //     var lines = code.split('\n');
        //     lines.forEach(function(line, index) {
        //         if (line.includes('use ')) {
        //             console.log(`Строка ${index + 1}: ${line.trim()}`);
        //         }
        //     });
        // }
    }
}
    
    // ============================================================
    // RUBY
    // ============================================================
    if (lang === 'rb' || lang === 'ruby') {
        var requireRegex = /require\s+['"]([^'"]+)['"]/g;
        var match;
        while ((match = requireRegex.exec(code)) !== null) {
            var modulePath = match[1];
            var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..');
            imports.push({
                module: modulePath,
                items: ['*'],
                type: 'require',
                isLocal: isLocal,
                isExternal: !isLocal,
                language: 'ruby'
            });
        }
    }
    
    // ============================================================
    // SHELL / BASH
    // ============================================================
    if (lang === 'sh' || lang === 'bash') {
        var sourceRegex = /source\s+([^\s]+)/g;
        var match;
        while ((match = sourceRegex.exec(code)) !== null) {
            var modulePath = match[1];
            var isLocal = modulePath.startsWith('.') || modulePath.startsWith('..') || modulePath.startsWith('/');
            imports.push({
                module: modulePath,
                items: ['*'],
                type: 'source',
                isLocal: isLocal,
                isExternal: !isLocal,
                language: 'shell'
            });
        }
    }
    
    return imports;
}

// ============================================================
// 12. ВЫБОР ТИПА ДИАГРАММЫ
// ============================================================
// Вызывается при клике на тип диаграммы в модальном окне
// ============================================================

window.selectDiagramType = function(type) {
    selectedDiagramType = type;
    
    var options = document.querySelectorAll('.diagram-type-option');
    options.forEach(function(el) {
        var isActive = el.dataset.diagram === type;
        if (isActive) {
            el.classList.add('active');
           
            var icon = el.querySelector('i');
            if (icon) icon.style.color = '#3B82F6';
        } else {
            el.classList.remove('active');
            var icon = el.querySelector('i');
            if (icon) icon.style.color = '#6c757d';
        }
    });
};

// ============================================================
// 13. ВЫБОР ИСТОЧНИКА (ФАЙЛ / ПРОЕКТ)
// ============================================================
// ============================================================
window.selectSourceType = function(type) {
    selectedSourceType = type;
    
    var fileInput = document.getElementById('codeFileInputModal');
    var projectInfo = document.getElementById('projectInfoModal');
    
    if (type === 'file') {
        if (fileInput) fileInput.style.display = 'block';
        if (projectInfo) projectInfo.style.display = 'none';
    } else if (type === 'project') {
        if (fileInput) fileInput.style.display = 'none';
        if (projectInfo) projectInfo.style.display = 'block';
    }
};

// ============================================================
// 14. ОТКРЫТИЕ И ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА
// ============================================================
// ============================================================

window.openCodeFileModal = function() {
    var modal = document.getElementById('codeFileModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        var input = document.getElementById('codeFileInputModal');
        if (input) input.value = '';
        var infoModal = document.getElementById('codeFileInfoModal');
        if (infoModal) infoModal.style.display = 'none';
        var loadBtn = document.getElementById('loadCodeFileBtn');
        if (loadBtn) {
            loadBtn.style.background = '#e5e7eb';
            loadBtn.style.color = '#9ca3af';
            loadBtn.style.cursor = 'not-allowed';
        }
        selectedCodeFile = null;
    }
};

window.closeCodeFileModal = function() {
    var modal = document.getElementById('codeFileModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
};

// ============================================================
// 15. ОБРАБОТЧИК ВЫБОРА ФАЙЛА
// ============================================================
// ============================================================

window.handleFileSelect = function() {
    var fileInput = document.getElementById('codeFileInputModal');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Выберите файл', 'warning');
        }
        return;
    }
    
    selectedCodeFile = fileInput.files[0];
    
    var fileNameEl = document.getElementById('codeFileNameModal');
    var fileSizeEl = document.getElementById('codeFileSizeModal');
    var fileLinesEl = document.getElementById('codeFileLinesModal');
    var infoModal = document.getElementById('codeFileInfoModal');
    var loadBtn = document.getElementById('loadCodeFileBtn');
    
    if (fileNameEl) fileNameEl.textContent = '📄 ' + selectedCodeFile.name;
    if (fileSizeEl) fileSizeEl.textContent = (selectedCodeFile.size / 1024).toFixed(2) + ' KB';
    if (infoModal) infoModal.style.display = 'block';
    if (loadBtn) {
        loadBtn.style.background = '#3B82F6';
        loadBtn.style.color = 'white';
        loadBtn.style.cursor = 'pointer';
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        var content = e.target.result;
        var lineCount = content.split('\n').length;
        if (fileLinesEl) fileLinesEl.textContent = lineCount + ' строк';
    };
    reader.readAsText(selectedCodeFile);
};

// ============================================================
// 16. ЗАГРУЗКА И ВИЗУАЛИЗАЦИЯ
// ============================================================
// Вызывается при нажатии кнопки "Загрузить"
// ============================================================

window.loadAndVisualize = function() {
    if (selectedSourceType === 'file') {
        if (!selectedCodeFile) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Ошибка', 'Выберите файл с кодом', 'warning');
            }
            return;
        }
        
        var reader = new FileReader();
        reader.onload = function(e) {
            var content = e.target.result;
            var fileName = selectedCodeFile.name;
            var ext = fileName.split('.').pop().toLowerCase();
            
            addCodeElement(fileName, content, ext);
            closeCodeFileModal();
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Успешно', 'Файл "' + fileName + '" загружен и визуализирован', 'success');
            }
        };
        reader.readAsText(selectedCodeFile);
    } else if (selectedSourceType === 'project') {
        if (typeof visualizeProject === 'function') {
            visualizeProject();
            closeCodeFileModal();
        } else {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Ошибка', 'Функция визуализации проекта не найдена', 'error');
            }
        }
    }
};

// ============================================================
// 17. ДОБАВЛЕНИЕ ЭЛЕМЕНТА С КОДОМ НА ХОЛСТ
// ============================================================
// Создает элемент на холсте и запускает визуализацию
// ============================================================

function addCodeElement(fileName, content, ext) {
    var id = ++elementIdCounter;
    
    var element = {
        id: id,
        type: 'code',
        name: '📄 ' + fileName,
        x: 50 + Math.random() * 200,
        y: 50 + Math.random() * 200,
        color: '#8B5CF6',
        width: 160,
        height: 44,
        isTool: false,
        isCode: true,
        codeContent: content,
        codeExt: ext,
        codeLines: content.split('\n').length,
        bgColor: '#f3f4f6',
        borderColor: '#8B5CF6',
        textColor: '#1a1a2e'
    };
    
    elements.push(element);
    var emptyState = document.getElementById('paletteEmpty');
    if (emptyState) emptyState.classList.add('hidden');
    renderElements();
    selectElement(id);
    
    // Запускаем визуализацию через 300ms
    setTimeout(function() {

        var parseResult = parseCodeForCallGraph(content, ext);

        if (selectedDiagramType === 'dependency') {
            if (typeof buildDependencyDiagram === 'function') {
                buildDependencyDiagram(parseResult, fileName);
            }
            return; // выходим, чтобы не строить другие диаграммы
        }
        
        if (parseResult.functions.length > 0) {

            switch(selectedDiagramType) {
                case 'callgraph':
                    buildCallGraph(parseResult, fileName);
                    break;
                case 'dataflow':

                    if (typeof buildDataFlowDiagram === 'function') {
                        buildDataFlowDiagram(parseResult, fileName);
                    }
                    break;
                case 'component':
                    if (typeof buildComponentDiagram === 'function') {
                        buildComponentDiagram(parseResult, fileName);
                    }
                    break;
                case 'class':
                    if (typeof buildClassDiagram === 'function') {
                        buildClassDiagram(parseResult, fileName);
                    }
                    break;
                case 'dependency':
                            alert(selectedDiagramType)

                    if (typeof buildDependencyDiagram === 'function') {

                        buildDependencyDiagram(parseResult, fileName);
                    } else {

                    }
                    break;
                default:
                    buildCallGraph(parseResult, fileName);
            }
        }
    }, 300);
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Успешно', 'Файл "' + fileName + '" загружен на холст', 'success');
    }
    
    return element;
}

// ============================================================
// 18. ПОСТРОЕНИЕ ГРАФА ВЫЗОВОВ (CALL GRAPH)
// ============================================================
// Визуализирует граф вызовов функций в виде узлов и связей
// ============================================================

function buildCallGraph(parseResult, fileName) {
    var functions = parseResult.functions;
    var calls = parseResult.calls || [];
    
    if (functions.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Информация', 'В файле не найдены функции', 'info');
        }
        return;
    }
    
    connections = [];
    
    var functionMap = {};
    functions.forEach(function(fn, index) {
        functionMap[fn.name] = {
            id: index + 1,
            name: fn.name,
            params: fn.params,
            type: fn.type || 'function'
        };
    });
    
    var functionIds = {};
    var cols = Math.ceil(Math.sqrt(Object.keys(functionMap).length)) || 1;
    var spacingX = 200;
    var spacingY = 100;
    
    Object.keys(functionMap).forEach(function(name, index) {
        var fn = functionMap[name];
        var id = ++elementIdCounter;
        functionIds[name] = id;
        
        var row = Math.floor(index / cols);
        var col = index % cols;
        
        var color = fn.type === 'class' ? '#10B981' : 
                    fn.type === 'method' ? '#3B82F6' : '#8B5CF6';
        
        var element = {
            id: id,
            type: 'function',
            name: fn.name + (fn.params.length > 0 ? '(...)' : '()'),
            x: 50 + col * spacingX,
            y: 50 + row * spacingY,
            color: color,
            width: 140,
            height: 44,
            isTool: false,
            isCode: false,
            functionData: fn,
            bgColor: color + '20',
            borderColor: color,
            textColor: color
        };
        elements.push(element);
    });
    
    calls.forEach(function(call) {
        var fromId = functionIds[call.from];
        var toId = functionIds[call.to];
        
        if (!fromId && call.from !== 'global') {
            var extId = ++elementIdCounter;
            functionIds[call.from] = extId;
            var extEl = {
                id: extId,
                type: 'function',
                name: call.from + ' (внеш.)',
                x: 50 + Math.random() * 300 + 200,
                y: 50 + Math.random() * 300,
                color: '#EF4444',
                width: 100,
                height: 40,
                isTool: false,
                isCode: false,
                bgColor: '#EF444420',
                borderColor: '#EF4444',
                textColor: '#EF4444'
            };
            elements.push(extEl);
            fromId = extId;
        }
        
        if (!toId && call.to !== 'global') {
            var extId = ++elementIdCounter;
            functionIds[call.to] = extId;
            var extEl = {
                id: extId,
                type: 'function',
                name: call.to + ' (внеш.)',
                x: 50 + Math.random() * 300 + 200,
                y: 50 + Math.random() * 300,
                color: '#EF4444',
                width: 100,
                height: 40,
                isTool: false,
                isCode: false,
                bgColor: '#EF444420',
                borderColor: '#EF4444',
                textColor: '#EF4444'
            };
            elements.push(extEl);
            toId = extId;
        }
        
        if (fromId && toId && fromId !== toId) {
            var exists = connections.some(function(c) {
                return c.from === fromId && c.to === toId;
            });
            if (!exists) {
                connections.push({
                    id: connections.length + 1,
                    from: fromId,
                    to: toId,
                    type: 'control',
                    label: 'вызов',
                    color: '#8B5CF6'
                });
            }
        }
    });
    
    renderElements();
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Успешно', 'Построен граф вызовов: ' + Object.keys(functionMap).length + ' функций', 'success');
    }
}

// ============================================================
// 19. ПОСТРОЕНИЕ ДИАГРАММЫ ПОТОКОВ ДАННЫХ (DATA FLOW)
// ============================================================
// Анализирует вызовы и параметры, строит связи с указанием передаваемых данных
// ============================================================

function buildDataFlowDiagram(parseResult, fileName) {
    var functions = parseResult.functions || [];
    var calls = parseResult.calls || [];
    
    if (functions.length === 0) {
        showCustomAlert('Информация', 'Не найдены функции для построения диаграммы потоков данных', 'info');
        return;
    }
    
    // Очищаем холст
    elements = [];
    connections = [];
    selectedElement = null;
    
    // 1. Создаем карту функций
    var functionMap = {};
    functions.forEach(function(fn) {
        if (!functionMap[fn.name]) {
            functionMap[fn.name] = {
                name: fn.name,
                params: fn.params || [],
                type: fn.type || 'function'
            };
        }
    });
    
    var functionNames = Object.keys(functionMap);
    
    // 2. Создаем узлы (функции)
    var nodeIds = {};
    var cols = Math.ceil(Math.sqrt(functionNames.length)) || 1;
    var spacingX = 200;
    var spacingY = 100;
    
    functionNames.forEach(function(name, index) {
        var fn = functionMap[name];
        var id = ++elementIdCounter;
        nodeIds[name] = id;
        
        var row = Math.floor(index / cols);
        var col = index % cols;
        
        var color = '#8B5CF6';
        if (fn.type === 'class') color = '#10B981';
        else if (fn.type === 'method') color = '#3B82F6';
        
        var displayName = fn.name + (fn.params.length > 0 ? '(...)' : '()');
        
        elements.push({
            id: id,
            type: 'function',
            name: displayName,
            x: 50 + col * spacingX,
            y: 50 + row * spacingY,
            color: color,
            width: 140,
            height: 44,
            isTool: false,
            isCode: false,
            bgColor: color + '20',
            borderColor: color,
            textColor: color
        });
    });
    
    // 3. Создаем связи (потоки данных)
    var flowSet = new Set();
    
    calls.forEach(function(call) {
        var fromName = call.from;
        var toName = call.to;
        if (fromName === 'global' || toName === 'global') return;
        if (!nodeIds[fromName] || !nodeIds[toName]) return;
        if (fromName === toName) return;
        
        var key = fromName + '->' + toName;
        if (flowSet.has(key)) return;
        flowSet.add(key);
        
        var label = 'данные';
        var toFn = functionMap[toName];
        if (toFn && toFn.params && toFn.params.length > 0) {
            label = toFn.params.join(', ');
        }
        
        connections.push({
            id: connections.length + 1,
            from: nodeIds[fromName],
            to: nodeIds[toName],
            type: 'data-flow',
            label: label,
            color: '#10B981'
        });
    });
    
    // Если связей нет - создаем по порядку
    if (connections.length === 0 && functionNames.length > 1) {
        for (var i = 0; i < functionNames.length - 1; i++) {
            var fromName = functionNames[i];
            var toName = functionNames[i + 1];
            var toFn = functionMap[toName];
            
            var label = 'данные';
            if (toFn && toFn.params && toFn.params.length > 0) {
                label = toFn.params.join(', ');
            }
            
            connections.push({
                id: connections.length + 1,
                from: nodeIds[fromName],
                to: nodeIds[toName],
                type: 'dataflow',
                label: label,
                color: '#10B981'
            });
        }
    }
    
    renderElements();
    renderConnections();
    setTimeout(autoFitCanvas, 100); 
    showCustomAlert('Успешно', 'Построена диаграмма потоков данных: ' + functionNames.length + ' функций, ' + connections.length + ' потоков', 'success');
}

// ============================================================
// 20. ПОСТРОЕНИЕ ДИАГРАММЫ КОМПОНЕНТОВ
// ============================================================
// Группирует классы и методы в компоненты
// ============================================================

function buildComponentDiagram(parseResult, fileName) {
    var functions = parseResult.functions;
    var classes = functions.filter(function(f) { return f.type === 'class'; });
    var methods = functions.filter(function(f) { return f.type === 'method' || f.type === 'function'; });
    
    if (classes.length === 0 && methods.length === 0) {
        showCustomAlert('Информация', 'Не найдены классы или методы для построения диаграммы компонентов', 'info');
        return;
    }
    
    elements = [];
    connections = [];
    selectedElement = null;
    
    var spacingX = 250;
    var spacingY = 120;
    var startX = 80;
    var startY = 80;
    
    // Сначала классы
    var classIds = {};
    classes.forEach(function(cls, index) {
        var id = ++elementIdCounter;
        classIds[cls.name] = id;
        var row = Math.floor(index / 2);
        var col = index % 2;
        var element = {
            id: id,
            type: 'class',
            name: '📦 ' + cls.name,
            x: startX + col * spacingX,
            y: startY + row * spacingY,
            color: '#10B981',
            width: 160,
            height: 44,
            isTool: false,
            isCode: false,
            bgColor: '#10B98120',
            borderColor: '#10B981',
            textColor: '#10B981'
        };
        elements.push(element);
    });
    
    // Потом методы (если нет классов - показываем функции)
    var methodIds = {};
    var methodList = classes.length > 0 ? methods : functions;
    var startYMethods = classes.length > 0 ? startY + spacingY : startY;
    
    methodList.forEach(function(method, index) {
        var id = ++elementIdCounter;
        methodIds[method.name] = id;
        var row = Math.floor(index / 3);
        var col = index % 3;
        var element = {
            id: id,
            type: 'method',
            name: '🔧 ' + method.name + (method.params && method.params.length > 0 ? '(...)' : '()'),
            x: startX + col * spacingX,
            y: startYMethods + row * spacingY + 40,
            color: '#3B82F6',
            width: 140,
            height: 40,
            isTool: false,
            isCode: false,
            bgColor: '#3B82F620',
            borderColor: '#3B82F6',
            textColor: '#3B82F6'
        };
        elements.push(element);
    });
    
    renderElements();
    showCustomAlert('Успешно', 'Построена диаграмма компонентов: ' + classes.length + ' классов, ' + methodList.length + ' методов/функций', 'success');
}

// ============================================================
// ДИАГРАММА КЛАССОВ (UML СТИЛЬ)
// ============================================================

function buildClassDiagram(parseResult, fileName) {
    var functions = parseResult.functions || [];
    var classFields = parseResult.classFields || {};  // ← ПОЛЯ КЛАССОВ
    
    // 1. Находим все классы
    var classes = functions.filter(function(f) { 
        return f.type === 'class' || f.type === 'struct'; 
    });
    
    // 2. Находим все методы
    var methods = functions.filter(function(f) { 
        return f.type === 'method' || f.type === 'function'; 
    });
    
    if (classes.length === 0) {
        showCustomAlert('Информация', 'Не найдены классы для построения диаграммы классов', 'info');
        return;
    }
    
    // Очищаем холст
    elements = [];
    connections = [];
    selectedElement = null;
    
    // 3. Группируем методы и поля по классам
    var classData = {};
    classes.forEach(function(cls) {
        // Получаем поля для этого класса
        var fields = classFields[cls.name] || [];
        classData[cls.name] = {
            methods: [],
            fields: fields,
            extends: null,
            implements: []
        };
    });
    
    // Распределяем методы по классам
    methods.forEach(function(method) {
        var foundClass = null;
        for (var i = 0; i < classes.length; i++) {
            var cls = classes[i];
            if (method.className === cls.name) {
                foundClass = cls.name;
                break;
            }
        }
        
        if (!foundClass) {
            for (var i = 0; i < classes.length; i++) {
                var cls = classes[i];
                var lowerMethod = method.name.toLowerCase();
                var lowerClass = cls.name.toLowerCase().replace(/service|controller|manager|handler/g, '');
                if (lowerClass.length > 2 && lowerMethod.includes(lowerClass)) {
                    foundClass = cls.name;
                    break;
                }
            }
        }
        
        if (foundClass && classData[foundClass]) {
            classData[foundClass].methods.push(method);
        }
    });
    
    // 4. Создаем элементы в стиле UML
    var classNames = Object.keys(classData);
    var cols = Math.ceil(Math.sqrt(classNames.length)) || 1;
    var spacingX = 280;
    var spacingY = 200;
    var startX = 60;
    var startY = 60;
    
    var classIds = {};
    
    classNames.forEach(function(name, index) {
        var data = classData[name];
        var id = ++elementIdCounter;
        classIds[name] = id;
        
        var row = Math.floor(index / cols);
        var col = index % cols;
        
        var x = startX + col * spacingX;
        var y = startY + row * spacingY;
        
        var fieldsList = data.fields || [];
        var methodsList = data.methods || [];
        
        var headerHeight = 36;
        var fieldsHeight = fieldsList.length * 18;
        var methodsHeight = methodsList.length * 18;
        var separatorHeight = 2;
        var padding = 6;
        
        var totalHeight = headerHeight + padding + fieldsHeight + (fieldsList.length > 0 ? separatorHeight : 0) + (methodsList.length > 0 ? padding : 0) + methodsHeight + 8;
        if (totalHeight < 60) totalHeight = 60;
        if (totalHeight > 450) totalHeight = 450;
        
        // Основной блок класса
        var element = {
            id: id,
            type: 'uml-class',
            name: name,
            x: x,
            y: y,
            color: '#8B5CF6',
            width: 240,
            height: totalHeight,
            isTool: false,
            isCode: false,
            bgColor: '#ffffff',
            borderColor: '#8B5CF6',
            textColor: '#1a1a2e',
            isUmlClass: true,
            fields: fieldsList,
            methods: methodsList,
            headerHeight: headerHeight
        };
        elements.push(element);
        
        // ============================================================
        // ПОЛЯ КЛАССА (свойства)
        // ============================================================
        var currentY = y + headerHeight + 7;
        fieldsList.forEach(function(field, idx) {
            var fieldId = ++elementIdCounter;
            var fieldName = field;
            
            var fieldEl = {
                id: fieldId,
                type: 'uml-field',
                name: fieldName,
                x: x + 12,
                y: currentY + idx * 18,
                color: '#6b7280',
                width: 216,
                height: 16,
                isTool: false,
                isCode: false,
                isUmlField: true,
                parentClassId: id
            };
            elements.push(fieldEl);
        });
        
        // ============================================================
        // МЕТОДЫ КЛАССА
        // ============================================================
        var methodStartY = y + headerHeight + 7 + fieldsHeight + (fieldsList.length > 0 ? 7 : 0);
        methodsList.forEach(function(method, idx) {
            var methodId = ++elementIdCounter;
            var params = method.params && method.params.length > 0 ? '(' + method.params.join(', ') + ')' : '()';
            var methodName = method.name + params;
            
            var methodColor = method.type === 'function' ? '#3B82F6' : '#10B981';
            
            var methodEl = {
                id: methodId,
                type: 'uml-method',
                name: methodName,
                x: x + 12,
                y: methodStartY + idx * 18,
                color: methodColor,
                width: 216,
                height: 16,
                isTool: false,
                isCode: false,
                isUmlMethod: true,
                parentClassId: id,
                methodData: method
            };
            elements.push(methodEl);
        });
    });
    
    renderElements();
    setTimeout(autoFitCanvas, 100);
    showCustomAlert('Успешно', 'Диаграмма классов: ' + classes.length + ' классов, ' + Object.keys(classFields).length + ' полей, ' + methods.length + ' методов', 'success');
}

// ============================================================
// 22. ПОСТРОЕНИЕ ДИАГРАММЫ ЗАВИСИМОСТЕЙ (ИМПОРТЫ)
// ============================================================
// Показывает внешние и локальные зависимости (импорты)
// ============================================================

function buildDependencyDiagram(parseResult, fileName) {
    var imports = parseResult.imports || [];
    
    if (imports.length === 0) {
        showCustomAlert('Информация', 'В файле не найдены импорты (зависимости)', 'info');
        return;
    }
    
    elements = [];
    connections = [];
    selectedElement = null;
    
    // Создаем элемент для текущего файла
    var fileId = ++elementIdCounter;
    var fileElement = {
        id: fileId,
        type: 'file',
        name: '📄 ' + fileName,
        x: 50,
        y: 200,
        color: '#3B82F6',
        width: 200,
        height: 44,
        isTool: false,
        isCode: false,
        bgColor: '#3B82F620',
        borderColor: '#3B82F6',
        textColor: '#3B82F6'
    };
    elements.push(fileElement);
    
    // Группируем импорты по типу
    var externalImports = imports.filter(function(i) { return i.isExternal; });
    var localImports = imports.filter(function(i) { return i.isLocal; });
    
    var spacingX = 220;
    var startX = 280;
    var startY = 80;
    
    // Внешние зависимости
    externalImports.forEach(function(imp, index) {
        var id = ++elementIdCounter;
        var row = Math.floor(index / 2);
        var col = index % 2;
        
        var element = {
            id: id,
            type: 'external-dependency',
            name: '📦 ' + imp.module,
            x: startX + col * spacingX,
            y: startY + row * 100,
            color: '#EF4444',
            width: 180,
            height: 40,
            isTool: false,
            isCode: false,
            bgColor: '#EF444420',
            borderColor: '#EF4444',
            textColor: '#EF4444',
            importData: imp
        };
        elements.push(element);
        
        connections.push({
            id: connections.length + 1,
            from: fileId,
            to: id,
            type: 'control',
            label: 'зависит от',
            color: '#EF4444'
        });
    });
    
    // Локальные зависимости
    var localStartX = startX + (externalImports.length > 0 ? 2 * spacingX + 50 : 0);
    localImports.forEach(function(imp, index) {
        var id = ++elementIdCounter;
        var row = Math.floor(index / 2);
        var col = index % 2;
        
        var color = '#10B981';
        var element = {
            id: id,
            type: 'local-dependency',
            name: '📁 ' + imp.module,
            x: localStartX + col * spacingX,
            y: startY + row * 100,
            color: color,
            width: 180,
            height: 40,
            isTool: false,
            isCode: false,
            bgColor: color + '20',
            borderColor: color,
            textColor: color,
            importData: imp
        };
        elements.push(element);
        
        connections.push({
            id: connections.length + 1,
            from: fileId,
            to: id,
            type: 'control',
            label: 'использует',
            color: '#10B981'
        });
    });
    
    renderElements();
    setTimeout(autoFitCanvas, 100);
    showCustomAlert('Успешно', 'Диаграмма зависимостей: ' + imports.length + ' импортов (' + externalImports.length + ' внешних, ' + localImports.length + ' локальных)', 'success');
}

// ============================================================
// ВИЗУАЛИЗАЦИЯ ПРОЕКТА
// ============================================================
// Анализирует все загруженные файлы и строит общую диаграмму
// ============================================================

function visualizeProject() {
    var codeElements = elements.filter(function(el) { 
        return el.isCode === true && el.codeContent; 
    });
    
    if (codeElements.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Информация', 'Нет загруженных файлов с кодом', 'info');
        }
        return;
    }
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Визуализация', 'Анализ ' + codeElements.length + ' файлов...', 'info');
    }
    
    var allFunctions = [];
    var allCalls = [];
    
    codeElements.forEach(function(el) {
        var ext = el.codeExt || 'txt';
        var parseResult = parseCodeForCallGraph(el.codeContent, ext);
        if (parseResult.functions && parseResult.functions.length > 0) {
            allFunctions = allFunctions.concat(parseResult.functions);
            allCalls = allCalls.concat(parseResult.calls || []);
        }
    });
    
    if (allFunctions.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Информация', 'В загруженных файлах не найдены функции', 'info');
        }
        return;
    }
    
    // Очищаем холст
    elements = [];
    connections = [];
    selectedElement = null;
    
    var functionMap = {};
    allFunctions.forEach(function(fn) {
        if (!functionMap[fn.name]) {
            functionMap[fn.name] = {
                name: fn.name,
                params: fn.params || [],
                type: fn.type || 'function'
            };
        }
    });
    
    var functionKeys = Object.keys(functionMap);
    var cols = Math.ceil(Math.sqrt(functionKeys.length)) || 1;
    var spacingX = 200;
    var spacingY = 100;
    
    var functionIds = {};
    functionKeys.forEach(function(name, index) {
        var fn = functionMap[name];
        var id = ++elementIdCounter;
        functionIds[name] = id;
        
        var row = Math.floor(index / cols);
        var col = index % cols;
        
        var color = fn.type === 'class' ? '#10B981' : 
                    fn.type === 'method' ? '#3B82F6' : '#8B5CF6';
        
        var element = {
            id: id,
            type: 'function',
            name: fn.name + (fn.params.length > 0 ? '(...)' : '()'),
            x: 50 + col * spacingX,
            y: 50 + row * spacingY,
            color: color,
            width: 140,
            height: 44,
            isTool: false,
            isCode: false,
            functionData: fn,
            bgColor: color + '20',
            borderColor: color,
            textColor: color
        };
        elements.push(element);
    });
    
    var callSet = new Set();
    allCalls.forEach(function(call) {
        var fromId = functionIds[call.from];
        var toId = functionIds[call.to];
        
        if (!fromId && call.from !== 'global') {
            var extId = ++elementIdCounter;
            functionIds[call.from] = extId;
            var extEl = {
                id: extId,
                type: 'function',
                name: call.from + ' (внеш.)',
                x: 50 + Math.random() * 300 + 200,
                y: 50 + Math.random() * 300,
                color: '#EF4444',
                width: 100,
                height: 40,
                isTool: false,
                isCode: false,
                bgColor: '#EF444420',
                borderColor: '#EF4444',
                textColor: '#EF4444'
            };
            elements.push(extEl);
            fromId = extId;
        }
        
        if (!toId && call.to !== 'global') {
            var extId = ++elementIdCounter;
            functionIds[call.to] = extId;
            var extEl = {
                id: extId,
                type: 'function',
                name: call.to + ' (внеш.)',
                x: 50 + Math.random() * 300 + 200,
                y: 50 + Math.random() * 300,
                color: '#EF4444',
                width: 100,
                height: 40,
                isTool: false,
                isCode: false,
                bgColor: '#EF444420',
                borderColor: '#EF4444',
                textColor: '#EF4444'
            };
            elements.push(extEl);
            toId = extId;
        }
        
        if (fromId && toId && fromId !== toId) {
            var key = fromId + '-' + toId;
            if (!callSet.has(key)) {
                callSet.add(key);
                connections.push({
                    id: connections.length + 1,
                    from: fromId,
                    to: toId,
                    type: 'control',
                    label: 'вызов',
                    color: '#8B5CF6'
                });
            }
        }
    });
    
    renderElements();
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Успешно', 'Визуализация проекта: ' + functionKeys.length + ' функций в ' + codeElements.length + ' файлах', 'success');
    }
}
// ============================================================
// 23. ЭКСПОРТ ВСЕХ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
// ============================================================
// ============================================================

// ============================================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // Обработчик выбора файла
    var fileInput = document.getElementById('codeFileInputModal');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            var file = this.files[0];
            if (file) {
                selectedCodeFile = file;

                
                var size = (file.size / 1024).toFixed(2);
                
                var fileNameEl = document.getElementById('codeFileNameModal');
                var fileSizeEl = document.getElementById('codeFileSizeModal');
                var fileLinesEl = document.getElementById('codeFileLinesModal');
                var infoModal = document.getElementById('codeFileInfoModal');
                var loadBtn = document.getElementById('loadCodeFileBtn');
                
                if (fileNameEl) fileNameEl.textContent = '📄 ' + file.name;
                if (fileSizeEl) fileSizeEl.textContent = size + ' KB';
                if (fileLinesEl) fileLinesEl.textContent = '⏳ подсчет...';
                if (infoModal) infoModal.style.display = 'block';
                
                if (loadBtn) {
                    loadBtn.style.background = '#3B82F6';
                    loadBtn.style.color = 'white';
                    loadBtn.style.cursor = 'pointer';
                }
                
                // Читаем файл для подсчета строк
                var reader = new FileReader();
                reader.onload = function(e) {
                    var content = e.target.result;
                    var lineCount = content.split('\n').length;
                    if (fileLinesEl) fileLinesEl.textContent = lineCount + ' строк';
                };
                reader.readAsText(file);
            } else {
                selectedCodeFile = null;

                
                var infoModal = document.getElementById('codeFileInfoModal');
                if (infoModal) infoModal.style.display = 'none';
                
                var loadBtn = document.getElementById('loadCodeFileBtn');
                if (loadBtn) {
                    loadBtn.style.background = '#e5e7eb';
                    loadBtn.style.color = '#9ca3af';
                    loadBtn.style.cursor = 'not-allowed';
                }
            }
        });
    }

    // Обработчик кнопки "Загрузить"
    var loadBtn = document.getElementById('loadCodeFileBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', function() {

            
            if (!selectedCodeFile) {
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('Ошибка', 'Выберите файл с кодом', 'warning');
                }
                return;
            }
            
            var reader = new FileReader();
            reader.onload = function(e) {
                var content = e.target.result;
                var fileName = selectedCodeFile.name;
                var ext = fileName.split('.').pop().toLowerCase();
                

                
                // Добавляем на холст
                addCodeElement(fileName, content, ext);
                
                // Закрываем модалку
                closeCodeFileModal();
                
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('Успешно', 'Файл "' + fileName + '" загружен', 'success');
                }
            };
            reader.readAsText(selectedCodeFile);
        });
    }
});

// ============================================================
// АВТОМАТИЧЕСКОЕ МАСШТАБИРОВАНИЕ ДЛЯ ВСЕХ ЭЛЕМЕНТОВ
// ============================================================

function fitAllElements() {
    var canvas = document.getElementById('paletteCanvas');
    if (!canvas) return;
    
    var canvasWidth = canvas.clientWidth;
    var canvasHeight = canvas.clientHeight;
    
    if (elements.length === 0) return;
    
    // Находим границы всех элементов
    var minX = Infinity, minY = Infinity;
    var maxX = -Infinity, maxY = -Infinity;
    
    elements.forEach(function(el) {
        var elX = el.x;
        var elY = el.y;
        var elW = el.width || 120;
        var elH = el.height || 40;
        
        if (elX < minX) minX = elX;
        if (elY < minY) minY = elY;
        if (elX + elW > maxX) maxX = elX + elW;
        if (elY + elH > maxY) maxY = elY + elH;
    });
    
    var contentWidth = maxX - minX + 50;
    var contentHeight = maxY - minY + 50;
    
    // Если контент помещается - ничего не делаем
    if (contentWidth <= canvasWidth && contentHeight <= canvasHeight) {
        return;
    }
    
    // Вычисляем масштаб
    var scaleX = (canvasWidth - 40) / contentWidth;
    var scaleY = (canvasHeight - 40) / contentHeight;
    var scale = Math.min(scaleX, scaleY, 1);
    
    // Центрируем
    var offsetX = (canvasWidth - contentWidth * scale) / 2 - minX * scale + 20;
    var offsetY = (canvasHeight - contentHeight * scale) / 2 - minY * scale + 20;
    
    // Применяем трансформацию ко всем элементам
    elements.forEach(function(el) {
        el.x = el.x * scale + offsetX;
        el.y = el.y * scale + offsetY;
        if (el.width) el.width = el.width * scale;
        if (el.height) el.height = el.height * scale;
    });
    
    // Обновляем связи
    connections.forEach(function(conn) {
        if (conn.fromX !== undefined) conn.fromX = conn.fromX * scale + offsetX;
        if (conn.fromY !== undefined) conn.fromY = conn.fromY * scale + offsetY;
        if (conn.toX !== undefined) conn.toX = conn.toX * scale + offsetX;
        if (conn.toY !== undefined) conn.toY = conn.toY * scale + offsetY;
        if (conn.yPos !== undefined) conn.yPos = conn.yPos * scale + offsetY;
    });
    
    renderElements();
    renderConnections();
}

// ============================================================
// ИЗМЕНЕНИЕ РАЗМЕРА ХОЛСТА
// ============================================================

function autoFitCanvas() {
    var canvas = document.getElementById('paletteCanvas');
    if (!canvas) return;
    
    // Обновляем размеры холста
    var rect = canvas.getBoundingClientRect();
    var container = canvas.parentElement;
    if (container) {
        canvas.style.width = container.clientWidth + 'px';
        canvas.style.height = container.clientHeight + 'px';
    }
    
    fitAllElements();
}

// Обновляем при изменении размера окна
window.addEventListener('resize', function() {
    setTimeout(autoFitCanvas, 300);
});

// Экспортируем функции
window.fitAllElements = fitAllElements;
window.autoFitCanvas = autoFitCanvas;

window.parseCodeForCallGraph = parseCodeForCallGraph;
window.buildCallGraph = buildCallGraph;
window.buildDataFlowDiagram = buildDataFlowDiagram;
window.buildComponentDiagram = buildComponentDiagram;
window.buildClassDiagram = buildClassDiagram;
window.buildDependencyDiagram = buildDependencyDiagram;
window.selectDiagramType = selectDiagramType;
window.selectSourceType = selectSourceType;
window.openCodeFileModal = openCodeFileModal;
window.closeCodeFileModal = closeCodeFileModal;
window.addCodeElement = addCodeElement;
window.loadAndVisualize = loadAndVisualize;
window.handleFileSelect = handleFileSelect;
window.visualizeProject = visualizeProject;