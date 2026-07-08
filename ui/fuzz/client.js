

let currentSpec = null;
let currentReport = null;
let selectedFile = null;
let currentSpecSource = null;
let authToken = localStorage.getItem('apiAuthToken') || null;
let isProcessing = false;
let specLoaded = false;
let fuzzTaskId = null;
let statusCheckInterval = null;



function resetStartButton() {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.innerHTML = '<i class="fas fa-play" style="margin-right: 6px;"></i>Начать анализ';
        startBtn.disabled = false;
        startBtn.classList.remove('active');
    }
}

function setStartButtonLoading(text) {
    text = text || 'Загрузка...';
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 6px;"></i>' + text;
        startBtn.disabled = true;
    }
}

function setStartButtonError(text) {
    text = text || 'Ошибка';
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right: 6px; color: #ef4444;"></i>' + text;
        startBtn.disabled = false;
    }
}

function validateStartButton() {
    const startBtn = document.getElementById('start-btn');
    const specUrlInput = document.getElementById('specUrl');
    
    if (!startBtn) return;
    
    const url = specUrlInput ? specUrlInput.value.trim() : '';
    const hasUrl = url && isValidUrl(url);
    const hasFile = selectedFile !== null;
    const isActive = hasUrl || hasFile;
    
    startBtn.disabled = !isActive;
    startBtn.classList.toggle('active', isActive);
}

// ============================================================
// СБРОС СОСТОЯНИЯ
// ============================================================

function resetAllState() {
    resetAllProgress();
    resetStartButton();
    
    const specUrlInput = document.getElementById('specUrl');
    if (specUrlInput) specUrlInput.value = '';
    
    const baseUrlInput = document.getElementById('baseUrl');
    if (baseUrlInput) baseUrlInput.value = '';
    
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) fileInfo.style.display = 'none';
    
    const specPreview = document.getElementById('specPreview');
    if (specPreview) specPreview.classList.remove('active');
    
    selectedFile = null;
    currentSpec = null;
    currentReport = null;
    specLoaded = false;
    fuzzTaskId = null;
    
    clearValidationMessage();
    
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
    
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
}

// ============================================================
// ОТОБРАЖЕНИЕ СПЕЦИФИКАЦИИ
// ============================================================

function displaySpecInfo(data) {
    const infoContainer = document.getElementById('specPreview');
    if (!infoContainer) return;
    
    const spec = data.spec || {};
    const endpoints = data.endpoints || [];
    const filename = data.filename || 'unknown';
    
    let format = 'Unknown';
    if (spec.openapi) format = 'OpenAPI 3.x';
    else if (spec.swagger === '2.0') format = 'Swagger 2.0';
    
    const titleEl = document.getElementById('specTitle');
    const versionEl = document.getElementById('specVersion');
    const formatEl = document.getElementById('specFormat');
    const endpointsContainer = document.getElementById('specEndpoints');
    
    if (titleEl) titleEl.textContent = spec.info?.title || 'Название';
    if (versionEl) versionEl.textContent = spec.info?.version || 'Версия';
    if (formatEl) formatEl.textContent = format;
    
    if (endpointsContainer) {
        endpointsContainer.innerHTML = '';
        const displayEndpoints = endpoints.slice(0, 10);
        for (const ep of displayEndpoints) {
            const div = document.createElement('div');
            div.className = 'endpoint-item';
            const method = typeof ep === 'string' ? 'GET' : (ep.method || 'GET');
            const path = typeof ep === 'string' ? ep : (ep.path || '/');
            div.innerHTML = `
                <span class="method-badge method-${method}">${method}</span>
                <span>${escapeHtml(path)}</span>
            `;
            endpointsContainer.appendChild(div);
        }
        if (endpoints.length > 10) {
            const div = document.createElement('div');
            div.className = 'endpoint-item';
            div.innerHTML = '<span style="color: var(--text-secondary);">... и еще ' + (endpoints.length - 10) + ' эндпоинтов</span>';
            endpointsContainer.appendChild(div);
        }
    }
    
    infoContainer.classList.add('active');
}

// ============================================================
// ОПРОС СТАТУСА
// ============================================================

function checkFuzzStatus() {
    if (!fuzzTaskId) return;
    
    const mode = document.querySelector('.mode-btn-mode.active').getAttribute('data-mode') === 'metla' ? 1 : 0;

    fetch('/api/fuzz/status/' + fuzzTaskId, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        if (data && data.status === 'completed') {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
            
            currentReport = data.report;
            currentSpec = data.report?.spec;
            specLoaded = true;
            

            
            resetStartButton();
            resetAllProgress();
            resetThermometer(); 
            
            showValidationMessage('Фаззинг успешно завершен. Найдено уязвимостей: ' + (data.report?.vulnerabilities?.length || 0), 'success');
            
            if (data.report?.spec) {
                const endpoints = data.report.byEndpoint ? Object.keys(data.report.byEndpoint) : [];
                displaySpecInfo({
                    spec: data.report.spec,
                    endpoints: endpoints,
                    filename: 'spec'
                });
            }
             mode === 0 ? displayResults(data.report) : renderMetlaTargets(data)
             fuzzTaskId = null; 
            
        } else if (data && data.status === 'error') {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
            
            showErrorModal('Ошибка', data.message || 'Ошибка выполнения фаззинга');
            showValidationMessage(data.message || 'Ошибка выполнения фаззинга', 'error');
            resetAllState();
            fuzzTaskId = null;
        }
    })
    .catch(function(error) {
        showValidationMessage('Ошибка проверки статуса задачи', 'error');
    });
}

function getAuthHeaders() {
    const token = localStorage.getItem('licenseToken');
    if (token) {
        return { 'Authorization': `Bearer ${token}` };
    }
    return {};
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ - ЗАПУСК ФАЗЗИНГА
// ============================================================
async function startFuzzing() {
    
    const startBtn = document.getElementById('start-btn');
    const baseUrlInput = document.getElementById('baseUrl');
    const specUrlInput = document.getElementById('specUrl');
    const url = specUrlInput ? specUrlInput.value.trim() : '';
    const baseUrl = baseUrlInput?.value.trim() || '';
    
    const modeElement = document.querySelector('.mode-btn-mode.active');
    const mode = modeElement?.getAttribute('data-mode') === 'metla' ? 1 : 0;
    

    // === РЕЖИМ 1 - МЕТЛА ===
    if (mode === 1) {
        
        const metlaTargetUrl = document.getElementById('specUrl');
        const targetUrl = metlaTargetUrl?.value.trim();
        
       
        if (!targetUrl) {
            showValidationMessage('Введите адрес приложения', 'invalid');
            return;
        }
        
        if (!isValidUrl(targetUrl)) {
            showValidationMessage('Введите корректный URL (http:// или https://)', 'invalid');
            return;
        }
        
        setStartButtonLoading('Анализ запущен ...');
        clearValidationMessage();
        
        try {
            
            switchThermometerMode('metla');
            startProgressEmulator();

            const response = await fetch('/api/fuzz', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()  // ← добавляем токен
                },
                body: JSON.stringify({
                    url: targetUrl,
                    mode: 1
                })
            });
            
            // ===== ПРОВЕРКА НА ЛИЦЕНЗИЮ =====
            if (response.status === 403) {
                if (typeof window.showLicenseModal === 'function') {
                    window.showLicenseModal('fuzz');
                }
                showValidationMessage('Требуется активация лицензии', 'error');
                stopProgressEmulator();
                resetAllState();
                return;
            }
            
            
            let data;
            try {
                data = await response.json();

            } catch (e) {
                throw new Error('Сервер вернул некорректный ответ');
            }
            
            if (!response.ok || (data && data.success === false)) {
                const errorMessage = data?.message || 'Ошибка на сервере';
                showErrorModal('Ошибка', errorMessage);
                showValidationMessage(errorMessage, 'error');
                stopProgressEmulator();
                resetAllState();
                return;
            }
            
            if (data && data.status === 'started') {
                fuzzTaskId = data.taskId;
                showValidationMessage('Анализ запущен...', 'info');
                
                startProgressBars();
                
                if (statusCheckInterval) {
                    clearInterval(statusCheckInterval);
                }
                statusCheckInterval = setInterval(checkFuzzStatus, 5000);
                
                setTimeout(checkFuzzStatus, 5000);
                return;
            }
            
        } catch (error) {

            let errorMessage = error.message || 'Неизвестная ошибка';
            
            if (error.message && error.message.includes('fetch')) {
                errorMessage = 'Не удалось подключиться к серверу. Проверьте что сервер запущен.';
            } else if (error.message && error.message.includes('JSON')) {
                errorMessage = 'Сервер вернул некорректный ответ. Попробуйте позже.';
            }
            
            showErrorModal('Ошибка', errorMessage);
            showValidationMessage(errorMessage, 'error');
            stopProgressEmulator();
            resetAllState();
        } finally {

            if (!emulatorInterval) {
                resetStartButton();
            }
        }
        return;
    }
    
    
    // === РЕЖИМ 0 - ДОМОВОЙ ===
    if (!url && !selectedFile) {
        showValidationMessage('Введите ссылку или выберите файл', 'invalid');
        return;
    }
    
    setStartButtonLoading('Анализ запущен ...');
    clearValidationMessage();
    
    try {
        const formData = new FormData();
        if (baseUrl) formData.append('baseUrl', baseUrl);
        if (authToken) formData.append('authToken', authToken);
        formData.append('mode', 0);
        
        if (url && isValidUrl(url)) {
            formData.append('specUrl', url);
            showValidationMessage('Загрузка спецификации по ссылке...', 'info');
        } else if (selectedFile) {
            formData.append('spec', selectedFile);
            showValidationMessage('Загрузка файла: ' + selectedFile.name, 'info');
        } else {
            throw new Error('Нет источника спецификации');
        }
        console.log(mode)
        const response = await fetch('/api/fuzz', {
            method: 'POST',
            headers: getAuthHeaders(),  // ← добавляем токен
            body: formData
        });
        
        // ===== ПРОВЕРКА НА ЛИЦЕНЗИЮ =====
        if (response.status === 401) {
            if (typeof window.showLicenseModal === 'function') {
                window.showLicenseModal('fuzz');
            }
            showValidationMessage('Требуется активация лицензии', 'error');
            resetAllState();
            return;
        }
        
        if (response.status === 403) {
            let data;
            try {
                data = await response.json();
            } catch (e) {}
            
            if (data && data.needRenew) {
                if (typeof window.showLicenseModal === 'function') {
                    window.showLicenseModal('fuzz');
                }
                showValidationMessage('Срок действия лицензии истёк', 'error');
            } else if (data && data.needReauth) {
                if (typeof window.showLicenseModal === 'function') {
                    window.showLicenseModal('fuzz');
                }
                showValidationMessage('Токен истёк, требуется повторная активация', 'error');
            } else {
                showErrorModal('Ошибка', data?.message || 'Ошибка доступа');
            }
            resetAllState();
            return;
        }
        
        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('Сервер вернул некорректный ответ');
        }
        
        if (data && data.success === false) {
            let errorMessage = data?.message || 'Ошибка на сервере';
            showErrorModal('Ошибка', errorMessage);
            showValidationMessage(errorMessage, 'error');
            resetAllState();
            return;
        }
        
        if (data && data.status === 'started') {
            fuzzTaskId = data.taskId;
            showValidationMessage('Фаззинг запущен...', 'info');
            
            startProgressBars();
            
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
            }
            statusCheckInterval = setInterval(checkFuzzStatus, 2000);
            
            setTimeout(checkFuzzStatus, 1000);
            return;
        }
        
        const report = data;
        
        currentReport = report;
        currentSpec = report.spec;
        specLoaded = true;
        
        if (!baseUrl && report.spec) {
            let extractedBaseUrl = '';
            if (report.spec.servers && report.spec.servers.length > 0) {
                extractedBaseUrl = report.spec.servers[0].url;
            } else if (report.spec.host) {
                const scheme = report.spec.schemes?.[0] || 'https';
                extractedBaseUrl = scheme + '://' + report.spec.host + (report.spec.basePath || '');
            }
            if (extractedBaseUrl) {
                const baseUrlInput2 = document.getElementById('baseUrl');
                if (baseUrlInput2) {
                    baseUrlInput2.value = extractedBaseUrl.replace(/\/$/, '');
                }
            }
        }
        
        resetStartButton();
        resetAllProgress();
        showValidationMessage('Фаззинг успешно завершен. Найдено уязвимостей: ' + (report.vulnerabilities?.length || 0), 'success');
        
        if (report.spec) {
            const endpoints = report.byEndpoint ? Object.keys(report.byEndpoint) : [];
            displaySpecInfo({
                spec: report.spec,
                endpoints: endpoints,
                filename: 'spec'
            });
        }
        
        displayResults(report);
        
        return report;
        
    } catch (error) {
        let errorMessage = error.message || 'Неизвестная ошибка';
        
        if (error.message && error.message.includes('fetch')) {
            errorMessage = 'Не удалось подключиться к серверу.';
        } else if (error.message && error.message.includes('JSON')) {
            errorMessage = 'Сервер вернул некорректный ответ. Попробуйте позже.';
        } else if (error.message && error.message.includes('413')) {
            errorMessage = 'Файл слишком большой. Уменьшите размер спецификации.';
        }
        
        showErrorModal('Ошибка', errorMessage);
        showValidationMessage(errorMessage, 'error');
        resetAllState();
    }
}

// ============================================================
// ФАЙЛЫ
// ============================================================

function handleFileSelect(file) {
    if (file) {
        const validExtensions = ['.json', '.yaml', '.yml'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!validExtensions.includes(ext)) {
            showValidationMessage('Поддерживаются только JSON и YAML файлы', 'error');
            return;
        }
        
        selectedFile = file;
        
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        
        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = formatFileSize(file.size);
        if (fileInfo) fileInfo.style.display = 'flex';
        
        showValidationMessage('Файл выбран: ' + file.name, 'success');
        validateStartButton();
    }
}

function removeFile() {
    selectedFile = null;
    currentSpec = null;
    specLoaded = false;
    
    const fileInfo = document.getElementById('fileInfo');
    const fileInput = document.getElementById('fileInput');
    
    if (fileInfo) fileInfo.style.display = 'none';
    if (fileInput) fileInput.value = '';
    
    validateStartButton();
}

// ============================================================
// ОТЧЕТ
// ============================================================

function downloadReport() {
    if (!currentReport) {
        showToolNotification('Нет отчета для скачивания', 'error');
        return;
    }
    
    const dataStr = JSON.stringify(currentReport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fuzz-report-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToolNotification('Отчет скачан', 'success');
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    const specUrlInput = document.getElementById('specUrl');
    const startBtn = document.getElementById('start-btn');
    
    if (specUrlInput) {
        specUrlInput.addEventListener('input', function() {
            const url = this.value.trim();
            if (url && isValidUrl(url)) {
                showValidationMessage('Ссылка введена. Нажмите "Начать анализ"', 'info');
            }
            validateStartButton();
        });
        
        specUrlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (startBtn && !startBtn.disabled) {
                    startBtn.click();
                }
            }
        });
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', startFuzzing);
    }
    
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (uploadArea) {
        uploadArea.addEventListener('click', function() {
            if (fileInput) fileInput.click();
        });
        
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', function() {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                handleFileSelect(file);
            }
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }
    
    const removeFileBtn = document.getElementById('remove-file-btn');
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', removeFile);
    }
    
    startBtn.disabled = true;
});

// ============================================================
// РЕГИСТРАЦИЯ В window
// ============================================================

window.startFuzzing = startFuzzing;
window.checkFuzzStatus = checkFuzzStatus;
window.removeFile = removeFile;
window.handleFileSelect = handleFileSelect;
window.validateStartButton = validateStartButton;
window.downloadReport = downloadReport;
window.resetStartButton = resetStartButton;
window.setStartButtonLoading = setStartButtonLoading;
window.setStartButtonError = setStartButtonError;
window.resetAllState = resetAllState;
window.displaySpecInfo = displaySpecInfo;