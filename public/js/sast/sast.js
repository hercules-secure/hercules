
// ========== МЕТОДЫ ДЛЯ ВЫЗОВА API ==========

/**
 * Загрузка архива по ссылке на репозиторий
 */
async function fetchArchiveFromUrl(url, branch = null) {
    const payload = { url };
    if (branch) payload.branch = branch;

    const response = await fetch('/api/sast/url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Ошибка загрузки' }));
        throw new Error(error.message || 'Ошибка загрузки архива');
    }

    const data = await response.json();
    return data.archive;
}

/**
 * Загрузка архива файлом (универсальный метод для архивов и упакованных проектов)
 */
/**
 * Загрузка архива файлом (универсальный метод для архивов и упакованных проектов)
 */
async function uploadArchive(file) {
    console.log('📤 uploadArchive вызван, файл:', file.name, 'размер:', file.size);
    
    const formData = new FormData();
    formData.append('archive', file);

    const response = await fetch('/api/sast/upload', {
        method: 'POST',
        body: formData
    });

    console.log('📡 Статус ответа:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Ошибка сервера:', errorText);
        let error;
        try {
            error = JSON.parse(errorText);
        } catch {
            error = { message: errorText };
        }
        throw new Error(error.message || 'Ошибка загрузки файла');
    }

    const data = await response.json();
    console.log('📦 Данные от сервера:', data);
    
    // Проверяем структуру ответа
    let archiveId = null;
    let archiveData = null;
    
    if (data.archive && data.archive.id) {
        // Формат: { archive: { id, filename, size } }
        archiveId = data.archive.id;
        archiveData = data.archive;
    } else if (data.id) {
        // Формат: { id, filename, size }
        archiveId = data.id;
        archiveData = data;
    } else if (data.result && data.result.id) {
        // Формат: { result: { id, filename, size } }
        archiveId = data.result.id;
        archiveData = data.result;
    } else {
        console.error('❌ Неизвестный формат ответа:', data);
        throw new Error('Сервер вернул некорректные данные');
    }
    
    if (!archiveId) {
        throw new Error('Не удалось получить ID архива из ответа сервера');
    }
    
    console.log('✅ ID архива получен:', archiveId);
    
    return {
        id: archiveId,
        filename: archiveData.filename || file.name,
        size: archiveData.size || file.size
    };
}

async function getArchiveInfo(archiveId) {
    const response = await fetch(`/api/archive/${archiveId}`);
    
    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Ошибка получения информации');
    }

    return await response.json();
}

async function deleteArchive(archiveId) {
    const response = await fetch(`/api/archive/${archiveId}`, {
        method: 'DELETE'
    });
    
    if (!response.ok) {
        throw new Error('Ошибка удаления архива');
    }

    return await response.json();
}

function showToolNotification(message, type = 'success') {
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
        font-family: 'Ubuntu', sans-serif;
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
    }, 3000);
}

// Удаление выбранного файла
window.removeFile = function() {
    const fileInfo = document.getElementById('fileInfo');
    const startBtn = document.getElementById('start-btn');
    
    if (fileInfo) fileInfo.classList.remove('active');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.classList.remove('active');
    }
    if (window.herculesApp) {
        window.herculesApp.selectedFile = null;
        window.herculesApp.selectedProject = null;
        window.herculesApp.currentArchiveId = null;
    }
};

// Основная логика
class HerculesMainApp {
    constructor() {
        this.repoInput = document.getElementById('repo');
        this.startButton = document.getElementById('start-btn');
        this.urlValidation = document.getElementById('url-validation');
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.fetchRepoBtn = document.getElementById('fetch-repo-btn');
        
        this.selectedFile = null;
        this.currentArchiveId = null;
        this.isUrlLocked = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        // Инициализируем uploader
        initSASTUploader();
    }

    setupEventListeners() {
        if (this.repoInput) {
            this.repoInput.addEventListener('input', (e) => this.validateURL(e));
            this.repoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && this.startButton?.classList.contains('active')) {
                    this.startAnalysis();
                }
            });
        }

        if (this.fetchRepoBtn) {
            this.fetchRepoBtn.addEventListener('click', () => this.fetchRepoArchive());
        }

        if (this.startButton) {
            this.startButton.addEventListener('click', () => this.startAnalysis());
        }
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    }

    isValidRepositoryUrl(url) {
        if (!url) return false;
        
        const isValid = (
            (url.startsWith('http://') || url.startsWith('https://')) &&
            (url.includes('github.com') || url.includes('gitlab') || url.includes('.git'))
        );
        
        return isValid;
    }

    async fetchRepoArchive() {
        const url = this.repoInput?.value.trim();
        
        if (!url || !this.isValidRepositoryUrl(url)) {
            this.showValidationMessage('Введите корректную ссылку на репозиторий', 'invalid');
            return;
        }

        if (this.fetchRepoBtn) {
            this.fetchRepoBtn.disabled = true;
            this.fetchRepoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
        }

        try {
            const archiveData = await fetchArchiveFromUrl(url);
            
            this.isUrlLocked = true;
            if (this.repoInput) {
                this.repoInput.disabled = true;
                this.repoInput.style.backgroundColor = '#f3f4f6';
                this.repoInput.style.opacity = '0.7';
            }
            if (this.fetchRepoBtn) {
                this.fetchRepoBtn.disabled = true;
                this.fetchRepoBtn.style.opacity = '0.5';
            }
            
            if (this.fileName) this.fileName.textContent = archiveData.filename;
            if (this.fileSize) this.fileSize.textContent = this.formatFileSize(archiveData.size);
            if (this.fileInfo) this.fileInfo.classList.add('active');
            
            if (this.startButton) {
                this.startButton.disabled = false;
                this.startButton.classList.add('active');
            }
            
            this.currentArchiveId = archiveData.id;
            this.selectedFile = null;
            
            showToolNotification('Архив успешно загружен', 'success');
        } catch (error) {
            this.showRepositoryUnavailableMessage(url);
        } finally {
            if (this.fetchRepoBtn) {
                this.fetchRepoBtn.disabled = false;
                this.fetchRepoBtn.innerHTML = 'Скачать архив';
            }
        }
    }

    showRepositoryUnavailableMessage(url) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            backdrop-filter: blur(5px);
            animation: fadeIn 0.3s ease;
            padding: 16px;
        `;

        overlay.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                padding: clamp(20px, 5vw, 40px);
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                animation: slideUp 0.4s ease;
                text-align: center;
            ">
                <div style="
                    width: clamp(60px, 15vw, 80px);
                    height: clamp(60px, 15vw, 80px);
                    background: #fee2e2;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto clamp(16px, 4vw, 24px);
                    font-size: clamp(30px, 8vw, 40px);
                    color: #dc2626;
                ">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                
                <h2 style="margin: 0 0 clamp(8px, 2vw, 12px); color: #1f2937; font-size: clamp(20px, 5vw, 24px);">
                    Репозиторий недоступен
                </h2>
                
                <p style="margin: 0 0 clamp(16px, 4vw, 20px); color: #6b7280; font-size: clamp(13px, 3.5vw, 16px); line-height: 1.5;">
                    Не удалось подключиться к репозиторию<br>
                    <strong style="color: #4b5563; word-break: break-all;">${url}</strong>
                </p>
                
                <div style="
                    background: #f3f4f6;
                    border-radius: 12px;
                    padding: clamp(16px, 4vw, 20px);
                    margin-bottom: clamp(16px, 4vw, 24px);
                    text-align: left;
                ">
                    <p style="margin: 0 0 12px; color: #374151; font-weight: 600; font-size: clamp(13px, 3.5vw, 14px);">
                        <i class="fas fa-lightbulb" style="color: #f59e0b; margin-right: 8px;"></i>
                        Рекомендации:
                    </p>
                    <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: clamp(12px, 3vw, 13px);">
                        <li style="margin-bottom: 8px;">Проверьте доступность репозитория</li>
                        <li style="margin-bottom: 8px;">Скачайте архив вручную</li>
                        <li style="margin-bottom: 8px;">Загрузите архив через форму выше</li>
                    </ul>
                </div>
                
                <div style="display: flex; gap: clamp(8px, 2vw, 12px); justify-content: center; flex-wrap: wrap;">
                    <button id="close-unavailable-btn" style="
                        background: #6b7280;
                        color: white;
                        border: none;
                        padding: clamp(10px, 2.5vw, 14px) clamp(16px, 4vw, 24px);
                        border-radius: 8px;
                        font-family: 'Ubuntu', sans-serif;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-size: clamp(12px, 3vw, 14px);
                        min-width: 100px;
                    ">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeBtn = overlay.querySelector('#close-unavailable-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 300);
            });
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 300);
            }
        });
    }

    validateURL(e) {
        if (this.isUrlLocked) return;
        
        const url = this.repoInput?.value.trim();
        
        if (!url) {
            this.setButtonState(false);
            this.showValidationMessage('', '');
            return;
        }

        const isValid = this.isValidRepositoryUrl(url);
        
        if (!isValid) {
            this.setButtonState(false);
            this.showValidationMessage('Введите корректную ссылку на Git репозиторий', 'invalid');
        } else {
            this.setButtonState(true);
            this.showValidationMessage('Ссылка корректна', 'valid');
        }
    }

    setButtonState(enabled) {
        if (!this.startButton) return;
        
        if (enabled) {
            this.startButton.disabled = false;
            this.startButton.classList.add('active');
        } else {
            this.startButton.disabled = true;
            this.startButton.classList.remove('active');
        }
    }

    showValidationMessage(message, type) {
        if (!this.urlValidation) return;
        this.urlValidation.textContent = message;
        this.urlValidation.className = 'url-validation';
        if (type === 'valid') {
            this.urlValidation.classList.add('valid');
        } else if (type === 'invalid') {
            this.urlValidation.classList.add('invalid');
        }
    }

    // Метод анимации прогресса
    animateProgress(taskId, targetPercent, duration, callback) {
        const taskElement = this.findTaskElement(taskId);
        if (!taskElement) {
            if (callback) callback();
            return;
        }
        
        const progressElement = taskElement.querySelector('.progress');
        if (!progressElement) {
            if (callback) callback();
            return;
        }
        
        const startTime = Date.now();
        const startWidth = parseFloat(progressElement.style.width) || 0;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentWidth = startWidth + (targetPercent - startWidth) * progress;
            progressElement.style.width = `${currentWidth}%`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (callback) callback();
            }
        };
        
        animate();
    }

    async startAnalysis() {
    console.log('🚀 startAnalysis вызван');
    console.log('selectedFile:', this.selectedFile?.name);
    console.log('currentArchiveId:', this.currentArchiveId);
    console.log('repoInput:', this.repoInput?.value);
    
    if (!this.startButton?.classList.contains('active')) {
        console.log('❌ Кнопка не активна');
        return;
    }

    // Проверяем, есть ли выбранный файл или загруженный архив или ссылка
    if (!this.selectedFile && !this.currentArchiveId && !this.repoInput?.value.trim()) {
        showToolNotification('Выберите файл или укажите ссылку на репозиторий', 'error');
        return;
    }

    const originalText = this.startButton.textContent;
    this.startButton.textContent = 'Анализ запущен...';
    this.startButton.disabled = true;

    try {
        this.updateTaskStatus('1.1', 'in-progress');
        
        let archiveId = null;
        
        try {
            // Если есть выбранный файл (архив или упакованный проект)
            if (this.selectedFile) {
                console.log('📁 Загружаем выбранный файл:', this.selectedFile.name);
                this.animateProgress('1.1', 50, 500, () => {});
                const archiveData = await uploadArchive(this.selectedFile);
                console.log('✅ Загружен архив:', archiveData);
                archiveId = archiveData.id;
                this.currentArchiveId = archiveId;
                this.animateProgress('1.1', 100, 500, () => {});
            } 
            // Если есть загруженный через URL архив
            else if (this.currentArchiveId) {
                console.log('📦 Используем загруженный архив, ID:', this.currentArchiveId);
                archiveId = this.currentArchiveId;
            } 
            else {
                const url = this.repoInput?.value.trim();
                if (url && this.isValidRepositoryUrl(url)) {
                    console.log('🔗 Загружаем по URL:', url);
                    this.animateProgress('1.1', 50, 500, () => {});
                    const archiveData = await fetchArchiveFromUrl(url);
                    console.log('✅ Загружен архив по URL:', archiveData);
                    archiveId = archiveData.id;
                    this.currentArchiveId = archiveId;
                    this.animateProgress('1.1', 100, 500, () => {});
                } else {
                    throw new Error('Выберите архив или укажите ссылку на репозиторий');
                }
            }

            if (!archiveId) {
                throw new Error('Не удалось получить ID архива');
            }

            console.log('🎯 ID для анализа:', archiveId);
            this.updateTaskStatus('1.1', 'completed');

            this.updateTaskStatus('2.1', 'in-progress');
            this.animateProgress('2.1', 50, 1000, () => {});
            
            const sastResults = await this.runSASTAnalysis(archiveId);
            
            console.log('📊 Результаты SAST:', sastResults);
            
            this.animateProgress('2.1', 100, 500, () => {});
            this.updateTaskStatus('2.1', 'completed');
            this.updateTaskStatus('2.2', 'completed');
            this.startButton.textContent = 'Анализ завершен';
            
            this.showSASTResultsPopup(sastResults);
            showToolNotification('Анализ успешно завершен', 'success');

        } catch (error) {
            console.error('❌ Ошибка:', error);
            this.updateTaskStatus('1.1', 'pending');
            this.updateTaskStatus('2.1', 'pending');
            this.updateTaskStatus('2.2', 'pending');
            
            showToolNotification(error.message || 'Ошибка при анализе', 'error');
            this.resetButton(originalText);
        }

    } catch (error) {
        console.error('❌ Ошибка в startAnalysis:', error);
        showToolNotification('Ошибка при анализе', 'error');
        this.resetButton(originalText);
    }
}

    async runSASTAnalysis(archiveId) {
        if (!archiveId || archiveId === 'undefined' || archiveId === 'null') {
            throw new Error(`Неверный ID архива: ${archiveId}`);
        }

        try {
            const response = await fetch(`/api/sast/analyze/${archiveId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rulesPath: null
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Детали ошибки:', errorData);
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            return data.results;
            
        } catch (error) {
            console.error('❌ Ошибка в runSASTAnalysis:', error);
            throw error;
        }
    }

    updateTaskStatus(taskId, status) {
        const statusMap = {
            'pending': 'В ожидании',
            'in-progress': 'В работе',
            'completed': 'Завершено'
        };
        
        const taskElement = this.findTaskElement(taskId);
        if (taskElement) {
            const statusElement = taskElement.querySelector('.task-status');
            if (statusElement) {
                statusElement.textContent = statusMap[status] || status;
                statusElement.className = `task-status ${status}`;
            }
            const progressElement = taskElement.querySelector('.progress');
            if (progressElement && status !== 'in-progress') {
                if (status === 'completed') {
                    progressElement.style.width = '100%';
                } else if (status === 'pending') {
                    progressElement.style.width = '0%';
                }
            }
        } else {
            console.warn(`⚠️ Элемент задачи ${taskId} не найден`);
        }
    }

    findTaskElement(taskId) {
        const parts = taskId.split('.');
        const sectionIndex = parseInt(parts[0]) - 1;
        const taskIndex = parseInt(parts[1]) - 1;
        
        const sections = document.querySelectorAll('.card-section');
        if (sectionIndex >= sections.length) return null;
        
        const cards = sections[sectionIndex].querySelectorAll('.card');
        if (taskIndex >= cards.length) return null;
        
        return cards[taskIndex];
    }

    resetButton(originalText) {
        if (!this.startButton) return;
        this.startButton.textContent = originalText;
        this.startButton.disabled = false;
        this.startButton.classList.add('active');
    }

    resetAnalysis() {
        if (this.fileInfo) {
            this.fileInfo.classList.remove('active');
        }
        if (this.repoInput && !this.isUrlLocked) {
            this.repoInput.value = '';
            this.showValidationMessage('', '');
        }
        
        if (this.startButton) {
            this.startButton.disabled = true;
            this.startButton.classList.remove('active');
        }
        
        ['1.1', '2.1', '2.2'].forEach(taskId => {
            this.updateTaskStatus(taskId, 'pending');
            const taskElement = this.findTaskElement(taskId);
            if (taskElement) {
                const progressElement = taskElement.querySelector('.progress');
                if (progressElement) {
                    progressElement.style.width = '0%';
                }
            }
        });
    }

    fullReset() {
        this.selectedFile = null;
        this.currentArchiveId = null;
        this.isUrlLocked = false;
        
        if (this.repoInput) {
            this.repoInput.disabled = false;
            this.repoInput.style.backgroundColor = '';
            this.repoInput.style.opacity = '';
            this.repoInput.value = '';
        }
        if (this.fetchRepoBtn) {
            this.fetchRepoBtn.disabled = false;
            this.fetchRepoBtn.style.opacity = '';
        }
        
        this.updateTaskStatus('1.1', 'pending');
        this.updateTaskStatus('2.1', 'pending');
        this.updateTaskStatus('2.2', 'pending');
        
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            const progressEl = card.querySelector('.progress');
            if (progressEl) {
                progressEl.style.width = '0%';
            }
        });
        
        if (this.startButton) {
            this.startButton.textContent = 'Начать анализ';
            this.startButton.disabled = true;
            this.startButton.classList.remove('active');
        }
        
        if (this.fileInfo) {
            this.fileInfo.classList.remove('active');
        }
        
        this.showValidationMessage('', '');
    }

    loadResultsFromStorage() {
        const saved = localStorage.getItem('sast-results');
        if (!saved) return null;
        
        try {
            return JSON.parse(saved);
        } catch (error) {
            console.error('Ошибка парсинга результатов:', error);
            return null;
        }
    }

    saveResultsToStorage(results) {
        try {
            localStorage.setItem('sast-results', JSON.stringify(results));
        } catch (error) {
            console.error('Ошибка сохранения результатов:', error);
        }
    }

    clearResults() {
        if (confirm('Очистить сохраненные результаты?')) {
            localStorage.removeItem('sast-results');
            showToolNotification('Результаты очищены', 'success');
        }
    }

    getShortPath(fullPath) {
        if (!fullPath) return 'unknown';
        
        const path = fullPath.replace(/\\/g, '/');
        const parts = path.split('/');
        
        if (parts.length <= 3) return path;
    
        return '.../' + parts.slice(-3).join('/');
    }

    showSASTResultsPopup(results) {
        this.saveResultsToStorage(results);
        
        const criticalHigh = results.results.filter(r => 
            r.severity === 'critical' || r.severity === 'high'
        );
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;

        const severityColors = {
            critical: '#dc3545',
            high: '#fd7e14',
            medium: '#ffc107',
            low: '#28a745',
            info: '#6c757d'
        };

        const severityNames = {
            critical: 'Критический',
            high: 'Высокий',
            medium: 'Средний',
            low: 'Низкий',
            info: 'Информационный'
        };

        const criticalHighHtml = criticalHigh.length > 0 ? criticalHigh.map((item) => {
            const shortPath = this.getShortPath(item.file);
            
            return `
            <div style="
                background: #f8f9fa;
                padding: 16px;
                margin-bottom: 12px;
                border-radius: 8px;
            ">
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <span class="method-badge" style="
                            display: inline-block;
                            padding: 2px 8px;
                            border-radius: 4px;
                            font-size: 11px;
                            font-weight: bold;
                            color: white;
                            background: ${severityColors[item.severity]};
                        ">${severityNames[item.severity]}</span>
                        <code style="
                            background: #e9ecef;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: 12px;
                        ">${shortPath}:${item.line || '?'}</code>
                    </div>
                    <span style="color: #6c757d;">${item.ruleId || 'unknown'}</span>
                </div>
                <p style="margin: 0 0 12px 0; font-weight: 500;">${item.message}</p>
                <div style="
                    background: #1f2937;
                    color: #e5e7eb;
                    padding: 10px;
                    border-radius: 6px;
                    font-family: monospace;
                    font-size: 12px;
                    margin-bottom: 10px;
                    overflow-x: auto;
                ">${item.code ? item.code.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}</div>
                <div style="
                    background: rgba(40, 167, 69, 0.1);
                    padding: 10px;
                    border-radius: 6px;
                    font-size: 12px;
                    color: #28a745;
                ">
                    ${item.recommendation || 'Рекомендация не указана'}
                </div>
            </div>
        `}).join('') : '<div style="text-align: center; padding: 40px;">Критических и высоких уязвимостей не найдено 🎉</div>';

        overlay.innerHTML = `
            <div class="modal-container" style="
                background: white;
                border-radius: 16px;
                width: 90%;
                max-width: 1000px;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                animation: modalFadeIn 0.3s ease;
            ">
                <div class="modal-header" style="
                    padding: 20px 24px;
                    background: black;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: white;
                ">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
                     Результаты анализа
                    </h3>
                    <span class="modal-close" style="cursor: pointer; font-size: 24px; color: white; line-height: 1;">&times;</span>
                </div>
                
                <div class="modal-body" style="padding: 24px; overflow-y: auto; flex: 1; background: #f8f9fa;">
                    <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 24px;">
                        <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                            <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #dc3545;">${results.summary.bySeverity.critical}</div>
                            <div class="stat-label" style="color: #6c757d; font-size: 12px;">Критические</div>
                        </div>
                        <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                            <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #fd7e14;">${results.summary.bySeverity.high}</div>
                            <div class="stat-label" style="color: #6c757d; font-size: 12px;">Высокие</div>
                        </div>
                        <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                            <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #ffc107;">${results.summary.bySeverity.medium}</div>
                            <div class="stat-label" style="color: #6c757d; font-size: 12px;">Средние</div>
                        </div>
                        <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                            <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #28a745;">${results.summary.bySeverity.low}</div>
                            <div class="stat-label" style="color: #6c757d; font-size: 12px;">Низкие</div>
                        </div>
                        <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                            <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #6c757d;">${results.summary.bySeverity.info}</div>
                            <div class="stat-label" style="color: #6c757d; font-size: 12px;">Инфо</div>
                        </div>
                    </div>
                    
                    <h4 style="margin: 20px 0 16px 0; color: #212529;">Критические и высокие уязвимости (${criticalHigh.length})</h4>
                    
                    <div id="vulnerabilities-list">
                        ${criticalHighHtml}
                    </div>
                </div>
                
                <div class="modal-footer" style="
                    padding: 16px 24px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    background: white;
                ">
                    <button id="downloadReportBtn" style="
                        background: #10b981;
                        color: white;
                        border: none;
                        padding: 10px 24px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.2s;
                        font-family: 'Ubuntu';
                    ">
                        <i class="fas fa-download"></i> Скачать отчет
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        
        const self = this;

        const closePopup = () => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s';
            setTimeout(() => {
                overlay.remove();
                self.fullReset();
            }, 200);
        };

        const downloadReport = () => {
            try {
                const reportData = JSON.stringify(results, null, 2);
                const blob = new Blob([reportData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sast-report-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                showToolNotification('Отчет успешно скачан', 'success');
            } catch (error) {
                console.error('Ошибка при скачивании отчета:', error);
                showToolNotification('Ошибка при скачивании отчета', 'error');
            }
        };

        const closeBtn = overlay.querySelector('.modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closePopup);

        const closeFooterBtn = overlay.querySelector('.btn-close');
        if (closeFooterBtn) closeFooterBtn.addEventListener('click', closePopup);
        
        const downloadBtn = overlay.querySelector('#downloadReportBtn');
        if (downloadBtn) downloadBtn.addEventListener('click', downloadReport);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePopup();
        });
    }
}

// Инициализация
function initApp() {
    window.herculesApp = new HerculesMainApp();
    
    if (!document.getElementById('slideInStyle')) {
        const style = document.createElement('style');
        style.id = 'slideInStyle';
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from {
                    transform: translateY(20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            @keyframes modalFadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Глобальные функции
window.removeFile = function() {
    const fileInfo = document.getElementById('fileInfo');
    const startBtn = document.getElementById('start-btn');
    
    if (fileInfo) fileInfo.classList.remove('active');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.classList.remove('active');
    }
    if (window.herculesApp) {
        window.herculesApp.selectedFile = null;
        window.herculesApp.currentArchiveId = null;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}