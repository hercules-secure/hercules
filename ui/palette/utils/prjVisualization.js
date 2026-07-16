
var projectTreeData = null;
var projectFilesMap = {};
var selectedDiagramType = 'structure';
var isProjectLoaded = false;


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
    
    if (selectedDiagramType === 'structure') {
        if (typeof renderProjectTree === 'function') {
            if (typeof elements !== 'undefined') {
                elements = [];
            }
            if (typeof connections !== 'undefined') {
                connections = [];
            }
            
            renderProjectTree(projectTreeData);
            
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Успешно', 'Построена структура проекта', 'success');
            }
        }
    } else if (selectedDiagramType === 'dataflow') {
        analyzeProjectWithOptions(options);
    } else if (selectedDiagramType === 'callgraph') {
        analyzeProjectWithOptions(options);
    }
    
    closeProjectModal();
}

// ============================================================
// 7. АНАЛИЗ ПРОЕКТА С ОПЦИЯМИ
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
                
                if (typeof parseCodeForCallGraph === 'function') {
                    var parseResult = parseCodeForCallGraph(content, ext);
                    
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
                    if (typeof buildDataFlowDiagram === 'function') {
                        buildDataFlowDiagram({
                            functions: allFunctions,
                            calls: allCalls,
                            imports: allImports
                        }, 'проект');
                    }
                } else if (options.type === 'callgraph') {
                    if (typeof buildCallGraph === 'function') {
                        buildCallGraph({
                            functions: allFunctions,
                            calls: allCalls
                        }, 'проект');
                    }
                }
            }
        };
        reader.readAsText(fileData.file);
    });
}

// ============================================================
// 8. АНАЛИЗ ПРОЕКТА (ДЛЯ СОВМЕСТИМОСТИ)
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
                
                if (typeof parseCodeForCallGraph === 'function') {
                    var parseResult = parseCodeForCallGraph(content, ext);
                    
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
// 9. ГРАФ ВЫЗОВОВ ПРОЕКТА
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
// 10. ЗАГРУЗКА ПРОЕКТА (АЛЬЯС)
// ============================================================

window.loadProject = function() {
    window.analyzeProject();
};

// ============================================================
// 11. РЕГИСТРАЦИЯ ФУНКЦИЙ
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