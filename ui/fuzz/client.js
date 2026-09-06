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
        startBtn.innerHTML = '<i class="fas fa-play" style="margin-right: 6px;"></i>Start Analysis';
        startBtn.disabled = false;
        startBtn.classList.remove('active');
    }
}

function setStartButtonLoading(text) {
    text = text || 'Loading...';
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 6px;"></i>' + text;
        startBtn.disabled = true;
    }
}

function setStartButtonError(text) {
    text = text || 'Error';
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
// RESET STATE
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
// DISPLAY SPECIFICATION
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
    
    if (titleEl) titleEl.textContent = spec.info?.title || 'Title';
    if (versionEl) versionEl.textContent = spec.info?.version || 'Version';
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
            div.innerHTML = '<span style="color: var(--text-secondary);">... and ' + (endpoints.length - 10) + ' more endpoints</span>';
            endpointsContainer.appendChild(div);
        }
    }
    
    infoContainer.classList.add('active');
}

// ============================================================
// POLL STATUS
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
            
            showValidationMessage('Fuzzing completed successfully. Found vulnerabilities: ' + (data.report?.vulnerabilities?.length || 0), 'success');
            
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
            
            showErrorModal('Error', data.message || 'Fuzzing execution error');
            showValidationMessage(data.message || 'Fuzzing execution error', 'error');
            resetAllState();
            fuzzTaskId = null;
        }
    })
    .catch(function(error) {
        showValidationMessage('Error checking task status', 'error');
    });
}

function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    if (token) {
        return { 'Authorization': `Bearer ${token}` };
    }
    return {};
}

// ============================================================
// MAIN FUNCTION - START FUZZING
// ============================================================
async function startFuzzing() {
    
    const startBtn = document.getElementById('start-btn');
    const baseUrlInput = document.getElementById('baseUrl');
    const specUrlInput = document.getElementById('specUrl');
    const url = specUrlInput ? specUrlInput.value.trim() : '';
    const baseUrl = baseUrlInput?.value.trim() || '';
    
    const modeElement = document.querySelector('.mode-btn-mode.active');
    const mode = modeElement?.getAttribute('data-mode') === 'metla' ? 1 : 0;
    

    // === MODE 1 - METLA ===
    if (mode === 1) {
        
        const metlaTargetUrl = document.getElementById('specUrl');
        const targetUrl = metlaTargetUrl?.value.trim();
        
       
        if (!targetUrl) {
            showValidationMessage('Enter application URL', 'invalid');
            return;
        }
        
        if (!isValidUrl(targetUrl)) {
            showValidationMessage('Enter a valid URL (http:// or https://)', 'invalid');
            return;
        }
        
        setStartButtonLoading('Analysis running ...');
        clearValidationMessage();
        
        try {
            
            switchThermometerMode('metla');
            startProgressEmulator();

            const response = await fetch('/api/fuzz', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    url: targetUrl,
                    mode: 1
                })
            });
            
            let data;
            try {
                data = await response.json();

            } catch (e) {
                throw new Error('Server returned invalid response');
            }
            
            if (!response.ok || (data && data.success === false)) {
                const errorMessage = data?.message || 'Server error';
                showErrorModal('Error', errorMessage);
                showValidationMessage(errorMessage, 'error');
                stopProgressEmulator();
                resetAllState();
                return;
            }
            
            if (data && data.status === 'started') {
                fuzzTaskId = data.taskId;
                showValidationMessage('Analysis started...', 'info');
                
                startProgressBars();
                
                if (statusCheckInterval) {
                    clearInterval(statusCheckInterval);
                }
                statusCheckInterval = setInterval(checkFuzzStatus, 5000);
                
                setTimeout(checkFuzzStatus, 5000);
                return;
            }
            
        } catch (error) {

            let errorMessage = error.message || 'Unknown error';
            
            if (error.message && error.message.includes('fetch')) {
                errorMessage = 'Unable to connect to server. Make sure the server is running.';
            } else if (error.message && error.message.includes('JSON')) {
                errorMessage = 'Server returned invalid response. Please try again later.';
            }
            
            showErrorModal('Error', errorMessage);
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
    
    
    // === MODE 0 - DOMOVOY ===
    if (!url && !selectedFile) {
        showValidationMessage('Enter URL or select a file', 'invalid');
        return;
    }
    
    setStartButtonLoading('Analysis running ...');
    clearValidationMessage();
    
    try {
        const formData = new FormData();
        if (baseUrl) formData.append('baseUrl', baseUrl);
        if (authToken) formData.append('authToken', authToken);
        formData.append('mode', 0);
        
        if (url && isValidUrl(url)) {
            formData.append('specUrl', url);
            showValidationMessage('Loading specification from URL...', 'info');
        } else if (selectedFile) {
            formData.append('spec', selectedFile);
            showValidationMessage('Loading file: ' + selectedFile.name, 'info');
        } else {
            throw new Error('No specification source');
        }
        console.log(mode)
        const response = await fetch('/api/fuzz', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });
        
        if (response.status === 403) {
            let data;
            try {
                data = await response.json();
            } catch (e) {}
            
            if (data && data.needReauth) {
                showValidationMessage('Session expired, please re-login', 'error');
            } else {
                showErrorModal('Error', data?.message || 'Access error');
            }
            resetAllState();
            return;
        }
        
        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('Server returned invalid response');
        }
        
        if (data && data.success === false) {
            let errorMessage = data?.message || 'Server error';
            showErrorModal('Error', errorMessage);
            showValidationMessage(errorMessage, 'error');
            resetAllState();
            return;
        }
        
        if (data && data.status === 'started') {
            fuzzTaskId = data.taskId;
            showValidationMessage('Fuzzing started...', 'info');
            
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
        showValidationMessage('Fuzzing completed successfully. Found vulnerabilities: ' + (report.vulnerabilities?.length || 0), 'success');
        
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
        let errorMessage = error.message || 'Unknown error';
        
        if (error.message && error.message.includes('fetch')) {
            errorMessage = 'Unable to connect to server.';
        } else if (error.message && error.message.includes('JSON')) {
            errorMessage = 'Server returned invalid response. Please try again later.';
        } else if (error.message && error.message.includes('413')) {
            errorMessage = 'File is too large. Reduce specification size.';
        }
        
        showErrorModal('Error', errorMessage);
        showValidationMessage(errorMessage, 'error');
        resetAllState();
    }
}

// ============================================================
// FILES
// ============================================================

function handleFileSelect(file) {
    if (file) {
        const validExtensions = ['.json', '.yaml', '.yml'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!validExtensions.includes(ext)) {
            showValidationMessage('Only JSON and YAML files are supported', 'error');
            return;
        }
        
        selectedFile = file;
        
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        
        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = formatFileSize(file.size);
        if (fileInfo) fileInfo.style.display = 'flex';
        
        showValidationMessage('File selected: ' + file.name, 'success');
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
// REPORT
// ============================================================

function downloadReport() {
    if (!currentReport) {
        showToolNotification('No report to download', 'error');
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
    
    showToolNotification('Report downloaded', 'success');
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    const specUrlInput = document.getElementById('specUrl');
    const startBtn = document.getElementById('start-btn');
    
    if (specUrlInput) {
        specUrlInput.addEventListener('input', function() {
            const url = this.value.trim();
            if (url && isValidUrl(url)) {
                showValidationMessage('URL entered. Click "Start Analysis"', 'info');
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
// REGISTER IN window
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