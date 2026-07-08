/* следующий кто будет это поддерживать - просто дописывай в конец файла - будь спокоен не ругайся */
/* не смотри на количество строк - просто отнесись к этому филосовски */

// Функция для скачивания JSON отчета
function downloadJSONReport(result) {
    try {
        const reportData = JSON.stringify(result, null, 2);
        const blob = new Blob([reportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scout-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (typeof showToolNotification === 'function') {
            showToolNotification('JSON отчет успешно скачан', 'success');
        }
    } catch (error) {
        if (typeof showToolNotification === 'function') {
            showToolNotification('Ошибка при скачивании JSON отчета', 'error');
        }
    }
}

// Функция для скачивания HTML отчета
function downloadScoutHTMLReport(result) {
    try {
        const defaultName = `scout-report-${new Date().toISOString().split('T')[0]}`;
        let reportName = prompt('Введите имя отчета:', defaultName);
        if (reportName === null) return;
        if (reportName.trim() === '') reportName = defaultName;
        reportName = reportName.trim().replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
        
        const htmlContent = generateScoutFullHTMLReport(result);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportName}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (typeof showToolNotification === 'function') {
            showToolNotification(`HTML отчет "${reportName}.html" успешно скачан`, 'success');
        }
    } catch (error) {
        if (typeof showToolNotification === 'function') {
            showToolNotification('Ошибка при скачивании HTML отчета', 'error');
        }
    }
}

// Функция для группировки путей по типу
function groupPathsByType(paths, baseUrl) {
    const groups = {
        subdomains: new Map(),
        directories: [],
        files: [],
        api: [],
        admin: [],
        other: []
    };
    
    paths.forEach(item => {
        const path = item.path || '';
        const lowerPath = path.toLowerCase();
        
        // Сначала проверяем API - они не должны попадать в другие категории
        if (lowerPath.includes('/api/') || lowerPath.startsWith('/api')) {
            groups.api.push(item);
        } 
        // Потом админки
        else if (lowerPath.includes('/admin') || lowerPath.includes('/administrator') || lowerPath.includes('/wp-admin') || lowerPath.includes('/cp') || lowerPath.includes('/manager')) {
            groups.admin.push(item);
        } 
        // Потом файлы
        else if (path.includes('.') && !path.endsWith('/')) {
            const ext = path.split('.').pop();
            if (['php', 'asp', 'aspx', 'jsp', 'do', 'action', 'py', 'rb', 'pl', 'cgi', 'html', 'htm', 'xml', 'json', 'txt', 'log', 'bak', 'sql', 'zip', 'tar', 'gz', 'rar', '7z'].includes(ext.toLowerCase())) {
                groups.files.push(item);
            } else {
                groups.other.push(item);
            }
        } 
        // Потом директории
        else if (path !== '/' && path !== '' && !path.includes('.')) {
            groups.directories.push(item);
        } 
        else {
            groups.other.push(item);
        }
    });
    
    return groups;
}

// Функция для генерации HTML отчета
function generateScoutFullHTMLReport(result) {
    const summary = result.summary || { critical: 0, high: 0, medium: 0, low: 0 };
    const accessiblePaths = result.accessiblePaths || [];
    const findings = result.findings || {};
    const tech = findings.tech || {};
    const secrets = findings.secrets || {};
    const quality = findings.quality || {};
    const wcag = findings.wcag || {};
    const mobile = findings.mobile || {};
    const performance = findings.performance || {};
    const subdomainsData = findings.subdomains || {};
    const apiFromJS = findings.apiFromJS || {};
    const headers = findings.headers || {};
    const cookies = findings.cookies || {};
    const ssl = findings.ssl || {};
    const ports = findings.ports || {};
    const robots = findings.robots || {};
    const sitemap = findings.sitemap || {};
    const links = findings.links || {};
    const dom = findings.dom || [];
    
    // Получаем отдельные списки субдоменов и IP из новой структуры
    const subdomainsList = subdomainsData.subdomains || [];
    const ipsList = subdomainsData.ips || [];
    
    const riskColors = {
        critical: '#dc3545',
        high: '#fd7e14',
        medium: '#ffc107',
        low: '#28a745',
        info: '#6c757d'
    };
    
    const riskNames = {
        critical: 'Критический',
        high: 'Высокий',
        medium: 'Средний',
        low: 'Низкий',
        info: 'Информационный'
    };
    
    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    
    const baseUrl = result.target || '';
    const reportDate = new Date(result.timestamp || Date.now()).toLocaleString('ru-RU');
    
    // Группировка путей
    function groupPathsByType(paths) {
        const groups = {
            subdomains: new Map(),
            directories: [],
            files: [],
            api: [],
            admin: [],
            other: []
        };
        
        if (!paths) return groups;
        
        paths.forEach(item => {
            const path = item.path || '';
            const lowerPath = path.toLowerCase();
            
            if (lowerPath.includes('/api/') || lowerPath.startsWith('/api')) {
                groups.api.push(item);
            } 
            else if (lowerPath.includes('/admin') || lowerPath.includes('/administrator') || lowerPath.includes('/wp-admin') || lowerPath.includes('/cp') || lowerPath.includes('/manager')) {
                groups.admin.push(item);
            } 
            else if (path.includes('.') && !path.endsWith('/')) {
                const ext = path.split('.').pop();
                if (['php', 'asp', 'aspx', 'jsp', 'do', 'action', 'py', 'rb', 'pl', 'cgi', 'html', 'htm', 'xml', 'json', 'txt', 'log', 'bak', 'sql', 'zip', 'tar', 'gz', 'rar', '7z'].includes(ext.toLowerCase())) {
                    groups.files.push(item);
                } else {
                    groups.other.push(item);
                }
            } 
            else if (path !== '/' && path !== '' && !path.includes('.')) {
                groups.directories.push(item);
            } 
            else {
                groups.other.push(item);
            }
        });
        
        return groups;
    }
    
    const groups = groupPathsByType(accessiblePaths);
    
    // Таблица субдоменов (с заголовками и статусами)
    const subdomainsTable = () => {
        if (subdomainsList.length === 0) {
            return '<div class="empty-state">Субдомены не обнаружены</div>';
        }
        
        const rows = subdomainsList.map((s, idx) => {
            const statusColor = s.status === '200' ? '#28a745' : (s.status === '302' ? '#ffc107' : (s.status === '404' ? '#dc3545' : '#6c757d'));
            const statusLabel = s.status || 'unknown';
            
            return `
                <tr>
                    <td class="index-cell">${idx + 1}</td>
                    <td><a href="${s.url || 'https://' + s.domain}" target="_blank">${escapeHtml(s.domain)}</a></td>
                    <td>${s.ip || '—'}</td>
                    <td><span class="status-badge" style="background:${statusColor}; color:white; padding:2px 10px; border-radius:4px; font-size:11px;">${statusLabel}</span></td>
                    <td style="font-size:11px; color:#666;">${escapeHtml(s.title || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="subdomainsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Субдомен</th><th>IP адрес</th><th>Статус</th><th>Заголовок</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего субдоменов: ${subdomainsList.length}</div>
        `;
    };
    
    // Таблица IP адресов
    const ipsTable = () => {
        if (ipsList.length === 0) {
            return '<div class="empty-state">IP адреса не обнаружены</div>';
        }
        
        const rows = ipsList.map((item, idx) => {
            return `
                <tr>
                    <td class="index-cell">${idx + 1}</td>
                    <td><code>${escapeHtml(item.ip)}</code></td>
                    <td>${escapeHtml(item.domain || '—')}</td>
                    <td><span class="status-badge" style="background:${item.status === '200' ? '#28a745' : (item.status === '302' ? '#ffc107' : (item.status === '404' ? '#dc3545' : '#6c757d'))}; color:white; padding:2px 10px; border-radius:4px; font-size:11px;">${item.status || 'unknown'}</span></td>
                    <td>${escapeHtml(item.source || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="ipsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>IP адрес</th><th>Домен</th><th>Статус</th><th>Источник</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего IP адресов: ${ipsList.length}</div>
        `;
    };
    
    // Таблица API из JS файлов
    const apiFromJSTable = () => {
        if (!apiFromJS.apiEndpoints || apiFromJS.apiEndpoints.length === 0) {
            return '<div class="empty-state">API вызовы в JS файлах не обнаружены</div>';
        }
        
        const rows = apiFromJS.apiEndpoints.slice(0, 100).map((api, idx) => {
            const methodClass = api.method === 'GET' ? 'method-get' : (api.method === 'POST' ? 'method-post' : (api.method === 'PUT' ? 'method-put' : 'method-other'));
            return `
                <tr>
                    <td class="index-cell">${idx + 1}</td>
                    <td class="truncate"><a href="${escapeHtml(api.url)}" target="_blank" rel="noopener">${escapeHtml(api.url.length > 60 ? api.url.substring(0, 60) + '...' : api.url)}</a></td>
                    <td style="text-align:center"><span class="method-badge ${methodClass}">${api.method}</span></td>
                    <td>${escapeHtml(api.sourceFile || api.source || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <div class="api-stats-info">Всего найдено API вызовов: ${apiFromJS.totalEndpointsFound || apiFromJS.apiEndpoints.length} | Проанализировано JS файлов: ${apiFromJS.jsFilesAnalyzed?.length || 0}</div>
            <table class="data-table sortable" id="apiJsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>URL эндпоинта</th><th style="width:80px">Метод</th><th>Источник</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            ${apiFromJS.apiEndpoints.length > 100 ? '<div class="more-info">... и еще ' + (apiFromJS.apiEndpoints.length - 100) + ' записей</div>' : ''}
        `;
    };
    
    // Таблица директорий
    const directoriesTable = () => {
        if (groups.directories.length === 0 && groups.admin.length === 0) {
            return '<div class="empty-state">Директории не обнаружены</div>';
        }
        
        const allDirs = [...groups.directories, ...groups.admin];
        const rows = allDirs.map((item, idx) => {
            const risk = item.risk || 'info';
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td><code>${escapeHtml(item.path)}</code></td>
                    <td style="text-align:center">${item.status || '?'}</td>
                    <td><span class="risk-badge" style="background:${riskColors[risk]}">${riskNames[risk]}</span></td>
                    <td class="truncate">${escapeHtml(item.recommendation || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="dirsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Путь</th><th style="width:80px">HTTP</th><th style="width:100px">Риск</th><th>Описание</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };
    
    // Таблица API эндпоинтов
    const apiTable = () => {
        if (groups.api.length === 0) {
            return '<div class="empty-state">API эндпоинты не обнаружены</div>';
        }
        
        const rows = groups.api.map((item, idx) => {
            const risk = item.risk || 'info';
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td><code>${escapeHtml(item.path)}</code></td>
                    <td style="text-align:center">${item.status || '?'}</td>
                    <td><span class="risk-badge" style="background:${riskColors[risk]}">${riskNames[risk]}</span></td>
                    <td class="truncate">${escapeHtml(item.recommendation || 'API эндпоинт')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="apiTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>API путь</th><th style="width:80px">HTTP</th><th style="width:100px">Риск</th><th>Описание</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };
    
    // Таблица файлов
    const filesTable = () => {
        if (groups.files.length === 0) {
            return '<div class="empty-state">Файлы не обнаружены</div>';
        }
        
        const rows = groups.files.map((item, idx) => {
            const risk = item.risk || 'info';
            const fileName = item.path.split('/').pop();
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td><code>${escapeHtml(fileName)}</code></td>
                    <td style="text-align:center">${item.status || '?'}</td>
                    <td><span class="risk-badge" style="background:${riskColors[risk]}">${riskNames[risk]}</span></td>
                    <td class="truncate">${escapeHtml(item.recommendation || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="filesTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Файл</th><th style="width:80px">HTTP</th><th style="width:100px">Риск</th><th>Описание</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };
    
    // Таблица всех путей
    const allPathsTable = () => {
        if (accessiblePaths.length === 0) {
            return '<div class="empty-state">Пути не обнаружены</div>';
        }
        
        const rows = accessiblePaths.map((item, idx) => {
            const risk = item.risk || 'info';
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td><code>${escapeHtml(item.path)}</code></td>
                    <td style="text-align:center">${item.status || '?'}</td>
                    <td><span class="risk-badge" style="background:${riskColors[risk]}">${riskNames[risk]}</span></td>
                    <td class="truncate">${escapeHtml(item.recommendation || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="allPathsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Путь</th><th style="width:80px">HTTP</th><th style="width:100px">Риск</th><th>Описание</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };
    
    // Таблица проблем безопасности
    const securityTable = () => {
        let html = '';
        
        if (headers.issues && headers.issues.length > 0) {
            html += '<div class="issues-header">Заголовки безопасности</div>';
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Проблема</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${headers.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(issue.message)}${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}</td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        if (cookies.issues && cookies.issues.length > 0) {
            html += '<div class="issues-header">Cookies безопасность</div>';
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Проблема</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${cookies.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(issue.message)}${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}</td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        if (ssl.issues && ssl.issues.length > 0) {
            html += '<div class="issues-header">SSL/TLS</div>';
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Проблема</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${ssl.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(issue.message)}${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}</td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        if (ports.issues && ports.issues.length > 0) {
            html += '<div class="issues-header">Открытые порты</div>';
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Порт</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${ports.issues.map((port, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(port.message)}</td>
                                <td class="risk-cell risk-${port.severity}">${riskNames[port.severity] || 'Низкий'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        if (html === '') {
            return '<div class="empty-state">Проблем безопасности не обнаружено</div>';
        }
        
        return html;
    };
    
    // Таблица структуры
    const structureTable = () => {
        let html = '';
        
        html += '<div class="issues-header">robots.txt</div>';
        if (!robots.exists && robots.issues && robots.issues.length > 0) {
            html += '<div class="empty-state">robots.txt не найден</div>';
        } else if (robots.disallowed && robots.disallowed.length > 0) {
            html += `<div class="stats-info">Всего запрещенных путей: ${robots.disallowed.length}</div>`;
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Запрещенный путь</th></tr></thead>
                    <tbody>
                        ${robots.disallowed.slice(0, 50).map((path, idx) => `
                            <tr><td class="index-cell">${idx + 1}</td><td><code>${escapeHtml(path)}</code></td></tr>
                        `).join('')}
                    </tbody>
                </table>
                ${robots.disallowed.length > 50 ? `<div class="more-info">... и еще ${robots.disallowed.length - 50} записей</div>` : ''}
            `;
        } else {
            html += '<div class="empty-state">Запрещенных путей не обнаружено</div>';
        }
        
        html += '<div class="issues-header" style="margin-top: 20px;">Sitemap.xml</div>';
        if (!sitemap.urls || sitemap.urls.length === 0) {
            html += '<div class="empty-state">Sitemap не обнаружен</div>';
        } else {
            html += `<div class="stats-info">Всего URL в sitemap: ${sitemap.urls.length}</div>`;
            html += `<div class="sitemap-preview">`;
            sitemap.urls.slice(0, 20).forEach(url => {
                html += `<div class="sitemap-url"><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url.length > 80 ? url.substring(0, 80) + '...' : url)}</a></div>`;
            });
            if (sitemap.urls.length > 20) {
                html += `<div class="more-info">... и еще ${sitemap.urls.length - 20} URL</div>`;
            }
            html += `</div>`;
        }
        
        return html;
    };
    
    // Таблица всех проблем
    const allIssuesTable = () => {
        let html = '';
        
        html += '<div class="issues-header">Битые ссылки</div>';
        if (!links.brokenLinks || links.brokenLinks.length === 0) {
            html += '<div class="empty-state">Битых ссылок не обнаружено</div>';
        } else {
            html += `<div class="stats-info">Всего битых ссылок: ${links.brokenLinks.length}</div>`;
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>URL</th><th style="width:80px">Статус</th></tr></thead>
                    <tbody>
                        ${links.brokenLinks.slice(0, 50).map((link, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td class="truncate"><a href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(link.url)}</a></td>
                                <td class="status-cell status-${link.status === 'timeout' ? 'timeout' : link.status}">${link.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${links.brokenLinks.length > 50 ? `<div class="more-info">... и еще ${links.brokenLinks.length - 50} ссылок</div>` : ''}
            `;
        }
        
        html += '<div class="issues-header" style="margin-top: 20px;">DOM уязвимости</div>';
        if (!dom || dom.length === 0) {
            html += '<div class="empty-state">DOM уязвимостей не обнаружено</div>';
        } else {
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Уязвимость</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${dom.map((item, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(item.message)}${item.remediation ? `<div class="issue-remediation">${escapeHtml(item.remediation)}</div>` : ''}</td>
                                <td class="risk-cell risk-${item.severity}">${riskNames[item.severity] || 'Информационный'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        if (wcag.issues && wcag.issues.length > 0) {
            html += '<div class="issues-header" style="margin-top: 20px;">WCAG проблемы доступности</div>';
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Проблема</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${wcag.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(issue.message)}${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}</td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        return html;
    };
    
    const statsHtml = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value" style="color:#dc3545">${summary.critical || 0}</div><div class="stat-label">Критические</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#fd7e14">${summary.high || 0}</div><div class="stat-label">Высокие</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#ffc107">${summary.medium || 0}</div><div class="stat-label">Средние</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#28a745">${summary.low || 0}</div><div class="stat-label">Низкие</div></div>
            <div class="stat-card"><div class="stat-value">${accessiblePaths.length}</div><div class="stat-label">Всего путей</div></div>
            <div class="stat-card"><div class="stat-value">${subdomainsList.length}</div><div class="stat-label">Субдомены</div></div>
            <div class="stat-card"><div class="stat-value">${ipsList.length}</div><div class="stat-label">IP адреса</div></div>
            <div class="stat-card"><div class="stat-value">${apiFromJS.apiEndpoints?.length || 0}</div><div class="stat-label">API в JS</div></div>
        </div>
    `;
    
    const metricsHtml = `
        <div class="metrics-grid">
            ${tech.technologies && tech.technologies.length > 0 ? `
            <div class="metric-block">
                <div class="metric-title">Технологии</div>
                <div class="metric-content">${tech.technologies.map(t => `<span class="tech-tag">${escapeHtml(t.name)} ${t.version ? 'v' + escapeHtml(t.version) : ''}</span>`).join('')}</div>
            </div>
            ` : ''}
            ${performance.metrics && performance.metrics.loadTime ? `
            <div class="metric-block">
                <div class="metric-title">Производительность</div>
                <div class="metric-content">Загрузка: ${performance.metrics.loadTime}мс | Размер: ${performance.metrics.size || '?'}MB</div>
            </div>
            ` : ''}
            ${wcag.score ? `
            <div class="metric-block">
                <div class="metric-title">Доступность WCAG</div>
                <div class="metric-content">${wcag.score}% - ${wcag.score >= 80 ? 'Хорошо' : (wcag.score >= 60 ? 'Средне' : 'Требует улучшения')}</div>
            </div>
            ` : ''}
            ${secrets.secrets && secrets.secrets.length > 0 ? `
            <div class="metric-block warning">
                <div class="metric-title">Секреты найдены (${secrets.secrets.length})</div>
                <div class="metric-content">${secrets.secrets.slice(0, 5).map(s => `<div>${escapeHtml(s.type)}: ${escapeHtml(s.value)}</div>`).join('')}</div>
            </div>
            ` : ''}
            ${apiFromJS.totalEndpointsFound > 0 ? `
            <div class="metric-block">
                <div class="metric-title">API в JS файлах</div>
                <div class="metric-content">Найдено ${apiFromJS.totalEndpointsFound} API вызовов в ${apiFromJS.jsFilesAnalyzed?.length || 0} JS файлах</div>
            </div>
            ` : ''}
        </div>
    `;
    
    const securityCount = (headers.issues?.length || 0) + (cookies.issues?.length || 0) + (ssl.issues?.length || 0) + (ports.issues?.length || 0);
    const structureCount = (robots.disallowed?.length || 0) + (sitemap.urls?.length || 0);
    const issuesCount = (links.brokenLinks?.length || 0) + (dom?.length || 0) + (wcag.issues?.length || 0);
    
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Геркулес Скаут - Отчет</title>
    <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Alef:wght@400;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Ubuntu', sans-serif; background: #f0f2f5; padding: 20px; color: #1a1a2e; font-size: 13px; }
        .report-container { max-width: 1400px; margin: 0 auto; }
        
        .report-header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
            padding: 30px 40px;
            border-radius: 16px;
            margin-bottom: 24px;
        }
        .report-header h1 { font-size: 28px; margin-bottom: 8px; }
        .report-header .target-info {
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid rgba(255,255,255,0.2);
            font-size: 14px;
            font-family: monospace;
            word-break: break-all;
        }
        .report-header .meta {
            color: #a0a0b0;
            font-size: 13px;
            margin-top: 8px;
            display: flex;
            gap: 24px;
            flex-wrap: wrap;
        }
        
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .stat-value { font-size: 32px; font-weight: 700; font-family: 'Alef', monospace; }
        .stat-label { font-size: 11px; color: #666; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .metric-block { background: white; padding: 14px 18px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metric-block.warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .metric-title { font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #555; }
        .metric-content { font-size: 12px; }
        .tech-tag { display: inline-block; background: #e9ecef; padding: 4px 10px; border-radius: 20px; margin: 2px; font-size: 11px; }
        
        .api-stats-info { background: #e9ecef; padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 12px; font-weight: 500; }
        .method-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; color: white; }
        .method-get { background: #28a745; }
        .method-post { background: #007bff; }
        .method-put { background: #fd7e14; }
        .method-delete { background: #dc3545; }
        .method-other { background: #6c757d; }
        
        .tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 0; background: white; border-radius: 12px 12px 0 0; padding: 0 20px; border-bottom: 2px solid #e0e0e0; }
        .tab-btn { background: none; border: none; padding: 12px 20px; font-size: 13px; font-weight: 500; cursor: pointer; color: #666; transition: all 0.2s; font-family: 'Ubuntu', sans-serif; }
        .tab-btn:hover { color: #667eea; }
        .tab-btn.active { color: #667eea; border-bottom: 3px solid #667eea; }
        .tab-btn .tab-count { background: #e9ecef; padding: 2px 8px; border-radius: 20px; font-size: 10px; margin-left: 8px; color: #666; }
        .tab-btn.active .tab-count { background: #667eea20; color: #667eea; }
        
        .tab-content { display: none; background: white; border-radius: 0 0 12px 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .tab-content.active { display: block; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        
        .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .data-table th { text-align: left; padding: 10px 12px; background: #f8f9fa; border-bottom: 2px solid #e9ecef; font-weight: 600; color: #495057; font-size: 12px; }
        .data-table td { padding: 8px 12px; border-bottom: 1px solid #e9ecef; vertical-align: top; font-size: 12px; }
        .data-table tr:hover { background: #f8f9fa; }
        .data-table .truncate { max-width: 350px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .index-cell { color: #6c757d; font-weight: 500; text-align: center; width: 50px; }
        .risk-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; color: white; }
        .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
        .status-active { background: #d4edda; color: #155724; }
        .risk-cell { font-weight: 500; text-align: center; }
        .risk-critical { color: #dc3545; }
        .risk-high { color: #fd7e14; }
        .risk-medium { color: #ffc107; }
        .risk-low { color: #28a745; }
        .issue-remediation { font-size: 10px; color: #6c757d; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e5e7eb; }
        .issues-header { background: #e9ecef; padding: 10px 16px; border-radius: 8px; margin: 16px 0 16px 0; font-size: 12px; font-weight: 600; }
        .sitemap-preview { max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; }
        .sitemap-url { padding: 6px 12px; border-bottom: 1px solid #e5e7eb; font-size: 11px; word-break: break-all; }
        .sitemap-url a { color: #667eea; text-decoration: none; }
        .empty-state { text-align: center; padding: 40px; color: #999; font-size: 13px; }
        .report-footer { margin-top: 24px; padding: 20px; text-align: center; font-size: 11px; color: #999; background: white; border-radius: 12px; }
        .toolbar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .search-input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 12px; font-family: 'Ubuntu', sans-serif; }
        .filter-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; background: white; cursor: pointer; font-size: 12px; font-family: 'Ubuntu', sans-serif; }
        .sortable th { cursor: pointer; user-select: none; }
        .sortable th:hover { background: #e9ecef; }
        .sortable th::after { content: ' ↕'; opacity: 0.3; font-size: 10px; }
        .sortable th.sorted-asc::after { content: ' ↑'; opacity: 1; }
        .sortable th.sorted-desc::after { content: ' ↓'; opacity: 1; }
        .table-footer, .more-info { margin-top: 12px; padding: 8px; background: #f8f9fa; text-align: center; font-size: 11px; color: #6c757d; border-radius: 6px; }
        .stats-info { background: #e9ecef; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(4, 1fr); }
            .tab-btn { padding: 10px 14px; font-size: 12px; }
            .data-table td, .data-table th { padding: 6px 8px; }
            .data-table .truncate { max-width: 150px; }
            .report-header { padding: 20px; }
            .report-header h1 { font-size: 22px; }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <!-- ХЕДЕР -->
        <div class="report-header">
            <h1>Геркулес | Скаут</h1>
            <div class="meta">Дата генерации: ${reportDate} | Тип сканирования: Разведка веб-приложений</div>
            <div class="target-info">
                <div>Цель сканирования: <strong>${escapeHtml(baseUrl)}</strong></div>
                <div style="font-size: 12px; margin-top: 8px;">Длительность: ${result.duration || '—'} сек</div>
            </div>
        </div>
        
        ${statsHtml}
        ${metricsHtml}
        
        <div class="tabs" id="tabs">
            <button class="tab-btn active" data-tab="all">Все пути <span class="tab-count">${accessiblePaths.length}</span></button>
            <button class="tab-btn" data-tab="subdomains">Субдомены <span class="tab-count">${subdomainsList.length}</span></button>
            <button class="tab-btn" data-tab="ips">IP адреса <span class="tab-count">${ipsList.length}</span></button>
            <button class="tab-btn" data-tab="directories">Директории <span class="tab-count">${groups.directories.length + groups.admin.length}</span></button>
            <button class="tab-btn" data-tab="api">API <span class="tab-count">${groups.api.length}</span></button>
            <button class="tab-btn" data-tab="api-js">API в JS <span class="tab-count">${apiFromJS.apiEndpoints?.length || 0}</span></button>
            <button class="tab-btn" data-tab="files">Файлы <span class="tab-count">${groups.files.length}</span></button>
            <button class="tab-btn" data-tab="security">Безопасность <span class="tab-count">${securityCount}</span></button>
            <button class="tab-btn" data-tab="structure">Структура <span class="tab-count">${structureCount}</span></button>
            <button class="tab-btn" data-tab="issues">Проблемы <span class="tab-count">${issuesCount}</span></button>
        </div>
        
        <div id="tab-all" class="tab-content active">
            <div class="toolbar">
                <input type="text" class="search-input" id="searchAll" placeholder="Поиск по пути...">
                <select class="filter-select" id="filterAllRisk">
                    <option value="all">Все риски</option>
                    <option value="critical">Критические</option>
                    <option value="high">Высокие</option>
                    <option value="medium">Средние</option>
                    <option value="low">Низкие</option>
                </select>
            </div>
            ${allPathsTable()}
        </div>
        
        <div id="tab-subdomains" class="tab-content">
            ${subdomainsTable()}
        </div>
        
        <div id="tab-ips" class="tab-content">
            ${ipsTable()}
        </div>
        
        <div id="tab-directories" class="tab-content">
            <div class="toolbar">
                <input type="text" class="search-input" id="searchDirs" placeholder="Поиск по директории...">
                <select class="filter-select" id="filterDirsRisk">
                    <option value="all">Все риски</option>
                    <option value="critical">Критические</option>
                    <option value="high">Высокие</option>
                    <option value="medium">Средние</option>
                    <option value="low">Низкие</option>
                </select>
            </div>
            ${directoriesTable()}
        </div>
        
        <div id="tab-api" class="tab-content">
            <div class="toolbar">
                <input type="text" class="search-input" id="searchApi" placeholder="Поиск по API...">
                <select class="filter-select" id="filterApiRisk">
                    <option value="all">Все риски</option>
                    <option value="critical">Критические</option>
                    <option value="high">Высокие</option>
                    <option value="medium">Средние</option>
                    <option value="low">Низкие</option>
                </select>
            </div>
            ${apiTable()}
        </div>
        
        <div id="tab-api-js" class="tab-content">
            ${apiFromJSTable()}
        </div>
        
        <div id="tab-files" class="tab-content">
            <div class="toolbar">
                <input type="text" class="search-input" id="searchFiles" placeholder="Поиск по файлу...">
                <select class="filter-select" id="filterFilesRisk">
                    <option value="all">Все риски</option>
                    <option value="critical">Критические</option>
                    <option value="high">Высокие</option>
                    <option value="medium">Средние</option>
                    <option value="low">Низкие</option>
                </select>
            </div>
            ${filesTable()}
        </div>
        
        <div id="tab-security" class="tab-content">
            ${securityTable()}
        </div>
        
        <div id="tab-structure" class="tab-content">
            ${structureTable()}
        </div>
        
        <div id="tab-issues" class="tab-content">
            ${allIssuesTable()}
        </div>
        
        <div class="report-footer">
            <p>Сгенерировано с помощью Геркулес | Скаут — инструмент разведки веб-приложений</p>
            <p>Всего обнаружено: ${accessiblePaths.length} путей | Субдоменов: ${subdomainsList.length} | IP адресов: ${ipsList.length}</p>
        </div>
    </div>
    
    <script>
    (function() {
        var tabBtns = document.querySelectorAll('.tab-btn');
        var tabContents = document.querySelectorAll('.tab-content');
        
        function switchTab(tabId) {
            tabContents.forEach(function(content) {
                content.classList.remove('active');
            });
            tabBtns.forEach(function(btn) {
                btn.classList.remove('active');
            });
            var targetTab = document.getElementById('tab-' + tabId);
            if (targetTab) targetTab.classList.add('active');
            tabBtns.forEach(function(btn) {
                if (btn.getAttribute('data-tab') === tabId) {
                    btn.classList.add('active');
                }
            });
        }
        
        tabBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                switchTab(this.getAttribute('data-tab'));
            });
        });
        
        function makeSortable(tableId) {
            var table = document.getElementById(tableId);
            if (!table) return;
            var headers = table.querySelectorAll('th');
            headers.forEach(function(header, index) {
                header.style.cursor = 'pointer';
                header.addEventListener('click', function() {
                    var tbody = table.querySelector('tbody');
                    var rows = Array.from(tbody.querySelectorAll('tr'));
                    var isAsc = this.classList.contains('sorted-asc');
                    headers.forEach(function(h) {
                        h.classList.remove('sorted-asc', 'sorted-desc');
                    });
                    this.classList.add(isAsc ? 'sorted-desc' : 'sorted-asc');
                    rows.sort(function(a, b) {
                        var aVal = a.cells[index] ? a.cells[index].textContent.trim() : '';
                        var bVal = b.cells[index] ? b.cells[index].textContent.trim() : '';
                        return isAsc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
                    });
                    rows.forEach(function(row) {
                        tbody.appendChild(row);
                    });
                });
            });
        }
        
        function setupFilter(tableId, searchInputId, filterSelectId) {
            var table = document.getElementById(tableId);
            if (!table) return;
            var searchInput = document.getElementById(searchInputId);
            var filterSelect = document.getElementById(filterSelectId);
            
            function filterRows() {
                var searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
                var riskFilter = filterSelect ? filterSelect.value : 'all';
                var rows = table.querySelectorAll('tbody tr');
                rows.forEach(function(row) {
                    var text = row.cells[1] ? row.cells[1].textContent.toLowerCase() : '';
                    var risk = row.getAttribute('data-risk') || 'info';
                    var matchesSearch = searchTerm === '' || text.indexOf(searchTerm) !== -1;
                    var matchesRisk = riskFilter === 'all' || risk === riskFilter;
                    row.style.display = (matchesSearch && matchesRisk) ? '' : 'none';
                });
            }
            
            if (searchInput) searchInput.addEventListener('input', filterRows);
            if (filterSelect) filterSelect.addEventListener('change', filterRows);
        }
        
        setTimeout(function() {
            makeSortable('allPathsTable');
            makeSortable('dirsTable');
            makeSortable('apiTable');
            makeSortable('filesTable');
            makeSortable('subdomainsTable');
            makeSortable('ipsTable');
            makeSortable('apiJsTable');
            
            setupFilter('allPathsTable', 'searchAll', 'filterAllRisk');
            setupFilter('dirsTable', 'searchDirs', 'filterDirsRisk');
            setupFilter('apiTable', 'searchApi', 'filterApiRisk');
            setupFilter('filesTable', 'searchFiles', 'filterFilesRisk');
        }, 100);
    })();
    </script>
</body>
</html>`;
}

function showScoutReportModal(result, onClose) {
    // Парсим JSON результат
    const target = result.target;
    const summary = result.summary || { critical: 0, high: 0, medium: 0, low: 0 };
    const accessiblePaths = result.accessiblePaths || [];
    const findings = result.findings || {};
    const tech = findings.tech || {};
    const secrets = findings.secrets || {};
    const wcag = findings.wcag || {};
    const mobile = findings.mobile || {};
    const performance = findings.performance || {};
    const subdomainsData = findings.subdomains || {};
    const apiFromJS = findings.apiFromJS || {};
    const headers = findings.headers || {};
    const cookies = findings.cookies || {};
    const ssl = findings.ssl || {};
    const ports = findings.ports || {};
    const robots = findings.robots || {};
    const sitemap = findings.sitemap || {};
    const links = findings.links || {};
    const dom = findings.dom || [];
    
    // Получаем отдельные списки субдоменов и IP из новой структуры
    const subdomainsList = subdomainsData.subdomains || [];
    const ipsList = subdomainsData.ips || [];
    
    const riskColors = {
        critical: '#dc3545',
        high: '#fd7e14',
        medium: '#ffc107',
        low: '#28a745',
        info: '#6c757d'
    };
    
    const riskNames = {
        critical: 'Критический',
        high: 'Высокий',
        medium: 'Средний',
        low: 'Низкий',
        info: 'Информационный'
    };
    
    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    
    const baseUrl = result.target || '';
    const reportDate = new Date(result.timestamp || Date.now()).toLocaleString('ru-RU');
    
    // Группировка путей
    function groupPathsByType(paths) {
        const groups = {
            subdomains: new Map(),
            directories: [],
            files: [],
            api: [],
            admin: [],
            other: []
        };
        
        if (!paths) return groups;
        
        paths.forEach(item => {
            const path = item.path || '';
            const lowerPath = path.toLowerCase();
            
            if (lowerPath.includes('/api/') || lowerPath.startsWith('/api')) {
                groups.api.push(item);
            } 
            else if (lowerPath.includes('/admin') || lowerPath.includes('/administrator') || lowerPath.includes('/wp-admin') || lowerPath.includes('/cp') || lowerPath.includes('/manager')) {
                groups.admin.push(item);
            } 
            else if (path.includes('.') && !path.endsWith('/')) {
                const ext = path.split('.').pop();
                if (['php', 'asp', 'aspx', 'jsp', 'do', 'action', 'py', 'rb', 'pl', 'cgi', 'html', 'htm', 'xml', 'json', 'txt', 'log', 'bak', 'sql', 'zip', 'tar', 'gz', 'rar', '7z'].includes(ext.toLowerCase())) {
                    groups.files.push(item);
                } else {
                    groups.other.push(item);
                }
            } 
            else if (path !== '/' && path !== '' && !path.includes('.')) {
                groups.directories.push(item);
            } 
            else {
                groups.other.push(item);
            }
        });
        
        return groups;
    }
    
    const groups = groupPathsByType(accessiblePaths);
    
    // Таблица субдоменов (с заголовками и статусами)
    const subdomainsTable = () => {
        if (subdomainsList.length === 0) {
            return '<div class="empty-state">Субдомены не обнаружены</div>';
        }
        
        const rows = subdomainsList.map((s, idx) => {
            const statusColor = s.status === '200' ? '#28a745' : (s.status === '302' ? '#ffc107' : (s.status === '404' ? '#dc3545' : '#6c757d'));
            const statusLabel = s.status || 'unknown';
            
            return `
                <tr>
                    <td class="index-cell">${idx + 1}</td>
                    <td><a href="${s.url || 'https://' + s.domain}" target="_blank">${escapeHtml(s.domain)}</a></td>
                    <td>${s.ip || '—'}</td>
                    <td><span class="status-badge" style="background:${statusColor}; color:white; padding:2px 10px; border-radius:4px; font-size:11px;">${statusLabel}</span></td>
                    <td style="font-size:11px; color:#666;">${escapeHtml(s.title || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="subdomainsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Субдомен</th><th>IP адрес</th><th>Статус</th><th>Заголовок</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего субдоменов: ${subdomainsList.length}</div>
        `;
    };
    
    // Таблица IP адресов
    const ipsTable = () => {
        if (ipsList.length === 0) {
            return '<div class="empty-state">IP адреса не обнаружены</div>';
        }
        
        const rows = ipsList.map((item, idx) => {
            return `
                <tr>
                    <td class="index-cell">${idx + 1}</td>
                    <td><code>${escapeHtml(item.ip)}</code></td>
                    <td>${escapeHtml(item.domain || '—')}</td>
                    <td><span class="status-badge" style="background:${item.status === '200' ? '#28a745' : (item.status === '302' ? '#ffc107' : (item.status === '404' ? '#dc3545' : '#6c757d'))}; color:white; padding:2px 10px; border-radius:4px; font-size:11px;">${item.status || 'unknown'}</span></td>
                    <td>${escapeHtml(item.source || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="ipsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>IP адрес</th><th>Домен</th><th>Статус</th><th>Источник</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего IP адресов: ${ipsList.length}</div>
        `;
    };
    
    // Таблица API из JS файлов
    const apiFromJSTable = () => {
        if (!apiFromJS.apiEndpoints || apiFromJS.apiEndpoints.length === 0) {
            return '<div class="empty-state">API вызовы в JS файлах не обнаружены</div>';
        }
        
        const rows = apiFromJS.apiEndpoints.slice(0, 100).map((api, idx) => {
            const methodClass = api.method === 'GET' ? 'method-get' : (api.method === 'POST' ? 'method-post' : (api.method === 'PUT' ? 'method-put' : 'method-other'));
            return `
                <tr>
                    <td class="index-cell">${idx + 1}</td>
                    <td class="truncate"><a href="${escapeHtml(api.url)}" target="_blank" rel="noopener">${escapeHtml(api.url.length > 60 ? api.url.substring(0, 60) + '...' : api.url)}</a></td>
                    <td style="text-align:center"><span class="method-badge ${methodClass}">${api.method}</span></td>
                    <td>${escapeHtml(api.sourceFile || api.source || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <div class="api-stats-info">Всего найдено API вызовов: ${apiFromJS.totalEndpointsFound || apiFromJS.apiEndpoints.length} | Проанализировано JS файлов: ${apiFromJS.jsFilesAnalyzed?.length || 0}</div>
            <table class="data-table sortable" id="apiJsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>URL эндпоинта</th><th style="width:80px">Метод</th><th>Источник</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            ${apiFromJS.apiEndpoints.length > 100 ? '<div class="more-info">... и еще ' + (apiFromJS.apiEndpoints.length - 100) + ' записей</div>' : ''}
        `;
    };
    
    // Таблица директорий
    const directoriesTable = () => {
        if (groups.directories.length === 0 && groups.admin.length === 0) {
            return '<div class="empty-state">Директории не обнаружены</div>';
        }
        
        const allDirs = [...groups.directories, ...groups.admin];
        const rows = allDirs.map((item, idx) => {
            const risk = item.risk || 'info';
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td><code>${escapeHtml(item.path)}</code></td>
                    <td style="text-align:center">${item.status || '?'}</td>
                    <td><span class="risk-badge" style="background:${riskColors[risk]}">${riskNames[risk]}</span></td>
                    <td class="truncate">${escapeHtml(item.recommendation || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="dirsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Путь</th><th style="width:80px">HTTP</th><th style="width:100px">Риск</th><th>Описание</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };
    
    // Таблица API эндпоинтов
    const apiTable = () => {
        if (groups.api.length === 0) {
            return '<div class="empty-state">API эндпоинты не обнаружены</div>';
        }
        
        const rows = groups.api.map((item, idx) => {
            const risk = item.risk || 'info';
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td><code>${escapeHtml(item.path)}</code></td>
                    <td style="text-align:center">${item.status || '?'}</td>
                    <td><span class="risk-badge" style="background:${riskColors[risk]}">${riskNames[risk]}</span></td>
                    <td class="truncate">${escapeHtml(item.recommendation || 'API эндпоинт')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="apiTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>API путь</th><th style="width:80px">HTTP</th><th style="width:100px">Риск</th><th>Описание</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };
    
    // Таблица файлов
    const filesTable = () => {
        if (groups.files.length === 0) {
            return '<div class="empty-state">Файлы не обнаружены</div>';
        }
        
        const rows = groups.files.map((item, idx) => {
            const risk = item.risk || 'info';
            const fileName = item.path.split('/').pop();
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td><code>${escapeHtml(fileName)}</code></td>
                    <td style="text-align:center">${item.status || '?'}</td>
                    <td><span class="risk-badge" style="background:${riskColors[risk]}">${riskNames[risk]}</span></td>
                    <td class="truncate">${escapeHtml(item.recommendation || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="filesTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Файл</th><th style="width:80px">HTTP</th><th style="width:100px">Риск</th><th>Описание</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };
    
    // Таблица всех путей
    const allPathsTable = () => {
        if (accessiblePaths.length === 0) {
            return '<div class="empty-state">Пути не обнаружены</div>';
        }
        
        const rows = accessiblePaths.map((item, idx) => {
            const risk = item.risk || 'info';
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td><a href="${target + escapeHtml(item.path)}" target="_blank"><code>${escapeHtml(item.path)}</code></a></td>
                    <td style="text-align:center">${item.status || '?'}</td>
                    <td><span class="risk-badge" style="background:${riskColors[risk]}">${riskNames[risk]}</span></td>
                    <td class="truncate">${escapeHtml(item.recommendation || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="allPathsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Путь</th><th style="width:80px">HTTP</th><th style="width:100px">Риск</th><th>Описание</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };
    
    // Таблица проблем безопасности
    const securityTable = () => {
        let html = '';
        
        if (headers.issues && headers.issues.length > 0) {
            html += '<div class="issues-header">Заголовки безопасности</div>';
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Проблема</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${headers.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(issue.message)}${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}</td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        if (cookies.issues && cookies.issues.length > 0) {
            html += '<div class="issues-header">Cookies безопасность</div>';
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Проблема</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${cookies.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(issue.message)}${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}</td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        if (ssl.issues && ssl.issues.length > 0) {
            html += '<div class="issues-header">SSL/TLS</div>';
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Проблема</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${ssl.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(issue.message)}${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}</td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        if (ports.issues && ports.issues.length > 0) {
            html += '<div class="issues-header">Открытые порты</div>';
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Порт</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${ports.issues.map((port, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(port.message)}</td>
                                <td class="risk-cell risk-${port.severity}">${riskNames[port.severity] || 'Низкий'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        if (html === '') {
            return '<div class="empty-state">Проблем безопасности не обнаружено</div>';
        }
        
        return html;
    };
    
    // Таблица структуры
    const structureTable = () => {
        let html = '';
        
        html += '<div class="issues-header">robots.txt</div>';
        if (!robots.exists && robots.issues && robots.issues.length > 0) {
            html += '<div class="empty-state">robots.txt не найден</div>';
        } else if (robots.disallowed && robots.disallowed.length > 0) {
            html += `<div class="stats-info">Всего запрещенных путей: ${robots.disallowed.length}</div>`;
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Запрещенный путь</th></tr></thead>
                    <tbody>
                        ${robots.disallowed.slice(0, 50).map((path, idx) => `
                            <tr><td class="index-cell">${idx + 1}</td><td><code>${escapeHtml(path)}</code></td></tr>
                        `).join('')}
                    </tbody>
                </table>
                ${robots.disallowed.length > 50 ? `<div class="more-info">... и еще ${robots.disallowed.length - 50} записей</div>` : ''}
            `;
        } else {
            html += '<div class="empty-state">Запрещенных путей не обнаружено</div>';
        }
        
        html += '<div class="issues-header" style="margin-top: 20px;">Sitemap.xml</div>';
        if (!sitemap.urls || sitemap.urls.length === 0) {
            html += '<div class="empty-state">Sitemap не обнаружен</div>';
        } else {
            html += `<div class="stats-info">Всего URL в sitemap: ${sitemap.urls.length}</div>`;
            html += `<div class="sitemap-preview">`;
            sitemap.urls.slice(0, 20).forEach(url => {
                html += `<div class="sitemap-url"><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url.length > 80 ? url.substring(0, 80) + '...' : url)}</a></div>`;
            });
            if (sitemap.urls.length > 20) {
                html += `<div class="more-info">... и еще ${sitemap.urls.length - 20} URL</div>`;
            }
            html += `</div>`;
        }
        
        return html;
    };
    
    // Таблица всех проблем
    const allIssuesTable = () => {
        let html = '';
        
        html += '<div class="issues-header">Битые ссылки</div>';
        if (!links.brokenLinks || links.brokenLinks.length === 0) {
            html += '<div class="empty-state">Битых ссылок не обнаружено</div>';
        } else {
            html += `<div class="stats-info">Всего битых ссылок: ${links.brokenLinks.length}</div>`;
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>URL</th><th style="width:80px">Статус</th></tr></thead>
                    <tbody>
                        ${links.brokenLinks.slice(0, 50).map((link, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td class="truncate"><a href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(link.url)}</a></td>
                                <td class="status-cell status-${link.status === 'timeout' ? 'timeout' : link.status}">${link.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${links.brokenLinks.length > 50 ? `<div class="more-info">... и еще ${links.brokenLinks.length - 50} ссылок</div>` : ''}
            `;
        }
        
        html += '<div class="issues-header" style="margin-top: 20px;">DOM уязвимости</div>';
        if (!dom || dom.length === 0) {
            html += '<div class="empty-state">DOM уязвимостей не обнаружено</div>';
        } else {
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Уязвимость</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${dom.map((item, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(item.message)}${item.remediation ? `<div class="issue-remediation">${escapeHtml(item.remediation)}</div>` : ''}</td>
                                <td class="risk-cell risk-${item.severity}">${riskNames[item.severity] || 'Информационный'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        if (wcag.issues && wcag.issues.length > 0) {
            html += '<div class="issues-header" style="margin-top: 20px;">WCAG проблемы доступности</div>';
            html += `
                <table class="data-table">
                    <thead><tr><th style="width:50px">#</th><th>Проблема</th><th style="width:100px">Риск</th></tr></thead>
                    <tbody>
                        ${wcag.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>${escapeHtml(issue.message)}${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}</td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        return html;
    };
    
    const statsHtml = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value" style="color:#dc3545">${summary.critical || 0}</div><div class="stat-label">Критические</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#fd7e14">${summary.high || 0}</div><div class="stat-label">Высокие</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#ffc107">${summary.medium || 0}</div><div class="stat-label">Средние</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#28a745">${summary.low || 0}</div><div class="stat-label">Низкие</div></div>
            <div class="stat-card"><div class="stat-value">${accessiblePaths.length}</div><div class="stat-label">Всего путей</div></div>
            <div class="stat-card"><div class="stat-value">${subdomainsList.length}</div><div class="stat-label">Субдомены</div></div>
            <div class="stat-card"><div class="stat-value">${ipsList.length}</div><div class="stat-label">IP адреса</div></div>
            <div class="stat-card"><div class="stat-value">${apiFromJS.apiEndpoints?.length || 0}</div><div class="stat-label">API в JS</div></div>
        </div>
    `;
    
    const metricsHtml = `
        <div class="metrics-grid">
            ${tech.technologies && tech.technologies.length > 0 ? `
            <div class="metric-block">
                <div class="metric-title">Технологии</div>
                <div class="metric-content">${tech.technologies.map(t => `<span class="tech-tag">${escapeHtml(t.name)} ${t.version ? 'v' + escapeHtml(t.version) : ''}</span>`).join('')}</div>
            </div>
            ` : ''}
            ${performance.metrics && performance.metrics.loadTime ? `
            <div class="metric-block">
                <div class="metric-title">Производительность</div>
                <div class="metric-content">Загрузка: ${performance.metrics.loadTime}мс | Размер: ${performance.metrics.size || '?'}MB</div>
            </div>
            ` : ''}
            ${wcag.score ? `
            <div class="metric-block">
                <div class="metric-title">Доступность WCAG</div>
                <div class="metric-content">${wcag.score}% - ${wcag.score >= 80 ? 'Хорошо' : (wcag.score >= 60 ? 'Средне' : 'Требует улучшения')}</div>
            </div>
            ` : ''}
            ${secrets.secrets && secrets.secrets.length > 0 ? `
            <div class="metric-block warning">
                <div class="metric-title">Секреты найдены (${secrets.secrets.length})</div>
                <div class="metric-content">${secrets.secrets.slice(0, 5).map(s => `<div>${escapeHtml(s.type)}: ${escapeHtml(s.value)}</div>`).join('')}</div>
            </div>
            ` : ''}
            ${apiFromJS.totalEndpointsFound > 0 ? `
            <div class="metric-block">
                <div class="metric-title">API в JS файлах</div>
                <div class="metric-content">Найдено ${apiFromJS.totalEndpointsFound} API вызовов в ${apiFromJS.jsFilesAnalyzed?.length || 0} JS файлах</div>
            </div>
            ` : ''}
        </div>
    `;
    
    const securityCount = (headers.issues?.length || 0) + (cookies.issues?.length || 0) + (ssl.issues?.length || 0) + (ports.issues?.length || 0);
    const structureCount = (robots.disallowed?.length || 0) + (sitemap.urls?.length || 0);
    const issuesCount = (links.brokenLinks?.length || 0) + (dom?.length || 0) + (wcag.issues?.length || 0);
    
    const modalHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Геркулес Скаут - Отчет</title>
    <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Alef:wght@400;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Ubuntu', sans-serif; background: #f0f2f5; padding: 20px; color: #1a1a2e; font-size: 13px; }
        .report-container { max-width: 1400px; margin: 0 auto; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .stat-value { font-size: 32px; font-weight: 700; font-family: 'Alef', monospace; }
        .stat-label { font-size: 11px; color: #666; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .metric-block { background: white; padding: 14px 18px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metric-block.warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .metric-title { font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #555; }
        .metric-content { font-size: 12px; }
        .tech-tag { display: inline-block; background: #e9ecef; padding: 4px 10px; border-radius: 20px; margin: 2px; font-size: 11px; }
        
        .api-stats-info { background: #e9ecef; padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 12px; font-weight: 500; }
        .method-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; color: white; }
        .method-get { background: #28a745; }
        .method-post { background: #007bff; }
        .method-put { background: #fd7e14; }
        .method-delete { background: #dc3545; }
        .method-other { background: #6c757d; }
        
        .tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 0; background: white; border-radius: 12px 12px 0 0; padding: 0 20px; border-bottom: 2px solid #e0e0e0; }
        .tab-btn { background: none; border: none; padding: 12px 20px; font-size: 13px; font-weight: 500; cursor: pointer; color: #666; transition: all 0.2s; font-family: 'Ubuntu', sans-serif; }
        .tab-btn:hover { color: #667eea; }
        .tab-btn.active { color: #667eea; border-bottom: 3px solid #667eea; }
        .tab-btn .tab-count { background: #e9ecef; padding: 2px 8px; border-radius: 20px; font-size: 10px; margin-left: 8px; color: #666; }
        .tab-btn.active .tab-count { background: #667eea20; color: #667eea; }
        
        .tab-content { display: none; background: white; border-radius: 0 0 12px 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .tab-content.active { display: block; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        
        .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .data-table th { text-align: left; padding: 10px 12px; background: #f8f9fa; border-bottom: 2px solid #e9ecef; font-weight: 600; color: #495057; font-size: 12px; }
        .data-table td { padding: 8px 12px; border-bottom: 1px solid #e9ecef; vertical-align: top; font-size: 12px; }
        .data-table tr:hover { background: #f8f9fa; }
        .data-table .truncate { max-width: 350px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .index-cell { color: #6c757d; font-weight: 500; text-align: center; width: 50px; }
        .risk-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; color: white; }
        .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
        .status-active { background: #d4edda; color: #155724; }
        .risk-cell { font-weight: 500; text-align: center; }
        .risk-critical { color: #dc3545; }
        .risk-high { color: #fd7e14; }
        .risk-medium { color: #ffc107; }
        .risk-low { color: #28a745; }
        .issue-remediation { font-size: 10px; color: #6c757d; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e5e7eb; }
        .issues-header { background: #e9ecef; padding: 10px 16px; border-radius: 8px; margin: 16px 0 16px 0; font-size: 12px; font-weight: 600; }
        .sitemap-preview { max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; }
        .sitemap-url { padding: 6px 12px; border-bottom: 1px solid #e5e7eb; font-size: 11px; word-break: break-all; }
        .sitemap-url a { color: #667eea; text-decoration: none; }
        .empty-state { text-align: center; padding: 40px; color: #999; font-size: 13px; }
        .report-footer { margin-top: 24px; padding: 20px; text-align: center; font-size: 11px; color: #999; background: white; border-radius: 12px; }
        .toolbar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .search-input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 12px; font-family: 'Ubuntu', sans-serif; }
        .filter-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; background: white; cursor: pointer; font-size: 12px; font-family: 'Ubuntu', sans-serif; }
        .sortable th { cursor: pointer; user-select: none; }
        .sortable th:hover { background: #e9ecef; }
        .sortable th::after { content: ' ↕'; opacity: 0.3; font-size: 10px; }
        .sortable th.sorted-asc::after { content: ' ↑'; opacity: 1; }
        .sortable th.sorted-desc::after { content: ' ↓'; opacity: 1; }
        .table-footer, .more-info { margin-top: 12px; padding: 8px; background: #f8f9fa; text-align: center; font-size: 11px; color: #6c757d; border-radius: 6px; }
        .stats-info { background: #e9ecef; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(4, 1fr); }
            .tab-btn { padding: 10px 14px; font-size: 12px; }
            .data-table td, .data-table th { padding: 6px 8px; }
            .data-table .truncate { max-width: 150px; }
        }
    </style>
</head>
<body>
    <div class="report-container">
        ${statsHtml}
        ${metricsHtml}
        
        <div class="tabs" id="tabs">
            <button class="tab-btn active" data-tab="all">Все пути <span class="tab-count">${accessiblePaths.length}</span></button>
            <button class="tab-btn" data-tab="subdomains">Субдомены <span class="tab-count">${subdomainsList.length}</span></button>
            <button class="tab-btn" data-tab="ips">IP адреса <span class="tab-count">${ipsList.length}</span></button>
            <button class="tab-btn" data-tab="directories">Директории <span class="tab-count">${groups.directories.length + groups.admin.length}</span></button>
            <button class="tab-btn" data-tab="api">API <span class="tab-count">${groups.api.length}</span></button>
            <button class="tab-btn" data-tab="api-js">API в JS <span class="tab-count">${apiFromJS.apiEndpoints?.length || 0}</span></button>
            <button class="tab-btn" data-tab="files">Файлы <span class="tab-count">${groups.files.length}</span></button>
            <button class="tab-btn" data-tab="security">Безопасность <span class="tab-count">${securityCount}</span></button>
            <button class="tab-btn" data-tab="structure">Структура <span class="tab-count">${structureCount}</span></button>
            <button class="tab-btn" data-tab="issues">Проблемы <span class="tab-count">${issuesCount}</span></button>
        </div>
        
        <div id="tab-all" class="tab-content active">
            <div class="toolbar">
                <input type="text" class="search-input" id="searchAll" placeholder="Поиск по пути...">
                <select class="filter-select" id="filterAllRisk">
                    <option value="all">Все риски</option>
                    <option value="critical">Критические</option>
                    <option value="high">Высокие</option>
                    <option value="medium">Средние</option>
                    <option value="low">Низкие</option>
                </select>
            </div>
            ${allPathsTable()}
        </div>
        
        <div id="tab-subdomains" class="tab-content">
            ${subdomainsTable()}
        </div>
        
        <div id="tab-ips" class="tab-content">
            ${ipsTable()}
        </div>
        
        <div id="tab-directories" class="tab-content">
            <div class="toolbar">
                <input type="text" class="search-input" id="searchDirs" placeholder="Поиск по директории...">
                <select class="filter-select" id="filterDirsRisk">
                    <option value="all">Все риски</option>
                    <option value="critical">Критические</option>
                    <option value="high">Высокие</option>
                    <option value="medium">Средние</option>
                    <option value="low">Низкие</option>
                </select>
            </div>
            ${directoriesTable()}
        </div>
        
        <div id="tab-api" class="tab-content">
            <div class="toolbar">
                <input type="text" class="search-input" id="searchApi" placeholder="Поиск по API...">
                <select class="filter-select" id="filterApiRisk">
                    <option value="all">Все риски</option>
                    <option value="critical">Критические</option>
                    <option value="high">Высокие</option>
                    <option value="medium">Средние</option>
                    <option value="low">Низкие</option>
                </select>
            </div>
            ${apiTable()}
        </div>
        
        <div id="tab-api-js" class="tab-content">
            ${apiFromJSTable()}
        </div>
        
        <div id="tab-files" class="tab-content">
            <div class="toolbar">
                <input type="text" class="search-input" id="searchFiles" placeholder="Поиск по файлу...">
                <select class="filter-select" id="filterFilesRisk">
                    <option value="all">Все риски</option>
                    <option value="critical">Критические</option>
                    <option value="high">Высокие</option>
                    <option value="medium">Средние</option>
                    <option value="low">Низкие</option>
                </select>
            </div>
            ${filesTable()}
        </div>
        
        <div id="tab-security" class="tab-content">
            ${securityTable()}
        </div>
        
        <div id="tab-structure" class="tab-content">
            ${structureTable()}
        </div>
        
        <div id="tab-issues" class="tab-content">
            ${allIssuesTable()}
        </div>
        
        <div class="report-footer">
            <p>Сгенерировано с помощью Геркулес | Скаут — инструмент разведки веб-приложений</p>
            <p>Всего обнаружено: ${accessiblePaths.length} путей | Субдоменов: ${subdomainsList.length} | IP адресов: ${ipsList.length}</p>
        </div>
    </div>
    
    <script>
    (function() {
        var tabBtns = document.querySelectorAll('.tab-btn');
        var tabContents = document.querySelectorAll('.tab-content');
        
        function switchTab(tabId) {
            tabContents.forEach(function(content) {
                content.classList.remove('active');
            });
            tabBtns.forEach(function(btn) {
                btn.classList.remove('active');
            });
            var targetTab = document.getElementById('tab-' + tabId);
            if (targetTab) targetTab.classList.add('active');
            tabBtns.forEach(function(btn) {
                if (btn.getAttribute('data-tab') === tabId) {
                    btn.classList.add('active');
                }
            });
        }
        
        tabBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                switchTab(this.getAttribute('data-tab'));
            });
        });
        
        function makeSortable(tableId) {
            var table = document.getElementById(tableId);
            if (!table) return;
            var headers = table.querySelectorAll('th');
            headers.forEach(function(header, index) {
                header.style.cursor = 'pointer';
                header.addEventListener('click', function() {
                    var tbody = table.querySelector('tbody');
                    var rows = Array.from(tbody.querySelectorAll('tr'));
                    var isAsc = this.classList.contains('sorted-asc');
                    headers.forEach(function(h) {
                        h.classList.remove('sorted-asc', 'sorted-desc');
                    });
                    this.classList.add(isAsc ? 'sorted-desc' : 'sorted-asc');
                    rows.sort(function(a, b) {
                        var aVal = a.cells[index] ? a.cells[index].textContent.trim() : '';
                        var bVal = b.cells[index] ? b.cells[index].textContent.trim() : '';
                        return isAsc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
                    });
                    rows.forEach(function(row) {
                        tbody.appendChild(row);
                    });
                });
            });
        }
        
        function setupFilter(tableId, searchInputId, filterSelectId) {
            var table = document.getElementById(tableId);
            if (!table) return;
            var searchInput = document.getElementById(searchInputId);
            var filterSelect = document.getElementById(filterSelectId);
            
            function filterRows() {
                var searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
                var riskFilter = filterSelect ? filterSelect.value : 'all';
                var rows = table.querySelectorAll('tbody tr');
                rows.forEach(function(row) {
                    var text = row.cells[1] ? row.cells[1].textContent.toLowerCase() : '';
                    var risk = row.getAttribute('data-risk') || 'info';
                    var matchesSearch = searchTerm === '' || text.indexOf(searchTerm) !== -1;
                    var matchesRisk = riskFilter === 'all' || risk === riskFilter;
                    row.style.display = (matchesSearch && matchesRisk) ? '' : 'none';
                });
            }
            
            if (searchInput) searchInput.addEventListener('input', filterRows);
            if (filterSelect) filterSelect.addEventListener('change', filterRows);
        }
        
        setTimeout(function() {
            makeSortable('allPathsTable');
            makeSortable('dirsTable');
            makeSortable('apiTable');
            makeSortable('filesTable');
            makeSortable('subdomainsTable');
            makeSortable('ipsTable');
            makeSortable('apiJsTable');
            
            setupFilter('allPathsTable', 'searchAll', 'filterAllRisk');
            setupFilter('dirsTable', 'searchDirs', 'filterDirsRisk');
            setupFilter('apiTable', 'searchApi', 'filterApiRisk');
            setupFilter('filesTable', 'searchFiles', 'filterFilesRisk');
        }, 100);
    })();
    </script>
</body>
</html>`;
    
    // Создаем overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); display: flex; justify-content: center; align-items: center; z-index: 10000; backdrop-filter: blur(8px);';
    
    overlay.innerHTML = `
        <div style="background: #f0f2f5; border-radius: 16px; width: 95%; max-width: 1400px; height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="background: #1a1a2e; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; color: white; flex-shrink: 0;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 500;">Результаты анализа</h3>
                <span id="modalClose" style="cursor: pointer; font-size: 28px; line-height: 1;">&times;</span>
            </div>
            <div style="flex: 1; overflow: auto; padding: 20px; background: #f0f2f5;" id="modalBodyContainer"></div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 12px; background: white; flex-shrink: 0;">
                <button id="modalDownloadHtml" style="background: #6f42c1; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-family: Ubuntu; font-size: 13px;"><i class="fab fa-html5"></i> Скачать HTML</button>
                <button id="modalDownloadJson" style="background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-family: Ubuntu; font-size: 13px;"><i class="fas fa-download"></i> Скачать JSON</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const bodyContainer = overlay.querySelector('#modalBodyContainer');
    bodyContainer.innerHTML = modalHtml;
    
    const modalTabs = bodyContainer.querySelectorAll('.tab-btn');
    const modalTabContents = bodyContainer.querySelectorAll('.tab-content');
    
    if (modalTabs.length > 0) {
        modalTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                modalTabContents.forEach(content => {
                    content.classList.remove('active');
                });
                modalTabs.forEach(b => b.classList.remove('active'));
                const targetTab = bodyContainer.querySelector('#tab-' + tabId);
                if (targetTab) targetTab.classList.add('active');
                btn.classList.add('active');
            });
        });
    }
    
    const closeModal = () => {
        overlay.remove();
        if (onClose) onClose();
    };
    
    overlay.querySelector('#modalClose').addEventListener('click', closeModal);
    overlay.querySelector('#modalDownloadHtml').addEventListener('click', () => downloadScoutHTMLReport(result));
    overlay.querySelector('#modalDownloadJson').addEventListener('click', () => downloadJSONReport(result));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
}

// Экспорт функций для глобального использования
window.downloadJSONReport = downloadJSONReport;
window.downloadScoutHTMLReport = downloadScoutHTMLReport;
window.generateScoutFullHTMLReport = generateScoutFullHTMLReport;
window.showScoutReportModal = showScoutReportModal;