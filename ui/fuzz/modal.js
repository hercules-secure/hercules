// modal.js

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderVulnerabilitiesTable(vulnerabilities) {
    if (!vulnerabilities || vulnerabilities.length === 0) return '';

    const methodColors = {
        GET: { bg: '#61affe', color: 'white' },
        POST: { bg: '#49cc90', color: 'white' },
        PUT: { bg: '#fca130', color: 'white' },
        DELETE: { bg: '#f93e3e', color: 'white' },
        PATCH: { bg: '#50e3c2', color: '#333' },
        HEAD: { bg: '#9012fe', color: 'white' },
        OPTIONS: { bg: '#0d5aa7', color: 'white' },
        default: { bg: '#6c757d', color: 'white' }
    };
    
    const severityColors = {
        critical: { bg: '#dc3545', text: 'white', label: 'Critical' },
        high: { bg: '#fd7e14', text: 'white', label: 'High' },
        medium: { bg: '#ffc107', text: '#333', label: 'Medium' },
        low: { bg: '#28a745', text: 'white', label: 'Low' },
        info: { bg: '#6c757d', text: 'white', label: 'Info' }
    };
    
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const vuln of vulnerabilities) {
        const sev = (vuln.severity || 'info').toLowerCase();
        if (severityCounts[sev] !== undefined) severityCounts[sev]++;
    }
    
    let html = `
        <div style="margin: 24px 0 16px 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <h4 style="margin: 0; font-size: 15px; color: #1a1a2e;">Found Vulnerabilities</h4>
            <div style="display: flex; gap: 6px; margin-left: auto; flex-wrap: wrap;">
                <button class="severity-filter-btn active" data-filter="all" onclick="filterVulnerabilities('all')" style="padding: 4px 12px; border: 1px solid #dee2e6; border-radius: 16px; background: #667eea; color: white; cursor: pointer; font-size: 12px; font-family: 'Fira Sans', 'Fira Code', sans-serif; transition: all 0.2s;">
                    All
                </button>
                ${Object.entries(severityCounts).filter(([_, count]) => count > 0).map(([sev, count]) => `
                    <button class="severity-filter-btn" data-filter="${sev}" onclick="filterVulnerabilities('${sev}')" style="padding: 4px 12px; border: 1px solid ${severityColors[sev].bg}; border-radius: 16px; background: transparent; color: ${severityColors[sev].bg}; cursor: pointer; font-size: 12px; font-family: 'Fira Sans', 'Fira Code', sans-serif; transition: all 0.2s; font-weight: 500;">
                        ${severityColors[sev].label} <span style="font-weight: 600;"></span>
                    </button>
                `).join('')}
            </div>
        </div>
        <div style="overflow-x: auto; border-radius: 12px; border: 1px solid #e9ecef;">
            <table class="results-table" style="width: 100%; border-collapse: collapse; font-size: 14px; background: white; border-radius: 12px; overflow: hidden;">
                <thead>
                    <tr style="background: #f8f9fa; border-bottom: 2px solid #e9ecef;">
                        <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #495057; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Method</th>
                        <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #495057; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Type</th>
                        <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #495057; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Severity</th>
                        <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #495057; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Endpoint</th>
                        <th style="padding: 14px 16px; text-align: center; font-weight: 600; color: #495057; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; width: 50px;"></th>
                    </tr>
                </thead>
                <tbody id="vuln-table-body">
    `;
    
    for (let i = 0; i < vulnerabilities.length; i++) {
        const vuln = vulnerabilities[i];
        const severity = (vuln.severity || 'info').toLowerCase();
        const method = (vuln.method || 'GET').toUpperCase();
        const rowId = 'vuln-row-' + i;
        const detailId = 'vuln-detail-' + i;
        
        const sColor = severityColors[severity] || severityColors.info;
        const mColor = methodColors[method] || methodColors.default;
        
        html += `
            <tr id="${rowId}" data-severity="${severity}" style="cursor: pointer; border-bottom: 1px solid #f1f3f5; transition: background 0.15s ease;" 
                onmouseover="this.style.background='#f8f9fa'" 
                onmouseout="this.style.background='white'"
                onclick="toggleVulnDetail('${rowId}', '${detailId}')">
                <td style="padding: 12px 16px;">
                    <span style="display: inline-block; padding: 2px 12px; border-radius: 4px; font-size: 11px; font-weight: 700; background: ${mColor.bg}; color: ${mColor.color}; min-width: 50px; text-align: center;">
                        ${method}
                    </span>
                </td>
                <td style="padding: 12px 16px; font-weight: 500; color: #1a1a2e; font-size: 11px;">${escapeHtml(vuln.type || 'Unknown')}</td>
                <td style="padding: 12px 16px;">
                    <span class="severity-badge" style="display: inline-block; padding: 2px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; background: ${sColor.bg}; color: ${sColor.text};">
                        ${(vuln.severity || 'INFO').toUpperCase()}
                    </span>
                </td>
                <td style="padding: 12px 16px; font-family: 'Fira Code', monospace; font-size: 13px; color: #495057;">
                    <span style="background: #f1f3f5; padding: 2px 8px; border-radius: 4px;">${escapeHtml(vuln.endpoint || '/')}</span>
                </td>
                <td style="padding: 12px 16px; text-align: center;">
                    <span id="${detailId}-icon" style="display: inline-block; transition: transform 0.25s ease; font-size: 14px; color: black;">▼</span>
                </td>
            </tr>
            <tr id="${detailId}" data-severity="${severity}" style="display: none; background: #f8f9fa; border-bottom: 1px solid #e9ecef;">
                <td colspan="5" style="padding: 0;">
                    <div style="padding: 16px 24px; margin: 0 16px 16px 16px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px;">
                            ${vuln.snippet ? `
                            <div style="grid-column: 1 / -1; padding: 8px 12px; background: #fff3cd; border-radius: 6px; margin-bottom: 4px;">
                                <strong style="color: #856404;">Details:</strong>
                                <span style="color: #856404;">${escapeHtml(vuln.snippet)}</span>
                            </div>
                            ` : ''}
                            ${vuln.payload ? `
                            <div style="grid-column: 1 / -1;">
                                <strong style="color: #495057;">Payload:</strong>
                                <code style="display: inline-block; margin-top: 4px; background: #1a1a2e; color: #e9ecef; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-family: 'Fira Code', monospace; word-break: break-all; max-width: 100%;">
                                    ${escapeHtml(vuln.payload)}
                                </code>
                            </div>
                            ` : ''}
                            ${vuln.response_status ? `
                            <div>
                                <strong style="color: #495057;">Response Status:</strong>
                                <span style="font-weight: 600; ${vuln.response_status >= 200 && vuln.response_status < 300 ? 'color: #28a745;' : vuln.response_status >= 400 && vuln.response_status < 500 ? 'color: #fd7e14;' : vuln.response_status >= 500 ? 'color: #dc3545;' : 'color: #6c757d;'}">
                                    ${vuln.response_status}
                                </span>
                            </div>
                            ` : ''}
                            ${vuln.category ? `
                            <div>
                                <strong style="color: #495057;">Category:</strong>
                                <span style="color: #6c757d;">${escapeHtml(vuln.category)}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

function filterVulnerabilities(filter) {
    const rows = document.querySelectorAll('#vuln-table-body tr');
    const btns = document.querySelectorAll('.severity-filter-btn');
    
    btns.forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = btn.getAttribute('data-filter') === 'all' ? '#667eea' : '#6c757d';
        if (btn.getAttribute('data-filter') === filter) {
            btn.classList.add('active');
            btn.style.background = '#667eea';
            btn.style.color = 'white';
        }
    });
    
    rows.forEach(row => {
        const severity = row.getAttribute('data-severity');
        if (filter === 'all' || severity === filter) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function toggleVulnDetail(rowId, detailId) {
    const detail = document.getElementById(detailId);
    const icon = document.getElementById(detailId + '-icon');
    
    if (!detail) return;
    
    if (detail.style.display === 'none') {
        detail.style.display = 'table-row';
        if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
        detail.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

function displayResults(report) {
    const modalBody = document.getElementById('fuzzModalBody');
    if (!modalBody) return;
    
    const vulnerabilities = report.vulnerabilities || [];
    
    let critical = 0, high = 0, medium = 0, low = 0, info = 0;
    
    for (const vuln of vulnerabilities) {
        const severity = (vuln.severity || 'info').toLowerCase();
        if (severity === 'critical') critical++;
        else if (severity === 'high') high++;
        else if (severity === 'medium') medium++;
        else if (severity === 'low') low++;
        else info++;
    }
    
    const vulnCount = vulnerabilities.length || 0;
    
    modalBody.innerHTML = `
        <div class="fuzz-severity-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px;">
            <div class="fuzz-severity-card critical" style="text-align: center; padding: 16px; border-radius: 12px; background: #fef2f2; border: 1px solid #fecaca;">
                <div class="fuzz-severity-number" style="font-size: 32px; font-weight: 700; color: #dc2626;">${critical}</div>
                <div class="fuzz-severity-label" style="font-size: 13px; color: #dc2626; font-weight: 500;">Critical</div>
            </div>
            <div class="fuzz-severity-card high" style="text-align: center; padding: 16px; border-radius: 12px; background: #fff7ed; border: 1px solid #fed7aa;">
                <div class="fuzz-severity-number" style="font-size: 32px; font-weight: 700; color: #ea580c;">${high}</div>
                <div class="fuzz-severity-label" style="font-size: 13px; color: #ea580c; font-weight: 500;">High</div>
            </div>
            <div class="fuzz-severity-card medium" style="text-align: center; padding: 16px; border-radius: 12px; background: #fffbeb; border: 1px solid #fde68a;">
                <div class="fuzz-severity-number" style="font-size: 32px; font-weight: 700; color: #d97706;">${medium}</div>
                <div class="fuzz-severity-label" style="font-size: 13px; color: #d97706; font-weight: 500;">Medium</div>
            </div>
            <div class="fuzz-severity-card low" style="text-align: center; padding: 16px; border-radius: 12px; background: #ecfdf5; border: 1px solid #a7f3d0;">
                <div class="fuzz-severity-number" style="font-size: 32px; font-weight: 700; color: #059669;">${low}</div>
                <div class="fuzz-severity-label" style="font-size: 13px; color: #059669; font-weight: 500;">Low</div>
            </div>
            <div class="fuzz-severity-card info" style="text-align: center; padding: 16px; border-radius: 12px; background: #f1f5f9; border: 1px solid #e2e8f0;">
                <div class="fuzz-severity-number" style="font-size: 32px; font-weight: 700; color: #64748b;">${info}</div>
                <div class="fuzz-severity-label" style="font-size: 13px; color: #64748b; font-weight: 500;">Info</div>
            </div>
        </div>
        
        ${vulnCount > 0 ? renderVulnerabilitiesTable(vulnerabilities) : '<div class="no-vulnerabilities" style="text-align: center; padding: 40px 20px; color: #16a34a;"><i class="fas fa-check-circle" style="font-size: 48px; display: block; margin-bottom: 16px;"></i><h4 style="margin: 0; color: #16a34a;">No vulnerabilities found</h4></div>'}
    `;
    
    openFuzzModal();
}

function renderMetlaTargets(reportData) {
    const area = document.getElementById('metlaTargetsArea');
    const empty = document.getElementById('metlaEmpty');
    const header = document.getElementById('metlaHeader');
    const list = document.getElementById('metlaTargetsList');
    const stats = document.getElementById('metlaStats');

    if (!area) return;

    let targets = [];
    
    if (reportData?.report?.data && Array.isArray(reportData.report.data)) {
        targets = reportData.report.data;
    } else if (reportData?.data && Array.isArray(reportData.data)) {
        targets = reportData.data;
    } else if (reportData?.report && Array.isArray(reportData.report)) {
        targets = reportData.report;
    } else if (reportData?.targets && Array.isArray(reportData.targets)) {
        targets = reportData.targets;
    } else if (reportData?.results && Array.isArray(reportData.results)) {
        targets = reportData.results;
    } else if (Array.isArray(reportData)) {
        targets = reportData;
    }

    if (!targets || targets.length === 0) {
        if (empty) {
            empty.style.display = 'block';
            empty.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #6c757d;">
                    <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px; color: #dee2e6;"></i>
                    <h4 style="margin: 0; color: #495057;">No data to display</h4>
                    <p style="margin: 8px 0 0 0; font-size: 14px;">Try running the analysis again</p>
                </div>
            `;
        }
        if (header) header.style.display = 'none';
        if (list) list.style.display = 'none';
        if (stats) stats.style.display = 'none';
        if (area) area.classList.remove('has-targets');
        return;
    }

    if (empty) empty.style.display = 'none';
    if (header) header.style.display = 'flex';
    if (list) list.style.display = 'block';
    if (area) area.classList.add('has-targets');

    const total = targets.length;
    const auth = targets.filter(t => t.isAuth === true).length;
    const nonAuth = targets.filter(t => t.isAuth === false).length;
    
    const methods = {};
    targets.forEach(t => {
        const m = (t.method || 'GET').toUpperCase();
        methods[m] = (methods[m] || 0) + 1;
    });

    const uniquePaths = new Set();
    targets.forEach(t => {
        if (t.path) uniquePaths.add(t.path);
    });

    const statsData = reportData?.report?.stats || reportData?.stats || {};
    const totalRequests = statsData.totalRequests || targets.length;
    const uniqueEndpoints = statsData.uniqueEndpoints || uniquePaths.size;
    const formsFound = statsData.formsFound || targets.filter(t => t.bodySchema).length;

    if (stats) {
        stats.innerHTML = `
            <div style="display: flex; gap: 16px; flex-wrap: wrap; padding: 8px 0;">
                <div class="stat-item" style="font-size: 13px; color: #495057;">Total requests <strong style="color: #1a1a2e;">${totalRequests}</strong></div>
                <div class="stat-divider" style="width: 1px; background: #e9ecef;"></div>
                <div class="stat-item" style="font-size: 13px; color: #495057;">Unique endpoints <strong style="color: #1a1a2e;">${uniqueEndpoints}</strong></div>
                <div class="stat-divider" style="width: 1px; background: #e9ecef;"></div>
                <div class="stat-item" style="font-size: 13px; color: #495057;">Auth <strong style="color: #dc2626;">${auth}</strong></div>
                <div class="stat-item" style="font-size: 13px; color: #495057;">Public <strong style="color: #16a34a;">${nonAuth}</strong></div>
                <div class="stat-divider" style="width: 1px; background: #e9ecef;"></div>
                <div class="stat-item" style="font-size: 13px; color: #495057;">Forms <strong style="color: #1a1a2e;">${formsFound}</strong></div>
                ${Object.entries(methods).map(([method, count]) => `
                    <div class="stat-item" style="font-size: 13px; color: #495057;">${method} <strong style="color: #1a1a2e;">${count}</strong></div>
                `).join('')}
            </div>
        `;
        stats.style.display = 'block';
    }

    const methodColors = {
        GET: '#61affe',
        POST: '#49cc90',
        PUT: '#fca130',
        DELETE: '#f93e3e',
        PATCH: '#50e3c2',
        HEAD: '#9012fe',
        OPTIONS: '#0d5aa7',
        default: '#6c757d'
    };

    let html = '';
    targets.forEach((target, index) => {
        const method = (target.method || 'GET').toUpperCase();
        const color = methodColors[method] || methodColors.default;
        const isAuth = target.isAuth === true;
        const path = target.path || '/';
        const hasBody = target.body !== null && target.body !== undefined;

        html += `
            <div class="metla-item" data-index="${index}" 
                 style="border-bottom: 1px solid #f1f3f5; padding: 10px 12px; cursor: pointer; transition: background 0.15s;"
                 onmouseover="this.style.background='#f8f9fa'" 
                 onmouseout="this.style.background='white'"
                 onclick="openMetlaDetail(${index})">
                <div class="metla-row" style="display: flex; align-items: center; gap: 12px;">
                    <span class="metla-method" style="font-weight: 700; font-size: 12px; color: ${color}; min-width: 50px;">
                        ${method}
                    </span>
                    <span class="metla-path" style="font-family: 'Fira Code', monospace; font-size: 13px; color: #1a1a2e; flex: 1; word-break: break-all;">
                        ${escapeHtml(path)}
                        <span class="metla-badge ${isAuth ? 'auth' : 'public'}" 
                              style="display: inline-block; padding: 1px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; margin-left: 8px; 
                                     background: ${isAuth ? '#fee2e2' : '#dcfce7'}; 
                                     color: ${isAuth ? '#dc2626' : '#16a34a'};">
                            ${isAuth ? 'Auth' : 'Public'}
                        </span>
                        ${hasBody ? '<span style="font-size: 10px; color: #6c757d; margin-left: 8px;">body</span>' : ''}
                    </span>
                    <span style="font-size: 12px; color: #adb5bd;">&#9654;</span>
                </div>
            </div>
        `;
    });

    if (list) list.innerHTML = html;
    
    window._metlaTargetsData = { 
        report: targets,
        fullData: reportData 
    };
}

function openFuzzModal() {
    const modal = document.getElementById('fuzzModal');
    if (!modal) {
        console.warn('❌ fuzzModal not found');
        return;
    }
    
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0, 0, 0, 0.6)';
    modal.style.backdropFilter = 'blur(4px)';
    modal.style.zIndex = '10000';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    
    document.body.style.overflow = 'hidden';
    
    console.log('✅ Modal opened');
}

function closeFuzzModal() {
    const modal = document.getElementById('fuzzModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        console.log('✅ Modal closed');
    }
}

let currentMetlaTarget = null;

function openMetlaDetail(index) {
    const targets = window._metlaTargetsData?.report || [];
    const target = targets[index];
    if (!target) return;

    currentMetlaTarget = target;

    const method = (target.method || 'GET').toUpperCase();
    const methodColors = {
        GET: '#61affe',
        POST: '#49cc90',
        PUT: '#fca130',
        DELETE: '#f93e3e',
        PATCH: '#50e3c2',
        HEAD: '#9012fe',
        OPTIONS: '#0d5aa7',
        default: '#6c757d'
    };

    const isAuth = target.isAuth === true;
    const hasBody = target.body !== null && target.body !== undefined;
    const hasHeaders = target.headers && Object.keys(target.headers).length > 0;

    const methodEl = document.getElementById('metla-detail-method');
    if (methodEl) {
        methodEl.textContent = method;
        methodEl.style.color = methodColors[method] || methodColors.default;
        methodEl.style.background = (methodColors[method] || methodColors.default) + '20';
    }
    
    const pathEl = document.getElementById('metla-detail-path');
    if (pathEl) pathEl.textContent = target.path || '/';
    
    const authBadge = document.getElementById('metla-detail-auth-badge');
    if (authBadge) {
        authBadge.textContent = isAuth ? 'Auth' : 'Public';
        authBadge.className = 'metla-detail-auth-badge ' + (isAuth ? 'auth' : 'public');
    }

    const urlEl = document.getElementById('metla-detail-url');
    if (urlEl) urlEl.textContent = target.url || '-';
    
    const authEl = document.getElementById('metla-detail-auth');
    if (authEl) {
        authEl.textContent = isAuth ? 'Required' : 'Public';
        authEl.style.color = isAuth ? '#dc2626' : '#16a34a';
    }
    
    const contentTypeEl = document.getElementById('metla-detail-content-type');
    if (contentTypeEl) contentTypeEl.textContent = target.contentType || '-';
    
    const serverEl = document.getElementById('metla-detail-server');
    if (serverEl) serverEl.textContent = target.server || '-';

    const headersContent = document.getElementById('metla-detail-headers-content');
    if (headersContent) {
        if (hasHeaders) {
            headersContent.innerHTML = Object.entries(target.headers)
                .map(([k, v]) => `<span style="color: #61affe;">${escapeHtml(k)}</span>: ${escapeHtml(v)}`)
                .join('\n');
        } else {
            headersContent.innerHTML = '<span class="metla-detail-empty" style="color: #6c757d;">No headers</span>';
        }
    }

    const bodyContent = document.getElementById('metla-detail-body-content');
    if (bodyContent) {
        if (hasBody) {
            bodyContent.textContent = target.body;
        } else {
            bodyContent.innerHTML = '<span class="metla-detail-empty" style="color: #6c757d;">No request body</span>';
        }
    }

    const schemaContent = document.getElementById('metla-detail-schema-content');
    if (schemaContent) {
        if (target.bodySchema) {
            schemaContent.textContent = JSON.stringify(target.bodySchema, null, 2);
        } else {
            schemaContent.innerHTML = '<span class="metla-detail-empty" style="color: #6c757d;">No schema</span>';
        }
    }

    switchMetlaTab('details');

    const modal = document.getElementById('metlaDetailModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function switchMetlaTab(tabId) {
    document.querySelectorAll('.metla-detail-panel').forEach(panel => {
        panel.style.display = 'none';
        panel.classList.remove('active');
    });

    const panel = document.getElementById('panel-' + tabId);
    if (panel) {
        panel.style.display = 'block';
        panel.classList.add('active');
    }

    document.querySelectorAll('.metla-detail-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabId) {
            tab.classList.add('active');
        }
    });
}

function closeMetlaDetail() {
    const modal = document.getElementById('metlaDetailModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    currentMetlaTarget = null;
}

function copyMetlaRequest() {
    if (!currentMetlaTarget) return;
    
    const method = (currentMetlaTarget.method || 'GET').toUpperCase();
    const url = currentMetlaTarget.url || '';
    const body = currentMetlaTarget.body || '';
    
    let request = `${method} ${url}\n`;
    if (currentMetlaTarget.headers) {
        Object.entries(currentMetlaTarget.headers).forEach(([k, v]) => {
            request += `${k}: ${v}\n`;
        });
    }
    if (body) {
        request += '\n' + body;
    }
    
    navigator.clipboard.writeText(request).then(() => {
        showToast('Copied', 'Request copied to clipboard', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = request;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied', 'Request copied to clipboard', 'success');
    });
}

function exportMetlaRequest(format) {
    if (!currentMetlaTarget) return;
    
    const method = (currentMetlaTarget.method || 'GET').toUpperCase();
    const url = currentMetlaTarget.url || '';
    const headers = currentMetlaTarget.headers || {};
    const body = currentMetlaTarget.body || '';
    
    let output = '';
    
    switch(format) {
        case 'curl':
            output = `curl -X ${method} "${url}"`;
            Object.entries(headers).forEach(([k, v]) => {
                output += ` \\\n  -H "${k}: ${v}"`;
            });
            if (body) {
                output += ` \\\n  -d '${body}'`;
            }
            break;
            
        case 'postman':
            output = JSON.stringify({
                method: method,
                header: Object.entries(headers).map(([k, v]) => ({ key: k, value: v })),
                body: body ? { mode: 'raw', raw: body } : undefined,
                url: url
            }, null, 2);
            break;
            
        case 'fetch':
            const headersStr = Object.entries(headers).map(([k, v]) => `    "${k}": "${v}"`).join(',\n');
            output = `fetch("${url}", {\n  method: "${method}",\n  headers: {\n${headersStr}\n  }${body ? `,\n  body: \`${body}\`` : ''}\n});`;
            break;
            
        case 'python':
            output = `import requests\n\nresponse = requests.${method.toLowerCase()}("${url}"`;
            if (Object.keys(headers).length > 0) {
                output += `,\n    headers=${JSON.stringify(headers, null, 2)}`;
            }
            if (body) {
                output += `,\n    data="${body}"`;
            }
            output += '\n)';
            break;
    }
    
    navigator.clipboard.writeText(output).then(() => {
        showToast('Exported', `Exported as ${format.toUpperCase()}`, 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = output;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Exported', `Exported as ${format.toUpperCase()}`, 'success');
    });
}

function saveMetlaRequest() {
    if (!currentMetlaTarget) return;
    
    const saved = JSON.parse(localStorage.getItem('metlaSavedRequests') || '[]');
    saved.push({
        ...currentMetlaTarget,
        savedAt: new Date().toISOString()
    });
    localStorage.setItem('metlaSavedRequests', JSON.stringify(saved));
    
    showToast('Saved', 'Request saved to favorites', 'success');
}

function runMetlaAnalysis() {
    if (!currentMetlaTarget) return;
    
    const type = document.getElementById('metlaAnalysisType')?.value || 'full';
    const typeLabels = {
        xss: 'XSS',
        sql: 'SQL Injection',
        headers: 'Headers',
        bruteforce: 'Bruteforce',
        full: 'Full'
    };
    
    showToast('Analysis started', `Started ${typeLabels[type] || 'Full'} analysis for ${currentMetlaTarget.path}`, 'info');
    
    console.log('Analysis started:', {
        target: currentMetlaTarget,
        type: type
    });
}

function getSelectedMetlaTargets() {
    const checkboxes = document.querySelectorAll('.metla-checkbox:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
}

function clearMetlaTargets() {
    const area = document.getElementById('metlaTargetsArea');
    const empty = document.getElementById('metlaEmpty');
    const header = document.getElementById('metlaHeader');
    const list = document.getElementById('metlaTargetsList');
    const stats = document.getElementById('metlaStats');
    
    if (empty) empty.style.display = 'block';
    if (header) header.style.display = 'none';
    if (list) {
        list.style.display = 'none';
        list.innerHTML = '';
    }
    if (stats) stats.style.display = 'none';
    if (area) area.classList.remove('has-targets');
}

function showToast(title, message, type = 'info') {
    let container = document.getElementById('metlaToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'metlaToastContainer';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-width: 360px;
        `;
        document.body.appendChild(container);
    }
    
    const colors = {
        info: { bg: '#667eea', icon: 'fa-info-circle' },
        success: { bg: '#28a745', icon: 'fa-check-circle' },
        warning: { bg: '#fca130', icon: 'fa-exclamation-triangle' },
        error: { bg: '#dc3545', icon: 'fa-times-circle' }
    };
    
    const color = colors[type] || colors.info;
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: white;
        border-left: 4px solid ${color.bg};
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.3s ease;
    `;
    
    toast.innerHTML = `
        <div style="font-size: 18px; color: ${color.bg}; flex-shrink: 0;">
            <i class="fas ${color.icon}"></i>
        </div>
        <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 13px; color: #1a1a2e; font-family: 'Fira Sans', 'Fira Code', sans-serif;">${escapeHtml(title)}</div>
            <div style="font-size: 12px; color: #6c757d; font-family: 'Fira Sans', 'Fira Code', sans-serif;">${escapeHtml(message)}</div>
        </div>
        <button onclick="this.parentElement.remove()" style="border: none; background: none; cursor: pointer; color: #adb5bd; font-size: 14px; flex-shrink: 0;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeMetlaDetail();
        closeFuzzModal();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const fuzzModal = document.getElementById('fuzzModal');
    if (fuzzModal) {
        fuzzModal.addEventListener('click', function(e) {
            if (e.target === fuzzModal) {
                closeFuzzModal();
            }
        });
    }
    
    const metlaModal = document.getElementById('metlaDetailModal');
    if (metlaModal) {
        metlaModal.addEventListener('click', function(e) {
            if (e.target === metlaModal) {
                closeMetlaDetail();
            }
        });
    }
});

window.displayResults = displayResults;
window.renderMetlaTargets = renderMetlaTargets;
window.openFuzzModal = openFuzzModal;
window.closeFuzzModal = closeFuzzModal;
window.openMetlaDetail = openMetlaDetail;
window.closeMetlaDetail = closeMetlaDetail;
window.switchMetlaTab = switchMetlaTab;
window.copyMetlaRequest = copyMetlaRequest;
window.exportMetlaRequest = exportMetlaRequest;
window.saveMetlaRequest = saveMetlaRequest;
window.runMetlaAnalysis = runMetlaAnalysis;
window.filterVulnerabilities = filterVulnerabilities;
window.toggleVulnDetail = toggleVulnDetail;
window.showToast = showToast;
window.getSelectedMetlaTargets = getSelectedMetlaTargets;
window.clearMetlaTargets = clearMetlaTargets;
window.escapeHtml = escapeHtml;