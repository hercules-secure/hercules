import { 
    formatBytes, 
    delay, 
    escapeHtml, 
    loadJSZip, 
    createZipArchive,
    generateSummaryHTML,
    generateDependenciesHTML,
    generateCodeHTML,
    generateHTMLReport
} from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Состояние
    let selectedArchive = null;
    let selectedFolder = null;
    let selectedFolderFiles = [];
    let currentSource = 'git';
    let currentTaskId = null;
    let currentReport = null;
    let progressInterval = null;
    let currentOverallProgress = 0;
    
    // DOM элементы
    const repoInput = document.getElementById('repo');
    const startBtn = document.getElementById('start-btn');
    const branchInput = document.getElementById('branchName');
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const archiveStartBtn = document.getElementById('archive-start-btn');
    const archiveFileInfo = document.getElementById('archiveFileInfo');
    const localFolderInput = document.getElementById('localFolderInput');
    const localUploadArea = document.getElementById('localUploadArea');
    const localStartBtn = document.getElementById('local-start-btn');
    const localFolderInfo = document.getElementById('localFolderInfo');
    const overallProgress = document.getElementById('overallProgress');
    const overallPercent = document.getElementById('overallPercent');
    
    // API базовый URL
    const API_BASE_URL = '/api/blender';
    
    // Функция получения заголовков авторизации
    function getAuthHeaders() {
        const token = localStorage.getItem('licenseToken');
        if (token) {
            return { 'Authorization': `Bearer ${token}` };
        }
        return {};
    }
    
    // ========== ФУНКЦИИ ДЛЯ ГРАДУСНИКА ==========
    
    function updateOverallProgress(percent) {
        const overallProgressEl = document.getElementById('overallProgress');
        const overallPercentEl = document.getElementById('overallPercent');
        if (overallProgressEl) overallProgressEl.style.width = `${percent}%`;
        if (overallPercentEl) overallPercentEl.textContent = `${Math.round(percent)}%`;
        currentOverallProgress = percent;
    }
    
    function updateStepStatus(step, status) {
        const dot = document.getElementById(`markDot${step}`);
        const label = document.getElementById(`markLabel${step}`);
        
        if (dot) {
            dot.classList.remove('completed', 'active');
            if (status === 'completed') dot.classList.add('completed');
            else if (status === 'active') dot.classList.add('active');
        }
        
        if (label) {
            label.classList.remove('completed', 'active');
            if (status === 'completed') label.classList.add('completed');
            else if (status === 'active') label.classList.add('active');
        }
    }
    
    function updateStepProgress(step, percent) {
        const dot = document.getElementById(`markDot${step}`);
        if (dot && percent !== undefined) {
            dot.setAttribute('data-progress', `${Math.round(percent)}%`);
        }
    }
    
    function resetAllProgress() {
        stopProgressEmulation();
        updateOverallProgress(0);
        for (let i = 1; i <= 7; i++) {
            updateStepStatus(i, 'pending');
            updateStepProgress(i, 0);
        }
        currentOverallProgress = 0;
        currentTaskId = null;
    }
    
    function startProgressEmulation() {
        stopProgressEmulation();
        
        let currentStep = 1;
        let currentStepProgress = 0;
        
        updateStepStatus(1, 'active');
        
        progressInterval = setInterval(() => {
            if (currentStep > 7) {
                updateOverallProgress(100);
                stopProgressEmulation();
                return;
            }
            
            currentStepProgress += Math.random() * 15 + 5;
            
            if (currentStepProgress >= 100) {
                updateStepStatus(currentStep, 'completed');
                updateStepProgress(currentStep, 100);
                currentStep++;
                currentStepProgress = 0;
                if (currentStep <= 7) updateStepStatus(currentStep, 'active');
            } else {
                updateStepProgress(currentStep, currentStepProgress);
            }
            
            const completedSteps = currentStep - 1;
            const overallProgressValue = ((completedSteps * 100) + currentStepProgress) / 7;
            updateOverallProgress(overallProgressValue);
            
        }, 800);
    }
    
    function stopProgressEmulation() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }
    
    // ========== API ФУНКЦИИ ==========
    
    async function callAPI(endpoint, method = 'GET', data = null) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        };
        
        const options = { 
            method: method, 
            headers: headers 
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            
            if (response.status === 401) {
                if (typeof window.showLicenseModal === 'function') {
                    window.showLicenseModal();
                }
                throw new Error('Требуется активация лицензии');
            }
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    }
    
    async function analyzeGitRepo(url, branch) {
        const headers = {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        };
        
        const response = await fetch(`${API_BASE_URL}/analyze/git`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ url, branch })
        });
        
        if (response.status === 401) {
            if (typeof window.showLicenseModal === 'function') {
                window.showLicenseModal();
            }
            throw new Error('Требуется активация лицензии');
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
    }
    
    async function getAnalysisResult(taskId) {
        return callAPI(`/result/${taskId}`, 'GET');
    }
    
    async function uploadArchive(blob, fileName) {
        const formData = new FormData();
        formData.append('file', blob, fileName);
        
        const headers = getAuthHeaders();
        
        const response = await fetch(`${API_BASE_URL}/analyze/archive/upload`, {
            method: 'POST',
            headers: headers,
            body: formData
        });
        
        if (response.status === 401) {
            if (typeof window.showLicenseModal === 'function') {
                window.showLicenseModal();
            }
            throw new Error('Требуется активация лицензии');
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка загрузки архива');
        }
        
        return await response.json();
    }
    
    // ========== ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ КНОПКАМИ ==========
    
    function activateButton(button) {
        if (button) {
            button.disabled = false;
            button.classList.add('active');
        }
    }
    
    function deactivateButton(button) {
        if (button) {
            button.disabled = true;
            button.classList.remove('active');
        }
    }
    
    // ========== ФУНКЦИИ UI ==========
    
    function showAlert(message, type) {
        const alertDiv = document.getElementById('alertMessage');
        if (alertDiv) {
            alertDiv.className = `alert-message ${type}`;
            alertDiv.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'info' ? 'fa-info-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
            setTimeout(() => {
                if (alertDiv.className === `alert-message ${type}`) hideAlert();
            }, 5000);
        }
    }
    
    function hideAlert() {
        const alertDiv = document.getElementById('alertMessage');
        if (alertDiv) alertDiv.className = 'alert-message';
    }
    
    function showArchiveProgress(percent, message) {
        const alertDiv = document.getElementById('alertMessage');
        if (alertDiv) {
            alertDiv.className = 'alert-message info';
            alertDiv.innerHTML = `<i class="fas fa-spinner fa-pulse"></i> ${message} (${percent}%)`;
        }
    }
    
    function pollTaskStatus(taskId, onComplete) {
        const maxAttempts = 120;
        let attempts = 0;
        
        const poll = setInterval(async () => {
            attempts++;
            
            try {
                const result = await getAnalysisResult(taskId);
                
                if (result.status === 'completed' || (result.sca && result.sast)) {
                    clearInterval(poll);
                    stopProgressEmulation();
                    
                    for (let i = 1; i <= 7; i++) updateStepStatus(i, 'completed');
                    updateOverallProgress(100);
                    
                    showAlert('Анализ успешно завершен!', 'success');
                    if (onComplete) onComplete(result);
                } else if (result.status === 'error') {
                    clearInterval(poll);
                    stopProgressEmulation();
                    showAlert(`Ошибка: ${result.error}`, 'error');
                }
                
                if (attempts >= maxAttempts) {
                    clearInterval(poll);
                    stopProgressEmulation();
                    showAlert('Превышено время ожидания анализа', 'error');
                }
            } catch (error) {
               
            }
        }, 5000);
    }
    
    // ========== ФУНКЦИИ ДЛЯ РАБОТЫ С ОТЧЁТОМ ==========
    
    function transformReport(report) {
        let sastIssues = [];
        let sastStatistics = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
        
        if (report.sast) {
            if (report.sast.issues && Array.isArray(report.sast.issues)) {
                sastIssues = report.sast.issues;
                if (report.sast.statistics) {
                    sastStatistics = report.sast.statistics;
                } else {
                    sastStatistics = {
                        total: sastIssues.length,
                        critical: sastIssues.filter(i => i.severity === 'CRITICAL' || i.severity === 'critical').length,
                        high: sastIssues.filter(i => i.severity === 'HIGH' || i.severity === 'high').length,
                        medium: sastIssues.filter(i => i.severity === 'MEDIUM' || i.severity === 'medium').length,
                        low: sastIssues.filter(i => i.severity === 'LOW' || i.severity === 'low').length
                    };
                }
            }
        }
        
        let scaDependencies = [];
        let scaVulnerabilities = [];
        let scaStatistics = { totalDependencies: 0, totalVulnerabilities: 0 };
        let reachabilityStats = { reachable: 0, notReachable: 0, unknown: 0 };
        
        if (report.sca) {
            if (report.sca.dependencies && Array.isArray(report.sca.dependencies)) {
                scaDependencies = report.sca.dependencies;
                
                for (const dep of scaDependencies) {
                    if (dep.vulnerabilities && dep.vulnerabilities.count > 0 && dep.vulnerabilities.vulnerabilities) {
                        for (const vuln of dep.vulnerabilities.vulnerabilities) {
                            scaVulnerabilities.push({
                                package: dep.name,
                                version: dep.version,
                                ...vuln,
                                reachable: dep.isReachable || null,
                                usageFiles: dep.usageFiles || [],
                                usageLocations: dep.usageLocations || []
                            });
                        }
                    }
                    if (dep.isReachable === true) reachabilityStats.reachable++;
                    else if (dep.isReachable === false) reachabilityStats.notReachable++;
                    else if (dep.cveCount > 0) reachabilityStats.unknown++;
                }
            }
            
            if (report.sca.statistics) {
                scaStatistics = report.sca.statistics;
            } else {
                scaStatistics.totalDependencies = scaDependencies.length;
                scaStatistics.totalVulnerabilities = scaVulnerabilities.length;
            }
        }
        
        return {
            success: report.success,
            source: report.source,
            branch: report.branch,
            analyzedAt: report.analyzedAt,
            taskId: report.taskId,
            sca: {
                dependencies: scaDependencies,
                vulnerabilities: scaVulnerabilities,
                statistics: scaStatistics,
                reachability: reachabilityStats
            },
            sast: {
                issues: sastIssues,
                statistics: sastStatistics
            },
            structure: { files: report.fileCount || 0, directories: 0 },
            dependencies: { packages: scaDependencies },
            codeAnalysis: {
                filesProcessed: sastStatistics.total || 0,
                totalLines: 0,
                issues: sastIssues
            }
        };
    }
    
    // ========== ОТОБРАЖЕНИЕ ОТЧЕТА ==========
    
    function displayReport(report) {
        const transformed = transformReport(report);
        currentReport = transformed;
        
        const modal = document.getElementById('resultModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            renderResultTab('summary');
        } else {
            console.error('Modal element not found!');
        }
    }
    
    function renderResultTab(tabName) {
        const content = document.getElementById('resultContent');
        if (!content || !currentReport) return;
        
        const tabs = document.querySelectorAll('.result-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            const tabText = tab.textContent.toLowerCase();
            if (tabName === 'summary' && tabText.includes('обзор')) tab.classList.add('active');
            else if (tabName === 'dependencies' && (tabText.includes('зависимости') || tabText.includes('sca'))) tab.classList.add('active');
            else if (tabName === 'code' && (tabText.includes('код') || tabText.includes('sast'))) tab.classList.add('active');
        });
        
        try {
            switch(tabName) {
                case 'summary':
                    content.innerHTML = generateSummaryHTML(currentReport);
                    break;
                case 'dependencies':
                    content.innerHTML = generateDependenciesHTML(currentReport);
                    setTimeout(() => attachExpandHandlers(), 100);
                    break;
                case 'code':
                    content.innerHTML = generateCodeHTML(currentReport);
                    break;
                default:
                    content.innerHTML = generateSummaryHTML(currentReport);
            }
        } catch (error) {
            console.error('Error rendering tab:', error);
            content.innerHTML = `<div style="padding:20px;color:red;">Ошибка: ${error.message}</div>`;
        }
    }
    
    function attachExpandHandlers() {
        const rows = document.querySelectorAll('.dep-row, .vuln-row');
        rows.forEach(row => {
            row.removeEventListener('click', handleRowClick);
            row.addEventListener('click', handleRowClick);
        });
    }
    
    function handleRowClick(e) {
        if (e.target.tagName === 'A') return;
        const detailsRow = this.nextElementSibling;
        const expandIcon = this.querySelector('.expand-icon');
        if (detailsRow && detailsRow.classList.contains('dep-details-row') || detailsRow.classList.contains('details-row')) {
            const isVisible = detailsRow.style.display === 'table-row';
            detailsRow.style.display = isVisible ? 'none' : 'table-row';
            if (expandIcon) {
                expandIcon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(90deg)';
            }
        }
    }
    
    // ========== ОСНОВНЫЕ ФУНКЦИИ АНАЛИЗА ==========
    
    async function startGitAnalysis() {
        if (!repoInput) return;
        const repo = repoInput.value.trim();
        const branch = branchInput?.value.trim() || null;
        
        if (!repo) {
            showAlert('Пожалуйста, введите URL репозитория', 'error');
            return;
        }
        
        deactivateButton(startBtn);
        resetAllProgress();
        showAlert('Отправка запроса на анализ...', 'info');
        
        try {
            const result = await analyzeGitRepo(repo, branch);
            
            if (result.success) {
                startProgressEmulation();
                showAlert(`Анализ запущен (ID: ${result.taskId})`, 'success');
                pollTaskStatus(result.taskId, (finalResult) => {
                    if (finalResult) displayReport(finalResult);
                    activateButton(startBtn);
                });
            } else {
                stopProgressEmulation();
                showAlert(`Ошибка: ${result.error || 'Неизвестная ошибка'}`, 'error');
                activateButton(startBtn);
            }
        } catch (error) {
            stopProgressEmulation();
            showAlert(`Ошибка: ${error.message}`, 'error');
            activateButton(startBtn);
        }
    }
    
    async function startArchiveAnalysis() {
        if (!selectedArchive) {
            showAlert('Пожалуйста, выберите архив', 'error');
            return;
        }
        
        deactivateButton(archiveStartBtn);
        resetAllProgress();
        showAlert(`Отправка архива ${selectedArchive.name} на анализ...`, 'info');
        
        try {
            const result = await uploadArchive(selectedArchive, selectedArchive.name);
            
            if (result.success) {
                startProgressEmulation();
                showAlert(`Анализ архива запущен (ID: ${result.taskId})`, 'success');
                pollTaskStatus(result.taskId, (finalResult) => {
                    if (finalResult) displayReport(finalResult);
                    activateButton(archiveStartBtn);
                });
            } else {
                stopProgressEmulation();
                showAlert(`Ошибка: ${result.error}`, 'error');
                activateButton(archiveStartBtn);
            }
        } catch (error) {
            stopProgressEmulation();
            showAlert(`Ошибка при загрузке архива: ${error.message}`, 'error');
            activateButton(archiveStartBtn);
        }
    }
    
    async function startLocalAnalysis() {
        if (!selectedFolderFiles.length) {
            showAlert('Пожалуйста, выберите папку проекта', 'error');
            return;
        }
        
        deactivateButton(localStartBtn);
        resetAllProgress();
        showAlert(`Подготовка архива из папки ${selectedFolder}...`, 'info');
        
        try {
            if (!window.JSZip) await loadJSZip();
            
            showArchiveProgress(0, 'Подготовка файлов');
            
            const validFiles = [];
            let processedCount = 0, skippedCount = 0;
            
            for (const file of selectedFolderFiles) {
                processedCount++;
                const percent = Math.round((processedCount / selectedFolderFiles.length) * 50);
                showArchiveProgress(percent, `Проверка файлов (${processedCount}/${selectedFolderFiles.length})...`);
                
                try {
                    await file.slice(0, 1).arrayBuffer();
                    validFiles.push(file);
                } catch { skippedCount++; }
            }
            
            if (validFiles.length === 0) throw new Error('Нет доступных файлов для архивации');
            if (skippedCount > 0) showAlert(`Пропущено ${skippedCount} недоступных файлов`, 'warning');
            
            showArchiveProgress(50, `Создание архива (${validFiles.length} файлов)...`);
            const zipBlob = await createZipArchive(validFiles, selectedFolder);
            showArchiveProgress(100, 'Архив создан');
            showAlert(`Отправка архива ${selectedFolder}.zip на сервер...`, 'info');
            
            const result = await uploadArchive(zipBlob, `${selectedFolder}.zip`);
            
            if (result.success) {
                startProgressEmulation();
                showAlert(`Анализ локального проекта запущен (ID: ${result.taskId})`, 'success');
                pollTaskStatus(result.taskId, (finalResult) => {
                    if (finalResult) displayReport(finalResult);
                    activateButton(localStartBtn);
                });
            } else {
                stopProgressEmulation();
                showAlert(`Ошибка: ${result.error}`, 'error');
                activateButton(localStartBtn);
            }
        } catch (error) {
            stopProgressEmulation();
            showAlert(`Ошибка: ${error.message}`, 'error');
            activateButton(localStartBtn);
        }
    }
    
    // ========== ОСНОВНЫЕ ФУНКЦИИ UI ==========
    
    window.switchSource = function(source) {
        currentSource = source;
        
        document.querySelectorAll('.source-btn').forEach(btn => btn.classList.remove('active'));
        if (window.event && window.event.target) window.event.target.classList.add('active');
        
        document.querySelectorAll('.source-content').forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(`${source}-source`);
        if (targetContent) targetContent.classList.add('active');
        
        hideAlert();
        resetAllProgress();
    };
    
    function validateGitUrl(url) {
        return url && (url.endsWith('.git') || url.includes('github.com') || url.includes('gitlab.com'));
    }
    
    function updateGitButton() {
        if (startBtn && repoInput) {
            const isValid = validateGitUrl(repoInput.value);
            if (isValid) activateButton(startBtn);
            else deactivateButton(startBtn);
        }
    }
    
    window.clearArchive = function() {
        selectedArchive = null;
        if (fileInput) fileInput.value = '';
        if (archiveFileInfo) archiveFileInfo.classList.remove('active');
        deactivateButton(archiveStartBtn);
    };
    
    window.clearFolder = function() {
        selectedFolder = null;
        selectedFolderFiles = [];
        if (localFolderInput) localFolderInput.value = '';
        if (localFolderInfo) localFolderInfo.classList.remove('active');
        deactivateButton(localStartBtn);
    };
    
    // ========== ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА ==========
    
    window.closeResultModal = function() {
        const modal = document.getElementById('resultModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
            resetAllProgress();
            
            switch(currentSource) {
                case 'git': deactivateButton(startBtn); break;
                case 'archive': deactivateButton(archiveStartBtn); break;
                case 'local': deactivateButton(localStartBtn); break;
                default: deactivateButton(startBtn);
            }
        }
        currentReport = null;
    };
    
    window.showResultTab = function(tabName) {
        renderResultTab(tabName);
    };
    
    window.downloadJSON = function() {
        if (!currentReport) return;
        const jsonStr = JSON.stringify(currentReport, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis_report_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showAlert('JSON отчет скачан', 'success');
    };
    
    window.downloadHTML = function() {
        if (!currentReport) return;
        const htmlContent = generateHTMLReport(currentReport);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis_report_${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        showAlert('HTML отчет скачан', 'success');
    };
    
    // ========== ОБРАБОТЧИКИ ==========
    
    if (fileInput && archiveStartBtn && archiveFileInfo) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                selectedArchive = e.target.files[0];
                archiveFileInfo.innerHTML = `
                    <div class="file-details">
                        <i class="fas fa-file-archive"></i>
                        <span class="file-name">${escapeHtml(selectedArchive.name)}</span>
                        <span class="file-size">(${formatBytes(selectedArchive.size)})</span>
                        <i class="fas fa-times remove-file" onclick="clearArchive()"></i>
                    </div>
                `;
                archiveFileInfo.classList.add('active');
                activateButton(archiveStartBtn);
            }
        });
    }
    
    if (localFolderInput && localStartBtn && localFolderInfo) {
        localFolderInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                selectedFolderFiles = Array.from(e.target.files);
                const firstFilePath = e.target.files[0].webkitRelativePath || e.target.files[0].name;
                selectedFolder = firstFilePath.split('/')[0];
                
                let validFiles = 0, totalSize = 0;
                for (const file of selectedFolderFiles) {
                    if (file.size > 0) { validFiles++; totalSize += file.size; }
                }
                
                if (validFiles === 0) {
                    showAlert('Выбрана пустая папка или нет доступных файлов', 'error');
                    clearFolder();
                    return;
                }
                
                localFolderInfo.innerHTML = `
                    <div class="file-details">
                        <i class="fas fa-folder-open"></i>
                        <span class="file-name">${escapeHtml(selectedFolder)}</span>
                        <span class="file-size">(${validFiles} файлов, ${formatBytes(totalSize)})</span>
                        <i class="fas fa-times remove-file" onclick="clearFolder()"></i>
                    </div>
                `;
                localFolderInfo.classList.add('active');
                activateButton(localStartBtn);
            }
        });
    }
    
    // Drag & Drop
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
        uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('dragover'); });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && (files[0].name.match(/\.(zip|tar|gz|tgz|7z)$/i))) {
                fileInput.files = files;
                fileInput.dispatchEvent(new Event('change'));
            } else {
                showAlert('Пожалуйста, выберите архив (ZIP, TAR, GZ, 7Z)', 'error');
            }
        });
        uploadArea.addEventListener('click', () => fileInput.click());
    }
    
    if (localUploadArea && localFolderInput) {
        localUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); localUploadArea.classList.add('dragover'); });
        localUploadArea.addEventListener('dragleave', () => { localUploadArea.classList.remove('dragover'); });
        localUploadArea.addEventListener('drop', (e) => { e.preventDefault(); localFolderInput.click(); });
        localUploadArea.addEventListener('click', () => localFolderInput.click());
    }
    
    // ========== ПОДПИСКА НА СОБЫТИЯ ==========
    
    if (startBtn) startBtn.addEventListener('click', startGitAnalysis);
    if (archiveStartBtn) archiveStartBtn.addEventListener('click', startArchiveAnalysis);
    if (localStartBtn) localStartBtn.addEventListener('click', startLocalAnalysis);
    if (repoInput) repoInput.addEventListener('input', updateGitButton);
    
    // ========== ЭКСПОРТ ФУНКЦИЙ ==========
    
    window.updateOverallProgress = updateOverallProgress;
    window.updateStepStatus = updateStepStatus;
    window.updateStepProgress = updateStepProgress;
    window.resetAllProgress = resetAllProgress;
    window.startProgressEmulation = startProgressEmulation;
    window.stopProgressEmulation = stopProgressEmulation;
    window.getAuthHeaders = getAuthHeaders;
    
    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    
    updateGitButton();
    resetAllProgress();
});