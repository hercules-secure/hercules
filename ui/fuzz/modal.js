// modal.js

function renderVulnerabilitiesTable(vulnerabilities) {
    if (!vulnerabilities || vulnerabilities.length === 0) return '';
    
    // ============================================================
    // ЦВЕТА HTTP МЕТОДОВ (как в Swagger)
    // ============================================================
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
    
    // Подсчет количества по severity
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const vuln of vulnerabilities) {
        const sev = (vuln.severity || 'info').toLowerCase();
        if (severityCounts[sev] !== undefined) severityCounts[sev]++;
    }
    
    // Фильтры
    let html = `
        <div style="margin: 24px 0 16px 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <h4 style="margin: 0; font-size: 15px; color: #1a1a2e;">Найденные уязвимости</h4>
            <div style="display: flex; gap: 6px; margin-left: auto; flex-wrap: wrap;">
                <button class="severity-filter-btn active" data-filter="all" onclick="filterVulnerabilities('all')" style="padding: 4px 12px; border: 1px solid #dee2e6; border-radius: 16px; background: #667eea; color: white; cursor: pointer; font-size: 12px; font-family: Ubuntu; transition: all 0.2s;">
                    Все</span>
                </button>
                ${Object.entries(severityCounts).filter(([_, count]) => count > 0).map(([sev, count]) => `
                    <button class="severity-filter-btn" data-filter="${sev}" onclick="filterVulnerabilities('${sev}')" style="padding: 4px 12px; border: 1px solid ${severityColors[sev].bg}; border-radius: 16px; background: transparent; color: ${severityColors[sev].bg}; cursor: pointer; font-size: 12px; font-family: Ubuntu; transition: all 0.2s; font-weight: 500;">
                        ${severityColors[sev].label} <span style="font-weight: 600;"></span>
                    </button>
                `).join('')}
            </div>
        </div>
        <div style="overflow-x: auto; border-radius: 12px; border: 1px solid #e9ecef;">
            <table class="results-table" style="width: 100%; border-collapse: collapse; font-size: 14px; background: white; border-radius: 12px; overflow: hidden;">
                <thead>
                    <tr style="background: #f8f9fa; border-bottom: 2px solid #e9ecef;">
                        <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #495057; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Метод</th>
                        <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #495057; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Тип</th>
                        <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #495057; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Severity</th>
                        <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #495057; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Эндпоинт</th>
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
                <td style="padding: 12px 16px; font-weight: 500; color: #1a1a2e;font-size: 11px; ">${escapeHtml(vuln.type || 'Unknown')}</td>
                <td style="padding: 12px 16px;">
                    <span class="severity-badge" style="display: inline-block; padding: 2px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; background: ${sColor.bg}; color: ${sColor.text};">
                        ${(vuln.severity || 'INFO').toUpperCase()}
                    </span>
                </td>
                <td style="padding: 12px 16px; font-family: monospace; font-size: 13px; color: #495057;">
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
                                <strong style="color: #856404;">Детали:</strong>
                                <span style="color: #856404;">${escapeHtml(vuln.snippet)}</span>
                            </div>
                            ` : ''}
                            ${vuln.payload ? `
                            <div style="grid-column: 1 / -1;">
                                <strong style="color: #495057;">Payload:</strong>
                                <code style="display: inline-block; margin-top: 4px; background: #1a1a2e; color: #e9ecef; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-family: 'SF Mono', 'Fira Code', monospace; word-break: break-all; max-width: 100%;">
                                    ${escapeHtml(vuln.payload)}
                                </code>
                            </div>
                            ` : ''}
                            ${vuln.response_status ? `
                            <div>
                                <strong style="color: #495057;">Статус ответа:</strong>
                                <span style="font-weight: 600; ${vuln.response_status >= 200 && vuln.response_status < 300 ? 'color: #28a745;' : vuln.response_status >= 400 && vuln.response_status < 500 ? 'color: #fd7e14;' : vuln.response_status >= 500 ? 'color: #dc3545;' : 'color: #6c757d;'}">
                                    ${vuln.response_status}
                                </span>
                            </div>
                            ` : ''}
                            ${vuln.category ? `
                            <div>
                                <strong style="color: #495057;">Категория:</strong>
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
    
    // Обновляем активную кнопку
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
    
    // Фильтруем строки
    rows.forEach(row => {
        const severity = row.getAttribute('data-severity');
        if (filter === 'all' || severity === filter) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// ============================================================
// ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ
// ============================================================

function displayResults(report) {
    const modalBody = document.getElementById('fuzzModalBody');
    if (!modalBody) return;
    
    const vulnerabilities = report.vulnerabilities || [];
    
    // Подсчет severity
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
        <!-- Плашки по severity -->
        <div class="fuzz-severity-grid">
            <div class="fuzz-severity-card critical">
                <div class="fuzz-severity-number">${critical}</div>
                <div class="fuzz-severity-label">Critical</div>
            </div>
            <div class="fuzz-severity-card high">
                <div class="fuzz-severity-number">${high}</div>
                <div class="fuzz-severity-label">High</div>
            </div>
            <div class="fuzz-severity-card medium">
                <div class="fuzz-severity-number">${medium}</div>
                <div class="fuzz-severity-label">Medium</div>
            </div>
            <div class="fuzz-severity-card low">
                <div class="fuzz-severity-number">${low}</div>
                <div class="fuzz-severity-label">Low</div>
            </div>
            <div class="fuzz-severity-card info">
                <div class="fuzz-severity-number">${info}</div>
                <div class="fuzz-severity-label">Info</div>
            </div>
        </div>
        
        ${vulnCount > 0 ? renderVulnerabilitiesTable(vulnerabilities) : '<div class="no-vulnerabilities"><i class="fas fa-check-circle"></i><h4>Уязвимостей не найдено</h4></div>'}
    `;
    
    openFuzzModal();
}