// ==================== fuzz-client.js - ПОЛНЫЙ КЛИЕНТСКИЙ СКРИПТ ====================

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentSpec = null;
let currentReport = null;
let selectedFile = null;
let globalRowCounter = 0;
let authToken = localStorage.getItem('apiAuthToken') || null;
let showTokenModalCallback = null;
let pendingFormData = null;
let currentReplayResponse = null;

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function showToolNotification(message, type = 'success', duration = 3000) {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    const notification = document.createElement('div');
    notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${colors[type] || colors.success};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        animation: slideIn 0.3s ease;
        font-family: 'Ubuntu';
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showValidationMessage(message, type) {
    const el = document.getElementById('url-validation');
    if (!el) return;
    el.textContent = message;
    el.className = 'url-validation ' + type;
    setTimeout(() => {
        if (el.textContent === message) el.textContent = '';
    }, 5000);
}

// ==================== ЗАГРУЗКА СПЕЦИФИКАЦИИ ====================

async function fetchSpecFromUrl() {
    const specUrlInput = document.getElementById('specUrl');
    const url = specUrlInput ? specUrlInput.value.trim() : '';
    
    if (!url) {
        showValidationMessage('Введите URL спецификации', 'invalid');
        return;
    }
    
    const fetchBtn = document.getElementById('fetch-spec-btn');
    const originalText = fetchBtn?.textContent;
    if (fetchBtn) {
        fetchBtn.disabled = true;
        fetchBtn.textContent = '⏳ Загрузка...';
    }
    
    try {
        showValidationMessage('Загрузка спецификации...', 'valid');
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = await response.text();
        
        let fileName = url.split('/').pop() || 'spec.yaml';
        let fileType = fileName.endsWith('.yaml') || fileName.endsWith('.yml') ? 'application/yaml' : 'application/json';
        const blob = new Blob([content], { type: fileType });
        const file = new File([blob], fileName, { type: fileType });
        
        await handleFile(file);
        showValidationMessage('Спецификация успешно загружена', 'valid');
        switchMode('upload');
        
    } catch (error) {
        showValidationMessage(`Ошибка загрузки: ${error.message}`, 'invalid');
    } finally {
        if (fetchBtn) {
            fetchBtn.disabled = false;
            fetchBtn.textContent = originalText || 'Загрузить';
        }
    }
}

function switchMode(mode) {
    const uploadMode = document.getElementById('upload-mode');
    const urlMode = document.getElementById('url-mode');
    const uploadBtn = document.getElementById('mode-upload');
    const urlBtn = document.getElementById('mode-url');
    
    if (uploadMode) uploadMode.style.display = mode === 'upload' ? 'block' : 'none';
    if (urlMode) urlMode.style.display = mode === 'url' ? 'block' : 'none';
    if (uploadBtn) uploadBtn.classList.toggle('active', mode === 'upload');
    if (urlBtn) urlBtn.classList.toggle('active', mode === 'url');
    
    validateStartButton();
}

async function handleFile(file) {
    if (!file) return;
    selectedFile = file;
    
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = (file.size / 1024).toFixed(2) + ' KB';
    if (fileInfo) fileInfo.classList.add('active');
    
    await parseSpecification(file);
}

async function parseSpecification(file) {
    try {
        const text = await file.text();
        let spec;
        
        if (file.name.endsWith('.json')) {
            spec = JSON.parse(text);
        } else {
            spec = jsyaml.load(text);
        }
        
        currentSpec = spec;
        
        let format = 'Unknown';
        if (spec.swagger === '2.0') format = 'Swagger 2.0';
        else if (spec.openapi?.startsWith('3.')) format = 'OpenAPI 3.x';
        
        const specTitle = document.getElementById('specTitle');
        const specVersion = document.getElementById('specVersion');
        const specFormat = document.getElementById('specFormat');
        
        if (specTitle) specTitle.textContent = spec.info?.title || 'Unknown';
        if (specVersion) specVersion.textContent = spec.info?.version || '?';
        if (specFormat) specFormat.textContent = format;
        
        const endpointsContainer = document.getElementById('specEndpoints');
        if (endpointsContainer) {
            endpointsContainer.innerHTML = '';
            const paths = spec.paths || {};
            let count = 0;
            for (const [path, methods] of Object.entries(paths)) {
                for (const [method] of Object.entries(methods)) {
                    if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                        const div = document.createElement('div');
                        div.className = 'endpoint-item';
                        div.innerHTML = `<span class="method-badge method-${method.toUpperCase()}">${method.toUpperCase()}</span><span style="color: var(--text-secondary);">${escapeHtml(path)}</span>`;
                        endpointsContainer.appendChild(div);
                        count++;
                    }
                }
            }
            if (count === 0) endpointsContainer.innerHTML = '<div class="endpoint-item">Эндпоинты не найдены</div>';
        }
        
        const specPreview = document.getElementById('specPreview');
        if (specPreview) specPreview.classList.add('active');
        
        updateBaseUrlFromSpec(spec);
        validateStartButton();
        
    } catch (error) {
        showValidationMessage('Ошибка парсинга: ' + error.message, 'invalid');
        currentSpec = null;
        selectedFile = null;
    }
}

function updateBaseUrlFromSpec(spec) {
    const baseUrlInput = document.getElementById('baseUrl');
    if (!baseUrlInput) return;
    
    let baseUrl = '';
    if (spec.openapi && spec.servers?.length > 0) {
        baseUrl = spec.servers[0].url;
    } else if (spec.swagger && spec.host) {
        const scheme = spec.schemes?.[0] || 'https';
        baseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
    }
    
    if (baseUrl) {
        baseUrlInput.value = baseUrl.replace(/\/$/, '');
        showValidationMessage(`Базовый URL установлен: ${baseUrl}`, 'valid');
    }
    
    validateStartButton();
}

function requiresAuth(spec) {
    if (spec.security && spec.security.length > 0) return true;
    if (spec.components?.securitySchemes && Object.keys(spec.components.securitySchemes).length > 0) return true;
    return false;
}

function validateStartButton() {
    const startBtn = document.getElementById('start-btn');
    const baseUrlInput = document.getElementById('baseUrl');
    if (!startBtn) return;
    
    const baseUrl = baseUrlInput?.value.trim() || '';
    const hasSpec = currentSpec !== null;
    const hasBaseUrl = baseUrl.length > 0;
    
    startBtn.disabled = !(hasSpec && hasBaseUrl);
    startBtn.classList.toggle('active', hasSpec && hasBaseUrl);
}

function removeFile() {
    selectedFile = null;
    currentSpec = null;
    const fileInfo = document.getElementById('fileInfo');
    const specPreview = document.getElementById('specPreview');
    const fileInput = document.getElementById('fileInput');
    if (fileInfo) fileInfo.classList.remove('active');
    if (specPreview) specPreview.classList.remove('active');
    if (fileInput) fileInput.value = '';
    validateStartButton();
}

// ==================== ТОКЕН АВТОРИЗАЦИИ ====================

function showTokenModal(endpoint, callback) {
    let modal = document.getElementById('tokenModal');
    if (!modal) {
        createTokenModal();
        modal = document.getElementById('tokenModal');
    }
    
    const endpointInfo = document.getElementById('tokenEndpointInfo');
    const tokenInput = document.getElementById('authTokenInput');
    
    if (endpointInfo) endpointInfo.textContent = endpoint || 'Неизвестный эндпоинт';
    if (tokenInput) tokenInput.value = authToken || '';
    
    showTokenModalCallback = callback;
    
    const saveBtn = document.getElementById('saveTokenBtn');
    const skipBtn = document.getElementById('skipTokenBtn');
    
    const newSaveBtn = saveBtn.cloneNode(true);
    const newSkipBtn = skipBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
    
    newSaveBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (token) {
            authToken = token;
            localStorage.setItem('apiAuthToken', authToken);
            showValidationMessage('Токен сохранен', 'valid');
            closeTokenModal();
            if (showTokenModalCallback) showTokenModalCallback(token);
        } else {
            showValidationMessage('Введите токен', 'invalid');
        }
    });
    
    newSkipBtn.addEventListener('click', () => {
        closeTokenModal();
        if (showTokenModalCallback) showTokenModalCallback(null);
    });
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeTokenModal() {
    const modal = document.getElementById('tokenModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    showTokenModalCallback = null;
}

function createTokenModal() {
    const modalHTML = `
        <div id="tokenModal" class="modal">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-key"></i> Требуется авторизация</h3>
                    <button class="close-btn" onclick="closeTokenModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>API вернул ошибку 403 при доступе к эндпоинту:</p>
                    <p><strong id="tokenEndpointInfo" style="color: var(--warning);"></strong></p>
                    <p>Укажите Bearer токен:</p>
                    <div class="form-group">
                        <input type="text" id="authTokenInput" class="token-input" placeholder="eyJhbGciOiJIUzI1NiIs...">
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="skipTokenBtn" class="btn btn-secondary">Пропустить</button>
                    <button id="saveTokenBtn" class="btn btn-primary">Сохранить</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function clearAuthToken() {
    if (confirm('Очистить сохраненный токен авторизации?')) {
        localStorage.removeItem('apiAuthToken');
        authToken = null;
        showValidationMessage('Токен удален', 'valid');
    }
}

// ==================== СБРОС ПРОГРЕССА ====================

function resetAllProgress() {
    updateTaskStatus('1.1', 'pending');
    updateTaskStatus('2.1', 'pending');
    updateTaskStatus('2.2', 'pending');
    updateTaskStatus('2.3', 'pending');
    
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        const progressEl = card.querySelector('.progress');
        if (progressEl) progressEl.style.width = '0%';
    });
    
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.textContent = 'Начать фаззинг';
        startBtn.disabled = true;
        startBtn.classList.remove('active');
    }
}

// ==================== CREATE REPLAY MODAL ====================

function createReplayModal() {
    // Удаляем старую модалку если есть
    const existingModal = document.getElementById('replayModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHTML = `
        <div id="replayModal" class="modal" style="z-index: 10002; display: flex;">
            <div class="modal-content" style="max-width: 900px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3><i class="fas fa-play-circle"></i> Replay запроса</h3>
                    <button class="close-btn" id="closeReplayModalBtn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="replay-tabs">
                        <button class="replay-tab active" data-tab="request">Запрос</button>
                        <button class="replay-tab" data-tab="response">Ответ</button>
                    </div>
                    
                    <div id="replayRequestTab" class="replay-tab-content active">
                        <div class="replay-method-url">
                            <select id="replayMethod" class="replay-method-select">
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                                <option value="PATCH">PATCH</option>
                                <option value="HEAD">HEAD</option>
                                <option value="OPTIONS">OPTIONS</option>
                            </select>
                            <input type="text" id="replayUrl" class="replay-url-input" placeholder="https://api.example.com/endpoint">
                        </div>
                        
                        <div class="replay-section">
                            <div class="replay-section-header" data-section="headers">
                                <span>Заголовки</span>
                                <span class="toggle-icon">▼</span>
                            </div>
                            <div id="replayHeadersSection" class="replay-section-content open">
                                <textarea id="replayHeaders" class="replay-textarea" rows="5" placeholder='{\n  "Content-Type": "application/json"\n}'></textarea>
                            </div>
                        </div>
                        
                        <div class="replay-section">
                            <div class="replay-section-header" data-section="body">
                                <span>Тело запроса</span>
                                <span class="toggle-icon">▼</span>
                            </div>
                            <div id="replayBodySection" class="replay-section-content open">
                                <textarea id="replayBody" class="replay-textarea" rows="8" placeholder='{\n  "key": "value"\n}'></textarea>
                            </div>
                        </div>
                        
                        <div class="replay-actions">
                            <button id="sendReplayBtn" class="start-button-replay">
                                <i class="fas fa-paper-plane"></i> Отправить
                            </button>
                            <button id="copyCurlBtn" class="start-button-replay">
                                <i class="fas fa-terminal"></i> cURL
                            </button>
                            <button id="copyFetchBtn" class="start-button-replay">
                                <i class="fab fa-js"></i> Fetch
                            </button>
                            <button id="copyRawBtn" class="start-button-replay">
                                <i class="fas fa-copy"></i> Raw HTTP
                            </button>
                            <button id="exportPostmanBtn" class="start-button-replay">
                                <i class="fas fa-download"></i> Postman
                            </button>
                        </div>
                    </div>
                    
                    <div id="replayResponseTab" class="replay-tab-content">
                        <div id="replayResponseContent" class="replay-response">
                            <div class="replay-response-placeholder">
                                <i class="fas fa-play-circle"></i>
                                <p>Нажмите "Отправить" для выполнения запроса</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Привязываем обработчики ПОСЛЕ создания DOM
    attachReplayModalHandlers();
}

function attachReplayModalHandlers() {
    // Кнопка закрытия
    const closeBtn = document.getElementById('closeReplayModalBtn');
    if (closeBtn) {
        closeBtn.onclick = () => closeReplayModal();
    }
    
    // Переключение табов
    const tabs = document.querySelectorAll('#replayModal .replay-tab');
    tabs.forEach(tab => {
        tab.onclick = () => {
            const tabName = tab.getAttribute('data-tab');
            switchReplayTab(tabName);
        };
    });
    
    // Секции заголовков
    const sectionHeaders = document.querySelectorAll('#replayModal .replay-section-header');
    sectionHeaders.forEach(header => {
        header.onclick = () => {
            const section = header.getAttribute('data-section');
            toggleReplaySection(section);
        };
    });
    
    // Кнопка отправки
    const sendBtn = document.getElementById('sendReplayBtn');
    if (sendBtn) {
        sendBtn.onclick = () => sendReplayRequest();
    }
    
    // Кнопка cURL
    const curlBtn = document.getElementById('copyCurlBtn');
    if (curlBtn) {
        curlBtn.onclick = () => copyAsCurl();
    }
    
    // Кнопка Fetch
    const fetchBtn = document.getElementById('copyFetchBtn');
    if (fetchBtn) {
        fetchBtn.onclick = () => copyAsFetch();
    }
    
    // Кнопка Raw
    const rawBtn = document.getElementById('copyRawBtn');
    if (rawBtn) {
        rawBtn.onclick = () => copyRawRequest();
    }
    
    // Кнопка Postman
    const postmanBtn = document.getElementById('exportPostmanBtn');
    if (postmanBtn) {
        postmanBtn.onclick = () => exportToPostman();
    }
    
    // Закрытие по клику на оверлей
    const modal = document.getElementById('replayModal');
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) closeReplayModal();
        };
    }
}

function closeReplayModal() {
    const modal = document.getElementById('replayModal');
    if (modal) {
        modal.remove();
    }
    document.body.style.overflow = '';
    currentReplayResponse = null;
}

function switchReplayTab(tabName) {
    const requestTab = document.getElementById('replayRequestTab');
    const responseTab = document.getElementById('replayResponseTab');
    const tabs = document.querySelectorAll('#replayModal .replay-tab');
    
    if (tabName === 'request') {
        if (requestTab) requestTab.classList.add('active');
        if (responseTab) responseTab.classList.remove('active');
        tabs.forEach(t => t.classList.remove('active'));
        if (tabs[0]) tabs[0].classList.add('active');
    } else if (tabName === 'response') {
        if (requestTab) requestTab.classList.remove('active');
        if (responseTab) responseTab.classList.add('active');
        tabs.forEach(t => t.classList.remove('active'));
        if (tabs[1]) tabs[1].classList.add('active');
    }
}

function toggleReplaySection(sectionName) {
    let contentId = '';
    
    if (sectionName === 'headers') {
        contentId = 'replayHeadersSection';
    } else if (sectionName === 'body') {
        contentId = 'replayBodySection';
    } else if (sectionName === 'response-headers') {
        contentId = 'replayResponseHeadersSection';
    } else if (sectionName === 'response-body') {
        contentId = 'replayResponseBodySection';
    }
    
    const content = document.getElementById(contentId);
    if (content) {
        content.classList.toggle('open');
    }
}

// ==================== REPLAY TEST ====================

async function replayTest(testData) {
    console.log('🎮 replayTest вызван с данными:', testData);
    
    // Удаляем старую модалку если есть
    const existingModal = document.getElementById('replayModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Создаем новую модалку
    createReplayModal();
    
    // Небольшая задержка чтобы DOM успел создаться
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // ========== ФОРМИРУЕМ ПРАВИЛЬНЫЙ URL ==========
    let fullUrl = '';
    const baseUrlInput = document.getElementById('baseUrl');
    let baseUrl = baseUrlInput ? baseUrlInput.value.trim() : '';
    baseUrl = baseUrl.replace(/\/$/, '');
    
    if (testData.url) {
        fullUrl = testData.url;
    } else if (testData.endpoint) {
        let endpoint = testData.endpoint.replace(/^\//, '');
        fullUrl = `${baseUrl}/${endpoint}`;
    }
    
    // ========== ОПРЕДЕЛЯЕМ HTTP МЕТОД ==========
    let method = testData.method || 'GET';
    method = method.toUpperCase();
    
    // ========== ФОРМИРУЕМ ЗАГОЛОВКИ ==========
    let headers = { 'Content-Type': 'application/json' };
    if (testData.headers) {
        headers = { ...headers, ...testData.headers };
    }
    
    if (authToken && !headers['Authorization'] && !headers['authorization']) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // ========== ФОРМИРУЕМ ТЕЛО ЗАПРОСА ==========
    let body = testData.body || testData.payload || null;
    if (body && typeof body === 'object') {
        body = JSON.stringify(body, null, 2);
    }
    
    // ========== ЗАПОЛНЯЕМ ПОЛЯ В МОДАЛЬНОМ ОКНЕ ==========
    const methodSelect = document.getElementById('replayMethod');
    const urlInput = document.getElementById('replayUrl');
    const headersTextarea = document.getElementById('replayHeaders');
    const bodyTextarea = document.getElementById('replayBody');
    
    if (methodSelect) methodSelect.value = method;
    if (urlInput) urlInput.value = fullUrl;
    
    if (headersTextarea && headers) {
        try {
            headersTextarea.value = JSON.stringify(headers, null, 2);
        } catch (e) {
            headersTextarea.value = JSON.stringify({ 'Content-Type': 'application/json' }, null, 2);
        }
    }
    
    if (bodyTextarea && body) {
        bodyTextarea.value = body;
    }
    
    // Показываем модальное окно
    const modal = document.getElementById('replayModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    // Переключаемся на вкладку запроса
    switchReplayTab('request');
}

// ==================== SEND REPLAY REQUEST ====================

async function sendReplayRequest() {
    console.log('📤 sendReplayRequest вызван');
    
    const methodSelect = document.getElementById('replayMethod');
    const urlInput = document.getElementById('replayUrl');
    const headersTextarea = document.getElementById('replayHeaders');
    const bodyTextarea = document.getElementById('replayBody');
    
    const method = methodSelect?.value || 'GET';
    const url = urlInput?.value;
    const headersText = headersTextarea?.value;
    const bodyText = bodyTextarea?.value;
    
    console.log('📡 Запрос:', { method, url });
    
    if (!url) {
        showToolNotification('Введите URL запроса', 'error');
        return;
    }
    
    let headers = {};
    if (headersText && headersText.trim()) {
        try {
            headers = JSON.parse(headersText);
        } catch (e) {
            showToolNotification('Ошибка парсинга заголовков: ' + e.message, 'error');
            return;
        }
    }
    
    if (bodyText && bodyText.trim() && !headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
    }
    
    if (authToken && !headers['Authorization'] && !headers['authorization']) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    let body = null;
    if (bodyText && bodyText.trim()) {
        try {
            body = JSON.parse(bodyText);
        } catch (e) {
            body = bodyText;
        }
    }
    
    const responseContent = document.getElementById('replayResponseContent');
    if (responseContent) {
        responseContent.innerHTML = `<div class="replay-loading"><i class="fas fa-spinner fa-spin"></i><p>Отправка запроса...</p></div>`;
    }
    
    try {
        const startTime = Date.now();
        
        const fetchOptions = { method, headers };
        const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
        
        if (body && methodsWithBody.includes(method)) {
            fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body;
        }
        
        const response = await fetch(url, fetchOptions);
        const duration = Date.now() - startTime;
        const responseText = await response.text();
        
        let formattedResponse = responseText;
        try {
            const json = JSON.parse(responseText);
            formattedResponse = JSON.stringify(json, null, 2);
        } catch (e) {}
        
        currentReplayResponse = {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: formattedResponse,
            duration: duration
        };
        
        displayReplayResponse(currentReplayResponse);
        switchReplayTab('response');
        
        const statusColor = response.status >= 200 && response.status < 300 ? 'success' : 'error';
        showToolNotification(`${method} ${response.status} ${response.statusText} (${duration}ms)`, statusColor);
        
    } catch (error) {
        console.error('Fetch error:', error);
        if (responseContent) {
            responseContent.innerHTML = `
                <div class="replay-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Ошибка: ${error.message}</p>
                </div>
            `;
        }
        showToolNotification(`Ошибка: ${error.message}`, 'error');
    }
}

function displayReplayResponse(response) {
    const responseContent = document.getElementById('replayResponseContent');
    if (!responseContent) return;
    
    const statusColor = response.status >= 200 && response.status < 300 ? '#10b981' : 
                       (response.status >= 400 && response.status < 500 ? '#f59e0b' : '#ef4444');
    
    responseContent.innerHTML = `
        <div class="replay-response-status" style="border-left-color: ${statusColor}">
            <div class="replay-status-line">
                <span class="replay-status-code" style="color: ${statusColor}">${response.status} ${response.statusText}</span>
                <span class="replay-duration">⏱ ${response.duration}ms</span>
            </div>
        </div>
        
        <div class="replay-section">
            <div class="replay-section-header" data-section="response-headers">
                <span>Заголовки ответа</span>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="replayResponseHeadersSection" class="replay-section-content">
                <pre class="replay-headers">${escapeHtml(JSON.stringify(response.headers, null, 2))}</pre>
            </div>
        </div>
        
        <div class="replay-section">
            <div class="replay-section-header" data-section="response-body">
                <span>Тело ответа</span>
                <span class="toggle-icon">▼</span>
            </div>
            <div id="replayResponseBodySection" class="replay-section-content">
                <pre class="replay-json">${escapeHtml(response.body)}</pre>
            </div>
        </div>
    `;
    
    // Привязываем обработчики для секций ответа
    const sectionHeaders = document.querySelectorAll('#replayResponseContent .replay-section-header');
    sectionHeaders.forEach(header => {
        header.onclick = () => {
            const section = header.getAttribute('data-section');
            toggleReplaySection(section);
        };
    });
}

// ==================== ЭКСПОРТ ЗАПРОСОВ ====================

function getCurrentReplayData() {
    const methodSelect = document.getElementById('replayMethod');
    const urlInput = document.getElementById('replayUrl');
    const headersTextarea = document.getElementById('replayHeaders');
    const bodyTextarea = document.getElementById('replayBody');
    
    const method = methodSelect?.value || 'GET';
    const url = urlInput?.value;
    const headersText = headersTextarea?.value;
    const bodyText = bodyTextarea?.value;
    
    let headers = {};
    if (headersText) {
        try { headers = JSON.parse(headersText); } catch(e) {}
    }
    
    let body = null;
    if (bodyText && bodyText.trim()) {
        try { body = JSON.parse(bodyText); } catch(e) { body = bodyText; }
    }
    
    return { method, url, headers, body };
}

function copyAsCurl() {
    const { method, url, headers, body } = getCurrentReplayData();
    if (!url) { showToolNotification('Нет URL', 'error'); return; }
    
    let curlCmd = `curl -X ${method} '${url}'`;
    for (const [key, value] of Object.entries(headers)) {
        curlCmd += ` \\\n  -H '${key}: ${value}'`;
    }
    if (body) {
        const bodyStr = typeof body === 'object' ? JSON.stringify(body) : body;
        curlCmd += ` \\\n  -d '${bodyStr.replace(/'/g, "\\'")}'`;
    }
    navigator.clipboard.writeText(curlCmd);
    showToolNotification('cURL скопирован', 'success');
}

function copyAsFetch() {
    const { method, url, headers, body } = getCurrentReplayData();
    if (!url) { showToolNotification('Нет URL', 'error'); return; }
    
    let fetchCode = `fetch('${url}', {\n  method: '${method}',`;
    if (Object.keys(headers).length > 0) {
        fetchCode += `\n  headers: ${JSON.stringify(headers, null, 2)},`;
    }
    if (body) {
        const bodyStr = typeof body === 'object' ? JSON.stringify(body, null, 2) : body;
        fetchCode += `\n  body: ${JSON.stringify(bodyStr)},`;
    }
    fetchCode += `\n});`;
    navigator.clipboard.writeText(fetchCode);
    showToolNotification('Fetch API скопирован', 'success');
}

function exportToPostman() {
    const { method, url, headers, body } = getCurrentReplayData();
    if (!url) { showToolNotification('Нет URL', 'error'); return; }
    
    const postmanRequest = {
        name: `Replay ${method} ${url}`,
        request: {
            method: method,
            header: Object.entries(headers).map(([key, value]) => ({ key, value })),
            url: { raw: url, href: url },
            body: body ? { mode: 'raw', raw: typeof body === 'object' ? JSON.stringify(body, null, 2) : body } : undefined
        }
    };
    navigator.clipboard.writeText(JSON.stringify(postmanRequest, null, 2));
    showToolNotification('Postman скопирован', 'success');
}

function copyRawRequest() {
    const { method, url, headers, body } = getCurrentReplayData();
    if (!url) { showToolNotification('Нет URL', 'error'); return; }
    
    let rawRequest = `${method} ${url} HTTP/1.1\r\n`;
    try { rawRequest += `Host: ${new URL(url).host}\r\n`; } catch(e) {}
    for (const [key, value] of Object.entries(headers)) {
        rawRequest += `${key}: ${value}\r\n`;
    }
    if (body) {
        rawRequest += `\r\n`;
        rawRequest += typeof body === 'object' ? JSON.stringify(body) : body;
    }
    navigator.clipboard.writeText(rawRequest);
    showToolNotification('Raw HTTP скопирован', 'success');
}

// ==================== ОСТАЛЬНЫЕ ФУНКЦИИ ====================

function updateTaskStatus(taskId, status) {
    const statusMap = { 'pending': 'В ожидании', 'in-progress': 'В работе', 'completed': 'Завершено', 'error': 'Ошибка' };
    const cards = document.querySelectorAll('.card');
    const taskMap = { '1.1': cards[0], '2.1': cards[1], '2.2': cards[2], '2.3': cards[3] };
    const card = taskMap[taskId];
    if (card) {
        const statusEl = card.querySelector('.task-status');
        if (statusEl) {
            statusEl.textContent = statusMap[status] || status;
            statusEl.className = `task-status ${status}`;
        }
    }
}

function animateProgress(taskId, targetPercent, duration, callback) {
    const cards = document.querySelectorAll('.card');
    const taskMap = { '1.1': cards[0], '2.1': cards[1], '2.2': cards[2], '2.3': cards[3] };
    const card = taskMap[taskId];
    if (!card) { if (callback) callback(); return; }
    const progressEl = card.querySelector('.progress');
    if (!progressEl) { if (callback) callback(); return; }
    const startTime = Date.now();
    const startWidth = parseFloat(progressEl.style.width) || 0;
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentWidth = startWidth + (targetPercent - startWidth) * progress;
        progressEl.style.width = `${currentWidth}%`;
        if (progress < 1) requestAnimationFrame(animate);
        else if (callback) callback();
    };
    animate();
}

function showResults(report) {
    const modalBody = document.getElementById('fuzzModalBody');
    if (!modalBody) return;
    
    const stats = report.summary || {};
    const vulnerabilities = report.vulnerabilities || [];
    
    modalBody.innerHTML = `
        <div class="fuzz-stats-grid">
            <div class="fuzz-stat-card"><div class="fuzz-stat-number info">${stats.total_tests || 0}</div><div class="fuzz-stat-label">Всего тестов</div></div>
            <div class="fuzz-stat-card"><div class="fuzz-stat-number success">${stats.success || 0}</div><div class="fuzz-stat-label">Успешных</div></div>
            <div class="fuzz-stat-card"><div class="fuzz-stat-number critical">${stats.failed || 0}</div><div class="fuzz-stat-label">Проваленных</div></div>
            <div class="fuzz-stat-card"><div class="fuzz-stat-number warning">${vulnerabilities.length}</div><div class="fuzz-stat-label">Уязвимостей</div></div>
        </div>
        ${vulnerabilities.length > 0 ? renderVulnerabilitiesTable(vulnerabilities) : '<div class="no-vulnerabilities"><i class="fas fa-check-circle"></i><h4>Уязвимостей не найдено</h4></div>'}
    `;
    
    openFuzzModal();
}

function renderVulnerabilitiesTable(vulnerabilities) {
    if (!vulnerabilities || vulnerabilities.length === 0) return '';
    
    let html = `<h4 style="margin: 24px 0 16px 0;">Найденные уязвимости</h4>
    <table class="results-table"><thead><tr><th>Метод</th><th>Тип</th><th>Severity</th><th>Эндпоинт</th><th>Статус</th><th>Действие</th></tr></thead><tbody>`;
    
    for (const vuln of vulnerabilities) {
        const replayData = {
            method: vuln.method || 'GET',
            endpoint: vuln.endpoint || '/',
            headers: { 'Content-Type': 'application/json' },
            body: vuln.payload || null,
            type: vuln.type || 'Unknown',
            severity: vuln.severity || 'medium'
        };
        
        const replayDataStr = JSON.stringify(replayData).replace(/'/g, "\\'");
        
        html += `<tr>
            <td><span class="method-badge method-${(vuln.method || 'GET').toUpperCase()}">${(vuln.method || 'GET').toUpperCase()}</span></td>
            <td>${escapeHtml(vuln.type || 'Unknown')}</td>
            <td><span class="severity-badge severity-${vuln.severity || 'medium'}">${(vuln.severity || 'MEDIUM').toUpperCase()}</span></td>
            <td style="font-family: monospace; font-size: 12px;">${escapeHtml(vuln.endpoint || '/')}</td>
            <td><span class="status-badge warning">${vuln.response_status || 'N/A'}</span></td>
            <td style="text-align: center;"><button class="details-btn" onclick='window.replayTest(${replayDataStr})' title="Воспроизвести запрос" style="background: none; border: none; cursor: pointer; color: var(--primary);"><i class="fas fa-play-circle" style="font-size: 13px;"></i></button></td>
        </tr>`;
    }
    
    html += `</tbody></table>`;
    return html;
}

function openFuzzModal() {
    const modal = document.getElementById('fuzzModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeFuzzModal() {
    const modal = document.getElementById('fuzzModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    resetAllProgress();
}

// ==================== START FUZZING ====================

async function startFuzzing() {
    const startBtn = document.getElementById('start-btn');
    const baseUrlInput = document.getElementById('baseUrl');
    const mode = document.querySelector('.mode-btn.active')?.id === 'mode-upload' ? 'upload' : 'url';
    
    if (!startBtn || startBtn.disabled) return;
    if (!currentSpec) {
        showValidationMessage('Сначала загрузите спецификацию', 'invalid');
        return;
    }
    
    const baseUrl = baseUrlInput?.value.trim();
    if (!baseUrl) {
        showValidationMessage('Укажите базовый URL', 'invalid');
        return;
    }
    
    startBtn.disabled = true;
    startBtn.textContent = 'Фаззинг запущен...';
    
    updateTaskStatus('1.1', 'in-progress');
    animateProgress('1.1', 100, 800, () => {
        updateTaskStatus('1.1', 'completed');
        updateTaskStatus('2.1', 'in-progress');
        animateProgress('2.1', 100, 1200, async () => {
            updateTaskStatus('2.1', 'completed');
            updateTaskStatus('2.2', 'in-progress');
            animateProgress('2.2', 100, 2500, async () => {
                updateTaskStatus('2.2', 'completed');
                updateTaskStatus('2.3', 'in-progress');
                
                try {
                    const formData = new FormData();
                    
                    if (mode === 'upload') {
                        if (selectedFile) {
                            formData.append('spec', selectedFile);
                        } else {
                            throw new Error('Файл спецификации не выбран');
                        }
                    } else if (mode === 'url') {
                        const specUrlInput = document.getElementById('specUrl');
                        const specUrl = specUrlInput ? specUrlInput.value.trim() : '';
                        
                        if (specUrl) {
                            formData.append('specUrl', specUrl);
                        } else if (currentSpec) {
                            const specJson = JSON.stringify(currentSpec);
                            const blob = new Blob([specJson], { type: 'application/json' });
                            const file = new File([blob], 'spec.json', { type: 'application/json' });
                            formData.append('spec', file);
                        } else {
                            throw new Error('URL спецификации не указан и нет загруженной спецификации');
                        }
                    } else {
                        throw new Error('Не выбран режим загрузки спецификации');
                    }
                    
                    formData.append('baseUrl', baseUrl);
                    if (authToken) formData.append('authToken', authToken);
                    pendingFormData = formData;
                    
                    const response = await fetch('/api/fuzz', { method: 'POST', body: formData });
                    
                    if (response.status === 429) {
                        const errorData = await response.json().catch(() => ({}));
                        await fuzzErrorHandler.handleRateLimit(errorData, { button: startBtn });
                        startBtn.disabled = false;
                        startBtn.textContent = 'Начать фаззинг';
                        updateTaskStatus('2.3', 'pending');
                        return;
                    }
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        if (response.status === 403) {
                            const failedEndpoints = errorData.failedEndpoints || [];
                            const firstFailedEndpoint = failedEndpoints[0] || 'неизвестный эндпоинт';
                            showTokenModal(firstFailedEndpoint, async (token) => {
                                if (token) await retryFuzzingWithToken(pendingFormData, token);
                                else {
                                    showValidationMessage('Фаззинг продолжен без авторизации.', 'warning');
                                    animateProgress('2.3', 100, 800, () => {
                                        updateTaskStatus('2.3', 'completed');
                                        startBtn.textContent = 'Фаззинг завершен с ошибками';
                                        showResults(errorData);
                                    });
                                }
                            });
                            return;
                        }
                        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const report = await response.json();
                    currentReport = report;
                    
                    animateProgress('2.3', 100, 800, () => {
                        updateTaskStatus('2.3', 'completed');
                        startBtn.textContent = 'Фаззинг завершен';
                        showResults(report);
                    });
                    
                } catch (error) {
                    console.error('Fuzzing error:', error);
                    updateTaskStatus('2.3', 'error');
                    startBtn.textContent = 'Ошибка';
                    showValidationMessage(`Ошибка: ${error.message}`, 'invalid');
                }
            });
        });
    });
}

async function retryFuzzingWithToken(formData, token) {
    const startBtn = document.getElementById('start-btn');
    try {
        formData.set('authToken', token);
        const response = await fetch('/api/fuzz', { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const report = await response.json();
        currentReport = report;
        animateProgress('2.3', 100, 800, () => {
            updateTaskStatus('2.3', 'completed');
            startBtn.textContent = 'Фаззинг завершен';
            showResults(report);
        });
        showValidationMessage('Фаззинг успешно завершен с токеном', 'valid');
    } catch (error) {
        updateTaskStatus('2.3', 'error');
        startBtn.textContent = 'Ошибка';
        alert(`Ошибка: ${error.message}`);
    }
}

function downloadReport() {
    if (!currentReport) {
        showToolNotification('Нет отчета для скачивания', 'error');
        return;
    }
    
    const enhancedReport = { 
        ...currentReport, 
        generated_at: new Date().toISOString(), 
        failed_tests_summary: { 
            count: currentReport.failedTests?.length || 0, 
            details: currentReport.failedTests || [] 
        } 
    };
    
    const dataStr = JSON.stringify(enhancedReport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fuzz-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToolNotification('Отчет скачан', 'success');
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', function() {
    // Файловый режим
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (uploadArea) {
        uploadArea.addEventListener('click', () => fileInput?.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && (file.name.endsWith('.json') || file.name.endsWith('.yaml') || file.name.endsWith('.yml'))) {
                handleFile(file);
            } else {
                showValidationMessage('Поддерживаются только JSON/YAML файлы', 'invalid');
            }
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
        });
    }
    
    // URL режим
    const fetchSpecBtn = document.getElementById('fetch-spec-btn');
    if (fetchSpecBtn) {
        fetchSpecBtn.addEventListener('click', fetchSpecFromUrl);
    }
    
    const specUrlInput = document.getElementById('specUrl');
    if (specUrlInput) {
        specUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') fetchSpecFromUrl();
        });
    }
    
    // Кнопки переключения режимов
    const modeUpload = document.getElementById('mode-upload');
    const modeUrl = document.getElementById('mode-url');
    if (modeUpload) modeUpload.addEventListener('click', () => switchMode('upload'));
    if (modeUrl) modeUrl.addEventListener('click', () => switchMode('url'));
    
    // Кнопка старта
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', startFuzzing);
    
    // Кнопка удаления файла
    const removeFileBtn = document.getElementById('remove-file-btn');
    if (removeFileBtn) removeFileBtn.addEventListener('click', removeFile);
    
    // Закрытие модалок по клику вне
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeFuzzModal();
            closeTokenModal();
            closeReplayModal();
        }
    });
    
    // ESC для закрытия
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeFuzzModal();
            closeTokenModal();
            closeReplayModal();
        }
    });
    
    validateStartButton();
});

// Регистрируем глобальные функции
window.replayTest = replayTest;
window.closeReplayModal = closeReplayModal;
window.switchReplayTab = switchReplayTab;
window.toggleReplaySection = toggleReplaySection;
window.sendReplayRequest = sendReplayRequest;
window.copyAsCurl = copyAsCurl;
window.copyAsFetch = copyAsFetch;
window.copyRawRequest = copyRawRequest;
window.exportToPostman = exportToPostman;
window.closeTokenModal = closeTokenModal;
window.clearAuthToken = clearAuthToken;
window.downloadReport = downloadReport;
window.removeFile = removeFile;
window.switchMode = switchMode;
window.fetchSpecFromUrl = fetchSpecFromUrl;
window.startFuzzing = startFuzzing;
window.closeFuzzModal = closeFuzzModal;
window.replayTest = replayTest;