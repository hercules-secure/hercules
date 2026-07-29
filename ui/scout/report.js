// addons/scout/analyzer/report.js

// ============================================================
// ФУНКЦИЯ ГРУППИРОВКИ ПУТЕЙ (БЕЗ API)
// ============================================================

function groupPathsByType(paths, baseUrl) {
    const groups = {
        subdomains: new Map(),
        directories: [],
        files: [],
        admin: [],
        other: []
    };
    
    paths.forEach(item => {
        const path = item.path || '';
        const lowerPath = path.toLowerCase();
        
        // API исключаем полностью - это делает другой инструмент
        if (lowerPath.includes('/api/') || lowerPath.startsWith('/api')) {
            return; // пропускаем
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

// ============================================================
// ФУНКЦИЯ ГЕНЕРАЦИИ OSINT HTML
// ============================================================

function generateOsintHTML(osintData) {
    const emails = osintData.emails || [];
    const phones = osintData.phones || [];
    const socials = osintData.socials || [];
    const additional = osintData.additional || [];
    const hrContext = osintData.hrContext || null;
    
    let html = '';
    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    
    // HR контекст
    if (hrContext && hrContext.isHR) {
        const confidence = Math.round((hrContext.confidence || 0) * 100);
        const typeLabels = {
            'recruiter': 'Рекрутер',
            'hr': 'HR-специалист',
            'management': 'Руководство',
            'vacancy': 'Вакансия',
            'general': 'Общий'
        };
        const typeLabel = typeLabels[hrContext.type] || 'Общий';
        
        html += `
            <div style="background:#d1ecf1; padding:16px 20px; border-radius:12px; margin-bottom:20px; border-left:5px solid #17a2b8;">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <strong style="font-size:15px;">HR контекст обнаружен</strong>
                    <span style="background:#17a2b8; color:white; padding:2px 14px; border-radius:20px; font-size:12px; font-weight:600;">${escapeHtml(typeLabel)}</span>
                    <span style="background:#6c757d; color:white; padding:2px 10px; border-radius:20px; font-size:11px;">Уверенность: ${confidence}%</span>
                </div>
                ${hrContext.markers && hrContext.markers.length > 0 ? `
                    <div style="margin-top:8px; font-size:12px; color:#555;">
                        <strong>Маркеры:</strong> ${hrContext.markers.slice(0, 15).map(m => `<span style="background:#e9ecef; padding:2px 10px; border-radius:12px; margin:2px; display:inline-block; font-size:11px;">${escapeHtml(m)}</span>`).join('')}
                        ${hrContext.markers.length > 15 ? `... +${hrContext.markers.length - 15}` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    // Email
    html += `<div style="margin-bottom:20px;">`;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">`;
    html += `<h4 style="margin:0; font-size:14px;">Email адреса (${emails.length})</h4>`;
    html += `</div>`;
    
    if (emails.length === 0) {
        html += `<div style="text-align:center; padding:20px; color:#999; background:#f8f9fa; border-radius:8px; font-size:13px;">Email адреса не обнаружены</div>`;
    } else {
        html += `
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr style="background:#f1f3f5; border-bottom:2px solid #dee2e6;">
                        <th style="padding:10px 12px; text-align:left; font-weight:600; width:50px;">#</th>
                        <th style="padding:10px 12px; text-align:left; font-weight:600;">Email</th>
                        <th style="padding:10px 12px; text-align:left; font-weight:600;">Домен</th>
                        <th style="padding:10px 12px; text-align:left; font-weight:600;">Источник</th>
                    </tr>
                </thead>
                <tbody>
                    ${emails.map((item, idx) => `
                        <tr style="border-bottom:1px solid #e9ecef;">
                            <td style="padding:8px 12px; color:#6c757d;">${idx + 1}</td>
                            <td style="padding:8px 12px;"><code style="background:#f1f3f5; padding:2px 8px; border-radius:4px; font-size:12px;">${escapeHtml(item.email)}</code></td>
                            <td style="padding:8px 12px; font-size:12px;">${escapeHtml(item.domain || '—')}</td>
                            <td style="padding:8px 12px; font-size:12px; color:#666;">${escapeHtml(item.source || '—')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    html += `</div>`;
    
    // Телефоны
    html += `<div style="margin-bottom:20px;">`;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">`;
    html += `<h4 style="margin:0; font-size:14px;">Телефоны (${phones.length})</h4>`;
    html += `</div>`;
    
    if (phones.length === 0) {
        html += `<div style="text-align:center; padding:20px; color:#999; background:#f8f9fa; border-radius:8px; font-size:13px;">Телефоны не обнаружены</div>`;
    } else {
        html += `
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr style="background:#f1f3f5; border-bottom:2px solid #dee2e6;">
                        <th style="padding:10px 12px; text-align:left; font-weight:600; width:50px;">#</th>
                        <th style="padding:10px 12px; text-align:left; font-weight:600;">Телефон</th>
                        <th style="padding:10px 12px; text-align:left; font-weight:600;">Оригинал</th>
                        <th style="padding:10px 12px; text-align:left; font-weight:600;">Источник</th>
                    </tr>
                </thead>
                <tbody>
                    ${phones.map((item, idx) => `
                        <tr style="border-bottom:1px solid #e9ecef;">
                            <td style="padding:8px 12px; color:#6c757d;">${idx + 1}</td>
                            <td style="padding:8px 12px;"><code style="background:#f1f3f5; padding:2px 8px; border-radius:4px; font-size:12px; color:#e83e8c;">${escapeHtml(item.phone)}</code></td>
                            <td style="padding:8px 12px; font-size:12px; color:#666;">${escapeHtml(item.original || '—')}</td>
                            <td style="padding:8px 12px; font-size:12px; color:#666;">${escapeHtml(item.source || '—')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    html += `</div>`;
    
    // Соцсети
    html += `<div style="margin-bottom:20px;">`;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">`;
    html += `<h4 style="margin:0; font-size:14px;">Социальные сети (${socials.length})</h4>`;
    html += `</div>`;
    
    if (socials.length === 0) {
        html += `<div style="text-align:center; padding:20px; color:#999; background:#f8f9fa; border-radius:8px; font-size:13px;">Социальные сети не обнаружены</div>`;
    } else {
        html += `
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr style="background:#f1f3f5; border-bottom:2px solid #dee2e6;">
                        <th style="padding:10px 12px; text-align:left; font-weight:600; width:50px;">#</th>
                        <th style="padding:10px 12px; text-align:left; font-weight:600;">Платформа</th>
                        <th style="padding:10px 12px; text-align:left; font-weight:600;">URL</th>
                        <th style="padding:10px 12px; text-align:left; font-weight:600;">Username</th>
                    </tr>
                </thead>
                <tbody>
                    ${socials.map((item, idx) => `
                        <tr style="border-bottom:1px solid #e9ecef;">
                            <td style="padding:8px 12px; color:#6c757d;">${idx + 1}</td>
                            <td style="padding:8px 12px;"><span style="background:#e9ecef; padding:2px 10px; border-radius:12px; font-size:11px;">${escapeHtml(item.platform)}</span></td>
                            <td style="padding:8px 12px;"><a href="${escapeHtml(item.url)}" target="_blank" style="color:#667eea; text-decoration:none; font-size:12px;">${escapeHtml(item.url.length > 60 ? item.url.substring(0, 60) + '...' : item.url)}</a></td>
                            <td style="padding:8px 12px; font-size:12px; color:#666;">${escapeHtml(item.username || '—')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    html += `</div>`;
    
    // Additional
    if (additional.length > 0) {
        html += `<div style="margin-bottom:20px;">`;
        html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">`;
        html += `<h4 style="margin:0; font-size:14px;">Может быть интересно (${additional.length})</h4>`;
        html += `</div>`;
        
        const grouped = {};
        additional.forEach(item => {
            const type = item.type || 'unknown';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(item.value);
        });
        
        const typeLabels = {
            'name_ru': 'Русские имена',
            'name_en': 'Английские имена',
            'skype': 'Skype',
            'zoom': 'Zoom',
            'meet': 'Google Meet',
            'teams': 'Microsoft Teams',
            'ip': 'IP адреса',
            'uuid': 'UUID',
            'jwt': 'JWT токены',
            'api_key': 'API ключи',
            'bitcoin': 'Bitcoin'
        };
        
        let allRows = '';
        let rowIndex = 0;
        
        for (const [type, values] of Object.entries(grouped)) {
            const label = typeLabels[type] || type;
            for (const value of values) {
                rowIndex++;
                allRows += `
                    <tr>
                        <td class="index-cell">${rowIndex}</td>
                        <td><span style="background:#e9ecef; padding:2px 10px; border-radius:12px; font-size:11px;">${escapeHtml(label)}</span></td>
                        <td><code style="background:#f8f9fa; padding:4px 8px; border-radius:4px; font-size:12px; word-break:break-all;">${escapeHtml(value)}</code></td>
                    </tr>
                `;
            }
        }
        
        html += `
            <table class="data-table sortable" id="additionalTable">
                <thead>
                    <tr><th style="width:50px;">#</th><th style="width:150px;">Тип</th><th>Значение</th></tr>
                </thead>
                <tbody>${allRows}</tbody>
            </table>
            <div class="table-footer">Всего записей: ${additional.length}</div>
        `;
        
        html += `</div>`;
    }
    
    return html;
}

// ============================================================
// ФУНКЦИЯ ГЕНЕРАЦИИ HTML ОТЧЕТА (БЕЗ API)
// ============================================================

function generateScoutFullHTMLReport(result) {
    const summary = result.summary || { critical: 0, high: 0, medium: 0, low: 0 };
    
    // ============================================================
    // ОБРАБОТКА accessiblePaths ИЗ РАЗНЫХ ИСТОЧНИКОВ
    // ============================================================
    
    let accessiblePaths = [];
    
    if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
        accessiblePaths = result.pages.map(page => {
            let path = '';
            try {
                const url = new URL(page.url);
                path = url.pathname + url.search + url.hash;
            } catch (e) {
                path = page.url;
            }
            return {
                path: path || '/',
                status: page.status || 200,
                risk: 'info',
                description: page.title || '',
                url: page.url
            };
        });
    } else if (result.accessiblePaths && Array.isArray(result.accessiblePaths)) {
        accessiblePaths = result.accessiblePaths;
    } else if (result.findings && result.findings.accessiblePaths && Array.isArray(result.findings.accessiblePaths)) {
        accessiblePaths = result.findings.accessiblePaths;
    }
    
    const findings = result.findings || {};
    const tech = findings.tech || {};
    const secrets = findings.secrets || {};
    const quality = findings.quality || {};
    const wcag = findings.wcag || {};
    const mobile = findings.mobile || {};
    const performance = findings.performance || {};
    const subdomainsData = findings.subdomains || {};
    const headers = findings.headers || {};
    const cookies = findings.cookies || {};
    const ssl = findings.ssl || {};
    const ports = findings.ports || {};
    const robots = findings.robots || {};
    const sitemap = findings.sitemap || {};
    const links = findings.links || {};
    
    // Безопасное получение DOM
    let domIssues = [];
    if (findings.dom) {
        if (Array.isArray(findings.dom)) {
            domIssues = findings.dom;
        } else if (typeof findings.dom === 'object') {
            domIssues = findings.dom.issues || findings.dom.items || findings.dom.data || [];
            if (!Array.isArray(domIssues)) {
                domIssues = [];
            }
        }
    }
    const s3 = findings.s3 || { issues: [] };
    
    const osint = result.osint || { 
        emails: [], 
        phones: [], 
        socials: [], 
        additional: [],
        hrContext: null,
        summary: { 
            totalEmails: 0, 
            totalPhones: 0, 
            totalSocials: 0, 
            totalAdditional: 0, 
            isHR: false 
        } 
    };
    
    const users = tech.users || [];
    const detectedCMS = tech.detectedCMS || null;
    
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
    
    function groupPathsByType(paths) {
        const groups = {
            subdomains: new Map(),
            directories: [],
            files: [],
            admin: [],
            other: []
        };
        
        if (!paths) return groups;
        
        paths.forEach(item => {
            const path = item.path || '';
            const lowerPath = path.toLowerCase();
            
            if (lowerPath.includes('/api/') || lowerPath.startsWith('/api')) {
                return;
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
    
    // ============================================================
    // ТАБЛИЦА СУБДОМЕНОВ
    // ============================================================
    
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
                    <td><span class="status-badge" style="background:${statusColor}; color:white; padding:2px 10px; border-radius:4px; font-size:11px;">${statusLabel}</span></td>
                    <td style="font-size:11px; color:#666;">${escapeHtml(s.title || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="subdomainsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Субдомен</th><th style="width:100px;">Статус</th><th>Заголовок</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего субдоменов: ${subdomainsList.length}</div>
        `;
    };
    
    // ============================================================
    // ТАБЛИЦА IP АДРЕСОВ
    // ============================================================
    
    const ipsTable = () => {
        if (ipsList.length === 0) {
            return '<div class="empty-state">IP адреса не обнаружены</div>';
        }
        
        const rows = ipsList.map((item, idx) => {
            const statusColor = item.status === '200' ? '#28a745' : (item.status === '302' ? '#ffc107' : (item.status === '404' ? '#dc3545' : '#6c757d'));
            
            return `
                <tr>
                    <td class="index-cell">${idx + 1}</td>
                    <td><code>${escapeHtml(item.ip)}</code></td>
                    <td><span class="status-badge" style="background:${statusColor}; color:white; padding:2px 10px; border-radius:4px; font-size:11px;">${item.status || 'unknown'}</span></td>
                    <td style="font-size:11px; color:#666;">${escapeHtml(item.source || '—')}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table class="data-table sortable" id="ipsTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>IP адрес</th><th style="width:100px;">Статус</th><th>Источник</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего IP адресов: ${ipsList.length}</div>
        `;
    };
    
    // ============================================================
    // ТАБЛИЦА S3
    // ============================================================
    
    const s3Table = () => {
        const s3Issues = s3.issues || [];
        if (s3Issues.length === 0) {
            return `
                <div class="stats-info">✅ Проблем с S3 бакетами не обнаружено</div>
                <div class="empty-state">S3 бакеты не найдены или не имеют проблем</div>
            `;
        }
        
        const rows = s3Issues.map((issue, idx) => {
            const severity = issue.severity || 'critical';
            const riskLabel = riskNames[severity] || riskNames.critical;
            const location = issue.location || '—';
            const remediation = issue.remediation || 'Рекомендация не указана';
            const statusCode = issue.statusCode || issue.status || '—';
            
            let statusColor = '#6c757d';
            let statusLabel = statusCode;
            if (statusCode === '200') { statusColor = '#28a745'; statusLabel = '200 OK'; }
            else if (statusCode === '403') { statusColor = '#dc3545'; statusLabel = '403 Forbidden'; }
            else if (statusCode === '404') { statusColor = '#fd7e14'; statusLabel = '404 Not Found'; }
            else if (statusCode === '500') { statusColor = '#dc3545'; statusLabel = '500 Error'; }
            else if (statusCode === '301' || statusCode === '302') { statusColor = '#ffc107'; statusLabel = statusCode + ' Redirect'; }
            
            return `
                <tr data-risk="${severity}">
                    <td class="index-cell">${idx + 1}</td>
                    <td style="font-weight:500;">${escapeHtml(issue.message)}</td>
                    <td style="font-size:11px; word-break:break-all;"><code>${escapeHtml(location)}</code></td>
                    <td><span class="status-badge" style="background:${statusColor}; color:white; padding:2px 10px; border-radius:4px; font-size:11px;">${statusLabel}</span></td>
                    <td class="risk-cell risk-${severity}" style="font-weight:600;">${riskLabel}</td>
                    <td style="font-size:11px; color:#6c757d;">${escapeHtml(remediation)}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <div style="background:#fff3cd; padding:12px 16px; border-radius:8px; margin-bottom:16px; border-left:4px solid #dc3545;">
                <strong style="color:#856404;">⚠️ Обнаружены проблемы с S3 бакетами (${s3Issues.length})</strong>
                <div style="font-size:12px; color:#856404; margin-top:4px;">Открытые S3 бакеты могут привести к утечке конфиденциальных данных</div>
            </div>
            <div class="toolbar">
                <input type="text" class="search-input" id="searchS3" placeholder="Поиск по бакету или сообщению...">
                <select class="filter-select" id="filterS3Risk">
                    <option value="all">Все риски</option>
                    <option value="critical">Критические</option>
                    <option value="high">Высокие</option>
                    <option value="medium">Средние</option>
                    <option value="low">Низкие</option>
                </select>
                <select class="filter-select" id="filterS3Status">
                    <option value="all">Все статусы</option>
                    <option value="200">200 OK</option>
                    <option value="403">403 Forbidden</option>
                    <option value="404">404 Not Found</option>
                    <option value="500">500 Error</option>
                </select>
            </div>
            <table class="data-table sortable" id="s3Table">
                <thead>
                    <tr>
                        <th style="width:50px">#</th>
                        <th>Проблема</th>
                        <th style="min-width:200px;">Локация</th>
                        <th style="width:120px;">Код ответа</th>
                        <th style="width:110px;">Риск</th>
                        <th>Рекомендация</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего проблем с S3: ${s3Issues.length}</div>
        `;
    };
    
    // ============================================================
    // ТАБЛИЦА ДИРЕКТОРИЙ
    // ============================================================
    
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
                    <td class="truncate">${escapeHtml(item.description || '—')}</td>
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
    
    // ============================================================
    // ТАБЛИЦА ФАЙЛОВ
    // ============================================================
    
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
    
    // ============================================================
    // ТАБЛИЦА ВСЕХ ПУТЕЙ
    // ============================================================
    
    const allPathsTable = () => {
        if (accessiblePaths.length === 0) {
            return '<div class="empty-state">Пути не обнаружены</div>';
        }
        
        const rows = accessiblePaths.map((item, idx) => {
            const risk = item.risk || 'info';
            const displayPath = item.path || '/';
            const displayUrl = item.url || baseUrl + displayPath;
            return `
                <tr data-risk="${risk}">
                    <td class="index-cell">${idx + 1}</td>
                    <td><a href="${escapeHtml(displayUrl)}" target="_blank"><code>${escapeHtml(displayPath)}</code></a></td>
                    <td style="text-align:center">${item.status || '?'}</td>
                    <td><span class="risk-badge" style="background:${riskColors[risk]}">${riskNames[risk]}</span></td>
                    <td class="truncate">${escapeHtml(item.description || '—')}</td>
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
    
    // ============================================================
    // ТАБЛИЦА ПРОБЛЕМ БЕЗОПАСНОСТИ (С КОЛОНКОЙ "СТРАНИЦА")
    // ============================================================
    
    const securityTable = () => {
        let html = '';
        
        // Заголовки безопасности
        if (headers.issues && headers.issues.length > 0) {
            html += '<div class="issues-header">Заголовки безопасности</div>';
            html += `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:50px">#</th>
                            <th>Проблема</th>
                            <th style="width:100px">Риск</th>
                            <th style="min-width:200px;">Страница</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${headers.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>
                                    ${escapeHtml(issue.message)}
                                    ${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}
                                </td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                                <td style="font-size:11px;">
                                    ${issue.url ? `<a href="${escapeHtml(issue.url)}" target="_blank" style="color:#667eea;">${escapeHtml(issue.url)}</a>` : '—'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        // Cookies
        if (cookies.issues && cookies.issues.length > 0) {
            html += '<div class="issues-header">Cookies безопасность</div>';
            html += `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:50px">#</th>
                            <th>Проблема</th>
                            <th style="width:100px">Риск</th>
                            <th style="min-width:200px;">Страница</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cookies.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>
                                    ${escapeHtml(issue.message)}
                                    ${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}
                                </td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                                <td style="font-size:11px;">
                                    ${issue.url ? `<a href="${escapeHtml(issue.url)}" target="_blank" style="color:#667eea;">${escapeHtml(issue.url)}</a>` : '—'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        // SSL/TLS
        if (ssl.issues && ssl.issues.length > 0) {
            html += '<div class="issues-header">SSL/TLS</div>';
            html += `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:50px">#</th>
                            <th>Проблема</th>
                            <th style="width:100px">Риск</th>
                            <th style="min-width:200px;">Страница</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ssl.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>
                                    ${escapeHtml(issue.message)}
                                    ${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}
                                </td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                                <td style="font-size:11px;">
                                    ${issue.url ? `<a href="${escapeHtml(issue.url)}" target="_blank" style="color:#667eea;">${escapeHtml(issue.url)}</a>` : '—'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        // Открытые порты
        // if (ports.issues && ports.issues.length > 0) {
        //     html += '<div class="issues-header">Открытые порты</div>';
        //     html += `
        //         <table class="data-table">
        //             <thead>
        //                 <tr>
        //                     <th style="width:50px">#</th>
        //                     <th>Порт</th>
        //                     <th style="width:100px">Риск</th>
        //                     <th style="min-width:200px;">Страница</th>
        //                 </tr>
        //             </thead>
        //             <tbody>
        //                 ${ports.issues.map((port, idx) => `
        //                     <tr>
        //                         <td class="index-cell">${idx + 1}</td>
        //                         <td>${escapeHtml(port.message)}</td>
        //                         <td class="risk-cell risk-${port.severity}">${riskNames[port.severity] || 'Низкий'}</td>
        //                         <td style="font-size:11px;">
        //                             ${port.url ? `<a href="${escapeHtml(port.url)}" target="_blank" style="color:#667eea;">${escapeHtml(port.pageTitle || port.url)}</a>` : '—'}
        //                         </td>
        //                     </tr>
        //                 `).join('')}
        //             </tbody>
        //         </table>
        //     `;
        // }
        
        if (html === '') {
            return '<div class="empty-state">Проблем безопасности не обнаружено</div>';
        }
        
        return html;
    };
    
    // ============================================================
    // ТАБЛИЦА СТРУКТУРЫ
    // ============================================================
    
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
    
    // ============================================================
    // ТАБЛИЦА ВСЕХ ПРОБЛЕМ (С КОЛОНКОЙ "СТРАНИЦА")
    // ============================================================
    
    const allIssuesTable = () => {
        let html = '';
        
        // Битые ссылки
        html += '<div class="issues-header">Битые ссылки</div>';
        if (!links.brokenLinks || links.brokenLinks.length === 0) {
            html += '<div class="empty-state">Битых ссылок не обнаружено</div>';
        } else {
            html += `<div class="stats-info">Всего битых ссылок: ${links.brokenLinks.length}</div>`;
            html += `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:50px">#</th>
                            <th>URL</th>
                            <th style="width:80px">Статус</th>
                            <th style="min-width:200px;">Страница</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${links.brokenLinks.slice(0, 50).map((link, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td class="truncate"><a href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(link.url)}</a></td>
                                <td class="status-cell status-${link.status === 'timeout' ? 'timeout' : link.status}">${link.status}</td>
                                <td style="font-size:11px;">
                                    ${link.pageUrl ? `<a href="${escapeHtml(link.pageUrl)}" target="_blank" style="color:#667eea;">${escapeHtml(link.pageUrl)}</a>` : '—'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${links.brokenLinks.length > 50 ? `<div class="more-info">... и еще ${links.brokenLinks.length - 50} ссылок</div>` : ''}
            `;
        }
        
        // DOM уязвимости
        html += '<div class="issues-header" style="margin-top: 20px;">DOM уязвимости</div>';
        if (!domIssues || domIssues.length === 0) {
            html += '<div class="empty-state">DOM уязвимостей не обнаружено</div>';
        } else {
            html += `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:50px">#</th>
                            <th>Уязвимость</th>
                            <th style="width:100px">Риск</th>
                            <th style="min-width:200px;">Страница</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${domIssues.map((item, idx) => {
                            // Если есть result и это массив - показываем все элементы
                            if (item.result && Array.isArray(item.result) && item.result.length > 0) {
                                return item.result.map((vuln, subIdx) => {
                                    const name = vuln.message || vuln.title || vuln.name || vuln.description || vuln.text || vuln.issue || vuln.type || 'DOM уязвимость';
                                    const remediation = vuln.remediation || vuln.fix || vuln.solution || vuln.recommendation || '';
                                    const severity = vuln.severity || vuln.risk || vuln.level || 'info';
                                    const url = vuln.url || item.url || '';
                                    const pageTitle = vuln.pageTitle || item.title || url;
                                    
                                    return `
                                        <tr>
                                            <td class="index-cell">${idx + 1}.${subIdx + 1}</td>
                                            <td>
                                                <strong>${escapeHtml(name)}</strong>
                                                ${remediation ? `<div class="issue-remediation">${escapeHtml(remediation)}</div>` : ''}
                                            </td>
                                            <td class="risk-cell risk-${severity}">${riskNames[severity] || 'Информационный'}</td>
                                            <td style="font-size:11px;">
                                                ${url ? `<a href="${escapeHtml(url)}" target="_blank" style="color:#667eea;">${escapeHtml(url)}</a>` : '—'}
                                            </td>
                                        </tr>
                                    `;
                                }).join('');
                            } else {
                                // Если нет result - показываем сам item
                                const name = item.message || item.title || item.name || item.description || item.text || item.issue || item.type || 'DOM уязвимость';
                                const remediation = item.remediation || item.fix || item.solution || item.recommendation || '';
                                const severity = item.severity || item.risk || item.level || 'info';
                                const url = item.url || item.pageUrl || '';
                                const pageTitle = item.pageTitle || item.title || url;
                                
                                return `
                                    <tr>
                                        <td class="index-cell">${idx + 1}</td>
                                        <td>
                                            <strong>${escapeHtml(name)}</strong>
                                            ${remediation ? `<div class="issue-remediation">💡 ${escapeHtml(remediation)}</div>` : ''}
                                        </td>
                                        <td class="risk-cell risk-${severity}">${riskNames[severity] || 'Информационный'}</td>
                                        <td style="font-size:11px;">
                                            ${url ? `<a href="${escapeHtml(url)}" target="_blank" style="color:#667eea;">${escapeHtml(url)}</a>` : '—'}
                                        </td>
                                    </tr>
                                `;
                            }
                        }).join('')}
                    </tbody>
                </table>
            `;
        }
        
        // WCAG проблемы
        if (wcag.issues && wcag.issues.length > 0) {
            html += '<div class="issues-header" style="margin-top: 20px;">WCAG проблемы доступности</div>';
            html += `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:50px">#</th>
                            <th>Проблема</th>
                            <th style="width:100px">Риск</th>
                            <th style="min-width:200px;">Страница</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${wcag.issues.map((issue, idx) => `
                            <tr>
                                <td class="index-cell">${idx + 1}</td>
                                <td>
                                    ${escapeHtml(issue.message)}
                                    ${issue.remediation ? `<div class="issue-remediation">${escapeHtml(issue.remediation)}</div>` : ''}
                                </td>
                                <td class="risk-cell risk-${issue.severity}">${riskNames[issue.severity] || 'Информационный'}</td>
                                <td style="font-size:11px;">
                                    ${issue.url ? `<a href="${escapeHtml(issue.url)}" target="_blank" style="color:#667eea;">${escapeHtml(issue.url)}</a>` : '—'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        return html;
    };
    
    // ============================================================
    // ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ
    // ============================================================
    
    const usersTable = () => {
        if (!users || users.length === 0) {
            return '<div class="empty-state">Пользователи не обнаружены</div>';
        }
        
        const rows = users.map((user, idx) => {
            const slug = user.slug || '—';
            return `
                <tr>
                    <td class="index-cell">${idx + 1}</td>
                    <td><code>${escapeHtml(slug)}</code></td>
                </tr>
            `;
        }).join('');
        
        return `
            <div class="stats-info">Обнаружено ${users.length} пользователей${detectedCMS ? ` (${detectedCMS})` : ''}</div>
            <table class="data-table sortable" id="usersTable">
                <thead>
                    <tr><th style="width:50px">#</th><th>Логин (slug)</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="table-footer">Всего пользователей: ${users.length}</div>
        `;
    };
    
    // ============================================================
    // СТАТИСТИКА
    // ============================================================
    
    const s3IssuesCount = s3.issues?.length || 0;
    
    const statsHtml = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value" style="color:#dc3545">${summary.critical || 0}</div><div class="stat-label">Критические</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#fd7e14">${summary.high || 0}</div><div class="stat-label">Высокие</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#ffc107">${summary.medium || 0}</div><div class="stat-label">Средние</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#28a745">${summary.low || 0}</div><div class="stat-label">Низкие</div></div>
            <div class="stat-card"><div class="stat-value">${accessiblePaths.length}</div><div class="stat-label">Всего путей</div></div>
            <div class="stat-card"><div class="stat-value">${subdomainsList.length}</div><div class="stat-label">Субдомены</div></div>
            <div class="stat-card"><div class="stat-value">${ipsList.length}</div><div class="stat-label">IP адреса</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#667eea">${osint.summary.totalEmails || 0}</div><div class="stat-label">Email</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#e83e8c">${osint.summary.totalPhones || 0}</div><div class="stat-label">Телефоны</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#20c997">${osint.summary.totalSocials || 0}</div><div class="stat-label">Соцсети</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#6610f2">${users.length || 0}</div><div class="stat-label">Пользователи</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#dc3545">${s3IssuesCount}</div><div class="stat-label">S3 проблемы</div></div>
        </div>
    `;
    
    const metricsHtml = `
        <div class="metrics-grid">
            ${tech.technologies && tech.technologies.length > 0 ? `
            <div class="metric-block">
                <div class="metric-title">Технологии</div>
                <div class="metric-content">${tech.technologies.map(t => `<span class="tech-tag">${escapeHtml(t.name)} ${t.version ? escapeHtml(t.version) : ''}</span>`).join('')}</div>
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
            ${s3IssuesCount > 0 ? `
            <div class="metric-block warning" style="border-left: 4px solid #dc3545;">
                <div class="metric-title" style="color:#dc3545;">⚠️ S3 проблемы (${s3IssuesCount})</div>
                <div class="metric-content">${s3.issues.slice(0, 3).map(s => `<div style="font-size:11px; color:#666;">${escapeHtml(s.message)}</div>`).join('')}</div>
            </div>
            ` : ''}
        </div>
    `;
    
    const securityCount = (headers.issues?.length || 0) + (cookies.issues?.length || 0) + (ssl.issues?.length || 0) + (ports.issues?.length || 0);
    const structureCount = (robots.disallowed?.length || 0) + (sitemap.urls?.length || 0);
    const issuesCount = (links.brokenLinks?.length || 0) + (domIssues?.length || 0) + (wcag.issues?.length || 0);
    const osintCount = osint.summary.totalEmails + osint.summary.totalPhones + osint.summary.totalSocials;
    
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
        .search-input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 12px; font-family: 'Ubuntu', sans-serif; min-width: 150px; }
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
            <button class="tab-btn" data-tab="files">Файлы <span class="tab-count">${groups.files.length}</span></button>
            <button class="tab-btn" data-tab="security">Безопасность <span class="tab-count">${securityCount}</span></button>
            <button class="tab-btn" data-tab="s3">S3 бакеты <span class="tab-count">${s3IssuesCount}</span></button>
            <button class="tab-btn" data-tab="structure">Структура <span class="tab-count">${structureCount}</span></button>
            <button class="tab-btn" data-tab="issues">Проблемы <span class="tab-count">${issuesCount}</span></button>
            <button class="tab-btn" data-tab="osint">OSINT <span class="tab-count">${osintCount}</span></button>
            <button class="tab-btn" data-tab="users">Пользователи <span class="tab-count">${users.length || 0}</span></button>
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
        
        <div id="tab-s3" class="tab-content">
            ${s3Table()}
        </div>
        
        <div id="tab-structure" class="tab-content">
            ${structureTable()}
        </div>
        
        <div id="tab-issues" class="tab-content">
            ${allIssuesTable()}
        </div>
        
        <div id="tab-osint" class="tab-content">
            ${generateOsintHTML(osint)}
        </div>
        
        <div id="tab-users" class="tab-content">
            ${usersTable()}
        </div>
        
        <div class="report-footer">
            <p>Сгенерировано с помощью Геркулес | Скаут — инструмент разведки веб-приложений</p>
            <p>Всего обнаружено: ${accessiblePaths.length} путей | Субдоменов: ${subdomainsList.length} | IP адресов: ${ipsList.length} | Пользователей: ${users.length || 0}</p>
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
        
        function setupFilter(tableId, searchInputId, filterSelectId, statusSelectId) {
            var table = document.getElementById(tableId);
            if (!table) return;
            var searchInput = document.getElementById(searchInputId);
            var filterSelect = document.getElementById(filterSelectId);
            var statusSelect = document.getElementById(statusSelectId);
            
            function filterRows() {
                var searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
                var riskFilter = filterSelect ? filterSelect.value : 'all';
                var statusFilter = statusSelect ? statusSelect.value : 'all';
                var rows = table.querySelectorAll('tbody tr');
                rows.forEach(function(row) {
                    var text = row.cells[1] ? row.cells[1].textContent.toLowerCase() : '';
                    var risk = row.getAttribute('data-risk') || 'info';
                    var status = '';
                    if (row.cells[3]) {
                        var statusText = row.cells[3].textContent.trim();
                        if (statusText.includes('200')) status = '200';
                        else if (statusText.includes('403')) status = '403';
                        else if (statusText.includes('404')) status = '404';
                        else if (statusText.includes('500')) status = '500';
                    }
                    var matchesSearch = searchTerm === '' || text.indexOf(searchTerm) !== -1;
                    var matchesRisk = riskFilter === 'all' || risk === riskFilter;
                    var matchesStatus = statusFilter === 'all' || status === statusFilter;
                    row.style.display = (matchesSearch && matchesRisk && matchesStatus) ? '' : 'none';
                });
            }
            
            if (searchInput) searchInput.addEventListener('input', filterRows);
            if (filterSelect) filterSelect.addEventListener('change', filterRows);
            if (statusSelect) statusSelect.addEventListener('change', filterRows);
        }
        
        setTimeout(function() {
            makeSortable('allPathsTable');
            makeSortable('dirsTable');
            makeSortable('filesTable');
            makeSortable('subdomainsTable');
            makeSortable('ipsTable');
            makeSortable('usersTable');
            makeSortable('additionalTable');
            makeSortable('s3Table');
            
            setupFilter('allPathsTable', 'searchAll', 'filterAllRisk');
            setupFilter('dirsTable', 'searchDirs', 'filterDirsRisk');
            setupFilter('filesTable', 'searchFiles', 'filterFilesRisk');
            setupFilter('s3Table', 'searchS3', 'filterS3Risk', 'filterS3Status');
        }, 100);
    })();
    </script>
</body>
</html>`;
}

// ============================================================
// ФУНКЦИЯ showScoutReportModal
// ============================================================

function showScoutReportModal(result, onClose) {
    const html = generateScoutFullHTMLReport(result);
    
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
                <button id="modalDownloadHtml" style="background: #6f42c1; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-family: Ubuntu; font-size: 13px;">Скачать HTML</button>
                <button id="modalDownloadJson" style="background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-family: Ubuntu; font-size: 13px;">Скачать JSON</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const bodyContainer = overlay.querySelector('#modalBodyContainer');
    bodyContainer.innerHTML = html;
    
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
    
    overlay.querySelector('#modalDownloadHtml').addEventListener('click', () => {
        const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scout-report-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    overlay.querySelector('#modalDownloadJson').addEventListener('click', () => {
        const json = JSON.stringify(result, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scout-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
}

// ============================================================
// ЭКСПОРТ ФУНКЦИЙ
// ============================================================

window.generateScoutFullHTMLReport = generateScoutFullHTMLReport;
window.showScoutReportModal = showScoutReportModal;