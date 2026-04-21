// ==================== ФУНКЦИИ ДЛЯ ВОСПРОИЗВЕДЕНИЯ ТЕСТА ====================

function replayTest(testCase) {
    // Создаем модальное окно если его нет
    let modal = document.getElementById('replayModal');
    if (!modal) {
        createReplayModal();
        modal = document.getElementById('replayModal');
        document.getElementById('fuzzModal').style = 'filter: blur(5px);'
    }
    
    // Сохраняем тест для экспорта
    window.currentTestCase = testCase;
    window.currentCurlCommand = generateCurlCommand(testCase);
    window.currentPostmanJson = generatePostmanCollection(testCase);
    window.currentRawRequest = generateRawRequest(testCase);
    
    const modalBody = document.getElementById('replayModalBody');
    if (!modalBody) return;
    
    // Формируем URL для отображения
    const displayUrl = testCase.url || testCase.path || '/';
    const displayMethod = testCase.method?.toUpperCase() || 'GET';
    
    // Формируем заголовки
    let headers = testCase.headers || {};
    
    // Добавляем заголовки из payload если есть
    if (testCase.payload && testCase.payload.headers) {
        headers = { ...headers, ...testCase.payload.headers };
    }
    
    // Формируем тело запроса
    let requestBody = testCase.body;
    if (testCase.payload && (testCase.payload.body || testCase.payload.query)) {
        if (testCase.payload.body) requestBody = testCase.payload.body;
        if (testCase.payload.query && Object.keys(testCase.payload.query).length > 0) {
            displayUrl += '?' + new URLSearchParams(testCase.payload.query).toString();
        }
    }
    
    // Формируем query параметры
    let queryParams = testCase.queryParams || {};
    if (testCase.payload && testCase.payload.query) {
        queryParams = { ...queryParams, ...testCase.payload.query };
    }
    
    modalBody.innerHTML = `
        <div class="replay-toolbar">
            <button class="btn btn-secondary" onclick="copyAsCurl()"><i class="fas fa-terminal"></i> cURL</button>
            <button class="btn btn-secondary" onclick="copyAsFetch()"><i class="fab fa-js"></i> Fetch API</button>
            <button class="btn btn-secondary" onclick="exportToPostman()"><i class="fas fa-download"></i> Postman</button>
            <button class="btn btn-secondary" onclick="copyRawRequest()"><i class="fas fa-copy"></i> Raw HTTP</button>
        </div>
        
        <!-- Информация о тесте -->
        <div class="replay-section">
            <div class="replay-section-header" onclick="toggleReplaySection('test-info-section')">
                <span><i class="fas fa-info-circle"></i> Информация о тесте</span>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="test-info-section" class="replay-section-content">
                <div class="info-row"><strong>Тип теста:</strong> <span class="test-type-badge test-type-${testCase.type}">${testCase.type || 'unknown'}</span></div>
                <div class="info-row"><strong>Эндпоинт:</strong> <code>${escapeHtml(testCase.path || testCase.endpoint || '/')}</code></div>
                <div class="info-row"><strong>Ожидаемый статус:</strong> ${testCase.expectedStatus?.join(', ') || '200'}</div>
                ${testCase.status ? `<div class="info-row"><strong>Фактический статус:</strong> <span style="color: ${testCase.status >= 400 ? '#ef4444' : '#10b981'}">${testCase.status}</span></div>` : ''}
                ${testCase.error ? `<div class="info-row"><strong>Ошибка:</strong> <span style="color: #ef4444;">${escapeHtml(testCase.error)}</span></div>` : ''}
            </div>
        </div>
        
        <!-- Request Line -->
        <div class="replay-section">
            <div class="replay-section-header" onclick="toggleReplaySection('request-line-section')">
                <span><i class="fas fa-code"></i> Request Line</span>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="request-line-section" class="replay-section-content">
                <div class="http-line">
                    <span class="method-badge method-${displayMethod}">${displayMethod}</span>
                    <code>${escapeHtml(displayUrl)}</code>
                    <span class="http-version">HTTP/1.1</span>
                </div>
            </div>
        </div>
        
        <!-- Заголовки -->
        <div class="replay-section">
            <div class="replay-section-header" onclick="toggleReplaySection('headers-section')">
                <span><i class="fas fa-heading"></i> Headers</span>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="headers-section" class="replay-section-content">
                ${renderHeaders(headers)}
            </div>
        </div>
        
        <!-- Query параметры -->
        ${Object.keys(queryParams).length > 0 ? `
        <div class="replay-section">
            <div class="replay-section-header" onclick="toggleReplaySection('params-section')">
                <span><i class="fas fa-search"></i> Query Parameters</span>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="params-section" class="replay-section-content">
                ${renderQueryParams(queryParams)}
            </div>
        </div>
        ` : ''}
        
        <!-- Тело запроса -->
        ${requestBody ? `
        <div class="replay-section">
            <div class="replay-section-header" onclick="toggleReplaySection('body-section')">
                <span><i class="fas fa-database"></i> Request Body</span>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="body-section" class="replay-section-content">
                <div class="content-type">
                    Content-Type: ${headers['Content-Type'] || headers['content-type'] || 'application/json'}
                </div>
                <pre class="json-viewer">${formatBody(requestBody)}</pre>
            </div>
        </div>
        ` : '<div class="replay-section"><div class="replay-section-header"><span><i class="fas fa-database"></i> Request Body</span></div><div class="replay-section-content"><div class="empty-message">Нет тела запроса</div></div></div>'}
        
        <!-- Payload (если есть) -->
        ${testCase.payload ? `
        <div class="replay-section">
            <div class="replay-section-header" onclick="toggleReplaySection('payload-section')">
                <span><i class="fas fa-bug"></i> Payload (вредоносная нагрузка)</span>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="payload-section" class="replay-section-content">
                <div class="payload-info">
                    <strong>Тип payload:</strong> ${testCase.type || 'unknown'}
                </div>
                <pre class="json-viewer payload-viewer">${formatPayload(testCase.payload)}</pre>
            </div>
        </div>
        ` : ''}
        
        <!-- Ответ сервера (если есть) -->
        ${testCase.response ? `
        <div class="replay-section">
            <div class="replay-section-header" onclick="toggleReplaySection('response-section')">
                <span><i class="fas fa-reply"></i> Server Response</span>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="response-section" class="replay-section-content">
                <div class="info-row"><strong>Статус:</strong> <span style="color: ${testCase.status >= 400 ? '#ef4444' : '#10b981'}">${testCase.status}</span></div>
                <pre class="json-viewer">${formatBody(testCase.response)}</pre>
            </div>
        </div>
        ` : ''}
        
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="close-button" onclick="closeReplayModal()">Закрыть</button>
        </div>
    `;
    
    // Показываем модальное окно
    modal.style.display = 'flex';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function formatPayload(payload) {
    if (!payload) return 'Нет данных';
    
    let result = '';
    
    if (payload.query && Object.keys(payload.query).length > 0) {
        result += '=== QUERY PARAMETERS ===\n';
        result += JSON.stringify(payload.query, null, 2);
        result += '\n\n';
    }
    
    if (payload.path && Object.keys(payload.path).length > 0) {
        result += '=== PATH PARAMETERS ===\n';
        result += JSON.stringify(payload.path, null, 2);
        result += '\n\n';
    }
    
    if (payload.body) {
        result += '=== BODY ===\n';
        result += JSON.stringify(payload.body, null, 2);
        result += '\n\n';
    }
    
    if (payload.headers && Object.keys(payload.headers).length > 0) {
        result += '=== HEADERS ===\n';
        result += JSON.stringify(payload.headers, null, 2);
    }
    
    if (result === '') {
        result = JSON.stringify(payload, null, 2);
    }
    
    return syntaxHighlight(result);
}

function renderHeaders(headers) {
    if (!headers || Object.keys(headers).length === 0) {
        return '<div class="empty-message">Нет заголовков</div>';
    }
    
    let html = '<table class="headers-table">';
    for (const [key, value] of Object.entries(headers)) {
        html += `
            <tr>
                <td class="header-key">${escapeHtml(key)}:</td>
                <td class="header-value">${escapeHtml(String(value))}</td>
            </tr>
        `;
    }
    html += '</table>';
    return html;
}

function renderQueryParams(params) {
    if (!params || Object.keys(params).length === 0) {
        return '<div class="empty-message">Нет параметров</div>';
    }
    
    let html = '<table class="headers-table">';
    for (const [key, value] of Object.entries(params)) {
        html += `
            <tr>
                <td class="header-key">${escapeHtml(key)}:</td>
                <td class="header-value">${escapeHtml(String(value))}</td>
            </tr>
        `;
    }
    html += '</table>';
    return html;
}

function formatBody(body) {
    if (!body) return 'Нет данных';
    if (typeof body === 'object') {
        return syntaxHighlight(JSON.stringify(body, null, 2));
    }
    return escapeHtml(String(body));
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            } else {
                cls = 'json-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function generateRawRequest(testCase) {
    const method = testCase.method?.toUpperCase() || 'GET';
    let path = testCase.url || testCase.path || '/';
    
    // Добавляем query параметры из payload
    if (testCase.payload && testCase.payload.query && Object.keys(testCase.payload.query).length > 0) {
        const queryString = new URLSearchParams(testCase.payload.query).toString();
        path = path.includes('?') ? `${path}&${queryString}` : `${path}?${queryString}`;
    }
    
    let raw = `${method} ${path} HTTP/1.1\r\n`;
    
    // Заголовки
    let headers = testCase.headers || {};
    if (testCase.payload && testCase.payload.headers) {
        headers = { ...headers, ...testCase.payload.headers };
    }
    
    for (const [key, value] of Object.entries(headers)) {
        raw += `${key}: ${value}\r\n`;
    }
    raw += '\r\n';
    
    // Тело запроса
    let body = testCase.body;
    if (testCase.payload && testCase.payload.body) {
        body = testCase.payload.body;
    }
    
    if (body) {
        raw += typeof body === 'object' ? JSON.stringify(body, null, 2) : body;
    }
    
    return raw;
}

function generateCurlCommand(testCase) {
    let url = testCase.url || testCase.path || '/';
    const method = testCase.method?.toUpperCase() || 'GET';
    
    // Добавляем query параметры из payload
    if (testCase.payload && testCase.payload.query && Object.keys(testCase.payload.query).length > 0) {
        const queryString = new URLSearchParams(testCase.payload.query).toString();
        url = url.includes('?') ? `${url}&${queryString}` : `${url}?${queryString}`;
    }
    
    let curl = `curl -X ${method} \\\n  '${url}'`;
    
    // Заголовки
    let headers = testCase.headers || {};
    if (testCase.payload && testCase.payload.headers) {
        headers = { ...headers, ...testCase.payload.headers };
    }
    
    Object.entries(headers).forEach(([key, value]) => {
        curl += ` \\\n  -H '${key}: ${value}'`;
    });
    
    // Тело запроса
    let body = testCase.body;
    if (testCase.payload && testCase.payload.body) {
        body = testCase.payload.body;
    }
    
    if (body) {
        const bodyStr = typeof body === 'object' ? JSON.stringify(body) : body;
        curl += ` \\\n  -d '${bodyStr.replace(/'/g, "\\'")}'`;
    }
    
    return curl;
}

function generatePostmanCollection(testCase) {
    let url = testCase.url || testCase.path || '/';
    const method = testCase.method?.toUpperCase() || 'GET';
    
    // Заголовки
    let headers = testCase.headers || {};
    if (testCase.payload && testCase.payload.headers) {
        headers = { ...headers, ...testCase.payload.headers };
    }
    
    // Тело запроса
    let body = testCase.body;
    if (testCase.payload && testCase.payload.body) {
        body = testCase.payload.body;
    }
    
    // Query параметры
    let queryParams = testCase.queryParams || {};
    if (testCase.payload && testCase.payload.query) {
        queryParams = { ...queryParams, ...testCase.payload.query };
    }
    
    return {
        info: {
            name: `Fuzzing Test - ${testCase.type}`,
            description: `Тест от ${new Date().toISOString()}`,
            schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        item: [{
            name: `${method} ${testCase.path || '/'}`,
            request: {
                method: method,
                header: Object.entries(headers).map(([key, value]) => ({ key: key, value: value, type: "text" })),
                url: {
                    raw: url,
                    protocol: null,
                    host: null,
                    path: (testCase.path || '/').split('/').filter(p => p),
                    query: Object.entries(queryParams).map(([key, value]) => ({ key: key, value: value }))
                },
                body: body ? { mode: "raw", raw: JSON.stringify(body, null, 2) } : undefined
            }
        }]
    };
}

function createReplayModal() {
    const modalHTML = `
        <div id="replayModal" class="modal-replay">
            <div class="modal-content replay-modal" style="overflow: hidden;">
                <div class="modal-header-replay">
                    <h3 style="margin: 0;">Детали запроса</h3>
                    <button class="close-btn" onclick="closeReplayModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">&times;</button>
                </div>
                <div class="modal-body-replay" id="replayModalBody" style="padding: 20px;"></div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeReplayModal() {
    const modal = document.getElementById('replayModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.body.style.overflow = '';
        document.getElementById('fuzzModal').removeAttribute('style');
    }
}

function toggleReplaySection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        if (section.style.display === 'none') {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
        const header = section.previousElementSibling;
        const icon = header?.querySelector('.toggle-icon');
        if (icon) icon.classList.toggle('open');
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showCopyNotification('Скопировано!');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showCopyNotification('Скопировано!');
    });
}

function showCopyNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-success';
    notification.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

function copyAsCurl() {
    if (window.currentCurlCommand) copyToClipboard(window.currentCurlCommand);
}

function copyAsFetch() {
    if (window.currentTestCase) {
        const tc = window.currentTestCase;
        let url = tc.url || tc.path || '/';
        const method = tc.method?.toUpperCase() || 'GET';
        
        if (tc.payload && tc.payload.query && Object.keys(tc.payload.query).length > 0) {
            const queryString = new URLSearchParams(tc.payload.query).toString();
            url = url.includes('?') ? `${url}&${queryString}` : `${url}?${queryString}`;
        }
        
        let headers = tc.headers || {};
        if (tc.payload && tc.payload.headers) {
            headers = { ...headers, ...tc.payload.headers };
        }
        
        let body = tc.body;
        if (tc.payload && tc.payload.body) {
            body = tc.payload.body;
        }
        
        const fetchCode = `fetch('${url}', {
  method: '${method}',
  headers: ${JSON.stringify(headers, null, 2)},
  ${body ? `body: ${JSON.stringify(body, null, 2)},` : ''}
});`;
        copyToClipboard(fetchCode);
    }
}

function copyRawRequest() {
    if (window.currentRawRequest) copyToClipboard(window.currentRawRequest);
}

function exportToPostman() {
    if (window.currentPostmanJson) {
        const dataStr = JSON.stringify(window.currentPostmanJson, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `postman-collection-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showCopyNotification('Postman коллекция скачана!');
    }
}