// ============================================================
// SBOM.JS - ПОСТРОЕНИЕ ГРАФА ЗАВИСИМОСТЕЙ ИЗ SBOM
// ============================================================

// ============================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================

var expandedNodes = {};
var hiddenNodes = {};
var nodeElementsMap = {};
var connectionMap = {};
var allConnections = [];
var selectedSbomFile = null;
var vulnerabilitiesMap = {};

// ============================================================
// ПОСТРОЕНИЕ ГРАФА ЗАВИСИМОСТЕЙ ИЗ SBOM
// ============================================================

function buildDependencyGraphFromSBOM(sbomData, fileName) {
    
    clearCanvas(); 
    // Распаковываем


    if (sbomData.sbom) {
        sbomData = sbomData.sbom;
    }
    
    var components = [];
    var dependencies = [];
    var metadata = {};
    var vulnerabilities = [];
    
    // Парсим CycloneDX
    if (sbomData.bomFormat && sbomData.bomFormat === 'CycloneDX') {
        components = sbomData.components || [];
        dependencies = sbomData.dependencies || [];
        metadata = sbomData.metadata || {};
        vulnerabilities = sbomData.vulnerabilities || [];
    }
    else if (sbomData.spdxVersion) {
        components = sbomData.packages || [];
        if (sbomData.relationships) {
            for (var i = 0; i < sbomData.relationships.length; i++) {
                var rel = sbomData.relationships[i];
                if (rel.relationshipType === 'DEPENDS_ON') {
                    dependencies.push({
                        ref: rel.spdxElementId,
                        dependsOn: [rel.relatedSpdxElement]
                    });
                }
            }
        }
    }
    else if (sbomData.components) {
        components = sbomData.components;
        dependencies = sbomData.dependencies || [];
    }
    else if (sbomData.packages) {
        components = sbomData.packages;
    }
    
    if (components.length === 0) {
        showCustomAlert('Ошибка', 'Не найдены компоненты в SBOM', 'error');
        return;
    }
    
    // ============================================================
    // СОХРАНЯЕМ УЯЗВИМОСТИ В ГЛОБАЛЬНУЮ КАРТУ
    // ============================================================
    
    vulnerabilitiesMap = {};
    for (var vi = 0; vi < vulnerabilities.length; vi++) {
        var vuln = vulnerabilities[vi];
        var bomRef = vuln['bom-ref'] || vuln.bomRef || vuln.bom_ref || '';
        if (bomRef) {
            if (!vulnerabilitiesMap[bomRef]) {
                vulnerabilitiesMap[bomRef] = [];
            }
            vulnerabilitiesMap[bomRef].push(vuln);
        }
    }
    
    // ============================================================
    // ОЧИЩАЕМ ХОЛСТ
    // ============================================================
    
    var existingElements = [];
    for (var ei = 0; ei < elements.length; ei++) {
        if (elements[ei].type !== 'sbom-root' && elements[ei].type !== 'sbom-component') {
            existingElements.push(elements[ei]);
        }
    }
    elements = existingElements;
    connections = [];
    selectedElement = null;
    allConnections = [];
    
    expandedNodes = {};
    hiddenNodes = {};
    nodeElementsMap = {};
    connectionMap = {};
    
    // ============================================================
    // СОЗДАЕМ КАРТУ КОМПОНЕНТОВ
    // ============================================================
    
    var componentMap = {};
    var bomRefMap = {};
    var nodeIds = {};
    var childrenMap = {};
    var rootId = null;
    
    if (metadata.component && metadata.component['bom-ref']) {
        rootId = metadata.component['bom-ref'];
    }
    
    for (var ci = 0; ci < components.length; ci++) {
        var comp = components[ci];
        var name = comp.name || comp.packageName || 'unknown';
        var version = comp.version || comp.packageVersion || '';
        var purl = comp.purl || comp.packageUrl || '';
        var bomRef = comp['bom-ref'] || comp.bomRef || comp.ref || '';
        var type = comp.type || 'library';
        
        var key = bomRef || purl || name + (version ? '@' + version : '');
        
        if (componentMap[key]) {
            key = key + '-' + Object.keys(componentMap).length;
        }
        
        // Проверяем есть ли уязвимости
        var hasVuln = vulnerabilitiesMap[bomRef] && vulnerabilitiesMap[bomRef].length > 0;
        var vulnCount = hasVuln ? vulnerabilitiesMap[bomRef].length : 0;
        
        componentMap[key] = {
            name: name,
            version: version,
            purl: purl,
            bomRef: bomRef,
            type: type,
            key: key,
            hasVulnerabilities: hasVuln,
            vulnerabilityCount: vulnCount,
            originalName: name
        };
        
        if (bomRef) {
            bomRefMap[bomRef] = key;
        }
        if (purl) {
            bomRefMap[purl] = key;
        }
    }
    
    var componentKeys = Object.keys(componentMap);
    var allDeps = [];
    var processed = {};
    var rootKey = null;
    
    if (rootId && bomRefMap[rootId]) {
        rootKey = bomRefMap[rootId];
    }
    
    if (!rootKey) {
        for (var key in componentMap) {
            if (componentMap[key].type === 'application') {
                rootKey = key;
                break;
            }
        }
    }
    
    if (!rootKey && componentKeys.length > 0) {
        rootKey = componentKeys[0];
    }
    
    // ============================================================
    // СТРОИМ ГРАФ ЗАВИСИМОСТЕЙ
    // ============================================================
    
    for (var di = 0; di < dependencies.length; di++) {
        var dep = dependencies[di];
        var ref = dep.ref || '';
        var dependsOn = dep.dependsOn || dep.relatedSpdxElement || [];
        
        if (!Array.isArray(dependsOn)) {
            dependsOn = [dependsOn];
        }
        
        var fromKey = null;
        if (ref && bomRefMap[ref]) {
            fromKey = bomRefMap[ref];
        } else if (ref) {
            fromKey = findComponentKey(componentMap, ref);
        }
        
        if (!fromKey) {
            var refName = ref.split('/').pop() || ref;
            fromKey = findComponentKey(componentMap, refName);
        }
        
        for (var toIdx = 0; toIdx < dependsOn.length; toIdx++) {
            var toRef = dependsOn[toIdx];
            var toKey = null;
            if (toRef && bomRefMap[toRef]) {
                toKey = bomRefMap[toRef];
            } else if (toRef) {
                toKey = findComponentKey(componentMap, toRef);
            }
            
            if (!toKey) {
                var toName = toRef.split('/').pop() || toRef;
                toKey = findComponentKey(componentMap, toName);
            }
            
            if (fromKey && toKey && fromKey !== toKey) {
                var key = fromKey + '->' + toKey;
                if (!processed[key]) {
                    processed[key] = true;
                    allDeps.push({
                        from: fromKey,
                        to: toKey
                    });
                    
                    if (!childrenMap[fromKey]) childrenMap[fromKey] = [];
                    if (childrenMap[fromKey].indexOf(toKey) === -1) {
                        childrenMap[fromKey].push(toKey);
                    }
                }
            }
        }
    }
    
    if (allDeps.length === 0 && componentKeys.length > 1) {
        for (var ki = 0; ki < componentKeys.length; ki++) {
            var k = componentKeys[ki];
            if (k !== rootKey) {
                if (!childrenMap[rootKey]) childrenMap[rootKey] = [];
                if (childrenMap[rootKey].indexOf(k) === -1) {
                    childrenMap[rootKey].push(k);
                    allDeps.push({
                        from: rootKey,
                        to: k
                    });
                }
            }
        }
    }
    
    // ============================================================
    // СОБИРАЕМ ТОЛЬКО УЯЗВИМЫЕ КОМПОНЕНТЫ
    // ============================================================
    
    var vulnerableKeys = [];
    for (var vk in componentMap) {
        if (componentMap[vk].hasVulnerabilities) {
            vulnerableKeys.push(vk);
        }
    }
    
    // Если уязвимых компонентов нет - показываем сообщение
    if (vulnerableKeys.length === 0) {
        showCustomAlert('Информация', 'Уязвимостей не найдено', 'info');
        return;
    }
    
    // ============================================================
    // СОЗДАЕМ КОРНЕВОЙ УЗЕЛ
    // ============================================================
    
    var rootIdNode = ++elementIdCounter;
    
    var rootComp = componentMap[rootKey] || { name: 'root', version: '' };
    var rootDisplayName = rootComp.name || 'root';
    if (rootComp.version && rootComp.version !== 'latest' && rootComp.version !== 'main') {
        rootDisplayName += ' (' + rootComp.version + ')';
    }
    
    var shortName = rootDisplayName;
    if (shortName.indexOf('/') !== -1) {
        var parts = shortName.split('/');
        shortName = parts[parts.length - 1];
    }
    
    var rootHasVuln = rootComp.hasVulnerabilities || false;
    var rootVulnCount = rootComp.vulnerabilityCount || 0;
    
    var rootElement = {
        id: rootIdNode,
        type: 'sbom-root',
        name: shortName,
        x: 250,
        y: 30,
        color: rootHasVuln ? '#EF4444' : '#3B82F6',
        width: 280,
        height: 44,
        isTool: false,
        isCode: false,
        componentData: rootComp,
        bgColor: rootHasVuln ? '#EF444420' : '#3B82F620',
        borderColor: rootHasVuln ? '#EF4444' : '#3B82F6',
        textColor: rootHasVuln ? '#EF4444' : '#3B82F6',
        hasChildren: vulnerableKeys.length > 0,
        isExpanded: false,
        children: [],
        parentId: null,
        isRoot: true,
        depth: 0,
        isVisible: true,
        childNodes: [],
        hidden: false,
        hasVulnerabilities: rootHasVuln,
        vulnerabilityCount: rootVulnCount,
        bomRef: rootComp.bomRef
    };
    elements.push(rootElement);
    nodeElementsMap[rootIdNode] = rootElement;
    
    // ============================================================
    // СОЗДАЕМ УЗЛЫ ДЛЯ УЯЗВИМЫХ КОМПОНЕНТОВ
    // ============================================================
    
    var cols = Math.min(Math.ceil(Math.sqrt(vulnerableKeys.length)) || 1, 5);
    var spacingX = 240;
    var spacingY = 140;
    var startX = 60;
    var startY = 100;
    
    for (var vi2 = 0; vi2 < vulnerableKeys.length; vi2++) {
        var key = vulnerableKeys[vi2];
        var comp = componentMap[key];
        if (!comp) continue;
        
        var id = ++elementIdCounter;
        nodeIds[key] = id;
        
        var row = Math.floor(vi2 / cols);
        var col = vi2 % cols;
        
        var displayName = comp.name;
        if (comp.version && comp.version !== 'latest' && comp.version !== 'main' && comp.version !== 'dev-latest') {
            displayName += ' (' + comp.version + ')';
        } else if (comp.version === 'latest') {
            displayName += ' (latest)';
        }
        
        // Проверяем есть ли связь с корнем
        var hasConnectionToRoot = false;
        for (var di2 = 0; di2 < allDeps.length; di2++) {
            if (allDeps[di2].to === key && allDeps[di2].from === rootKey) {
                hasConnectionToRoot = true;
                break;
            }
        }
        
        var parentKey = null;
        if (!hasConnectionToRoot) {
            // Ищем родителя среди уязвимых компонентов
            for (var di3 = 0; di3 < allDeps.length; di3++) {
                if (allDeps[di3].to === key) {
                    var potentialParent = allDeps[di3].from;
                    if (componentMap[potentialParent] && componentMap[potentialParent].hasVulnerabilities) {
                        parentKey = potentialParent;
                        break;
                    }
                }
            }
        }
        
        var element = {
            id: id,
            type: 'sbom-component',
            name: displayName,
            x: startX + col * spacingX,
            y: startY + row * spacingY + 20,
            color: '#EF4444',
            width: 220,
            height: 44,
            isTool: false,
            isCode: false,
            componentData: comp,
            bgColor: '#EF444420',
            borderColor: '#EF4444',
            textColor: '#EF4444',
            hasChildren: false,
            isExpanded: false,
            children: [],
            parentId: parentKey ? nodeIds[parentKey] : (hasConnectionToRoot ? rootIdNode : null),
            isRoot: false,
            depth: 1,
            isVisible: true,
            childNodes: [],
            hidden: false,
            hasVulnerabilities: true,
            vulnerabilityCount: comp.vulnerabilityCount || 0,
            bomRef: comp.bomRef
        };
        elements.push(element);
        nodeElementsMap[id] = element;
        
        // Добавляем в childNodes родителя если есть
        if (parentKey && nodeIds[parentKey]) {
            var parentEl = nodeElementsMap[nodeIds[parentKey]];
            if (parentEl && parentEl.childNodes.indexOf(id) === -1) {
                parentEl.childNodes.push(id);
            }
        }
    }
    
    // ============================================================
    // СОЗДАЕМ СВЯЗИ
    // ============================================================
    
    for (var vi3 = 0; vi3 < vulnerableKeys.length; vi3++) {
        var key = vulnerableKeys[vi3];
        var compId = nodeIds[key];
        if (!compId) continue;
        
        // Проверяем есть ли уже связь
        var hasConnection = false;
        for (var ci2 = 0; ci2 < connections.length; ci2++) {
            if (connections[ci2].to === compId) {
                hasConnection = true;
                break;
            }
        }
        
        if (!hasConnection) {
            // Ищем родителя для связи
            var parentId = null;
            
            // Проверяем прямую связь с корнем
            var hasDirect = false;
            for (var di4 = 0; di4 < allDeps.length; di4++) {
                if (allDeps[di4].to === key && allDeps[di4].from === rootKey) {
                    hasDirect = true;
                    break;
                }
            }
            
            if (hasDirect) {
                parentId = rootIdNode;
            } else {
                // Ищем родителя среди уязвимых
                for (var di5 = 0; di5 < allDeps.length; di5++) {
                    if (allDeps[di5].to === key) {
                        var potentialParent = allDeps[di5].from;
                        if (componentMap[potentialParent] && componentMap[potentialParent].hasVulnerabilities && nodeIds[potentialParent]) {
                            parentId = nodeIds[potentialParent];
                            break;
                        }
                    }
                }
            }
            
            // Если родитель не найден - привязываем к корню
            if (!parentId) {
                parentId = rootIdNode;
            }
            
            if (parentId && compId && parentId !== compId) {
                var connection = {
                    id: connections.length + 1,
                    from: parentId,
                    to: compId,
                    type: 'control',
                    label: 'зависит',
                    color: '#8B5CF6',
                    isVisible: true
                };
                connections.push(connection);
            }
        }
    }
    
    // ============================================================
    // ОТРИСОВКА
    // ============================================================
    
    if (typeof renderElements === 'function') {
        renderElements();
    }
    if (typeof renderConnections === 'function') {
        renderConnections();
    }
    
    setTimeout(autoFitCanvas, 100);
    setTimeout(addGraphControls, 200);
    
    // Экспортируем для контекстного меню
    window.vulnerabilitiesMap = vulnerabilitiesMap;
    window.nodeElementsMap = nodeElementsMap;
    
    showCustomAlert('Успешно', 'Найдено ' + vulnerableKeys.length + ' компонентов с уязвимостями', 'warning');
}

// ============================================================
// ОСТАЛЬНЫЕ ФУНКЦИИ (БЕЗ ИЗМЕНЕНИЙ)
// ============================================================

function expandNode(nodeId) {
    var element = nodeElementsMap[nodeId];
    if (!element) return;
    
    var hasChildren = element.childNodes && element.childNodes.length > 0;
    if (!hasChildren) {
        element.isExpanded = false;
        return;
    }
    
    element.isExpanded = true;
    expandedNodes[nodeId] = true;
    
    for (var i = 0; i < element.childNodes.length; i++) {
        var childId = element.childNodes[i];
        var childEl = nodeElementsMap[childId];
        if (childEl) {
            childEl.isVisible = true;
            childEl.hidden = false;
        }
    }
    
    updateConnectionsVisibility();
    if (typeof renderElements === 'function') renderElements();
    if (typeof renderConnections === 'function') renderConnections();
}

function collapseNode(nodeId) {
    var element = nodeElementsMap[nodeId];
    if (!element) return;
    
    element.isExpanded = false;
    expandedNodes[nodeId] = false;
    
    function hideDescendants(elId) {
        var el = nodeElementsMap[elId];
        if (!el) return;
        
        for (var i = 0; i < el.childNodes.length; i++) {
            var childId = el.childNodes[i];
            var childEl = nodeElementsMap[childId];
            if (childEl) {
                childEl.isVisible = false;
                childEl.hidden = true;
                childEl.isExpanded = false;
                expandedNodes[childId] = false;
                hideDescendants(childId);
            }
        }
    }
    
    hideDescendants(nodeId);
    
    updateConnectionsVisibility();
    if (typeof renderElements === 'function') renderElements();
    if (typeof renderConnections === 'function') renderConnections();
}

function toggleNode(nodeId) {
    var element = nodeElementsMap[nodeId];
    if (!element) return;
    
    if (element.isExpanded) {
        collapseNode(nodeId);
    } else {
        expandNode(nodeId);
    }
}

function expandAllNodes() {
    var allIds = Object.keys(nodeElementsMap);
    for (var i = 0; i < allIds.length; i++) {
        var id = parseInt(allIds[i]);
        var el = nodeElementsMap[id];
        if (el && el.hasChildren) {
            el.isVisible = true;
            el.hidden = false;
            expandNode(id);
        }
    }
    if (typeof renderElements === 'function') renderElements();
    if (typeof renderConnections === 'function') renderConnections();
}

function collapseAllNodes() {
    var allIds = Object.keys(nodeElementsMap);
    for (var i = 0; i < allIds.length; i++) {
        var id = parseInt(allIds[i]);
        var el = nodeElementsMap[id];
        if (el && el.hasChildren && !el.isRoot) {
            collapseNode(id);
        }
    }
    
    var rootId = null;
    var rootIds = Object.keys(nodeElementsMap);
    for (var i = 0; i < rootIds.length; i++) {
        var id = parseInt(rootIds[i]);
        if (nodeElementsMap[id] && nodeElementsMap[id].isRoot) {
            rootId = id;
            break;
        }
    }
    
    if (rootId) {
        var rootEl = nodeElementsMap[rootId];
        rootEl.isExpanded = false;
        expandedNodes[rootId] = false;
        for (var i = 0; i < rootEl.childNodes.length; i++) {
            var childId = rootEl.childNodes[i];
            var childEl = nodeElementsMap[childId];
            if (childEl) {
                childEl.isVisible = false;
                childEl.hidden = true;
            }
        }
    }
    
    updateConnectionsVisibility();
    if (typeof renderElements === 'function') renderElements();
    if (typeof renderConnections === 'function') renderConnections();
}

function updateConnectionsVisibility() {
    var keys = Object.keys(connectionMap);
    for (var i = 0; i < keys.length; i++) {
        var connId = keys[i];
        var conn = connectionMap[connId];
        var fromEl = nodeElementsMap[conn.from];
        var toEl = nodeElementsMap[conn.to];
        
        if (fromEl && toEl) {
            conn.isVisible = fromEl.isVisible && toEl.isVisible;
        } else {
            conn.isVisible = false;
        }
    }
}

function findComponentKey(componentMap, search) {
    if (!search) return null;
    if (componentMap[search]) return search;
    
    var keys = Object.keys(componentMap);
    var searchLower = search.toLowerCase();
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var comp = componentMap[key];
        
        if (comp.name && comp.name.toLowerCase().indexOf(searchLower) !== -1) {
            return key;
        }
        if (comp.name && searchLower.indexOf(comp.name.toLowerCase()) !== -1) {
            return key;
        }
        if (comp.purl && comp.purl.toLowerCase().indexOf(searchLower) !== -1) {
            return key;
        }
        if (comp.purl && searchLower.indexOf(comp.purl.toLowerCase()) !== -1) {
            return key;
        }
        if (comp.bomRef && comp.bomRef === search) {
            return key;
        }
    }
    
    return null;
}


// ============================================================
// МОДАЛКА SBOM
// ============================================================

function openSbomFileModal() {
    var modal = document.getElementById('sbomFileModal');
    if (!modal) {
        showCustomAlert('Ошибка', 'Модалка SBOM не найдена в HTML', 'error');
        return;
    }
    
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    var input = document.getElementById('sbomFileInputModal');
    if (input) input.value = '';
    
    var infoModal = document.getElementById('sbomFileInfoModal');
    if (infoModal) infoModal.style.display = 'none';
    
    var loadBtn = document.getElementById('loadSbomFileBtn');
    if (loadBtn) {
        loadBtn.style.background = '#e5e7eb';
        loadBtn.style.color = '#9ca3af';
        loadBtn.style.cursor = 'not-allowed';
        loadBtn.disabled = true;
    }
    
    selectedSbomFile = null;
}

function closeSbomFileModal() {
    var modal = document.getElementById('sbomFileModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

function loadSbomFileFromModal() {
    if (!selectedSbomFile) {
        showCustomAlert('Ошибка', 'Выберите SBOM файл', 'warning');
        return;
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var data = JSON.parse(e.target.result);
            
            if (typeof buildDependencyGraphFromSBOM === 'function') {
                buildDependencyGraphFromSBOM(data, selectedSbomFile.name);
                closeSbomFileModal();
                showCustomAlert('Успешно', 'SBOM загружен и визуализирован', 'success');
            } else {
                showCustomAlert('Ошибка', 'Функция buildDependencyGraphFromSBOM не найдена', 'error');
            }
        } catch (err) {
            showCustomAlert('Ошибка', 'Не удалось распарсить SBOM: ' + err.message, 'error');
        }
    };
    reader.readAsText(selectedSbomFile);
}

function handleSbomFile(file) {
    selectedSbomFile = file;
    
    var size = (file.size / 1024).toFixed(2);
    
    var fileNameEl = document.getElementById('sbomFileNameModal');
    var fileSizeEl = document.getElementById('sbomFileSizeModal');
    var fileComponentsEl = document.getElementById('sbomFileComponentsModal');
    var infoModal = document.getElementById('sbomFileInfoModal');
    var loadBtn = document.getElementById('loadSbomFileBtn');
    var statusText = document.getElementById('sbomStatusText');
    
    if (statusText) {
        statusText.textContent = file.name;
        statusText.style.color = '#10B981';
    }
    
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = size + ' KB';
    if (fileComponentsEl) fileComponentsEl.textContent = 'подсчет...';
    if (infoModal) infoModal.style.display = 'block';
    
    if (loadBtn) {
        loadBtn.style.background = '#3B82F6';
        loadBtn.style.color = 'white';
        loadBtn.style.cursor = 'pointer';
        loadBtn.disabled = false;
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var data = JSON.parse(e.target.result);
            var components = data.components || data.packages || [];
            var sbomData = data.sbom || data;
            var comps = sbomData.components || components || [];
            if (fileComponentsEl) fileComponentsEl.textContent = comps.length + ' компонентов';
        } catch (err) {
            if (fileComponentsEl) fileComponentsEl.textContent = 'ошибка парсинга';
        }
    };
    reader.readAsText(file);
}

function initSbomModalHandlers() {
    var fileInput = document.getElementById('sbomFileInputModal');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            var file = this.files[0];
            if (file) {
                handleSbomFile(file);
            }
        });
    }
    
    var dropZone = document.getElementById('sbomDropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderColor = '#3B82F6';
            this.style.background = '#eff6ff';
        });
        
        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.style.borderColor = '#d1d5db';
            this.style.background = '#fafafa';
        });
        
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = '#d1d5db';
            this.style.background = '#fafafa';
            
            var files = e.dataTransfer.files;
            if (files && files.length > 0) {
                handleSbomFile(files[0]);
                var input = document.getElementById('sbomFileInputModal');
                if (input) {
                    var dt = new DataTransfer();
                    dt.items.add(files[0]);
                    input.files = dt.files;
                }
            }
        });
    }
}

function loadSBOMFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.sbom';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        var reader = new FileReader();
        reader.onload = function(ev) {
            try {
                var data = JSON.parse(ev.target.result);
                if (typeof buildDependencyGraphFromSBOM === 'function') {
                    buildDependencyGraphFromSBOM(data, file.name);
                    showCustomAlert('Успешно', 'SBOM загружен и визуализирован', 'success');
                } else {
                    showCustomAlert('Ошибка', 'Функция buildDependencyGraphFromSBOM не найдена', 'error');
                }
            } catch (err) {
                showCustomAlert('Ошибка', 'Не удалось распарсить SBOM: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ============================================================
// ЭКСПОРТЫ
// ============================================================

window.openSbomFileModal = openSbomFileModal;
window.closeSbomFileModal = closeSbomFileModal;
window.loadSbomFileFromModal = loadSbomFileFromModal;
window.handleSbomFile = handleSbomFile;
window.buildDependencyGraphFromSBOM = buildDependencyGraphFromSBOM;
window.findComponentKey = findComponentKey;
window.expandNode = expandNode;
window.collapseNode = collapseNode;
window.toggleNode = toggleNode;
window.expandAllNodes = expandAllNodes;
window.collapseAllNodes = collapseAllNodes;
window.updateConnectionsVisibility = updateConnectionsVisibility;
window.loadSBOMFile = loadSBOMFile;
window.selectedSbomFile = null;
window.vulnerabilitiesMap = {};

document.addEventListener('DOMContentLoaded', function() {
    initSbomModalHandlers();
});