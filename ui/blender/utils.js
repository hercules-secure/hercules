// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Форматирование байтов
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Задержка
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Загрузка библиотеки JSZip
function loadJSZip() {
    return new Promise((resolve, reject) => {
        if (window.JSZip) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Не удалось загрузить JSZip'));
        document.head.appendChild(script);
    });
}

// Создание ZIP архива из файлов
async function createZipArchive(files, folderName) {
    try {
        if (!window.JSZip) {
            await loadJSZip();
        }

        const zip = new window.JSZip();

        for (const file of files) {
            let relativePath = file.webkitRelativePath || file.name;

            if (folderName && relativePath.startsWith(folderName)) {
                relativePath = relativePath.substring(folderName.length + 1);
            }

            if (!relativePath) continue;

            const arrayBuffer = await file.arrayBuffer();
            zip.file(relativePath, arrayBuffer);
        }

        return await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
    } catch (error) {
        throw error;
    }
}

// ========== ФУНКЦИИ ДЛЯ ГЕНЕРАЦИИ HTML ==========

// Получение цвета для метода API (оставлено для совместимости, но не используется)
function getMethodColor(method) {
    switch (method?.toUpperCase()) {
        case 'GET': return '#10b981';
        case 'POST': return '#3b82f6';
        case 'PUT': return '#f59e0b';
        case 'DELETE': return '#ef4444';
        case 'PATCH': return '#8b5cf6';
        default: return '#64748b';
    }
}

// Генерация HTML для зависимостей с достижимостью и раскрытием
export function generateDependenciesHTML(report) {
    let dependencies = [];
    let vulnerabilityStats = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
    };
    
    if (report.dependencies && Array.isArray(report.dependencies) && report.dependencies.length > 0) {
        dependencies = report.dependencies;
        
        for (const dep of dependencies) {
            const cveCount = typeof dep.cveCount === 'number' ? dep.cveCount : 0;
            vulnerabilityStats.total += cveCount;
            
            const cveSummary = dep.cveSummary || {};
            vulnerabilityStats.critical += typeof cveSummary.critical === 'number' ? cveSummary.critical : 0;
            vulnerabilityStats.high += typeof cveSummary.high === 'number' ? cveSummary.high : 0;
            vulnerabilityStats.medium += typeof cveSummary.medium === 'number' ? cveSummary.medium : 0;
            vulnerabilityStats.low += typeof cveSummary.low === 'number' ? cveSummary.low : 0;
        }
    } else if (report.sca?.dependencies && report.sca.dependencies.length > 0) {
        dependencies = report.sca.dependencies;
        
        for (const dep of dependencies) {
            if (dep.cveCount) vulnerabilityStats.total += dep.cveCount;
            if (dep.cveSummary) {
                vulnerabilityStats.critical += dep.cveSummary.critical || 0;
                vulnerabilityStats.high += dep.cveSummary.high || 0;
                vulnerabilityStats.medium += dep.cveSummary.medium || 0;
                vulnerabilityStats.low += dep.cveSummary.low || 0;
            }
        }
    }
    
    if (!dependencies?.length) {
        return '<div class="info-box">Зависимости не найдены</div>';
    }
    
    // Собираем все уязвимости для фильтрации
    let allVulnerabilities = [];
    for (const dep of dependencies) {
        if (dep.vulnerabilities && dep.vulnerabilities.vulnerabilities) {
            for (const vuln of dep.vulnerabilities.vulnerabilities) {
                allVulnerabilities.push({
                    ...vuln,
                    package: dep.name,
                    version: dep.version,
                    reachable: dep.isReachable,
                    usageFiles: dep.usageFiles || []
                });
            }
        }
    }
    
    const grouped = dependencies.reduce((acc, dep) => {
        const manager = dep.manager || 'unknown';
        if (!acc[manager]) acc[manager] = [];
        acc[manager].push(dep);
        return acc;
    }, {});
    
    let html = `
        <div class="vuln-stats" style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
            <div class="summary-card critical" style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                <div class="card-value" style="font-size: 28px; font-weight: 700; color: #dc2626;">${vulnerabilityStats.critical}</div>
                <div class="card-label" style="font-size: 12px; color: #64748b;">Critical</div>
            </div>
            <div class="summary-card high" style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                <div class="card-value" style="font-size: 28px; font-weight: 700; color: #f97316;">${vulnerabilityStats.high}</div>
                <div class="card-label" style="font-size: 12px; color: #64748b;">High</div>
            </div>
            <div class="summary-card medium" style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                <div class="card-value" style="font-size: 28px; font-weight: 700; color: #eab308;">${vulnerabilityStats.medium}</div>
                <div class="card-label" style="font-size: 12px; color: #64748b;">Medium</div>
            </div>
            <div class="summary-card low" style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                <div class="card-value" style="font-size: 28px; font-weight: 700; color: #22c55e;">${vulnerabilityStats.low}</div>
                <div class="card-label" style="font-size: 12px; color: #64748b;">Low</div>
            </div>
        </div>
        
        <!-- Строка поиска и фильтры -->
        <div class="filter-bar" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; align-items: center;">
            <input type="text" id="vulnSearch" placeholder="Поиск по компоненту или CVE..." class="search-box" style="flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 5px;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="filter-btn active" data-filter="all">Все (${allVulnerabilities.length})</button>
                <button class="filter-btn" data-filter="critical">Critical (${allVulnerabilities.filter(v => v.severity === 'critical').length})</button>
                <button class="filter-btn" data-filter="high">High (${allVulnerabilities.filter(v => v.severity === 'high').length})</button>
                <button class="filter-btn" data-filter="medium">Medium (${allVulnerabilities.filter(v => v.severity === 'medium').length})</button>
                <button class="filter-btn" data-filter="low">Low (${allVulnerabilities.filter(v => v.severity === 'low').length})</button>
                <button class="filter-btn" data-filter="reachable">Достижимые (${allVulnerabilities.filter(v => v.reachable === true).length})</button>
            </div>
        </div>
    `;
    
    html += `<h4 style="margin-bottom: 16px;">Найдено зависимостей: ${dependencies.length}</h4>`;
    
    for (const [manager, items] of Object.entries(grouped)) {
        html += `
            <div class="dep-group" style="margin-bottom: 24px;">
                <h5 style="margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #3b82f6; display: inline-flex; align-items: center; gap: 8px;">
                    <i class="fas fa-box"></i>
                    ${escapeHtml(manager).toUpperCase()}
                    <span style="font-size: 12px; font-weight: normal; color: #64748b;">(${items.length})</span>
                </h5>
                <div style="overflow-x: auto;">
                    <table class="dep-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="width: 30px; padding: 10px;"></th>
                                <th style="padding: 10px; text-align: left;">Пакет</th>
                                <th style="padding: 10px; text-align: left;">Версия</th>
                                <th style="padding: 10px; text-align: left;">Источник</th>
                                <th style="padding: 10px; text-align: center;">Уязвимости</th>
                                <th style="padding: 10px; text-align: left;">Лицензия</th>
                                <th style="padding: 10px; text-align: center;">Достижимость</th>
                            </tr>
                        </thead>
                        <tbody id="vulnTableBody">
                            ${items.map((dep, idx) => {
                                const reachableText = dep.isReachable === true ? 'Да' : (dep.isReachable === false ? 'Нет' : 'Не определено');
                                const reachableClass = dep.isReachable === true ? 'reachable-yes' : (dep.isReachable === false ? 'reachable-no' : 'reachable-unknown');
                                
                                return `
                                <tr class="dep-row" data-idx="${idx}" data-manager="${manager}" data-severity="${dep.cveSummary?.critical > 0 ? 'critical' : (dep.cveSummary?.high > 0 ? 'high' : '')}" data-reachable="${dep.isReachable}" data-component="${dep.name}" style="border-bottom: 1px solid #e2e8f0; cursor: pointer;">
                                    <td style="padding: 10px; text-align: center;">
                                        <span class="expand-icon" style="transition: transform 0.2s; display: inline-block;">▶</span>
                                    </td>
                                    <td style="padding: 10px;"><strong>${escapeHtml(dep.name)}</strong>${dep.type === 'development' ? '<span style="font-size: 10px; background: #e2e8f0; padding: 2px 6px; border-radius: 10px; margin-left: 8px;">dev</span>' : ''}</td>
                                    <td style="padding: 10px; font-family: monospace;">${escapeHtml(dep.version || 'unknown')}</td>
                                    <td style="padding: 10px; font-size: 11px; color: #64748b;">${escapeHtml(dep.file || '-')}</td>
                                    <td style="padding: 10px; text-align: center;">
                                        ${dep.cveCount > 0 ? `
                                            <span class="vuln-count" style="background: #f9731620; color: #f97316; padding: 2px 8px; border-radius: 16px; font-weight: 600; font-size: 12px;">
                                                ${dep.cveCount}
                                            </span>
                                        ` : `<span style="color: #10b981;">Нет</span>`}
                                    </td>
                                    <td style="padding: 10px;">
                                        <span style="background: #94a3b820; color: #94a3b8; padding: 4px 8px; border-radius: 12px; font-size: 11px;">
                                            ${escapeHtml(dep.license || 'UNKNOWN')}
                                        </span>
                                    </td>
                                    <td style="padding: 10px; text-align: center;">
                                        <span class="${reachableClass}" style="padding: 4px 8px; border-radius: 12px; font-size: 11px;">${reachableText}</span>
                                    </td>
                                </tr>
                                <tr class="dep-details-row" data-details-idx="${idx}" data-details-manager="${manager}" style="display: none; background: #f8fafc;">
                                    <td colspan="7" style="padding: 15px 20px;">
                                        <div style="background: white; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0;">
                                            <div><strong>Детали зависимости</strong></div>
                                            <div style="margin-top: 12px;">
                                                <strong>Лицензия:</strong> ${escapeHtml(dep.license || 'UNKNOWN')}
                                                ${dep.licenseInfo ? `<span style="margin-left: 12px; padding: 2px 8px; border-radius: 12px; font-size: 11px; background: ${dep.licenseInfo.risk === 'high' ? '#fee2e2' : '#dcfce7'}; color: ${dep.licenseInfo.risk === 'high' ? '#dc2626' : '#16a34a'};">${dep.licenseInfo.type || 'unknown'}</span>` : ''}
                                            </div>
                                            ${dep.licenseInfo?.recommendation ? `<div style="margin-top: 8px;"><strong>Рекомендация:</strong> ${escapeHtml(dep.licenseInfo.recommendation)}</div>` : ''}
                                            ${dep.usageFiles && dep.usageFiles.length > 0 ? `
                                                <div style="margin-top: 12px;">
                                                    <strong>Файлы с использованием (${dep.usageFiles.length}):</strong>
                                                    <ul style="margin-top: 8px; margin-left: 8px; list-style: none; padding-left: 0; max-height: 200px; overflow-y: auto;">
                                                        ${dep.usageFiles.map(f => `<li style="font-family: monospace; font-size: 12px; padding: 4px 0;">${escapeHtml(f)}</li>`).join('')}
                                                    </ul>
                                                </div>
                                                ` : dep.isReachable === true ? `
                                                <div style="margin-top: 12px; padding: 8px; background: #fee2e2; border-radius: 6px; color: #dc2626;">
                                                    <i class="fas fa-exclamation-triangle"></i> Уязвимость достижима, но не найдены конкретные файлы использования
                                                </div>
                                                ` : dep.isReachable === false ? `
                                                <div style="margin-top: 12px; padding: 8px; background: #dcfce7; border-radius: 6px; color: #16a34a;">
                                                    <i class="fas fa-check-circle"></i> Уязвимость не достижима - компонент не используется в коде
                                                </div>
                                                ` : ''}
                                                ${dep.vulnerabilities && dep.vulnerabilities.vulnerabilities ? `
                                                <div style="margin-top: 12px;">
                                                    <strong>Найденные CVE (${dep.vulnerabilities.vulnerabilities.length}):</strong>
                                                    <div style="max-height: 300px; overflow-y: auto; margin-top: 8px;">
                                                        ${dep.vulnerabilities.vulnerabilities.map(v => `
                                                            <div style="padding: 6px 0; border-bottom: 1px solid #e2e8f0;">
                                                                <a href="https://osv.dev/vulnerability/${v.id}" target="_blank" style="color: #3b82f6;">${escapeHtml(v.id)}</a>
                                                                <span style="margin-left: 8px; padding: 2px 6px; border-radius: 10px; font-size: 10px; background: ${v.severity === 'critical' ? '#fee2e2' : '#ffedd5'}; color: ${v.severity === 'critical' ? '#dc2626' : '#f97316'};">${v.severity || 'unknown'}</span>
                                                                <span style="margin-left: 8px; font-size: 11px; color: #64748b;">${escapeHtml((v.summary || '').substring(0, 80))}${(v.summary || '').length > 80 ? '...' : ''}</span>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                </div>
                                                ` : ''}
                                        </div>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // Добавляем обработчики раскрытия и фильтрации
    setTimeout(() => {
        // Обработчики раскрытия
        const rows = document.querySelectorAll('.dep-row');
        rows.forEach(row => {
            row.onclick = (e) => {
                if (e.target.tagName === 'A') return;
                const idx = row.dataset.idx;
                const manager = row.dataset.manager;
                const detailsRow = document.querySelector(`.dep-details-row[data-details-idx="${idx}"][data-details-manager="${manager}"]`);
                const expandIcon = row.querySelector('.expand-icon');
                if (detailsRow) {
                    detailsRow.classList.toggle('show');
                    if (expandIcon) {
                        expandIcon.style.transform = detailsRow.classList.contains('show') ? 'rotate(90deg)' : 'rotate(0deg)';
                    }
                }
            };
        });
        
        // Обработчики фильтрации
        let activeFilter = 'all';
        const searchInput = document.getElementById('vulnSearch');
        const filterBtns = document.querySelectorAll('.filter-btn');
        const allRows = document.querySelectorAll('.dep-row');
        
        function filterRows() {
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            
            allRows.forEach(row => {
                const severity = row.dataset.severity;
                const reachable = row.dataset.reachable === 'true';
                const component = (row.dataset.component || '').toLowerCase();
                const vulnCountSpan = row.querySelector('.vuln-count');
                const hasVuln = vulnCountSpan !== null;
                
                let matchesFilter = true;
                if (activeFilter === 'critical') matchesFilter = severity === 'critical';
                else if (activeFilter === 'high') matchesFilter = severity === 'high';
                else if (activeFilter === 'medium') matchesFilter = severity === 'medium';
                else if (activeFilter === 'low') matchesFilter = severity === 'low';
                else if (activeFilter === 'reachable') matchesFilter = reachable === true;
                
                let matchesSearch = true;
                if (searchTerm) {
                    matchesSearch = component.includes(searchTerm);
                }
                
                row.style.display = matchesFilter && matchesSearch ? '' : 'none';
                
                const idx = row.dataset.idx;
                const manager = row.dataset.manager;
                const detailsRow = document.querySelector(`.dep-details-row[data-details-idx="${idx}"][data-details-manager="${manager}"]`);
                if (detailsRow && row.style.display === 'none') {
                    detailsRow.classList.remove('show');
                    const expandIcon = row.querySelector('.expand-icon');
                    if (expandIcon) expandIcon.style.transform = 'rotate(0deg)';
                }
            });
        }
        
        filterBtns.forEach(btn => {
            btn.onclick = () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.filter;
                filterRows();
            };
        });
        
        if (searchInput) {
            searchInput.oninput = filterRows;
        }
    }, 100);
    
    return html;
}

function generateCodeHTML(report) {
    const issues = report.sast?.issues || report.codeAnalysis?.issues || [];

    if (!issues.length) {
        return `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>Проблем не найдено</h3>
                <p>SAST анализ не выявил уязвимостей в коде</p>
            </div>
        `;
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
    
    function getSeverityColorStatic(severity) {
        switch(severity) {
            case 'CRITICAL': return '#dc2626';
            case 'HIGH': return '#f97316';
            case 'MEDIUM': return '#eab308';
            case 'LOW': return '#22c55e';
            default: return '#3b82f6';
        }
    }

    function escapeHtmlStatic(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function shortenPath(filePath) {
        if (!filePath) return 'unknown';
        let path = filePath;
        path = path.replace(/^loan-master[\\/]/, '');
        path = path.replace(/^src[\\/]/, '');
        if (path.startsWith('config/') || path.startsWith('docs/')) {
            return path;
        }
        if (path.length > 50) {
            const parts = path.split(/[\\/]/);
            if (parts.length > 2) {
                return parts.slice(-2).join('/');
            }
        }
        return path;
    }

    // Получение уникальных правил для фильтра
    function getUniqueRules(issuesList) {
        const rules = new Set();
        issuesList.forEach(issue => {
            const rule = issue.ruleId || issue.rule;
            if (rule) rules.add(rule);
        });
        return Array.from(rules).sort();
    }

    // Функция проверки test/mock файлов
    function isTestMockFile(filePath) {
        if (!filePath) return false;
        const lowerPath = filePath.toLowerCase();
        const patterns = ['test', 'mock', 'spec', 'fixture', '__tests__', '__mocks__', '.test.', '.spec.', '/tests/', '/test/'];
        return patterns.some(p => lowerPath.includes(p));
    }

    // Нормализация путей файлов
    const normalizedIssues = issues.map((issue, index) => {
        const fullPath = issue.file || 'unknown';
        return {
            ...issue,
            id: index,
            fullPath: fullPath,
            file: shortenPath(fullPath),
            severity: (issue.severity || 'INFO').toUpperCase()
        };
    });

    // Подсчет статистики
    const statistics = {
        critical: normalizedIssues.filter(i => i.severity === 'CRITICAL').length,
        high: normalizedIssues.filter(i => i.severity === 'HIGH').length,
        medium: normalizedIssues.filter(i => i.severity === 'MEDIUM').length,
        low: normalizedIssues.filter(i => i.severity === 'LOW').length,
        info: normalizedIssues.filter(i => i.severity === 'INFO').length,
        total: normalizedIssues.length
    };

    const uniqueId = 'sast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    // Функция рендера строк таблицы
    function renderSastTableRowsInline(issuesList, uid) {
        if (!issuesList.length) return '';
        
        let html = '';
        for (let i = 0; i < issuesList.length; i++) {
            const issue = issuesList[i];
            const severityColor = getSeverityColorStatic(issue.severity);
            const ruleName = issue.ruleId || issue.rule || 'unknown';
            const message = (issue.message || 'Нет описания').substring(0, 80);
            const file = issue.file;
            const fullPath = issue.fullPath;
            const line = issue.line || '?';
            const codeBlock = issue.codeBlock;
            const rowId = 'sast-row-' + uid + '-' + i;
            const detailsId = 'sast-details-' + uid + '-' + i;
            
            html += `
                <tr id="${rowId}" class="sast-row" data-idx="${i}" data-severity="${issue.severity}" data-rule="${escapeHtmlStatic(ruleName)}" data-fullpath="${escapeHtmlStatic(fullPath)}" data-message="${escapeHtmlStatic(message)}">
                    <td style="padding: 10px; text-align: center;">
                        <span class="sast-expand-icon" data-idx="${i}" data-details-id="${detailsId}" style="transition: transform 0.2s; display: inline-block; cursor: pointer;">▶</span>
                    </td>
                    <td style="padding: 10px;">
                        <span style="color: ${severityColor}; font-weight: 600; padding: 4px 8px; border-radius: 12px; font-size: 11px; background: ${severityColor}20;">
                            ${issue.severity}
                        </span>
                    </td>
                    <td style="padding: 10px;">
                        <code class="sast-rule-name">${escapeHtmlStatic(ruleName)}</code>
                    </td>
                    <td style="padding: 10px; max-width: 300px;">
                        <div class="sast-message">${escapeHtmlStatic(message)}${issue.message && issue.message.length > 80 ? '...' : ''}</div>
                    </td>
                    <td style="padding: 10px;">
                        <span class="sast-filepath" title="${escapeHtmlStatic(fullPath)}">${escapeHtmlStatic(file)}</span>
                    </td>
                    <td style="padding: 10px; text-align: center;">
                        <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${line}</span>
                    </td>
                </tr>
                <tr id="${detailsId}" class="sast-details-row" data-details-idx="${i}" style="display: none; background: #f8fafc;">
                    <td colspan="6" style="padding: 15px 20px;">
                        <div style="background: white; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0;">
                            <div style="margin-bottom: 12px;">
                                <strong style="font-size: 14px;">${escapeHtmlStatic(ruleName)}</strong>
                                <span style="color: ${severityColor}; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 10px; background: ${severityColor}20;">
                                    ${issue.severity}
                                </span>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <strong>Описание:</strong>
                                <p style="margin-top: 4px; color: #334155;">${escapeHtmlStatic(issue.message || 'Нет описания')}</p>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <strong>Расположение:</strong>
                                <div style="margin-top: 4px; font-family: monospace; font-size: 12px; background: #f1f5f9; padding: 6px 10px; border-radius: 4px;">
                                    ${escapeHtmlStatic(fullPath)}:${line}
                                </div>
                            </div>
                            ${codeBlock && codeBlock.lines ? `
                                <div style="margin-bottom: 12px;">
                                    <strong>Блок кода:</strong>
                                    <pre style="margin-top: 8px; background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px;">${codeBlock.lines.map(function(l) {
                                        const prefix = l.isVulnerable ? '→' : ' ';
                                        const lineNum = String(l.number).padStart(4, ' ');
                                        const lineCode = escapeHtmlStatic(l.code || '');
                                        return prefix + ' ' + lineNum + ' | ' + lineCode;
                                    }).join('\n')}</pre>
                                </div>
                            ` : issue.snippet ? `
                                <div style="margin-bottom: 12px;">
                                    <strong>Фрагмент кода:</strong>
                                    <pre style="margin-top: 8px; background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px;">${escapeHtmlStatic(issue.snippet)}</pre>
                                </div>
                            ` : ''}
                            ${issue.recommendation ? `
                                <div style="margin-top: 12px; padding: 12px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
                                    <strong><i class="fas fa-lightbulb"></i> Рекомендация:</strong>
                                    <p style="margin-top: 4px; color: #1e40af;">${escapeHtmlStatic(issue.recommendation)}</p>
                                </div>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }
        return html;
    }

    // ========== МОДАЛЬНОЕ ОКНО ФИЛЬТРОВ ==========
    const filterModalHtml = `
            <div id="sast-filter-modal-${uniqueId}" class="sast-modal-overlay">
                <div class="sast-modal">
                    <div class="sast-modal-header">
                        <h3><i class="fas fa-sliders-h"></i>Расширенные фильтры</h3>
                        <button class="sast-modal-close">&times;</button>
                    </div>
                    <div class="sast-modal-body">
                        <div class="sast-filter-group">
                            <label class="sast-checkbox-label">
                                <input type="checkbox" id="sast-exclude-test-mock-${uniqueId}">
                                <span>Исключить test/mock файлы</span>
                            </label>
                            <div class="sast-filter-hint">
                                исключает файлы содержащие: test, mock, spec, fixture, __tests__, и т.д.
                            </div>
                        </div>
                        <div class="sast-filter-group">
                            <label>Фильтр по правилу:</label>
                            <select id="sast-rule-filter-${uniqueId}" class="sast-select">
                                <option value="all">Все правила</option>
                                ${getUniqueRules(normalizedIssues).map(rule => `<option value="${escapeHtmlStatic(rule)}">${escapeHtmlStatic(rule)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="sast-modal-footer">
                        <button class="sast-btn sast-btn-secondary sast-filter-reset">Сбросить</button>
                        <button class="sast-btn sast-btn-primary sast-filter-apply">Применить</button>
                    </div>
                </div>
            </div>
            `;

    const filterBarHtml = `
<button id="sast-filter-btn-${uniqueId}" class="sast-filter-btn-ext">
    <i class="fas fa-sliders-h"></i> Расширенные фильтры
</button>
`;

    // Генерируем HTML
    let html = `
        <div id="${uniqueId}" class="sast-container">
            <!-- Статистика -->
            <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
                <div style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                    <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${statistics.critical}</div>
                    <div style="font-size: 12px; color: #64748b;">Critical</div>
                </div>
                <div style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                    <div style="font-size: 28px; font-weight: 700; color: #f97316;">${statistics.high}</div>
                    <div style="font-size: 12px; color: #64748b;">High</div>
                </div>
                <div style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                    <div style="font-size: 28px; font-weight: 700; color: #eab308;">${statistics.medium}</div>
                    <div style="font-size: 12px; color: #64748b;">Medium</div>
                </div>
                <div style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                    <div style="font-size: 28px; font-weight: 700; color: #22c55e;">${statistics.low}</div>
                    <div style="font-size: 12px; color: #64748b;">Low</div>
                </div>
                <div style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                    <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">${statistics.info}</div>
                    <div style="font-size: 12px; color: #64748b;">Info</div>
                </div>
            </div>
            
            <!-- Фильтры -->
            <div class="sast-filter-bar" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; align-items: center;">
                <input type="text" id="sast-search-${uniqueId}" placeholder="Поиск по файлу, правилу или описанию..." class="sast-search-box" style="flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 5px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="sast-filter-btn active" data-filter="all">Все (${statistics.total})</button>
                    <button class="sast-filter-btn" data-filter="critical">Critical (${statistics.critical})</button>
                    <button class="sast-filter-btn" data-filter="high">High (${statistics.high})</button>
                    <button class="sast-filter-btn" data-filter="medium">Medium (${statistics.medium})</button>
                    <button class="sast-filter-btn" data-filter="low">Low (${statistics.low})</button>
                    <button class="sast-filter-btn" data-filter="info">Info (${statistics.info})</button>
                </div>
                ${filterBarHtml}
            </div>
            
            ${filterModalHtml}
            
            <!-- Таблица -->
            <div style="overflow-x: auto;">
                <table class="sast-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="width: 30px; padding: 10px;"></th>
                            <th style="padding: 10px; text-align: left;">Уровень</th>
                            <th style="padding: 10px; text-align: left;">Правило</th>
                            <th style="padding: 10px; text-align: left;">Описание</th>
                            <th style="padding: 10px; text-align: left;">Файл</th>
                            <th style="padding: 10px; text-align: center;">Строка</th>
                        </tr>
                    </thead>
                    <tbody id="sast-table-body-${uniqueId}">
                        ${renderSastTableRowsInline(normalizedIssues, uniqueId)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Добавляем обработчики через setTimeout
    setTimeout(() => {
        const container = document.getElementById(uniqueId);
        if (!container) return;
        
        // Обработчики раскрытия
        const rows = container.querySelectorAll('.sast-row');
        rows.forEach(row => {
            const expandIcon = row.querySelector('.sast-expand-icon');
            if (!expandIcon) return;
            const detailsId = expandIcon.getAttribute('data-details-id');
            const detailsRow = document.getElementById(detailsId);
            if (!detailsRow) return;
            
            row.onclick = (e) => {
                if (e.target.classList && e.target.classList.contains('sast-expand-icon')) return;
                if (detailsRow.style.display === 'none' || !detailsRow.style.display) {
                    detailsRow.style.display = 'table-row';
                    expandIcon.style.transform = 'rotate(90deg)';
                } else {
                    detailsRow.style.display = 'none';
                    expandIcon.style.transform = 'rotate(0deg)';
                }
            };
            
            expandIcon.onclick = (e) => {
                e.stopPropagation();
                if (detailsRow.style.display === 'none' || !detailsRow.style.display) {
                    detailsRow.style.display = 'table-row';
                    expandIcon.style.transform = 'rotate(90deg)';
                } else {
                    detailsRow.style.display = 'none';
                    expandIcon.style.transform = 'rotate(0deg)';
                }
            };
        });
        
        // Фильтрация по severity и поиску
        const searchInputElem = container.querySelector('.sast-search-box');
        const filterBtnsElem = container.querySelectorAll('.sast-filter-btn');
        let activeFilter = 'all';
        
        function filterRows() {
            const searchTerm = searchInputElem ? searchInputElem.value.toLowerCase() : '';
            const allRows = container.querySelectorAll('.sast-row');
            
            allRows.forEach(row => {
                const severity = row.getAttribute('data-severity') || '';
                const filePath = row.querySelector('.sast-filepath')?.getAttribute('title') || '';
                const message = row.querySelector('.sast-message')?.innerText || '';
                
                let matchesFilter = true;
                if (activeFilter !== 'all') {
                    matchesFilter = severity.toLowerCase() === activeFilter;
                }
                
                let matchesSearch = true;
                if (searchTerm) {
                    matchesSearch = filePath.toLowerCase().includes(searchTerm) || 
                                   message.toLowerCase().includes(searchTerm);
                }
                
                row.style.display = matchesFilter && matchesSearch ? '' : 'none';
                
                if (row.style.display === 'none') {
                    const icon = row.querySelector('.sast-expand-icon');
                    if (icon) {
                        const detailsRow = document.getElementById(icon.getAttribute('data-details-id'));
                        if (detailsRow) detailsRow.style.display = 'none';
                    }
                }
            });
        }
        
        filterBtnsElem.forEach(btn => {
            if (btn.classList.contains('sast-filter-btn')) {
                btn.onclick = () => {
                    filterBtnsElem.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeFilter = btn.getAttribute('data-filter');
                    filterRows();
                };
            }
        });
        
        if (searchInputElem) {
            searchInputElem.oninput = filterRows;
        }
        
        // Модальное окно
        const filterBtn = document.getElementById(`sast-filter-btn-${uniqueId}`);
        const modal = document.getElementById(`sast-filter-modal-${uniqueId}`);
        const closeBtn = modal?.querySelector('.sast-filter-close');
        const applyBtn = modal?.querySelector('.sast-filter-apply');
        const resetBtn = modal?.querySelector('.sast-filter-reset');
        const excludeTestMockCheckbox = document.getElementById(`sast-exclude-test-mock-${uniqueId}`);
        const ruleFilterSelect = document.getElementById(`sast-rule-filter-${uniqueId}`);
        
        let excludeTestMock = false;
        let selectedRule = 'all';
        
        if (filterBtn && modal) {
            filterBtn.onclick = () => {
                modal.style.display = 'flex';
            };
        }
        
        // Закрыть по крестику
            modal.querySelector('.sast-modal-close').onclick = () => {
                modal.style.display = 'none';
            };

            // Закрыть по клику вне окна
            modal.onclick = (e) => {
                if (e.target === modal) modal.style.display = 'none';
            };
        
        if (applyBtn) {
            applyBtn.onclick = () => {
                excludeTestMock = excludeTestMockCheckbox ? excludeTestMockCheckbox.checked : false;
                selectedRule = ruleFilterSelect ? ruleFilterSelect.value : 'all';
                
                const rowsList = document.querySelectorAll(`#${uniqueId} .sast-row`);
                rowsList.forEach(row => {
                    const filePath = row.querySelector('.sast-filepath')?.getAttribute('title') || '';
                    const ruleName = row.querySelector('.sast-rule-name')?.innerText || '';
                    
                    let excludeByTestMock = true;
                    if (excludeTestMock) {
                        excludeByTestMock = !isTestMockFile(filePath);
                    }
                    
                    let matchRule = true;
                    if (selectedRule !== 'all') {
                        matchRule = ruleName === selectedRule;
                    }
                    
                    row.style.display = (excludeByTestMock && matchRule) ? '' : 'none';
                    
                    if (row.style.display === 'none') {
                        const icon = row.querySelector('.sast-expand-icon');
                        if (icon) {
                            const detailsRow = document.getElementById(icon.getAttribute('data-details-id'));
                            if (detailsRow) detailsRow.style.display = 'none';
                        }
                    }
                });
                
                modal.style.display = 'none';
            };
        }
        
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (excludeTestMockCheckbox) excludeTestMockCheckbox.checked = false;
                if (ruleFilterSelect) ruleFilterSelect.value = 'all';
                excludeTestMock = false;
                selectedRule = 'all';
                
                const rowsList = document.querySelectorAll(`#${uniqueId} .sast-row`);
                rowsList.forEach(row => {
                    row.style.display = '';
                });
                
                modal.style.display = 'none';
            };
        }
    }, 100);
    
    return html;
}

// Генерация сводки (Summary)
function generateSummaryHTML(report) {
    // SCA статистика
    const scaStats = report.sca?.statistics || {};
    const scaVulnerabilities = report.sca?.vulnerabilities || [];
    const reachability = report.sca?.reachability || {};

    const scaCritical = scaVulnerabilities.filter(v => v.severity === 'critical').length;
    const scaHigh = scaVulnerabilities.filter(v => v.severity === 'high').length;
    const scaMedium = scaVulnerabilities.filter(v => v.severity === 'medium').length;
    const scaLow = scaVulnerabilities.filter(v => v.severity === 'low').length;

    // SAST статистика
    const sastIssues = report.sast?.issues || [];
    const sastStats = report.sast?.statistics || {};

    const sastCritical = sastIssues.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL' || i.severity === 'critical').length;
    const sastHigh = sastIssues.filter(i => (i.severity || '').toUpperCase() === 'HIGH' || i.severity === 'high').length;
    const sastMedium = sastIssues.filter(i => (i.severity || '').toUpperCase() === 'MEDIUM' || i.severity === 'medium').length;
    const sastLow = sastIssues.filter(i => (i.severity || '').toUpperCase() === 'LOW' || i.severity === 'low').length;

    // Общая статистика
    const totalCritical = scaCritical + sastCritical;
    const totalHigh = scaHigh + sastHigh;

    return `
        <!-- Основные метрики -->
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div class="stat-card" style="background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center;">
                <div class="stat-number" style="font-size: 32px; font-weight: bold; color: #667eea;">${scaStats.totalDependencies || 0}</div>
                <div class="stat-label" style="font-size: 12px; color: #64748b;">Зависимостей</div>
            </div>
            <div class="stat-card" style="background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center;">
                <div class="stat-number" style="font-size: 32px; font-weight: bold; color: #667eea;">${sastIssues.length}</div>
                <div class="stat-label" style="font-size: 12px; color: #64748b;">SAST проблем</div>
            </div>
        </div>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <div style="color: white; text-align: center;">
                <div style="font-size: 14px; opacity: 0.9;">Общий риск</div>
                <div style="font-size: 36px; font-weight: 700;">${totalCritical + totalHigh}</div>
                <div style="font-size: 12px; opacity: 0.8;">критических и высоких уязвимостей</div>
            </div>
        </div>
        <!-- Сводка по критическим и высоким уязвимостям -->
        <div style="margin-bottom: 24px;">
            <h3 style="margin-bottom: 16px; font-size: 18px;">Критические и высокие уязвимости</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <!-- SCA блок -->
                <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
                    <div style="padding: 12px 16px; background: linear-gradient(135deg, #1a1a2a 0%, #0a0a0f 100%); color: white; font-weight: 600;">
                        Композиционный анализ
                    </div>
                    <div style="padding: 16px;">
                        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${scaCritical}</div>
                                <div style="font-size: 12px; color: #64748b;">Critical</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #f97316;">${scaHigh}</div>
                                <div style="font-size: 12px; color: #64748b;">High</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #eab308;">${scaMedium}</div>
                                <div style="font-size: 12px; color: #64748b;">Medium</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #22c55e;">${scaLow}</div>
                                <div style="font-size: 12px; color: #64748b;">Low</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- SAST блок -->
                <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
                    <div style="padding: 12px 16px; background: linear-gradient(135deg, #1a1a2a 0%, #0a0a0f 100%); color: white; font-weight: 600;">
                        Анализ исходного кода
                    </div>
                    <div style="padding: 16px;">
                        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #dc2626;">${sastCritical}</div>
                                <div style="font-size: 12px; color: #64748b;">Critical</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #f97316;">${sastHigh}</div>
                                <div style="font-size: 12px; color: #64748b;">High</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #eab308;">${sastMedium}</div>
                                <div style="font-size: 12px; color: #64748b;">Medium</div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="font-size: 28px; font-weight: 700; color: #22c55e;">${sastLow}</div>
                                <div style="font-size: 12px; color: #64748b;">Low</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateHTMLReport(report) {
    if (!report) {
        return '<html><body><h1>Нет данных</h1></body></html>';
    }

    // Берем готовые компоненты
    const summaryHtml = generateSummaryHTML(report);
    const scaHtml = generateDependenciesHTML(report);
    const sastHtml = generateCodeHTML(report);

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Геркулес | Блендер - Отчет о безопасности</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Alef:wght@400;700&display=swap" rel="stylesheet">
    <style>
     * { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Ubuntu', sans-serif; background: #f5f5f5; padding: 24px; color: #0f172a; }

:root {
    --primary-color: #2563eb;
    --accent-color: #667eea;
    --bg-color: #f8fafc;
    --bg-secondary: #f1f5f9;
    --card-bg: #ffffff;
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --border-color: #e2e8f0;
    --border-radius: 12px;
}

.report-container {
    max-width: 1400px;
    margin: 0 auto;
    background: white;
    border-radius: var(--border-radius);
    box-shadow: 0 20px 60px rgba(0,0,0,0.1);
    overflow: hidden;
}

.report-header {
    background: linear-gradient(135deg, #1a1a2a 0%, #0a0a0f 100%);
    color: white;
    padding: 32px 40px;
}

.report-header h1 { font-size: 28px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; }
.report-header h1 i { font-size: 32px; color: var(--accent-color); }
.report-meta { display: flex; gap: 24px; margin-top: 16px; font-size: 13px; color: #94a3b8; }

.report-tabs {
    display: flex;
    gap: 4px;
    padding: 0 40px;
    background: white;
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
}

.report-tab {
    padding: 14px 24px;
    background: none;
    border: none;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'Ubuntu';
}

.report-tab:hover { color: var(--accent-color); }
.report-tab.active { color: var(--accent-color); border-bottom: 2px solid var(--accent-color); }

.report-content {
    padding: 32px 40px;
    min-height: 500px;
    background: var(--bg-color);
}

.tab-pane { display: none; animation: fadeIn 0.3s ease; }
.tab-pane.active { display: block; }

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.report-footer {
    padding: 20px 40px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    text-align: center;
    font-size: 12px;
    color: var(--text-secondary);
}

/* ==================== SCA СТИЛИ ==================== */
.vuln-stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.summary-card { flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0; transition: transform 0.2s, box-shadow 0.2s; }
.summary-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.card-value { font-size: 28px; font-weight: 700; }
.card-label { font-size: 12px; color: #64748b; }

.filter-bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; align-items: center; }
.search-box { flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 5px; font-size: 13px; }
.search-box:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
.filter-btn { font-family: 'Ubuntu'; padding: 6px 14px; background: #f1f5f9; border: none; border-radius: 20px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
.filter-btn:hover { background: #e2e8f0; }
.filter-btn.active { background: #667eea; color: white; }

.dep-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dep-table th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
.dep-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
.dep-row { cursor: pointer; transition: background 0.2s; }
.dep-row:hover { background: #f8fafc; }
.expand-icon { transition: transform 0.2s; display: inline-block; width: 20px; text-align: center; font-size: 12px; color: #667eea; cursor: pointer; }
.expand-icon:hover { color: #2563eb; }
.dep-details-row { display: none; background: #f8fafc; }
.dep-details-row.show { display: table-row; }

.reachable-yes { background: #fee2e2; color: #dc2626; padding: 4px 8px; border-radius: 12px; font-size: 11px; }
.reachable-no { background: #dcfce7; color: #16a34a; padding: 4px 8px; border-radius: 12px; font-size: 11px; }
.reachable-unknown { background: #f1f5f9; color: #64748b; padding: 4px 8px; border-radius: 12px; font-size: 11px; }

/* ==================== SAST СТИЛИ ==================== */
.sast-container { width: 100%; }
.sast-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.sast-row { cursor: pointer; transition: background 0.2s; border-bottom: 1px solid #e2e8f0; }
.sast-row:hover { background: #f8fafc; }
.sast-details-row { display: none; background: #f8fafc; }
.sast-details-row.show { display: table-row; }
.sast-expand-icon { transition: transform 0.2s; display: inline-block; width: 20px; text-align: center; font-size: 12px; color: #667eea; cursor: pointer; }
.sast-expand-icon:hover { color: #2563eb; }

.sast-filter-bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; align-items: center; }
.sast-filter-btn { font-family: 'Ubuntu'; padding: 6px 14px; background: #f1f5f9; border: none; border-radius: 20px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
.sast-filter-btn:hover { background: #e2e8f0; }
.sast-filter-btn.active { background: #667eea; color: white; }
.sast-filter-btn-ext { padding: 6px 14px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 20px; cursor: pointer; font-size: 13px; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
.sast-filter-btn-ext:hover { background: #667eea; color: white; border-color: #667eea; }
.sast-search-box { flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 5px; font-size: 13px; }
.sast-search-box:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }

/* Модальное окно SAST */
.sast-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px);
    z-index: 10000;
    display: none;
    justify-content: center;
    align-items: center;
}
.sast-modal-overlay.active { display: flex; }
.sast-modal { background: white; border-radius: 16px; width: 450px; max-width: 90%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
.sast-modal-header { font-family: 'Ubuntu'; display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; }
.sast-modal-header h3 { margin: 0; font-size: 18px; font-weight: 600; }
.sast-modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; padding: 0 8px; font-family: 'Ubuntu';}
.sast-modal-close:hover { color: #0f172a; }
.sast-modal-body { padding: 24px; }
.sast-filter-group { margin-bottom: 24px; }
.sast-filter-group label { display: block; margin-bottom: 8px; font-weight: 500; }
.sast-checkbox-label { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.sast-checkbox-label input { width: 18px; height: 18px; cursor: pointer; }
.sast-filter-hint { font-size: 11px; color: #64748b; margin-top: 5px; margin-left: 28px; }
.sast-select { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: white; cursor: pointer; }
.sast-select:focus { outline: none; border-color: #667eea; }
.sast-modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid #e2e8f0; }
.sast-btn {font-family: 'Ubuntu'; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; }
.sast-btn-secondary { background: #f1f5f9; color: #475569; }
.sast-btn-secondary:hover { background: #e2e8f0; }
.sast-btn-primary { background: #667eea; color: white; }
.sast-btn-primary:hover { background: #5a67d8; transform: translateY(-1px); }

/* ==================== EMPTY STATE ==================== */
.empty-state {
    text-align: center;
    padding: 60px 24px;
    background: var(--card-bg, white);
    border-radius: 16px;
    border: 1px solid var(--border-color, #e2e8f0);
}

.empty-state i {
    font-size: 64px;
    color: #cbd5e1;
    margin-bottom: 20px;
    display: block;
}

.empty-state h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #0f172a);
    margin-bottom: 8px;
}

.empty-state p {
    font-size: 14px;
    color: var(--text-secondary, #64748b);
}

/* Адаптивность для empty state */
@media (max-width: 768px) {
    .empty-state {
        padding: 40px 20px;
    }
    
    .empty-state i {
        font-size: 48px;
    }
    
    .empty-state h3 {
        font-size: 16px;
    }
    
    .empty-state p {
        font-size: 13px;
    }
}

/* ==================== БЕЙДЖИ ==================== */
.badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.badge-critical { background: #fee2e2; color: #dc2626; }
.badge-high { background: #ffedd5; color: #f97316; }
.badge-medium { background: #fef9c3; color: #ca8a04; }
.badge-low { background: #dcfce7; color: #16a34a; }
.badge-info { background: #dbeafe; color: #3b82f6; }

/* ==================== АДАПТИВНОСТЬ ==================== */
@media (max-width: 768px) {
    body { padding: 12px; }
    .report-header { padding: 24px; }
    .stats-grid { padding: 20px; gap: 12px; }
    .report-content { padding: 20px; }
    .report-tabs { padding: 0 20px; }
    .dep-table, .sast-table { font-size: 11px; }
    .dep-table th, .dep-table td, .sast-table th, .sast-table td { padding: 6px 8px; }
}

@media print {
    body { background: white; padding: 0; }
    .report-tabs { display: none; }
    .tab-pane { display: block !important; }
    .filter-bar { display: none; }
}
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1>    
                Геркулес | Блендер
            </h1>
            <p>Комплексный анализ безопасности</p>
            <div class="report-meta">
                <span>${new Date().toLocaleString()}</span>
            </div>
        </div>
        
        <div class="report-tabs">
            <button class="report-tab active" data-tab="summary">Сводка</button>
            <button class="report-tab" data-tab="sca">SCA (${report.sca?.vulnerabilities?.length || 0})</button>
            <button class="report-tab" data-tab="sast">SAST (${report.sast?.issues?.length || 0})</button>
        </div>
        
        <div class="report-content">
            <div class="tab-pane active" id="tab-summary">
                ${summaryHtml}
            </div>
            <div class="tab-pane" id="tab-sca">
                ${scaHtml}
            </div>
            <div class="tab-pane" id="tab-sast">
                ${sastHtml}
            </div>
        </div>
        
        <div class="report-footer">
            <p>Сгенерировано с помощью Геркулес | Блендер </p>
        </div>
    </div>
    
    <script>
    // Переключение табов
    const tabs = document.querySelectorAll('.report-tab');
    const panes = document.querySelectorAll('.tab-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + target).classList.add('active');
        });
    });
    
    // ==================== РАСКРЫТИЕ СТРОК SCA ====================
    document.querySelectorAll('.dep-row').forEach(row => {
        const icon = row.querySelector('.expand-icon');
        const details = row.nextElementSibling;
        if (!icon || !details) return;
        
        icon.onclick = (e) => {
            e.stopPropagation();
            if (details.style.display === 'none' || !details.style.display) {
                details.style.display = 'table-row';
                icon.style.transform = 'rotate(90deg)';
            } else {
                details.style.display = 'none';
                icon.style.transform = 'rotate(0deg)';
            }
        };
        
        row.onclick = () => {
            if (details.style.display === 'none' || !details.style.display) {
                details.style.display = 'table-row';
                icon.style.transform = 'rotate(90deg)';
            } else {
                details.style.display = 'none';
                icon.style.transform = 'rotate(0deg)';
            }
        };
    });
    
    // ==================== РАСКРЫТИЕ СТРОК SAST ====================
    document.querySelectorAll('.sast-row').forEach(row => {
        const icon = row.querySelector('.sast-expand-icon');
        const details = row.nextElementSibling;
        if (!icon || !details) return;
        
        icon.onclick = (e) => {
            e.stopPropagation();
            if (details.style.display === 'none' || !details.style.display) {
                details.style.display = 'table-row';
                icon.style.transform = 'rotate(90deg)';
            } else {
                details.style.display = 'none';
                icon.style.transform = 'rotate(0deg)';
            }
        };
        
        row.onclick = () => {
            if (details.style.display === 'none' || !details.style.display) {
                details.style.display = 'table-row';
                icon.style.transform = 'rotate(90deg)';
            } else {
                details.style.display = 'none';
                icon.style.transform = 'rotate(0deg)';
            }
        };
    });
    
    // ==================== ФИЛЬТР SCA ====================
    const scaSearch = document.getElementById('vulnSearch');
    const scaBtns = document.querySelectorAll('#tab-sca .filter-btn');
    let currentScaFilter = 'all';
    let currentScaReachable = false;
    
    function getScaSeverityFromRow(row) {
        // Ищем бейдж с классом reachable-yes, reachable-no, reachable-unknown
        const reachableSpan = row.querySelector('.reachable-yes, .reachable-no, .reachable-unknown');
        if (reachableSpan) {
            const text = reachableSpan.innerText.toLowerCase();
            if (text === 'да') return 'high'; // Достижимые обычно high
            if (text === 'нет') return 'low';
        }
        
        // Ищем по цветным бейджам в колонке Уязвимости
        const vulnSpan = row.querySelector('td:nth-child(5) span');
        if (vulnSpan) {
            const classes = vulnSpan.className;
            if (classes.includes('critical')) return 'critical';
            if (classes.includes('high')) return 'high';
            if (classes.includes('medium')) return 'medium';
            if (classes.includes('low')) return 'low';
        }
        
        return '';
    }
    
    function filterSca() {
        const searchText = scaSearch ? scaSearch.value.toLowerCase() : '';
        const rows = document.querySelectorAll('#sca-table tbody tr.dep-row');
        
        rows.forEach(row => {
            // Получаем severity из строки
            let severity = getScaSeverityFromRow(row);
            
            // Получаем название компонента
            const componentCell = row.querySelector('td:first-child strong, td:first-child');
            let component = componentCell ? componentCell.innerText.toLowerCase() : '';
            component = component.replace(/dev/, '').trim();
            
            // Достижимость
            const reachable = row.getAttribute('data-reachable') === 'true';
            
            let show = true;
            
            if (currentScaFilter !== 'all') {
                show = show && severity === currentScaFilter;
            }
            
            if (currentScaReachable) {
                show = show && reachable;
            }
            
            if (searchText) {
                show = show && component.includes(searchText);
            }
            
            row.style.display = show ? '' : 'none';
            
            if (!show) {
                const details = row.nextElementSibling;
                if (details && details.classList.contains('dep-details-row')) {
                    details.style.display = 'none';
                    const icon = row.querySelector('.expand-icon');
                    if (icon) icon.style.transform = 'rotate(0deg)';
                }
            }
        });
    }
    
    scaBtns.forEach(btn => {
        btn.onclick = () => {
            const filterValue = btn.getAttribute('data-filter');
            
            if (filterValue === 'reachable') {
                currentScaReachable = !currentScaReachable;
                btn.classList.toggle('active');
                filterSca();
            } else {
                scaBtns.forEach(b => {
                    const fv = b.getAttribute('data-filter');
                    if (fv !== 'reachable') b.classList.remove('active');
                });
                btn.classList.add('active');
                currentScaFilter = filterValue;
                filterSca();
            }
        };
    });
    
    if (scaSearch) {
        scaSearch.oninput = filterSca;
    }
    
    // ==================== ФИЛЬТР SAST ====================
    const sastSearch = document.querySelector('#tab-sast .sast-search-box');
    const sastBtns = document.querySelectorAll('#tab-sast .sast-filter-btn');
    let currentSastFilter = 'all';
    
    function filterSast() {
        const searchText = sastSearch ? sastSearch.value.toLowerCase() : '';
        const rows = document.querySelectorAll('#tab-sast .sast-row');
        
        rows.forEach(row => {
            let severity = row.getAttribute('data-severity');
            severity = severity ? severity.toLowerCase() : '';
            
            const file = row.getAttribute('data-fullpath') || '';
            const rule = row.getAttribute('data-rule') || '';
            
            let show = true;
            
            if (currentSastFilter !== 'all') {
                show = show && severity === currentSastFilter;
            }
            
            if (searchText) {
                show = show && (file.toLowerCase().includes(searchText) || rule.toLowerCase().includes(searchText));
            }
            
            row.style.display = show ? '' : 'none';
            
            if (!show) {
                const details = row.nextElementSibling;
                if (details && details.classList.contains('sast-details-row')) {
                    details.style.display = 'none';
                    const icon = row.querySelector('.sast-expand-icon');
                    if (icon) icon.style.transform = 'rotate(0deg)';
                }
            }
        });
    }
    
    sastBtns.forEach(btn => {
        btn.onclick = () => {
            sastBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSastFilter = btn.getAttribute('data-filter');
            filterSast();
        };
    });
    
    if (sastSearch) {
        sastSearch.oninput = filterSast;
    }
    
    // ==================== РАСШИРЕННЫЕ ФИЛЬТРЫ SAST ====================
    const filterBtn = document.querySelector('#tab-sast .sast-filter-btn-ext');
    const modal = document.querySelector('#tab-sast .sast-modal-overlay');
    const excludeCheckbox = document.querySelector('#tab-sast .sast-checkbox-label input');
    const ruleSelect = document.querySelector('#tab-sast .sast-select');
    
    function isTestMockFile(path) {
        if (!path) return false;
        const p = path.toLowerCase();
        return p.includes('test') || p.includes('mock') || p.includes('spec') || p.includes('fixture') || p.includes('__tests__');
    }
    
    function applyExtendedFilters() {
        const exclude = excludeCheckbox ? excludeCheckbox.checked : false;
        const rule = ruleSelect ? ruleSelect.value : 'all';
        
        const rows = document.querySelectorAll('#tab-sast .sast-row');
        rows.forEach(row => {
            const filePath = row.getAttribute('data-fullpath') || '';
            const ruleName = row.getAttribute('data-rule') || '';
            
            let show = true;
            if (exclude) show = show && !isTestMockFile(filePath);
            if (rule !== 'all') show = show && ruleName === rule;
            
            row.style.display = show ? '' : 'none';
            if (!show) {
                const details = row.nextElementSibling;
                if (details) details.style.display = 'none';
                const icon = row.querySelector('.sast-expand-icon');
                if (icon) icon.style.transform = 'rotate(0deg)';
            }
        });
    }
    
    if (filterBtn && modal) {
        filterBtn.onclick = () => {
            modal.style.display = 'flex';
        };
        
        const closeBtn = modal.querySelector('.sast-modal-close');
        if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
        
        const applyBtn = modal.querySelector('.sast-filter-apply');
        if (applyBtn) applyBtn.onclick = () => {
            applyExtendedFilters();
            modal.style.display = 'none';
        };
        
        const resetBtn = modal.querySelector('.sast-filter-reset');
        if (resetBtn) resetBtn.onclick = () => {
            if (excludeCheckbox) excludeCheckbox.checked = false;
            if (ruleSelect) ruleSelect.value = 'all';
            document.querySelectorAll('#tab-sast .sast-row').forEach(row => row.style.display = '');
            modal.style.display = 'none';
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };
    }
    
    // Запуск фильтров при загрузке
    setTimeout(() => {
        filterSca();
        filterSast();
    }, 200);
</script>
    
</body>
</html>`;
}

export {
    formatBytes,
    delay,
    escapeHtml,
    loadJSZip,
    createZipArchive,
    generateCodeHTML,
    generateSummaryHTML,
    generateHTMLReport
};