// ============================================================
// МЕТОД ДЛЯ АНАЛИЗА С ВЫБОРОМ ИНСТРУМЕНТА
// ============================================================

var selectedAnalysisTool = null;
var analysisTargetElement = null;
var analysisResults = null;

// ============================================================
// 0. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getElementType(element) {
    if (!element) return 'unknown';
    
    if (element.isFile) return 'file';
    if (element.isFolder) return 'folder';
    if (element.type === 'project-root') return 'project';
    if (element.type === 'project-folder') return 'folder';
    if (element.type === 'project-file') return 'file';
    if (element.type === 'function') return 'function';
    if (element.type === 'class') return 'class';
    if (element.type === 'method') return 'method';
    if (element.type === 'uml-class') return 'class';
    if (element.type === 'uml-field') return 'field';
    if (element.type === 'uml-method') return 'method';
    if (element.type === 'sbom-root') return 'sbom';
    if (element.type === 'sbom-component') return 'component';
    if (element.type === 'ci-root') return 'ci';
    if (element.type === 'ci-stage') return 'stage';
    if (element.type === 'ci-job') return 'job';
    if (element.isCode) return 'code';
    
    return element.type || 'unknown';
}

function getToolLabel(tool) {
    var labels = {
        'blender': 'Блендер',
        'sca': 'Матрешка',
        'sast': 'SAST'
    };
    return labels[tool] || tool;
}

// ============================================================
// 1. ОТКРЫТИЕ МОДАЛЬНОГО ОКНА ВЫБОРА ИНСТРУМЕНТА
// ============================================================

function openToolSelectionModal() {
    analysisTargetElement = contextMenuTarget;
    
    var overlay = document.createElement('div');
    overlay.id = 'toolSelectionModal';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(4px);
        z-index: 100001;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: alertFadeIn 0.3s ease;
        font-family: 'Ubuntu', sans-serif;
    `;
    
    var targetName = analysisTargetElement ? (analysisTargetElement.name || 'Unknown') : '—';
    var targetType = analysisTargetElement ? getElementType(analysisTargetElement) : '—';
    
    overlay.innerHTML = `
        <div style="
            background: white;
            border-radius: 16px;
            max-width: 560px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: alertScaleIn 0.3s ease;
            overflow: hidden;
        ">
            <div style="
                padding: 24px 28px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #f8f9fa;
            ">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="fas fa-list" style="font-size: 22px;"></i>
                    <h3 style="margin: 0; font-size: 18px; color: #1a1a2e; font-weight: 600;">Выберите инструмент для анализа</h3>
                </div>
                <button onclick="closeToolSelectionModal()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #9ca3af;
                    padding: 0 8px;
                ">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div style="padding: 24px 28px;">
                <div style="
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 12px 16px;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <span style="font-size: 13px; color: #4b5563;">
                        <i class="fas fa-tag" style="color: #8B5CF6;"></i>
                        Цель:
                    </span>
                    <span style="font-weight: 600; color: #1a1a2e; font-size: 14px;">
                        ${targetName} <span style="font-weight: 400; color: #6c757d; font-size: 12px;">(${targetType})</span>
                    </span>
                </div>
               
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div class="tool-option" data-tool="blender" onclick="selectTool('blender')" style="
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        padding: 16px 20px;
                        border: 2px solid #e5e7eb;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        background: white;
                    ">
                        <div style="
                            width: 48px;
                            height: 48px;
                            border-radius: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 24px;
                            flex-shrink: 0;
                        ">
                            <i class="fas fa-flask"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1a1a2e; font-size: 15px;">Блендер</div>
                            <div style="font-size: 12px; color: #6c757d;">Анализ зависимостей и исходного кода</div>
                        </div>
                        <div class="tool-check" style="
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            border: 2px solid #e5e7eb;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                            transition: all 0.2s;
                        ">
                            <i class="fas fa-check" style="color: white; font-size: 12px; opacity: 0;"></i>
                        </div>
                    </div>
                    
                    <div class="tool-option" data-tool="sca" onclick="selectTool('sca')" style="
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        padding: 16px 20px;
                        border: 2px solid #e5e7eb;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        background: white;
                    ">
                        <div style="
                            width: 48px;
                            height: 48px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 24px;
                            flex-shrink: 0;
                        ">
                            <i class="fas fa-sitemap"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1a1a2e; font-size: 15px;">Матрешка</div>
                            <div style="font-size: 12px; color: #6c757d;">Композиционный анализ</div>
                        </div>
                        <div class="tool-check" style="
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            border: 2px solid #e5e7eb;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                            transition: all 0.2s;
                        ">
                            <i class="fas fa-check" style="color: white; font-size: 12px; opacity: 0;"></i>
                        </div>
                    </div>
                    
                    <div class="tool-option" data-tool="sast" onclick="selectTool('sast')" style="
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        padding: 16px 20px;
                        border: 2px solid #e5e7eb;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        background: white;
                    ">
                        <div style="
                            width: 48px;
                            height: 48px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 24px;
                            flex-shrink: 0;
                        ">
                            <i class="fas fa-code"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1a1a2e; font-size: 15px;">SAST</div>
                            <div style="font-size: 12px; color: #6c757d;">Анализ исходного кода</div>
                        </div>
                        <div class="tool-check" style="
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            border: 2px solid #e5e7eb;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                            transition: all 0.2s;
                        ">
                            <i class="fas fa-check" style="color: white; font-size: 12px; opacity: 0;"></i>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="
                padding: 16px 28px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                background: #fafafa;
            ">
                <button onclick="closeToolSelectionModal()" style="
                    padding: 10px 24px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    background: white;
                    color: #6c757d;
                    cursor: pointer;
                    font-family: 'Ubuntu', sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                ">
                    <i class="fas fa-times"></i> Отмена
                </button>
                
                <button id="runAnalysisBtn" onclick="runAnalysisWithSelectedTool()" style="
                    padding: 10px 28px;
                    border: none;
                    border-radius: 8px;
                    background: #8B5CF6;
                    color: white;
                    cursor: not-allowed;
                    font-family: 'Ubuntu', sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                    opacity: 0.5;
                " disabled>
                    <i class="fas fa-play"></i> Продолжить
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    var style = document.createElement('style');
    style.textContent = `
        @keyframes alertFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes alertScaleIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .tool-option.selected {
            border-color: #8B5CF6 !important;
            background: #f5f3ff !important;
        }
        .tool-option.selected .tool-check {
            background: #8B5CF6 !important;
            border-color: #8B5CF6 !important;
        }
        .tool-option.selected .tool-check i {
            opacity: 1 !important;
        }
        .tool-option:hover {
            border-color: #8B5CF6 !important;
            transform: translateX(4px);
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
        }
    `;
    document.head.appendChild(style);
}

// ============================================================
// 2. ВЫБОР ИНСТРУМЕНТА
// ============================================================

function selectTool(tool) {
    selectedAnalysisTool = tool;
    
    document.querySelectorAll('.tool-option').forEach(function(el) {
        el.classList.remove('selected');
    });
    
    var selected = document.querySelector('.tool-option[data-tool="' + tool + '"]');
    if (selected) {
        selected.classList.add('selected');
    }
    
    var runBtn = document.getElementById('runAnalysisBtn');
    if (runBtn) {
        runBtn.disabled = false;
        runBtn.style.opacity = '1';
        runBtn.style.cursor = 'pointer';
        runBtn.style.background = '#8B5CF6';
        runBtn.innerHTML = '<i class="fas fa-play"></i> Продолжить';
    }
}

// ============================================================
// 3. ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА ВЫБОРА ИНСТРУМЕНТА
// ============================================================

function closeToolSelectionModal() {
    var modal = document.getElementById('toolSelectionModal');
    if (modal) {
        modal.remove();
    }
}

// ============================================================
// 4. ЗАПУСК АНАЛИЗА - ОТПРАВКА НА СЕРВЕР
// ============================================================

function runAnalysisWithSelectedTool() {
    if (!selectedAnalysisTool) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Выберите инструмент анализа', 'warning');
        }
        return;
    }
    
    if (!analysisTargetElement) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Не выбран элемент для анализа', 'warning');
        }
        return;
    }
    
    closeToolSelectionModal();
    
    // Проверяем, есть ли paletteClient
    if (typeof paletteClient === 'undefined' || !paletteClient) {
        if (typeof initPaletteClient === 'function') {
            initPaletteClient();
        } else {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Ошибка', 'Palette client not initialized', 'error');
            }
            return;
        }
    }
    
    // Используем runAnalysisWithTool из palette-client.js
    if (typeof runAnalysisWithTool === 'function') {
        runAnalysisWithTool(selectedAnalysisTool, analysisTargetElement);
    } else {
        // fallback - отправляем через fetch
        sendAnalysisViaFetch(selectedAnalysisTool, analysisTargetElement);
    }
}

// ============================================================
// 5. FALLBACK - ОТПРАВКА ЧЕРЕЗ FETCH
// ============================================================

function sendAnalysisViaFetch(tool, targetElement) {
    var targetData = getTargetData(targetElement);
    
    var formData = new FormData();
    formData.append('tool', tool);
    formData.append('target', JSON.stringify({
        id: targetElement.id,
        name: targetElement.name || 'Unknown',
        type: getElementType(targetElement),
        data: targetData
    }));
    
    // Если есть файл - добавляем его
    if (targetElement.fileData && targetElement.fileData.file) {
        formData.append('files[]', targetElement.fileData.file);
    }
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Анализ запущен', 
            'Инструмент: ' + getToolLabel(tool) + '\n' +
            'Цель: ' + (targetElement.name || 'Unknown'), 
            'info'
        );
    }
    
    var token = localStorage.getItem('licenseToken');
    var headers = {};
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    
    // ============================================================
    // ПРАВИЛЬНЫЙ URL
    // ============================================================
    fetch('/api/palette/analyze', {
        method: 'POST',
        headers: headers,
        body: formData
    })
    .then(function(response) {
        if (!response.ok) {
            throw new Error('Server error: ' + response.status);
        }
        return response.json();
    })
    .then(function(data) {
        analysisResults = data;
        if (typeof showAnalysisResultsModal === 'function') {
            showAnalysisResultsModal(data);
        }
    })
    .catch(function(error) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка анализа', 'Error: ' + error.message, 'error');
        }
    });
}

// ============================================================
// 6. ПОЛУЧЕНИЕ ДАННЫХ ЦЕЛЕВОГО ЭЛЕМЕНТА
// ============================================================

function getTargetData(element) {
    if (!element) return null;
    
    var data = {
        id: element.id,
        name: element.name,
        type: element.type,
        isFile: element.isFile || false,
        isFolder: element.isFolder || false,
        isCode: element.isCode || false
    };
    
    if (element.fileData) {
        data.file = {
            name: element.fileData.name,
            path: element.fileData.path,
            ext: element.fileData.ext,
            size: element.fileData.size
        };
        if (element.fileData.file) {
            data.file.file = element.fileData.file;
        }
    }
    
    if (element.folderData) {
        data.folder = {
            name: element.folderData.name,
            filesCount: element.folderData.files ? element.folderData.files.length : 0
        };
        data.tree = element.folderData;
    }
    
    if (element.functionData) {
        data.function = {
            name: element.functionData.name,
            params: element.functionData.params || [],
            type: element.functionData.type || 'function'
        };
    }
    
    if (element.codeContent) {
        data.code = {
            lines: element.codeContent.split('\n').length,
            ext: element.codeExt || 'txt'
        };
    }
    
    return data;
}

// ============================================================
// 7. ПОКАЗ РЕЗУЛЬТАТОВ АНАЛИЗА
// ============================================================

function showAnalysisResultsModal(results) {
    if (!results) return;
    
    var overlay = document.createElement('div');
    overlay.id = 'analysisResultsModal';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(4px);
        z-index: 100002;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: alertFadeIn 0.3s ease;
        font-family: 'Ubuntu', sans-serif;
    `;
    
    var findingsHtml = '';
    var summaryHtml = '';
    
    if (results.findings && results.findings.length > 0) {
        findingsHtml = results.findings.map(function(f, i) {
            return '<div class="analysis-result-item">' +
                '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                '<span style="font-weight: 600; color: #1a1a2e;">' + (i + 1) + '. ' + (f.title || f.name || 'Item') + '</span>' +
                (f.severity ? '<span style="background: #EF4444; color: white; padding: 1px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">' + f.severity.toUpperCase() + '</span>' : '') +
                '</div>' +
                (f.description ? '<div style="font-size: 13px; color: #4b5563; margin-top: 4px;">' + f.description + '</div>' : '') +
                '</div>';
        }).join('');
    } else {
        findingsHtml = '<div style="text-align: center; color: #6c757d; padding: 20px;">Проблем не найдено</div>';
    }
    
    if (results.summary) {
        summaryHtml = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">' +
            Object.keys(results.summary).map(function(key) {
                var label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                return '<div style="text-align: center; padding: 8px; background: #f8f9fa; border-radius: 8px;">' +
                    '<div style="font-weight: 700; color: #1a1a2e; font-size: 18px;">' + results.summary[key] + '</div>' +
                    '<div style="font-size: 11px; color: #6c757d;">' + label + '</div>' +
                    '</div>';
            }).join('') +
            '</div>';
    }
    
    overlay.innerHTML = `
        <div style="
            background: white;
            border-radius: 16px;
            max-width: 700px;
            width: 90%;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: alertScaleIn 0.3s ease;
            overflow: hidden;
        ">
            <div style="
                padding: 20px 28px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #f8f9fa;
                flex-shrink: 0;
            ">
                <div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="fas fa-chart-bar" style="color: #8B5CF6; font-size: 20px;"></i>
                        <h3 style="margin: 0; font-size: 18px; color: #1a1a2e; font-weight: 600;">
                            Результаты анализа: ${results.toolLabel || 'Analysis'}
                        </h3>
                    </div>
                    <div style="font-size: 13px; color: #6c757d; margin-top: 4px;">
                        <i class="fas fa-tag"></i> ${results.targetName || 'Unknown'}
                        <span style="margin-left: 12px;"><i class="fas fa-cube"></i> ${results.targetType || 'Unknown'}</span>
                        <span style="margin-left: 12px;"><i class="fas fa-clock"></i> ${new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
                <button onclick="closeAnalysisResultsModal()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #9ca3af;
                    padding: 0 8px;
                ">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div style="padding: 16px 28px; background: #fafafa; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;">
                ${summaryHtml}
            </div>
            
            <div style="padding: 20px 28px; overflow-y: auto; flex: 1;">
                <div style="font-size: 14px; font-weight: 600; color: #1a1a2e; margin-bottom: 12px;">
                    <i class="fas fa-list"></i> Детальный отчет
                </div>
                ${findingsHtml}
            </div>
            
            <div style="
                padding: 16px 28px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                background: #fafafa;
                flex-shrink: 0;
            ">
                <button onclick="exportAnalysisResults()" style="
                    padding: 10px 24px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    background: white;
                    color: #4b5563;
                    cursor: pointer;
                    font-family: 'Ubuntu', sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                ">
                    <i class="fas fa-download"></i> Экспорт
                </button>
                <button onclick="closeAnalysisResultsModal()" style="
                    padding: 10px 24px;
                    border: none;
                    border-radius: 8px;
                    background: #8B5CF6;
                    color: white;
                    cursor: pointer;
                    font-family: 'Ubuntu', sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                ">
                    <i class="fas fa-check"></i> Закрыть
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

// ============================================================
// 8. ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА РЕЗУЛЬТАТОВ
// ============================================================

function closeAnalysisResultsModal() {
    var modal = document.getElementById('analysisResultsModal');
    if (modal) {
        modal.remove();
    }
}

// ============================================================
// 9. ЭКСПОРТ РЕЗУЛЬТАТОВ
// ============================================================

function exportAnalysisResults() {
    if (!analysisResults) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Нет данных для экспорта', 'warning');
        }
        return;
    }
    
    var dataStr = JSON.stringify(analysisResults, null, 2);
    var blob = new Blob([dataStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'analysis-results-' + (analysisResults.tool || 'analysis') + '-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Успешно', 'Результаты экспортированы в JSON', 'success');
    }
}

// ============================================================
// 10. РЕГИСТРАЦИЯ ФУНКЦИЙ
// ============================================================

window.openToolSelectionModal = openToolSelectionModal;
window.closeToolSelectionModal = closeToolSelectionModal;
window.selectTool = selectTool;
window.runAnalysisWithSelectedTool = runAnalysisWithSelectedTool;
window.showAnalysisResultsModal = showAnalysisResultsModal;
window.closeAnalysisResultsModal = closeAnalysisResultsModal;
window.exportAnalysisResults = exportAnalysisResults;
window.getToolLabel = getToolLabel;
window.getElementType = getElementType;
window.getTargetData = getTargetData;

// ============================================================
// 11. ОБРАБОТЧИК АНАЛИЗА В КОНТЕКСТНОМ МЕНЮ
// ============================================================

document.querySelectorAll('#elementContextMenu .context-menu-item[data-action="analyze"]').forEach(function(el) {
    el.removeEventListener('click', openToolSelectionModal);
});

var analyzeHandler = document.querySelector('#elementContextMenu .context-menu-item[data-action="analyze"]');
if (analyzeHandler) {
    var newHandler = analyzeHandler.cloneNode(true);
    analyzeHandler.parentNode.replaceChild(newHandler, analyzeHandler);
    
    newHandler.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        if (contextMenuTarget) {
            openToolSelectionModal();
        }
        closeContextMenu();
    });
}