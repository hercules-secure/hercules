
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


async function uploadArchive(file) {
    
    const formData = new FormData();
    formData.append('archive', file);

    const response = await fetch('/api/archive/upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка загрузки файла');
    }

    const data = await response.json();
    
    if (!data.archive || !data.archive.id) {
        alert('Некорректный ответ сервера:', data);
        throw new Error('Сервер вернул некорректные данные');
    }
    
    return data.archive;
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

function setActiveTool(element, toolName) {
    document.querySelectorAll('.tool-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');
}

function showToolNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1001;
        animation: slideIn 0.3s ease;
        font-family: 'Ubuntu', sans-serif;
        font-size: 14px;
        max-width: 90vw;
        word-wrap: break-word;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 2000);
}

// Переключение между режимами
window.switchMode = function(mode) {
    const uploadMode = document.getElementById('upload-mode');
    const urlMode = document.getElementById('url-mode');
    const modeUploadBtn = document.getElementById('mode-upload');
    const modeUrlBtn = document.getElementById('mode-url');
    
    if (mode === 'upload') {
        uploadMode.style.display = 'block';
        urlMode.style.display = 'none';
        modeUploadBtn.classList.add('active');
        modeUrlBtn.classList.remove('active');
        window.herculesApp.currentMode = 'upload';
    } else {
        uploadMode.style.display = 'none';
        urlMode.style.display = 'block';
        modeUrlBtn.classList.add('active');
        modeUploadBtn.classList.remove('active');
        window.herculesApp.currentMode = 'url';
    }
    
    // Сбрасываем кнопку анализа
    window.herculesApp?.resetAnalysis();
};

// Удаление выбранного файла
window.removeFile = function() {
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const startBtn = document.getElementById('start-btn');
    
    fileInput.value = '';
    fileInfo.classList.remove('active');
    startBtn.disabled = true;
    startBtn.classList.remove('active');
    window.herculesApp.selectedFile = null;
};

// Основная логика
class HerculesMainApp {
    constructor() {
        this.repoInput = document.getElementById('repo');
        this.startButton = document.getElementById('start-btn');
        this.urlValidation = document.getElementById('url-validation');
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.fetchRepoBtn = document.getElementById('fetch-repo-btn');
        
        this.selectedFile = null;
        this.currentMode = 'upload';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    setupEventListeners() {
        // Обработчики для загрузки файла
        if (this.uploadArea) {
            this.uploadArea.addEventListener('click', () => this.fileInput.click());
        }

        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Обработчики для URL режима
        if (this.repoInput) {
            this.repoInput.addEventListener('input', (e) => this.validateURL(e));
            this.repoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && this.startButton.classList.contains('active')) {
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

    setupDragAndDrop() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        this.uploadArea.addEventListener('dragenter', () => {
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            this.uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    handleFile(file) {
        // Проверка размера (100 МБ)
        if (file.size > 100 * 1024 * 1024) {
            showToolNotification('Файл слишком большой (макс. 100 МБ)');
            return;
        }

        // Проверка расширения
        const validExtensions = ['.zip', '.tar', '.gz', '.tgz', '.7z'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        if (!validExtensions.includes(ext) && !file.name.endsWith('.tar.gz')) {
            showToolNotification('Неподдерживаемый формат архива');
            return;
        }

        this.selectedFile = file;
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        this.fileInfo.classList.add('active');
        
        // Активируем кнопку анализа
        this.startButton.disabled = false;
        this.startButton.classList.add('active');
        
        // Переключаемся в режим загрузки
        this.currentMode = 'upload';
        showToolNotification(`Выбран файл: ${file.name}`);
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    }

    // Упрощенная проверка URL
    isValidRepositoryUrl(url) {
        if (!url) return false;
        
        // Простая проверка: должен содержать http:// или https://
        // и быть похожим на Git репозиторий
        const isValid = (
            (url.startsWith('http://') || url.startsWith('https://')) &&
            (url.includes('github.com') || url.includes('gitlab') || url.includes('.git'))
        );
        
        return isValid;
    }

    async fetchRepoArchive() {
        const url = this.repoInput.value.trim();
        
        if (!this.isValidRepositoryUrl(url)) {
            this.showValidationMessage('Введите корректную ссылку на репозиторий', 'invalid');
            return;
        }

        this.fetchRepoBtn.disabled = true;
        this.fetchRepoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';

        try {
            const response = await fetch('/api/sast/url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Ошибка загрузки' }));
                throw new Error(error.message || 'Ошибка загрузки');
            }

            const data = await response.json();
            
            // Показываем информацию о загруженном архиве
            this.fileName.textContent = data.archive.filename;
            this.fileSize.textContent = this.formatFileSize(data.archive.size);
            this.fileInfo.classList.add('active');
            
            this.startButton.disabled = false;
            this.startButton.classList.add('active');
            
            showToolNotification('Архив успешно загружен');
        } catch (error) {
            // Показываем специальное сообщение о недоступности репозитория
            this.showRepositoryUnavailableMessage(url);
        } finally {
            this.fetchRepoBtn.disabled = false;
            this.fetchRepoBtn.innerHTML = 'Скачать архив';
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
                    <button id="switch-to-upload-btn" style="
                        background: #10b981;
                        color: white;
                        border: none;
                        padding: clamp(10px, 2.5vw, 14px) clamp(16px, 4vw, 24px);
                        border-radius: 8px;
                        font-family: 'Ubuntu', sans-serif;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-size: clamp(12px, 3vw, 14px);
                        flex: 1;
                        min-width: 140px;
                    ">
                        <i class="fas fa-upload" style="margin-right: 8px;"></i>
                        Загрузить архив
                    </button>
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

        // Обработчик для переключения на режим загрузки
        const switchBtn = overlay.querySelector('#switch-to-upload-btn');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                overlay.remove();
                // Переключаем на режим загрузки файла
                window.switchMode('upload');
                showToolNotification('Выберите архив для загрузки');
            });
        }

        // Обработчик закрытия
        const closeBtn = overlay.querySelector('#close-unavailable-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 300);
            });
        }

        // Закрытие по клику на оверлей
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 300);
            }
        });
    }

    // Упрощенная валидация URL
    validateURL(e) {
        const url = this.repoInput.value.trim();
        
        if (!url) {
            this.setButtonState(false);
            this.showValidationMessage('', '');
            return;
        }

        const isValid = (
            (url.startsWith('http://') || url.startsWith('https://')) &&
            (url.includes('github.com') || url.includes('gitlab') || url.includes('.git'))
        );
        
        if (!isValid) {
            this.setButtonState(false);
            this.showValidationMessage('Введите корректную ссылку на Git репозиторий', 'invalid');
        } else {
            this.setButtonState(true);
            this.showValidationMessage('Ссылка корректна', 'valid');
        }
    }

    setButtonState(enabled) {
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

 async startAnalysis() {
    if (!this.startButton.classList.contains('active')) {
        return;
    }

    const originalText = this.startButton.textContent;
    
    this.startButton.textContent = 'Анализ запущен...';
    this.startButton.disabled = true;

    try {
        // Задача 1.1 - Получение архива
        this.updateTaskStatus('1.1', 'in-progress');
        this.animateProgress('1.1', 100, 3000, async () => {
            
            let archiveData = null;
            
            try {
                // Загрузка архива в зависимости от режима
                if (this.currentMode === 'url') {
                    const url = this.repoInput.value.trim();
                    if (!url) throw new Error('Введите ссылку на репозиторий');
                    archiveData = await fetchArchiveFromUrl(url);
                } else {
                    if (!this.selectedFile) throw new Error('Выберите файл для загрузки');
                    archiveData = await uploadArchive(this.selectedFile);
                }

                // ВАЖНО: Проверяем, что архив загружен и имеет ID
                if (!archiveData) {
                    throw new Error('Не удалось загрузить архив');
                }
                
                if (!archiveData.id) {
                    throw new Error('Архив загружен, но ID не получен');
                }
                
                // Завершаем задачу 1.1
                this.updateTaskStatus('1.1', 'completed');

                // Задача 2.1 и 2.2 - Распаковка и анализ
                this.updateTaskStatus('2.1', 'in-progress');
                this.updateTaskStatus('2.2', 'in-progress');
                
                // Запускаем SAST анализ с полученным ID
                const sastResults = await this.runSASTAnalysis(archiveData.id);
                
                this.updateTaskStatus('2.1', 'completed');
                this.updateTaskStatus('2.2', 'completed');
                this.startButton.textContent = 'Анализ завершен';
                
                // Показываем результаты в POPUP окне
                this.showSASTResultsPopup(sastResults);
                showToolNotification('Анализ успешно завершен');

            } catch (error) {
                alert('Произошла ошибка:');
                this.updateTaskStatus('1.1', 'pending');
                this.updateTaskStatus('2.1', 'pending');
                this.updateTaskStatus('2.2', 'pending');
                
                showToolNotification(error.message || 'Ошибка при анализе');
                this.resetButton(originalText);
            }
        });

    } catch (error) {
        showToolNotification('Ошибка при анализе');
        this.resetButton(originalText);
    }
}

async runSASTAnalysis(archiveId) {

    if (!archiveId || archiveId === 'undefined' || archiveId === 'null') {
        throw new Error(`Неверный ID архива: ${archiveId}`);
    }
    
    this.animateProgress('2.1', 50, 1000, () => {});
    this.animateProgress('2.2', 30, 1000, () => {});

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

        this.animateProgress('2.1', 100, 500, () => {});
        this.animateProgress('2.2', 100, 500, () => {});
        
        return data.results;
        
    } catch (error) {
        console.error('❌ Ошибка в runSASTAnalysis:', error);
        throw error;
    }
}

    loadResultsFromStorage() {
        const saved = localStorage.getItem('sast-results');
        if (!saved) {
            return null;
        }
        
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
            showToolNotification('Результаты очищены');
        }
    }


    getShortPath(fullPath) {
        if (!fullPath) return 'unknown';
        
        const path = fullPath.replace(/\\/g, '/');
        const parts = path.split('/');
        
        if (parts.length <= 3) {
            return path;
        }
    
        const shortPath = parts.slice(-3).join('/');
        return '.../' + shortPath;
    }


    fullReset() {
        
        // Сброс выбранного файла
        this.selectedFile = null;
        
        // Сброс статусов задач
        this.updateTaskStatus('1.1', 'pending');
        this.updateTaskStatus('2.1', 'pending');
        this.updateTaskStatus('2.2', 'pending');
        
        // Сброс прогресс-баров
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            const progressEl = card.querySelector('.progress');
            if (progressEl) {
                progressEl.style.width = '0%';
            }
        });
        
        // Сброс кнопки старта
        if (this.startButton) {
            this.startButton.textContent = 'Начать анализ';
            this.startButton.disabled = true;
            this.startButton.classList.remove('active');
        }
        
        // Очистка информации о файле
        if (this.fileInfo) {
            this.fileInfo.classList.remove('active');
        }
        if (this.fileInput) {
            this.fileInput.value = '';
        }
        
        // Очистка URL репозитория
        if (this.repoInput) {
            this.repoInput.value = '';
            this.showValidationMessage('', '');
        }
        
        
    }

    showSASTResultsPopup(results) {
        // Сохраняем результаты в localStorage
        this.saveResultsToStorage(results);
        
        // Разделяем результаты по критичности
        const criticalHigh = results.results.filter(r => 
            r.severity === 'critical' || r.severity === 'high'
        );
        
        // Создаем оверлей
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: none;
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

        // Формируем HTML для CRITICAL и HIGH
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
                     Результаты анализа исходного кода
                    </h3>
                    <span class="modal-close" style="cursor: pointer; font-size: 24px; color: white; line-height: 1;">&times;</span>
                </div>
                
                <div class="modal-body" style="padding: 24px; overflow-y: auto; flex: 1; background: #f8f9fa;">
                    <!-- Статистика -->
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
                    <button class="btn-close" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 10px 24px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.2s;
                        font-family: 'Ubuntu';
                    ">Закрыть</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        
        // Сохраняем ссылку на this
        const self = this;
        
        // Анимация появления
        setTimeout(() => {
            overlay.style.display = 'flex';
        }, 10);

        // Функция закрытия с полным сбросом
        const closePopup = () => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s';
            setTimeout(() => {
                overlay.remove();
                // Полный сброс после закрытия модалки
                self.fullReset();
            }, 200);
        };

        const closeBtn = overlay.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closePopup);
        }

        const closeFooterBtn = overlay.querySelector('.btn-close');
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', closePopup);
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePopup();
        });
    }

    generatePDF(fullResults, criticalHigh) {
        // Показываем индикатор загрузки
        const loadingIndicator = document.createElement('div');
        loadingIndicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 25px 50px;
            border-radius: 12px;
            z-index: 10001;
            font-size: 18px;
            font-weight: 500;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            min-width: 300px;
            text-align: center;
        `;
        loadingIndicator.innerHTML = `
            <div style="font-size: 32px; margin-bottom: 10px;">📄</div>
            <div>Генерация PDF...</div>
            <div style="font-size: 14px; opacity: 0.8;">Пожалуйста, подождите</div>
            <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin-top: 10px;">
                <div style="width: 60%; height: 100%; background: #10b981; border-radius: 2px; animation: loading 1.5s infinite;"></div>
            </div>
            <style>
                @keyframes loading {
                    0% { width: 0%; }
                    50% { width: 100%; }
                    100% { width: 0%; }
                }
            </style>
        `;
        document.body.appendChild(loadingIndicator);

        setTimeout(() => {
            try {
                const pdfContainer = document.createElement('div');
                pdfContainer.id = 'pdf-container';
                pdfContainer.style.cssText = `
                    position: fixed;
                    left: 0;
                    top: 0;
                    width: 800px;
                    background: white;
                    padding: 40px;
                    font-family: 'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    z-index: -9999;
                    opacity: 0;
                    pointer-events: none;
                `;

                const severityColors = {
                    critical: '#dc2626',
                    high: '#f97316',
                    medium: '#fbbf24',
                    low: '#10b981',
                    info: '#6b7280'
                };

                const severityNames = {
                    critical: 'Критический',
                    high: 'Высокий',
                    medium: 'Средний',
                    low: 'Низкий',
                    info: 'Информационный'
                };

                pdfContainer.innerHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body {
                                font-family: 'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                margin: 0;
                                padding: 0;
                                background: white;
                                color: #1f2937;
                            }
                            .report {
                                max-width: 720px;
                                margin: 0 auto;
                            }
                            h1 {
                                color: #111827;
                                font-size: 32px;
                                margin: 0 0 10px 0;
                                font-weight: 700;
                            }
                            h2 {
                                color: #4b5563;
                                font-size: 18px;
                                font-weight: 400;
                                margin: 0 0 30px 0;
                            }
                            h3 {
                                color: #374151;
                                font-size: 18px;
                                font-weight: 600;
                                margin: 0 0 15px 0;
                            }
                            .header {
                                text-align: center;
                                border-bottom: 3px solid #111827;
                                padding-bottom: 20px;
                                margin-bottom: 30px;
                            }
                            .info-block {
                                background: #f9fafb;
                                padding: 20px;
                                border-radius: 12px;
                                margin-bottom: 30px;
                            }
                            .info-table {
                                width: 100%;
                                border-collapse: collapse;
                            }
                            .info-table td {
                                padding: 8px 0;
                                border-bottom: 1px solid #e5e7eb;
                            }
                            .info-table td:first-child {
                                font-weight: 600;
                                width: 150px;
                                color: #4b5563;
                            }
                            .stats-grid {
                                display: grid;
                                grid-template-columns: repeat(2, 1fr);
                                gap: 20px;
                                margin-bottom: 30px;
                            }
                            .stat-card {
                                background: #f9fafb;
                                border-radius: 12px;
                                padding: 20px;
                                text-align: center;
                            }
                            .stat-card.critical { border-top: 4px solid #dc2626; }
                            .stat-card.high { border-top: 4px solid #f97316; }
                            .stat-number {
                                font-size: 48px;
                                font-weight: 700;
                                margin: 10px 0;
                            }
                            .stat-label {
                                color: #6b7280;
                                font-size: 14px;
                            }
                            .finding {
                                background: #f9fafb;
                                border-radius: 8px;
                                padding: 20px;
                                margin-bottom: 20px;
                                page-break-inside: avoid;
                            }
                            .finding-header {
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                margin-bottom: 15px;
                                flex-wrap: wrap;
                                gap: 10px;
                            }
                            .severity-badge {
                                display: inline-block;
                                padding: 4px 12px;
                                border-radius: 16px;
                                font-size: 12px;
                                font-weight: 600;
                                color: white;
                                margin-right: 10px;
                            }
                            .file-info {
                                color: #9ca3af;
                                font-size: 12px;
                                font-family: monospace;
                            }
                            .rule-id {
                                font-family: monospace;
                                font-size: 12px;
                                color: #6b7280;
                                background: #f3f4f6;
                                padding: 2px 8px;
                                border-radius: 4px;
                                margin-left: 10px;
                            }
                            .message {
                                color: #1f2937;
                                font-weight: 500;
                                margin: 0 0 15px 0;
                            }
                            .code {
                                background: #1f2937;
                                color: #e5e7eb;
                                padding: 15px;
                                border-radius: 6px;
                                font-family: monospace;
                                font-size: 13px;
                                overflow-x: auto;
                                margin: 0 0 15px 0;
                                white-space: pre-wrap;
                                word-wrap: break-word;
                            }
                            .recommendation {
                                background: #ecfdf5;
                                color: #059669;
                                padding: 12px;
                                border-radius: 6px;
                                font-size: 13px;
                            }
                            .footer {
                                margin-top: 40px;
                                padding-top: 20px;
                                border-top: 1px solid #e5e7eb;
                                text-align: center;
                                font-size: 12px;
                                color: #9ca3af;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="report">
                            <div class="header">
                                <h1>Hercules SAST</h1>
                                <h2>Отчет о критических и высоких уязвимостях</h2>
                            </div>

                            <div class="info-block">
                                <h3 style="margin-top: 0;">📋 Информация об анализе</h3>
                                <table class="info-table">
                                      <tr><td>Дата:</td><td>${new Date().toLocaleString('ru-RU')}</td></tr>
                                     <tr><td>Цель:</td><td>${fullResults.metadata?.target || 'Не указано'}</td></tr>
                                     <tr><td>Всего правил:</td><td>${fullResults.metadata?.codeRulesCount || 0}</td></tr>
                                 </table>
                            </div>

                            <div class="stats-grid">
                                <div class="stat-card critical">
                                    <div class="stat-number" style="color: #dc2626;">${fullResults.summary.bySeverity.critical}</div>
                                    <div class="stat-label">Критических уязвимостей</div>
                                </div>
                                <div class="stat-card high">
                                    <div class="stat-number" style="color: #f97316;">${fullResults.summary.bySeverity.high}</div>
                                    <div class="stat-label">Высоких уязвимостей</div>
                                </div>
                            </div>

                            <h3 style="margin-bottom: 20px;">Детальные результаты</h3>
                            
                            ${criticalHigh.length > 0 ? criticalHigh.map(item => {
                                const shortPath = this.getShortPath(item.file);
                                return `
                                <div class="finding">
                                    <div class="finding-header">
                                        <div>
                                            <span class="severity-badge" style="background: ${severityColors[item.severity]}">
                                                ${severityNames[item.severity]}
                                            </span>
                                            <span class="file-info"> ${shortPath}:${item.line || '?'}</span>
                                            <span class="rule-id">${item.ruleId || 'unknown'}</span>
                                        </div>
                                    </div>
                                    <div class="message">${item.message}</div>
                                    <pre class="code">${item.code ? item.code.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}</pre>
                                    <div class="recommendation"> ${item.recommendation || 'Рекомендация не указана'}</div>
                                </div>
                            `}).join('') : `
                                <div style="text-align: center; padding: 60px; background: #f9fafb; border-radius: 8px;">
                                    <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
                                    <div style="font-size: 18px; color: #10b981; font-weight: 500;">Критических и высоких уязвимостей не найдено</div>
                                </div>
                            `}

                            <div class="footer">
                                <p>Сгенерировано с помощью Hercules SAST</p>
                                <p>© ${new Date().getFullYear()} Hercules. Все права защищены.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                document.body.appendChild(pdfContainer);

                const opt = {
                    margin: [0.5, 0.5, 0.5, 0.5],
                    filename: `sast-report-${new Date().toISOString().split('T')[0]}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { 
                        scale: 2, 
                        letterRendering: true,
                        useCORS: true,
                        allowTaint: false,
                        logging: false,
                        windowWidth: 800
                    },
                    jsPDF: { 
                        unit: 'in', 
                        format: 'a4', 
                        orientation: 'portrait'
                    },
                    pagebreak: { mode: ['css', 'legacy'] }
                };

                html2pdf().from(pdfContainer).set(opt).save()
                    .then(() => {
                        document.body.removeChild(loadingIndicator);
                        document.body.removeChild(pdfContainer);
                    })
                    .catch(error => {
                        document.body.removeChild(loadingIndicator);
                        document.body.removeChild(pdfContainer);
                        alert('Ошибка при генерации PDF. Пожалуйста, проверьте консоль браузера (F12) для деталей.');
                    });

            } catch (error) {
                document.body.removeChild(loadingIndicator);
                alert('Ошибка при генерации PDF: ' + error.message);
            }
        }, 100);
    }

    showSASTResults(results) {
        
        const event = new CustomEvent('showSASTResults', { detail: results });
        document.dispatchEvent(event);
        
        showToolNotification(`Найдено проблем: ${results.summary.total}`);
    }

    showAnalysisResults(archiveData) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
            animation: fadeIn 0.3s ease;
            padding: 16px;
        `;

        const sizeMB = (archiveData.size / 1024 / 1024).toFixed(2);
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                padding: clamp(24px, 6vw, 40px);
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                animation: slideUp 0.4s ease;
            ">
                <div style="display: flex; align-items: center; gap: clamp(12px, 3vw, 16px); margin-bottom: clamp(20px, 5vw, 24px); flex-wrap: wrap;">
                    <div style="
                        width: clamp(50px, 12vw, 60px);
                        height: clamp(50px, 12vw, 60px);
                        background: #10b981;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: clamp(24px, 6vw, 30px);
                        color: white;
                        flex-shrink: 0;
                    ">✅</div>
                    <div>
                        <h2 style="margin: 0 0 5px 0; color: #1a1f36; font-size: clamp(18px, 4.5vw, 20px);">Анализ завершен</h2>
                        <p style="margin: 0; color: #6b7280; font-size: clamp(12px, 3vw, 14px);">Архив успешно обработан</p>
                    </div>
                </div>
                
                <div style="background: #f9fafb; border-radius: 12px; padding: clamp(16px, 4vw, 20px); margin-bottom: clamp(20px, 5vw, 24px);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <span style="color: #6b7280; font-size: clamp(12px, 3vw, 14px);">ID архива:</span>
                        <span style="font-family: monospace; font-weight: 600; font-size: clamp(11px, 2.8vw, 13px); word-break: break-all;">${archiveData.id}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <span style="color: #6b7280; font-size: clamp(12px, 3vw, 14px);">Источник:</span>
                        <span style="font-weight: 600; font-size: clamp(12px, 3vw, 14px);">${archiveData.source === 'upload' ? '📁 Локальный файл' : '🌐 ' + archiveData.source}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <span style="color: #6b7280; font-size: clamp(12px, 3vw, 14px);">Имя файла:</span>
                        <span style="font-family: monospace; font-size: clamp(11px, 2.8vw, 13px); word-break: break-all;">${archiveData.filename}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <span style="color: #6b7280; font-size: clamp(12px, 3vw, 14px);">Размер:</span>
                        <span style="font-weight: 600; font-size: clamp(12px, 3vw, 14px);">${sizeMB} МБ</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                        <span style="color: #6b7280; font-size: clamp(12px, 3vw, 14px);">Время:</span>
                        <span style="font-size: clamp(11px, 2.8vw, 13px);">${new Date(archiveData.createdAt).toLocaleString()}</span>
                    </div>
                </div>

                <div style="display: flex; gap: clamp(8px, 2vw, 12px); flex-wrap: wrap;">
                    <button id="view-results-btn" style="
                        flex: 2;
                        background: #10b981;
                        color: white;
                        border: none;
                        padding: clamp(12px, 3vw, 14px) clamp(16px, 4vw, 24px);
                        border-radius: 8px;
                        font-family: 'Ubuntu', sans-serif;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-size: clamp(12px, 3vw, 14px);
                        min-width: 140px;
                    ">Посмотреть результаты</button>
                    <button id="close-modal-btn" style="
                        flex: 1;
                        background: #64748b;
                        color: white;
                        border: none;
                        padding: clamp(12px, 3vw, 14px) clamp(16px, 4vw, 24px);
                        border-radius: 8px;
                        font-family: 'Ubuntu', sans-serif;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-size: clamp(12px, 3vw, 14px);
                        min-width: 100px;
                    ">Закрыть</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#view-results-btn').addEventListener('click', () => {
            modal.remove();
            const results = this.loadResultsFromStorage();
            if (results) {
                this.showSASTResultsPopup(results);
            }
        });

        const closeModal = () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.remove();
                this.resetButton('Начать анализ');
                this.resetAnalysis();
            }, 300);
        };

        modal.querySelector('#close-modal-btn').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    showSASTResultsFromStorage() {
        const results = this.loadResultsFromStorage();
        if (!results) return;
        
        this.showSASTResultsPopup(results);
    }

    showSASTResults(archiveId) {
        showToolNotification('Получение результатов анализа...');
        
        setTimeout(() => {
            showToolNotification('Результаты получены');
        }, 1500);
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
        }
    }

    animateProgress(taskId, targetPercent, duration, callback) {
        const taskElement = this.findTaskElement(taskId);
        if (!taskElement) {
            callback?.();
            return;
        }

        const progressElement = taskElement.querySelector('.progress');
        if (!progressElement) {
            callback?.();
            return;
        }

        const startTime = Date.now();
        const initialWidth = parseFloat(progressElement.style.width) || 0;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentWidth = initialWidth + (targetPercent - initialWidth) * easedProgress;
            
            progressElement.style.width = `${currentWidth}%`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                progressElement.style.width = `${targetPercent}%`;
                callback?.();
            }
        };

        animate();
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
        this.startButton.textContent = originalText;
        this.startButton.disabled = false;
        this.startButton.classList.add('active');
    }

    resetAnalysis() {
        this.selectedFile = null;
        if (this.fileInfo) {
            this.fileInfo.classList.remove('active');
        }
        if (this.fileInput) {
            this.fileInput.value = '';
        }
        if (this.repoInput) {
            this.repoInput.value = '';
            this.showValidationMessage('', '');
        }
        
        this.startButton.disabled = true;
        this.startButton.classList.remove('active');
        
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}