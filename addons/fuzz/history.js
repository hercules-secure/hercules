// addons/fuzz/history.js

// ============================================================
// ГЕНЕРАЦИЯ HTML-ОТЧЕТА ПО ФАЗЗИНГУ
// ============================================================
export function generateHtmlReport(report) {
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
    <title>Геркулес |  Баба Яга - ${new Date().toLocaleDateString()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Ubuntu', sans-serif; background: #f5f5f5; padding: 20px; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }
        .header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 40px; }
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
        .vuln-table th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 500; font-size: 13px; border-bottom: 2px solid #dee2e6; font-family: 'Ubuntu' }
        .vuln-table td { padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 11px; font-family: 'Ubuntu'; }
        .severity-CRITICAL { color: #dc3545; font-weight: bold; }
        .severity-HIGH { color: #fd7e14; font-weight: bold; }
        .severity-MEDIUM { color: #ffc107; }
        .severity-LOW { color: #28a745; }
        .severity-INFO { color: #6c757d; }
        .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; color: white; }
        .badge-critical { background: #dc3545; }
        .badge-high { background: #fd7e14; }
        .badge-medium { background: #ffc107; color: #333; }
        .badge-low { background: #28a745; }
        .badge-info { background: #6c757d; }
        .method-badge { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
        .method-GET { background: #61affe; color: white; }
        .method-POST { background: #49cc90; color: white; }
        .method-PUT { background: #fca130; color: white; }
        .method-DELETE { background: #f93e3e; color: white; }
        .method-PATCH { background: #50e3c2; color: #333; }
        code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: monospace; word-break: break-all; }
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
            <h1>Геркулес |  Метла</h1>
            <div class="meta">
                <div>Дата генерации: ${reportDate}</div>
                <div>Сессия: ${report.session_id || 'N/A'}</div>
                <div>Эндпоинтов: ${stats.endpoints}</div>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="label">Всего тестов</div>
                <div class="value" style="color: #667eea;">${stats.totalTests}</div>
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
                <input type="text" class="search-box" id="searchInput" placeholder="Поиск по типу, эндпоинту или payload...">
                <button class="filter-btn active" data-filter="all">Все <span style="font-family: 'Alef'">(${stats.vulnerabilities})</span></button>
                <button class="filter-btn" data-filter="CRITICAL">Критические <span style="font-family: 'Alef'">(${stats.critical})</span></button>
                <button class="filter-btn" data-filter="HIGH">Высокие <span style="font-family: 'Alef'">(${stats.high})</span></button>
                <button class="filter-btn" data-filter="MEDIUM">Средние <span style="font-family: 'Alef'">(${stats.medium})</span></button>
                <button class="filter-btn" data-filter="LOW">Низкие <span style="font-family: 'Alef'">(${stats.low})</span></button>
            </div>
            
            ${vulnerabilities.length === 0 ? `
            <div style="text-align: center; padding: 60px 20px; background: #d4edda; border-radius: 8px;">
                <h3 style="color: #155724; margin-bottom: 12px;">Уязвимостей не найдено</h3>
                <p style="color: #155724;">Все тесты прошли успешно</p>
            </div>
            ` : `
            <table class="vuln-table" id="vulnTable">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Тип</th>
                        <th>Severity</th>
                        <th>Эндпоинт</th>
                        <th>Метод</th>
                        <th>Статус</th>
                        <th>Payload</th>
                    </tr>
                </thead>
                <tbody id="vulnTableBody">
                    ${vulnerabilities.map((v, index) => `
                        <tr data-severity="${v.severity}" data-type="${escapeHtml(v.type)}" data-endpoint="${escapeHtml(v.endpoint)}">
                            <td>${index + 1}</td>
                            <td><strong>${escapeHtml(v.type)}</strong></td>
                            <td><span class="badge badge-${v.severity.toLowerCase()}">${v.severity}</span></td>
                            <td><code>${escapeHtml(v.endpoint)}</code></td>
                            <td><span class="method-badge method-${v.method}">${v.method}</span></td>
                            <td>${v.response_status || 'N/A'}</td>
                            <td><code style="font-size: 11px; word-break: break-all;">${escapeHtml(v.payload || '').substring(0, 80)}${(v.payload || '').length > 80 ? '...' : ''}</code></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            `}
        </div>
        
        <div class="footer">
            <p>Сгенерировано с помощью Геркулес |  Метла</p>
            <p>Всего тестов: ${stats.totalTests} | Найдено уязвимостей: ${stats.vulnerabilities}</p>
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
                    const type = (row.getAttribute('data-type') || '').toLowerCase();
                    const endpoint = (row.getAttribute('data-endpoint') || '').toLowerCase();
                    
                    const matchesFilter = currentFilter === 'all' || severity === currentFilter;
                    const matchesSearch = searchTerm === '' || 
                        type.indexOf(searchTerm) !== -1 || 
                        endpoint.indexOf(searchTerm) !== -1;
                    
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
            
            filterRows();
        })();
    </script>
</body>
</html>`;
}

function extractStats(report) {
    const summary = report.summary || {};
    const vulnerabilities = report.vulnerabilities || [];
    
    let totalTests = summary.total_tests || 0;
    let endpoints = summary.endpoints_tested || 0;
    let vulnCount = vulnerabilities.length || 0;
    let critical = 0, high = 0, medium = 0, low = 0;
    
    for (const v of vulnerabilities) {
        const severity = (v.severity || '').toUpperCase();
        if (severity === 'CRITICAL') critical++;
        else if (severity === 'HIGH') high++;
        else if (severity === 'MEDIUM' || severity === 'MODERATE') medium++;
        else if (severity === 'LOW') low++;
        else low++;
    }
    
    return { totalTests, endpoints, vulnerabilities: vulnCount, critical, high, medium, low };
}

function extractVulnerabilities(report) {
    if (!report.vulnerabilities) return [];
    return report.vulnerabilities.map(v => ({
        type: v.type || 'Unknown',
        severity: (v.severity || 'INFO').toUpperCase(),
        endpoint: v.endpoint || '/',
        method: v.method || 'GET',
        response_status: v.response_status || 'N/A',
        payload: v.payload || ''
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