let cachedExtensions = null;
let cachedLicence = null; // Добавляем кэш для лицензии

/** Сохраняем расширения в кэш когда они загрузились */
function cacheExtensions(extensions, licence = null) {
    cachedExtensions = extensions;
    cachedLicence = licence; // Сохраняем лицензию
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
 * Получить информацию о лицензии из кэша
 */
function getLicenceFromCache() {
    return cachedLicence;
}

/**
 * Проверка валидности лицензии (использует глобальную лицензию, не из tool)
 */
function isLicenseValid() {
    console.log('cachedLicence:', cachedLicence);
    
    if (!cachedLicence) return false;
    if (!cachedLicence.expiresAt) return false;
    
    const expiresAt = new Date(cachedLicence.expiresAt);
    const now = new Date();
    
    console.log('expiresAt:', expiresAt);
    console.log('now:', now);
    console.log('is valid:', expiresAt > now);
    
    return expiresAt > now;
}

/**
 * Проверка, нужно ли показывать кнопку обновления лицензии
 */
function showLicenseButton(tool) {
    return !tool.free && !isLicenseValid();
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
    if (tool.features?.analysis?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Моделирование</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.analysis, 2)}
                </div>
            </div>
        `;
    }
    
    if (tool.features?.elements?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Элементы</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.elements, 2)}
                </div>
            </div>
        `;
    }
     // Режимы работы
    if (tool.features?.modes?.length > 0) {
        html += `
            <div class="settings-section">
                <h4> Режимы работы</h4>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    ${tool.features.modes.map(m => `
                        <div class="settings-option" style="flex: 1; min-width: 160px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="${m.icon}" style="color: ${m.iconColor}; width: 24px; font-size: 16px;"></i>
                                <span>${m.name}</span>
                                <span style="font-size: 10px; padding: 1px 8px; border-radius: 12px; background: ${m.badgeColor}; color: ${m.badgeTextColor}; font-weight: 600; margin-left: auto;">
                                    ${m.badge}
                                </span>
                            </div>
                        </div>
                    `).join('')}
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
                ${renderGrid(tool.features.specifications)}
            </div>
        `;
    }
        // анализ сети
    if (tool.features?.network?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Анализ сети</h4>
                ${renderGrid(tool.features.network)}
            </div>
        `;
    }

        // поиск уязвимостей
        if (tool.features?.vulnerabilities?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Поиск уязвимостей</h4>
                ${renderGrid(tool.features.vulnerabilities)}
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
 * Форматирование даты
 */
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Рендер правой панели
 */
function renderRightPanel(tool) {
    const isValid = isLicenseValid();
    const showBtn = showLicenseButton(tool);
    
    // Получаем информацию о лицензии из глобального кэша
    const licence = getLicenceFromCache();
    const expiresAt = licence?.expiresAt;
    
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
                       <span style="color: #10b981; font-family: 'Ubuntu'; font-size: 11px; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fas fa-check" style="font-size: 11px;"></i> 
                            Лицензия активна ${expiresAt ? `до ${formatDate(expiresAt)}` : 'бессрочно'}
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
window.getLicenceFromCache = getLicenceFromCache;