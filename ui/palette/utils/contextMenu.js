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
    min-width: 180px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    z-index: 100000;
    font-family: 'Ubuntu', sans-serif;
    overflow: hidden;
`;
contextMenu.innerHTML = `
    <div class="context-menu-item" data-action="view">
        <i class="fas fa-eye"></i> Просмотр
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
        
        // Позиционируем меню
        var menu = document.getElementById('elementContextMenu');
        var x = e.clientX;
        var y = e.clientY;
        
        var menuWidth = 200;
        var menuHeight = 130;
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

// Просмотр (получение логов с сервера по имени элемента)
document.querySelector('#elementContextMenu .context-menu-item[data-action="view"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget) {
        fetchElementLogs(contextMenuTarget);
    }
    closeContextMenu();
});

// Свойства
document.querySelector('#elementContextMenu .context-menu-item[data-action="properties"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget) {
        openElementPropsModal(contextMenuTarget.id);
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
// ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ЛОГОВ С СЕРВЕРА ПО ИМЕНИ ЭЛЕМЕНТА
// ============================================================

function fetchElementLogs(element) {
    var elementId = element.id;
    var elementName = element.name || 'Элемент';
    
    // Показываем индикатор загрузки
    showLogsModal(element, null, true);
    
    // Получаем токен из localStorage
    var token = localStorage.getItem('licenseToken');
    var headers = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    
    // Кодируем имя для URL
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
// ФУНКЦИЯ ДЛЯ ОТОБРАЖЕНИЯ ЛОГОВ ЭЛЕМЕНТА
// ============================================================

function showLogsModal(element, logs, isLoading) {
    // Удаляем старую модалку если есть
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
                <i class="fas fa-eye" style="color: #3B82F6; font-size: 20px;"></i>
                <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #1a1a2e; font-family: 'Ubuntu', sans-serif;">
                    Журнал: ${escapeHtml(elementName)} (ID: ${elementId})
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
// ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ЛОГОВ ПО ID (для кнопки обновить)
// ============================================================

function fetchElementLogsById(elementId) {
    var el = elements.find(function(e) { return e.id === elementId; });
    if (el) {
        fetchElementLogs(el);
    }
}

// ============================================================
// ФУНКЦИЯ ДЛЯ ОЧИСТКИ ЛОГОВ НА СЕРВЕРЕ ПО ИМЕНИ ЭЛЕМЕНТА
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
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// УДАЛЕНИЕ ЧЕРЕЗ КЛАВИШУ
// ============================================================

document.addEventListener('keydown', function(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
        e.preventDefault();
        deleteElement(selectedElement.id, null);
    }
});

// ============================================================
// СТИЛЬ ДЛЯ ПОДСВЕТКИ ЭЛЕМЕНТА
// ============================================================

var highlightStyle = document.createElement('style');
highlightStyle.textContent = `
    .canvas-element.context-active {
        border-color: #3B82F6 !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0,0,0,0.1) !important;
        z-index: 100 !important;
    }
`;
document.head.appendChild(highlightStyle);