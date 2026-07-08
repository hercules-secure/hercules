// modal.js

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

        function renderMetlaTargets(reportData) {
            const area = document.getElementById('metlaTargetsArea');
            const empty = document.getElementById('metlaEmpty');
            const header = document.getElementById('metlaHeader');
            const list = document.getElementById('metlaTargetsList');
            const stats = document.getElementById('metlaStats');

            if (!reportData || !reportData.report || !Array.isArray(reportData.report) || reportData.report.length === 0) {
                empty.style.display = 'block';
                header.style.display = 'none';
                list.style.display = 'none';
                stats.style.display = 'none';
                area.classList.remove('has-targets');
                return;
            }

            const targets = reportData.report;
            empty.style.display = 'none';
            header.style.display = 'flex';
            list.style.display = 'block';
            area.classList.add('has-targets');

            // Статистика
            const total = targets.length;
            const auth = targets.filter(t => t.isAuth === true).length;
            const nonAuth = targets.filter(t => t.isAuth === false).length;
            const methods = {};
            targets.forEach(t => {
                const m = (t.method || 'GET').toUpperCase();
                methods[m] = (methods[m] || 0) + 1;
            });
/*
                <div class="stat-divider"></div>
                // <div class="stat-item"><strong>${auth}</strong></div>
                // <div class="stat-item"><strong>${nonAuth}</strong></div>
                // ${Object.entries(methods).map(([method, count]) => `
                //     <div class="stat-item">${method} <strong>${count}</strong></div>
                // `).join('')}


*/
            stats.innerHTML = `
                <div class="stat-item">Всего <strong>${total}</strong></div>
            `;
            stats.style.display = 'flex';

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

                html += `
                    <div class="metla-item" data-index="${index}">
                        <div class="metla-row" onclick="openMetlaDetail(${index})">
                            <span class="metla-method" style="color: ${color}">${method}</span>
                            <span class="metla-path">${path} <span class="metla-badge ${isAuth ? 'auth' : 'public'}">${isAuth ? 'Auth' : 'Public'}</span></span>
                            
                        </div>
                    </div>
                `;
            });

            list.innerHTML = html;
            window._metlaTargetsData = reportData;
        }

        function openMetlaDetail(index) {
            const targets = window._metlaTargetsData?.report || [];
            const target = targets[index];
            if (!target) return;

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

            const hasBody = target.body !== null && target.body !== undefined;
            const hasHeaders = target.headers && Object.keys(target.headers).length > 0;

            document.getElementById('metla-detail-method').textContent = method;
            document.getElementById('metla-detail-method').style.color = methodColors[method] || methodColors.default;
            document.getElementById('metla-detail-path').textContent = target.path || '/';
            document.getElementById('metla-detail-url').textContent = target.url || '-';
            document.getElementById('metla-detail-auth').textContent = target.isAuth ? 'Требуется' : 'Публичный';
            document.getElementById('metla-detail-auth').style.color = target.isAuth ? '#dc2626' : '#16a34a';

            // Заголовки
            const headersSection = document.getElementById('metla-detail-headers');
            const headersContent = document.getElementById('metla-detail-headers-content');
            if (hasHeaders) {
                headersSection.style.display = 'block';
                headersContent.textContent = Object.entries(target.headers)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n');
            } else {
                headersSection.style.display = 'none';
            }

            // Тело
            const bodySection = document.getElementById('metla-detail-body-section');
            const bodyContent = document.getElementById('metla-detail-body-content');
            if (hasBody) {
                bodySection.style.display = 'block';
                bodyContent.textContent = target.body;
            } else {
                bodySection.style.display = 'none';
            }

            // Схема
            const schemaSection = document.getElementById('metla-detail-schema');
            const schemaContent = document.getElementById('metla-detail-schema-content');
            if (target.bodySchema) {
                schemaSection.style.display = 'block';
                schemaContent.textContent = JSON.stringify(target.bodySchema, null, 2);
            } else {
                schemaSection.style.display = 'none';
            }

            document.getElementById('metlaDetailModal').style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }

        function closeMetlaDetail() {
            document.getElementById('metlaDetailModal').style.display = 'none';
            document.body.style.overflow = '';
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeMetlaDetail();
            }
        });

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
            
            empty.style.display = 'block';
            header.style.display = 'none';
            list.style.display = 'none';
            list.innerHTML = '';
            stats.style.display = 'none';
            area.classList.remove('has-targets');
        }

        // ============================================================
// ФУНКЦИИ ДЛЯ МОДАЛЬНОГО ОКНА МЕТЛЫ (Swagger/Postman стиль)
// ============================================================

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

    // Заполняем хедер
    const methodEl = document.getElementById('metla-detail-method');
    methodEl.textContent = method;
    methodEl.style.color = methodColors[method] || methodColors.default;
    methodEl.style.background = (methodColors[method] || methodColors.default) + '20';
    
    document.getElementById('metla-detail-path').textContent = target.path || '/';
    
    const authBadge = document.getElementById('metla-detail-auth-badge');
    authBadge.textContent = isAuth ? 'Auth' : 'Public';
    authBadge.className = 'metla-detail-auth-badge ' + (isAuth ? 'auth' : 'public');

    // Заполняем детали
    document.getElementById('metla-detail-url').textContent = target.url || '-';
    document.getElementById('metla-detail-auth').textContent = isAuth ? 'Требуется' : 'Публичный';
    document.getElementById('metla-detail-auth').style.color = isAuth ? '#dc2626' : '#16a34a';
    document.getElementById('metla-detail-content-type').textContent = target.contentType || '-';
    document.getElementById('metla-detail-server').textContent = target.server || '-';

    // Заголовки
    const headersContent = document.getElementById('metla-detail-headers-content');
    if (hasHeaders) {
        headersContent.innerHTML = Object.entries(target.headers)
            .map(([k, v]) => `<span style="color: #61affe;">${k}</span>: ${v}`)
            .join('\n');
    } else {
        headersContent.innerHTML = '<span class="metla-detail-empty">Нет заголовков</span>';
    }

    // Тело
    const bodyContent = document.getElementById('metla-detail-body-content');
    if (hasBody) {
        bodyContent.textContent = target.body;
    } else {
        bodyContent.innerHTML = '<span class="metla-detail-empty">Нет тела запроса</span>';
    }

    // Схема
    const schemaContent = document.getElementById('metla-detail-schema-content');
    if (target.bodySchema) {
        schemaContent.textContent = JSON.stringify(target.bodySchema, null, 2);
    } else {
        schemaContent.innerHTML = '<span class="metla-detail-empty">Нет схемы</span>';
    }

    // Показываем первую вкладку
    switchMetlaTab('details');

    document.getElementById('metlaDetailModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function switchMetlaTab(tabId) {
    // Скрываем все панели
    document.querySelectorAll('.metla-detail-panel').forEach(panel => {
        panel.style.display = 'none';
        panel.classList.remove('active');
    });

    // Показываем выбранную
    const panel = document.getElementById('panel-' + tabId);
    if (panel) {
        panel.style.display = 'block';
        panel.classList.add('active');
    }

    // Обновляем табы
    document.querySelectorAll('.metla-detail-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabId) {
            tab.classList.add('active');
        }
    });
}

function closeMetlaDetail() {
    document.getElementById('metlaDetailModal').style.display = 'none';
    document.body.style.overflow = '';
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
        showToast('Скопировано', 'Запрос скопирован в буфер обмена', 'success');
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = request;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Скопировано', 'Запрос скопирован в буфер обмена', 'success');
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
    
    // Копируем в буфер
    navigator.clipboard.writeText(output).then(() => {
        showToast('Экспортировано', `Экспорт в ${format.toUpperCase()} выполнен`, 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = output;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Экспортировано', `Экспорт в ${format.toUpperCase()} выполнен`, 'success');
    });
}

function saveMetlaRequest() {
    if (!currentMetlaTarget) return;
    
    // Сохраняем в localStorage
    const saved = JSON.parse(localStorage.getItem('metlaSavedRequests') || '[]');
    saved.push({
        ...currentMetlaTarget,
        savedAt: new Date().toISOString()
    });
    localStorage.setItem('metlaSavedRequests', JSON.stringify(saved));
    
    showToast('Сохранено', 'Запрос сохранен в избранное', 'success');
}

function runMetlaAnalysis() {
    if (!currentMetlaTarget) return;
    
    const type = document.getElementById('metlaAnalysisType').value;
    const typeLabels = {
        xss: 'XSS',
        sql: 'SQL Injection',
        headers: 'Заголовки',
        bruteforce: 'Брутфорс',
        full: 'Полный'
    };
    
    showToast('Запуск анализа', `Запущен ${typeLabels[type]} анализ для ${currentMetlaTarget.path}`, 'info');
    
    // Здесь можно вызвать API для запуска анализа
    console.log('Запуск анализа:', {
        target: currentMetlaTarget,
        type: type
    });
}

// Закрытие по Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeMetlaDetail();
    }
});

// Toast уведомление
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
            <div style="font-weight: 600; font-size: 13px; color: #1a1a2e; font-family: 'Ubuntu', sans-serif;">${title}</div>
            <div style="font-size: 12px; color: #6c757d; font-family: 'Ubuntu', sans-serif;">${message}</div>
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