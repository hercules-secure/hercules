import { 
    formatBytes, 
    delay, 
    escapeHtml, 
    loadJSZip, 
    createZipArchive,
    generateSummaryHTML,
    generateDependenciesHTML,
    generateApiHTML,
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
    const copyProjectCheck = document.getElementById('copyProject');
    const overallProgress = document.getElementById('overallProgress');
    const overallPercent = document.getElementById('overallPercent');
    
    // API базовый URL
    const API_BASE_URL = '/api/blender';
    
    // ========== ЭМУЛЯТОР ПРОГРЕССА ==========
    
    function startProgressEmulation() {
        stopProgressEmulation();
        
        currentOverallProgress = 0;
        if (overallProgress) overallProgress.style.width = '0%';
        if (overallPercent) overallPercent.textContent = '0%';
        
        const steps = [
            { id: 'task1', name: 'Загрузка данных', maxProgress: 100 },
            { id: 'task2', name: 'Сканирование структуры', maxProgress: 100 },
            { id: 'task3', name: 'Анализ компонентов', maxProgress: 100 },
            { id: 'task4', name: 'Анализ кода', maxProgress: 100 },
            { id: 'task5', name: 'Поиск уязвимостей', maxProgress: 100 },
            { id: 'task6', name: 'API анализ', maxProgress: 100 },
            { id: 'task7', name: 'Генерация отчета', maxProgress: 100 }
        ];
        
        let currentStepIndex = 0;
        let currentStepProgress = 0;
        
        if (currentStepIndex < steps.length) {
            updateTaskStatus(steps[currentStepIndex].id, 'in-progress', currentStepProgress);
        }
        
        progressInterval = setInterval(() => {
            if (currentStepIndex >= steps.length) {
                if (currentOverallProgress < 100) {
                    currentOverallProgress = 100;
                    if (overallProgress) overallProgress.style.width = '100%';
                    if (overallPercent) overallPercent.textContent = '100%';
                }
                stopProgressEmulation();
                return;
            }
            
            const currentStep = steps[currentStepIndex];
            currentStepProgress += Math.random() * 15 + 5;
            
            if (currentStepProgress >= 100) {
                currentStepProgress = 100;
                updateTaskStatus(currentStep.id, 'success', 100);
                currentStepIndex++;
                currentStepProgress = 0;
                if (currentStepIndex < steps.length) {
                    updateTaskStatus(steps[currentStepIndex].id, 'in-progress', 0);
                }
            } else {
                updateTaskStatus(currentStep.id, 'in-progress', currentStepProgress);
            }
            
            const completedSteps = currentStepIndex;
            const totalSteps = steps.length;
            currentOverallProgress = ((completedSteps * 100) + currentStepProgress) / totalSteps;
            
            if (overallProgress) overallProgress.style.width = `${currentOverallProgress}%`;
            if (overallPercent) overallPercent.textContent = `${Math.round(currentOverallProgress)}%`;
        }, 800);
    }
    
    function stopProgressEmulation() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }
    
    function resetAllProgress() {
        stopProgressEmulation();
        currentOverallProgress = 0;
        if (overallProgress) overallProgress.style.width = '0%';
        if (overallPercent) overallPercent.textContent = '0%';
        
        const tasks = ['task1', 'task2', 'task3', 'task4', 'task5', 'task6', 'task7'];
        tasks.forEach(task => {
            updateTaskStatus(task, 'pending', 0);
        });
    }
    
    // ========== API ФУНКЦИИ ==========
    
    async function callAPI(endpoint, method = 'GET', data = null) {
        const url = `${API_BASE_URL}${endpoint}`;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Error ${endpoint}:`, error);
            throw error;
        }
    }
    
    async function analyzeGitRepo(repoUrl, branch) {
        return callAPI('/analyze/git', 'POST', { repoUrl, branch });
    }
    
    async function getAnalysisResult(taskId) {
        return callAPI(`/result/${taskId}`, 'GET');
    }
    
    async function uploadArchive(blob, fileName) {
        const formData = new FormData();
        formData.append('file', blob, fileName);
        
        const response = await fetch(`${API_BASE_URL}/analyze/archive/upload`, {
            method: 'POST',
            body: formData
        });
        
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
    
    function updateTaskStatus(taskId, status, progress = null) {
        const taskElement = document.getElementById(taskId);
        const statusElement = document.getElementById(`${taskId}-status`);
        const iconElement = document.getElementById(`${taskId}-icon`);
        const progressBar = document.getElementById(`${taskId}-progress`);
        
        if (!taskElement) return;
        
        taskElement.classList.remove('pending-step', 'in-progress-step', 'success-step', 'error-step');
        if (iconElement) {
            iconElement.classList.remove('pending', 'in-progress', 'completed', 'error');
        }
        
        switch(status) {
            case 'pending':
                taskElement.classList.add('pending-step');
                if (iconElement) iconElement.classList.add('pending');
                if (statusElement) statusElement.textContent = 'Ожидание';
                break;
            case 'in-progress':
                taskElement.classList.add('in-progress-step');
                if (iconElement) iconElement.classList.add('in-progress');
                if (statusElement) statusElement.textContent = 'В процессе';
                break;
            case 'success':
                taskElement.classList.add('success-step');
                if (iconElement) iconElement.classList.add('completed');
                if (statusElement) statusElement.textContent = 'Завершён';
                break;
            case 'error':
                taskElement.classList.add('error-step');
                if (iconElement) iconElement.classList.add('error');
                if (statusElement) statusElement.textContent = 'Ошибка';
                break;
        }
        
        if (progressBar && progress !== null) {
            progressBar.style.width = `${progress}%`;
        }
    }
    
    function showAlert(message, type) {
        const alertDiv = document.getElementById('alertMessage');
        if (alertDiv) {
            alertDiv.className = `alert-message ${type}`;
            alertDiv.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'info' ? 'fa-info-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
            setTimeout(() => {
                if (alertDiv.className === `alert-message ${type}`) {
                    hideAlert();
                }
            }, 5000);
        }
    }
    
    function hideAlert() {
        const alertDiv = document.getElementById('alertMessage');
        if (alertDiv) {
            alertDiv.className = 'alert-message';
        }
    }
    
    function showArchiveProgress(percent, message) {
        const alertDiv = document.getElementById('alertMessage');
        if (alertDiv) {
            alertDiv.className = `alert-message info`;
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
                    
                    const tasks = ['task1', 'task2', 'task3', 'task4', 'task5', 'task6', 'task7'];
                    tasks.forEach(task => {
                        updateTaskStatus(task, 'success', 100);
                    });
                    
                    if (overallProgress) overallProgress.style.width = '100%';
                    if (overallPercent) overallPercent.textContent = '100%';
                    
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
                console.error('Ошибка при опросе статуса:', error);
            }
        }, 1000);
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
    let scaStatistics = { totalDependencies: 0, totalVulnerabilities: 0 };
    
    if (report.sca) {
        if (report.sca.dependencies && Array.isArray(report.sca.dependencies)) {
            scaDependencies = report.sca.dependencies;
        }
        if (report.sca.statistics) {
            scaStatistics = report.sca.statistics;
        } else {
            scaStatistics.totalDependencies = scaDependencies.length;
        }
    }
    
    // ИЗВЛЕКАЕМ API ENDPOINTS ИЗ FUZZ
    let apiEndpoints = [];
    let fuzzStatistics = {};
    
    if (report.fuzz) {
        if (report.fuzz.endpoints && Array.isArray(report.fuzz.endpoints)) {
            apiEndpoints = report.fuzz.endpoints;
        }
        if (report.fuzz.statistics) {
            fuzzStatistics = report.fuzz.statistics;
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
            vulnerabilities: report.sca?.vulnerabilities || [],
            statistics: scaStatistics
        },
        sast: {
            issues: sastIssues,
            statistics: sastStatistics
        },
        fuzz: {                           // <-- ДОБАВЛЯЕМ fuzz
            endpoints: apiEndpoints,
            statistics: fuzzStatistics
        },
        structure: { files: report.fileCount || 0, directories: 0 },
        dependencies: { packages: scaDependencies },
        codeAnalysis: {
            filesProcessed: sastStatistics.total || 0,
            totalLines: 0,
            issues: sastIssues
        },
        apiEndpoints: apiEndpoints        // <-- ЗАПОЛНЯЕМ apiEndpoints
    };
}
    
    function displayReport(report) {
        const transformed = transformReport(report);
        currentReport = transformed;
        const modal = document.getElementById('resultModal');
        if (modal) {
            modal.classList.add('active');
            showResultTab('summary');
        }
    }
    
    // ========== ФУНКЦИИ ДЛЯ РАБОТЫ С МОДАЛЬНЫМ ОКНОМ ==========
    
    window.closeResultModal = function() {
        const modal = document.getElementById('resultModal');
        if (modal) {
            modal.classList.remove('active');
            resetAllProgress();
            
            switch(currentSource) {
                case 'git':
                    deactivateButton(startBtn);
                    break;
                case 'archive':
                    deactivateButton(archiveStartBtn);
                    break;
                case 'local':
                    deactivateButton(localStartBtn);
                    break;
                default:
                    deactivateButton(startBtn);
            }
        }
        currentReport = null;
    };
    
    window.showResultTab = function(tabName) {
        const tabs = document.querySelectorAll('.result-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
        });
        if (window.event && window.event.target) {
            window.event.target.classList.add('active');
        } else if (tabs.length > 0) {
            tabs[0].classList.add('active');
        }
        
        const content = document.getElementById('resultContent');
        if (!content || !currentReport) return;
        
        switch(tabName) {
            case 'summary':
                content.innerHTML = generateSummaryHTML(currentReport);
                break;
            case 'dependencies':
                content.innerHTML = generateDependenciesHTML(currentReport);
                break;
            case 'api':
                content.innerHTML = generateApiHTML(currentReport);
                break;
            case 'code':
                content.innerHTML = generateCodeHTML(currentReport);
                break;
            default:
                content.innerHTML = generateSummaryHTML(currentReport);
        }
    };
    
    window.downloadJSON = function() {
        if (!currentReport) return;
        
        const jsonStr = JSON.stringify(currentReport, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis_report_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showAlert('HTML отчет скачан', 'success');
    };
    
    // ========== ОСНОВНЫЕ ФУНКЦИИ ==========
    
    window.switchSource = function(source) {
        currentSource = source;
        
        document.querySelectorAll('.source-btn').forEach(btn => btn.classList.remove('active'));
        if (window.event && window.event.target) {
            window.event.target.classList.add('active');
        }
        
        document.querySelectorAll('.source-content').forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(`${source}-source`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
        
        hideAlert();
        resetAllProgress();
    };
    
    function validateGitUrl(url) {
        return url && (url.endsWith('.git') || url.includes('github.com') || url.includes('gitlab.com'));
    }
    
    function updateGitButton() {
        if (startBtn && repoInput) {
            const isValid = validateGitUrl(repoInput.value);
            if (isValid) {
                activateButton(startBtn);
            } else {
                deactivateButton(startBtn);
            }
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
    
    // ========== ОБРАБОТЧИКИ ДЛЯ АРХИВА ==========
    
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
    
    // ========== ОБРАБОТЧИКИ ДЛЯ ЛОКАЛЬНОЙ ПАПКИ (ИСПРАВЛЕННЫЕ) ==========
    
    if (localFolderInput && localStartBtn && localFolderInfo) {
        localFolderInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                // Сохраняем файлы сразу при выборе
                selectedFolderFiles = Array.from(e.target.files);
                
                // Получаем имя папки из первого файла
                const firstFilePath = e.target.files[0].webkitRelativePath || e.target.files[0].name;
                selectedFolder = firstFilePath.split('/')[0];
                
                // Проверяем валидность файлов
                let validFiles = 0;
                let totalSize = 0;
                
                for (const file of selectedFolderFiles) {
                    if (file.size > 0) {
                        validFiles++;
                        totalSize += file.size;
                    }
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
    
    // ========== DRAG & DROP ==========
    
    if (uploadArea && fileInput) {
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
            const files = e.dataTransfer.files;
            if (files.length > 0 && (files[0].name.match(/\.(zip|tar|gz|tgz|7z)$/i))) {
                fileInput.files = files;
                const event = new Event('change');
                fileInput.dispatchEvent(event);
            } else {
                showAlert('Пожалуйста, выберите архив (ZIP, TAR, GZ, 7Z)', 'error');
            }
        });
        
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
    }
    
    if (localUploadArea && localFolderInput) {
        localUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            localUploadArea.classList.add('dragover');
        });
        
        localUploadArea.addEventListener('dragleave', () => {
            localUploadArea.classList.remove('dragover');
        });
        
        localUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            localUploadArea.classList.remove('dragover');
            const items = e.dataTransfer.items;
            if (items.length > 0 && items[0].webkitGetAsEntry) {
                localFolderInput.click();
            } else {
                showAlert('Пожалуйста, выберите папку проекта', 'error');
            }
        });
        
        localUploadArea.addEventListener('click', () => {
            localFolderInput.click();
        });
    }
    
    // ========== АНАЛИЗ ЧЕРЕЗ API ==========
    
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
                    if (finalResult) {
                        displayReport(finalResult);
                    }
                    activateButton(startBtn);
                });
            } else {
                stopProgressEmulation();
                showAlert(`Ошибка: ${result.error || 'Неизвестная ошибка'}`, 'error');
                activateButton(startBtn);
            }
        } catch (error) {
            stopProgressEmulation();
            console.error('Git analysis error:', error);
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
        
        const formData = new FormData();
        formData.append('file', selectedArchive);
        
        try {
            const response = await fetch(`${API_BASE_URL}/analyze/archive/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Ошибка загрузки архива');
            }
            
            const result = await response.json();
            
            if (result.success) {
                startProgressEmulation();
                showAlert(`Анализ архива запущен (ID: ${result.taskId})`, 'success');
                
                pollTaskStatus(result.taskId, (finalResult) => {
                    if (finalResult) {
                        displayReport(finalResult);
                    }
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
    
    // ========== АНАЛИЗ ЛОКАЛЬНОГО ПРОЕКТА (ИСПРАВЛЕННЫЙ) ==========
    
    async function startLocalAnalysis() {
        if (!selectedFolderFiles.length) {
            showAlert('Пожалуйста, выберите папку проекта', 'error');
            return;
        }
        
        deactivateButton(localStartBtn);
        resetAllProgress();
        
        showAlert(`Подготовка архива из папки ${selectedFolder}...`, 'info');
        
        try {
            if (!window.JSZip) {
                await loadJSZip();
            }
            
            showArchiveProgress(0, 'Подготовка файлов');
            
            // Фильтруем и валидируем файлы перед созданием ZIP
            const validFiles = [];
            let processedCount = 0;
            let skippedCount = 0;
            
            for (const file of selectedFolderFiles) {
                processedCount++;
                const percent = Math.round((processedCount / selectedFolderFiles.length) * 50);
                showArchiveProgress(percent, `Проверка файлов (${processedCount}/${selectedFolderFiles.length})...`);
                
                try {
                    // Проверяем, можно ли прочитать файл
                    const testSlice = file.slice(0, 1);
                    await testSlice.arrayBuffer();
                    validFiles.push(file);
                } catch (readError) {
                    skippedCount++;
                    console.warn(`Файл пропущен (не читается): ${file.name}`, readError);
                }
            }
            
            if (validFiles.length === 0) {
                throw new Error('Нет доступных файлов для архивации');
            }
            
            if (skippedCount > 0) {
                showAlert(`Пропущено ${skippedCount} недоступных файлов`, 'warning');
            }
            
            showArchiveProgress(50, `Создание архива (${validFiles.length} файлов)...`);
            
            const zipBlob = await createZipArchive(validFiles, selectedFolder);
            
            showArchiveProgress(100, 'Архив создан');
            
            showAlert(`Отправка архива ${selectedFolder}.zip на сервер...`, 'info');
            
            const result = await uploadArchive(zipBlob, `${selectedFolder}.zip`);
            
            if (result.success) {
                startProgressEmulation();
                showAlert(`Анализ локального проекта запущен (ID: ${result.taskId})`, 'success');
                
                pollTaskStatus(result.taskId, (finalResult) => {
                    if (finalResult) {
                        displayReport(finalResult);
                    }
                    activateButton(localStartBtn);
                });
            } else {
                stopProgressEmulation();
                showAlert(`Ошибка: ${result.error}`, 'error');
                activateButton(localStartBtn);
            }
        } catch (error) {
            stopProgressEmulation();
            console.error('Ошибка:', error);
            showAlert(`Ошибка при создании или отправке архива: ${error.message}`, 'error');
            activateButton(localStartBtn);
        }
    }
    
    // ========== ПОДПИСКА НА СОБЫТИЯ КНОПОК ==========
    
    if (startBtn) {
        startBtn.addEventListener('click', startGitAnalysis);
    }
    
    if (archiveStartBtn) {
        archiveStartBtn.addEventListener('click', startArchiveAnalysis);
    }
    
    if (localStartBtn) {
        localStartBtn.addEventListener('click', startLocalAnalysis);
    }
    
    if (repoInput) {
        repoInput.addEventListener('input', updateGitButton);
    }
    
    // Инициализация
    updateGitButton();
});