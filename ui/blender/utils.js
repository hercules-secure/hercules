// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Форматирование байтов
export function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Задержка
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Экранирование HTML
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Загрузка библиотеки JSZip
export function loadJSZip() {
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
export async function createZipArchive(files, folderName) {
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

// ========== ЭМУЛЯЦИЯ ПРОГРЕССА ==========

export async function emulateProgress(updateTaskProgress, onComplete) {
    const tasks = [
        { id: 'task1', name: 'Подготовка', steps: 10 },
        { id: 'task2', name: 'Сканирование структуры', steps: 8 },
        { id: 'task3', name: 'Поиск зависимостей', steps: 8 },
        { id: 'task4', name: 'Анализ кода', steps: 10 },
        { id: 'task5', name: 'Поиск уязвимостей', steps: 8 },
        { id: 'task6', name: 'Поиск API', steps: 8 },
        { id: 'task7', name: 'Генерация отчета', steps: 6 }
    ];
    
    for (const task of tasks) {
        for (let step = 1; step <= task.steps; step++) {
            const percent = Math.round((step / task.steps) * 100);
            updateTaskProgress(task.id, percent, 'running', `${task.name}... ${percent}%`);
            await delay(300);
        }
        
        updateTaskProgress(task.id, 100, 'completed', `${task.name} завершен`);
        await delay(200);
    }
    
    if (onComplete) onComplete();
}

// ========== ФУНКЦИИ ДЛЯ ГЕНЕРАЦИИ HTML ==========

// Вспомогательная функция для получения цвета метода API
function getMethodColor(method) {
    switch(method?.toUpperCase()) {
        case 'GET': return '#10b981';
        case 'POST': return '#3b82f6';
        case 'PUT': return '#f59e0b';
        case 'DELETE': return '#ef4444';
        case 'PATCH': return '#8b5cf6';
        default: return '#64748b';
    }
}

// Вспомогательная функция для получения API эндпоинтов из отчета
function extractApiEndpoints(report) {
    if (!report) {
        return [];
    }
    
    if (report.fuzz?.endpoints && Array.isArray(report.fuzz.endpoints) && report.fuzz.endpoints.length > 0) {
        return report.fuzz.endpoints;
    }
    
    if (report.apiEndpoints && Array.isArray(report.apiEndpoints) && report.apiEndpoints.length > 0) {
        return report.apiEndpoints;
    }
    
    if (report.endpoints && Array.isArray(report.endpoints) && report.endpoints.length > 0) {
        return report.endpoints;
    }
    
    return [];
}

// Вспомогательная функция для получения статистики API
function extractApiStatistics(report, endpoints) {
    if (report.fuzz?.statistics) {
        return report.fuzz.statistics;
    }
    
    return {
        fromCode: endpoints.filter(e => e.source === 'code').length,
        fromSwagger: endpoints.filter(e => e.source === 'swagger').length
    };
}
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
        
        // Подсчитываем статистику уязвимостей
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
    }
    
    if (!dependencies?.length) {
        return '<div class="info-box">Зависимости не найдены</div>';
    }
    
    const grouped = dependencies.reduce((acc, dep) => {
        const manager = dep.manager || 'unknown';
        if (!acc[manager]) acc[manager] = [];
        acc[manager].push(dep);
        return acc;
    }, {});
    
    // Добавляем блок статистики
    let html = `
        <div class="vuln-stats" style="display: flex; gap: 16px; margin-bottom: 24px;">
            <div class="summary-card critical" style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                <div class="card-value" style="font-size: 28px; font-weight: 700; color: #dc2626;">${vulnerabilityStats.critical}</div>
                <div class="card-label" style="font-size: 12px; color: #64748b;">Critical</div>
            </div>
            <div class="summary-card high" style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                <div class="card-value" style="font-size: 28px; font-weight: 700; color: #f97316;">${vulnerabilityStats.high}</div>
                <div class="card-label" style="font-size: 12px; color: #64748b;">High</div>
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
                                <th style="padding: 10px; text-align: left;">Пакет</th>
                                <th style="padding: 10px; text-align: left;">Версия</th>
                                <th style="padding: 10px; text-align: left;">Источник</th>
                                <th style="padding: 10px; text-align: center;">Уязвимости</th>
                                <th style="padding: 10px; text-align: left;">Лицензия</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(dep => `
                                <tr style="border-bottom: 1px solid #e2e8f0;">
                                    <td style="padding: 10px;"><strong>${escapeHtml(dep.name)}</strong>${dep.type === 'development' ? '<span style="font-size: 10px; background: #e2e8f0; padding: 2px 6px; border-radius: 10px; margin-left: 8px;">dev</span>' : ''}</td>
                                    <td style="padding: 10px; font-family: monospace;">${escapeHtml(dep.version || 'unknown')}</td>
                                    <td style="padding: 10px; font-size: 11px; color: #64748b;">${escapeHtml(dep.file || '-')}</td>
                                    <td style="padding: 10px; text-align: center;">
                                    ${dep.cveCount > 0 ? `
                                        <span style="background: #f9731620; color: #f97316; padding: 2px 8px; border-radius: 16px; font-weight: 600; font-size: 12px;">
                                            ${dep.cveCount}
                                        </span>
                                    ` : `
                                        <span style="color: #10b981;">Нет</span>
                                    `}
                                </td>
                                <td style="padding: 10px;">
                                    <span style="background: #94a3b820; color: #94a3b8; padding: 4px 8px; border-radius: 12px; font-size: 11px;">
                                        ${escapeHtml(dep.license || 'UNKNOWN')}
                                    </span>
                                </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    return html;
}

// Вспомогательная функция для получения рекомендации по лицензии
function getLicenseRecommendation(license) {
    const recommendations = {
        'GPL-2.0': 'Требует открытия исходного кода при распространении',
        'GPL-3.0': 'Требует открытия исходного кода при распространении',
        'AGPL-3.0': 'Требует открытия исходного кода даже при использовании через сеть',
        'MPL-2.0': 'Требует открытия только изменённых файлов',
        'CC-BY-NC-4.0': 'Запрещено коммерческое использование',
        'UNKNOWN': 'Требуется проверка лицензии юристом'
    };
    return recommendations[license] || 'Лицензия совместима с коммерческим использованием';
}

// Генерация HTML API эндпоинтов
export function generateApiHTML(report) {
    if (!report) {
        return '<div class="info-box" style="text-align: left; padding: 20px; background: #fee2e2; border-radius: 8px; color: #991b1b;">Ошибка: отчет не передан в generateApiHTML</div>';
    }
    
    const apiEndpoints = extractApiEndpoints(report);
    
    if (!apiEndpoints.length) {
        return `
            <div class="info-box" style="text-align: left; padding: 20px; background: #fee2e2; border-radius: 8px;">
                <strong>API эндпоинты не найдены</strong>
            </div>
        `;
    }
    
    const stats = extractApiStatistics(report, apiEndpoints);
    const fromCode = stats.fromCode || apiEndpoints.filter(e => e.source === 'code').length;
    const fromSwagger = stats.fromSwagger || apiEndpoints.filter(e => e.source === 'swagger').length;
    
    const html = `
        <div class="api-container">
            <div class="api-stats" style="display: flex; gap: 16px; margin-bottom: 20px;">
                <div class="stat-card" style="flex: 1; background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center;">
                    <div class="stat-value" style="font-size: 24px; font-weight: bold; color: #2563eb;">${apiEndpoints.length}</div>
                    <div class="stat-label" style="font-size: 12px; color: #64748b;">Всего эндпоинтов</div>
                </div>
                ${fromCode > 0 ? `
                <div class="stat-card" style="flex: 1; background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center;">
                    <div class="stat-value" style="font-size: 24px; font-weight: bold; color: #10b981;">${fromCode}</div>
                    <div class="stat-label" style="font-size: 12px; color: #64748b;">Из кода</div>
                </div>
                ` : ''}
                ${fromSwagger > 0 ? `
                <div class="stat-card" style="flex: 1; background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center;">
                    <div class="stat-value" style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${fromSwagger}</div>
                    <div class="stat-label" style="font-size: 12px; color: #64748b;">Из Swagger</div>
                </div>
                ` : ''}
            </div>
            <h4 style="margin-bottom: 15px;">Найденные API эндпоинты (${apiEndpoints.length}):</h4>
            <div class="endpoints-list" style="display: flex; flex-direction: column; gap: 8px;">
                ${apiEndpoints.map(ep => {
                    const method = ep.method || 'GET';
                    const path = ep.path || '/';
                    const methodColor = getMethodColor(method);
                    const fileInfo = ep.file ? `<span style="font-size: 11px; color: #64748b; margin-left: 8px;">📄 ${escapeHtml(ep.file)}${ep.line ? `:${ep.line}` : ''}</span>` : '';
                    
                    return `
                        <div class="endpoint-item" style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: white; border-radius: 8px;">
                            <span class="method-badge" style="font-weight: 600; font-size: 12px; min-width: 60px; color: ${methodColor};">${escapeHtml(method)}</span>
                            <span style="font-family: monospace; font-size: 13px; flex: 1; word-break: break-all;">${escapeHtml(path)}</span>
                            ${fileInfo}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    return html;
}

// Генерация HTML кода (SAST)

export function generateCodeHTML(report) {
    let issues = [];
    let statistics = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
    
    if (report.sast?.issues) {
        issues = report.sast.issues;
        statistics = report.sast.statistics || statistics;
    } else if (report.codeAnalysis?.issues) {
        issues = report.codeAnalysis.issues;
        statistics = report.codeAnalysis || statistics;
    }
    
    if (!issues?.length) {
        return `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>Уязвимостей не найдено</h3>
                <p>SAST анализ не выявил проблем в коде</p>
            </div>
        `;
    }
    
    const criticalIssues = issues.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL');
    const highIssues = issues.filter(i => (i.severity || '').toUpperCase() === 'HIGH');
    const filteredIssues = [...criticalIssues, ...highIssues];
    
    const criticalCount = criticalIssues.length;
    const highCount = highIssues.length;
    const mediumCount = issues.filter(i => (i.severity || '').toUpperCase() === 'MEDIUM').length;
    const lowCount = issues.filter(i => {
        const sev = (i.severity || '').toUpperCase();
        return sev === 'LOW' || sev === 'INFO' || !sev;
    }).length;
    
    if (filteredIssues.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-shield-alt"></i>
                <h3>Критических проблем не найдено</h3>
                <p>Найдено только проблем низкой и средней критичности (Medium: ${escapeHtml(String(mediumCount))}, Low: ${escapeHtml(String(lowCount))})</p>
                <p style="margin-top: 12px; font-size: 12px; opacity: 0.7;">Полный отчет доступен в загружаемом HTML файле</p>
            </div>
        `;
    }
    
    let html = `
        <div class="sast-summary">
            <div class="summary-cards" style="display: flex; gap: 16px; margin-bottom: 20px;">
                <div class="summary-card critical" style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center;">
                    <div class="card-value" style="font-size: 28px; font-weight: 700; color: #dc2626;">${escapeHtml(String(criticalCount))}</div>
                    <div class="card-label" style="font-size: 12px; color: #64748b;">Critical</div>
                </div>
                <div class="summary-card high" style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center;">
                    <div class="card-value" style="font-size: 28px; font-weight: 700; color: #f97316;">${escapeHtml(String(highCount))}</div>
                    <div class="card-label" style="font-size: 12px; color: #64748b;">High</div>
                </div>
            </div>
            ${mediumCount > 0 || lowCount > 0 ? `
                <div class="info-note" style="margin-top: 12px; padding: 8px 12px; background: #fef9c3; border-radius: 8px; color: #854d0e; font-size: 12px;">
                    <i class="fas fa-info-circle"></i> Дополнительно: Medium (${escapeHtml(String(mediumCount))}), Low (${escapeHtml(String(lowCount))}) — доступны в полном отчете
                </div>
            ` : ''}
        </div>
        <div class="issues-list" style="margin-top: 20px;">
            <h3 style="margin-bottom: 16px;">Критические проблемы безопасности (${escapeHtml(String(filteredIssues.length))})</h3>
    `;
    
    for (const issue of filteredIssues) {
        const severityClass = (issue.severity || 'low').toLowerCase();
        
        let snippetText = '';
        if (issue.snippet) {
            if (typeof issue.snippet === 'string') {
                snippetText = issue.snippet;
            } else if (issue.snippet.text) {
                snippetText = issue.snippet.text;
            } else if (issue.snippet.matchText) {
                snippetText = issue.snippet.matchText;
            }
        }
        
        // Экранируем все поля
        const escapedSeverity = escapeHtml(issue.severity || 'LOW');
        const escapedRule = escapeHtml(issue.rule || issue.type || 'unknown');
        const escapedMessage = escapeHtml(issue.message || issue.description || 'Описание отсутствует');
        const escapedFile = escapeHtml(issue.file || issue.filePath || 'unknown');
        const escapedLine = issue.line ? escapeHtml(String(issue.line)) : '';
        const escapedSnippet = snippetText ? escapeHtml(snippetText.substring(0, 500)) : '';
        const escapedRecommendation = issue.recommendation ? escapeHtml(issue.recommendation) : '';
        
        html += `
            <div class="issue-item" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 12px;">
                <div class="issue-header" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span class="issue-severity ${severityClass}" style="padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: ${severityClass === 'critical' ? '#fee2e2' : '#ffedd5'}; color: ${severityClass === 'critical' ? '#dc2626' : '#f97316'};">${escapedSeverity.toUpperCase()}</span>
                    <span class="issue-rule" style="font-family: monospace; font-size: 11px; background: #e2e8f0; padding: 4px 8px; border-radius: 6px;">${escapedRule}</span>
                </div>
                <div class="issue-message" style="font-size: 14px; font-weight: 500; margin-bottom: 8px;">${escapedMessage}</div>
                <div class="issue-location" style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
                    <i class="fas fa-file-alt"></i>
                    ${escapedFile}
                    ${escapedLine ? `:${escapedLine}` : ''}
                </div>
                ${escapedSnippet ? `
                    <div class="issue-snippet" style="background: #1e293b; border-radius: 8px; padding: 12px; overflow-x: auto; margin-top: 8px;">
                        <code style="font-family: 'Consolas', monospace; font-size: 11px; color: #a5f3fc; white-space: pre-wrap;">${escapedSnippet}${snippetText.length > 500 ? '...' : ''}</code>
                    </div>
                ` : ''}
                ${escapedRecommendation ? `
                    <div style="margin-top: 8px; padding: 8px; background: #eff6ff; border-radius: 6px; font-size: 12px; color: #1e40af;">
                        <i class="fas fa-lightbulb"></i> ${escapedRecommendation}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    html += `</div>`;
    return html;
}

// Генерация сводки (Summary)
export function generateSummaryHTML(report) {
    const scaStats = report.sca?.statistics || { totalDependencies: 0, totalVulnerabilities: 0 };
    const sastStats = report.sast?.statistics || { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
    
    const apiEndpoints = extractApiEndpoints(report);
    const apiEndpointsCount = apiEndpoints.length;
    
    const topIssues = (report.sast?.issues || []).slice(0, 5);
    
    let topIssuesHtml = '';
    for (const issue of topIssues) {
        let snippetText = '';
        if (issue.snippet) {
            if (typeof issue.snippet === 'string') {
                snippetText = issue.snippet;
            } else if (issue.snippet.text) {
                snippetText = issue.snippet.text;
            }
        }
        
        topIssuesHtml += `
            <div class="issue-item" style="margin-bottom: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                <div class="issue-header" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span class="issue-severity ${(issue.severity || 'info').toLowerCase()}" style="padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600;">${issue.severity || 'INFO'}</span>
                    <span class="issue-rule" style="font-family: monospace; font-size: 10px;">${escapeHtml(issue.ruleId || issue.rule || 'unknown')}</span>
                </div>
                <div class="issue-message" style="font-size: 12px; margin-bottom: 6px;">${escapeHtml(issue.message)}</div>
                <div class="issue-location" style="font-size: 10px; color: #64748b;">
                    <i class="fas fa-file-code"></i>
                    ${escapeHtml(issue.file)}:${issue.line || '?'}
                </div>
                ${snippetText ? `<div class="issue-snippet" style="margin-top: 8px; padding: 6px; background: #1e293b; border-radius: 6px;"><code style="font-size: 10px; color: #a5f3fc;">${escapeHtml(snippetText.substring(0, 100))}</code></div>` : ''}
            </div>
        `;
    }
    
    return `
        <div class="summary-container">
            <div class="summary-stats" style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 20px;">
                <div class="stat-card" style="flex: 1; min-width: 100px; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                    <div class="stat-value" style="font-size: 28px; font-weight: 700;">${scaStats.totalDependencies || 0}</div>
                    <div class="stat-label" style="font-size: 12px; color: #64748b;">Зависимостей</div>
                </div>
                <div class="stat-card" style="flex: 1; min-width: 100px; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                    <div class="stat-value" style="font-size: 28px; font-weight: 700;">${scaStats.totalVulnerabilities || 0}</div>
                    <div class="stat-label" style="font-size: 12px; color: #64748b;">SCA уязвимостей</div>
                </div>
                <div class="stat-card" style="flex: 1; min-width: 100px; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                    <div class="stat-value" style="font-size: 28px; font-weight: 700;">${sastStats.total || 0}</div>
                    <div class="stat-label" style="font-size: 12px; color: #64748b;">SAST проблем</div>
                </div>
                <div class="stat-card" style="flex: 1; min-width: 100px; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0;">
                    <div class="stat-value" style="font-size: 28px; font-weight: 700;">${apiEndpointsCount || 0}</div>
                    <div class="stat-label" style="font-size: 12px; color: #64748b;">API эндпоинтов</div>
                </div>
            </div>
            
            ${sastStats.critical > 0 ? `
                <div class="info-box" style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px; margin-bottom: 20px; border-radius: 8px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Обнаружены критические уязвимости!</strong> Рекомендуется немедленное исправление.
                </div>
            ` : ''}
            
            ${topIssues.length > 0 ? `
                <div class="top-issues">
                    <h3 style="margin-bottom: 12px;">Топ проблем безопасности</h3>
                    ${topIssuesHtml}
                </div>
            ` : '<div class="empty-state" style="text-align: center; padding: 48px;"><i class="fas fa-shield-alt"></i><h3>Проблем не найдено</h3></div>'}
        </div>
    `;
}

// Генерация полного HTML отчета с ТАБАМИ
export function generateHTMLReport(report) {
    const normalizedReport = {
        ...report,
        sast: report.sast || { issues: [], statistics: {} },
        sca: report.sca || { dependencies: [], vulnerabilities: [] },
        fuzz: report.fuzz || { endpoints: [], statistics: {} }
    };
    
    // Подсчет для бейджей на табах
    const sastIssuesCount = normalizedReport.sast.issues?.length || 0;
    const scaVulnsCount = normalizedReport.sca.vulnerabilities?.length || 0;
    const apiEndpointsCount = normalizedReport.fuzz.endpoints?.length || 0;
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Отчет анализа безопасности - ${new Date().toISOString()}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alef:wght@400;700&display=swap">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Ubuntu';
            background: white;
            padding: 40px 20px;
            line-height: 1.5;
        }
        .report-container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            overflow: hidden;
        }
        .report-header {
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
            color: white;
            padding: 32px 40px;
        }
        .report-header h1 {
            font-size: 28px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .report-header h1 i {
            font-size: 32px;
            color: white;
        }
        .report-header p {
            opacity: 0.8;
            font-size: 14px;
            margin-top: 8px;
        }
        
        /* TAB Navigation */
        .tab-bar {
            display: flex;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            padding: 0 40px;
            gap: 4px;
            flex-wrap: wrap;
        }
        .tab-btn {
            padding: 16px 24px;
            font-size: 15px;
            font-weight: 500;
            background: transparent;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            color: #64748b;
            transition: all 0.2s ease;
            border-radius: 12px 12px 0 0;
            font-family: 'Ubuntu', sans-serif;
        }
        .tab-btn i {
            font-size: 16px;
        }
        .tab-btn:hover {
            background: #e2e8f0;
            color: #1e293b;
        }
        .tab-btn.active {
            background: white;
            color: #3b82f6;
            border-bottom: 3px solid #3b82f6;
            font-weight: 600;
        }
        .tab-badge {
            background: #e2e8f0;
            color: #475569;
            padding: 2px 8px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 6px;
        }
        .tab-badge.critical {
            background: #fee2e2;
            color: #dc2626;
        }
        .tab-badge.warning {
            background: #ffedd5;
            color: #ea580c;
        }
        
        /* TAB Content */
        .tab-content {
            display: none;
            padding: 32px 40px;
            animation: fadeIn 0.3s ease;
        }
        .tab-content.active {
            display: block;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Cards & Stats */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }
        .stat-card {
            background: #f8fafc;
            padding: 20px;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            transition: all 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.08);
        }
        .stat-value {
            font-size: 36px;
            font-weight: 700;
            color: #0f172a;
        }
        .stat-label {
            font-size: 14px;
            color: #64748b;
            margin-top: 8px;
        }
        
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-critical { background: #fee2e2; color: #dc2626; }
        .badge-high { background: #ffedd5; color: #ea580c; }
        .badge-medium { background: #fef9c3; color: #ca8a04; }
        .badge-low { background: #dcfce7; color: #16a34a; }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        th {
            background: #f8fafc;
            font-size: 13px;
            font-family: 'Ubuntu';
            color: #0f172a;
        }
        tr:hover {
            background: #f8fafc;
        }
        
        .empty-state {
            text-align: center;
            padding: 48px;
            color: #94a3b8;
        }
        .empty-state i {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
        
        .info-box {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        @media (max-width: 768px) {
            .tab-bar { padding: 0 16px; }
            .tab-content { padding: 20px; }
            .report-header { padding: 24px; }
            .tab-btn { padding: 12px 16px; font-size: 13px; }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1>
                <i class="fas fa-flask"></i>
                Геркулес | Блендер
            </h1>
            <p>Отчет о проблемах безопасности — ${new Date().toLocaleString()}</p>
        </div>
        
        <!-- TAB BAR -->
        <div class="tab-bar">
            <button class="tab-btn active" data-tab="summary">
                <i class="fas fa-chart-pie"></i> Общая сводка
            </button>
            <button class="tab-btn" data-tab="sca">
                <i class="fas fa-cubes"></i> Зависимости (SCA)
                ${scaVulnsCount > 0 ? `<span class="tab-badge critical">${scaVulnsCount}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="sast">
                <i class="fas fa-code"></i> SAST
                ${sastIssuesCount > 0 ? `<span class="tab-badge ${sastIssuesCount > 5 ? 'critical' : 'warning'}">${sastIssuesCount}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="api">
                <i class="fas fa-plug"></i> API Эндпоинты
                ${apiEndpointsCount > 0 ? `<span class="tab-badge">${apiEndpointsCount}</span>` : ''}
            </button>
        </div>
        
        <!-- TAB CONTENT: Summary -->
        <div id="tab-summary" class="tab-content active">
            ${generateSummaryHTML(normalizedReport)}
        </div>
        
        <!-- TAB CONTENT: SCA -->
        <div id="tab-sca" class="tab-content">
            ${generateDependenciesHTML(normalizedReport)}
        </div>
        
        <!-- TAB CONTENT: SAST -->
        <div id="tab-sast" class="tab-content">
            ${generateCodeHTML(normalizedReport)}
        </div>
        
        <!-- TAB CONTENT: API -->
        <div id="tab-api" class="tab-content">
            ${generateApiHTML(normalizedReport)}
        </div>
    </div>
    
    <script>
        // Таб-переключение
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                
                // Убираем активные классы у всех кнопок
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Прячем все контенты
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Показываем выбранный контент
                const targetContent = document.getElementById('tab-' + tabId);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    </script>
</body>
</html>`;
}

export default {
    formatBytes,
    delay,
    escapeHtml,
    loadJSZip,
    createZipArchive,
    emulateProgress,
    generateDependenciesHTML,
    generateApiHTML,
    generateCodeHTML,
    generateSummaryHTML,
    generateHTMLReport
};