var projectTreeData = null;
var projectFilesMap = {};
var selectedDiagramType = 'structure';
var isProjectLoaded = false;

// ============================================================
// 0. AST ПАРСЕР ДЛЯ ВСЕХ ЯЗЫКОВ
// ============================================================

function parseCodeWithAST(code, ext) {
    var lang = ext.toLowerCase();
    
    // Пытаемся использовать улучшенный парсер
    try {
        switch(lang) {
            case 'js':
            case 'javascript':
            case 'ts':
            case 'typescript':
            case 'jsx':
            case 'tsx':
                return parseJavaScriptEnhanced(code);
            case 'py':
            case 'python':
                return parsePythonEnhanced(code);
            case 'go':
                return parseGoEnhanced(code);
            case 'java':
                return parseJavaEnhanced(code);
            default:
                return parseGenericEnhanced(code);
        }
    } catch (e) {
        console.warn('Enhanced parser failed, using fallback:', e);
        // Fallback на существующий парсер
        if (typeof parseCodeForCallGraph === 'function') {
            return parseCodeForCallGraph(code, ext);
        }
        return { functions: [], calls: [], imports: [], exports: [] };
    }
}

// ============================================================
// 0.1 УЛУЧШЕННЫЙ ПАРСЕР JAVASCRIPT
// ============================================================

function parseJavaScriptEnhanced(code) {
    var result = {
        functions: [],
        calls: [],
        imports: [],
        exports: [],
        classes: []
    };
    
    // Поиск функций с контекстом
    var funcRegex = /function\s+(\w+)\s*\(([^)]*)\)/g;
    var arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\(([^)]*)\)\s*=>|([^=]+)\s*=>)/g;
    var classRegex = /class\s+(\w+)/g;
    var methodRegex = /(\w+)\s*\([^)]*\)\s*\{/g;
    var callRegex = /(\w+)\s*\(/g;
    var importRegex = /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    var exportRegex = /export\s+(?:default\s+)?(?:{([^}]+)}|(\w+))/g;
    
    var match;
    var currentClass = null;
    
    // Собираем классы
    while ((match = classRegex.exec(code)) !== null) {
        result.classes.push({
            name: match[1],
            line: getLineNumber(code, match.index)
        });
    }
    
    // Собираем функции
    while ((match = funcRegex.exec(code)) !== null) {
        var params = match[2] ? match[2].split(',').map(function(p) { return p.trim(); }) : [];
        result.functions.push({
            name: match[1],
            params: params,
            type: 'function',
            line: getLineNumber(code, match.index),
            parent: null
        });
    }
    
    // Собираем стрелочные функции
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
                line: getLineNumber(code, match.index),
                parent: null
            });
        }
    }
    
    // Собираем методы
    var reservedMethods = ['if', 'for', 'while', 'switch', 'catch', 'try', 'else', 'case', 'default', 'with'];
    while ((match = methodRegex.exec(code)) !== null) {
        var methodName = match[1];
        if (reservedMethods.indexOf(methodName) === -1) {
            // Проверяем, принадлежит ли метод классу
            var parentClass = findParentClass(code, match.index, result.classes);
            result.functions.push({
                name: methodName,
                params: [],
                type: 'method',
                line: getLineNumber(code, match.index),
                parent: parentClass
            });
        }
    }
    
    // Собираем вызовы с определением контекста
    var reserved = ['if', 'for', 'while', 'switch', 'return', 'console', 'require', 'import', 'export', 'new', 'throw', 'catch', 'finally', 'typeof', 'instanceof', 'void', 'delete', 'yield', 'await', 'async', 'try', 'else', 'case', 'default', 'break', 'continue', 'debugger', 'function', 'class', 'interface', 'extends', 'implements', 'package', 'private', 'protected', 'public', 'static', 'this', 'super', 'with', 'let', 'var', 'const', 'get', 'set', 'of', 'from', 'as', 'in', 'is'];
    
    while ((match = callRegex.exec(code)) !== null) {
        var caller = match[1];
        if (reserved.indexOf(caller) === -1) {
            var calledFrom = findCallingFunctionEnhanced(code, match.index, result.functions);
            result.calls.push({
                from: calledFrom || 'global',
                to: caller,
                line: getLineNumber(code, match.index)
            });
        }
    }
    
    // Собираем импорты
    while ((match = importRegex.exec(code)) !== null) {
        var items = [];
        if (match[1]) {
            items = match[1].split(',').map(function(i) { return i.trim(); });
        } else if (match[2]) {
            items = [match[2]];
        }
        result.imports.push({
            source: match[3],
            items: items,
            type: 'import'
        });
    }
    
    // Собираем экспорты
    while ((match = exportRegex.exec(code)) !== null) {
        if (match[1]) {
            var items = match[1].split(',').map(function(i) { return i.trim(); });
            items.forEach(function(item) {
                result.exports.push({
                    name: item,
                    type: 'named'
                });
            });
        } else if (match[2]) {
            result.exports.push({
                name: match[2],
                type: 'default'
            });
        }
    }
    
    return result;
}

// ============================================================
// 0.2 УЛУЧШЕННЫЙ ПАРСЕР PYTHON
// ============================================================

function parsePythonEnhanced(code) {
    var result = {
        functions: [],
        calls: [],
        imports: [],
        classes: []
    };
    
    var funcRegex = /def\s+(\w+)\s*\(([^)]*)\)/g;
    var classRegex = /class\s+(\w+)/g;
    var callRegex = /(\w+)\s*\(/g;
    var importRegex = /(?:from\s+([^\s]+)\s+)?import\s+([^\n]+)/g;
    
    var match;
    
    while ((match = funcRegex.exec(code)) !== null) {
        var params = match[2] ? match[2].split(',').map(function(p) { return p.trim(); }) : [];
        result.functions.push({
            name: match[1],
            params: params,
            type: 'function',
            line: getLineNumber(code, match.index)
        });
    }
    
    while ((match = classRegex.exec(code)) !== null) {
        result.classes.push({
            name: match[1],
            line: getLineNumber(code, match.index)
        });
    }
    
    var reserved = ['if', 'for', 'while', 'return', 'print', 'len', 'range', 'type', 'isinstance', 'super', 'self', 'cls', 'import', 'from', 'as', 'with', 'except', 'finally', 'raise', 'assert', 'lambda', 'yield', 'global', 'nonlocal'];
    
    while ((match = callRegex.exec(code)) !== null) {
        var caller = match[1];
        if (reserved.indexOf(caller) === -1) {
            var calledFrom = findCallingFunctionEnhanced(code, match.index, result.functions);
            result.calls.push({
                from: calledFrom || 'global',
                to: caller,
                line: getLineNumber(code, match.index)
            });
        }
    }
    
    while ((match = importRegex.exec(code)) !== null) {
        var module = match[1] || '';
        var items = match[2] ? match[2].split(',').map(function(i) { return i.trim(); }) : [];
        result.imports.push({
            source: module,
            items: items,
            type: 'import'
        });
    }
    
    return result;
}

// ============================================================
// 0.3 УЛУЧШЕННЫЙ ПАРСЕР GO
// ============================================================

function parseGoEnhanced(code) {
    var result = {
        functions: [],
        calls: [],
        imports: [],
        structs: []
    };
    
    var funcRegex = /func\s+(\w+)\s*\(([^)]*)\)/g;
    var methodRegex = /func\s+\([^)]+\)\s+(\w+)\s*\(([^)]*)\)/g;
    var structRegex = /type\s+(\w+)\s+struct/g;
    var importRegex = /import\s+["']([^"']+)["']/g;
    var callRegex = /(\w+)\.?(\w+)?\s*\(/g;
    
    var match;
    
    while ((match = funcRegex.exec(code)) !== null) {
        var params = match[2] ? match[2].split(',').map(function(p) { return p.trim(); }).filter(function(p) { return p; }) : [];
        result.functions.push({
            name: match[1],
            params: params,
            type: 'function',
            line: getLineNumber(code, match.index)
        });
    }
    
    while ((match = methodRegex.exec(code)) !== null) {
        var params = match[2] ? match[2].split(',').map(function(p) { return p.trim(); }).filter(function(p) { return p; }) : [];
        result.functions.push({
            name: match[1],
            params: params,
            type: 'method',
            line: getLineNumber(code, match.index)
        });
    }
    
    while ((match = structRegex.exec(code)) !== null) {
        result.structs.push({
            name: match[1],
            line: getLineNumber(code, match.index)
        });
    }
    
    while ((match = importRegex.exec(code)) !== null) {
        result.imports.push({
            source: match[1],
            type: 'import'
        });
    }
    
    var reserved = ['if', 'for', 'switch', 'return', 'go', 'defer', 'select', 'make', 'new', 'cap', 'len', 'append', 'copy', 'delete', 'print', 'println', 'range', 'fmt'];
    
    while ((match = callRegex.exec(code)) !== null) {
        var caller = match[2] || match[1];
        if (reserved.indexOf(caller) === -1) {
            var calledFrom = findCallingFunctionEnhanced(code, match.index, result.functions);
            result.calls.push({
                from: calledFrom || 'global',
                to: caller,
                line: getLineNumber(code, match.index)
            });
        }
    }
    
    return result;
}

// ============================================================
// 0.4 УЛУЧШЕННЫЙ ПАРСЕР JAVA
// ============================================================

function parseJavaEnhanced(code) {
    var result = {
        functions: [],
        calls: [],
        imports: [],
        classes: []
    };
    
    var methodRegex = /(?:public|private|protected)\s+(?:static\s+)?(\w+)\s+(\w+)\s*\(([^)]*)\)/g;
    var classRegex = /class\s+(\w+)/g;
    var importRegex = /import\s+([^;]+);/g;
    var callRegex = /(\w+)\s*\(/g;
    
    var match;
    
    while ((match = methodRegex.exec(code)) !== null) {
        var params = match[3] ? match[3].split(',').map(function(p) { return p.trim(); }).filter(function(p) { return p; }) : [];
        result.functions.push({
            name: match[2],
            returnType: match[1],
            params: params,
            type: 'method',
            line: getLineNumber(code, match.index)
        });
    }
    
    while ((match = classRegex.exec(code)) !== null) {
        result.classes.push({
            name: match[1],
            line: getLineNumber(code, match.index)
        });
    }
    
    while ((match = importRegex.exec(code)) !== null) {
        result.imports.push({
            source: match[1],
            type: 'import'
        });
    }
    
    var reserved = ['if', 'for', 'while', 'switch', 'return', 'new', 'throw', 'catch', 'try', 'finally', 'super', 'this', 'class', 'interface', 'extends', 'implements'];
    
    while ((match = callRegex.exec(code)) !== null) {
        var caller = match[1];
        if (reserved.indexOf(caller) === -1) {
            var calledFrom = findCallingFunctionEnhanced(code, match.index, result.functions);
            result.calls.push({
                from: calledFrom || 'global',
                to: caller,
                line: getLineNumber(code, match.index)
            });
        }
    }
    
    return result;
}

// ============================================================
// 0.5 УНИВЕРСАЛЬНЫЙ ПАРСЕР (FALLBACK)
// ============================================================

function parseGenericEnhanced(code) {
    var result = {
        functions: [],
        calls: [],
        imports: [],
        exports: []
    };
    
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
    var reserved = ['if', 'for', 'while', 'switch', 'return', 'new', 'throw'];
    
    while ((match = callRegex.exec(code)) !== null) {
        var caller = match[1];
        if (reserved.indexOf(caller) === -1) {
            var calledFrom = findCallingFunctionEnhanced(code, match.index, result.functions);
            result.calls.push({
                from: calledFrom || 'global',
                to: caller,
                line: getLineNumber(code, match.index)
            });
        }
    }
    
    return result;
}

// ============================================================
// 0.6 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getLineNumber(code, index) {
    var before = code.substring(0, index);
    return before.split('\n').length;
}

function findCallingFunctionEnhanced(code, index, functions) {
    var before = code.substring(0, index);
    var lines = before.split('\n');
    var currentLine = lines.length;
    
    var bestMatch = null;
    var bestLine = -1;
    
    for (var i = 0; i < functions.length; i++) {
        var fn = functions[i];
        if (fn.line < currentLine) {
            // Упрощенная проверка - функция должна быть выше текущей строки
            if (fn.line > bestLine) {
                bestLine = fn.line;
                bestMatch = fn.name;
            }
        }
    }
    
    return bestMatch || 'global';
}

function findParentClass(code, index, classes) {
    var before = code.substring(0, index);
    var lastClass = null;
    var lastLine = -1;
    
    for (var i = 0; i < classes.length; i++) {
        var cls = classes[i];
        if (cls.line < getLineNumber(code, index) && cls.line > lastLine) {
            lastLine = cls.line;
            lastClass = cls.name;
        }
    }
    
    return lastClass;
}

// ============================================================
// 1. ВЫБОР ПАПКИ ПРОЕКТА
// ============================================================

window.selectProjectFolder = function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    
    input.onchange = function(e) {
        var files = e.target.files;
        if (!files || files.length === 0) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Ошибка', 'Папка не выбрана', 'warning');
            }
            return;
        }
        
        var tree = {
            name: 'Проект',
            type: 'folder',
            children: {},
            files: []
        };
        
        projectFilesMap = {};
        var fileCount = 0;
        
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var path = file.webkitRelativePath || file.name;
            
            if (path.includes('node_modules') || 
                path.includes('.git') || 
                path.includes('__pycache__') ||
                path.includes('.idea') ||
                path.includes('.vscode') ||
                path.includes('dist') ||
                path.includes('build')) {
                continue;
            }
            
            var ext = file.name.split('.').pop().toLowerCase();
            var validExtensions = ['js', 'ts', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'h', 'php', 'rb', 'cs', 'sh', 'jsx', 'tsx', 'vue', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'md', 'txt'];
            
            if (validExtensions.indexOf(ext) === -1) {
                continue;
            }
            
            fileCount++;
            
            var parts = path.split('/');
            var current = tree;
            
            for (var j = 0; j < parts.length - 1; j++) {
                var folderName = parts[j];
                if (!current.children[folderName]) {
                    current.children[folderName] = {
                        name: folderName,
                        type: 'folder',
                        children: {},
                        files: []
                    };
                }
                current = current.children[folderName];
            }
            
            var fileName = parts[parts.length - 1];
            var fileData = {
                name: fileName,
                path: path,
                ext: ext,
                size: file.size,
                file: file
            };
            
            current.files.push(fileData);
            projectFilesMap[path] = fileData;
        }
        
        if (fileCount === 0) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Ошибка', 'В папке не найдены файлы с кодом', 'warning');
            }
            return;
        }
        
        projectTreeData = tree;
        isProjectLoaded = true;
        
        updateProjectInfo();
        
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Успешно', 'Найдено ' + countFiles(tree) + ' файлов в проекте', 'success');
        }
        
        var selectBtn = document.querySelector('#projectInfoModal button[onclick="selectProjectFolder()"]');
        if (selectBtn) {
            selectBtn.innerHTML = '<i class="fas fa-check-circle"></i> Проект загружен (' + countFiles(tree) + ' файлов)';
            selectBtn.style.background = '#10B981';
            selectBtn.style.cursor = 'default';
            selectBtn.onmouseover = null;
            selectBtn.onmouseout = null;
            selectBtn.onclick = null;
        }
    };
    
    input.click();
};

// ============================================================
// 2. ПОСТРОЕНИЕ HTML ДЕРЕВА ДЛЯ ПРЕВЬЮ
// ============================================================

function buildTreeHTML(node, level) {
    var html = '';
    
    var folderNames = Object.keys(node.children).sort();
    var files = node.files.sort(function(a, b) { return a.name.localeCompare(b.name); });
    
    folderNames.forEach(function(name) {
        var child = node.children[name];
        var fileCount = countFiles(child);
        
        html += '<div style="padding-left: ' + (level * 20) + 'px; margin: 2px 0;">';
        html += '<span style="color: #f59e0b; font-weight: 500;">📁 ' + name + '</span>';
        html += ' <span style="color: #6c757d; font-size: 11px;">(' + fileCount + ')</span>';
        html += '</div>';
        html += buildTreeHTML(child, level + 1);
    });
    
    files.forEach(function(file) {
        var extColors = {
            js: '#f7df1e',
            ts: '#3178c6',
            py: '#3776ab',
            java: '#007396',
            go: '#00add8',
            rs: '#dea584',
            cpp: '#00599c',
            php: '#777bb4',
            rb: '#cc342d',
            cs: '#512bd4',
            html: '#e34c26',
            css: '#264de4',
            json: '#f5a623'
        };
        var color = extColors[file.ext] || '#6c757d';
        
        html += '<div style="padding-left: ' + ((level + 1) * 20) + 'px; margin: 1px 0; font-size: 13px;">';
        html += '<span style="color: ' + color + ';">📄</span> ';
        html += '<span style="color: #1a1a2e;">' + file.name + '</span>';
        html += ' <span style="color: #6c757d; font-size: 10px;">' + (file.size / 1024).toFixed(1) + ' KB</span>';
        html += '</div>';
    });
    
    return html;
}

function countFiles(node) {
    var count = node.files.length;
    var folderNames = Object.keys(node.children);
    folderNames.forEach(function(name) {
        count += countFiles(node.children[name]);
    });
    return count;
}

// ============================================================
// 3. ОТРИСОВКА ДЕРЕВА НА ХОЛСТЕ
// ============================================================

function renderProjectTree(tree) {
    if (typeof elements !== 'undefined') {
        elements = [];
    }
    if (typeof connections !== 'undefined') {
        connections = [];
    }
    if (typeof selectedElement !== 'undefined') {
        selectedElement = null;
    }
    
    if (!tree || countFiles(tree) === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Информация', 'Нет файлов для отображения', 'info');
        }
        return;
    }
    
    var rootId = ++elementIdCounter;
    elements.push({
        id: rootId,
        type: 'project-root',
        name: '📁 ' + (tree.name || 'Проект'),
        x: 50,
        y: 50,
        color: '#8B5CF6',
        width: 160,
        height: 44,
        isTool: false,
        isCode: false,
        bgColor: '#8B5CF620',
        borderColor: '#8B5CF6',
        textColor: '#8B5CF6',
        isFolder: true
    });
    
    var startX = 50;
    var startY = 100;
    
    function addTreeNodes(node, parentId, x, y) {
        var folderNames = Object.keys(node.children).sort();
        var files = node.files.sort(function(a, b) { return a.name.localeCompare(b.name); });
        
        var yOffset = 0;
        var xOffset = 180;
        
        folderNames.forEach(function(name) {
            var child = node.children[name];
            var id = ++elementIdCounter;
            var xPos = x + xOffset;
            var yPos = y + yOffset;
            
            elements.push({
                id: id,
                type: 'project-folder',
                name: '📁 ' + name + ' (' + countFiles(child) + ')',
                x: xPos,
                y: yPos,
                color: '#F59E0B',
                width: 140,
                height: 36,
                isTool: false,
                isCode: false,
                bgColor: '#F59E0B20',
                borderColor: '#F59E0B',
                textColor: '#F59E0B',
                isFolder: true,
                folderData: child
            });
            
            connections.push({
                id: connections.length + 1,
                from: parentId,
                to: id,
                type: 'contains',
                label: '',
                color: '#D1D5DB'
            });
            
            yOffset += 46;
            
            addTreeNodes(child, id, xPos, yPos + 46);
        });
        
        files.forEach(function(file) {
            var id = ++elementIdCounter;
            var xPos = x + xOffset;
            var yPos = y + yOffset;
            
            var extColors = {
                js: '#f7df1e',
                ts: '#3178c6',
                py: '#3776ab',
                java: '#007396',
                go: '#00add8',
                rs: '#dea584',
                cpp: '#00599c',
                php: '#777bb4',
                rb: '#cc342d',
                cs: '#512bd4',
                html: '#e34c26',
                css: '#264de4',
                json: '#f5a623'
            };
            var color = extColors[file.ext] || '#6c757d';
            
            elements.push({
                id: id,
                type: 'project-file',
                name: '📄 ' + file.name,
                x: xPos,
                y: yPos,
                color: color,
                width: 130,
                height: 32,
                isTool: false,
                isCode: false,
                bgColor: color + '20',
                borderColor: color,
                textColor: color,
                isFile: true,
                fileData: file
            });
            
            connections.push({
                id: connections.length + 1,
                from: parentId,
                to: id,
                type: 'contains',
                label: '',
                color: '#D1D5DB'
            });
            
            yOffset += 36;
        });
        
        return yOffset;
    }
    
    addTreeNodes(tree, rootId, startX, startY);
    
    if (typeof renderElements === 'function') {
        renderElements();
    }
    if (typeof renderConnections === 'function') {
        renderConnections();
    }
    
    setTimeout(function() {
        if (typeof autoFitCanvas === 'function') {
            autoFitCanvas();
        }
    }, 200);
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Успешно', 'Построено дерево проекта: ' + countFiles(tree) + ' файлов', 'success');
    }
}

// ============================================================
// 4. УПРАВЛЕНИЕ МОДАЛЬНЫМ ОКНОМ
// ============================================================

function openProjectModal() {
    var modal = document.getElementById('projectInfoModal');
    if (!modal) return;
    
    document.querySelectorAll('.diagram-type-card').forEach(function(el) {
        el.classList.remove('selected');
    });
    
    var defaultCard = document.querySelector('.diagram-type-card[data-type="structure"]');
    if (defaultCard) {
        defaultCard.classList.add('selected');
        selectedDiagramType = 'structure';
    }
    
    var showFunctions = document.getElementById('showFunctions');
    var showImports = document.getElementById('showImports');
    var showCalls = document.getElementById('showCalls');
    
    if (showFunctions) showFunctions.checked = true;
    if (showImports) showImports.checked = true;
    if (showCalls) showCalls.checked = true;
    
    var buildBtn = document.getElementById('buildDiagramBtn');
    if (buildBtn) {
        buildBtn.disabled = true;
        buildBtn.style.opacity = '0.5';
        buildBtn.style.cursor = 'not-allowed';
    }
    
    var selectBtn = document.querySelector('#projectInfoModal button[onclick="selectProjectFolder()"]');
    if (selectBtn) {
        selectBtn.innerHTML = '<i class="fas fa-folder-open"></i> Выбрать папку проекта';
        selectBtn.style.background = '#8B5CF6';
        selectBtn.style.cursor = 'pointer';
        selectBtn.onmouseover = function() { this.style.background = '#7C3AED'; };
        selectBtn.onmouseout = function() { this.style.background = '#8B5CF6'; };
        selectBtn.onclick = function() { selectProjectFolder(); };
    }
    
    var infoBlock = document.getElementById('projectInfoBlock');
    if (infoBlock) {
        infoBlock.style.display = 'none';
    }
    
    projectTreeData = null;
    isProjectLoaded = false;
    projectFilesMap = {};
    
    var filesEl = document.getElementById('projectFilesModal');
    if (filesEl) filesEl.innerHTML = '';
    
    var countEl = document.getElementById('projectFileCount');
    if (countEl) countEl.textContent = '0';
    
    var nameEl = document.getElementById('projectNameText');
    if (nameEl) nameEl.textContent = 'Проект';
    
    modal.style.display = 'flex';
}

function closeProjectModal() {
    var modal = document.getElementById('projectInfoModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function updateProjectInfo() {
    var infoBlock = document.getElementById('projectInfoBlock');
    var nameEl = document.getElementById('projectNameText');
    var filesEl = document.getElementById('projectFilesModal');
    var countEl = document.getElementById('projectFileCount');
    var buildBtn = document.getElementById('buildDiagramBtn');
    
    if (infoBlock) infoBlock.style.display = 'block';
    
    if (nameEl && projectTreeData) {
        var rootName = projectTreeData.name || 'Проект';
        nameEl.textContent = rootName;
    }
    
    if (filesEl && projectTreeData) {
        var html = buildTreeHTML(projectTreeData, 0);
        filesEl.innerHTML = html;
    }
    
    if (countEl && projectTreeData) {
        var totalFiles = countFiles(projectTreeData);
        countEl.textContent = totalFiles;
    }
    
    if (buildBtn) {
        buildBtn.disabled = false;
        buildBtn.style.opacity = '1';
        buildBtn.style.cursor = 'pointer';
    }
}

// ============================================================
// 5. ВЫБОР ТИПА ДИАГРАММЫ
// ============================================================

function selectDiagramTypeCard(type) {
    selectedDiagramType = type;
    
    document.querySelectorAll('.diagram-type-card').forEach(function(el) {
        el.classList.remove('selected');
    });
    
    var selected = document.querySelector('.diagram-type-card[data-type="' + type + '"]');
    if (selected) {
        selected.classList.add('selected');
    }
}

// ============================================================
// 6. ПОСТРОЕНИЕ ВЫБРАННОЙ ДИАГРАММЫ
// ============================================================

function buildSelectedDiagram() {
    if (!projectTreeData || !isProjectLoaded) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Сначала выберите папку проекта', 'warning');
        }
        return;
    }
    
    var showFunctions = document.getElementById('showFunctions').checked;
    var showImports = document.getElementById('showImports').checked;
    var showCalls = document.getElementById('showCalls').checked;
    
    var options = {
        type: selectedDiagramType,
        showFunctions: showFunctions,
        showImports: showImports,
        showCalls: showCalls
    };
    
    if (typeof elements !== 'undefined') {
        elements = [];
    }
    if (typeof connections !== 'undefined') {
        connections = [];
    }
    
    if (selectedDiagramType === 'structure') {
        if (typeof renderProjectTree === 'function') {
            renderProjectTree(projectTreeData);
            
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Успешно', 'Построена структура проекта', 'success');
            }
        }
    } else if (selectedDiagramType === 'dataflow') {
        analyzeProjectDataFlow(options);
    } else if (selectedDiagramType === 'callgraph') {
        analyzeProjectCallGraph(options);
    }
    
    closeProjectModal();
}

// ============================================================
// 7. АНАЛИЗ ПОТОКОВ ДАННЫХ
// ============================================================

function analyzeProjectDataFlow(options) {
    if (!projectTreeData || !isProjectLoaded) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Сначала выберите папку проекта', 'warning');
        }
        return;
    }
    
    var allFiles = [];
    function collectFiles(node) {
        node.files.forEach(function(file) {
            allFiles.push(file);
        });
        var folderNames = Object.keys(node.children);
        folderNames.forEach(function(name) {
            collectFiles(node.children[name]);
        });
    }
    collectFiles(projectTreeData);
    
    if (allFiles.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Нет файлов для анализа', 'warning');
        }
        return;
    }
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Анализ потоков данных', 'Анализ ' + allFiles.length + ' файлов...', 'info');
    }
    
    var processed = 0;
    var allFunctions = [];
    var allCalls = [];
    
    allFiles.forEach(function(fileData) {
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var content = e.target.result;
                var ext = fileData.ext;
                
                // Используем AST парсер
                var parseResult = parseCodeWithAST(content, ext);
                
                if (options.showFunctions && parseResult.functions) {
                    parseResult.functions.forEach(function(fn) {
                        fn.file = fileData.path;
                        allFunctions.push(fn);
                    });
                }
                
                if (options.showCalls && parseResult.calls) {
                    parseResult.calls.forEach(function(call) {
                        call.file = fileData.path;
                        allCalls.push(call);
                    });
                }
            } catch (err) {}
            
            processed++;
            if (processed === allFiles.length) {
                buildDataFlowDiagram({
                    functions: allFunctions,
                    calls: allCalls
                }, 'проект');
            }
        };
        reader.readAsText(fileData.file);
    });
}

// ============================================================
// 8. АНАЛИЗ ГРАФА ВЫЗОВОВ
// ============================================================

function analyzeProjectCallGraph(options) {
    if (!projectTreeData || !isProjectLoaded) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Сначала выберите папку проекта', 'warning');
        }
        return;
    }
    
    var allFiles = [];
    function collectFiles(node) {
        node.files.forEach(function(file) {
            allFiles.push(file);
        });
        var folderNames = Object.keys(node.children);
        folderNames.forEach(function(name) {
            collectFiles(node.children[name]);
        });
    }
    collectFiles(projectTreeData);
    
    if (allFiles.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Нет файлов для анализа', 'warning');
        }
        return;
    }
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Построение графа вызовов', 'Анализ ' + allFiles.length + ' файлов...', 'info');
    }
    
    var processed = 0;
    var allFunctions = [];
    var allCalls = [];
    
    allFiles.forEach(function(fileData) {
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var content = e.target.result;
                var ext = fileData.ext;
                
                var parseResult = parseCodeWithAST(content, ext);
                
                if (options.showFunctions && parseResult.functions) {
                    parseResult.functions.forEach(function(fn) {
                        fn.file = fileData.path;
                        allFunctions.push(fn);
                    });
                }
                
                if (options.showCalls && parseResult.calls) {
                    parseResult.calls.forEach(function(call) {
                        call.file = fileData.path;
                        allCalls.push(call);
                    });
                }
            } catch (err) {}
            
            processed++;
            if (processed === allFiles.length) {
                buildCallGraph({
                    functions: allFunctions,
                    calls: allCalls
                }, 'проект');
            }
        };
        reader.readAsText(fileData.file);
    });
}

// ============================================================
// 9. ПОСТРОЕНИЕ ДИАГРАММЫ ПОТОКОВ ДАННЫХ
// ============================================================

function buildDataFlowDiagram(parseResult, fileName) {
    var functions = parseResult.functions || [];
    var calls = parseResult.calls || [];
    
    if (functions.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Информация', 'Не найдены функции для построения диаграммы потоков данных', 'info');
        }
        return;
    }
    
    if (typeof elements !== 'undefined') {
        elements = [];
    }
    if (typeof connections !== 'undefined') {
        connections = [];
    }
    if (typeof selectedElement !== 'undefined') {
        selectedElement = null;
    }
    
    // Создаем карту функций
    var functionMap = {};
    functions.forEach(function(fn) {
        if (!functionMap[fn.name]) {
            functionMap[fn.name] = {
                name: fn.name,
                params: fn.params || [],
                type: fn.type || 'function',
                file: fn.file || ''
            };
        }
    });
    
    var functionNames = Object.keys(functionMap);
    
    // Создаем узлы
    var nodeIds = {};
    var cols = Math.ceil(Math.sqrt(functionNames.length)) || 1;
    var spacingX = 220;
    var spacingY = 80;
    
    functionNames.forEach(function(name, index) {
        var fn = functionMap[name];
        var id = ++elementIdCounter;
        nodeIds[name] = id;
        
        var row = Math.floor(index / cols);
        var col = index % cols;
        
        var color = fn.type === 'class' ? '#10B981' : 
                    fn.type === 'method' ? '#3B82F6' : '#8B5CF6';
        
        var paramsStr = fn.params.length > 0 ? '(' + fn.params.join(', ') + ')' : '()';
        var displayName = name + paramsStr;
        
        elements.push({
            id: id,
            type: 'data-flow-node',
            name: displayName,
            x: 50 + col * spacingX,
            y: 50 + row * spacingY,
            color: color,
            width: 180,
            height: 48,
            isTool: false,
            isCode: false,
            bgColor: color + '15',
            borderColor: color,
            textColor: color,
            fontSize: 13,
            cornerRadius: 8,
            functionData: fn,
            params: fn.params,
            isDataFlowNode: true
        });
    });
    
    // Создаем связи
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
        
        var toFn = functionMap[toName];
        var params = toFn && toFn.params ? toFn.params : [];
        var label = params.length > 0 ? params.join(', ') : 'данные';
        
        connections.push({
            id: connections.length + 1,
            from: nodeIds[fromName],
            to: nodeIds[toName],
            type: 'data-flow',
            label: label,
            color: '#10B981',
            arrow: true,
            lineWidth: 2
        });
    });
    
    // Если связей нет - создаем поток по порядку
    if (connections.length === 0 && functionNames.length > 1) {
        for (var i = 0; i < functionNames.length - 1; i++) {
            var fromName = functionNames[i];
            var toName = functionNames[i + 1];
            var toFn = functionMap[toName];
            var params = toFn && toFn.params ? toFn.params : [];
            var label = params.length > 0 ? params.join(', ') : 'данные';
            
            connections.push({
                id: connections.length + 1,
                from: nodeIds[fromName],
                to: nodeIds[toName],
                type: 'data-flow',
                label: label,
                color: '#10B981',
                arrow: true,
                lineWidth: 2
            });
        }
    }
    
    if (typeof renderElements === 'function') {
        renderElements();
    }
    if (typeof renderConnections === 'function') {
        renderConnections();
    }
    
    setTimeout(function() {
        if (typeof autoFitCanvas === 'function') {
            autoFitCanvas();
        }
    }, 100);
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Успешно', 
            'Построена диаграмма потоков данных:\n' +
            '🔧 ' + functionNames.length + ' функций\n' +
            '🔗 ' + connections.length + ' потоков', 
            'success'
        );
    }
}

// ============================================================
// 10. ПОСТРОЕНИЕ ГРАФА ВЫЗОВОВ
// ============================================================

function buildCallGraph(parseResult, fileName) {
    var functions = parseResult.functions || [];
    var calls = parseResult.calls || [];
    
    if (functions.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Информация', 'В файле не найдены функции для построения графа вызовов', 'info');
        }
        return;
    }
    
    if (typeof elements !== 'undefined') {
        elements = [];
    }
    if (typeof connections !== 'undefined') {
        connections = [];
    }
    if (typeof selectedElement !== 'undefined') {
        selectedElement = null;
    }
    
    // Создаем карту функций
    var functionMap = {};
    var functionNames = [];
    
    functions.forEach(function(fn) {
        if (!functionMap[fn.name]) {
            functionMap[fn.name] = {
                name: fn.name,
                params: fn.params || [],
                type: fn.type || 'function',
                line: fn.line || 0,
                calls: []
            };
            functionNames.push(fn.name);
        }
    });
    
    // Анализируем вызовы
    calls.forEach(function(call) {
        var from = call.from;
        var to = call.to;
        
        if (functionMap[from] && functionMap[to]) {
            if (functionMap[from].calls.indexOf(to) === -1) {
                functionMap[from].calls.push(to);
            }
        }
    });
    
    // Находим точки входа
    var calledFunctions = {};
    for (var name in functionMap) {
        var fn = functionMap[name];
        fn.calls.forEach(function(calledName) {
            calledFunctions[calledName] = true;
        });
    }
    
    var entryPoints = functionNames.filter(function(name) {
        return !calledFunctions[name];
    });
    
    if (entryPoints.length === 0) {
        entryPoints = functionNames;
    }
    
    // Располагаем функции на холсте
    var spacingX = 180;
    var spacingY = 60;
    var cols = 4;
    var startX = 80;
    var startY = 80;
    
    functionNames.sort();
    
    var nodeIds = {};
    functionNames.forEach(function(name, index) {
        var fn = functionMap[name];
        var id = ++elementIdCounter;
        nodeIds[name] = id;
        
        var row = Math.floor(index / cols);
        var col = index % cols;
        
        var x = startX + col * spacingX;
        var y = startY + row * spacingY;
        
        var color = '#8B5CF6';
        var bgColor = '#8B5CF620';
        var icon = '⚡';
        
        if (fn.type === 'class') {
            color = '#10B981';
            bgColor = '#10B98120';
            icon = '📦';
        } else if (fn.type === 'method') {
            color = '#3B82F6';
            bgColor = '#3B82F620';
            icon = '🔧';
        }
        
        var callCount = fn.calls.length;
        var label = icon + ' ' + name;
        if (callCount > 0) {
            label += ' →' + callCount;
        }
        
        if (entryPoints.indexOf(name) !== -1) {
            label = '⭐ ' + label;
        }
        
        elements.push({
            id: id,
            type: 'function-node',
            name: label,
            x: x,
            y: y,
            color: color,
            width: 160,
            height: 40,
            isTool: false,
            isCode: false,
            bgColor: bgColor,
            borderColor: color,
            textColor: color,
            functionName: name,
            isEntryPoint: entryPoints.indexOf(name) !== -1,
            callCount: callCount,
            fontSize: 12
        });
    });
    
    // Создаем связи
    var connectionSet = {};
    
    for (var fromName in functionMap) {
        var fromId = nodeIds[fromName];
        if (!fromId) continue;
        
        var toNames = functionMap[fromName].calls;
        toNames.forEach(function(toName) {
            var toId = nodeIds[toName];
            if (!toId) return;
            
            var key = fromName + '->' + toName;
            if (connectionSet[key]) return;
            connectionSet[key] = true;
            
            var toFn = functionMap[toName];
            var color = (toFn && toFn.type === 'method') ? '#3B82F6' : '#8B5CF6';
            
            connections.push({
                id: connections.length + 1,
                from: fromId,
                to: toId,
                type: 'call',
                label: 'вызов',
                color: color,
                arrow: true
            });
        });
    }
    
    // Легенда
    var legendId = ++elementIdCounter;
    elements.push({
        id: legendId,
        type: 'legend',
        name: 'Легенда',
        x: 20,
        y: 20,
        color: '#FFFFFF',
        width: 160,
        height: 130,
        isTool: false,
        isCode: false,
        bgColor: '#FFFFFF',
        borderColor: '#E0E0E0',
        textColor: '#37474F',
        isLegend: true,
        cornerRadius: 6,
        borderWidth: 1
    });
    
    if (typeof renderElements === 'function') {
        renderElements();
    }
    if (typeof renderConnections === 'function') {
        renderConnections();
    }
    
    setTimeout(function() {
        if (typeof autoFitCanvas === 'function') {
            autoFitCanvas();
        }
    }, 200);
    
    if (typeof showCustomAlert === 'function') {
        var hasCalls = Object.keys(connectionSet).length > 0;
        var msg = '📊 ' + functionNames.length + ' функций\n';
        msg += '⭐ ' + entryPoints.length + ' точек входа\n';
        msg += '🔗 ' + Object.keys(connectionSet).length + ' связей';
        
        if (!hasCalls) {
            msg += '\n\n⚠️ Связи не найдены. Функции могут не вызывать друг друга.';
        }
        
        showCustomAlert('Граф вызовов построен', msg, 'success');
    }
}

// ============================================================
// 11. АНАЛИЗ ПРОЕКТА
// ============================================================

window.analyzeProject = function() {
    if (!projectTreeData) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Сначала выберите папку проекта', 'warning');
        }
        return;
    }
    
    var allFiles = [];
    function collectFiles(node) {
        node.files.forEach(function(file) {
            allFiles.push(file);
        });
        var folderNames = Object.keys(node.children);
        folderNames.forEach(function(name) {
            collectFiles(node.children[name]);
        });
    }
    collectFiles(projectTreeData);
    
    if (allFiles.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Нет файлов для анализа', 'warning');
        }
        return;
    }
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Анализ', 'Анализ ' + allFiles.length + ' файлов...', 'info');
    }
    
    if (typeof closeCodeFileModal === 'function') {
        closeCodeFileModal();
    }
    
    var processed = 0;
    var allFunctions = [];
    var allCalls = [];
    var allImports = [];
    
    allFiles.forEach(function(fileData) {
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var content = e.target.result;
                var ext = fileData.ext;
                
                var parseResult = parseCodeWithAST(content, ext);
                
                if (parseResult.functions) {
                    parseResult.functions.forEach(function(fn) {
                        fn.file = fileData.path;
                        allFunctions.push(fn);
                    });
                }
                
                if (parseResult.calls) {
                    parseResult.calls.forEach(function(call) {
                        call.file = fileData.path;
                        allCalls.push(call);
                    });
                }
                
                if (parseResult.imports) {
                    parseResult.imports.forEach(function(imp) {
                        imp.file = fileData.path;
                        allImports.push(imp);
                    });
                }
            } catch (err) {}
            
            processed++;
            if (processed === allFiles.length) {
                var msg = '🔧 ' + allFunctions.length + ' функций\n' +
                         '🔗 ' + allCalls.length + ' вызовов\n' +
                         '📦 ' + allImports.length + ' импортов';
                
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('Анализ завершен', msg, 'success');
                }
                
                buildProjectCallGraph(allFunctions, allCalls);
            }
        };
        reader.readAsText(fileData.file);
    });
};

// ============================================================
// 12. ГРАФ ВЫЗОВОВ ПРОЕКТА
// ============================================================

function buildProjectCallGraph(functions, calls) {
    if (functions.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Информация', 'В проекте не найдены функции', 'info');
        }
        return;
    }
    
    var choice = confirm('Построить граф вызовов? (ОК - очистить холст, Отмена - добавить к дереву)');
    
    if (choice) {
        if (typeof elements !== 'undefined') {
            elements = [];
        }
        if (typeof connections !== 'undefined') {
            connections = [];
        }
    }
    
    var functionMap = {};
    functions.forEach(function(fn) {
        if (!functionMap[fn.name]) {
            functionMap[fn.name] = {
                name: fn.name,
                params: fn.params || [],
                type: fn.type || 'function',
                files: []
            };
        }
        if (fn.file && functionMap[fn.name].files.indexOf(fn.file) === -1) {
            functionMap[fn.name].files.push(fn.file);
        }
    });
    
    var functionNames = Object.keys(functionMap);
    var cols = Math.ceil(Math.sqrt(functionNames.length)) || 1;
    var spacingX = 200;
    var spacingY = 100;
    var startX = 50;
    var startY = 50;
    
    var nodeIds = {};
    functionNames.forEach(function(name, index) {
        var fn = functionMap[name];
        var id = ++elementIdCounter;
        nodeIds[name] = id;
        
        var row = Math.floor(index / cols);
        var col = index % cols;
        
        var color = fn.type === 'class' ? '#10B981' : 
                    fn.type === 'method' ? '#3B82F6' : '#8B5CF6';
        
        var filesText = fn.files.length > 1 ? ' (' + fn.files.length + ')' : '';
        var displayName = fn.name + filesText;
        
        elements.push({
            id: id,
            type: 'function',
            name: displayName,
            x: startX + col * spacingX,
            y: startY + row * spacingY,
            color: color,
            width: 160,
            height: 44,
            isTool: false,
            isCode: false,
            bgColor: color + '20',
            borderColor: color,
            textColor: color
        });
    });
    
    var callSet = new Set();
    calls.forEach(function(call) {
        var fromName = call.from;
        var toName = call.to;
        
        if (fromName === 'global' || toName === 'global') return;
        if (!nodeIds[fromName] || !nodeIds[toName]) return;
        if (fromName === toName) return;
        
        var key = fromName + '->' + toName;
        if (callSet.has(key)) return;
        callSet.add(key);
        
        connections.push({
            id: connections.length + 1,
            from: nodeIds[fromName],
            to: nodeIds[toName],
            type: 'control',
            label: 'вызов',
            color: '#8B5CF6'
        });
    });
    
    if (typeof renderElements === 'function') {
        renderElements();
    }
    if (typeof renderConnections === 'function') {
        renderConnections();
    }
    
    setTimeout(function() {
        if (typeof autoFitCanvas === 'function') {
            autoFitCanvas();
        }
    }, 200);
}

// ============================================================
// 13. АНАЛИЗ ПРОЕКТА С ОПЦИЯМИ
// ============================================================

function analyzeProjectWithOptions(options) {
    if (!projectTreeData || !isProjectLoaded) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Сначала выберите папку проекта', 'warning');
        }
        return;
    }
    
    var allFiles = [];
    function collectFiles(node) {
        node.files.forEach(function(file) {
            allFiles.push(file);
        });
        var folderNames = Object.keys(node.children);
        folderNames.forEach(function(name) {
            collectFiles(node.children[name]);
        });
    }
    collectFiles(projectTreeData);
    
    if (allFiles.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Нет файлов для анализа', 'warning');
        }
        return;
    }
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Анализ', 'Анализ ' + allFiles.length + ' файлов...', 'info');
    }
    
    var processed = 0;
    var allFunctions = [];
    var allCalls = [];
    var allImports = [];
    
    allFiles.forEach(function(fileData) {
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var content = e.target.result;
                var ext = fileData.ext;
                
                var parseResult = parseCodeWithAST(content, ext);
                
                if (options.showFunctions && parseResult.functions) {
                    parseResult.functions.forEach(function(fn) {
                        fn.file = fileData.path;
                        allFunctions.push(fn);
                    });
                }
                
                if (options.showCalls && parseResult.calls) {
                    parseResult.calls.forEach(function(call) {
                        call.file = fileData.path;
                        allCalls.push(call);
                    });
                }
                
                if (options.showImports && parseResult.imports) {
                    parseResult.imports.forEach(function(imp) {
                        imp.file = fileData.path;
                        allImports.push(imp);
                    });
                }
            } catch (err) {}
            
            processed++;
            if (processed === allFiles.length) {
                if (typeof elements !== 'undefined') {
                    elements = [];
                }
                if (typeof connections !== 'undefined') {
                    connections = [];
                }
                
                if (options.type === 'dataflow') {
                    buildDataFlowDiagram({
                        functions: allFunctions,
                        calls: allCalls,
                        imports: allImports
                    }, 'проект');
                } else if (options.type === 'callgraph') {
                    buildCallGraph({
                        functions: allFunctions,
                        calls: allCalls
                    }, 'проект');
                }
            }
        };
        reader.readAsText(fileData.file);
    });
}

// ============================================================
// 14. ЗАГРУЗКА ПРОЕКТА
// ============================================================

window.loadProject = function() {
    window.analyzeProject();
};

// ============================================================
// 15. РЕГИСТРАЦИЯ ФУНКЦИЙ
// ============================================================

window.openProjectModal = openProjectModal;
window.closeProjectModal = closeProjectModal;
window.selectDiagramTypeCard = selectDiagramTypeCard;
window.buildSelectedDiagram = buildSelectedDiagram;
window.analyzeProjectWithOptions = analyzeProjectWithOptions;
window.selectProjectFolder = selectProjectFolder;
window.updateProjectInfo = updateProjectInfo;
window.renderProjectTree = renderProjectTree;
window.analyzeProject = analyzeProject;
window.loadProject = loadProject;
window.buildProjectCallGraph = buildProjectCallGraph;
window.buildCallGraph = buildCallGraph;
window.buildDataFlowDiagram = buildDataFlowDiagram;
window.analyzeProjectDataFlow = analyzeProjectDataFlow;
window.analyzeProjectCallGraph = analyzeProjectCallGraph;
window.parseCodeWithAST = parseCodeWithAST;