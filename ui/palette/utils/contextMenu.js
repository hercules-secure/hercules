// ============================================================
// CONTEXT MENU FOR CANVAS ELEMENTS
// ============================================================

// Create context menu
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
    font-family: 'Fira Sans', 'Fira Code', sans-serif;
    overflow: hidden;
`;
contextMenu.innerHTML = `
    <!-- Analyze -->
    <div class="context-menu-item" data-action="analyze">
        <i class="fas fa-microscope" style="color: #8B5CF6;"></i> Analyze
    </div>
    
    <!-- Log -->
    <div class="context-menu-item" data-action="logs">
        <i class="fas fa-list"></i> Log
    </div>
    
    <!-- Vulnerabilities -->
    <div class="context-menu-item" data-action="vulnerabilities">
        <i class="fas fa-shield-alt" style="color: #EF4444;"></i> Vulnerabilities
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
    
    <!-- Properties -->
    <div class="context-menu-item" data-action="properties">
        <i class="fas fa-cog"></i> Properties
    </div>
    
    <div class="context-menu-divider"></div>
    
    <!-- Delete -->
    <div class="context-menu-item danger" data-action="delete">
        <i class="fas fa-trash"></i> Delete
    </div>
`;
document.body.appendChild(contextMenu);

// Add styles
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
        font-family: 'Fira Sans', 'Fira Code', sans-serif;
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

var contextMenuTarget = null;

// ============================================================
// UPDATE MENU
// ============================================================

function updateContextMenu(element) {
    // Get menu items
    var analyzeItem = contextMenu.querySelector('[data-action="analyze"]');
    var logsItem = contextMenu.querySelector('[data-action="logs"]');
    var vulnItem = contextMenu.querySelector('[data-action="vulnerabilities"]');
    var badge = vulnItem ? vulnItem.querySelector('#vulnCountBadge') : null;

    // ------------------------------------------------------------------
    // 1. Check if element is a tool (Echolot, Scout, etc.)
    // Look for DOM element on canvas by ID and check type-tool class
    // ------------------------------------------------------------------
    var targetDom = element && element.id 
        ? document.querySelector(`.canvas-element[data-id="${element.id}"]`) 
        : null;
    
    var isTool = targetDom && targetDom.classList.contains('type-tool');

    // ------------------------------------------------------------------
    // 2. Check for vulnerabilities (for badge if needed)
    // ------------------------------------------------------------------
    var hasVuln = false;
    var vulnCount = 0;
    
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

    // ------------------------------------------------------------------
    // 3. Apply show/hide rules for menu items
    // ------------------------------------------------------------------
    
    // --- ANALYZE: hide for tools ---
    if (analyzeItem) {
        analyzeItem.style.display = isTool ? 'none' : 'flex';
    }

    // --- LOG: hide for project elements ---
    var isProjectItem = element && (
        element.type === 'project-root' ||
        element.type === 'project-folder' ||
        element.type === 'project-file' ||
        element.isFolder === true ||
        element.isFile === true ||
        element.isProject === true ||
        element.type === 'function' ||
        element.type === 'class' ||
        element.type === 'method' ||
        element.type === 'uml-class' ||
        element.type === 'uml-field' ||
        element.type === 'uml-method' ||
        element.isCode === true
    );
    
    if (logsItem) {
        logsItem.style.display = isProjectItem ? 'none' : 'flex';
    }

    // --- VULNERABILITIES: hide for tools ---
    if (vulnItem) {
        vulnItem.style.display = isTool ? 'none' : 'flex';
        
        // Show badge ONLY if there are vulnerabilities and NOT a tool
        if (badge) {
            if (hasVuln && !isTool) {
                badge.textContent = vulnCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }
}

// ============================================================
// RIGHT CLICK HANDLER
// ============================================================

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

function closeContextMenu() {
    var menu = document.getElementById('elementContextMenu');
    if (menu) menu.style.display = 'none';
    contextMenuTarget = null;
    document.querySelectorAll('.canvas-element.context-active').forEach(function(el) {
        el.classList.remove('context-active');
    });
}

document.addEventListener('click', function(e) {
    var menu = document.getElementById('elementContextMenu');
    if (menu && !menu.contains(e.target)) {
        closeContextMenu();
    }
});

// ============================================================
// MENU ACTIONS
// ============================================================

// ANALYZE
document.querySelector('#elementContextMenu .context-menu-item[data-action="analyze"]').addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    if (contextMenuTarget) {
        if (typeof openToolSelectionModal === 'function') {
            openToolSelectionModal();
        } else if (typeof showCustomAlert === 'function') {
            showCustomAlert('Error', 'Analysis function not found', 'error');
        }
    }
    closeContextMenu();
});

// LOG
document.querySelector('#elementContextMenu .context-menu-item[data-action="logs"]').addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    if (contextMenuTarget && typeof fetchElementLogs === 'function') {
        fetchElementLogs(contextMenuTarget);
    }
    closeContextMenu();
});

// VULNERABILITIES
document.querySelector('#elementContextMenu .context-menu-item[data-action="vulnerabilities"]').addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    if (contextMenuTarget) {
        showVulnerabilitiesModal(contextMenuTarget);
    }
    closeContextMenu();
});

// PROPERTIES
document.querySelector('#elementContextMenu .context-menu-item[data-action="properties"]').addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
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
        } else if (contextMenuTarget.type === 'function' || contextMenuTarget.type === 'class' || contextMenuTarget.type === 'method') {
            showCodeElementProperties(contextMenuTarget);
        } else if (typeof openElementPropsModal === 'function') {
            openElementPropsModal(contextMenuTarget.id);
        }
    }
    closeContextMenu();
});

// DELETE
document.querySelector('#elementContextMenu .context-menu-item[data-action="delete"]').addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    if (contextMenuTarget && typeof deleteElement === 'function') {
        deleteElement(contextMenuTarget.id, null);
    }
    closeContextMenu();
});

// ============================================================
// VULNERABILITIES MODAL
// ============================================================

function showVulnerabilitiesModal(element) {
    // Check for vulnerabilities
    var hasVuln = false;
    var vulnCount = 0;
    var vulns = [];
    var elementName = element ? (element.name || 'Element') : 'Unknown';
    
    if (element && element.bomRef && window.vulnerabilitiesMap) {
        var foundVulns = window.vulnerabilitiesMap[element.bomRef];
        if (foundVulns && foundVulns.length > 0) {
            hasVuln = true;
            vulnCount = foundVulns.length;
            vulns = foundVulns;
        }
    }
    
    if (element && element.componentData) {
        if (element.componentData.hasVulnerabilities) {
            hasVuln = true;
            vulnCount = element.componentData.vulnerabilityCount || 0;
            if (element.componentData.vulnerabilities) {
                vulns = element.componentData.vulnerabilities;
            }
        }
    }
    
    // Create modal
    var overlay = document.createElement('div');
    overlay.id = 'vulnerabilitiesModal';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(4px);
        z-index: 100003;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: alertFadeIn 0.3s ease;
        font-family: 'Fira Sans', 'Fira Code', sans-serif;
    `;
    
    // Build vulnerabilities list
    var vulnListHtml = '';
    if (hasVuln && vulns.length > 0) {
        vulnListHtml = vulns.map(function(v, i) {
            var severity = v.severity || v.ratings?.[0]?.severity || 'UNKNOWN';
            var severityColor = '#6B7280';
            var severityLabel = severity;
            
            if (severity === 'CRITICAL' || severity === 'critical') {
                severityColor = '#EF4444';
                severityLabel = 'Critical';
            } else if (severity === 'HIGH' || severity === 'high') {
                severityColor = '#F59E0B';
                severityLabel = 'High';
            } else if (severity === 'MODERATE' || severity === 'moderate' || severity === 'MEDIUM' || severity === 'medium') {
                severityColor = '#FBBF24';
                severityLabel = 'Medium';
            } else if (severity === 'LOW' || severity === 'low') {
                severityColor = '#10B981';
                severityLabel = 'Low';
            } else if (severity === 'INFO' || severity === 'info') {
                severityColor = '#3B82F6';
                severityLabel = 'Info';
            }
            
            return `
                <div style="
                    background: #f8f9fa;
                    padding: 12px 16px;
                    margin-bottom: 10px;
                    border-radius: 8px;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: #1f2937;">${i+1}. ${v.id || v.title || v.name || 'Vulnerability'}</strong>
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
                        ${v.description || v.message || 'No description'}
                    </div>
                    ${v.source && v.source.url ? `
                        <div style="margin-top: 6px;">
                            <a href="${v.source.url}" target="_blank" style="color: #3B82F6; font-size: 12px;">Details</a>
                        </div>
                    ` : ''}
                    ${v.remediation ? `
                        <div style="margin-top: 6px; font-size: 12px; color: #10B981;">
                            <strong>Remediation:</strong> ${v.remediation}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } else {
        vulnListHtml = `
            <div style="text-align: center; padding: 40px 20px; color: #6c757d;">
                <i class="fas fa-check-circle" style="font-size: 48px; color: #10B981; display: block; margin-bottom: 16px;"></i>
                <h4 style="margin: 0; color: #495057;">No vulnerabilities found</h4>
                <p style="margin: 8px 0 0 0; font-size: 14px;">No vulnerabilities detected for component "${elementName}"</p>
            </div>
        `;
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
            overflow: hidden;
        ">
            <div style="
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
                background: #f8f9fa;
            ">
                <div>
                    <h3 style="margin: 0; font-size: 18px; color: #1f2937; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-shield-alt" style="color: #EF4444;"></i>
                        Vulnerabilities
                        ${hasVuln ? `<span style="font-size: 14px; color: #6c757d; font-weight: 400;">(${vulnCount})</span>` : ''}
                    </h3>
                    <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">
                        Component: ${elementName}
                    </div>
                </div>
                <button onclick="closeVulnerabilitiesModal()" style="
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
            <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
                ${vulnListHtml}
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: right; flex-shrink: 0; background: #fafafa;">
                <button onclick="closeVulnerabilitiesModal()" style="
                    padding: 8px 20px;
                    background: #8B5CF6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: 'Fira Sans', 'Fira Code', sans-serif;
                    font-size: 14px;
                ">
                    <i class="fas fa-check"></i> Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Close on backdrop click
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeVulnerabilitiesModal();
        }
    });
    
    // Close on Escape
    var escHandler = function(e) {
        if (e.key === 'Escape') {
            closeVulnerabilitiesModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function closeVulnerabilitiesModal() {
    var modal = document.getElementById('vulnerabilitiesModal');
    if (modal) {
        modal.remove();
    }
    document.removeEventListener('keydown', closeVulnerabilitiesModal._escHandler);
}

// ============================================================
// HELPER FUNCTIONS
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

// Code element properties
function showCodeElementProperties(element) {
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
        font-family: 'Fira Sans', 'Fira Code', sans-serif;
    `;
    
    var properties = [
        { label: 'Type', value: element.type || 'Code element' },
        { label: 'Name', value: element.name || 'Unnamed' },
    ];
    
    if (element.functionData) {
        var fn = element.functionData;
        if (fn.params && fn.params.length > 0) {
            properties.push({ label: 'Parameters', value: fn.params.join(', ') });
        }
        if (fn.type) {
            properties.push({ label: 'Function type', value: fn.type });
        }
        if (fn.file) {
            properties.push({ label: 'File', value: fn.file });
        }
    }
    
    if (element.fields && element.fields.length > 0) {
        properties.push({ label: 'Fields', value: element.fields.join(', ') });
    }
    
    if (element.methods && element.methods.length > 0) {
        var methodNames = element.methods.map(function(m) { return m.name || m; });
        properties.push({ label: 'Methods', value: methodNames.join(', ') });
    }
    
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
                <h3 style="margin: 0; font-size: 18px; color: #1f2937;">Element Properties</h3>
                <button onclick="this.closest('div[style]').parentElement.remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af; padding: 0 8px;">&times;</button>
            </div>
            <div style="padding: 20px 24px;">
                ${propertiesHtml}
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: right;">
                <button onclick="this.closest('div[style]').parentElement.remove()" style="padding: 8px 20px; background: #3B82F6; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Fira Sans', 'Fira Code', sans-serif; font-size: 14px;">Close</button>
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

// File properties
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
        font-family: 'Fira Sans', 'Fira Code', sans-serif;
    `;
    
    var properties = [
        { label: 'File name', value: fileData.name },
        { label: 'Path', value: fileData.path },
        { label: 'Extension', value: fileData.ext },
        { label: 'Size', value: (fileData.size / 1024).toFixed(2) + ' KB' }
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
                <h3 style="margin: 0; font-size: 18px; color: #1f2937;">File Properties</h3>
                <button onclick="this.closest('div[style]').parentElement.remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af; padding: 0 8px;">&times;</button>
            </div>
            <div style="padding: 20px 24px;">
                ${propertiesHtml}
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: right;">
                <button onclick="this.closest('div[style]').parentElement.remove()" style="padding: 8px 20px; background: #3B82F6; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Fira Sans', 'Fira Code', sans-serif; font-size: 14px;">Close</button>
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

// Folder properties
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
        font-family: 'Fira Sans', 'Fira Code', sans-serif;
    `;
    
    var properties = [
        { label: 'Folder name', value: folderData.name || element.name || 'Unknown' },
        { label: 'File count', value: fileCount }
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
                <h3 style="margin: 0; font-size: 18px; color: #1f2937;">Folder Properties</h3>
                <button onclick="this.closest('div[style]').parentElement.remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af; padding: 0 8px;">&times;</button>
            </div>
            <div style="padding: 20px 24px;">
                ${propertiesHtml}
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: right;">
                <button onclick="this.closest('div[style]').parentElement.remove()" style="padding: 8px 20px; background: #3B82F6; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Fira Sans', 'Fira Code', sans-serif; font-size: 14px;">Close</button>
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
// DELETE VIA KEYBOARD
// ============================================================

document.addEventListener('keydown', function(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && typeof selectedElement !== 'undefined' && selectedElement) {
        e.preventDefault();
        if (typeof deleteElement === 'function') {
            deleteElement(selectedElement.id, null);
        }
    }
});

// Highlight style
var highlightStyle = document.createElement('style');
highlightStyle.textContent = `
    .canvas-element.context-active {
        border-color: #3B82F6 !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0,0,0,0.1) !important;
        z-index: 100 !important;
    }
    @keyframes alertFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes alertScaleIn {
        from { opacity: 0; transform: scale(0.95) translateY(10px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
    }
`;
document.head.appendChild(highlightStyle);

// ============================================================
// REGISTER FUNCTIONS
// ============================================================

window.showVulnerabilitiesModal = showVulnerabilitiesModal;
window.closeVulnerabilitiesModal = closeVulnerabilitiesModal;
window.showCodeElementProperties = showCodeElementProperties;
window.showFileProperties = showFileProperties;
window.showFolderProperties = showFolderProperties;