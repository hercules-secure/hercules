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
        script.onload = () => {

            resolve();
        };
        script.onerror = () => reject(new Error('Не удалось загрузить JSZip'));
        document.head.appendChild(script);
    });
}

// Создание ZIP архива из файлов
export async function createZipArchive(files, folderName) {
    return new Promise(async (resolve, reject) => {
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
            
            const zipBlob = await zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });
            
            resolve(zipBlob);
        } catch (error) {
            reject(error);
        }
    });
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

// Генерация HTML зависимостей

export function generateDependenciesHTML(report) {
    let dependencies = [];
    
    if (report.sca && report.sca.dependencies) {
        dependencies = report.sca.dependencies;
    } else if (report.dependencies && report.dependencies.packages) {
        dependencies = report.dependencies.packages;
    }
    
    if (!dependencies || dependencies.length === 0) {
        return '<div class="info-box" style="text-align: left;">Зависимости не найдены</div>';
    }
    
    // Группировка по менеджеру
    const grouped = {};
    for (const dep of dependencies) {
        const manager = dep.manager || 'unknown';
        if (!grouped[manager]) grouped[manager] = [];
        grouped[manager].push(dep);
    }
    
    let html = `<div class="dependencies-container"><h4 style="margin-bottom: 15px;">Найдено зависимостей: ${dependencies.length}</h4>`;
    
    for (const [manager, items] of Object.entries(grouped)) {
        html += `
            <div class="dep-group" style="margin-bottom: 20px;">
                <h5 class="dep-manager" style="margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid #3b82f6; display: inline-block;">${manager.toUpperCase()}</h5>
                <table class="dep-table" style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">Название</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">Версия</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">Файл</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(dep => `
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(dep.name)}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;font-family: 'Alef'">${escapeHtml(dep.version || 'unknown')}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(dep.file || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    html += `</div>`;
    return html;
}

// Генерация HTML API
export function generateApiHTML(report) {
    const apiEndpoints = report.apiEndpoints || [];
    
    if (apiEndpoints.length === 0) {
        return '<div class="info-box" style="text-align: left;">API эндпоинты не найдены</div>';
    }
    
    return `
        <h4 style="margin-bottom: 15px; text-align: left;">Найдено API эндпоинтов: ${apiEndpoints.length}</h4>
        <div class="endpoints-list">
            ${apiEndpoints.map(endpoint => `
                <div class="endpoint-item">${escapeHtml(endpoint)}</div>
            `).join('')}
        </div>
    `;
}

// Генерация HTML кода
// Генерация HTML кода (только Critical и High проблемы)
export function generateCodeHTML(report) {
    let issues = [];
    let statistics = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
    
    if (report.sast && report.sast.issues) {
        issues = report.sast.issues;
        statistics = report.sast.statistics || statistics;
    } else if (report.codeAnalysis && report.codeAnalysis.issues) {
        issues = report.codeAnalysis.issues;
        statistics = report.codeAnalysis || statistics;
    }
    
    if (!issues || issues.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>Уязвимостей не найдено</h3>
                <p>SAST анализ не выявил проблем в коде</p>
            </div>
        `;
    }
    
    // ФИЛЬТР: показываем только CRITICAL и HIGH
    const criticalIssues = issues.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL');
    const highIssues = issues.filter(i => (i.severity || '').toUpperCase() === 'HIGH');
    const filteredIssues = [...criticalIssues, ...highIssues];
    
    // Статистика только для Critical и High
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
                <p>Найдено только проблем низкой и средней критичности (Medium: ${mediumCount}, Low: ${lowCount})</p>
                <p style="margin-top: 12px; font-size: 12px; opacity: 0.7;">Полный отчет доступен в загружаемом HTML файле</p>
            </div>
        `;
    }
    
    let html = `
        <div class="sast-summary">
            <div class="summary-cards">
                <div class="summary-card critical">
                    <div class="card-value">${criticalCount}</div>
                    <div class="card-label">Critical</div>
                </div>
                <div class="summary-card high">
                    <div class="card-value">${highCount}</div>
                    <div class="card-label">High</div>
                </div>
            </div>
            ${mediumCount > 0 || lowCount > 0 ? `
                <div class="info-note" style="margin-top: 12px; padding: 8px 12px; background: #fef9c3; border-radius: 8px; color: #854d0e; font-size: 12px;">
                    <i class="fas fa-info-circle"></i> Дополнительно: Medium (${mediumCount}), Low (${lowCount}) — доступны в полном отчете
                </div>
            ` : ''}
        </div>
        <div class="issues-list" style="margin-top:10px">
            <h3>Критические проблемы безопасности (${filteredIssues.length})</h3>
    `;
    
    for (const issue of filteredIssues) {
        const severityClass = (issue.severity || 'low').toLowerCase();
        html += `
            <div class="issue-item ${severityClass}">
                <div class="issue-header">
                    <span class="issue-severity ${severityClass}">${(issue.severity || 'LOW').toUpperCase()}</span>
                    <span class="issue-rule">${escapeHtml(issue.rule || issue.type || 'unknown')}</span>
                </div>
                <div class="issue-message">${escapeHtml(issue.message || issue.description || 'Описание отсутствует')}</div>
                <div class="issue-location">
                    <i class="fas fa-file-alt"></i>
                    ${escapeHtml(issue.file || issue.filePath || 'unknown')}
                    ${issue.line ? `:${issue.line}` : ''}
                </div>
        `;
        
        if (issue.snippet) {
            html += `
                <div class="issue-snippet">
                    <code>${escapeHtml(issue.snippet.substring(0, 500))}${issue.snippet.length > 500 ? '...' : ''}</code>
                </div>
            `;
        }
        
        html += `</div>`;
    }
    
    html += `</div>`;
    return html;
}

// Генерация HTML сводки (ЕДИНСТВЕННАЯ ФУНКЦИЯ)
// Генерация HTML сводки (показывает все уровни, но акцент на Critical/High)
export function generateSummaryHTML(report) {
    const scaData = report.sca || { dependencies: [], vulnerabilities: [], statistics: {} };
    const sastData = report.sast || { issues: [], statistics: {} };
    
    const totalDeps = scaData.statistics?.totalDependencies || scaData.dependencies?.length || 0;
    const totalVulns = scaData.vulnerabilities?.length || 0;
    
    const sastIssues = sastData.issues || [];
    const criticalCount = sastIssues.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL').length;
    const highCount = sastIssues.filter(i => (i.severity || '').toUpperCase() === 'HIGH').length;
    const mediumCount = sastIssues.filter(i => (i.severity || '').toUpperCase() === 'MEDIUM').length;
    const lowCount = sastIssues.filter(i => {
        const sev = (i.severity || '').toUpperCase();
        return sev === 'LOW' || sev === 'INFO' || !sev;
    }).length;
    
    const totalSastIssues = sastIssues.length;
    
    const sourceHtml = report.source ? `
        <div class="source-info" style="margin-bottom: 20px; padding: 12px; background: #f8fafc; border-radius: 8px;font-family: 'Ubuntu'">
            <h3 style="margin-bottom: 8px; font-size: 14px;">Источник</h3>
            <p style="margin: 4px 0;"><strong>${report.sourceType || 'URL'}:</strong> ${escapeHtml(report.source)}</p>
            ${report.branch ? `<p style="margin: 4px 0;"><strong>Ветка:</strong> ${escapeHtml(report.branch)}</p>` : ''}
            <p style="margin: 4px 0;"><strong>Дата анализа:</strong> ${new Date(report.analyzedAt).toLocaleString()}</p>
        </div>
    ` : '';
    
    return `
        <div class="summary-container">
            ${sourceHtml}
            
            <div class="summary-section">
                <h3 style="margin-bottom: 12px; font-size: 16px;">SCA - Композиционный анализ</h3>
                <div class="summary-cards" style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
                    <div class="summary-card" style="flex: 1; min-width: 100px; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center;">
                        <div class="card-value" style="font-size: 28px; font-weight: 700;font-family: 'Alef'">${totalDeps}</div>
                        <div class="card-label" style="font-size: 12px; color: #64748b;font-family: 'Ubuntu'">Зависимостей</div>
                    </div>
                    <div class="summary-card ${totalVulns > 0 ? 'has-vulns' : ''}" style="flex: 1; min-width: 100px; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center;">
                        <div class="card-value" style="font-family: 'Alef';font-size: 28px; font-weight: 700; ${totalVulns > 0 ? 'color: #eab308;' : ''}">${totalVulns}</div>
                        <div class="card-label" style="font-family: 'Ubuntu';font-size: 12px; color: #64748b;">Уязвимостей</div>
                    </div>
                </div>
                ${totalVulns > 0 ? `
                    <div class="alert-message warning" style="padding: 12px; background: #fef9c3; border-radius: 8px; margin-bottom: 12px;">
                        <i class="fas fa-exclamation-triangle"></i> Найдено ${totalVulns} уязвимостей в зависимостях
                    </div>
                ` : `
                    <div class="alert-message success" style="padding: 12px; background: #dcfce7; border-radius: 8px; margin-bottom: 12px;">
                        <i class="fas fa-check-circle"></i> Уязвимостей в зависимостях не найдено
                    </div>
                `}
            </div>
            
            <div class="summary-section" style="margin-top: 24px;">
                <h3 style="margin-bottom: 12px; font-size: 16px;">SAST - Статический анализ кода</h3>
                <div class="summary-cards" style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
                    <div class="summary-card critical" style="flex: 1; min-width: 100px; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center;">
                        <div class="card-value" style="font-size: 28px; font-weight: 700; color: #dc2626;">${criticalCount}</div>
                        <div class="card-label" style="font-size: 12px; color: #64748b;">Critical</div>
                    </div>
                    <div class="summary-card high" style="flex: 1; min-width: 100px; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center;">
                        <div class="card-value" style="font-size: 28px; font-weight: 700; color: #f97316;">${highCount}</div>
                        <div class="card-label" style="font-size: 12px; color: #64748b;">High</div>
                    </div>
                    <div class="summary-card medium muted" style="flex: 1; min-width: 100px; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; opacity: 0.6;">
                        <div class="card-value" style="font-size: 28px; font-weight: 700; color: #eab308;">${mediumCount}</div>
                        <div class="card-label" style="font-size: 12px; color: #64748b;">Medium</div>
                    </div>
                    <div class="summary-card low muted" style="flex: 1; min-width: 100px; background: #f8fafc; border-radius: 12px; padding: 16px; text-align: center; opacity: 0.6;">
                        <div class="card-value" style="font-size: 28px; font-weight: 700; color: #22c55e;">${lowCount}</div>
                        <div class="card-label" style="font-size: 12px; color: #64748b;">Low</div>
                    </div>
                </div>
                
                ${criticalCount > 0 || highCount > 0 ? `
                    <div class="alert-message error" style="padding: 12px; background: #fee2e2; border-radius: 8px; margin-bottom: 12px;font-family: 'Ubuntu'">
                        <i class="fas fa-bug"></i> Обнаружены критические проблемы безопасности (Critical: <font style="font-family: 'Alef'">${criticalCount}</font>, High: <font style="font-family: 'Alef'">${highCount}</font>)
                    </div>
                    
                ` : mediumCount > 0 || lowCount > 0 ? `
                    <div class="alert-message warning" style="padding: 12px; background: #fef9c3; border-radius: 8px; margin-bottom: 12px;">
                        <i class="fas fa-info-circle"></i> Найдены проблемы низкой и средней критичности (Medium: ${mediumCount}, Low: ${lowCount})
                    </div>
                    <div style="margin-top: 12px;">
                        <a href="#" onclick="showResultTab('code'); return false;" class="view-details-link" style="color: #3b82f6; text-decoration: none;">
                            <i class="fas fa-arrow-right"></i> Подробный отчет по анализу кода
                        </a>
                    </div>
                ` : `
                    <div class="alert-message success" style="padding: 12px; background: #dcfce7; border-radius: 8px; margin-bottom: 12px;">
                        <i class="fas fa-check-circle"></i> Критических проблем безопасности не найдено
                    </div>
                `}
            </div>
            
            <div class="summary-section" style="margin-top: 24px;">
                <h3 style="margin-bottom: 12px; font-size: 16px;">Общая информация</h3>
                <div class="info-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                    <div class="info-item" style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 8px;">
                        <span class="info-label">Всего зависимостей:</span>
                        <span class="info-value">${totalDeps}</span>
                    </div>
                    <div class="info-item" style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 8px;">
                        <span class="info-label">Уязвимостей SCA:</span>
                        <span class="info-value ${totalVulns > 0 ? 'warning' : 'success'}">${totalVulns}</span>
                    </div>
                    <div class="info-item" style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 8px;">
                        <span class="info-label">Проблем SAST (всего):</span>
                        <span class="info-value">${totalSastIssues}</span>
                    </div>
                    <div class="info-item" style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 8px;">
                        <span class="info-label">Критические проблемы:</span>
                        <span class="info-value ${criticalCount > 0 ? 'critical' : ''}">${criticalCount}</span>
                    </div>
                    <div class="info-item" style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 8px;">
                        <span class="info-label">Высокий риск:</span>
                        <span class="info-value ${highCount > 0 ? 'high' : ''}">${highCount}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}
// Генерация полного HTML отчета для скачивания
export function generateHTMLReport(report) {
    const transformed = {
        ...report,
        sast: report.sast || { issues: [], statistics: {} },
        sca: report.sca || { dependencies: [], vulnerabilities: [] }
    };
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Отчет анализа безопасности - ${new Date().toISOString()}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alef:wght@400;700&display=swap">
    <style>
    /* Для букв и текста */
        @font-face {
            font-family: 'Ubuntu';
            src: local('Ubuntu');
            unicode-range: U+0000-024F; /* Латиница, кириллица, базовые символы */
        }

        /* Для цифр */
        @font-face {
            font-family: 'Alef';
            src: local('Alef');
            unicode-range: U+0030-0039; /* Только цифры 0-9 */
        }
    * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Ubuntu', sans-serif;
            background: white;
            padding: 40px 20px;
            line-height: 1.5;
        }
        .report-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 35px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .report-header {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            color: white;
            padding: 32px 40px;
        }
        .report-header h1 { font-size: 28px; margin-bottom: 8px; }
        .report-header p { opacity: 0.8; font-size: 14px; }
        .report-content { padding: 32px 40px; }
        
        .section {
            margin-bottom: 40px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 24px;
        }
        .section:last-child { border-bottom: none; margin-bottom: 0; }
        .section-title {
            font-size: 20px;
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section-title i { color: #3b82f6; }
        
        .summary-cards {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            margin-bottom: 16px;
        }
        .summary-card {
            flex: 1;
            min-width: 100px;
            background: #f8fafc;
            border-radius: 12px;
            padding: 16px;
            text-align: center;
            border: 1px solid #e2e8f0;
        }
        .summary-card .card-value {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 4px;
        }
        .summary-card .card-label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            font-family: 'Ubuntu';
        }
        .summary-card.critical .card-value { color: #dc2626; font-family: 'Alef'}
        .summary-card.high .card-value { color: #f97316; font-family: 'Alef' }
        .summary-card.medium .card-value { color: #eab308; font-family: 'Alef'}
        .summary-card.low .card-value { color: #22c55e; font-family: 'Alef'}
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            margin-top: 16px;
        }
        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 12px;
            background: #f8fafc;
            border-radius: 8px;
        }
        .info-label { font-size:13px; color: #64748b; font-family: 'Ubuntu'}
        .info-value { font-weight: 600; color: #0f172a; font-family: 'Alef'}
        .info-value.critical { color: #dc2626; }
        .info-value.high { color: #f97316; }
        .info-value.warning { color: #eab308; }
        .info-value.success { color: #22c55e; }
        
        .alert-message {
            padding: 12px 16px;
            border-radius: 8px;
            margin: 12px 0;
            font-size: 13px;
        }
        .alert-message.success { background: #dcfce7; color: #166534; }
        .alert-message.warning { background: #fef9c3; color: #854d0e; }
        .alert-message.error { background: #fee2e2; color: #991b1b; }
        
        .view-details-link {
            display: inline-block;
            color: #3b82f6;
            text-decoration: none;
            font-size: 14px;
        }
        .view-details-link:hover { text-decoration: underline; }
        
        .dep-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-family: 'Ubuntu'
        }
        .dep-table th, .dep-table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
        }
        .dep-table th { background: #f1f5f9; font-weight: 600; }
        
        .issue-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            flex-wrap: wrap;
            gap: 8px;
        }
        .issue-severity {
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .issue-severity.critical { background: #fee2e2; color: #dc2626; }
        .issue-severity.high { background: #ffedd5; color: #f97316; }
        .issue-severity.medium { background: #fef9c3; color: #eab308; }
        .issue-severity.low { background: #dcfce7; color: #22c55e; }
        .issue-rule {
            font-family: monospace;
            font-size: 11px;
            background: #e2e8f0;
            padding: 4px 8px;
            border-radius: 6px;
        }
        .issue-message { font-size: 14px; font-weight: 500; margin-bottom: 8px; }
        .issue-location { font-size: 12px; color: #64748b; margin-bottom: 8px; }
        .issue-snippet {
            background: #1e293b;
            border-radius: 8px;
            padding: 12px;
            overflow-x: auto;
            margin-top: 8px;
        }
        .issue-snippet code {
            font-family: 'Consolas', monospace;
            font-size: 11px;
            color: #a5f3fc;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .empty-state { text-align: center; padding: 48px; color: #64748b; }
        .empty-state i { font-size: 48px; margin-bottom: 16px; color: #22c55e; }
        
        @media (max-width: 768px) {
            .report-content { padding: 20px; }
            .report-header { padding: 24px; }
        }

    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1><i class="fas fa-chart-line"></i> Отчет анализа безопасности</h1>
            <p>Сгенерировано: ${new Date().toISOString()}</p>
        </div>
        <div class="report-content">
            <div class="section">
                <div class="section-title">
                    <i class="fas fa-chart-pie"></i>
                    <span>Общая сводка</span>
                </div>
                ${generateSummaryHTML(report)}
            </div>
            
            <div class="section">
                <div class="section-title">
                    <i class="fas fa-cubes"></i>
                    <span>Зависимости</span>
                </div>
                ${generateDependenciesHTML(report)}
            </div>
            
            <div class="section">
                <div class="section-title">
                    <i class="fas fa-code"></i>
                    <span>Анализ исходного кода (SAST)</span>
                </div>
                ${generateCodeHTML(report)}
            </div>
            
            <div class="section">
                <div class="section-title">
                    <i class="fas fa-plug"></i>
                    <span>API Эндпоинты</span>
                </div>
                ${generateApiHTML(report)}
            </div>
        </div>
    </div>
</body>
</html>`;
}