let cachedExtensions = null;
let cachedLicence = null;

function cacheExtensions(extensions, licence = null) {
    cachedExtensions = extensions;
    cachedLicence = licence;
}

function getExtensionsFromCache() {
    return cachedExtensions;
}

function getToolInfoFromCache(toolId) {
    if (!cachedExtensions) return null;
    return cachedExtensions.find(ext => ext.id === toolId);
}

function getLicenceFromCache() {
    return cachedLicence;
}

function isLicenseValid() {
    if (!cachedLicence) return false;
    if (!cachedLicence.expiresAt) return false;
    
    const expiresAt = new Date(cachedLicence.expiresAt);
    const now = new Date();
    
    return expiresAt > now;
}

function showLicenseButton(tool) {
    return !tool.free && !isLicenseValid();
}

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

function renderLeftPanel(tool) {
    let html = '';
    
    if (tool.features?.key?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Key features</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.key, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.sources?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Supported sources</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.sources, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.analysis?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Modeling</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.analysis, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.visual?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Visualization</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.visual, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.elements?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Elements</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.elements, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.modes?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Modes</h4>
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
                <h4>Composition analysis</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.sca, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.sast?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Source code analysis</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.sast, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.languages?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Supported languages</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.languages, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.ecosystems?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Supported ecosystems</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.ecosystems, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.protocols?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Supported API protocols</h4>
                ${renderGrid(tool.features.protocols)}
            </div>
        `;
    }

    if (tool.features?.specifications?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Supported specifications</h4>
                ${renderGrid(tool.features.specifications)}
            </div>
        `;
    }

    if (tool.features?.network?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Network analysis</h4>
                ${renderGrid(tool.features.network)}
            </div>
        `;
    }

    if (tool.features?.vulnerabilities?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Vulnerability search</h4>
                ${renderGrid(tool.features.vulnerabilities)}
            </div>
        `;
    }

    if (tool.features?.reports?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>Report formats</h4>
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

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function renderRightPanel(tool) {
    const isValid = isLicenseValid();
    const showBtn = showLicenseButton(tool);
    const licence = getLicenceFromCache();
    const expiresAt = licence?.expiresAt;
    
    return `
        <div class="about-info">
            <i class="${tool.icon} flask-icon"></i>
            <h3>${tool.name}</h3>
            <div class="version">Version ${tool.version}</div>
            <div class="description">${tool.description}</div>
            <hr class="divider">
            
            ${!tool.free ? `
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
                    ${showBtn ? `
                        <span style="color: black; font-family: 'Ubuntu'; font-size: 15px">Available with license</span>
                        <span style="padding: 4px 12px; color: black; font-weight: 700; letter-spacing: 0.5px; font-family: 'Ubuntu'; font-size: 15px;">
                            Hercules Plus
                        </span>
                        <button class="upgrade-btn" onclick="showLicenseModal('${tool.id}')">
                            <i class="fas fa-credit-card"></i>
                            <span>Upgrade license</span>
                        </button>
                    ` : `
                       <span style="color: #10b981; font-family: 'Ubuntu'; font-size: 11px; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fas fa-check" style="font-size: 11px;"></i> 
                            License active ${expiresAt ? `until ${formatDate(expiresAt)}` : 'perpetual'}
                        </span>
                    `}
                </div>
            ` : ''}
        </div>
    `;
}

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
    
    header.innerHTML = '<h3><i class="fas fa-list" style="color: black;"></i>Key features</h3>';
    leftContent.innerHTML = renderLeftPanel(tool);
    rightContent.innerHTML = renderRightPanel(tool);
    
    modal.style.display = 'flex';
}

function closeToolModal() {
    const modal = document.getElementById('unifiedModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.showToolInfo = showToolInfo;
window.closeToolModal = closeToolModal;
window.getLicenceFromCache = getLicenceFromCache;