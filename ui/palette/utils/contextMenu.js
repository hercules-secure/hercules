// ============================================================
// КОНТЕКСТНОЕ МЕНЮ ДЛЯ ЭЛЕМЕНТОВ НА ХОЛСТЕ (БЕЗ КОНСОЛЬНЫХ ЛОГОВ)
// ============================================================

// Создаем контекстное меню
var contextMenu = document.createElement('div');
contextMenu.id = 'elementContextMenu';
contextMenu.style.cssText = `
    display: none;
    position: fixed;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 4px 0;
    min-width: 220px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    z-index: 100000;
    font-family: 'Ubuntu', sans-serif;
    overflow: hidden;
`;
contextMenu.innerHTML = `
    <!-- Анализ -->
    <div class="context-menu-item" data-action="analyze">
        <i class="fas fa-microscope" style="color: #8B5CF6;"></i> Анализ
    </div>
    
    <!-- Лог - будет скрыт для проектных компонентов -->
    <div class="context-menu-item" data-action="logs">
        <i class="fas fa-list"></i> Лог
    </div>
    
    <!-- Проблемы -->
    <div class="context-menu-item" data-action="vulnerabilities">
        <i class="fas fa-shield-alt" style="color: #EF4444;"></i> Проблемы
        <span id="vulnCountBadge" style="
            margin-left: auto;
            background: #EF4444;
            color: white;
            padding: 1px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: bold;
            display: none;
        ">0</span>
    </div>
    
    <!-- Свойства -->
    <div class="context-menu-item" data-action="properties">
        <i class="fas fa-cog"></i> Свойства
    </div>
    
    <div class="context-menu-divider"></div>
    
    <!-- Удалить -->
    <div class="context-menu-item danger" data-action="delete">
        <i class="fas fa-trash"></i> Удалить
    </div>
`;
document.body.appendChild(contextMenu);

// Добавляем стили для контекстного меню
var contextMenuStyle = document.createElement('style');
contextMenuStyle.textContent = `
    .context-menu-item {
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: #1a1a2e;
        transition: background 0.15s;
        font-family: 'Ubuntu', sans-serif;
    }
    .context-menu-item:hover {
        background: #f3f4f6;
    }
    .context-menu-item i {
        width: 16px;
        font-size: 13px;
        color: #6c757d;
    }
    .context-menu-item.danger {
        color: #EF4444;
    }
    .context-menu-item.danger:hover {
        background: #fef2f2;
    }
    .context-menu-item.danger i {
        color: #EF4444;
    }
    .context-menu-divider {
        height: 1px;
        background: #e5e7eb;
        margin: 4px 0;
    }
    .context-menu-item .fa-microscope {
        color: #8B5CF6 !important;
    }
    .context-menu-item.hidden {
        display: none !important;
    }
`;
document.head.appendChild(contextMenuStyle);

// Переменная для хранения текущего элемента
var contextMenuTarget = null;

// ============================================================
// ОБНОВЛЕНИЕ МЕНЮ В ЗАВИСИМОСТИ ОТ ТИПА ЭЛЕМЕНТА
// ============================================================

function updateContextMenu(element) {
    var vulnItem = contextMenu.querySelector('[data-action="vulnerabilities"]');
    var badge = vulnItem ? vulnItem.querySelector('#vulnCountBadge') : null;
    var logsItem = contextMenu.querySelector('[data-action="logs"]');
    var analyzeItem = contextMenu.querySelector('[data-action="analyze"]');
    
    var hasVuln = false;
    var vulnCount = 0;
    
    // Проверяем уязвимости для SBOM компонентов
    if (element && element.bomRef && window.vulnerabilitiesMap) {
        var vulns = window.vulnerabilitiesMap[element.bomRef];
        if (vulns && vulns.length > 0) {
            hasVuln = true;
            vulnCount = vulns.length;
        }
    }
    
    if (element && element.componentData) {
        if (element.componentData.hasVulnerabilities) {
            hasVuln = true;
            vulnCount = element.componentData.vulnerabilityCount || 0;
        }
    }
    
    // Проверка: является ли элемент проектным (папка/файл)
    var isProjectItem = element && (
        element.type === 'project-root' ||
        element.type === 'project-folder' ||
        element.type === 'project-file' ||
        element.isFolder === true ||
        element.isFile === true ||
        element.isProject === true
    );
    
    // АНАЛИЗ - показываем только для проектных элементов
    if (analyzeItem) {
        analyzeItem.style.display = isProjectItem ? 'flex' : 'none';
    }
    
    // ЛОГ - СКРЫВАЕМ ДЛЯ ВСЕХ ПРОЕКТНЫХ КОМПОНЕНТОВ
    if (logsItem) {
        logsItem.style.display = isProjectItem ? 'none' : 'flex';
    }
    
    // ПРОБЛЕМЫ - показываем только если есть уязвимости
    if (vulnItem) {
        if (hasVuln) {
            vulnItem.style.display = 'flex';
            if (badge) {
                badge.textContent = vulnCount;
                badge.style.display = 'inline-block';
            }
        } else {
            vulnItem.style.display = 'none';
        }
    }
}

// Обработчик правого клика на элементах холста
document.addEventListener('contextmenu', function(e) {
    var elementDiv = e.target.closest('.canvas-element');
    
    if (elementDiv) {
        e.preventDefault();
        e.stopPropagation();
        
        var id = parseInt(elementDiv.dataset.id);
        var el = elements.find(function(item) { return item.id === id; });
        if (!el) return;
        
        contextMenuTarget = el;
        
        updateContextMenu(el);
        
        var menu = document.getElementById('elementContextMenu');
        var x = e.clientX;
        var y = e.clientY;
        
        var menuWidth = 220;
        var menuHeight = 200;
        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10;
        }
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 10;
        }
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
        
        elementDiv.classList.add('context-active');
    } else {
        closeContextMenu();
    }
});

// Закрытие меню
function closeContextMenu() {
    var menu = document.getElementById('elementContextMenu');
    if (menu) menu.style.display = 'none';
    contextMenuTarget = null;
    document.querySelectorAll('.canvas-element.context-active').forEach(function(el) {
        el.classList.remove('context-active');
    });
}

// Клик вне меню закрывает его
document.addEventListener('click', function(e) {
    var menu = document.getElementById('elementContextMenu');
    if (menu && !menu.contains(e.target)) {
        closeContextMenu();
    }
});

// ============================================================
// ДЕЙСТВИЯ КОНТЕКСТНОГО МЕНЮ
// ============================================================

// АНАЛИЗ - для проектных компонентов
document.querySelector('#elementContextMenu .context-menu-item[data-action="analyze"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget) {
        if (typeof analyzeProject === 'function') {
            if (contextMenuTarget.isFile && contextMenuTarget.fileData) {
                analyzeSingleFile(contextMenuTarget.fileData);
            } else {
                analyzeProject();
            }
        } else if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Функция анализа не найдена', 'error');
        }
    }
    closeContextMenu();
});

// ЛОГ (для непроектных элементов)
document.querySelector('#elementContextMenu .context-menu-item[data-action="logs"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget && typeof fetchElementLogs === 'function') {
        fetchElementLogs(contextMenuTarget);
    }
    closeContextMenu();
});

// ПРОБЛЕМЫ
document.querySelector('#elementContextMenu .context-menu-item[data-action="vulnerabilities"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget) {
        var bomRef = contextMenuTarget.bomRef || 
                     (contextMenuTarget.componentData ? contextMenuTarget.componentData.bomRef : null);
        
        if (bomRef && window.vulnerabilitiesMap && window.vulnerabilitiesMap[bomRef]) {
            if (typeof showVulnerabilitiesForComponent === 'function') {
                showVulnerabilitiesForComponent(bomRef);
            }
        } else if (contextMenuTarget.componentData && contextMenuTarget.componentData.hasVulnerabilities) {
            var ref = contextMenuTarget.componentData.bomRef;
            if (ref && window.vulnerabilitiesMap && window.vulnerabilitiesMap[ref]) {
                if (typeof showVulnerabilitiesForComponent === 'function') {
                    showVulnerabilitiesForComponent(ref);
                }
            } else if (typeof showCustomAlert === 'function') {
                showCustomAlert('Информация', 'Уязвимостей для этого компонента не найдено', 'info');
            }
        } else if (typeof showCustomAlert === 'function') {
            showCustomAlert('Информация', 'Уязвимостей для этого компонента не найдено', 'info');
        }
    }
    closeContextMenu();
});

// СВОЙСТВА
document.querySelector('#elementContextMenu .context-menu-item[data-action="properties"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget) {
        if (contextMenuTarget.type === 'ci-stage' || contextMenuTarget.type === 'ci-job' || contextMenuTarget.type === 'ci-root') {
            if (typeof showCIProperties === 'function') {
                showCIProperties(contextMenuTarget);
            }
        } else if (contextMenuTarget.type === 'sbom-root' || contextMenuTarget.type === 'sbom-component' || contextMenuTarget.type === 'package-dependency') {
            if (typeof showSBOMProperties === 'function') {
                showSBOMProperties(contextMenuTarget);
            }
        } else if (contextMenuTarget.isFile && contextMenuTarget.fileData) {
            showFileProperties(contextMenuTarget);
        } else if (contextMenuTarget.isFolder) {
            showFolderProperties(contextMenuTarget);
        } else if (typeof openElementPropsModal === 'function') {
            openElementPropsModal(contextMenuTarget.id);
        }
    }
    closeContextMenu();
});

// УДАЛИТЬ
document.querySelector('#elementContextMenu .context-menu-item[data-action="delete"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget && typeof deleteElement === 'function') {
        deleteElement(contextMenuTarget.id, null);
    }
    closeContextMenu();
});

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПРОЕКТНЫХ ЭЛЕМЕНТОВ
// ============================================================

// Анализ отдельного файла
function analyzeSingleFile(fileData) {
    if (!fileData) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Ошибка', 'Файл не выбран', 'error');
        }
        return;
    }
    
    if (typeof showCustomAlert === 'function') {
        showCustomAlert('Анализ', 'Анализ файла: ' + fileData.name, 'info');
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var content = e.target.result;
            var ext = fileData.ext;
            
            if (typeof parseCodeForCallGraph === 'function') {
                var parseResult = parseCodeForCallGraph(content, ext);
                
                if (typeof showCustomAlert === 'function') {
                    var msg = '🔧 ' + parseResult.functions.length + ' функций\n' +
                             '🔗 ' + (parseResult.calls || []).length + ' вызовов\n' +
                             '📦 ' + (parseResult.imports || []).length + ' импортов';
                    showCustomAlert('Анализ завершен', msg, 'success');
                }
                
                if (typeof buildCallGraph === 'function') {
                    buildCallGraph(parseResult, fileData.name);
                }
            }
        } catch (err) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Ошибка', 'Ошибка анализа файла: ' + err.message, 'error');
            }
        }
    };
    reader.readAsText(fileData.file);
}

// Свойства файла
function showFileProperties(element) {
    var fileData = element.fileData;
    if (!fileData) return;
    
    var modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 20000;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: Ubuntu, sans-serif;
    `;
    
    var properties = [
        { label: 'Имя файла', value: fileData.name },
        { label: 'Путь', value: fileData.path },
        { label: 'Расширение', value: fileData.ext },
        { label: 'Размер', value: (fileData.size / 1024).toFixed(2) + ' KB' }
    ];
    
    var propertiesHtml = properties.map(function(p) {
        return `
            <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
                <div style="width: 120px; font-weight: 500; color: #6b7280; flex-shrink: 0;">${p.label}</div>
                <div style="color: #1f2937; word-break: break-all;">${escapeHtml(String(p.value))}</div>
            </div>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <div style="padding: 20px 24px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 18px; color: #1f2937;">Свойства файла</h3>
                <button onclick="this.closest('div[style]').parentElement.remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af; padding: 0 8px;">&times;</button>
            </div>
            <div style="padding: 20px 24px;">
                ${propertiesHtml}
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: right;">
                <button onclick="this.closest('div[style]').parentElement.remove()" style="padding: 8px 20px; background: #3B82F6; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: Ubuntu, sans-serif; font-size: 14px;">Закрыть</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Свойства папки
function showFolderProperties(element) {
    var folderData = element.folderData;
    if (!folderData) return;
    
    var fileCount = countFiles(folderData);
    
    var modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 20000;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: Ubuntu, sans-serif;
    `;
    
    var properties = [
        { label: 'Имя папки', value: folderData.name || element.name || 'Unknown' },
        { label: 'Количество файлов', value: fileCount }
    ];
    
    var propertiesHtml = properties.map(function(p) {
        return `
            <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
                <div style="width: 140px; font-weight: 500; color: #6b7280; flex-shrink: 0;">${p.label}</div>
                <div style="color: #1f2937;">${escapeHtml(String(p.value))}</div>
            </div>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <div style="padding: 20px 24px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 18px; color: #1f2937;">Свойства папки</h3>
                <button onclick="this.closest('div[style]').parentElement.remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af; padding: 0 8px;">&times;</button>
            </div>
            <div style="padding: 20px 24px;">
                ${propertiesHtml}
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: right;">
                <button onclick="this.closest('div[style]').parentElement.remove()" style="padding: 8px 20px; background: #3B82F6; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: Ubuntu, sans-serif; font-size: 14px;">Закрыть</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function countFiles(node) {
    if (!node) return 0;
    var count = node.files ? node.files.length : 0;
    if (node.children) {
        var folderNames = Object.keys(node.children);
        folderNames.forEach(function(name) {
            count += countFiles(node.children[name]);
        });
    }
    return count;
}

// Удаление через клавишу
document.addEventListener('keydown', function(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && typeof selectedElement !== 'undefined' && selectedElement) {
        e.preventDefault();
        if (typeof deleteElement === 'function') {
            deleteElement(selectedElement.id, null);
        }
    }
});

// Стиль для подсветки элемента
var highlightStyle = document.createElement('style');
highlightStyle.textContent = `
    .canvas-element.context-active {
        border-color: #3B82F6 !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0,0,0,0.1) !important;
        z-index: 100 !important;
    }
`;
document.head.appendChild(highlightStyle);