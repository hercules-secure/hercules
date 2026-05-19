// ==================== ПЕРЕМЕННЫЕ ====================
let extensions = [];
let categories = [];
let currentTab = "all";
let currentCategory = "all";

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ОПРЕДЕЛЕНЫ ПЕРВЫМИ) ====================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showToast(message, type) {
    // Удаляем старый тост если есть
    const oldToast = document.querySelector('.toast');
    if (oldToast) oldToast.remove();
    
    const toast = document.createElement("div");
    toast.className = `toast ${type === "success" ? "success" : type === "error" ? "error" : ""}`;
    toast.innerHTML = `<i class="fas ${type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-info-circle"}"></i> ${escapeHtml(message)}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "slideOut 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getCategoryIcon(category) {
    const icons = {
        'scanner': 'fa-search',
        'integration': 'fa-plug',
        'reporter': 'fa-chart-bar',
        'rules': 'fa-shield-alt',
        'automation': 'fa-robot'
    };
    return icons[category] || 'fa-puzzle-piece';
}

function getCategoryName(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : categoryId;
}

function getExtensionsCountByCategory(categoryId) {
    if (categoryId === 'all') {
        return extensions.length;
    }
    return extensions.filter(ext => ext.category === categoryId).length;
}

// ==================== RENDER ФУНКЦИИ ====================
function renderCategories() {
    const container = document.getElementById("categoriesContainer");
    if (!container) return;
    
    if (!categories.length) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = categories.map(cat => `
        <button class="category-btn ${currentCategory === cat.id ? 'active' : ''}" data-category="${cat.id}">
            <i class="fas ${cat.icon || getCategoryIcon(cat.id)}"></i>
            <span>${escapeHtml(cat.name)}</span>
            <span class="category-count">${getExtensionsCountByCategory(cat.id)}</span>
        </button>
    `).join("");
    
    // Обработчики кликов по категориям
    document.querySelectorAll(".category-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentCategory = btn.dataset.category;
            renderExtensions(currentCategory);
        });
    });
}

function renderExtensions(category = "all") {
    const grid = document.getElementById("extensionsGrid");
    if (!grid) return;
    
    let filtered = [...extensions];
    
    // Фильтр по категории
    if (category !== 'all') {
        filtered = extensions.filter(ext => ext.category === category);
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="coming-soon"><i class="fas fa-box-open"></i><p>Нет расширений в этой категории</p></div>`;
        return;
    }
    
    grid.innerHTML = filtered.map(ext => `
        <div class="extension-card" data-category="${ext.category || 'other'}">
            <div class="extension-icon">
                <i class="${ext.icon || 'fas fa-puzzle-piece'}"></i>
            </div>
            <div class="extension-title">${escapeHtml(ext.name)}</div>
            <div class="extension-version">v${escapeHtml(ext.version)} ${ext.hasUpdate ? `→ v${ext.newVersion || ext.version}` : ""}</div>
            <div class="extension-description">${escapeHtml(ext.description)}</div>
            <div class="extension-tags">
                ${(ext.tags || []).map(tag => `<span class="extension-tag">#${escapeHtml(tag)}</span>`).join("")}
            </div>
            <div class="extension-meta">
                <span class="extension-author"><i class="fas fa-user"></i> ${escapeHtml(ext.author)}</span>
            </div>
            <div class="extension-category-badge">
                <i class="fas ${getCategoryIcon(ext.category)}"></i>
                ${escapeHtml(getCategoryName(ext.category))}
            </div>
            ${ext.installed ? `
                <div class="extension-status status-installed"><i class="fas fa-check-circle"></i> Установлено</div>
                ${ext.hasUpdate ? `
                    <button class="install-btn install-btn-primary" onclick="updateExtension('${ext.id}')">
                        <i class="fas fa-sync-alt"></i> Обновить до v${ext.newVersion || ext.version}
                    </button>
                ` : `
                    <button class="install-btn install-btn-outline" onclick="uninstallExtension('${ext.id}')">
                        <i class="fas fa-trash-alt"></i> Удалить
                    </button>
                `}
            ` : `
                <div class="extension-status status-available"><i class="fas fa-cloud-download-alt"></i> ${ext.price === "Free" ? "Бесплатно" : (ext.price || "Бесплатно")}</div>
                <button class="install-btn install-btn-primary" onclick="installExtension('${ext.id}')">
                    <i class="fas fa-download"></i> Установить
                </button>
            `}
        </div>
    `).join("");
}

// ==================== ОБНОВЛЕНИЕ МЕНЮ ====================
async function refreshGlobalMenu() {
    // Отправляем сигнал всем открытым вкладкам
    localStorage.setItem('menuUpdate', Date.now());
    
    // Обновляем меню на текущей странице, если функция loadMenu существует
    if (window.loadMenu && typeof window.loadMenu === 'function') {
        await window.loadMenu();
    }
}

// ==================== API ФУНКЦИИ ====================
async function loadExtensions() {
    const grid = document.getElementById("extensionsGrid");
    if (grid) {
        grid.innerHTML = `<div class="coming-soon"><i class="fas fa-spinner fa-spin"></i><p>Загрузка расширений...</p></div>`;
    }
    
    try {
        const response = await fetch('/addons/api/extensions');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            extensions = data.extensions || [];
            categories = data.categories || [];
            
            // Если категорий нет, создаем из расширений
            if (!categories.length && extensions.length) {
                const categorySet = new Set();
                categorySet.add({ id: 'all', name: 'Все', icon: 'fa-th-large' });
                for (const ext of extensions) {
                    if (ext.category && !categories.find(c => c.id === ext.category)) {
                        categories.push({
                            id: ext.category,
                            name: getCategoryNameFromId(ext.category),
                            icon: getCategoryIcon(ext.category)
                        });
                    }
                }
            }
            
            renderCategories();
            renderExtensions(currentCategory);
        } else {
            showToast(data.error || 'Ошибка загрузки расширений', 'error');
        }
    } catch (error) {
        console.error('Failed to load extensions:', error);
        showToast('Ошибка подключения к серверу', 'error');
        if (grid) {
            grid.innerHTML = `<div class="coming-soon"><i class="fas fa-exclamation-triangle"></i><p>Ошибка подключения к серверу</p></div>`;
        }
    }
}

function getCategoryNameFromId(categoryId) {
    const names = {
        'scanner': 'Сканнеры',
        'integration': 'Интеграции',
        'reporter': 'Отчеты',
        'rules': 'Правила',
        'automation': 'Автоматизация'
    };
    return names[categoryId] || categoryId;
}

async function installExtension(id) {
    showToast("Установка расширения...", "info");
    
    try {
        const response = await fetch('/addons/api/extensions/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extensionId: id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadExtensions();
            await refreshGlobalMenu();  // ← ОБНОВЛЯЕМ МЕНЮ
            showToast(`${data.message}`, "success");
        } else {
            showToast(`${data.error}`, "error");
        }
    } catch (error) {
        console.error('Install error:', error);
        showToast(`Ошибка установки`, "error");
    }
}

async function uninstallExtension(id) {
    if (!confirm("Удалить расширение?")) return;
    
    try {
        const response = await fetch('/addons/api/extensions/uninstall', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extensionId: id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadExtensions();
            await refreshGlobalMenu();  // ← ОБНОВЛЯЕМ МЕНЮ
            showToast(`${data.message}`, "success");
        } else {
            showToast(`${data.error}`, "error");
        }
    } catch (error) {
        console.error('Uninstall error:', error);
        showToast(`Ошибка удаления`, "error");
    }
}

async function updateExtension(id) {
    showToast("Обновление расширения...", "info");
    
    try {
        const response = await fetch('/addons/api/extensions/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extensionId: id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadExtensions();
            await refreshGlobalMenu();  // ← ОБНОВЛЯЕМ МЕНЮ
            showToast(`${data.message}`, "success");
        } else {
            showToast(`${data.error}`, "error");
        }
    } catch (error) {
        console.error('Update error:', error);
        showToast(`Ошибка обновления`, "error");
    }
}

async function refreshCatalog() {
    showToast("Обновление каталога...", "info");
    
    try {
        const response = await fetch('/addons/api/extensions/refresh', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadExtensions();
            await refreshGlobalMenu();  // ← ОБНОВЛЯЕМ МЕНЮ
            showToast(`${data.message} (${data.count || 0} аддонов)`, "success");
        } else {
            showToast(`${data.error}`, "error");
        }
    } catch (error) {
        console.error('Refresh error:', error);
        showToast(`Ошибка обновления каталога`, "error");
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
// Делаем функции глобальными для onclick
window.installExtension = installExtension;
window.uninstallExtension = uninstallExtension;
window.updateExtension = updateExtension;
window.refreshCatalog = refreshCatalog;
window.refreshGlobalMenu = refreshGlobalMenu;

// Загружаем расширения при старте
document.addEventListener('DOMContentLoaded', () => {
    loadExtensions();
});