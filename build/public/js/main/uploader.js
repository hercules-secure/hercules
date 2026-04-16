// client/js/uploader.js

class FileUploader {
    constructor(options = {}) {
        this.options = {
            acceptArchive: '.zip,.tar,.gz,.tgz,.7z',
            acceptFolder: true,
            compressOnClient: true,
            maxSize: 100 * 1024 * 1024,
            onFileSelected: null,
            onFolderSelected: null,
            onProgress: null,
            onError: null,
            ...options
        };
        
        this.initializeInputs();
    }

    initializeInputs() {
        this.archiveInput = document.createElement('input');
        this.archiveInput.type = 'file';
        this.archiveInput.accept = this.options.acceptArchive;
        this.archiveInput.style.display = 'none';
        document.body.appendChild(this.archiveInput);
        
        if (this.options.acceptFolder) {
            this.folderInput = document.createElement('input');
            this.folderInput.type = 'file';
            this.folderInput.webkitdirectory = true;
            this.folderInput.directory = true;
            this.folderInput.style.display = 'none';
            document.body.appendChild(this.folderInput);
        }
        
        this.bindEvents();
    }

    bindEvents() {
        this.archiveInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleArchiveSelected(e.target.files[0]);
            }
            this.archiveInput.value = '';
        });
        
        if (this.folderInput) {
            this.folderInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length) {
                    this.handleFolderSelected(e.target.files);
                }
                this.folderInput.value = '';
            });
        }
    }

    attachToElement(element, options = {}) {
        if (!element) return;
        
        const menuPosition = options.menuPosition || 'bottom';
        
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMenu(element, menuPosition);
        });
        
        this.attachedElement = element;
    }

    showMenu(targetElement, position = 'bottom') {
        this.removeMenu();
        
        this.menu = document.createElement('div');
        this.menu.className = 'file-uploader-menu';
        this.menu.innerHTML = `
            <div class="uploader-menu-item" data-type="archive">
                <i class="fas fa-file-archive" style="color: orange"></i>
                <div>
                    <div class="uploader-menu-title">Загрузить архив</div>
                </div>
            </div>
            <div class="uploader-menu-item" data-type="folder">
                <i class="fas fa-folder-open" style="color: #8e9016; font-size: 18px"></i>
                <div>
                    <div class="uploader-menu-title">Локальный проект</div>
                </div>
            </div>
        `;
        
        this.menu.style.cssText = `
            position: absolute;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
            padding: 8px 0;
            min-width: 280px;
            z-index: 10000;
            border: 1px solid #e2e8f0;
            font-family: 'Ubuntu', sans-serif;
        `;
        
        const rect = targetElement.getBoundingClientRect();
        this.menu.style.top = rect.bottom + 8 + 'px';
        this.menu.style.left = rect.left + 'px';
        
        this.addMenuStyles();
        
        this.menu.querySelector('[data-type="archive"]').addEventListener('click', () => {
            this.selectArchive();
            this.removeMenu();
        });
        
        this.menu.querySelector('[data-type="folder"]').addEventListener('click', () => {
            this.selectFolder();
            this.removeMenu();
        });
        
        const closeHandler = (e) => {
            if (this.menu && !this.menu.contains(e.target) && e.target !== targetElement) {
                this.removeMenu();
                document.removeEventListener('click', closeHandler);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
        }, 10);
        
        document.body.appendChild(this.menu);
    }

    addMenuStyles() {
        if (document.getElementById('uploader-menu-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'uploader-menu-styles';
        style.textContent = `
            .file-uploader-menu {
                animation: uploaderFadeIn 0.2s ease;
            }
            @keyframes uploaderFadeIn {
                from { opacity: 0; transform: translateY(-8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .uploader-menu-item {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 12px 20px;
                cursor: pointer;
                transition: background 0.2s;
            }
            .uploader-menu-item:hover {
                background: #f8fafc;
            }
            .uploader-menu-item i {
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }
            .uploader-menu-title {
                font-weight: 600;
                font-size: 14px;
                color: #1e293b;
            }
        `;
        document.head.appendChild(style);
    }

    removeMenu() {
        if (this.menu) {
            this.menu.remove();
            this.menu = null;
        }
    }

    selectArchive() {
        this.archiveInput.click();
    }

    selectFolder() {
        if (this.folderInput) {
            this.folderInput.click();
        } else {
            if (this.options.onError) {
                this.options.onError('Выбор папки не поддерживается в этом браузере');
            }
        }
    }

    handleArchiveSelected(file) {
        if (file.size > this.options.maxSize) {
            const error = `Файл слишком большой. Максимальный размер: ${this.options.maxSize / 1024 / 1024} MB`;
            if (this.options.onError) this.options.onError(error);
            return;
        }
        
        // Запускаем прогресс при выборе файла
        if (this.options.onProgress) {
            this.options.onProgress('Загрузка архива...', 0);
        }
        
        if (this.options.onFileSelected) {
            this.options.onFileSelected(file);
        }
    }

    async handleFolderSelected(files) {
        const folderName = files[0].webkitRelativePath.split('/')[0];
        const folderInfo = {
            name: folderName,
            files: Array.from(files),
            fileCount: files.length
        };
        
        if (this.options.compressOnClient) {
            // Запускаем прогресс архивации
            if (this.options.onProgress) {
                this.options.onProgress('Подготовка файлов...', 0);
            }
            
            try {
                const zipBlob = await this.createZipArchive(folderInfo, (percent) => {
                    if (this.options.onProgress) {
                        if (percent < 100) {
                            this.options.onProgress(`Архивация папки... ${percent}%`, percent);
                        } else {
                            this.options.onProgress('Архивация завершена', 100);
                        }
                    }
                });
                
                const archiveFile = new File([zipBlob], `${folderName}.zip`, { type: 'application/zip' });
                
                if (this.options.onFileSelected) {
                    this.options.onFileSelected(archiveFile);
                }
            } catch (error) {
                if (this.options.onError) {
                    this.options.onError('Ошибка архивации: ' + error.message);
                }
            }
        } else {
            if (this.options.onFolderSelected) {
                this.options.onFolderSelected(folderInfo);
            }
        }
    }

    async createZipArchive(folderInfo, onProgress) {
        const zip = new JSZip();
        
        const ignoredNames = ['node_modules', '.git', '.DS_Store', 'Thumbs.db', '__pycache__', '.idea', '.vscode'];
        const ignoredExtensions = ['.log', '.tmp', '.swp', '.cache'];
        
        let processed = 0;
        const total = folderInfo.files.length;
        
        // Первый этап: фильтрация и добавление файлов (50%)
        for (const file of folderInfo.files) {
            const pathParts = file.webkitRelativePath.split('/');
            let shouldSkip = false;
            
            for (const part of pathParts) {
                if (ignoredNames.includes(part)) {
                    shouldSkip = true;
                    break;
                }
            }
            
            const ext = file.name.split('.').pop().toLowerCase();
            if (ignoredExtensions.includes(`.${ext}`)) {
                shouldSkip = true;
            }
            
            if (!shouldSkip) {
                const content = await file.arrayBuffer();
                zip.file(file.webkitRelativePath, content);
            }
            
            processed++;
            if (onProgress) {
                const stagePercent = Math.round((processed / total) * 50);
                onProgress(stagePercent);
            }
        }
        
        // Второй этап: генерация ZIP (от 50% до 100%)
        if (onProgress) {
            onProgress(50);
        }
        
        const zipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
            onProgress: (metadata) => {
                if (onProgress) {
                    const percent = 50 + Math.round(metadata.percent / 2);
                    onProgress(percent);
                }
            }
        });
        
        if (onProgress) {
            onProgress(100);
        }
        
        return zipBlob;
    }

    getArchiveFormData(file, additionalData = {}) {
        const formData = new FormData();
        formData.append('archive', file);
        
        for (const [key, value] of Object.entries(additionalData)) {
            formData.append(key, value);
        }
        
        return formData;
    }

    async uploadToServer(url, formData, onProgress = null) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.open('POST', url);
            
            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
                        onProgress(percent);
                    }
                });
            }
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                    if (onProgress) onProgress(100);
                    try {
                        const response = JSON.parse(xhr.response);
                        resolve(response);
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            };
            
            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(formData);
        });
    }

    destroy() {
        this.removeMenu();
        
        if (this.archiveInput) this.archiveInput.remove();
        if (this.folderInput) this.folderInput.remove();
        
        this.archiveInput = null;
        this.folderInput = null;
        this.attachedElement = null;
        this.options = null;
    }
}

// ========== ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ ПРОГРЕССА НА UI ==========

function updateSCAProgress(message, percent) {
    // Обновляем прогресс-бары в UI
    const progressBar1 = document.querySelector('#sca-progress-1');
    const progressBar2 = document.querySelector('#sca-progress-2');
    const status1 = document.querySelector('#sca-status-1');
    const status2 = document.querySelector('#sca-status-2');
    
    if (percent < 30) {
        if (progressBar1) progressBar1.style.width = `${percent * 3}%`;
        if (status1) status1.textContent = message;
    } else if (percent < 70) {
        if (progressBar1) progressBar1.style.width = '100%';
        if (status1) status1.textContent = 'Файлы подготовлены';
        if (progressBar2) progressBar2.style.width = `${(percent - 30) * 2.5}%`;
        if (status2) status2.textContent = message;
    } else {
        if (progressBar2) progressBar2.style.width = `${(percent - 30) * 2.5}%`;
        if (status2) status2.textContent = message;
    }
    
    if (percent === 100) {
        if (status1) status1.textContent = 'Завершено';
        if (status2) status2.textContent = 'Завершено';
    }
}

function updateUploadProgress(percent) {
    const uploadProgress = document.querySelector('#upload-progress');
    if (uploadProgress) {
        uploadProgress.style.width = `${percent}%`;
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ДЛЯ SCA ==========

function initSCAUploader() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    const uploader = new FileUploader({
        compressOnClient: true,
        onProgress: (message, percent) => {
            // Обновляем прогресс в UI
            const progressFill = document.querySelector('.progress');
            if (progressFill) {
                progressFill.style.width = `${percent}%`;
            }
            
            const statusElement = document.querySelector('.task-status.in-progress');
            if (statusElement && percent < 100) {
                statusElement.textContent = `${message} ${percent}%`;
            }
            
            console.log(`📊 Прогресс: ${percent}% - ${message}`);
        },
        onFileSelected: (file) => {
            showToolNotification(`Загрузка: ${file.name}`, 'info');
            
            const formData = uploader.getArchiveFormData(file, { type: 'sca' });
            uploader.uploadToServer('/api/sca/upload', formData, (percent) => {
                // Обновляем прогресс во время загрузки на сервер
                const progressFill = document.querySelector('.progress');
                if (progressFill) {
                    progressFill.style.width = `${percent}%`;
                }
            }).then(result => {
                showToolNotification('Анализ завершен!', 'success');
                
                if (typeof handleReportData === 'function') {
                    handleReportData(result);
                }
            }).catch(error => {
                console.error('Ошибка:', error);
                showToolNotification('Ошибка: ' + error.message, 'error');
            });
        },
        onError: (error) => {
            showToolNotification(error, 'error');
        }
    });
    
    uploader.attachToElement(uploadArea, { menuPosition: 'bottom' });
    
    return uploader;
}

// ========== ИНИЦИАЛИЗАЦИЯ ДЛЯ SAST ==========
// client/js/uploader.js

function initSCAUploader() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    const uploader = new FileUploader({
        compressOnClient: true,
        onFileSelected: (file) => {
            showToolNotification(`Загрузка и анализ: ${file.name}...`);
            
            // Шаг 1.1 - подготовка (заполняем сразу)
            if (window.herculesApp) {
                window.herculesApp.updateTaskStatus('1.1', 'in-progress');
                window.herculesApp.animateProgress('1.1', 100, 800, () => {
                    window.herculesApp.updateTaskStatus('1.1', 'completed');
                });
            }
            
            const formData = uploader.getArchiveFormData(file, { type: 'sca' });
            uploader.uploadToServer('/api/sca/upload', formData).then(result => {
                // Шаг 2.1 - формирование списка зависимостей (после ответа сервера)
                if (window.herculesApp) {
                    window.herculesApp.updateTaskStatus('2.1', 'in-progress');
                    window.herculesApp.animateProgress('2.1', 100, 1500, () => {
                        window.herculesApp.updateTaskStatus('2.1', 'completed');
                    });
                }
                
                // Небольшая задержка перед 2.2
                setTimeout(() => {
                    // Шаг 2.2 - анализ зависимостей
                    if (window.herculesApp) {
                        window.herculesApp.updateTaskStatus('2.2', 'in-progress');
                        window.herculesApp.animateProgress('2.2', 100, 1500, () => {
                            window.herculesApp.updateTaskStatus('2.2', 'completed');
                            window.herculesApp.startButton.textContent = 'Анализ завершен';
                            showToolNotification('Анализ успешно завершен');
                        });
                    }
                    
                    if (typeof handleReportData === 'function') {
                        handleReportData(result);
                    }
                }, 500);
                
            }).catch(error => {
                console.error('Ошибка:', error);
                showToolNotification('Ошибка: ' + error.message, 'error');
                if (window.herculesApp) {
                    window.herculesApp.updateTaskStatus('2.2', 'error');
                    window.herculesApp.resetButton();
                }
            });
        },
        onError: (error) => {
            showToolNotification(error, 'error');
        }
    });
    
    uploader.attachToElement(uploadArea, { menuPosition: 'bottom' });
    
    return uploader;
}

// ========== SAST UPLOADER ==========

function initSASTUploader() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    const uploader = new FileUploader({
        acceptArchive: '.zip,.tar,.gz,.tgz,.7z',
        maxSize: 200 * 1024 * 1024,
        onFileSelected: (file) => {
            showToolNotification(`SAST анализ: ${file.name}...`);
            
            // Шаг 1.1 - подготовка
            if (window.herculesApp) {
                window.herculesApp.updateTaskStatus('1.1', 'in-progress');
                window.herculesApp.animateProgress('1.1', 100, 800, () => {
                    window.herculesApp.updateTaskStatus('1.1', 'completed');
                });
            }
            
            const formData = uploader.getArchiveFormData(file, { type: 'sast' });
            uploader.uploadToServer('/api/sast/upload', formData).then(result => {
                // Шаг 2.1 - анализ кода
                if (window.herculesApp) {
                    window.herculesApp.updateTaskStatus('2.1', 'in-progress');
                    window.herculesApp.animateProgress('2.1', 100, 2000, () => {
                        window.herculesApp.updateTaskStatus('2.1', 'completed');
                    });
                }
                
                setTimeout(() => {
                    if (window.herculesApp) {
                        window.herculesApp.updateTaskStatus('2.2', 'completed');
                    }
                    
                    if (typeof displaySASTResults === 'function') {
                        displaySASTResults(result);
                    }
                    showToolNotification('SAST анализ завершен', 'success');
                }, 500);
                
            }).catch(error => {
                console.error('SAST ошибка:', error);
                showToolNotification('Ошибка: ' + error.message, 'error');
                if (window.herculesApp) {
                    window.herculesApp.updateTaskStatus('2.1', 'error');
                }
            });
        }
    });
    
    uploader.attachToElement(uploadArea);
    
    return uploader;
}

// ========== FUZZ UPLOADER ==========

function initFUZZUploader() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    const uploader = new FileUploader({
        acceptArchive: '.json,.yaml,.yml',
        acceptFolder: false,
        onFileSelected: (file) => {
            showToolNotification(`Фаззинг тестирование: ${file.name}...`);
            
            // Шаг 1.1 - подготовка
            if (window.herculesApp) {
                window.herculesApp.updateTaskStatus('1.1', 'in-progress');
                window.herculesApp.animateProgress('1.1', 100, 800, () => {
                    window.herculesApp.updateTaskStatus('1.1', 'completed');
                });
            }
            
            const formData = new FormData();
            formData.append('spec', file);
            formData.append('baseUrl', document.getElementById('apiUrl')?.value || '');
            
            fetch('/api/fuzz/analyze', {
                method: 'POST',
                body: formData
            }).then(res => res.json()).then(result => {
                // Шаг 2.1 - фаззинг
                if (window.herculesApp) {
                    window.herculesApp.updateTaskStatus('2.1', 'in-progress');
                    window.herculesApp.animateProgress('2.1', 100, 2000, () => {
                        window.herculesApp.updateTaskStatus('2.1', 'completed');
                    });
                }
                
                setTimeout(() => {
                    if (window.herculesApp) {
                        window.herculesApp.updateTaskStatus('2.2', 'completed');
                    }
                    
                    if (typeof displayFUZZResults === 'function') {
                        displayFUZZResults(result);
                    }
                    showToolNotification('Фаззинг завершен', 'success');
                }, 500);
                
            }).catch(error => {
                console.error('FUZZ ошибка:', error);
                showToolNotification('Ошибка: ' + error.message, 'error');
                if (window.herculesApp) {
                    window.herculesApp.updateTaskStatus('2.1', 'error');
                }
            });
        }
    });
    
    uploader.attachToElement(uploadArea);
    
    return uploader;
}

// Экспортируем
window.initSCAUploader = initSCAUploader;
window.initSASTUploader = initSASTUploader;
window.initFUZZUploader = initFUZZUploader;
window.FileUploader = FileUploader;