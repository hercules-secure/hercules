// addons/blender/history.js
// Генерация HTML отчета из JSON - СВЕТЛАЯ ТЕМА

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function generateHTMLReport(report) {
    if (!report) {
        return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Нет данных</title></head><body><h1>Нет данных для отображения</h1></body></html>';
    }

    // SCA данные
    const dependencies = report.sca?.dependencies || [];
    const scaVulnerabilities = report.sca?.vulnerabilities || [];
    
    // SAST данные
    const sastIssues = report.sast?.issues || [];
    
    // Подсчет уязвимостей по severity
    const scaCritical = scaVulnerabilities.filter(v => v.severity === 'critical').length;
    const scaHigh = scaVulnerabilities.filter(v => v.severity === 'high').length;
    const scaMedium = scaVulnerabilities.filter(v => v.severity === 'medium').length;
    const scaLow = scaVulnerabilities.filter(v => v.severity === 'low').length;
    
    const sastCritical = sastIssues.filter(i => i.severity === 'CRITICAL').length;
    const sastHigh = sastIssues.filter(i => i.severity === 'HIGH').length;
    const sastMedium = sastIssues.filter(i => i.severity === 'MEDIUM').length;
    const sastLow = sastIssues.filter(i => i.severity === 'LOW').length;
    
    const totalDependencies = dependencies.length;
    const totalVulnerabilities = scaVulnerabilities.length + sastIssues.length;
    const totalCritical = scaCritical + sastCritical;
    const totalHigh = scaHigh + sastHigh;
    
    // Подсчет для фильтров SCA
    const reachableCount = dependencies.filter(d => d.isReachable === true).length;
    
    // Определяем тип источника для отображения мета-информации
    const isArchive = report.source?.endsWith('.zip') || report.source?.endsWith('.tar') || report.source?.endsWith('.gz');
    const metaBranch = !isArchive && report.branch && report.branch !== 'main' ? `<span><i class="fas fa-code-branch"></i> ${escapeHtml(report.branch)}</span>` : '';
    
    // Генерация SCA таблицы
    let scaRows = '';
    dependencies.forEach((dep, idx) => {
        const reachableText = dep.isReachable === true ? 'Да' : (dep.isReachable === false ? 'Нет' : 'Не определено');
        const reachableClass = dep.isReachable === true ? 'reachable-yes' : (dep.isReachable === false ? 'reachable-no' : 'reachable-unknown');
        
        let usageFilesHtml = '';
        if (dep.isReachable === true && dep.usageFiles && dep.usageFiles.length > 0) {
            usageFilesHtml = `
                <div class="usage-files">
                    <div class="usage-files-title"><i class="fas fa-file-code"></i> Файлы с использованием (${dep.usageFiles.length})</div>
                    <ul class="files-list">
                        ${dep.usageFiles.map(f => `<li><code>${escapeHtml(f)}</code></li>`).join('')}
                    </ul>
                </div>
            `;
        } else if (dep.isReachable === true && (!dep.usageFiles || dep.usageFiles.length === 0)) {
            usageFilesHtml = `
                <div class="usage-files warning">
                    <i class="fas fa-exclamation-triangle"></i> 
                    <span>Уязвимость достижима, но не найдены конкретные файлы использования</span>
                </div>
            `;
        }
        
        let cveHtml = '';
        if (dep.vulnerabilities?.vulnerabilities?.length) {
            cveHtml = `
                <div class="cve-section">
                    <div class="cve-title"><i class="fas fa-shield-alt"></i> Найденные уязвимости (${dep.vulnerabilities.vulnerabilities.length})</div>
                    <div class="cve-list">
                        ${dep.vulnerabilities.vulnerabilities.map(v => `
                            <div class="cve-item">
                                <div class="cve-header">
                                    <a href="https://osv.dev/vulnerability/${v.id}" target="_blank" class="cve-id">${v.id}</a>
                                    <span class="cve-severity ${v.severity || 'unknown'}">${v.severity || 'unknown'}</span>
                                </div>
                                <div class="cve-summary">${escapeHtml(v.summary || 'Нет описания')}</div>
                                <div class="cve-date"><i class="far fa-calendar-alt"></i> ${new Date(v.published).toLocaleDateString() || 'Дата неизвестна'}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        scaRows += `
            <tr class="dep-row" data-idx="${idx}" data-component="${escapeHtml(dep.name)}" data-reachable="${dep.isReachable}">
                <td class="expand-cell"><span class="expand-icon">▶</span></td>
                <td><strong>${escapeHtml(dep.name)}</strong>${dep.manager ? `<span class="manager-badge">${dep.manager}</span>` : ''}</td>
                <td><span class="version-text">${escapeHtml(dep.version || 'unknown')}</span></td>
                <td><span class="source-text">${escapeHtml(dep.file || '-')}</span></td>
                <td class="vuln-cell">${dep.cveCount > 0 ? `<span class="vuln-count">${dep.cveCount}</span>` : '<span class="no-vuln">✓ Нет</span>'}</td>
                <td><span class="license-badge ${dep.licenseInfo?.risk === 'high' ? 'license-high' : 'license-ok'}">${escapeHtml(dep.license || 'UNKNOWN')}</span></td>
                <td><span class="${reachableClass}">${reachableText}</span></td>
            </tr>
            <tr class="dep-details-row" data-idx="${idx}">
                <td colspan="7">
                    <div class="details-container">
                        <div class="details-header">
                            <div class="details-title">
                                <i class="fas fa-cube"></i> ${escapeHtml(dep.name)}
                                <span class="details-version">${escapeHtml(dep.version || 'unknown')}</span>
                            </div>
                        </div>
                        <div class="details-info">
                            <div class="info-row"><span class="info-label">Лицензия:</span> <span class="info-value">${escapeHtml(dep.license || 'UNKNOWN')}</span></div>
                            <div class="info-row"><span class="info-label">Менеджер:</span> <span class="info-value">${dep.manager || 'unknown'}</span></div>
                            <div class="info-row"><span class="info-label">Источник:</span> <span class="info-value">${escapeHtml(dep.file || '-')}</span></div>
                        </div>
                        ${usageFilesHtml}
                        ${cveHtml}
                    </div>
                </td>
            </tr>
        `;
    });
    
    // Генерация SAST таблицы
    let sastRows = '';
    const getSeverityColor = (severity) => {
        switch(severity) {
            case 'CRITICAL': return '#dc2626';
            case 'HIGH': return '#f97316';
            case 'MEDIUM': return '#eab308';
            case 'LOW': return '#22c55e';
            default: return '#3b82f6';
        }
    };
    
    const getSeverityBg = (severity) => {
        switch(severity) {
            case 'CRITICAL': return '#fee2e2';
            case 'HIGH': return '#ffedd5';
            case 'MEDIUM': return '#fef9c3';
            case 'LOW': return '#dcfce7';
            default: return '#f1f5f9';
        }
    };
    
    const shortenPath = (filePath) => {
        const parts = filePath.split('/');
        return parts.length > 3 ? '.../' + parts.slice(-2).join('/') : filePath;
    };
    
    const renderCodeBlock = (codeBlock) => {
        if (!codeBlock || !codeBlock.lines || codeBlock.lines.length === 0) return '';
        
        let html = '<div class="code-block"><div class="code-header"><i class="fas fa-code"></i> Код</div><pre>';
        for (const line of codeBlock.lines) {
            const lineNum = String(line.number).padStart(4, ' ');
            const prefix = line.isVulnerable ? '→' : ' ';
            const code = escapeHtml(line.code || '');
            html += `<div class="code-line ${line.isVulnerable ? 'vulnerable-line' : ''}">${prefix} ${lineNum} | ${code}</div>`;
        }
        html += '</pre></div>';
        return html;
    };
    
    sastIssues.forEach((issue, idx) => {
        const color = getSeverityColor(issue.severity);
        const bg = getSeverityBg(issue.severity);
        const file = shortenPath(issue.file);
        const fullPath = issue.file;
        const codeBlockHtml = renderCodeBlock(issue.codeBlock);
        const fileName = fullPath.split('/').pop(); // Только имя файла
        
        sastRows += `
            <tr class="sast-row" data-idx="${idx}" data-severity="${issue.severity.toLowerCase()}">
                <td class="expand-cell"><span class="sast-expand-icon">▶</span></td>
                <td><span class="severity-badge" style="background:${bg}; color:${color}">${issue.severity}</span></td>
                <td><code class="rule-id">${escapeHtml(issue.ruleId)}</code></td>
                <td class="message-cell">${escapeHtml(issue.message.substring(0, 120))}${issue.message.length > 120 ? '...' : ''}</td>
                <td class="file-cell" title="${escapeHtml(issue.file)}">${escapeHtml(fileName)}</td>
                <td class="line-cell">${issue.line}</td>
            </tr>
            <tr class="sast-details-row" data-idx="${idx}">
                <td colspan="6">
                    <div class="details-container">
                        <div class="details-header">
                            <div class="details-title">
                                <i class="fas fa-bug"></i> ${escapeHtml(issue.ruleId)}
                                <span class="severity-badge" style="background:${bg}; color:${color}">${issue.severity}</span>
                            </div>
                        </div>
                        <div class="details-message">${escapeHtml(issue.message)}</div>
                        <div class="details-location">
                            <i class="fas fa-map-marker-alt"></i> 
                            <code>${escapeHtml(issue.file)}:${issue.line}</code>
                        </div>
                        ${codeBlockHtml}
                        ${issue.recommendation ? `
                            <div class="recommendation">
                                <i class="fas fa-lightbulb"></i>
                                <div>
                                    <div class="recommendation-title">Рекомендация по исправлению</div>
                                    <div class="recommendation-text">${escapeHtml(issue.recommendation)}</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
    
    const sastEmpty = sastIssues.length === 0 ? `
        <div class="empty-state">
            <i class="fas fa-check-circle"></i>
            <h3>Проблем не найдено</h3>
            <p>SAST анализ не выявил уязвимостей в коде</p>
        </div>
    ` : `
        <div class="sast-table-wrapper">
            <table class="sast-table">
                <thead>
                    <tr>
                        <th style="width:30px"></th>
                        <th>Уровень</th>
                        <th>Правило</th>
                        <th>Описание</th>
                        <th>Файл</th>
                        <th style="width:60px">Строка</th>
                    </tr>
                </thead>
                <tbody>${sastRows}</tbody>
            </table>
        </div>
    `;
    
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Геркулес | Блендер - Отчет о безопасности</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Ubuntu',sans-serif;background:#f5f5f5;padding:24px;color:#1e293b}
        
        /* Контейнер */
        .container{max-width:1400px;margin:0 auto;background:white;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.1);overflow:hidden}
        
        /* Хедер черный */
        .header{background:#000000;padding:32px 40px;border-bottom:1px solid #1a1a1a;position:relative}
        .header-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:16px}
        .header h1{font-size:28px;display:flex;align-items:center;gap:12px;color:#ffffff;margin:0}
        .header h1 i{color:#667eea;font-size:32px}
        .header p{color:#94a3b8;font-size:14px;margin-bottom:16px}
        .meta{display:flex;gap:24px;font-size:13px;color:#94a3b8;flex-wrap:wrap}
        .meta span{display:flex;align-items:center;gap:6px}
        .meta i{font-size:12px;color:#667eea}
        
        /* Кнопка сохранения плоская в хедере */
        .save-btn{background:white;border:none;border-radius:8px;padding:8px 20px;color:#1e293b;font-family:'Ubuntu';font-weight:500;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all 0.2s ease;box-shadow:0 1px 2px rgba(0,0,0,0.1)}
        .save-btn:hover{background:#f1f5f9;transform:translateY(-1px)}
        .save-btn i{color:#667eea;font-size:14px}
        
        /* Табы */
        .tabs{display:flex;gap:4px;padding:0 40px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
        .tab{padding:14px 24px;background:none;border:none;font-size:14px;font-weight:500;color:#64748b;cursor:pointer;transition:all 0.2s;font-family:'Ubuntu';border-radius:8px 8px 0 0}
        .tab:hover{color:#667eea}
        .tab.active{color:#667eea;background:white;border-bottom:2px solid #667eea}
        .badge-count{display:inline-block;margin-left:6px;background:#e2e8f0;padding:0px 6px;border-radius:10px;font-size:11px;color:#64748b}
        
        /* Контент */
        .content{padding:32px 40px;background:white}
        .tab-pane{display:none}
        .tab-pane.active{display:block;animation:fadeIn 0.3s ease}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        
        /* Футер */
        .footer{padding:20px 40px;background:#f8fafc;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0}
        
        /* Статистика */
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:30px}
        .stat-card{background:#f8fafc;border-radius:16px;padding:24px;text-align:center;border:1px solid #e2e8f0;transition:transform 0.2s}
        .stat-card:hover{transform:translateY(-2px);border-color:#667eea}
        .stat-number{font-size:36px;font-weight:700;color:#667eea}
        .stat-label{font-size:13px;color:#64748b;margin-top:8px}
        
        /* Баннер риска */
        .risk-banner{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;padding:24px;margin-bottom:30px;text-align:center;color:white}
        .risk-banner .value{font-size:48px;font-weight:700}
        .risk-banner .label{font-size:14px;opacity:0.9}
        
        /* Категории */
        .categories{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px}
        .category{background:#f8fafc;border-radius:16px;padding:20px;border:1px solid #e2e8f0}
        .category h3{margin-bottom:16px;font-size:16px;display:flex;align-items:center;gap:8px;color:#1e293b}
        .category h3 i{color:#667eea}
        .category-badges{display:flex;gap:12px;flex-wrap:wrap}
        .badge{padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500}
        .badge-critical{background:#fee2e2;color:#dc2626}
        .badge-high{background:#ffedd5;color:#f97316}
        .badge-medium{background:#fef9c3;color:#ca8a04}
        .badge-low{background:#dcfce7;color:#16a34a}
        
        /* SCA секция */
        .sca-stats{display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap}
        .sca-stat-card{flex:1;background:#f8fafc;border-radius:12px;padding:16px;text-align:center;border:1px solid #e2e8f0}
        .sca-stat-number{font-size:28px;font-weight:700}
        .sca-stat-label{font-size:12px;color:#64748b;margin-top:6px}
        .filter-bar{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;align-items:center}
        .search-box{flex:1;min-width:200px;padding:10px 16px;background:white;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;color:#1e293b;font-family:'Ubuntu'}
        .search-box:focus{outline:none;border-color:#667eea}
        .search-box::placeholder{color:#94a3b8}
        .filter-group{display:flex;gap:8px;flex-wrap:wrap}
        .filter-btn{padding:6px 14px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:20px;cursor:pointer;font-size:12px;color:#64748b;transition:all 0.2s}
        .filter-btn:hover{border-color:#667eea;color:#667eea}
        .filter-btn.active{background:#667eea;color:white;border-color:#667eea}
        
        /* Таблицы */
        .dep-table,.sast-table{width:100%;border-collapse:collapse;font-size:13px;background:white;border-radius:12px;overflow:hidden}
        .dep-table th,.sast-table th{background:#f8fafc;padding:14px 12px;text-align:left;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0}
        .dep-table td,.sast-table td{padding:12px;border-bottom:1px solid #e2e8f0}
        .dep-row,.sast-row{cursor:pointer;transition:background 0.2s}
        .dep-row:hover,.sast-row:hover{background:#f8fafc}
        .expand-cell{width:30px;text-align:center}
        .expand-icon,.sast-expand-icon{transition:transform 0.2s;display:inline-block;font-size:12px;color:#667eea;cursor:pointer}
        .dep-details-row,.sast-details-row{display:none;background:#f8fafc}
        .dep-details-row.show,.sast-details-row.show{display:table-row}
        
        /* Детали */
        .details-container{background:#f8fafc;border-radius:12px;padding:20px;margin:8px;border:1px solid #e2e8f0}
        .details-header{margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0}
        .details-title{font-size:16px;font-weight:600;display:flex;align-items:center;gap:12px;flex-wrap:wrap;color:#1e293b}
        .details-version{font-size:12px;color:#64748b;font-weight:400}
        .details-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px}
        .info-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .info-label{font-size:12px;color:#64748b;min-width:70px}
        .info-value{font-size:13px;font-family:monospace;color:#1e293b}
        
        /* Файлы использования */
        .usage-files{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:16px}
        .usage-files-title{font-size:13px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px;color:#16a34a}
        .files-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}
        .files-list li{font-family:monospace;font-size:12px;padding:4px 8px;background:#f8fafc;border-radius:6px;}
        .files-list code{color:#1e293b}
        .usage-files.warning{background:#fffbeb;border-color:#fde68a}
        .usage-files.warning i{color:#f59e0b}
        
        /* CVE блок */
        .cve-section{margin-top:16px}
        .cve-title{font-size:13px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px;color:#dc2626}
        .cve-list{display:flex;flex-direction:column;gap:12px}
        .cve-item{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px}
        .cve-header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}
        .cve-id{font-family:monospace;font-size:12px;color:#3b82f6;text-decoration:none}
        .cve-id:hover{text-decoration:underline}
        .cve-severity{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600}
        .cve-severity.critical{background:#fee2e2;color:#dc2626}
        .cve-severity.high{background:#ffedd5;color:#f97316}
        .cve-severity.medium{background:#fef9c3;color:#ca8a04}
        .cve-severity.low{background:#dcfce7;color:#16a34a}
        .cve-severity.moderate{background:#fef9c3;color:#ca8a04}
        .cve-summary{font-size:12px;color:#475569;margin-bottom:8px;line-height:1.4}
        .cve-date{font-size:11px;color:#64748b;display:flex;align-items:center;gap:4px}
        
        /* Бейджи */
        .manager-badge{font-size:10px;background:#e2e8f0;padding:2px 8px;border-radius:12px;margin-left:8px;color:#64748b}
        .version-text{font-family:monospace;font-size:12px;color:#1e293b}
        .source-text{font-size:11px;color:#64748b;font-family:monospace}
        .vuln-count{background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:16px;font-weight:600;font-size:12px}
        .no-vuln{color:#22c55e}
        .license-badge{padding:4px 10px;border-radius:12px;font-size:11px;font-weight:500}
        .license-high{background:#fee2e2;color:#dc2626}
        .license-ok{background:#dcfce7;color:#16a34a}
        .reachable-yes{background:#fee2e2;color:#dc2626;padding:4px 10px;border-radius:12px;font-size:11px}
        .reachable-no{background:#dcfce7;color:#16a34a;padding:4px 10px;border-radius:12px;font-size:11px}
        .reachable-unknown{background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:12px;font-size:11px}
        
        /* SAST */
        .severity-badge{display:inline-block;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600}
        .rule-id{font-family:monospace;font-size:12px;color:#3b82f6}
        .message-cell{max-width:400px;color:#1e293b}
        .file-cell{font-family:monospace;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b}
        .line-cell{text-align:center;font-family:monospace;color:#1e293b}
        
        .details-message{background:#f8fafc;padding:12px;border-radius:10px;margin-bottom:16px;font-size:13px;line-height:1.5;color:#1e293b}
        .details-location{background:#f8fafc;padding:10px 12px;border-radius:10px;margin-bottom:16px;font-size:12px;font-family:monospace;display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0}
        
        /* Блок кода */
        .code-block{background:#1e293b;border-radius:12px;margin:16px 0;overflow:hidden}
        .code-header{background:#0f172a;padding:10px 16px;font-size:12px;font-weight:600;color:#94a3b8;border-bottom:1px solid #334155;display:flex;align-items:center;gap:8px}
        .code-block pre{margin:0;padding:16px;overflow-x:auto;font-family:monospace;font-size:12px;line-height:1.5}
        .code-line{color:#e2e8f0;white-space:pre;font-family:monospace}
        .code-line.vulnerable-line{background:#7f1a1a80;margin-left:-16px;padding-left:13px}
        
        /* Рекомендация */
        .recommendation{background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin-top:16px;display:flex;gap:12px}
        .recommendation i{font-size:20px;color:#f59e0b}
        .recommendation-title{font-size:13px;font-weight:600;margin-bottom:4px;color:#1e293b}
        .recommendation-text{font-size:12px;color:#475569;line-height:1.4}
        
        /* Пустое состояние */
        .empty-state{text-align:center;padding:60px 20px;background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0}
        .empty-state i{font-size:48px;color:#cbd5e1;margin-bottom:16px;display:block}
        .empty-state h3{font-size:18px;margin-bottom:8px;color:#1e293b}
        .empty-state p{font-size:14px;color:#64748b}
        
        /* Обертки таблиц */
        .sast-table-wrapper{overflow-x:auto}
        
        @media (max-width:768px){
            body{padding:12px}
            .header{padding:24px}
            .content{padding:20px}
            .tabs{padding:0 20px}
            .stats-grid{grid-template-columns:repeat(2,1fr)}
            .categories{grid-template-columns:1fr}
            .dep-table,.sast-table{font-size:11px}
            .dep-table td,.sast-table td{padding:8px}
            .message-cell{max-width:150px}
            .file-cell{max-width:120px}
            .header-top{flex-direction:column;align-items:flex-start}
        }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="header-top">
            <h1>Геркулес | Блендер</h1>
            <button class="save-btn" id="saveReportBtn">
                <i class="fas fa-download"></i>
                <span>Сохранить отчет</span>
            </button>
        </div>
        <p>Комплексный анализ безопасности кода</p>
        <div class="meta">
            <span><i class="fas fa-calendar"></i> ${new Date().toLocaleString()}</span>
            ${metaBranch}
            <span><i class="fas fa-link"></i> ${escapeHtml(report.source || 'Локальный анализ')}</span>
        </div>
    </div>
    
    <div class="tabs">
        <button class="tab active" data-tab="summary">Сводка</button>
        <button class="tab" data-tab="sca">SCA <span class="badge-count">${scaVulnerabilities.length}</span></button>
        <button class="tab" data-tab="sast">SAST <span class="badge-count">${sastIssues.length}</span></button>
    </div>
    
    <div class="content">
        <div class="tab-pane active" id="tab-summary">
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-number">${totalDependencies}</div><div class="stat-label">Зависимостей</div></div>
                <div class="stat-card"><div class="stat-number">${sastIssues.length}</div><div class="stat-label">SAST проблем</div></div>
                <div class="stat-card"><div class="stat-number">${scaVulnerabilities.length}</div><div class="stat-label">SCA уязвимостей</div></div>
            </div>
            <div class="risk-banner">
                <div class="label">Общий риск безопасности</div>
                <div class="value">${totalCritical + totalHigh}</div>
                <div class="label">критических и высоких уязвимостей</div>
            </div>
            <div class="categories">
                <div class="category">
                    <h3>Композиционный анализ</h3>
                    <div class="category-badges">
                        <span class="badge badge-critical">Critical ${scaCritical}</span>
                        <span class="badge badge-high">High ${scaHigh}</span>
                        <span class="badge badge-medium">Medium ${scaMedium}</span>
                        <span class="badge badge-low">Low ${scaLow}</span>
                    </div>
                </div>
                <div class="category">
                    <h3>Анализ исходного кода</h3>
                    <div class="category-badges">
                        <span class="badge badge-critical">Critical ${sastCritical}</span>
                        <span class="badge badge-high">High ${sastHigh}</span>
                        <span class="badge badge-medium">Medium ${sastMedium}</span>
                        <span class="badge badge-low">Low ${sastLow}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="tab-pane" id="tab-sca">
            <div class="sca-stats">
                <div class="sca-stat-card"><div class="sca-stat-number" style="color:#dc2626">${scaCritical}</div><div class="sca-stat-label">Critical</div></div>
                <div class="sca-stat-card"><div class="sca-stat-number" style="color:#f97316">${scaHigh}</div><div class="sca-stat-label">High</div></div>
                <div class="sca-stat-card"><div class="sca-stat-number" style="color:#eab308">${scaMedium}</div><div class="sca-stat-label">Medium</div></div>
                <div class="sca-stat-card"><div class="sca-stat-number" style="color:#22c55e">${scaLow}</div><div class="sca-stat-label">Low</div></div>
            </div>
            <div class="filter-bar">
                <input type="text" id="scaSearch" placeholder="Поиск по компоненту..." class="search-box">
                <div class="filter-group">
                    <button class="filter-btn active" data-filter="all">Все (${totalVulnerabilities})</button>
                    <button class="filter-btn" data-filter="critical">Critical (${scaCritical})</button>
                    <button class="filter-btn" data-filter="high">High (${scaHigh})</button>
                    <button class="filter-btn" data-filter="medium">Medium (${scaMedium})</button>
                    <button class="filter-btn" data-filter="low">Low (${scaLow})</button>
                    <button class="filter-btn" data-filter="reachable">Достижимые (${reachableCount})</button>
                </div>
            </div>
            <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                <h4 style="color:#64748b">Найдено зависимостей: ${totalDependencies}</h4>
                <span style="font-size:12px;color:#94a3b8"><i class="fas fa-info-circle"></i> Нажмите на строку для просмотра деталей</span>
            </div>
            <div style="overflow-x:auto">
                <table class="dep-table">
                    <thead>
                        <tr>
                            <th style="width:30px"></th>
                            <th>Пакет</th>
                            <th>Версия</th>
                            <th>Источник</th>
                            <th>Уязвимости</th>
                            <th>Лицензия</th>
                            <th>Достижимость</th>
                        </tr>
                    </thead>
                    <tbody>${scaRows}</tbody>
                </table>
            </div>
        </div>
        
        <div class="tab-pane" id="tab-sast">
            <div class="sca-stats">
                <div class="sca-stat-card"><div class="sca-stat-number" style="color:#dc2626">${sastCritical}</div><div class="sca-stat-label">Critical</div></div>
                <div class="sca-stat-card"><div class="sca-stat-number" style="color:#f97316">${sastHigh}</div><div class="sca-stat-label">High</div></div>
                <div class="sca-stat-card"><div class="sca-stat-number" style="color:#eab308">${sastMedium}</div><div class="sca-stat-label">Medium</div></div>
                <div class="sca-stat-card"><div class="sca-stat-number" style="color:#22c55e">${sastLow}</div><div class="sca-stat-label">Low</div></div>
            </div>
            <div class="filter-bar">
                <input type="text" id="sastSearch" placeholder="Поиск по файлу, правилу или описанию..." class="search-box">
                <div class="filter-group">
                    <button class="filter-btn active" data-filter="all">Все (${sastIssues.length})</button>
                    <button class="filter-btn" data-filter="critical">Critical (${sastCritical})</button>
                    <button class="filter-btn" data-filter="high">High (${sastHigh})</button>
                    <button class="filter-btn" data-filter="medium">Medium (${sastMedium})</button>
                    <button class="filter-btn" data-filter="low">Low (${sastLow})</button>
                </div>
            </div>
            ${sastEmpty}
        </div>
    </div>
    
    <div class="footer">
        <p>Сгенерировано с помощью Геркулес | Блендер</p>
        <p style="margin-top:8px;font-size:11px">Анализ выполнен на основе данных SCA и SAST</p>
    </div>
</div>

<script>
    // Кнопка сохранения отчета
    document.getElementById('saveReportBtn')?.addEventListener('click', () => {
        const htmlContent = document.documentElement.outerHTML;
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'blender_report_' + new Date().toISOString().slice(0,19).replace(/:/g, '-') + '.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    // Табы
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + target).classList.add('active');
        });
    });
    
    // Раскрытие SCA
    document.querySelectorAll('.dep-row').forEach(row => {
        const icon = row.querySelector('.expand-icon');
        const details = row.nextElementSibling;
        if (details) {
            row.addEventListener('click', (e) => {
                if (e.target.classList?.contains('expand-icon')) return;
                details.classList.toggle('show');
                if(icon) icon.style.transform = details.classList.contains('show') ? 'rotate(90deg)' : 'rotate(0deg)';
            });
            if(icon) icon.addEventListener('click', (e) => {
                e.stopPropagation();
                details.classList.toggle('show');
                icon.style.transform = details.classList.contains('show') ? 'rotate(90deg)' : 'rotate(0deg)';
            });
        }
    });
    
    // Раскрытие SAST
    document.querySelectorAll('.sast-row').forEach(row => {
        const icon = row.querySelector('.sast-expand-icon');
        const details = row.nextElementSibling;
        if (details) {
            row.addEventListener('click', (e) => {
                if (e.target.classList?.contains('sast-expand-icon')) return;
                details.classList.toggle('show');
                if(icon) icon.style.transform = details.classList.contains('show') ? 'rotate(90deg)' : 'rotate(0deg)';
            });
            if(icon) icon.addEventListener('click', (e) => {
                e.stopPropagation();
                details.classList.toggle('show');
                icon.style.transform = details.classList.contains('show') ? 'rotate(90deg)' : 'rotate(0deg)';
            });
        }
    });
    
    // Фильтр SCA
    const scaSearch = document.getElementById('scaSearch');
    const scaBtns = document.querySelectorAll('#tab-sca .filter-btn');
    let currentScaFilter = 'all';
    
    function filterSca() {
        const search = scaSearch?.value.toLowerCase() || '';
        document.querySelectorAll('#tab-sca .dep-row').forEach(row => {
            const name = (row.querySelector('td:nth-child(2)')?.innerText || '').toLowerCase();
            const reachable = row.dataset.reachable === 'true';
            const vulnCount = parseInt(row.querySelector('.vuln-count')?.innerText || '0');
            
            let show = true;
            if (currentScaFilter === 'critical') show = vulnCount > 0;
            else if (currentScaFilter === 'high') show = vulnCount > 0;
            else if (currentScaFilter === 'reachable') show = reachable === true;
            else if (currentScaFilter !== 'all') show = true;
            
            if (search) show = show && name.includes(search);
            
            row.style.display = show ? '' : 'none';
            if (!show) {
                const details = row.nextElementSibling;
                if(details) details.classList.remove('show');
                const icon = row.querySelector('.expand-icon');
                if(icon) icon.style.transform = 'rotate(0deg)';
            }
        });
    }
    
    scaBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            scaBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentScaFilter = btn.dataset.filter;
            filterSca();
        });
    });
    if(scaSearch) scaSearch.addEventListener('input', filterSca);
    
    // Фильтр SAST
    const sastSearch = document.getElementById('sastSearch');
    const sastBtns = document.querySelectorAll('#tab-sast .filter-btn');
    let currentSastFilter = 'all';
    
    function filterSast() {
        const search = sastSearch?.value.toLowerCase() || '';
        document.querySelectorAll('#tab-sast .sast-row').forEach(row => {
            const severity = row.dataset.severity || '';
            let show = true;
            if (currentSastFilter !== 'all') show = severity === currentSastFilter;
            if (search) show = show;
            row.style.display = show ? '' : 'none';
            if (!show) {
                const details = row.nextElementSibling;
                if(details) details.classList.remove('show');
                const icon = row.querySelector('.sast-expand-icon');
                if(icon) icon.style.transform = 'rotate(0deg)';
            }
        });
    }
    
    sastBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sastBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSastFilter = btn.dataset.filter;
            filterSast();
        });
    });
    if(sastSearch) sastSearch.addEventListener('input', filterSast);
</script>
</body>
</html>`;
}