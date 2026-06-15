export function generateScoutReportHTML(result) {
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
    
    // Группировка путей (API проверяем первыми)
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
    
    // Таблица всех путей
    const allPathsTable = () => {
        if (accessiblePaths.length === 0) {
            return '<div class="empty-state">Пути не обнаружены</div>';
        }
        
        const rows = accessiblePaths.map((item, idx) => {
            const risk = item.risk || 'info';
            const riskLabel = riskNames[risk] || riskNames.info;
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td class="path-cell"><code>${escapeHtml(item.path)}</code></td>
                    <td class="status-cell">${item.status || '?'}</td>
                    <td class="risk-cell risk-${risk}">${riskLabel}</td>
                    <td class="desc-cell">${escapeHtml(item.recommendation || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="allPathsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Путь</th><th style="width:80px">HTTP</th><th style="width:110px">Риск</th><th>Описание</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего записей: ${accessiblePaths.length}</div>
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
            const riskLabel = riskNames[risk] || riskNames.info;
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td class="path-cell"><code>${escapeHtml(item.path)}</code></td>
                    <td class="status-cell">${item.status || '?'}</td>
                    <td class="risk-cell risk-${risk}">${riskLabel}</td>
                    <td class="desc-cell">${escapeHtml(item.recommendation || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="dirsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Путь</th><th style="width:80px">HTTP</th><th style="width:110px">Риск</th><th>Описание</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего директорий: ${allDirs.length}</div>
        `;
    };
    
    // Таблица API эндпоинтов
    const apiTable = () => {
        if (groups.api.length === 0) {
            return '<div class="empty-state">API эндпоинты не обнаружены</div>';
        }
        
        const rows = groups.api.map((item, idx) => {
            const risk = item.risk || 'info';
            const riskLabel = riskNames[risk] || riskNames.info;
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td class="path-cell"><code>${escapeHtml(item.path)}</code></td>
                    <td class="status-cell">${item.status || '?'}</td>
                    <td class="risk-cell risk-${risk}">${riskLabel}</td>
                    <td class="desc-cell">${escapeHtml(item.recommendation || 'API эндпоинт')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="apiTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>API путь</th><th style="width:80px">HTTP</th><th style="width:110px">Риск</th><th>Описание</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего API эндпоинтов: ${groups.api.length}</div>
        `;
    };
    
    // Таблица файлов
    const filesTable = () => {
        if (groups.files.length === 0) {
            return '<div class="empty-state">Файлы не обнаружены</div>';
        }
        
        const rows = groups.files.map((item, idx) => {
            const risk = item.risk || 'info';
            const riskLabel = riskNames[risk] || riskNames.info;
            const fileName = item.path ? item.path.split('/').pop() : '—';
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td class="path-cell"><code>${escapeHtml(fileName)}</code><br><small class="path-sm">${escapeHtml(item.path)}</small></td>
                    <td class="status-cell">${item.status || '?'}</td>
                    <td class="risk-cell risk-${risk}">${riskLabel}</td>
                    <td class="desc-cell">${escapeHtml(item.recommendation || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="filesTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Файл</th><th style="width:80px">HTTP</th><th style="width:110px">Риск</th><th>Описание</th><tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего файлов: ${groups.files.length}</div>
        `;
    };
    
    // Таблица субдоменов
    const subdomainsTable = () => {
        if ((!subdomainsData.subdomains || subdomainsData.subdomains.length === 0) && groups.subdomains.size === 0) {
            return '<div class="empty-state">Субдомены не обнаружены</div>';
        }
        
        let rows = '';
        if (subdomainsData.subdomains && subdomainsData.subdomains.length > 0) {
            rows += subdomainsData.subdomains.map((s, idx) => `
                <tr>
                    <td class="index-cell">${idx + 1}</td>
                    <td class="domain-cell"><a href="https://${escapeHtml(s.domain)}" target="_blank">${escapeHtml(s.domain)}</a></td>
                    <td class="ip-cell">${s.ip || '—'}</td>
                    <td class="status-cell"><span class="status-badge status-active">обнаружен</span></td>
                </tr>
            `).join('');
        }
        
        for (const [subdomain, items] of groups.subdomains) {
            rows += `
                <tr>
                    <td class="index-cell">—</td>
                    <td class="domain-cell"><a href="https://${escapeHtml(subdomain)}" target="_blank">${escapeHtml(subdomain)}</a></td>
                    <td class="ip-cell">—</td>
                    <td class="status-cell"><span class="status-badge status-active">найдено ${items.length} путей</span></td>
                </tr>
            `;
        }
        
        return `
            <table class="data-table sortable" id="subdomainsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Субдомен</th><th>IP адрес</th><th>Статус</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего субдоменов: ${subdomainsData.subdomains?.length || groups.subdomains.size}</div>
        `;
    };
    
    // Таблица API из JS файлов
    const apiFromJSTable = () => {
        if (!apiFromJS.apiEndpoints || apiFromJS.apiEndpoints.length === 0) {
            return '<div class="empty-state">API вызовы в JS файлах не обнаружены</div>';
        }
        
        const rows = apiFromJS.apiEndpoints.slice(0, 100).map((api, idx) => {
            const methodClass = api.method === 'GET' ? 'method-get' : (api.method === 'POST' ? 'method-post' : (api.method === 'PUT' ? 'method-put' : 'method-other'));
            const sourceFile = api.sourceFile || api.source || '';
            const sourceFileName = sourceFile ? (sourceFile.split('/').pop() || sourceFile) : '—';
            
            return `
                <tr>
                    <td class="index-cell">${idx + 1}</td>
                    <td class="url-cell"><a href="${escapeHtml(api.url)}" target="_blank">${escapeHtml(api.url.length > 60 ? api.url.substring(0, 60) + '...' : api.url)}</a></td>
                    <td class="method-cell"><span class="method-badge ${methodClass}">${api.method}</span></td>
                    <td class="source-cell" title="${escapeHtml(sourceFile)}">${escapeHtml(sourceFileName)}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <div class="api-stats-info">Всего найдено API вызовов: ${apiFromJS.totalEndpointsFound} | Проанализировано JS файлов: ${apiFromJS.jsFilesAnalyzed?.length || 0}</div>
            <table class="data-table sortable" id="apiJsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>URL эндпоинта</th><th style="width:80px">Метод</th><th>Источник</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего API вызовов: ${apiFromJS.totalEndpointsFound}</div>
            ${apiFromJS.apiEndpoints.length > 100 ? '<div class="more-info">... и еще ' + (apiFromJS.apiEndpoints.length - 100) + ' записей</div>' : ''}
        `;
    };
    
    // Таблица безопасности
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
    
    // Таблица проблем
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
                                <td class="url-cell"><a href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(link.url.length > 60 ? link.url.substring(0, 60) + '...' : link.url)}</a></td>
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
            <div class="stat-card"><div class="stat-value">${groups.subdomains.size + (subdomainsData.subdomains?.length || 0)}</div><div class="stat-label">Субдомены</div></div>
            <div class="stat-card"><div class="stat-value">${groups.directories.length + groups.admin.length}</div><div class="stat-label">Директории</div></div>
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
        body { 
            font-family: 'Ubuntu', sans-serif; 
            background: #f0f2f5; 
            padding: 20px; 
            color: #1a1a2e; 
            font-size: 13px; 
        }
        .report-container { 
            max-width: 1400px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 16px; 
            box-shadow: 0 20px 60px rgba(0,0,0,0.3); 
            overflow: hidden; 
        }
        
        .report-header { 
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); 
            color: white; 
            padding: 30px 40px; 
        }
        .report-header h1 { font-size: 28px; margin-bottom: 8px; }
        .report-header .meta { color: #a0a0b0; font-size: 13px; margin-top: 12px; }
        
        .toolbar-buttons {
            display: flex;
            gap: 12px;
            margin-top: 16px;
            flex-wrap: wrap;
        }
        .toolbar-btn {
            background: rgba(255,255,255,0.2);
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Ubuntu', sans-serif;
            font-size: 13px;
            transition: all 0.2s;
        }
        .toolbar-btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-1px); }
        .toolbar-btn.html-btn { background: #6f42c1; }
        .toolbar-btn.html-btn:hover { background: #5a32a3; }
        .toolbar-btn.json-btn { background: #10b981; }
        .toolbar-btn.json-btn:hover { background: #0d9668; }
        
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); 
            gap: 16px; 
            padding: 30px; 
            background: #f8f9fa; 
            border-bottom: 1px solid #e9ecef; 
        }
        .stat-card { 
            background: white; 
            padding: 16px; 
            border-radius: 12px; 
            text-align: center; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
        }
        .stat-value { font-size: 32px; font-weight: 700; font-family: 'Alef', monospace; }
        .stat-label { font-size: 11px; color: #666; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .target-info { 
            background: #e9ecef; 
            padding: 20px; 
            margin: 20px 30px; 
            border-radius: 8px; 
        }
        .target-info .url { 
            font-family: monospace; 
            font-size: 13px; 
            margin-top: 8px; 
            word-break: break-all; 
        }
        
        .content { padding: 30px; }
        
        .metrics-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
            gap: 16px; 
            margin-bottom: 24px; 
        }
        .metric-block { 
            background: white; 
            padding: 14px 18px; 
            border-radius: 12px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
            border: 1px solid #e5e7eb; 
        }
        .metric-block.warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .metric-title { font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #555; }
        .metric-content { font-size: 12px; }
        .tech-tag { 
            display: inline-block; 
            background: #e9ecef; 
            padding: 4px 10px; 
            border-radius: 20px; 
            margin: 2px; 
            font-size: 11px; 
        }
        
        .api-stats-info { 
            background: #e9ecef; 
            padding: 10px 16px; 
            border-radius: 8px; 
            margin-bottom: 16px; 
            font-size: 12px; 
            font-weight: 500; 
        }
        
        .method-badge { 
            display: inline-block; 
            padding: 3px 8px; 
            border-radius: 4px; 
            font-size: 10px; 
            font-weight: 600; 
            color: white; 
        }
        .method-get { background: #28a745; }
        .method-post { background: #007bff; }
        .method-put { background: #fd7e14; }
        .method-delete { background: #dc3545; }
        .method-other { background: #6c757d; }
        
        .tabs { 
            display: flex; 
            flex-wrap: wrap; 
            gap: 4px; 
            margin-bottom: 0; 
            background: white; 
            border-radius: 12px 12px 0 0; 
            padding: 0 20px; 
            border-bottom: 2px solid #e0e0e0; 
        }
        .tab-btn { 
            background: none; 
            border: none; 
            padding: 12px 20px; 
            font-size: 13px; 
            font-weight: 500; 
            cursor: pointer; 
            color: #666; 
            transition: all 0.2s; 
            font-family: 'Ubuntu', sans-serif; 
        }
        .tab-btn:hover { color: #667eea; }
        .tab-btn.active { color: #667eea; border-bottom: 3px solid #667eea; }
        .tab-btn .tab-count { 
            background: #e9ecef; 
            padding: 2px 8px; 
            border-radius: 20px; 
            font-size: 10px; 
            margin-left: 8px; 
            color: #666; 
        }
        .tab-btn.active .tab-count { background: #667eea20; color: #667eea; }
        
        .tab-content { 
            display: none; 
            background: white; 
            border-radius: 0 0 12px 12px; 
            padding: 24px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
        }
        .tab-content.active { display: block; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        
        .data-table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 12px; 
        }
        .data-table th { 
            text-align: left; 
            padding: 10px 12px; 
            background: #f8f9fa; 
            border-bottom: 2px solid #e9ecef; 
            font-weight: 600; 
            color: #495057; 
            font-size: 12px; 
        }
        .data-table td { 
            padding: 8px 12px; 
            border-bottom: 1px solid #e9ecef; 
            vertical-align: top; 
            font-size: 12px; 
        }
        .data-table tr:hover { background: #f8f9fa; }
        
        .index-cell { 
            color: #6c757d; 
            font-weight: 500; 
            text-align: center; 
            width: 50px; 
        }
        .path-cell code { 
            background: #e9ecef; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px; 
            font-family: monospace; 
        }
        .path-sm { font-size: 10px; color: #999; }
        .status-cell { text-align: center; font-weight: 500; }
        .risk-cell { font-weight: 500; text-align: center; }
        .risk-critical { color: #dc3545; }
        .risk-high { color: #fd7e14; }
        .risk-medium { color: #ffc107; }
        .risk-low { color: #28a745; }
        .desc-cell { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .domain-cell a { color: #667eea; text-decoration: none; }
        .domain-cell a:hover { text-decoration: underline; }
        .ip-cell, .source-cell { font-family: monospace; color: #6c757d; font-size: 11px; }
        .url-cell { word-break: break-all; max-width: 400px; font-size: 11px; font-family: monospace; }
        .method-cell { text-align: center; }
        
        .risk-badge { 
            display: inline-block; 
            padding: 2px 8px; 
            border-radius: 4px; 
            font-size: 10px; 
            font-weight: 600; 
            color: white; 
        }
        .status-badge { 
            display: inline-block; 
            padding: 2px 8px; 
            border-radius: 4px; 
            font-size: 10px; 
        }
        .status-active { background: #d4edda; color: #155724; }
        
        .issue-remediation { 
            font-size: 10px; 
            color: #6c757d; 
            margin-top: 4px; 
            padding-top: 4px; 
            border-top: 1px dashed #e5e7eb; 
        }
        .issues-header { 
            background: #e9ecef; 
            padding: 10px 16px; 
            border-radius: 8px; 
            margin: 16px 0 16px 0; 
            font-size: 12px; 
            font-weight: 600; 
        }
        .sitemap-preview { 
            max-height: 200px; 
            overflow-y: auto; 
            border: 1px solid #e5e7eb; 
            border-radius: 8px; 
        }
        .sitemap-url { 
            padding: 6px 12px; 
            border-bottom: 1px solid #e5e7eb; 
            font-size: 11px; 
            word-break: break-all; 
        }
        .sitemap-url a { color: #667eea; text-decoration: none; }
        
        .empty-state { text-align: center; padding: 40px; color: #999; font-size: 13px; }
        .report-footer { 
            margin-top: 24px; 
            padding: 20px; 
            text-align: center; 
            font-size: 11px; 
            color: #999; 
            background: #f8f9fa; 
            border-top: 1px solid #e9ecef; 
        }
        
        .toolbar { 
            display: flex; 
            gap: 12px; 
            margin-bottom: 20px; 
            flex-wrap: wrap; 
        }
        .search-input { 
            flex: 1; 
            padding: 8px 12px; 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            font-size: 12px; 
            font-family: 'Ubuntu', sans-serif; 
        }
        .filter-select { 
            padding: 8px 12px; 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            background: white; 
            cursor: pointer; 
            font-size: 12px; 
            font-family: 'Ubuntu', sans-serif; 
        }
        
        .sortable th { cursor: pointer; user-select: none; }
        .sortable th:hover { background: #e9ecef; }
        .sortable th::after { content: ' ↕'; opacity: 0.3; font-size: 10px; }
        .sortable th.sorted-asc::after { content: ' ↑'; opacity: 1; }
        .sortable th.sorted-desc::after { content: ' ↓'; opacity: 1; }
        
        .table-footer, .more-info { 
            margin-top: 12px; 
            padding: 8px; 
            background: #f8f9fa; 
            text-align: center; 
            font-size: 11px; 
            color: #6c757d; 
            border-radius: 6px; 
        }
        .stats-info { 
            background: #e9ecef; 
            padding: 8px 12px; 
            border-radius: 6px; 
            margin-bottom: 12px; 
            font-size: 12px; 
        }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(4, 1fr); }
            .tab-btn { padding: 10px 14px; font-size: 12px; }
            .data-table td, .data-table th { padding: 6px 8px; }
            .desc-cell { max-width: 100px; }
            .report-header { padding: 20px; }
            .target-info { margin: 15px 20px; }
            .content { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1>Геркулес | Скаут</h1>
            <div class="meta">Дата генерации: ${reportDate} | Тип сканирования: Разведка веб-приложений</div>
            <div class="toolbar-buttons">
                <button class="toolbar-btn html-btn" id="downloadHtmlBtn">Скачать HTML</button>
                <button class="toolbar-btn json-btn" id="downloadJsonBtn">Скачать JSON</button>
            </div>
        </div>
        
        <div class="stats-grid">${statsHtml}</div>
        
        <div class="target-info">
            <div style="font-weight: 600;">Цель сканирования</div>
            <div class="url">${escapeHtml(baseUrl)}</div>
            <div style="font-size: 12px; color: #6c757d; margin-top: 8px;">Длительность: ${result.duration || '—'} сек</div>
        </div>
        
        <div class="content">
            ${metricsHtml}
            
            <div class="tabs" id="tabs">
                <button class="tab-btn active" data-tab="all">Все пути <span class="tab-count">${accessiblePaths.length}</span></button>
                <button class="tab-btn" data-tab="subdomains">Субдомены <span class="tab-count">${subdomainsData.subdomains?.length || 0}</span></button>
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
        </div>
        
        <div class="report-footer">
            <p>Сгенерировано с помощью Геркулес | Скаут - Инструмент разведки веб-приложений</p>
            <p>Всего обнаружено потенциально опасных путей: ${accessiblePaths.length}</p>
        </div>
    </div>
    
    <script>
    (function() {
        var reportData = ${JSON.stringify(result).replace(/</g, '\\u003c')};
        
        document.getElementById('downloadHtmlBtn').onclick = function() {
            var htmlContent = document.documentElement.outerHTML;
            var blob = new Blob([htmlContent], { type: 'text/html' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'scout-report-' + new Date().toISOString().split('T')[0] + '.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
        
        document.getElementById('downloadJsonBtn').onclick = function() {
            var blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'scout-report-' + new Date().toISOString().split('T')[0] + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
        
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
        
        makeSortable('allPathsTable');
        makeSortable('dirsTable');
        makeSortable('apiTable');
        makeSortable('filesTable');
        makeSortable('subdomainsTable');
        makeSortable('apiJsTable');
        
        setupFilter('allPathsTable', 'searchAll', 'filterAllRisk');
        setupFilter('dirsTable', 'searchDirs', 'filterDirsRisk');
        setupFilter('apiTable', 'searchApi', 'filterApiRisk');
        setupFilter('filesTable', 'searchFiles', 'filterFilesRisk');
    })();
    </script>
</body>
</html>`;
}