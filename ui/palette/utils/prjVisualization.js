var projectTreeData = null;
var projectFilesMap = {};
var selectedDiagramType = 'structure';
var isProjectLoaded = false;

function parseCodeWithAST(code, ext) {
    var lang = ext.toLowerCase();
    
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
        if (typeof parseCodeForCallGraph === 'function') {
            return parseCodeForCallGraph(code, ext);
        }
        return { functions: [], calls: [], imports: [], exports: [] };
    }
}

function parseJavaScriptEnhanced(code) {
    var result = {
        functions: [],
        calls: [],
        imports: [],
        exports: [],
        classes: []
    };
    
    var funcRegex = /function\s+(\w+)\s*\(([^)]*)\)/g;
    var arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\(([^)]*)\)\s*=>|([^=]+)\s*=>)/g;
    var classRegex = /class\s+(\w+)/g;
    var methodRegex = /(\w+)\s*\([^)]*\)\s*\{/g;
    var callRegex = /(\w+)\s*\(/g;
    var importRegex = /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    var exportRegex = /export\s+(?:default\s+)?(?:{([^}]+)}|(\w+))/g;
    
    var match;
    var currentClass = null;
    
    while ((match = classRegex.exec(code)) !== null) {
        result.classes.push({
            name: match[1],
            line: getLineNumber(code, match.index)
        });
    }
    
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
    
    var reservedMethods = ['if', 'for', 'while', 'switch', 'catch', 'try', 'else', 'case', 'default', 'with'];
    while ((match = methodRegex.exec(code)) !== null) {
        var methodName = match[1];
        if (reservedMethods.indexOf(methodName) === -1) {
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

window.selectProjectFolder = function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    
    input.onchange = function(e) {
        var files = e.target.files;
        if (!files || files.length === 0) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Error', 'No folder selected', 'warning');
            }
            return;
        }
        
        var tree = {
            name: 'Project',
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
            var validExtensions = ['js', 'ts', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'h', 'php', 'rb', 'cs', 'sh', 'jsx', 'tsx', 'vue', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'md', 'txt', 'conf'];
            
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
                showCustomAlert('Error', 'No code files found in folder', 'warning');
            }
            return;
        }
        
        projectTreeData = tree;
        isProjectLoaded = true;
        
        updateProjectInfo();
        
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Success', 'Found ' + countFiles(tree) + ' files in project', 'success');
        }
        
        var selectBtn = document.querySelector('#projectInfoModal button[onclick="selectProjectFolder()"]');
        if (selectBtn) {
            selectBtn.innerHTML = '<i class="fas fa-check-circle"></i> Project loaded (' + countFiles(tree) + ' files)';
            selectBtn.style.background = '#10B981';
            selectBtn.style.cursor = 'default';
            selectBtn.onmouseover = null;
            selectBtn.onmouseout = null;
            selectBtn.onclick = null;
        }
    };
    
    input.click();
};

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
            showCustomAlert('Info', 'No files to display', 'info');
        }
        return;
    }
    
    var rootId = ++elementIdCounter;
    elements.push({
        id: rootId,
        type: 'project-root',
        name: '📁 ' + (tree.name || 'Project'),
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
        showCustomAlert('Success', 'Project tree built: ' + countFiles(tree) + ' files', 'success');
    }
}

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
        selectBtn.innerHTML = '<i class="fas fa-folder-open"></i> Select project folder';
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
    if (nameEl) nameEl.textContent = 'Project';
    
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
        var rootName = projectTreeData.name || 'Project';
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

function buildSelectedDiagram() {
    if (!projectTreeData || !isProjectLoaded) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Error', 'Select project folder first', 'warning');
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
                showCustomAlert('Success', 'Project structure built', 'success');
            }
        }
    } else if (selectedDiagramType === 'dataflow') {
        analyzeProjectDataFlow(options);
    } else if (selectedDiagramType === 'callgraph') {
        analyzeProjectCallGraph(options);
    }
    
    closeProjectModal();
}

function analyzeProjectDataFlow(options) {
    if (!projectTreeData || !isProjectLoaded) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Error', 'Select project folder first', 'warning');
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
            showCustomAlert('Error', 'No files to analyze', 'warning');
        }
        return;
    }
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Data Flow Analysis', 'Analyzing ' + allFiles.length + ' files...', 'info');
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
                buildDataFlowDiagram({
                    functions: allFunctions,
                    calls: allCalls
                }, 'project');
            }
        };
        reader.readAsText(fileData.file);
    });
}

function analyzeProjectCallGraph(options) {
    if (!projectTreeData || !isProjectLoaded) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Error', 'Select project folder first', 'warning');
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
            showCustomAlert('Error', 'No files to analyze', 'warning');
        }
        return;
    }
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Call Graph', 'Analyzing ' + allFiles.length + ' files...', 'info');
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
                }, 'project');
            }
        };
        reader.readAsText(fileData.file);
    });
}

function buildDataFlowDiagram(parseResult, fileName) {
    var functions = parseResult.functions || [];
    var calls = parseResult.calls || [];
    
    if (functions.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Info', 'No functions found for data flow diagram', 'info');
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
        var label = params.length > 0 ? params.join(', ') : 'data';
        
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
    
    if (connections.length === 0 && functionNames.length > 1) {
        for (var i = 0; i < functionNames.length - 1; i++) {
            var fromName = functionNames[i];
            var toName = functionNames[i + 1];
            var toFn = functionMap[toName];
            var params = toFn && toFn.params ? toFn.params : [];
            var label = params.length > 0 ? params.join(', ') : 'data';
            
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
        showCustomAlert('Success', 
            'Data flow diagram built:\n' +
            '🔧 ' + functionNames.length + ' functions\n' +
            '🔗 ' + connections.length + ' flows', 
            'success'
        );
    }
}

function buildCallGraph(parseResult, fileName) {
    var functions = parseResult.functions || [];
    var calls = parseResult.calls || [];
    
    if (functions.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Info', 'No functions found for call graph', 'info');
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
    
    calls.forEach(function(call) {
        var from = call.from;
        var to = call.to;
        
        if (functionMap[from] && functionMap[to]) {
            if (functionMap[from].calls.indexOf(to) === -1) {
                functionMap[from].calls.push(to);
            }
        }
    });
    
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
                label: 'call',
                color: color,
                arrow: true
            });
        });
    }
    
    var legendId = ++elementIdCounter;
    elements.push({
        id: legendId,
        type: 'legend',
        name: 'Legend',
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
        var msg = '📊 ' + functionNames.length + ' functions\n';
        msg += '⭐ ' + entryPoints.length + ' entry points\n';
        msg += '🔗 ' + Object.keys(connectionSet).length + ' connections';
        
        if (!hasCalls) {
            msg += '\n\n⚠️ No connections found. Functions may not call each other.';
        }
        
        showCustomAlert('Call Graph Built', msg, 'success');
    }
}

window.analyzeProject = function() {
    if (!projectTreeData) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Error', 'Select project folder first', 'warning');
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
            showCustomAlert('Error', 'No files to analyze', 'warning');
        }
        return;
    }
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Analysis', 'Analyzing ' + allFiles.length + ' files...', 'info');
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
                var msg = '🔧 ' + allFunctions.length + ' functions\n' +
                         '🔗 ' + allCalls.length + ' calls\n' +
                         '📦 ' + allImports.length + ' imports';
                
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('Analysis Complete', msg, 'success');
                }
                
                buildProjectCallGraph(allFunctions, allCalls);
            }
        };
        reader.readAsText(fileData.file);
    });
};

function buildProjectCallGraph(functions, calls) {
    if (functions.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Info', 'No functions found in project', 'info');
        }
        return;
    }
    
    var choice = confirm('Build call graph? (OK - clear canvas, Cancel - add to tree)');
    
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
            label: 'call',
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

function analyzeProjectWithOptions(options) {
    if (!projectTreeData || !isProjectLoaded) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Error', 'Select project folder first', 'warning');
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
            showCustomAlert('Error', 'No files to analyze', 'warning');
        }
        return;
    }
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Analysis', 'Analyzing ' + allFiles.length + ' files...', 'info');
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
                    }, 'project');
                } else if (options.type === 'callgraph') {
                    buildCallGraph({
                        functions: allFunctions,
                        calls: allCalls
                    }, 'project');
                }
            }
        };
        reader.readAsText(fileData.file);
    });
}

window.loadProject = function() {
    window.analyzeProject();
};

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