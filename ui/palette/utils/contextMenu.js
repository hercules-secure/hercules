// ============================================================
// КОНТЕКСТНОЕ МЕНЮ ДЛЯ ЭЛЕМЕНТОВ НА ХОЛСТЕ
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
    min-width: 200px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    z-index: 100000;
    font-family: 'Ubuntu', sans-serif;
    overflow: hidden;
`;
contextMenu.innerHTML = `
    <div class="context-menu-item" data-action="logs">
        <i class="fas fa-list"></i> Лог
    </div>
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
    <div class="context-menu-item" data-action="properties">
        <i class="fas fa-cog"></i> Свойства
    </div>
    <div class="context-menu-divider"></div>
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
    var propsItem = contextMenu.querySelector('[data-action="properties"]');
    
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
    
    // Обновляем пункт "Проблемы"
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
    
    // Скрываем пункт "Лог" для SBOM и CI/CD элементов
    if (logsItem) {
        var isSbom = element && (element.type === 'sbom-root' || element.type === 'sbom-component' || element.type === 'package-dependency');
        var isCI = element && (element.type === 'ci-root' || element.type === 'ci-stage' || element.type === 'ci-job');
        
        if (isSbom || isCI) {
            logsItem.style.display = 'none';
        } else {
            logsItem.style.display = 'flex';
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
        var menuHeight = 180;
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
    menu.style.display = 'none';
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

// Лог (бывший Просмотр)
document.querySelector('#elementContextMenu .context-menu-item[data-action="logs"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget) {
        fetchElementLogs(contextMenuTarget);
    }
    closeContextMenu();
});

// Проблемы (уязвимости)
document.querySelector('#elementContextMenu .context-menu-item[data-action="vulnerabilities"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget) {
        var bomRef = contextMenuTarget.bomRef || 
                     (contextMenuTarget.componentData ? contextMenuTarget.componentData.bomRef : null);
        
        if (bomRef && window.vulnerabilitiesMap && window.vulnerabilitiesMap[bomRef]) {
            showVulnerabilitiesForComponent(bomRef);
        } else if (contextMenuTarget.componentData && contextMenuTarget.componentData.hasVulnerabilities) {
            var ref = contextMenuTarget.componentData.bomRef;
            if (ref && window.vulnerabilitiesMap && window.vulnerabilitiesMap[ref]) {
                showVulnerabilitiesForComponent(ref);
            } else {
                showCustomAlert('Информация', 'Уязвимостей для этого компонента не найдено', 'info');
            }
        } else {
            showCustomAlert('Информация', 'Уязвимостей для этого компонента не найдено', 'info');
        }
    }
    closeContextMenu();
});

// Свойства
document.querySelector('#elementContextMenu .context-menu-item[data-action="properties"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget) {
        // Проверяем тип элемента и показываем соответствующие свойства
        if (contextMenuTarget.type === 'ci-stage' || contextMenuTarget.type === 'ci-job' || contextMenuTarget.type === 'ci-root') {
            showCIProperties(contextMenuTarget);
        } else if (contextMenuTarget.type === 'sbom-root' || contextMenuTarget.type === 'sbom-component' || contextMenuTarget.type === 'package-dependency') {
            showSBOMProperties(contextMenuTarget);
        } else {
            // Для обычных элементов используем стандартную модалку
            openElementPropsModal(contextMenuTarget.id);
        }
    }
    closeContextMenu();
});

// Удалить
document.querySelector('#elementContextMenu .context-menu-item[data-action="delete"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget) {
        deleteElement(contextMenuTarget.id, null);
    }
    closeContextMenu();
});

// ============================================================
// ПОКАЗ СВОЙСТВ CI/CD ЭЛЕМЕНТА
// ============================================================

// ============================================================
// ПОКАЗ СВОЙСТВ CI/CD ЭЛЕМЕНТА (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ============================================================

function showCIProperties(element) {
    var overlay = document.createElement('div');
    overlay.className = 'ci-props-overlay';
    overlay.style.cssText = `
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
        animation: alertFadeIn 0.3s ease;
    `;
    
    var properties = [];
    
    if (element.type === 'ci-root') {
        properties.push({ label: 'Тип', value: 'Корень пайплайна' });
        properties.push({ label: 'Имя', value: element.name || 'CI/CD Pipeline' });
        properties.push({ label: 'Платформа', value: element.platform || 'GitLab CI' });
    } else if (element.type === 'ci-stage') {
        properties.push({ label: 'Тип', value: 'Стадия' });
        properties.push({ label: 'Имя', value: element.stageName || element.name || 'Unknown' });
        properties.push({ label: 'Количество задач', value: element.jobCount || '0' });
        properties.push({ label: 'Параллельные', value: element.hasParallel ? 'Да' : 'Нет' });
    } else if (element.type === 'ci-job') {
        properties.push({ label: 'Тип', value: element.isParallel ? 'Параллельная задача' : 'Задача' });
        properties.push({ label: 'Имя', value: element.jobName || element.name || 'Unknown' });
        properties.push({ label: 'Стадия', value: element.stageName || 'Unknown' });
        
        if (element.runsOn) {
            properties.push({ label: 'Runner', value: element.runsOn });
        }
        
        if (element.script && Array.isArray(element.script) && element.script.length > 0) {
            properties.push({ label: 'Шаги (script)', value: element.script.join('\n') });
        }
        
        if (element.needs) {
            var needsValue = '';
            if (Array.isArray(element.needs)) {
                needsValue = element.needs.join(', ');
            } else if (typeof element.needs === 'string') {
                needsValue = element.needs;
            } else if (typeof element.needs === 'object') {
                try {
                    needsValue = JSON.stringify(element.needs);
                } catch (e) {
                    needsValue = String(element.needs);
                }
            }
            if (needsValue) {
                properties.push({ label: 'Зависимости', value: needsValue });
            }
        }
        
        if (element.isParallel) {
            properties.push({ label: 'Параллельный', value: 'Да' });
        }
        if (element.when) {
            properties.push({ label: 'When', value: element.when });
        }
        if (element.allowFailure !== undefined) {
            properties.push({ label: 'Allow failure', value: element.allowFailure ? 'Да' : 'Нет' });
        }
        if (element.strategy) {
            properties.push({ label: 'Strategy', value: typeof element.strategy === 'object' ? JSON.stringify(element.strategy) : String(element.strategy) });
        }
    }
    
    var propertiesHtml = properties.map(function(p) {
        return `
            <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
                <div style="width: 120px; font-weight: 500; color: #6b7280; flex-shrink: 0;">${p.label}</div>
                <div style="color: #1f2937; white-space: pre-wrap; word-break: break-all;">${escapeHtml(String(p.value))}</div>
            </div>
        `;
    }).join('');
    
    // ФУНКЦИЯ ЗАКРЫТИЯ
    function closeModal() {
        if (overlay && overlay.parentNode) {
            overlay.remove();
        }
        document.removeEventListener('keydown', escHandler);
    }
    
    // ОБРАБОТЧИК ESCAPE
    function escHandler(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    }
    
    overlay.innerHTML = `
        <div style="
            background: white;
            border-radius: 16px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: alertScaleIn 0.3s ease;
        ">
            <div style="
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            ">
                <h3 style="margin: 0; font-size: 18px; color: #1f2937;">Свойства CI/CD элемента</h3>
                <button id="closeCiPropsBtn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #9ca3af;
                    padding: 0 8px;
                ">&times;</button>
            </div>
            <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
                ${propertiesHtml}
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: right; flex-shrink: 0;">
                <button id="closeCiPropsBtn2" style="
                    padding: 8px 20px;
                    background: #3B82F6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: Ubuntu, sans-serif;
                    font-size: 14px;
                ">Закрыть</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Навешиваем обработчики после добавления в DOM
    var closeBtn1 = document.getElementById('closeCiPropsBtn');
    var closeBtn2 = document.getElementById('closeCiPropsBtn2');
    
    if (closeBtn1) {
        closeBtn1.addEventListener('click', closeModal);
    }
    if (closeBtn2) {
        closeBtn2.addEventListener('click', closeModal);
    }
    
    // Закрытие по клику на фон
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeModal();
        }
    });
    
    // Закрытие по Escape
    document.addEventListener('keydown', escHandler);
}

// ============================================================
// ПОКАЗ СВОЙСТВ SBOM КОМПОНЕНТА
// ============================================================

function showSBOMProperties(element) {
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
    
    var comp = element.componentData || {};
    var properties = [];
    
    properties.push({ label: 'Тип', value: element.type === 'sbom-root' ? 'Корневой компонент' : 'Компонент' });
    properties.push({ label: 'Имя', value: comp.name || element.name || 'Unknown' });
    properties.push({ label: 'Версия', value: comp.version || 'unknown' });
    properties.push({ label: 'Тип компонента', value: comp.type || 'library' });
    
    if (comp.purl) {
        properties.push({ label: 'PURL', value: comp.purl });
    }
    if (comp.bomRef) {
        properties.push({ label: 'BOM Ref', value: comp.bomRef });
    }
    
    if (element.hasVulnerabilities !== undefined) {
        properties.push({ 
            label: 'Уязвимости', 
            value: element.hasVulnerabilities ? 'Есть (' + (element.vulnerabilityCount || 0) + ')' : 'Нет' 
        });
    }
    
    if (comp.properties && Array.isArray(comp.properties)) {
        for (var i = 0; i < Math.min(comp.properties.length, 5); i++) {
            var prop = comp.properties[i];
            if (prop && prop.name && prop.value) {
                var label = prop.name;
                if (label.startsWith('src:') || label.startsWith('dependency:')) {
                    label = label.replace(/^(src:|dependency:)/, '');
                }
                if (label.startsWith('hercules:')) {
                    label = label.replace('hercules:', '');
                }
                properties.push({ label: label, value: prop.value });
            }
        }
    }
    
    var propertiesHtml = properties.map(function(p) {
        return `
            <div style="display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
                <div style="width: 120px; font-weight: 500; color: #6b7280; flex-shrink: 0;">${p.label}</div>
                <div style="color: #1f2937; white-space: pre-wrap; word-break: break-all;">${escapeHtml(String(p.value))}</div>
            </div>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 16px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
            <div style="
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            ">
                <h3 style="margin: 0; font-size: 18px; color: #1f2937;">Свойства SBOM компонента</h3>
                <button onclick="this.closest('div').parentElement.remove()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #9ca3af;
                    padding: 0 8px;
                ">&times;</button>
            </div>
            <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
                ${propertiesHtml}
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: right; flex-shrink: 0;">
                <button onclick="this.closest('div').parentElement.remove()" style="
                    padding: 8px 20px;
                    background: #3B82F6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: Ubuntu, sans-serif;
                    font-size: 14px;
                ">Закрыть</button>
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
// ПОКАЗАТЬ УЯЗВИМОСТИ КОМПОНЕНТА
// ============================================================

function showVulnerabilitiesForComponent(bomRef) {
    if (!bomRef || !window.vulnerabilitiesMap || !window.vulnerabilitiesMap[bomRef]) {
        showCustomAlert('Информация', 'Уязвимостей для этого компонента не найдено', 'info');
        return;
    }
    
    var vulns = window.vulnerabilitiesMap[bomRef];
    var componentName = 'Unknown';
    
    for (var key in nodeElementsMap) {
        var el = nodeElementsMap[key];
        if (el.componentData && el.componentData.bomRef === bomRef) {
            componentName = el.componentData.name || 'Unknown';
            break;
        }
        if (el.bomRef === bomRef) {
            componentName = el.name || 'Unknown';
            break;
        }
    }
    
    var overlay = document.createElement('div');
    overlay.className = 'vuln-modal-overlay';
    overlay.style.cssText = `
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
        animation: alertFadeIn 0.3s ease;
    `;
    
    var vulnList = '';
    for (var i = 0; i < vulns.length; i++) {
        var v = vulns[i];
        var severity = v.severity || v.ratings?.[0]?.severity || 'UNKNOWN';
        var severityColor = '#6B7280';
        var severityLabel = severity;
        if (severity === 'CRITICAL') {
            severityColor = '#EF4444';
        } else if (severity === 'HIGH') {
            severityColor = '#F59E0B';
        } else if (severity === 'MODERATE' || severity === 'MEDIUM') {
            severityColor = '#FBBF24';
            severityLabel = 'MODERATE';
        } else if (severity === 'LOW') {
            severityColor = '#10B981';
        }
        
        vulnList += `
            <div style="
                background: #f8f9fa;
                padding: 12px 16px;
                margin-bottom: 10px;
                border-radius: 8px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: #1f2937;">${v.id || 'N/A'}</strong>
                    <span style="
                        background: ${severityColor};
                        color: white;
                        padding: 2px 10px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: bold;
                    ">${severityLabel}</span>
                </div>
                <div style="margin-top: 6px; font-size: 13px; color: #4b5563;">
                    ${v.description || 'Нет описания'}
                </div>
                ${v.source && v.source.url ? `
                    <div style="margin-top: 6px;">
                        <a href="${v.source.url}" target="_blank" style="color: #3B82F6; font-size: 12px;">Подробнее</a>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    function closeVulnModal() {
        if (overlay && overlay.parentNode) {
            overlay.remove();
        }
        document.removeEventListener('keydown', escHandler);
    }
    
    function escHandler(e) {
        if (e.key === 'Escape') {
            closeVulnModal();
        }
    }
    
    overlay.innerHTML = `
        <div style="
            background: white;
            border-radius: 16px;
            max-width: 700px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: alertScaleIn 0.3s ease;
        ">
            <div style="
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            ">
                <div>
                    <h3 style="margin: 0; font-size: 18px; color: #1f2937;">Уязвимости</h3>
                    <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">
                        ${componentName} (${vulns.length} уязвимостей)
                    </div>
                </div>
                <button onclick="this.closest('.vuln-modal-overlay').remove()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #9ca3af;
                    padding: 0 8px;
                ">&times;</button>
            </div>
            <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
                ${vulnList}
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: right; flex-shrink: 0;">
                <button onclick="this.closest('.vuln-modal-overlay').remove()" style="
                    padding: 8px 20px;
                    background: #3B82F6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: Ubuntu, sans-serif;
                    font-size: 14px;
                ">Закрыть</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeVulnModal();
        }
    });
    
    document.addEventListener('keydown', escHandler);
}

// ============================================================
// ПОЛУЧЕНИЕ ЛОГОВ
// ============================================================

function fetchElementLogs(element) {
    var elementId = element.id;
    var elementName = element.name || 'Элемент';
    
    showLogsModal(element, null, true);
    
    var token = localStorage.getItem('licenseToken');
    var headers = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    
    var encodedName = encodeURIComponent(elementName);
    var url = '/api/palette/logs/' + encodedName;
    
    fetch(url, {
        method: 'GET',
        headers: headers
    })
    .then(function(response) {
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return response.json();
    })
    .then(function(data) {
        var logs = data.logs || [];
        showLogsModal(element, logs, false);
    })
    .catch(function(error) {
        var errorLogs = [
            { time: new Date().toLocaleTimeString(), message: 'Ошибка получения логов: ' + error.message, type: 'error' },
            { time: new Date().toLocaleTimeString(), message: 'Попробуйте обновить страницу', type: 'warning' }
        ];
        showLogsModal(element, errorLogs, false);
    });
}

// ============================================================
// ПОКАЗ ЛОГОВ В МОДАЛКЕ
// ============================================================

function showLogsModal(element, logs, isLoading) {
    var oldModal = document.querySelector('.logs-modal-overlay');
    if (oldModal) oldModal.remove();
    
    var elementName = element.name || 'Элемент';
    var elementId = element.id;
    var hasLogs = logs && logs.length > 0;
    
    var overlay = document.createElement('div');
    overlay.className = 'logs-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: 100001;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: alertFadeIn 0.3s ease;
    `;

    var modal = document.createElement('div');
    modal.className = 'logs-modal';
    modal.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 28px 32px;
        max-width: 700px;
        width: 90%;
        max-height: 80vh;
        box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        animation: alertScaleIn 0.3s ease;
        display: flex;
        flex-direction: column;
    `;

    var logsHtml = '';
    
    if (isLoading) {
        logsHtml = `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #6b7280; min-height: 200px;">
                <div style="width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
                <p style="margin: 0; font-family: 'Ubuntu', sans-serif;">Загрузка логов...</p>
            </div>
        `;
    } else if (!hasLogs) {
        logsHtml = `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #6b7280; min-height: 200px;">
                <i class="fas fa-inbox" style="font-size: 32px; margin-bottom: 12px;"></i>
                <p style="margin: 0; font-family: 'Ubuntu', sans-serif;">Нет записей в журнале</p>
                <p style="margin: 4px 0 0 0; font-size: 11px; color: #4b5563; font-family: 'Ubuntu', sans-serif;">Логи будут появляться после выполнения</p>
            </div>
        `;
    } else {
        logsHtml = logs.map(function(log) {
            var time = log.time || log.timestamp || new Date().toLocaleTimeString();
            var typeColor = log.type === 'error' ? '#EF4444' : 
                           log.type === 'warning' ? '#F59E0B' : 
                           log.type === 'success' ? '#10B981' : '#60A5FA';
            var message = log.message || log.msg || log.text || JSON.stringify(log);
            return `<div style="display: flex; gap: 12px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span style="color: #6b7280; min-width: 80px;">[${time}]</span>
                <span style="color: ${typeColor};">${escapeHtml(message)}</span>
            </div>`;
        }).join('');
    }

    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-list" style="color: #3B82F6; font-size: 20px;"></i>
                <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #1a1a2e; font-family: 'Ubuntu', sans-serif;">
                    Лог: ${escapeHtml(elementName)} (ID: ${elementId})
                </h3>
            </div>
            <button onclick="this.closest('.logs-modal-overlay').remove()" style="
                background: none; 
                border: none; 
                font-size: 24px; 
                cursor: pointer; 
                color: #9ca3af; 
                padding: 0 8px;
                font-family: 'Ubuntu', sans-serif;
            ">&times;</button>
        </div>
        <div style="flex: 1; overflow-y: auto; background: #1a1a2e; border-radius: 8px; padding: 16px; font-family: 'Courier New', monospace; font-size: 12px; min-height: 200px; max-height: 400px; display: flex; flex-direction: column;">
            ${logsHtml}
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb; flex-shrink: 0;">
            <button onclick="this.closest('.logs-modal-overlay').remove()" style="
                padding: 8px 24px;
                border: none;
                border-radius: 8px;
                background: #e5e7eb;
                color: #374151;
                font-family: 'Ubuntu', sans-serif;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">Закрыть</button>
            ${hasLogs && !isLoading ? `<button onclick="clearElementLogsOnServer(${elementId})" style="
                padding: 8px 24px;
                border: none;
                border-radius: 8px;
                background: #EF4444;
                color: white;
                font-family: 'Ubuntu', sans-serif;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">Очистить логи</button>` : ''}
            ${!isLoading ? `<button onclick="fetchElementLogsById(${elementId})" style="
                padding: 8px 24px;
                border: none;
                border-radius: 8px;
                background: #3B82F6;
                color: white;
                font-family: 'Ubuntu', sans-serif;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            "><i class="fas fa-sync-alt"></i> Обновить</button>` : ''}
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    var escHandler = function(e) {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    
    if (isLoading) {
        var style = document.createElement('style');
        style.id = 'logsSpinnerStyle';
        style.textContent = `
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

// ============================================================
// ПОЛУЧЕНИЕ ЛОГОВ ПО ID
// ============================================================

function fetchElementLogsById(elementId) {
    var el = elements.find(function(e) { return e.id === elementId; });
    if (el) {
        fetchElementLogs(el);
    }
}

// ============================================================
// ОЧИСТКА ЛОГОВ НА СЕРВЕРЕ
// ============================================================

function clearElementLogsOnServer(elementId) {
    var el = elements.find(function(e) { return e.id === elementId; });
    if (!el) return;
    
    var elementName = el.name || 'Элемент';
    var token = localStorage.getItem('licenseToken');
    var headers = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    
    var encodedName = encodeURIComponent(elementName);
    var url = '/api/palette/logs/' + encodedName + '/clear';
    
    fetch(url, {
        method: 'DELETE',
        headers: headers
    })
    .then(function(response) {
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return response.json();
    })
    .then(function(data) {
        if (data.success) {
            showCustomAlert('Успешно', 'Журнал очищен', 'success');
            var el = elements.find(function(e) { return e.id === elementId; });
            if (el) {
                fetchElementLogs(el);
            }
        } else {
            showCustomAlert('Ошибка', data.error || 'Не удалось очистить логи', 'error');
        }
    })
    .catch(function(error) {
        showCustomAlert('Ошибка', 'Ошибка очистки: ' + error.message, 'error');
    });
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Удаление через клавишу
document.addEventListener('keydown', function(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
        e.preventDefault();
        deleteElement(selectedElement.id, null);
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