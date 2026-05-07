/**
 * UI компоненты
 */

import { showToolNotification } from './notifications.js';
import { getShortPath } from './utils.js';

/**
 * Показать модальное окно с результатами
 */
export function showResultsModal(results, onClose) {
    const criticalHigh = results.results.filter(r => 
        r.severity === 'critical' || r.severity === 'high'
    );
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;

    const severityColors = {
        critical: '#dc3545',
        high: '#fd7e14',
        medium: '#ffc107',
        low: '#28a745',
        info: '#6c757d'
    };

    const severityNames = {
        critical: 'Критический',
        high: 'Высокий',
        medium: 'Средний',
        low: 'Низкий',
        info: 'Информационный'
    };

    const criticalHighHtml = criticalHigh.length > 0 ? criticalHigh.map((item) => {
        const shortPath = getShortPath(item.file);
        
        return `
        <div style="background: #f8f9fa; padding: 16px; margin-bottom: 12px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                <div>
                    <span class="method-badge" style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; color: white; background: ${severityColors[item.severity]};">
                        ${severityNames[item.severity]}
                    </span>
                    <code style="background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 12px;">
                        ${shortPath}:${item.line || '?'}
                    </code>
                </div>
                <span style="color: #6c757d;">${item.ruleId || 'unknown'}</span>
            </div>
            <p style="margin: 0 0 12px 0; font-weight: 500;">${item.message}</p>
            <div style="background: #1f2937; color: #e5e7eb; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 12px; margin-bottom: 10px; overflow-x: auto;">
                ${item.code ? item.code.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}
            </div>
            <div style="background: rgba(40, 167, 69, 0.1); padding: 10px; border-radius: 6px; font-size: 12px; color: #28a745;">
                ${item.recommendation || 'Рекомендация не указана'}
            </div>
        </div>
    `}).join('') : '<div style="text-align: center; padding: 40px;">Критических и высоких уязвимостей не найдено</div>';

    overlay.innerHTML = `
        <div class="modal-container" style="background: white; border-radius: 16px; width: 90%; max-width: 1000px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); animation: modalFadeIn 0.3s ease;">
            <div class="modal-header" style="padding: 20px 24px; background: black; display: flex; justify-content: space-between; align-items: center; color: white;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Результаты анализа</h3>
                <span class="modal-close" style="cursor: pointer; font-size: 24px; color: white; line-height: 1;">&times;</span>
            </div>
            <div class="modal-body" style="padding: 24px; overflow-y: auto; flex: 1; background: #f8f9fa;">
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 24px;">
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                        <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #dc3545;">${results.summary.bySeverity.critical}</div>
                        <div class="stat-label" style="color: #6c757d; font-size: 12px;">Критические</div>
                    </div>
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                        <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #fd7e14;">${results.summary.bySeverity.high}</div>
                        <div class="stat-label" style="color: #6c757d; font-size: 12px;">Высокие</div>
                    </div>
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                        <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #ffc107;">${results.summary.bySeverity.medium}</div>
                        <div class="stat-label" style="color: #6c757d; font-size: 12px;">Средние</div>
                    </div>
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                        <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #28a745;">${results.summary.bySeverity.low}</div>
                        <div class="stat-label" style="color: #6c757d; font-size: 12px;">Низкие</div>
                    </div>
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                        <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #6c757d;">${results.summary.bySeverity.info}</div>
                        <div class="stat-label" style="color: #6c757d; font-size: 12px;">Инфо</div>
                    </div>
                </div>
                <h4 style="margin: 20px 0 16px 0; color: #212529;">Критические и высокие уязвимости (${criticalHigh.length})</h4>
                <div id="vulnerabilities-list">${criticalHighHtml}</div>
            </div>
            <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 12px; background: white;">
                <button id="downloadHtmlBtn" class="btn-html" style="background: #6f42c1; color: white; border: none; font-family: Ubuntu; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                    <i class="fab fa-html5"></i> Скачать HTML
                </button>
                <button id="downloadPdfBtn" class="btn-pdf" style="background: #dc3545; color: white; border: none; font-family: Ubuntu; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                    <i class="fas fa-file-pdf"></i> Скачать PDF
                </button>
                <button id="downloadReportBtn" class="btn-download" style="background: #10b981; color: white; border: none; font-family: Ubuntu; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                    <i class="fas fa-download"></i> Скачать JSON
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    
    const closePopup = () => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s';
        setTimeout(() => {
            overlay.remove();
            if (onClose) onClose();
        }, 200);
    };

    overlay.querySelector('.modal-close').addEventListener('click', closePopup);
    overlay.querySelector('#downloadReportBtn').addEventListener('click', () => downloadJSONReport(results));
    overlay.querySelector('#downloadPdfBtn').addEventListener('click', () => generatePDFReport(results));
    overlay.querySelector('#downloadHtmlBtn').addEventListener('click', () => downloadHTMLReport(results));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePopup();
    });
}

/**
 * Скачать отчет в JSON формате
 */
function downloadJSONReport(results) {
    try {
        const reportData = JSON.stringify(results, null, 2);
        const blob = new Blob([reportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sast-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToolNotification('JSON отчет успешно скачан', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showToolNotification('Ошибка при скачивании JSON отчета', 'error');
    }
}

/**
 * Скачать отчет в HTML формате (полноценная страница)
 */
function downloadHTMLReport(results) {
    try {
        showToolNotification('Генерация HTML отчета...', 'info');
        
        const htmlContent = generateFullHTMLReport(results);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sast-report-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToolNotification('HTML отчет успешно скачан', 'success');
    } catch (error) {
        console.error('HTML download error:', error);
        showToolNotification('Ошибка при скачивании HTML отчета', 'error');
    }
}

/**
 * Генерация полноценного HTML отчета (для скачивания)
 */
function generateFullHTMLReport(results) {
    const criticalHigh = results.results.filter(r => 
        r.severity === 'critical' || r.severity === 'high'
    );
    
    const allResults = results.results;
    
    const severityNames = {
        critical: 'Критический',
        high: 'Высокий',
        medium: 'Средний',
        low: 'Низкий',
        info: 'Информационный'
    };
    
    const severityColors = {
        critical: '#dc3545',
        high: '#fd7e14',
        medium: '#ffc107',
        low: '#28a745',
        info: '#6c757d'
    };
    
    // Генерируем HTML для всех уязвимостей (не только critical/high)
    const allVulnerabilitiesHtml = allResults.map((item, index) => {
        const shortPath = getShortPath(item.file);
        
        return `
            <div class="vuln-item" style="background: #f8f9fa; padding: 16px; margin-bottom: 16px; border-radius: 8px; ">
                <div class="vuln-header" style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                    <div>
                        <span class="severity-badge" style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; color: white; background: ${severityColors[item.severity]};">
                            ${severityNames[item.severity]}
                        </span>
                        <code class="file-path" style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 10px;">
                            ${shortPath}:${item.line || '?'}
                        </code>
                    </div>
                    <span class="rule-id" style="color: #6c757d; font-size: 12px;">${item.ruleId || 'unknown'}</span>
                </div>
                <p class="vuln-message" style="margin: 0 0 12px 0; font-weight: 500; color: #212529;">${item.message}</p>
                ${item.code ? `
                <div class="code-block" style="background: #1f2937; color: #e5e7eb; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 12px; margin-bottom: 12px; overflow-x: auto;">
                    <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">${item.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                </div>
                ` : ''}
                <div class="recommendation" style="background: rgba(40, 167, 69, 0.1); padding: 12px; border-radius: 6px; font-size: 13px; color: #28a745;">
                    <strong>Рекомендация:</strong> ${item.recommendation || 'Рекомендация не указана'}
                </div>
            </div>
        `;
    }).join('');
    
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alef:wght@400;700&display=swap">
    <title>Геркулес - ${new Date().toLocaleDateString()}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Ubuntu';
            background: white;
            padding: 20px;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        
        .header {
            background: black;
            color: white;
            padding: 40px;
        }
        
        .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }
        
        .header .meta {
            opacity: 0.9;
            font-size: 14px;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.2s;
        }
        
        .stat-card:hover {
            transform: translateY(-2px);
        }
        
        .stat-card .label {
            font-size: 14px;
            color: #6c757d;
            margin-bottom: 10px;
        }
        
        .stat-card .value {
            font-size: 36px;
            font-weight: bold;
            font-family: 'Alef'
        }
        
        .total-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .total-card .label {
            color: rgba(255,255,255,0.9);
        }
        
        .content {
            padding: 30px;
        }
        
        .filter-bar {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        }
        
        .filter-btn {
            padding: 8px 16px;
            background: #e9ecef;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
            font-family:'Ubuntu';
        }
        
        .filter-btn.active {
            background: #667eea;
            color: white;
        }
        
        .filter-btn:hover {
            background: #667eea;
            color: white;
        }
        
        .search-box {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #ced4da;
            border-radius: 6px;
            font-size: 14px;
            min-width: 200px;
            font-family: 'Ubuntu'
        }
        
        .search-box:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .vuln-item {
            animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #6c757d;
            font-size: 12px;
            border-top: 1px solid #e9ecef;
        }
        
        @media (max-width: 768px) {
            .stats {
                grid-template-columns: repeat(2, 1fr);
            }
            .header {
                padding: 20px;
            }
            .content {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Геркулес | SAST</h1>
            <div class="meta">
                <div>Дата генерации: ${new Date().toLocaleString()}</div>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="label">Всего уязвимостей</div>
                <div class="value" style="color: #667eea;">${results.results.length}</div>
            </div>
            <div class="stat-card">
                <div class="label">Критические</div>
                <div class="value" style="color: #dc3545;">${results.summary.bySeverity.critical}</div>
            </div>
            <div class="stat-card">
                <div class="label">Высокие</div>
                <div class="value" style="color: #fd7e14;">${results.summary.bySeverity.high}</div>
            </div>
            <div class="stat-card">
                <div class="label">Средние</div>
                <div class="value" style="color: #ffc107;">${results.summary.bySeverity.medium}</div>
            </div>
            <div class="stat-card">
                <div class="label">Низкие</div>
                <div class="value" style="color: #28a745;">${results.summary.bySeverity.low}</div>
            </div>
            <div class="stat-card">
                <div class="label">Информационные</div>
                <div class="value" style="color: #6c757d;">${results.summary.bySeverity.info}</div>
            </div>
        </div>
        
        <div class="content">
            <div class="filter-bar">
                <input type="text" class="search-box" id="searchInput" placeholder="Поиск по сообщению, файлу или rule ID...">
                <button class="filter-btn active" data-filter="all">Все <font style="font-family: 'Alef'">(${results.results.length})</font></button>
                <button class="filter-btn" data-filter="critical">Критические <font style="font-family: 'Alef'">(${results.summary.bySeverity.critical})</font></button>
                <button class="filter-btn" data-filter="high">Высокие <font style="font-family: 'Alef'">(${results.summary.bySeverity.high})</font></button>
                <button class="filter-btn" data-filter="medium">Средние <font style="font-family: 'Alef'">(${results.summary.bySeverity.medium})</font></button>
                <button class="filter-btn" data-filter="low">Низкие <font style="font-family: 'Alef'">(${results.summary.bySeverity.low})</font></button>
                <button class="filter-btn" data-filter="info">Инфо <font style="font-family: 'Alef'">(${results.summary.bySeverity.info})</font></button>
                <button id="expandAllBtn" class="filter-btn" style="background: #28a745; color: white;">Развернуть</button>
                <button id="collapseAllBtn" class="filter-btn" style="background: #6c757d; color: white;">Свернуть</button>
            </div>
            
            <div id="vulnerabilitiesContainer">
                ${allVulnerabilitiesHtml}
            </div>
        </div>
        
        <div class="footer">
            <p>Сгенерировано с помощью Геркулес | Отчет содержит результаты статического анализа безопасности кода</p>
            <p>Рекомендации по исправлению уязвимостей должны быть применены в соответствии с политикой безопасности организации</p>
        </div>
    </div>
    
    <script>
        // Фильтрация по severity
        const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
        const vulnItems = document.querySelectorAll('.vuln-item');
        const searchInput = document.getElementById('searchInput');
        
        let currentFilter = 'all';
        
        function filterItems() {
            const searchTerm = searchInput.value.toLowerCase();
            
            vulnItems.forEach(item => {
                const severity = getSeverityFromItem(item);
                const message = item.querySelector('.vuln-message')?.textContent.toLowerCase() || '';
                const filePath = item.querySelector('.file-path')?.textContent.toLowerCase() || '';
                const ruleId = item.querySelector('.rule-id')?.textContent.toLowerCase() || '';
                const code = item.querySelector('.code-block pre')?.textContent.toLowerCase() || '';
                
                const matchesFilter = currentFilter === 'all' || severity === currentFilter;
                const matchesSearch = searchTerm === '' || 
                    message.includes(searchTerm) || 
                    filePath.includes(searchTerm) || 
                    ruleId.includes(searchTerm) ||
                    code.includes(searchTerm);
                
                if (matchesFilter && matchesSearch) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        }
        
        function getSeverityFromItem(item) {
            const badge = item.querySelector('.severity-badge');
            if (!badge) return 'info';
            const text = badge.textContent.toLowerCase();
            if (text.includes('критический')) return 'critical';
            if (text.includes('высокий')) return 'high';
            if (text.includes('средний')) return 'medium';
            if (text.includes('низкий')) return 'low';
            return 'info';
        }
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                filterItems();
            });
        });
        
        searchInput.addEventListener('input', filterItems);
        
        // Развернуть/свернуть все (если есть детали)
        document.getElementById('expandAllBtn')?.addEventListener('click', () => {
            document.querySelectorAll('.code-block').forEach(block => {
                block.style.display = 'block';
            });
        });
        
        document.getElementById('collapseAllBtn')?.addEventListener('click', () => {
            document.querySelectorAll('.code-block').forEach(block => {
                block.style.display = 'none';
            });
        });
        
        // Анимация появления
        console.log('Отчет загружен, найдено уязвимостей: ${results.results.length}');
    </script>
</body>
</html>`;
}

/**
 * Генерация HTML контента для PDF (упрощенная версия для печати)
 */
function generatePDFHTML(results) {
    const criticalHigh = results.results.filter(r => 
        r.severity === 'critical' || r.severity === 'high'
    );
    
    const severityNames = {
        critical: 'Критический',
        high: 'Высокий',
        medium: 'Средний',
        low: 'Низкий',
        info: 'Информационный'
    };
    
    const severityColors = {
        critical: '#dc3545',
        high: '#fd7e14',
        medium: '#ffc107',
        low: '#28a745',
        info: '#6c757d'
    };
    
    const vulnerabilitiesHtml = criticalHigh.map((item, index) => {
        const shortPath = getShortPath(item.file);
        
        return `
            <div style="background: #f8f9fa; padding: 15px; margin-bottom: 15px; border-radius: 8px;  page-break-inside: avoid;">
                <div style="margin-bottom: 10px;">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; color: white; background: ${severityColors[item.severity]};">
                        ${severityNames[item.severity]}
                    </span>
                    <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-size: 11px; margin-left: 10px;">
                        ${shortPath}:${item.line || '?'}
                    </code>
                    <span style="float: right; color: #6c757d; font-size: 11px;">${item.ruleId || 'unknown'}</span>
                </div>
                <p style="margin: 0 0 12px 0; font-weight: 500; color: #212529; font-size: 13px;">${item.message}</p>
                ${item.code ? `
                <div style="background: #1f2937; color: #e5e7eb; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 10px; margin-bottom: 12px; overflow-x: auto;">
                    <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">${item.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                </div>
                ` : ''}
                <div style="background: #e8f5e9; padding: 10px; border-radius: 6px; font-size: 11px; color: #2e7d32;">
                    <strong>Рекомендация:</strong> ${item.recommendation || 'Рекомендация не указана'}
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>SAST Security Report</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: Arial, Helvetica, sans-serif;
                    padding: 20px;
                    color: #212529;
                    background: white;
                }
                .header {
                    margin-bottom: 30px;
                    text-align: center;
                    border-bottom: 2px solid #667eea;
                    padding-bottom: 20px;
                }
                h1 {
                    color: #1f2937;
                    font-size: 24px;
                    margin-bottom: 10px;
                }
                .date {
                    color: #6c757d;
                    font-size: 12px;
                }
                .stats-grid {
                    display: flex;
                    justify-content: space-between;
                    gap: 15px;
                    margin: 30px 0;
                    flex-wrap: wrap;
                }
                .stat-card {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                    border: 1px solid #e5e7eb;
                    flex: 1;
                    min-width: 80px;
                }
                .stat-number {
                    font-size: 28px;
                    font-weight: bold;
                }
                .stat-label {
                    color: #6c757d;
                    font-size: 11px;
                    margin-top: 5px;
                }
                .section-title {
                    margin: 30px 0 20px 0;
                    color: #1f2937;
                    font-size: 18px;
                    border-left: 4px solid #dc3545;
                    padding-left: 12px;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                    color: #6c757d;
                    font-size: 10px;
                }
                .no-vulns {
                    text-align: center;
                    padding: 40px;
                    color: #28a745;
                    font-size: 16px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔒 Отчет SAST анализа безопасности</h1>
                <div class="date">Дата генерации: ${new Date().toLocaleString()}</div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number" style="color: #dc3545;">${results.summary.bySeverity.critical}</div>
                    <div class="stat-label">Критические</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" style="color: #fd7e14;">${results.summary.bySeverity.high}</div>
                    <div class="stat-label">Высокие</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" style="color: #ffc107;">${results.summary.bySeverity.medium}</div>
                    <div class="stat-label">Средние</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" style="color: #28a745;">${results.summary.bySeverity.low}</div>
                    <div class="stat-label">Низкие</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" style="color: #6c757d;">${results.summary.bySeverity.info}</div>
                    <div class="stat-label">Информационные</div>
                </div>
            </div>
            
            <div class="section-title">
                📋 Критические и высокие уязвимости (${criticalHigh.length})
            </div>
            
            ${criticalHigh.length > 0 ? vulnerabilitiesHtml : '<div class="no-vulns">✓ Критических и высоких уязвимостей не найдено</div>'}
            
            <div class="footer">
                <p>Сгенерировано с помощью SAST Security Scanner</p>
                <p>Всего найдено уязвимостей: ${results.results.length}</p>
            </div>
        </body>
        </html>
    `;
}

/**
 * Генерация PDF с помощью window.print
 */
async function generatePDFReport(results) {
    try {
        showToolNotification('Подготовка PDF отчета...', 'info');
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '800px';
        iframe.style.height = '600px';
        document.body.appendChild(iframe);
        
        const htmlContent = generatePDFHTML(results);
        
        iframe.contentDocument.open();
        iframe.contentDocument.write(htmlContent);
        iframe.contentDocument.close();
        
        setTimeout(() => {
            try {
                iframe.contentWindow.print();
                showToolNotification('PDF отчет сгенерирован', 'success');
                
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            } catch (err) {
                console.error('Print error:', err);
                showToolNotification('Ошибка при генерации PDF', 'error');
                document.body.removeChild(iframe);
            }
        }, 500);
        
    } catch (error) {
        console.error('PDF generation error:', error);
        showToolNotification('Ошибка при генерации PDF: ' + error.message, 'error');
    }
}

/**
 * Показать сообщение о недоступности репозитория
 */
export function showRepositoryUnavailableMessage(url, onClose) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        backdrop-filter: blur(5px);
        padding: 16px;
    `;

    overlay.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 40px; max-width: 500px; width: 90%; text-align: center;">
            <div style="width: 80px; height: 80px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 40px; color: #dc2626;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h2 style="margin: 0 0 12px; color: #1f2937;">Репозиторий недоступен</h2>
            <p style="margin: 0 0 20px; color: #6b7280;">
                Не удалось подключиться к репозиторию<br>
                <strong style="color: #4b5563; word-break: break-all;">${url}</strong>
            </p>
            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: left;">
                <p style="margin: 0 0 12px; color: #374151; font-weight: 600;">
                    <i class="fas fa-lightbulb" style="color: #f59e0b; margin-right: 8px;"></i> Рекомендации:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                    <li style="margin-bottom: 8px;">Проверьте доступность репозитория</li>
                    <li style="margin-bottom: 8px;">Скачайте архив вручную</li>
                    <li style="margin-bottom: 8px;">Загрузите архив через форму выше</li>
                </ul>
            </div>
            <button id="close-unavailable-btn" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px;">Закрыть</button>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#close-unavailable-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
            if (onClose) onClose();
        });
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
            if (onClose) onClose();
        }
    });
}