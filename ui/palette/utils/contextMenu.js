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
        
        // Проверяем, чтобы меню не выходило за пределы экрана
        var menuWidth = 200;
        var menuHeight = 100;
        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10;
        }
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 10;
        }
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
        
        // Подсвечиваем элемент
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

// Обработчики действий контекстного меню
document.querySelector('#elementContextMenu .context-menu-item[data-action="properties"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget) {
        openElementPropsModal(contextMenuTarget.id);
    }
    closeContextMenu();
});

document.querySelector('#elementContextMenu .context-menu-item[data-action="delete"]').addEventListener('click', function(e) {
    e.stopPropagation();
    if (contextMenuTarget) {
        deleteElement(contextMenuTarget.id, null);
    }
    closeContextMenu();
});

// Также добавляем обработчик для удаления через клавишу Delete/Backspace
document.addEventListener('keydown', function(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
        e.preventDefault();
        deleteElement(selectedElement.id, null);
    }
});

// Добавляем стиль для подсветки элемента при открытом контекстном меню
var highlightStyle = document.createElement('style');
highlightStyle.textContent = `
    .canvas-element.context-active {
        border-color: #3B82F6 !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0,0,0,0.1) !important;
        z-index: 100 !important;
    }
`;
document.head.appendChild(highlightStyle);