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
                <h4>${t('tool.panel.keyFeatures')}</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.key, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.sources?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.supportedSources')}</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.sources, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.analysis?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.modeling')}</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.analysis, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.visual?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.visualization')}</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.visual, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.elements?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.elements')}</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.elements, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.modes?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.modes')}</h4>
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
                <h4>${t('tool.panel.compositionAnalysis')}</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.sca, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.sast?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.sourceCodeAnalysis')}</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.sast, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.languages?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.supportedLanguages')}</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.languages, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.ecosystems?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.supportedEcosystems')}</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${renderColumns(tool.features.ecosystems, 2)}
                </div>
            </div>
        `;
    }

    if (tool.features?.protocols?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.supportedApiProtocols')}</h4>
                ${renderGrid(tool.features.protocols)}
            </div>
        `;
    }

    if (tool.features?.specifications?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.supportedSpecifications')}</h4>
                ${renderGrid(tool.features.specifications)}
            </div>
        `;
    }

    if (tool.features?.network?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.networkAnalysis')}</h4>
                ${renderGrid(tool.features.network)}
            </div>
        `;
    }

    if (tool.features?.vulnerabilities?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.vulnerabilitySearch')}</h4>
                ${renderGrid(tool.features.vulnerabilities)}
            </div>
        `;
    }

    if (tool.features?.reports?.length > 0) {
        html += `
            <div class="settings-section">
                <h4>${t('tool.panel.reportFormats')}</h4>
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