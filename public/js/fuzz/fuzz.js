let currentSpec = null;
let currentReport = null;
let selectedFile = null;
let globalRowCounter = 0;

// Глобальная переменная для хранения токена
let authToken = localStorage.getItem('apiAuthToken') || null;
let showTokenModalCallback = null;
let pendingFormData = null;





// ==================== ОСТАЛЬНЫЕ ФУНКЦИИ (без изменений) ====================

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
    
    selectedFile = null;
    currentSpec = null;
    currentReport = null;
    
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) fileInfo.classList.remove('active');
    
    const specPreview = document.getElementById('specPreview');
    if (specPreview) specPreview.classList.remove('active');
    
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
    
    const specUrlInput = document.getElementById('specUrl');
    if (specUrlInput) specUrlInput.value = '';
    
    const baseUrlInput = document.getElementById('baseUrl');
    if (baseUrlInput) baseUrlInput.value = 'Пример: https://api.example.com/v1/api';
    
    const urlValidation = document.getElementById('url-validation');
    if (urlValidation) urlValidation.textContent = '';
    
    const endpointsContainer = document.getElementById('specEndpoints');
    if (endpointsContainer) endpointsContainer.innerHTML = '';
    
    const specTitle = document.getElementById('specTitle');
    const specVersion = document.getElementById('specVersion');
    const specFormat = document.getElementById('specFormat');
    
    if (specTitle) specTitle.textContent = 'Название';
    if (specVersion) specVersion.textContent = 'Версия';
    if (specFormat) specFormat.textContent = 'Формат';
    
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) uploadArea.classList.remove('dragover');
}

function requiresAuth(spec) {
    if (spec.security && spec.security.length > 0) return true;
    if (spec.components?.securitySchemes && Object.keys(spec.components.securitySchemes).length > 0) return true;
    if (spec.securityDefinitions && Object.keys(spec.securityDefinitions).length > 0) return true;
    return false;
}

function extractBaseUrlFromSpec(spec) {
    let baseUrl = '';
    if (spec.openapi && spec.servers && spec.servers.length > 0) {
        baseUrl = spec.servers[0].url;
    } else if (spec.swagger) {
        if (spec.schemes && spec.host && spec.basePath) {
            const scheme = spec.schemes[0] || 'https';
            baseUrl = `${scheme}://${spec.host}${spec.basePath}`;
        } else if (spec.host) {
            baseUrl = `https://${spec.host}`;
        }
    }
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    return baseUrl;
}

function updateBaseUrlFromSpec(spec) {
    const baseUrlInput = document.getElementById('baseUrl');
    if (!baseUrlInput) return;
    const extractedUrl = extractBaseUrlFromSpec(spec);
    if (extractedUrl) {
        baseUrlInput.value = extractedUrl;
        showValidationMessage(`Базовый URL установлен: ${extractedUrl}`, 'valid');
    } else {
        showValidationMessage('Не удалось извлечь базовый URL из спецификации, укажите вручную', 'warning');
    }
    if (requiresAuth(spec)) {
        showValidationMessage('API требует авторизацию (Bearer token).', 'warning');
    }
    validateStartButton();
}

function switchMode(mode) {
    const uploadMode = document.getElementById('upload-mode');
    const urlMode = document.getElementById('url-mode');
    const uploadBtn = document.getElementById('mode-upload');
    const urlBtn = document.getElementById('mode-url');
    if (uploadMode) uploadMode.style.display = mode === 'upload' ? 'block' : 'none';
    if (urlMode) urlMode.style.display = mode === 'url' ? 'block' : 'none';
    if (uploadBtn) {
        if (mode === 'upload') uploadBtn.classList.add('active');
        else uploadBtn.classList.remove('active');
    }
    if (urlBtn) {
        if (mode === 'url') urlBtn.classList.add('active');
        else urlBtn.classList.remove('active');
    }
    validateStartButton();
}

document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    
    if (!uploadArea) return;
    if (!fileInput) return;
    
    document.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); });
    document.addEventListener('drop', function(e) { e.preventDefault(); e.stopPropagation(); });

    function openFileDialog() { fileInput.click(); }
    
    uploadArea.addEventListener('click', function(e) {
        if (e.target === browseBtn) e.stopPropagation();
        openFileDialog();
    });
    
    if (browseBtn) {
        browseBtn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); openFileDialog(); });
    }

    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            const fileName = file.name.toLowerCase();
            if (fileName.endsWith('.json') || fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
                handleFile(file);
            } else {
                showValidationMessage('Поддерживаются только JSON, YAML, YML файлы', 'invalid');
            }
        }
    });
    
    fileInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            handleFile(file);
        }
    });
    
    const fetchSpecBtn = document.getElementById('fetch-spec-btn');
    if (fetchSpecBtn) {
        fetchSpecBtn.addEventListener('click', async () => {
            const specUrlInput = document.getElementById('specUrl');
            const url = specUrlInput ? specUrlInput.value.trim() : '';
            if (!url) {
                showValidationMessage('Введите URL спецификации', 'invalid');
                return;
            }
            try {
                showValidationMessage('Загрузка...', 'valid');
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const content = await response.text();
                const blob = new Blob([content], { type: 'application/json' });
                const file = new File([blob], url.split('/').pop() || 'spec.yaml', { type: 'application/json' });
                handleFile(file);
                showValidationMessage('Спецификация загружена', 'valid');
            } catch (error) {
                showValidationMessage('Ошибка загрузки: ' + error.message, 'invalid');
            }
        });
    }
    
    const baseUrlInput = document.getElementById('baseUrl');
    if (baseUrlInput) baseUrlInput.addEventListener('input', validateStartButton);
    
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', startFuzzing);
    
    validateStartButton();
    
    document.addEventListener('click', function(e) {
        const modal = document.getElementById('fuzzModal');
        if (modal && modal.classList.contains('active') && e.target === modal) closeFuzzModal();
        const tokenModal = document.getElementById('tokenModal');
        if (tokenModal && tokenModal.classList.contains('active') && e.target === tokenModal) closeTokenModal();
        const replayModal = document.getElementById('replayModal');
        if (replayModal && replayModal.classList.contains('active') && e.target === replayModal) closeReplayModal();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeFuzzModal();
            closeTokenModal();
            closeReplayModal();
        }
    });
    
    addTokenClearButton();
});

function addTokenClearButton() {
    const container = document.querySelector('.fuzz-controls');
    if (container && !document.getElementById('clearTokenBtn')) {
        const clearBtn = document.createElement('button');
        clearBtn.id = 'clearTokenBtn';
        clearBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Очистить токен';
        clearBtn.className = 'btn btn-secondary';
        clearBtn.style.marginLeft = '10px';
        clearBtn.onclick = clearAuthToken;
        container.appendChild(clearBtn);
    }
}

function clearAuthToken() {
    if (confirm('Очистить сохраненный токен авторизации?')) {
        localStorage.removeItem('apiAuthToken');
        authToken = null;
        showValidationMessage('Токен удален', 'valid');
    }
}

function showTokenModal(endpoint, callback) {
    let modal = document.getElementById('tokenModal');
    if (!modal) {
        createTokenModal();
        modal = document.getElementById('tokenModal');
    }
    
    const endpointInfo = document.getElementById('tokenEndpointInfo');
    const tokenInput = document.getElementById('authTokenInput');
    const saveTokenBtn = document.getElementById('saveTokenBtn');
    const skipBtn = document.getElementById('skipTokenBtn');
    
    if (endpointInfo) endpointInfo.textContent = endpoint || 'Неизвестный эндпоинт';
    if (tokenInput) tokenInput.value = authToken || '';
    
    showTokenModalCallback = callback;
    
    const newSaveBtn = saveTokenBtn.cloneNode(true);
    const newSkipBtn = skipBtn.cloneNode(true);
    saveTokenBtn.parentNode.replaceChild(newSaveBtn, saveTokenBtn);
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

function handleFile(file) {
    selectedFile = file;
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = (file.size / 1024).toFixed(2) + ' KB';
    if (fileInfo) fileInfo.classList.add('active');
    parseSpecification(file);
}

function removeFile() {
    selectedFile = null;
    const fileInfo = document.getElementById('fileInfo');
    const specPreview = document.getElementById('specPreview');
    const fileInput = document.getElementById('fileInput');
    if (fileInfo) fileInfo.classList.remove('active');
    if (specPreview) specPreview.classList.remove('active');
    currentSpec = null;
    if (fileInput) fileInput.value = '';
    validateStartButton();
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
        else if (spec.openapi === '3.0.0') format = 'OpenAPI 3.0.0';
        else if (spec.openapi === '3.0.1') format = 'OpenAPI 3.0.1';
        else if (spec.openapi === '3.0.2') format = 'OpenAPI 3.0.2';
        else if (spec.openapi === '3.0.3') format = 'OpenAPI 3.0.3';
        else if (spec.openapi === '3.1.0') format = 'OpenAPI 3.1.0';
        
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
                for (const [method, _] of Object.entries(methods)) {
                    if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method)) {
                        const div = document.createElement('div');
                        div.className = 'endpoint-item';
                        div.innerHTML = `<span class="method-badge method-${method.toUpperCase()}">${method.toUpperCase()}</span><span style="color: var(--text-secondary);">${path}</span>`;
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
        
        if (requiresAuth(spec)) {
            const urlValidation = document.getElementById('url-validation');
            if (urlValidation) {
                urlValidation.innerHTML = `<div style="background: rgba(245, 158, 11, 0.1); padding: 12px; border-radius: 8px;"><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> <strong>API требует авторизацию.</strong> Для полноценного тестирования потребуется токен.</div>`;
                urlValidation.className = 'url-validation warning';
            }
        }
        validateStartButton();
    } catch (error) {
        showValidationMessage('Ошибка парсинга: ' + error.message, 'invalid');
    }
}

function validateStartButton() {
    const startBtn = document.getElementById('start-btn');
    const baseUrlInput = document.getElementById('baseUrl');
    if (!startBtn) return;
    const baseUrl = baseUrlInput ? baseUrlInput.value.trim() : '';
    const hasSpec = currentSpec !== null;
    const hasBaseUrl = baseUrl.length > 0;
    startBtn.disabled = !(hasSpec && hasBaseUrl);
    if (hasSpec && hasBaseUrl) startBtn.classList.add('active');
    else startBtn.classList.remove('active');
}

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

function exportFailedTests(failedTests) {
    const dataStr = JSON.stringify({ timestamp: new Date().toISOString(), total_failed: failedTests.length, failed_tests: failedTests }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed-tests-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function startFuzzing() {
    const startBtn = document.getElementById('start-btn');
    const baseUrlInput = document.getElementById('baseUrl');
    if (!startBtn || startBtn.disabled) return;
    if (!baseUrlInput) return;
    const baseUrl = baseUrlInput.value.trim();
    startBtn.disabled = true;
    startBtn.textContent = 'Фаззинг запущен...';
    
    try {
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
                        if (selectedFile) formData.append('spec', selectedFile);
                        else {
                            const specUrlInput = document.getElementById('specUrl');
                            if (specUrlInput) formData.append('specUrl', specUrlInput.value);
                        }
                        formData.append('baseUrl', baseUrl);
                        if (authToken) formData.append('authToken', authToken);
                        pendingFormData = formData;
                        
                        const response = await fetch('/api/fuzz', { method: 'POST', body: formData });
                        
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
                            throw new Error(errorData.message || `HTTP ${response.status}`);
                        }
                        
                        const report = await response.json();
                        currentReport = report;
                        const has403Errors = report.failedTests?.some(test => test.status === 403);
                        if (has403Errors) showValidationMessage('Некоторые эндпоинты требуют авторизации.', 'warning');
                        
                        animateProgress('2.3', 100, 800, () => {
                            updateTaskStatus('2.3', 'completed');
                            startBtn.textContent = 'Фаззинг завершен';
                            showResults(report);
                        });
                    } catch (error) {
                        updateTaskStatus('2.3', 'error');
                        startBtn.textContent = 'Ошибка';
                        alert(`Ошибка: ${error.message}`);
                    }
                });
            });
        });
    } catch (error) {
        console.error('Start error:', error);
        startBtn.textContent = 'Начать фаззинг';
        startBtn.disabled = false;
    }
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

function groupFailedTestsByEndpoint(failedTests) {
    const grouped = {};
    for (const test of failedTests) {
        const endpoint = test.endpoint || test.path || '/';
        if (!grouped[endpoint]) grouped[endpoint] = { endpoint: endpoint, method: test.method, total: 0, tests: [] };
        grouped[endpoint].total++;
        grouped[endpoint].tests.push(test);
    }
    return Object.values(grouped);
}

function groupVulnerabilitiesByEndpoint(vulnerabilities) {
    const grouped = {};
    for (const vuln of vulnerabilities) {
        const endpoint = vuln.endpoint || '/';
        if (!grouped[endpoint]) grouped[endpoint] = { endpoint: endpoint, total: 0, vulnerabilities: [] };
        grouped[endpoint].total++;
        grouped[endpoint].vulnerabilities.push(vuln);
    }
    return Object.values(grouped);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function generateUniqueId() {
    return `${Date.now()}_${++globalRowCounter}_${Math.random().toString(36).substr(2, 9)}`;
}

function showResults(report) {
    const modalBody = document.getElementById('fuzzModalBody');
    if (!modalBody) return;
    const stats = report.summary || {};
    const vulnerabilities = report.vulnerabilities || [];
    const failedTests = report.failedTests || [];
    const groupedFailed = groupFailedTestsByEndpoint(failedTests);
    const groupedVulns = groupVulnerabilitiesByEndpoint(vulnerabilities);
    
    modalBody.innerHTML = `
        <div class="fuzz-stats-grid">
            <div class="fuzz-stat-card"><div class="fuzz-stat-number info">${stats.total || 0}</div><div class="fuzz-stat-label">Всего тестов</div></div>
            <div class="fuzz-stat-card"><div class="fuzz-stat-number success">${stats.success || 0}</div><div class="fuzz-stat-label">Успешных</div></div>
            <div class="fuzz-stat-card"><div class="fuzz-stat-number critical">${stats.failed || 0}</div><div class="fuzz-stat-label">Проваленных</div></div>
            <div class="fuzz-stat-card"><div class="fuzz-stat-number warning">${vulnerabilities.length}</div><div class="fuzz-stat-label">Уязвимостей</div></div>
        </div>
        <div class="fuzz-stats-grid">
            <div class="fuzz-stat-card"><div class="fuzz-stat-number info">${stats.duration?.toFixed(2) || '0'}</div><div class="fuzz-stat-label">Время (сек)</div></div>
            <div class="fuzz-stat-card"><div class="fuzz-stat-number info">${report.spec?.endpoints || 0}</div><div class="fuzz-stat-label">Эндпоинтов</div></div>
        </div>
        ${groupedFailed.length > 0 || groupedVulns.length > 0 ? `<h4 style="margin: 24px 0 16px 0;">Результаты по эндпоинтам</h4>${renderEndpointGroups(groupedFailed, groupedVulns)}` : `<div class="no-vulnerabilities"><i class="fas fa-check-circle"></i><h4>Все тесты пройдены успешно</h4><p>API успешно прошел фаззинг тестирование</p></div>`}
    `;
    
    if (failedTests.length > 0) {
        const exportBtn = document.createElement('button');
        exportBtn.innerHTML = '<i class="fas fa-download"></i> Экспорт проваленных тестов (JSON)';
        exportBtn.className = 'btn btn-secondary';
        exportBtn.style.marginTop = '20px';
        exportBtn.style.marginRight = '10px';
        exportBtn.onclick = () => exportFailedTests(failedTests);
        const statsGrid = modalBody.querySelector('.fuzz-stats-grid:last-child');
        if (statsGrid) statsGrid.insertAdjacentElement('afterend', exportBtn);
    }
    openFuzzModal();
}

function renderEndpointGroups(groupedFailed, groupedVulns) {
    const allEndpoints = new Set();
    groupedFailed.forEach(g => allEndpoints.add(g.endpoint));
    groupedVulns.forEach(g => allEndpoints.add(g.endpoint));
    let html = '';
    for (const endpoint of allEndpoints) {
        const failedGroup = groupedFailed.find(g => g.endpoint === endpoint);
        const vulnGroup = groupedVulns.find(g => g.endpoint === endpoint);
        const failedCount = failedGroup?.total || 0;
        const vulnCount = vulnGroup?.total || 0;
        const endpointId = endpoint.replace(/[\/\?#]/g, '_');
        html += `
            <div class="endpoint-group">
                <div class="endpoint-header" onclick="toggleEndpoint('${endpoint}')">
                    <div class="endpoint-title"><strong style="font-family: monospace;">${escapeHtml(endpoint)}</strong><span class="endpoint-stats">${failedCount > 0 ? `<span class="endpoint-stat failed">❌ Провалено: ${failedCount}</span>` : ''}${vulnCount > 0 ? `<span class="endpoint-stat vuln">Уязвимостей: ${vulnCount}</span>` : ''}</span></div>
                    <span class="toggle-icon" id="toggle-${endpointId}"><i class="fa-sharp fa-solid fa-chevron-down"></i></span>
                </div>
                <div class="endpoint-content" id="content-${endpointId}">
                    ${failedGroup ? renderFailedTestsTable(failedGroup.tests) : ''}
                    ${vulnGroup ? renderVulnerabilitiesTable(vulnGroup.vulnerabilities) : ''}
                </div>
            </div>
        `;
    }
    return html;
}

function renderFailedTestsTable(tests) {
    if (!tests || tests.length === 0) return '';
    const has403 = tests.some(t => t.status === 403);
    
    // Берем первый тест для отображения в строке
    const test = tests[0];
    const is403 = test.status === 403;
    const testData = JSON.stringify(test).replace(/"/g, '&quot;');
    
    let html = `<div style="padding: 12px 20px; background: rgba(239, 68, 68, 0.05);"><strong style="color: #ef4444;">Проваленные тесты (${tests.length})</strong>${has403 ? `<div style="margin-top: 8px; font-size: 12px; color: #f59e0b;"><i class="fas fa-exclamation-triangle"></i> Некоторые тесты требуют авторизации. <button onclick="clearAuthToken(); showTokenModal('все эндпоинты', (token) => { if(token) location.reload(); })" class="btn-link">Добавить токен</button></div>` : ''}</div>
    <table class="results-table"><thead><tr><th>Метод</th><th>Тип</th><th>Статус</th><th>Причина</th><th>Время</th><th>Действие</th></tr></thead><tbody>
    <tr class="${is403 ? 'failed-test-row auth-required' : 'failed-test-row'}">
        <td><span class="method-badge method-${test.method?.toUpperCase() || 'GET'}">${test.method?.toUpperCase() || 'GET'}</span></td>
        <td>${test.type || 'unknown'}</td>
        <td><span class="status-badge ${is403 ? 'warning' : 'error'}">${test.status || 'ERROR'}${is403 ? ' 🔒' : ''}</span></td>
        <td>${is403 ? 'Требуется авторизация' : escapeHtml(test.error || test.reason || 'Неизвестная ошибка')}</td>
        <td>${test.duration || 'N/A'}ms</td>
        <td><button class="details-btn" onclick='replayTest(${JSON.stringify(test).replace(/'/g, "\\'")})'><i class="far fa-play-circle"></i></button></td>
    </tr>`;
    
    // Добавляем дополнительные строки для остальных тестов (если нужно показать все)
    if (tests.length > 1) {
        html += `<tr class="more-tests-row"><td colspan="6" style="background: var(--bg-secondary);">
            <details>
                <summary style="cursor: pointer; color: var(--text-secondary);">Показать еще ${tests.length - 1} тестов</summary>
                <table style="width: 100%; margin-top: 10px; border-collapse: collapse;">`;
        
        for (let i = 1; i < tests.length; i++) {
            const t = tests[i];
            html += `<tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 8px;"><span class="method-badge method-${t.method?.toUpperCase() || 'GET'}">${t.method?.toUpperCase() || 'GET'}</span></td>
                <td style="padding: 8px;">${t.type || 'unknown'}</td>
                <td style="padding: 8px;"><span class="status-badge ${t.status === 403 ? 'warning' : 'error'}">${t.status || 'ERROR'}</span></td>
                <td style="padding: 8px;">${escapeHtml(t.error || t.reason || 'Неизвестная ошибка')}</td>
                <td style="padding: 8px;">${t.duration || 'N/A'}ms</td>
                <td style="padding: 8px;"><button class="details-btn" onclick='replayTest(${JSON.stringify(t).replace(/'/g, "\\'")})'><i class="far fa-play-circle"></i></button></td>
            </tr>`;
        }
        html += `</table></details></td></tr>`;
    }
    
    html += `</tbody></table>`;
    return html;
}

function renderVulnerabilitiesTable(vulnerabilities) {
    if (!vulnerabilities || vulnerabilities.length === 0) return '';
    
    // Берем первую уязвимость для отображения в строке
    const vuln = vulnerabilities[0];
    const testData = JSON.stringify({
        method: vuln.method,
        url: vuln.endpoint,
        path: vuln.endpoint,
        type: vuln.type,
        headers: { 'Content-Type': 'application/json' },
        expectedStatus: [200]
    }).replace(/'/g, "\\'");
    
    let html = `<div style="display:flex; flex-direction: row; gap:50%;padding: 12px 20px; background: rgba(245, 158, 11, 0.05);">
    <div><strong style="color: #684404;">Найденные уязвимости (${vulnerabilities.length})</strong></div>
    <div>
     <button class="details-btn"  onclick='replayTest(${testData})'><i class="far fa-play-circle fa-lg" title="Воспроизвести" style="font-size: 15px;color: red;"></i></button>
     <button class="details-btn"  onclick="copyAsCurl()"><i class="fas fa-terminal" title="Копировать cURL" style="font-size: 15px; color: black;"></i></button>
     <button class="details-btn"  onclick="copyAsFetch()"><i class="fab fa-js" title="Копировать Fetch API" style="font-size: 15px;color: #b8a40b;"></i></button>
     <button class="details-btn"  onclick="exportToPostman()"><i class="fas fa-download" title="Копировать Postman" style="font-size: 15px;color: orange"></i></button>
     <button class="details-btn"  onclick="copyRawRequest()"><i class="fas fa-copy" title="Копировать Raw HTTP" style="font-size: 15px;color: gray;""></i></button>
     </div>          
    </div>
    <table class="results-table"><thead><tr><th>Метод</th><th>Тип</th><th>Статус</th><th>Severity</th><th>Сниппет</th></tr></thead><tbody>
      `;
    
        
        for (let i = 0; i < vulnerabilities.length; i++) {
            const v = vulnerabilities[i];
            const vTestData = JSON.stringify({
                method: v.method,
                url: v.endpoint,
                path: v.endpoint,
                type: v.type,
                headers: { 'Content-Type': 'application/json' },
                expectedStatus: [200]
            }).replace(/'/g, "\\'");
            
            html += `<tr>
                <td style="padding: 8px;"><span class="method-badge method-${v.method?.toUpperCase() || 'GET'}">${v.method?.toUpperCase() || 'GET'}</span></td>
                <td style="padding: 8px;">${escapeHtml(v.type || 'Unknown')}</td>
                <td style="padding: 8px;"><span class="status-badge warning">${v.response_status || 'N/A'}</span></td>
                <td style="padding: 8px;"><span class="severity-badge severity-${v.severity || 'medium'}">${(v.severity || 'MEDIUM').toUpperCase()}</span></td>
                <td style="padding: 8px;"></td>
            </tr>`;
        }
        //html += `</table></details></td></tr>`;
     //}
    
    html += `</tbody></table>`;
    return html;
}

function toggleEndpoint(endpointId) {
    const contentId = `content-${endpointId.replace(/[\/\?#]/g, '_')}`;
    const toggleId = `toggle-${endpointId.replace(/[\/\?#]/g, '_')}`;
    const content = document.getElementById(contentId);
    const toggle = document.getElementById(toggleId);
    if (content) {
        content.classList.toggle('open');
        if (toggle) toggle.classList.toggle('open');
    }
}

function downloadReport() {
    if (!currentReport) return;
    const enhancedReport = { ...currentReport, generated_at: new Date().toISOString(), failed_tests_summary: { count: currentReport.failedTests?.length || 0, details: currentReport.failedTests || [] } };
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
}

// Глобальные функции
window.switchMode = switchMode;
window.removeFile = removeFile;
window.closeFuzzModal = closeFuzzModal;
window.downloadReport = downloadReport;
window.toggleEndpoint = toggleEndpoint;
window.closeTokenModal = closeTokenModal;
window.clearAuthToken = clearAuthToken;
window.replayTest = replayTest;
window.closeReplayModal = closeReplayModal;
window.copyAsCurl = copyAsCurl;
window.copyAsFetch = copyAsFetch;
window.exportToPostman = exportToPostman;
window.copyRawRequest = copyRawRequest;
window.toggleReplaySection = toggleReplaySection;