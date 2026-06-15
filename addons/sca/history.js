export function generateHTMLReport(report) {
    if (!report) return '<html><body><h1>Нет данных</h1></body></html>';
    
    const stats = extractStats(report);
    const vulnerabilities = extractVulnerabilities(report);
    const reportDate = new Date().toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alef:wght@400;700&display=swap">
    <title>Геркулес | SCA - ${new Date().toLocaleDateString()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Ubuntu', sans-serif; background: #f5f5f5; padding: 20px; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }
        .header { background: black; color: white; padding: 40px; }
        .header h1 { font-size: 32px; margin-bottom: 10px; }
        .header .meta { opacity: 0.9; font-size: 14px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; padding: 30px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-card .label { font-size: 14px; color: #6c757d; margin-bottom: 10px; }
        .stat-card .value { font-size: 36px; font-weight: bold; }
        .content { padding: 30px; }
        .filter-bar { margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .filter-btn { padding: 8px 16px; background: #e9ecef; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; font-family: 'Ubuntu', sans-serif; }
        .filter-btn.active { background: #667eea; color: white; }
        .filter-btn:hover { background: #667eea; color: white; }
        .search-box { flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 14px; min-width: 200px; font-family: 'Ubuntu', sans-serif; }
        .search-box:focus { outline: none; border-color: #667eea; }
        .vuln-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .vuln-table th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; }
        .vuln-table td { padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 13px; font-family: 'Ubuntu', sans-serif; }
        .severity-CRITICAL { color: #dc3545; font-weight: bold; }
        .severity-HIGH { color: #fd7e14; font-weight: bold; }
        .severity-MODERATE { color: #ffc107; }
        .severity-LOW { color: #28a745; }
        .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
        @media (max-width: 768px) {
            .stats { grid-template-columns: repeat(2, 1fr); }
            .vuln-table { font-size: 12px; }
            .vuln-table th, .vuln-table td { padding: 8px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Геркулес | SCA</h1>
            <div class="meta">
                <div>Дата генерации: ${reportDate}</div>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="label">Компонентов</div>
                <div class="value" style="color: #667eea;">${stats.components}</div>
            </div>
            <div class="stat-card">
                <div class="label">Уязвимостей</div>
                <div class="value" style="color: #fd7e14;">${stats.vulnerabilities}</div>
            </div>
            <div class="stat-card">
                <div class="label">Критических</div>
                <div class="value" style="color: #dc3545;">${stats.critical}</div>
            </div>
            <div class="stat-card">
                <div class="label">Высоких</div>
                <div class="value" style="color: #fd7e14;">${stats.high}</div>
            </div>
            <div class="stat-card">
                <div class="label">Средних</div>
                <div class="value" style="color: #ffc107;">${stats.medium}</div>
            </div>
            <div class="stat-card">
                <div class="label">Низких</div>
                <div class="value" style="color: #28a745;">${stats.low}</div>
            </div>
        </div>
        
        <div class="content">
            <div class="filter-bar">
                <input type="text" class="search-box" id="searchInput" placeholder="Поиск по компоненту, CVE ID или описанию...">
                <button class="filter-btn active" data-filter="all">Все <span style="font-family: 'Alef'">(${stats.vulnerabilities})</span></button>
                <button class="filter-btn" data-filter="CRITICAL">Критические <span style="font-family: 'Alef'">(${stats.critical})</span></button>
                <button class="filter-btn" data-filter="HIGH">Высокие <span style="font-family: 'Alef'">(${stats.high})</span></button>
                <button class="filter-btn" data-filter="MODERATE">Средние <span style="font-family: 'Alef'">(${stats.medium})</span></button>
                <button class="filter-btn" data-filter="LOW">Низкие <span style="font-family: 'Alef'">(${stats.low})</span></button>
            </div>
            
            <table class="vuln-table" id="vulnTable">
                <thead>
                    <tr>
                        <th>Компонент</th>
                        <th>Версия</th>
                        <th>CVE ID</th>
                        <th>Описание</th>
                        <th>Серьезность</th>
                    </tr>
                </thead>
                <tbody id="vulnTableBody">
                    ${vulnerabilities.map(v => `
                        <tr data-severity="${v.severity}" data-component="${escapeHtml(v.component)}" data-cve="${v.id}" data-description="${escapeHtml(v.description)}">
                            <td><strong>${escapeHtml(v.component)}</strong></td>
                            <td>${v.version}</td>
                            <td><a href="${v.url}" target="_blank" style="color: #0066cc;">${v.id}</a></td>
                            <td style="font-size:13px">${escapeHtml(v.description.substring(0, 150))}${v.description.length > 150 ? '...' : ''}</td>
                            <td class="severity-${v.severity}">${v.severity}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>Сгенерировано с помощью Геркулес | Анализ выполнен на основе данных публичных баз CVE</p>
            <p>Рекомендуется обновить уязвимые компоненты до последних версий</p>
        </div>
    </div>
    
    <script>
        (function() {
            const filterBtns = document.querySelectorAll('.filter-btn');
            const searchInput = document.getElementById('searchInput');
            const rows = document.querySelectorAll('#vulnTableBody tr');
            let currentFilter = 'all';
            
            function filterRows() {
                const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
                
                rows.forEach(row => {
                    const severity = row.getAttribute('data-severity');
                    const component = (row.getAttribute('data-component') || '').toLowerCase();
                    const cve = (row.getAttribute('data-cve') || '').toLowerCase();
                    const description = (row.getAttribute('data-description') || '').toLowerCase();
                    
                    const matchesFilter = currentFilter === 'all' || severity === currentFilter;
                    const matchesSearch = searchTerm === '' || 
                        component.indexOf(searchTerm) !== -1 || 
                        cve.indexOf(searchTerm) !== -1 || 
                        description.indexOf(searchTerm) !== -1;
                    
                    row.style.display = matchesFilter && matchesSearch ? '' : 'none';
                });
            }
            
            if (filterBtns) {
                filterBtns.forEach(btn => {
                    btn.addEventListener('click', function() {
                        filterBtns.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        currentFilter = this.getAttribute('data-filter');
                        filterRows();
                    });
                });
            }
            
            if (searchInput) {
                searchInput.addEventListener('input', filterRows);
            }
            
            // Запуск фильтра при загрузке
            filterRows();
        })();
    </script>
</body>
</html>`;
}

function extractStats(report) {
    let components = report.components?.length || 0;
    let vulnerabilities = 0;
    let critical = 0, high = 0, medium = 0, low = 0;
    
    if (report.vulnerabilities) {
        vulnerabilities = report.vulnerabilities.length;
        for (const v of report.vulnerabilities) {
            const severity = (v.severity || '').toUpperCase();
            if (severity === 'CRITICAL') critical++;
            else if (severity === 'HIGH') high++;
            else if (severity === 'MODERATE' || severity === 'MEDIUM') medium++;
            else if (severity === 'LOW') low++;
        }
    }
    
    return { components, vulnerabilities, critical, high, medium, low };
}

function extractVulnerabilities(report) {
    if (!report.vulnerabilities) return [];
    return report.vulnerabilities.map(v => ({
        component: v.component?.name || v.package || 'Unknown',
        version: v.component?.version || v.version || 'Unknown',
        id: v.id || 'N/A',
        severity: (v.severity || 'UNKNOWN').toUpperCase(),
        url: v.url || `https://osv.dev/vulnerability/${v.id}`,
        description: v.description || v.summary || 'Нет описания'
    }));
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}