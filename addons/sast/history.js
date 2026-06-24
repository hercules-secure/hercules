export function generateHTMLReport(report) {
    // Проверка на случай пустых данных
    if (!report || !report.results) {

        return '<html><body><h1>Ошибка: неверный формат отчета</h1></body></html>';
    }
    
    const getShortPath = (filePath) => {
        if (!filePath) return 'unknown';
        const parts = filePath.split(/[/\\]/);
        return parts.length > 3 ? parts.slice(-3).join('/') : filePath;
    };
    
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
    
    // Функция для экранирования HTML
    const escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    
    // Функция для отображения блока кода
    const renderCodeBlock = (item) => {
        if (item.codeBlock && item.codeBlock.lines && item.codeBlock.lines.length > 0) {
            return `
                <div class="code-block" style="background: #1f2937; color: #e5e7eb; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 12px; margin-bottom: 12px; overflow-x: auto;">
                    ${item.codeBlock.lines.map(line => `
                        <div style="${line.isVulnerable ? 'background: rgba(239, 68, 68, 0.2); border-left: 3px solid #ef4444; padding-left: 8px;' : 'padding-left: 8px;'}">
                            <span style="color: #888; display: inline-block; width: 45px;">${line.number}</span>
                            <span style="${line.isVulnerable ? 'color: #ef4444;' : ''}">${escapeHtml(line.code)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        else if (item.code) {
            return `
                <div class="code-block" style="background: #1f2937; color: #e5e7eb; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 12px; margin-bottom: 12px; overflow-x: auto;">
                    <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(item.code)}</pre>
                </div>
            `;
        }
        return '';
    };
    
    // Получаем количества по severities
    const totalCount = report.results.length;
    const criticalCount = report.results.filter(r => r.severity === 'critical').length;
    const highCount = report.results.filter(r => r.severity === 'high').length;
    const mediumCount = report.results.filter(r => r.severity === 'medium').length;
    const lowCount = report.results.filter(r => r.severity === 'low').length;
    const infoCount = report.results.filter(r => r.severity === 'info').length;
    
    // Генерируем HTML для всех уязвимостей
    const allVulnerabilitiesHtml = report.results.map((item, index) => {
        const shortPath = getShortPath(item.file);
        
        return `
            <div class="vuln-item" data-severity="${item.severity}" style="background: #f8f9fa; padding: 16px; margin-bottom: 16px; border-radius: 8px; ">
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
                <p class="vuln-message" style="margin: 0 0 12px 0; font-weight: 500; color: #212529;">${escapeHtml(item.message)}</p>
                ${renderCodeBlock(item)}
                <div class="recommendation" style="background: rgba(40, 167, 69, 0.1); padding: 12px; border-radius: 6px; font-size: 13px; color: #28a745;">
                    <strong>Рекомендация:</strong> ${escapeHtml(item.recommendation || 'Рекомендация не указана')}
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
    <title>Геркулес | SAST - ${new Date().toLocaleDateString()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Ubuntu'; background: #f5f5f5; padding: 20px; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }
        .header { background: black; color: white; padding: 40px; }
        .header h1 { font-size: 32px; margin-bottom: 10px; }
        .header .meta { opacity: 0.9; font-size: 14px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; padding: 30px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .stat-card .label { font-size: 14px; color: #6c757d; margin-bottom: 10px; }
        .stat-card .value { font-size: 36px; font-weight: bold; }
        .total-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .total-card .label { color: rgba(255,255,255,0.9); }
        .content { padding: 30px; }
        .filter-bar { margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .filter-btn { padding: 8px 16px; background: #e9ecef; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; font-family: 'Ubuntu'; }
        .filter-btn.active { background: #667eea; color: white; }
        .filter-btn:hover { background: #667eea; color: white; }
        .search-box { flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 14px; min-width: 200px; font-family: 'Ubuntu'; }
        .search-box:focus { outline: none; border-color: #667eea; }
        .vuln-item { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .code-block { background: #1f2937; color: #e5e7eb; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 12px; margin-bottom: 12px; overflow-x: auto; }
        .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
        @media (max-width: 768px) { .stats { grid-template-columns: repeat(2, 1fr); } .header { padding: 20px; } .content { padding: 20px; } }
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
            <div class="stat-card total-card">
                <div class="label">Всего уязвимостей</div>
                <div class="value">${totalCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">Критические</div>
                <div class="value" style="color: #dc3545;">${criticalCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">Высокие</div>
                <div class="value" style="color: #fd7e14;">${highCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">Средние</div>
                <div class="value" style="color: #ffc107;">${mediumCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">Низкие</div>
                <div class="value" style="color: #28a745;">${lowCount}</div>
            </div>
            <div class="stat-card">
                <div class="label">Информационные</div>
                <div class="value" style="color: #6c757d;">${infoCount}</div>
            </div>
        </div>
        
        <div class="content">
            <div class="filter-bar">
                <input type="text" class="search-box" id="searchInput" placeholder="Поиск по сообщению, файлу или rule ID...">
                <button class="filter-btn active" data-filter="all">Все (${totalCount})</button>
                <button class="filter-btn" data-filter="critical">Критические (${criticalCount})</button>
                <button class="filter-btn" data-filter="high">Высокие (${highCount})</button>
                <button class="filter-btn" data-filter="medium">Средние (${mediumCount})</button>
                <button class="filter-btn" data-filter="low">Низкие (${lowCount})</button>
                <button class="filter-btn" data-filter="info">Инфо (${infoCount})</button>
            </div>
            
            <div id="vulnerabilitiesContainer">
                ${allVulnerabilitiesHtml}
            </div>
        </div>
        
        <div class="footer">
            <p>Сгенерировано с помощью Геркулес | Отчет содержит результаты анализа исходного кода</p>
        </div>
    </div>
    
    <script>
        const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
        const vulnItems = document.querySelectorAll('.vuln-item');
        const searchInput = document.getElementById('searchInput');
        
        let currentFilter = 'all';
        
        function filterItems() {
            const searchTerm = searchInput.value.toLowerCase();
            
            vulnItems.forEach(item => {
                const severity = item.dataset.severity;
                const text = item.innerText.toLowerCase();
                
                const matchesFilter = currentFilter === 'all' || severity === currentFilter;
                const matchesSearch = searchTerm === '' || text.includes(searchTerm);
                
                item.style.display = (matchesFilter && matchesSearch) ? 'block' : 'none';
            });
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
    </script>
</body>
</html>`;
}