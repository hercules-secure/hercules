// ============================================================
// ОБЩАЯ ФУНКЦИЯ ОЧИСТКИ ХОЛСТА
// ============================================================

function clearCanvas() {
    // Удаляем все элементы графов
    var existingElements = [];
    for (var ei = 0; ei < elements.length; ei++) {
        var el = elements[ei];
        if (el.type !== 'sbom-root' && 
            el.type !== 'sbom-component' && 
            el.type !== 'package-dependency' &&
            el.type !== 'ci-root' &&
            el.type !== 'ci-stage' &&
            el.type !== 'ci-job') {
            existingElements.push(el);
        }
    }
    elements = existingElements;
    connections = [];
    selectedElement = null;
    allConnections = [];
    
    // Сбрасываем состояния
    expandedNodes = {};
    hiddenNodes = {};
    nodeElementsMap = {};
    connectionMap = {};
    ciNodeMap = {};
    
    // Очищаем DOM
    var elementsContainer = document.getElementById('canvasElements');
    if (elementsContainer) {
        elementsContainer.innerHTML = '';
    }
    var connectionsContainer = document.getElementById('canvasConnections');
    if (connectionsContainer) {
        connectionsContainer.innerHTML = '';
    }
}

function addGraphControls() {
    var container = document.getElementById('paletteCanvas') || document.getElementById('canvasContainer');
    if (!container) return;
    
    // Удаляем старые контролы
    var oldControls = container.querySelector('.graph-controls');
    if (oldControls) oldControls.remove();
    var oldCIControls = container.querySelector('.ci-controls');
    if (oldCIControls) oldCIControls.remove();
    
    // Создаем объединенную панель
    var controls = document.createElement('div');
    controls.className = 'graph-controls';
    controls.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
        display: flex;
        gap: 6px;
        flex-direction: column;
        background: rgba(255,255,255,0.95);
        padding: 8px 10px;
        border-radius: 10px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        font-family: Ubuntu, sans-serif;
        min-width: 130px;
    `;
    
    controls.innerHTML = `
        <button id="expandGraphBtn" style="
            padding: 6px 14px;
            background: #3B82F6;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-family: Ubuntu, sans-serif;
            font-size: 12px;
            font-weight: 500;
            transition: background 0.2s;
            white-space: nowrap;
            width: 100%;
        " onmouseenter="this.style.background='#2563EB'" onmouseleave="this.style.background='#3B82F6'">
            Раскрыть все
        </button>
        <button id="collapseGraphBtn" style="
            padding: 6px 14px;
            background: #6B7280;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-family: Ubuntu, sans-serif;
            font-size: 12px;
            font-weight: 500;
            transition: background 0.2s;
            white-space: nowrap;
            width: 100%;
        " onmouseenter="this.style.background='#4B5563'" onmouseleave="this.style.background='#6B7280'">
            Свернуть все
        </button>
    `;
    
    container.appendChild(controls);
    
    // Навешиваем обработчики
    var expandBtn = document.getElementById('expandGraphBtn');
    var collapseBtn = document.getElementById('collapseGraphBtn');
    
    if (expandBtn) {
        expandBtn.onclick = function() {
            // Проверяем, какой граф активен
            var hasCI = elements.some(function(e) { 
                return e.type === 'ci-root' || e.type === 'ci-stage' || e.type === 'ci-job'; 
            });
            var hasSBOM = elements.some(function(e) { 
                return e.type === 'sbom-root' || e.type === 'sbom-component'; 
            });
            
            if (hasCI && typeof expandAllCI === 'function') {
                expandAllCI();
            } else if (hasSBOM && typeof expandAllNodes === 'function') {
                expandAllNodes();
            }
        };
    }
    
    if (collapseBtn) {
        collapseBtn.onclick = function() {
            var hasCI = elements.some(function(e) { 
                return e.type === 'ci-root' || e.type === 'ci-stage' || e.type === 'ci-job'; 
            });
            var hasSBOM = elements.some(function(e) { 
                return e.type === 'sbom-root' || e.type === 'sbom-component'; 
            });
            
            if (hasCI && typeof collapseAllCI === 'function') {
                collapseAllCI();
            } else if (hasSBOM && typeof collapseAllNodes === 'function') {
                collapseAllNodes();
            }
        };
    }
}

// Экспортируем
window.addGraphControls = addGraphControls;
window.clearCanvas = clearCanvas;