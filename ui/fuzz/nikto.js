document.addEventListener('DOMContentLoaded', function () {
    // === 1. ЭЛЕМЕНТЫ ===
    const startBtn = document.getElementById('start-btn');
    const specUrlInput = document.getElementById('specUrl');
    const scoutResultPanel = document.getElementById('scoutResultPanel');
    const scoutBody = document.getElementById('scoutBody');
    const center = document.getElementById('center');

    const modeDomovoy = document.getElementById('modeDomovoy');
    const modeMetla = document.getElementById('modeMetla');
    const modeScout = document.getElementById('modeScout');

    if (!startBtn || !specUrlInput || !center) return;

    let currentMode = 'domovoy';

    // === 2. ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ ===
    function setMode(mode) {
        currentMode = mode;

        // Меняем класс на контейнере
        center.classList.remove('mode-domovoy', 'mode-metla', 'mode-scout');
        center.classList.add(`mode-${mode}`);

        // Активная кнопка
        [modeDomovoy, modeMetla, modeScout].forEach(btn => btn && btn.classList.remove('active'));

        if (mode === 'domovoy') {
            if (modeDomovoy) modeDomovoy.classList.add('active');
            specUrlInput.placeholder = 'Paste OpenAPI specification link (Swagger/OpenAPI)';
            startBtn.disabled = true;
        } else if (mode === 'metla') {
            if (modeMetla) modeMetla.classList.add('active');
            specUrlInput.placeholder = 'Paste URL for scanning (Broom)';
            startBtn.disabled = true;
        } else if (mode === 'scout') {
            if (modeScout) modeScout.classList.add('active');
            specUrlInput.placeholder = 'Enter URL for Scout (e.g., https://example.org)';
            startBtn.disabled = false; 
            // При переключении на Scout скрываем старые результаты
            if (scoutResultPanel) scoutResultPanel.style.display = 'none';
        }
    }

    if (modeDomovoy) modeDomovoy.addEventListener('click', () => setMode('domovoy'));
    if (modeMetla) modeMetla.addEventListener('click', () => setMode('metla'));
    if (modeScout) modeScout.addEventListener('click', () => setMode('scout'));
    setMode('domovoy');

        // === 3. КНОПКА START ===
        startBtn.addEventListener('click', async () => {
        if (currentMode !== 'scout') return;

        const targetUrl = specUrlInput.value.trim();
        if (!targetUrl) return;

        // 1. Включаем спиннер
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analysis running...';
        startBtn.classList.remove('active');

        // 2. Показываем загрузку в панели
        if (scoutResultPanel && scoutBody) {
            scoutResultPanel.style.display = 'block';
            scoutBody.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--accent);"><i class="fas fa-satellite-dish fa-spin" style="font-size: 3rem; margin-bottom: 16px;"></i><p>Analyzing target...</p></div>`;
        }

        try {
            // 3. Делаем запрос
            const response = await fetch('/api/fuzz/scout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: targetUrl })
            });

            // 4. Читаем как текст, чтобы не упасть, если пришел не JSON
            const text = await response.text();
            
            // 5. ГАСИМ КНОПКУ СРАЗУ, как только пришел ответ (неважно, успех или ошибка)
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play" style="margin-right: 6px;"></i>Start';
            if (currentMode === 'scout') startBtn.classList.add('active');

            // 6. Пытаемся распарсить JSON и отрисовать
            try {
                const data = JSON.parse(text);
                if (!response.ok) throw new Error(data.error || 'Scan failed');
                renderScoutResult(data);
            } catch (e) {
                // Если сервер вернул HTML или битый JSON
                if (scoutBody) {
                    scoutBody.innerHTML = `<div style="color: #ef4444; text-align:center; padding: 20px;"><i class="fas fa-exclamation-triangle"></i><p>Error: ${e.message}</p><pre style="text-align:left; font-size:10px; margin-top:10px;">${text.substring(0, 500)}</pre></div>`;
                }
            }

        } catch (error) {
            // 7. Если упала сеть (fetch), тоже гасим кнопку
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play" style="margin-right: 6px;"></i>Start';
            if (currentMode === 'scout') startBtn.classList.add('active');

            if (scoutBody) {
                scoutBody.innerHTML = `<div style="color: #ef4444; text-align:center; padding: 20px;"><i class="fas fa-exclamation-triangle"></i><p>Network Error: ${error.message}</p></div>`;
            }
        }
    });

    // === 4. ОТРИСОВКА РЕЗУЛЬТАТА ===
    function renderScoutResult(data) {
        if (!scoutBody) return;

        // --- Заголовки ---
        const headersList = Object.entries(data.headers || {})
            .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join('');

        // --- Порты ---
        const ports = data.ports || data.openPorts || [];
        
        const portServices = {
            21: { name: 'FTP', desc: 'File Transfer Protocol' },
            22: { name: 'SSH', desc: 'Secure Shell' },
            23: { name: 'Telnet', desc: 'Unencrypted text communications' },
            25: { name: 'SMTP', desc: 'Simple Mail Transfer Protocol' },
            53: { name: 'DNS', desc: 'Domain Name System' },
            80: { name: 'HTTP', desc: 'Hypertext Transfer Protocol' },
            110: { name: 'POP3', desc: 'Post Office Protocol' },
            143: { name: 'IMAP', desc: 'Internet Message Access Protocol' },
            443: { name: 'HTTPS', desc: 'HTTP Secure' },
            3306: { name: 'MySQL', desc: 'Database Server' },
            5432: { name: 'PostgreSQL', desc: 'Database Server' },
            6379: { name: 'Redis', desc: 'In-memory Data Store' },
            8080: { name: 'HTTP Alt', desc: 'Alternative HTTP Port' },
            8443: { name: 'HTTPS Alt', desc: 'Alternative HTTPS Port' }
        };

        // Генерируем строки таблицы портов с ИКОНКОЙ
        const portsTableRows = ports.map(p => {
            const service = portServices[p.port] || { name: 'Unknown', desc: 'Unknown service' };
            const statusClass = p.status === 'open' ? 'open' : 'closed';
            
            // Добавляем иконку в 5-ю колонку
            return `
                <tr>
                    <td><strong>${p.port}</strong></td>
                    <td><span class="port-service">${service.name}</span></td>
                    <td><span class="port-desc">${service.desc}</span></td>
                    <td><span class="port-status ${statusClass}">${p.status.toUpperCase()}</span></td>
                    <td style="text-align: center;">
                        <i class="fas fa-info-circle" style="color: var(--accent); cursor: pointer; font-size: 1.1rem;" onclick="openPortModal()" title="Info"></i>
                    </td>
                </tr>
            `;
        }).join('');

        const portsHtml = ports.length > 0 ? `
            <table class="scout-table-ports">
                <thead>
                    <tr>
                        <th>Port</th>
                        <th>Service</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th style="text-align: center;">Action</th>
                    </tr>
                </thead>
                <tbody>${portsTableRows}</tbody>
            </table>
        ` : '<p>No ports scanned</p>';

        // --- SSL ---
        let sslHtml = '<span>No SSL info</span>';
        if (data.ssl) {
            sslHtml = `
                <p><strong>Issuer:</strong> ${data.ssl.issuer || 'Unknown'}</p>
                <p><strong>Subject:</strong> ${data.ssl.subject || 'Unknown'}</p>
                <p><strong>Valid To:</strong> ${data.ssl.validTo || '-'} (${data.ssl.daysLeft ?? '?'} days left)</p>
                <p><strong>Authorized:</strong> ${data.ssl.authorized ? '✅ Yes' : '❌ No'}</p>
            `;
        }

        scoutBody.innerHTML = `
            <div class="scout-grid">
                <div class="scout-card">
                    <h4>Target Info</h4>
                    <p><strong>Target:</strong> ${data.target || '-'}</p>
                    <p><strong>Final URL:</strong> ${data.finalUrl || '-'}</p>
                    <p><strong>Status:</strong> <span class="badge-green">${data.status || '-'}</span></p>
                    <p><strong>Server IP:</strong> ${data.serverIp || 'Unknown'}</p>
                </div>

                <div class="scout-card">
                    <h4>SSL Certificate</h4>
                    ${sslHtml}
                </div>

                <div class="scout-card full-width">
                    <h4>Open Ports & Services</h4>
                    ${portsHtml}
                </div>

                <div class="scout-card full-width">
                    <h4>Headers</h4>
                    <table class="scout-table"><tbody>${headersList || '<tr><td>No headers</td></tr>'}</tbody></table>
                </div>
            </div>
        `;
    }

    window.openPortModal = function() {
    const modal = document.getElementById('portInfoModal');
    if (modal) modal.classList.add('active');
};
});