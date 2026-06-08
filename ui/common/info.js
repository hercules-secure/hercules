

let cachedExtensions = null;

/** Сохраняем расширения в кэш когда они загрузились */
function cacheExtensions(extensions) {
    cachedExtensions = extensions;
}

/**
 * Получить расширения из кэша
 */
function getExtensionsFromCache() {
    return cachedExtensions;
}

/**
 * Получить информацию о конкретном инструменте из кэша
 */
function getToolInfoFromCache(toolId) {
    if (!cachedExtensions) return null;
    return cachedExtensions.find(ext => ext.id === toolId);
}

/**
 * Проверка валидности лицензии
 */
function isLicenseValid(tool) {
    if (tool.free) return true;
    if (!tool.license) return false;
    if (tool.license.state !== 'active') return false;
    if (tool.license.expiresAt && new Date(tool.license.expiresAt) < new Date()) {
        return false;
    }
    return true;
}

/**
 * Проверка, нужно ли показывать кнопку обновления лицензии
 */
function showLicenseButton(tool) {
    return !tool.free && !isLicenseValid(tool);
}

/**
 * Рендер колонок
 */
function renderColumns(items, columns = 2) {
    if (!items || items.length === 0) return '';
    
    const perColumn = Math.ceil(items.length / columns);
    let html = '';
    
    for (let i = 0; i < columns; i++) {
        const start = i * perColumn;
        const end = start + perColumn;
        const columnItems = items.slice(start, end);
        
        if (columnItems.length > 0) {
            html += `<div style="flex: 1; min-width: 150px;">`;
            columnItems.forEach(item => {
                html += `
                    <div class="settings-option">
                        <i class="${item.icon}" style="color: ${item.iconColor}; width: 28px;"></i>
                        <span>${item.name}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
    }
    
    return html;
}

/**
 * Рендер сетки для протоколов
 */
function renderGrid(items) {
    if (!items || items.length === 0) return '';
    
    return `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px;">
            ${items.map(item => `
                <div class="settings-option">
                    <i class="${item.icon}" style="width: 28px; color: ${item.iconColor};"></i>
                    <span>${item.name}</span>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Рендер левой панели
 */
function renderLeftPanel(tool) {
    let html = '';
    
    // Ключевые возможности
    if (tool.features?.key?.length > 0) {
        html += `
            <div class="settings-section">
                <h4> Ключевые возможности</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.key, 2)}
                </div>
            </div>
        `;
    }
    
    if (tool.features?.sca?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Композиционный анализ</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.sca, 2)}
                </div>
            </div>
        `;
    }
    

    if (tool.features?.sast?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Анализ исходного кода</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.sast, 2)}
                </div>
            </div>
        `;
    }
    
    // Поддерживаемые языки
    if (tool.features?.languages?.length > 0) {
        html += `
            <div class="settings-section">
                <h4> Поддерживаемые языки</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.languages, 2)}
                </div>
            </div>
        `;
    }
    
    // Поддерживаемые экосистемы
    if (tool.features?.ecosystems?.length > 0) {
        html += `
            <div class="settings-section">
                <h4> Поддерживаемые экосистемы</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.ecosystems, 2)}
                </div>
            </div>
        `;
    }
    
    // Поддерживаемые протоколы API
    if (tool.features?.protocols?.length > 0) {
        html += `
            <div class="settings-section">
                <h4> Поддерживаемые протоколы API</h4>
                ${renderGrid(tool.features.protocols)}
            </div>
        `;
    }
    
    // Поддерживаемые спецификации
    if (tool.features?.specifications?.length > 0) {
        html += `
            <div class="settings-section">
                <h4> Поддерживаемые спецификации</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${tool.features.specifications.map(s => `
                        <div class="settings-option">
                            <i class="${s.icon}" style="color: ${s.iconColor}; width: 28px;"></i>
                            <span>${s.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Поддерживаемые источники
    if (tool.features?.sources?.length > 0) {
        html += `
            <div class="settings-section">
                <h4> Поддерживаемые источники</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.sources, 2)}
                </div>
            </div>
        `;
    }
    
    // Форматы отчетов
    if (tool.features?.reports?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Форматы отчетов</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${tool.features.reports.map(r => `
                        <div class="settings-option">
                            <i class="${r.icon}" style="width: 28px; color: ${r.iconColor};"></i>
                            <span>${r.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

/**
 * Рендер правой панели
 */
function renderRightPanel(tool) {
    const isValid = isLicenseValid(tool);
    const showBtn = showLicenseButton(tool);
    
    return `
        <div class="about-info">
            <i class="${tool.icon} flask-icon"></i>
            <h3>${tool.name}</h3>
            <div class="version">Версия ${tool.version}</div>
            <div class="description">${tool.description}</div>
            <hr class="divider">
            
            ${!tool.free ? `
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
                    ${showBtn ? `
                        <span style="color: black; font-family: 'Ubuntu'; font-size: 15px">Доступно с лицензией</span>
                        <span style="padding: 4px 12px; color: black; font-weight: 700; letter-spacing: 0.5px; font-family: 'Ubuntu'; font-size: 15px;">
                            Геркулес Плюс
                        </span>
                        <button class="upgrade-btn" onclick="showLicenseModal('${tool.id}')">
                            <i class="fas fa-credit-card"></i>
                            <span>Обновить лицензию</span>
                        </button>
                    ` : `
                        <span style="color: #10b981; font-family: 'Ubuntu'; font-size: 14px;">
                            <i class="fas fa-check-circle"></i> 
                            Лицензия активна ${tool.license?.expiresAt ? `до ${tool.license.expiresAt}` : 'бессрочно'}
                        </span>
                    `}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Показать окно с описанием инструмента (из кэша)
 */
function showToolInfo(toolId) {
    const tool = getToolInfoFromCache(toolId);
    
    if (!tool) {
        console.error(`Tool ${toolId} not found in cache`);
        return;
    }
    
    const modal = document.getElementById('unifiedModal');
    if (!modal) {
        console.error('Modal element not found');
        return;
    }
    
    const header = modal.querySelector('.settings-header h3');
    const leftContent = modal.querySelector('.unified-left');
    const rightContent = modal.querySelector('.unified-right');
    
    if (!header || !leftContent || !rightContent) {
        console.error('Modal structure not found');
        return;
    }
    
    header.innerHTML = '<h3><i class="fas fa-list" style="color: black;"></i>Ключевые возможности</h3>';
    leftContent.innerHTML = renderLeftPanel(tool);
    rightContent.innerHTML = renderRightPanel(tool);
    
    modal.style.display = 'flex';
}

/**
 * Закрыть окно
 */
function closeToolModal() {
    const modal = document.getElementById('unifiedModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Экспортируем в глобальную область
window.showToolInfo = showToolInfo;
window.closeToolModal = closeToolModal;