
function showToolNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
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
    }, 3000);
}

function setActiveTool(element, toolName) {
    document.querySelectorAll('.tool-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');
}

function updateTaskStatus(taskId, status) {
    const statusMap = {
        'pending': 'В ожидании',
        'in-progress': 'В работе',
        'completed': 'Завершено'
    };
    
    const taskElement = findTaskElement(taskId);
    if (taskElement) {
        const statusElement = taskElement.querySelector('.task-status');
        if (statusElement) {
            statusElement.textContent = statusMap[status] || status;
            statusElement.className = `task-status ${status}`;
        }
    }
}

function animateProgress(taskId, targetPercent, duration, callback) {
    const taskElement = findTaskElement(taskId);
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
            if (callback) callback();
        }
    };
    animate();
}

function findTaskElement(taskId) {
    const parts = taskId.split('.');
    const sectionIndex = parseInt(parts[0]) - 1;
    const taskIndex = parseInt(parts[1]) - 1;
    
    const sections = document.querySelectorAll('.card-section');
    if (sectionIndex >= sections.length) return null;
    
    const cards = sections[sectionIndex].querySelectorAll('.card');
    if (taskIndex >= cards.length) return null;
    
    return cards[taskIndex];
}

function clearRepoInput() {
    const repoInput = document.getElementById('repo');
    if (repoInput) {
        repoInput.value = '';
        const clearBtn = document.querySelector('.clear-input');
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        const event = new Event('input', { bubbles: true });
        repoInput.dispatchEvent(event);
    }
}

class ProgressReset {
    static resetAllProgress() {
        const taskStatuses = document.querySelectorAll('.task-status');
        taskStatuses.forEach(status => {
            status.textContent = 'В ожидании';
            status.className = 'task-status pending';
        });
        
        const progressBars = document.querySelectorAll('.progress');
        progressBars.forEach(bar => {
            bar.style.width = '0%';
        });
        
        const startButton = document.getElementById('start-btn');
        if (startButton) {
            startButton.textContent = 'Начать анализ';
            startButton.disabled = false;
            startButton.classList.add('active');
        }
    }
}

class TokenModal {
    constructor() {
        this.createModal();
        this.resolve = null;
    }

    createModal() {
        const oldModal = document.getElementById('tokenInputModal');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'tokenInputModal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            z-index: 20000;
            justify-content: center;
            align-items: center;
            font-family: 'Ubuntu';
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                max-width: 480px;
                width: 90%;
                padding: 0;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                animation: modalFadeIn 0.3s ease;
            ">
                <div style="
                    background: linear-gradient(135deg, #1a1a2a 0%, #0a0a0f 100%);
                    padding: 20px 24px;
                    border-radius: 16px 16px 0 0;
                    color: white;
                ">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <h3 style="margin: 0; font-size: 18px;">Требуется токен доступа</h3>
                    </div>
                </div>
                <div style="padding: 24px;">
                    <p style="margin-bottom: 16px; color: #374151;">
                        Для доступа к приватному репозиторию <strong id="modalRepoUrl" style="color: #667eea; word-break: break-all;"></strong> требуется персональный токен.
                    </p>
                    
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                        <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">
                            Как получить токен:
                        </p>
                        <ol style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 13px;">
                            <li>Перейдите в <strong>приватный репозиторий</strong></li>
                            <li>Создайте токен с правами <code>read_api</code> и <code>read_repository</code></li>
                            <li>Скопируйте полученный токен и вставьте ниже</li>
                        </ol>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 500; margin-bottom: 8px; color: #374151;">Ваш токен</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="password" id="tokenInputValue" placeholder="glpat-..." style="
                                flex: 1;
                                padding: 12px 16px;
                                border: 2px solid #e5e7eb;
                                border-radius: 10px;
                                font-size: 14px;
                                font-family: 'Ubuntu';
                                outline: none;
                                transition: all 0.2s;
                            ">
                            <button id="toggleTokenVisibility" style="
                                padding: 0 16px;
                                background: #f3f4f6;
                                border: 2px solid #e5e7eb;
                                border-radius: 10px;
                                cursor: pointer;
                                transition: all 0.2s;
                            ">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button id="cancelTokenBtn" style="
                            padding: 10px 20px;
                            background: #f3f4f6;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 500;
                            transition: all 0.2s;
                            font-family: 'Ubuntu';
                        ">Отмена</button>
                        <button id="submitTokenBtn" style="
                            padding: 10px 20px;
                            background: #667eea;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 500;
                            transition: all 0.2s;
                            font-family: 'Ubuntu';
                        ">
                            Сохранить и продолжить
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;
        this.initEventListeners();
    }

    initEventListeners() {
        const submitBtn = document.getElementById('submitTokenBtn');
        const cancelBtn = document.getElementById('cancelTokenBtn');
        const toggleBtn = document.getElementById('toggleTokenVisibility');
        const tokenInput = document.getElementById('tokenInputValue');

        if (submitBtn) {
            submitBtn.onclick = () => this.submit();
        }
        if (cancelBtn) {
            cancelBtn.onclick = () => this.cancel();
        }
        if (toggleBtn && tokenInput) {
            toggleBtn.onclick = () => {
                const type = tokenInput.type === 'password' ? 'text' : 'password';
                tokenInput.type = type;
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
                }
            };
        }
        if (tokenInput) {
            tokenInput.onkeypress = (e) => {
                if (e.key === 'Enter') this.submit();
            };
        }
    }

    show(repoUrl) {
        const repoUrlSpan = document.getElementById('modalRepoUrl');
        if (repoUrlSpan) {
            repoUrlSpan.textContent = repoUrl;
        }
        
        const tokenInput = document.getElementById('tokenInputValue');
        if (tokenInput) {
            tokenInput.value = '';
            tokenInput.type = 'password';
            const toggleIcon = document.getElementById('toggleTokenVisibility')?.querySelector('i');
            if (toggleIcon) toggleIcon.className = 'fas fa-eye';
        }
        
        this.modal.style.display = 'flex';
        
        setTimeout(() => {
            tokenInput?.focus();
        }, 100);
        
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    submit() {
        const tokenInput = document.getElementById('tokenInputValue');
        const token = tokenInput ? tokenInput.value.trim() : '';
        
        if (token && this.resolve) {
            this.resolve(token);
            this.hide();
        } else if (!token) {
            this.showError('Пожалуйста, введите токен');
        }
    }

    cancel() {
        if (this.resolve) {
            this.resolve(null);
        }
        this.hide();
    }

    hide() {
        this.modal.style.display = 'none';
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorDiv.style.cssText = `
            color: #ef4444;
            font-size: 12px;
            margin-top: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        `;
        
        const existingError = this.modal.querySelector('.token-error');
        if (existingError) existingError.remove();
        
        errorDiv.className = 'token-error';
        
        const inputContainer = document.querySelector('#tokenInputValue')?.parentElement;
        if (inputContainer) {
            inputContainer.after(errorDiv);
        }
        
        setTimeout(() => errorDiv.remove(), 3000);
    }
}

class AccessChecker {
    constructor() {
        this.tokenStorage = new TokenStorage();
    }

    async checkRepositoryAccess(url) {
        const platform = this.detectPlatform(url);
        
        if (platform === 'github') {
            return await this.checkGitHubAccess(url);
        } else if (platform === 'gitlab') {
            return await this.checkGitLabAccess(url);
        }
        
        return { accessible: false, requiresAuth: false, error: 'Неизвестная платформа' };
    }

    detectPlatform(url) {
        if (url.includes('github.com')) return 'github';
        if (url.includes('gitlab.com') || url.includes('ispras.ru')) return 'gitlab';
        if (url.includes('gitlab')) return 'gitlab';
        return 'unknown';
    }

    async checkGitLabAccess(url) {
        let match = url.match(/^(https?:\/\/)?([^\/]+)\/(.+)$/);
        if (!match) {
            return { accessible: false, requiresAuth: false, error: 'Неверный формат GitLab URL' };
        }
        
        const protocol = match[1] || 'https://';
        const host = match[2];
        let projectPath = match[3].replace(/\.git$/, '').replace(/\/$/, '');
        
        const baseUrl = `${protocol}${host}`;
        const encodedPath = encodeURIComponent(projectPath);
        const apiUrl = `${baseUrl}/api/v4/projects/${encodedPath}`;
        
        try {
            const response = await fetch(apiUrl, {
                headers: { 
                    'Accept': 'application/json',
                    'User-Agent': 'Hercules-SCA-Analyzer/1.0'
                }
            });

            if (response.status === 200) {
                const data = await response.json();
                return { 
                    accessible: true, 
                    requiresAuth: false, 
                    isPrivate: data.visibility === 'private',
                    platform: 'gitlab',
                    baseUrl: baseUrl,
                    projectPath: projectPath
                };
            } else if (response.status === 401 || response.status === 403 || response.status === 404) {
                const tokens = await this.tokenStorage.getToken(host);
                if (tokens) {
                    const authResponse = await fetch(apiUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'PRIVATE-TOKEN': tokens,
                            'User-Agent': 'Hercules-SCA-Analyzer/1.0'
                        }
                    });
                    
                    if (authResponse.status === 200) {
                        const data = await authResponse.json();
                        return { 
                            accessible: true, 
                            requiresAuth: true, 
                            token: tokens,
                            isPrivate: data.visibility === 'private',
                            platform: 'gitlab',
                            baseUrl: baseUrl,
                            projectPath: projectPath
                        };
                    }
                }
                
                return { 
                    accessible: false, 
                    requiresAuth: true, 
                    error: 'Репозиторий требует авторизации. Возможно, репозиторий приватный.',
                    platform: 'gitlab',
                    baseUrl: baseUrl,
                    projectPath: projectPath
                };
            } else {
                return { 
                    accessible: false, 
                    requiresAuth: false, 
                    error: `HTTP ошибка: ${response.status}`,
                    platform: 'gitlab',
                    baseUrl: baseUrl,
                    projectPath: projectPath
                };
            }
        } catch (error) {
            console.error('Ошибка проверки GitLab:', error);
            return { 
                accessible: false, 
                requiresAuth: false, 
                error: error.message,
                platform: 'gitlab',
                baseUrl: baseUrl,
                projectPath: projectPath
            };
        }
    }

    async checkGitHubAccess(url) {
    const match = url.match(/(?:github\.com[\/:]|^)([^\/]+)\/([^\/\.]+)/);
    if (!match) {
        return { accessible: false, requiresAuth: false, error: 'Неверный формат GitHub URL' };
    }
    
    const [, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo.replace('.git', '')}`;

    
    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Hercules-SCA-Analyzer'
            }
        });
        
        if (response.status === 200) {
            const data = await response.json();
            return { 
                accessible: true, 
                requiresAuth: false, 
                isPrivate: data.private === true,
                platform: 'github'
            };
        } else if (response.status === 401 || response.status === 403) {
            return { 
                accessible: false, 
                requiresAuth: true, 
                error: 'Репозиторий приватный, требуется авторизация',
                platform: 'github'
            };
        } else if (response.status === 404) {
            const savedToken = await this.tokenStorage.getToken('github.com');
            if (savedToken) {
                const authResponse = await fetch(apiUrl, {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': `token ${savedToken}`,
                        'User-Agent': 'Hercules-SCA-Analyzer'
                    }
                });
                
                if (authResponse.status === 200) {
                    const data = await authResponse.json();
                    return { 
                        accessible: true, 
                        requiresAuth: true, 
                        token: savedToken,
                        isPrivate: data.private === true,
                        platform: 'github'
                    };
                } else if (authResponse.status === 401 || authResponse.status === 403) {
                    await this.tokenStorage.deleteToken('github.com');
                }
            }

            return { 
                accessible: false, 
                requiresAuth: true, 
                error: 'Репозиторий не найден или требует авторизации. Возможно, репозиторий приватный.',
                platform: 'github'
            };
        } else {
            return { 
                accessible: false, 
                requiresAuth: false, 
                error: `HTTP ошибка: ${response.status}`,
                platform: 'github'
            };
        }
    } catch (error) {
        console.error('Ошибка проверки GitHub:', error);
        return { 
            accessible: false, 
            requiresAuth: false, 
            error: error.message,
            platform: 'github'
        };
    }
}
}

class TokenStorage {
    constructor() {
        this.storageKey = 'hercules_repo_tokens';
        this.useChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    }

    async getToken(domain) {
        if (this.useChromeStorage) {
            return new Promise((resolve) => {
                chrome.storage.local.get([this.storageKey], (result) => {
                    const tokens = result[this.storageKey] || {};
                    resolve(tokens[domain] || null);
                });
            });
        } else {
            try {
                const tokens = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
                return tokens[domain] || null;
            } catch (error) {
                console.error('Ошибка чтения токена из localStorage:', error);
                return null;
            }
        }
    }

    async setToken(domain, token) {
        if (this.useChromeStorage) {
            return new Promise((resolve) => {
                chrome.storage.local.get([this.storageKey], (result) => {
                    const tokens = result[this.storageKey] || {};
                    tokens[domain] = token;
                    chrome.storage.local.set({ [this.storageKey]: tokens }, resolve);
                });
            });
        } else {
            try {
                const tokens = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
                tokens[domain] = token;
                localStorage.setItem(this.storageKey, JSON.stringify(tokens));
                return Promise.resolve();
            } catch (error) {
                console.error('Ошибка сохранения токена в localStorage:', error);
                return Promise.reject(error);
            }
        }
    }

    async deleteToken(domain) {
        if (this.useChromeStorage) {
            return new Promise((resolve) => {
                chrome.storage.local.get([this.storageKey], (result) => {
                    const tokens = result[this.storageKey] || {};
                    delete tokens[domain];
                    chrome.storage.local.set({ [this.storageKey]: tokens }, resolve);
                });
            });
        } else {
            try {
                const tokens = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
                delete tokens[domain];
                localStorage.setItem(this.storageKey, JSON.stringify(tokens));
                return Promise.resolve();
            } catch (error) {
                console.error('Ошибка удаления токена из localStorage:', error);
                return Promise.reject(error);
            }
        }
    }
}
class HerculesMainApp {
    constructor() {
        this.repoInput = document.getElementById('repo');
        this.startButton = document.getElementById('start-btn');
        this.urlValidation = document.getElementById('url-validation');
        this.accessChecker = new AccessChecker();
        this.tokenStorage = new TokenStorage();
        this.tokenModal = new TokenModal();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.focusInput();
    }

    setupEventListeners() {
        if (this.repoInput) {
            this.repoInput.addEventListener('input', (e) => this.validateURL(e));
            this.repoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && this.startButton && !this.startButton.disabled) {
                    this.startAnalysis();
                }
            });
        }

        if (this.startButton) {
            this.startButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.startAnalysis();
            });
        }
    }

    focusInput() {
        if (this.repoInput) {
            setTimeout(() => this.repoInput.focus(), 100);
        }
    }

    isValidRepoURL(url) {
        if (!url) return false;
        
        let normalizedUrl = url.trim().replace(/\.git$/, '');
        const checkUrl = normalizedUrl.replace(/^https?:\/\//, '');
        
        const gitlabPattern = /^([a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,})\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(\/)?$/i;
        
        if (gitlabPattern.test(checkUrl)) {
            const domain = checkUrl.split('/')[0];
            if (domain.includes('gitlab') || domain.includes('ispras')) {
                return true;
            }
            return true;
        }
    
        const githubPattern = /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(\/)?$/i;
        if (githubPattern.test(normalizedUrl)) {
            return true;
        }
    
        const shortPattern = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;
        if (shortPattern.test(normalizedUrl)) {
            return true;
        }
        
        return false;
    }

    validateURL(e) {
        const url = this.repoInput.value.trim();
        
        if (!url) {
            this.setButtonState(false);
            this.showValidationMessage('Введите ссылку на репозиторий', '');
            return;
        }
        
        if (!this.isValidRepoURL(url)) {
            this.setButtonState(false);
            this.showValidationMessage('Введите корректную ссылку на репозиторий', 'invalid');
            this.repoInput.value = ""
        } else {
            this.setButtonState(true);
            this.showValidationMessage('', 'valid');
        }
    }

    setButtonState(enabled) {
        if (this.startButton) {
            this.startButton.disabled = !enabled;
            if (enabled) {
                this.startButton.classList.add('active');
            } else {
                this.startButton.classList.remove('active');
            }
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
        const url = this.repoInput.value.trim();
        
        if (this.startButton.disabled) {
            return;
        }

        this.startButton.textContent = 'Проверка доступа...';
        this.startButton.disabled = true;
        
        try {
            const accessResult = await this.accessChecker.checkRepositoryAccess(url);
            
            if (accessResult.accessible) {
                await this.performAnalysis(url);
            } else if (accessResult.requiresAuth) {
                const token = await this.tokenModal.show(url);
                if (token) {
                    const domain = accessResult.baseUrl || (accessResult.platform === 'github' ? 'github.com' : 'gitlab.com');
                    await this.tokenStorage.setToken(domain, token);
                    showToolNotification('Токен сохранен, повторяем попытку...');
                    await this.performAnalysis(url, token);
                } else {
                    alert('Доступ к репозиторию запрещен. Токен не предоставлен.');
                    this.resetButton();
                }
            } else {
                alert(`Ошибка доступа: ${accessResult.error || 'Не удалось получить доступ к репозиторию'}`);
                this.resetButton();
            }
            
        } catch (error) {
            console.error('Ошибка при проверке:', error);
            alert('Не удалось проверить доступ к репозиторию');
            this.resetButton();
        }
    }

    async performAnalysis(url, token = null) {
        try {
                this.updateTaskStatus('1.1', 'in-progress');
                this.animateProgress('1.1', 100, 1500, async () => {
                this.updateTaskStatus('1.1', 'completed');
                this.updateTaskStatus('2.1', 'in-progress');
                
                this.animateProgress('2.1', 100, 2000, async () => {
                this.updateTaskStatus('2.1', 'completed');
                this.updateTaskStatus('2.2', 'in-progress');
                    
                    try {
                        let formattedUrl = url;
                        if (!url.startsWith('http')) {
                            if (url.includes('/')) {
                                formattedUrl = `https://github.com/${url}`;
                            }
                        }
                        
                        const response = await fetch('/api/sca', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                url: formattedUrl,
                                token: token
                            })
                        });

                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            if (response.status === 401 || response.status === 403) {
                                const domain = url.includes('github.com') ? 'github.com' : 'gitlab.com';
                                await this.tokenStorage.deleteToken(domain);
                                throw new Error('Токен недействителен. Пожалуйста, введите новый токен.');
                            }
                            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                        }

                        const data = await response.json();
                        
                        this.animateProgress('2.2', 100, 1000, () => {
                            this.updateTaskStatus('2.2', 'completed');
                            this.startButton.textContent = 'Анализ завершен';
                            showToolNotification('Анализ успешно завершен');
                            handleReportData(data);
                        });
                        
                    } catch (error) {
                        console.error('Ошибка при запросе к серверу:', error);
                        
                        if (error.message.includes('Токен недействителен')) {
                            const newToken = await this.tokenModal.show(url);
                            if (newToken) {
                                const domain = url.includes('github.com') ? 'github.com' : 'gitlab.com';
                                await this.tokenStorage.setToken(domain, newToken);
                                await this.performAnalysis(url, newToken);
                                return;
                            }
                        }
                        
                        let errorMessage = 'Ошибка соединения с сервером';
                        if (error.message.includes('Failed to fetch')) {
                            errorMessage = 'Сервер недоступен';
                        } else if (error.message.includes('500')) {
                            errorMessage = 'Внутренняя ошибка сервера (500)';
                        } else if (error.message.includes('404')) {
                            errorMessage = '🔍 API эндпоинт не найден (404)';
                        } else {
                            errorMessage = error.message;
                        }
                        alert(errorMessage);
                        this.resetButton();
                        
                        this.updateTaskStatus('2.2', 'pending');
                        const taskElement = this.findTaskElement('2.2');
                        if (taskElement) {
                            const progressElement = taskElement.querySelector('.progress');
                            if (progressElement) {
                                progressElement.style.width = '0%';
                            }
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Ошибка при анализе:', error);
            alert('Произошла ошибка при анализе');
            this.resetButton();
        }
    }

    resetButton() {
        this.startButton.textContent = 'Начать анализ';
        this.startButton.disabled = false;
        this.startButton.classList.add('active');
    }

    updateTaskStatus(taskId, status) {
        const statusMap = { 'pending': 'В ожидании', 'in-progress': 'В работе', 'completed': 'Завершено' };
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
}
function initApp() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.herculesApp = new HerculesMainApp();
        });
    } else {
        window.herculesApp = new HerculesMainApp();
    }
}

initApp();

class SCAPopupReporter {
    constructor(reportData) {
        this.report = reportData;
        this.currentPage = 1;
        this.rowsPerPage = 10;
        this.filteredVulns = [];
        this.isMobile = window.innerWidth <= 768;
        if (this.isMobile) {
            this.rowsPerPage = 5;
        }
    }

    showPopup() {
        const overlay = document.createElement('div');
        overlay.className = 'sca-popup-overlay';
        const popup = document.createElement('div');
        popup.className = 'sca-popup';
        
        const styles = document.createElement('style');
        styles.textContent = `
            .sca-popup-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                font-family: Ubuntu;
                padding: 10px;
            }
            .sca-popup {
                background: white;
                width: 100%;
                max-width: 1200px;
                max-height: 90vh;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                animation: sca-slideIn 0.3s ease-out;
            }
            @keyframes sca-slideIn {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .sca-popup-header {
                padding: 20px;
                background: #1a1a2a;
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255,255,255,0.2);
            }
            .sca-popup-title {
                font-size: 20px;
                font-weight: 600;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .sca-popup-close {
                background: none;
                border: none;
                color: white;
                font-size: 28px;
                cursor: pointer;
                padding: 0;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.2s;
            }
            .sca-popup-close:hover {
                background: rgba(255,255,255,0.2);
            }
            .sca-popup-content {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
                background: #f5f5f5;
            }
            .sca-popup-footer {
                padding: 15px 20px;
                background: #f8f9fa;
                border-top: 1px solid #dee2e6;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            .sca-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                font-family: Ubuntu;
                cursor: pointer;
                transition: all 0.2s;
            }
            .sca-btn-primary {
                background: black;
                color: white;
            }
            .sca-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }
            .sca-stat-card {
                background: white;
                padding: 15px;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                text-align: center;
            }
            .sca-stat-number {
                font-size: 28px;
                font-weight: bold;
                color: #333;
            }
            .sca-stat-label {
                color: #666;
                font-size: 13px;
                margin-top: 5px;
            }
            .sca-vuln-table-container {
                background: white;
                border-radius: 10px;
                padding: 20px;
                margin: 20px 0;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                overflow-x: auto;
                font: normal 13px 'Ubuntu';
            }
            .sca-vuln-table {
                width: 100%;
                border-collapse: collapse;
                min-width: 500px;
                font: normal 15px 'Ubuntu';
            }
            .sca-vuln-table th {
                background: #f8f9fa;
                padding: 14px;
                text-align: left;
                font-weight: 600;
                border-bottom: 2px solid #dee2e6;
            }
            .sca-vuln-table td {
                padding: 12px;
                border-bottom: 1px solid #dee2e6;
            }
            .sca-severity-CRITICAL { color: #dc3545; font-weight: bold; }
            .sca-severity-HIGH { color: #fd7e14; font-weight: bold; }
            .sca-severity-MODERATE { color: #ffc107; font-weight: bold; }
            .sca-severity-LOW { color: #28a745; font-weight: bold; }
            .sca-cve-link {
                color: #0066cc;
                text-decoration: none;
            }
            .sca-cve-link:hover {
                text-decoration: underline;
            }
            .sca-pagination {
                display: flex;
                justify-content: center;
                gap: 8px;
                margin-top: 20px;
                flex-wrap: wrap;
            }
            .sca-page-btn {
                padding: 6px 12px;
                border: 1px solid #dee2e6;
                background: white;
                border-radius: 4px;
                cursor: pointer;
            }
            .sca-page-btn.active {
                background: #1a1a2a;
                color: white;
                border-color: #1a1a2a;
            }
        `;
        
        const stats = this.extractStats();
        const vulnerabilities = this.extractVulnerabilities();
        
        popup.innerHTML = `
            <div class="sca-popup-header">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
                     Результаты анализа
                    </h3>
                <button class="sca-popup-close" id="closePopup">&times;</button>
            </div>
            <div class="sca-popup-content">
                <div class="sca-stats-grid">
                    <div class="sca-stat-card">
                        <div class="sca-stat-number">${stats.components}</div>
                        <div class="sca-stat-label">Компонентов</div>
                    </div>
                    <div class="sca-stat-card">
                        <div class="sca-stat-number">${stats.vulnerabilities}</div>
                        <div class="sca-stat-label">Уязвимостей</div>
                    </div>
                    <div class="sca-stat-card">
                        <div class="sca-stat-number" style="color:red">${stats.critical}</div>
                        <div class="sca-stat-label">Критических</div>
                    </div>
                    <div class="sca-stat-card">
                        <div class="sca-stat-number" style="color:orange">${stats.high}</div>
                        <div class="sca-stat-label">Высоких</div>
                    </div>
                </div>
                
                <div class="sca-vuln-table-container">
                    <h3 style="margin-bottom: 15px">Найденные уязвимости</h3>
                    ${vulnerabilities.length > 0 ? `
                    <table class="sca-vuln-table">
                        <thead>
                            <tr><th>Компонент</th><th>CVE ID</th><th>Описание</th><th>Серьезность</th></tr>
                            </thead>
                            <tbody>
                                ${vulnerabilities.map(v => `
                                    <tr>
                                        <td>${v.component} (${v.version})</td>
                                        <td><a href="${v.url}" target="_blank" class="sca-cve-link">${v.id}</a></td>
                                        <td style="font:normal 15px 'Ubuntu'">${v.description}</td>
                                        <td class="sca-severity-${v.severity}">${v.severity}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<div style="text-align:center;padding:40px;">Уязвимостей не найдено</div>'}
                </div>
            </div>
            <div class="sca-popup-footer">
                <button id="downloadReport" style="
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
                    <i class="fas fa-download"></i> Скачать JSON
                </button>
            </div>
        `;
        
        document.head.appendChild(styles);
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        
        this.addEventListeners(overlay);
    }
    
    extractStats() {
        let components = 0;
        let vulnerabilities = 0;
        let critical = 0, high = 0, moderate = 0, low = 0;
        
        if (this.report.components) {
            components = this.report.components.length;
        }
        
        if (this.report.vulnerabilities) {
            vulnerabilities = this.report.vulnerabilities.length;
            for (const v of this.report.vulnerabilities) {
                const severity = v.ratings?.[0]?.severity || v.severity || 'UNKNOWN';
                if (severity === 'CRITICAL') critical++;
                else if (severity === 'HIGH') high++;
                else if (severity === 'MODERATE') moderate++;
                else if (severity === 'LOW') low++;
            }
        }
        
        return { components, vulnerabilities, critical, high, moderate, low };
    }
    
    extractVulnerabilities() {
        if (!this.report.vulnerabilities) return [];
        

        return this.report.vulnerabilities.map(v => ({
            id: v.id || 'N/A',
            component: v.component.name,
            version: v.component.version,
            severity: v.ratings?.[0]?.severity || v.severity || 'UNKNOWN',
            url: v.source?.url || `https://osv.dev/vulnerability/${v.id}`,
            description: v.description || ''
        }));
    }

    
addEventListeners(overlay) {
    const closePopupBtn = overlay.querySelector('#closePopup');
    const closePopupBtn2 = overlay.querySelector('#closePopupBtn');
    
    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', () => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }

            if (typeof ProgressReset !== 'undefined') {
                ProgressReset.resetAllProgress();
            }

            if (typeof HerculesMainApp !== 'undefined' && HerculesMainApp.clearRepoInput) {
                HerculesMainApp.clearRepoInput();
            }
        });
    }
    
    if (closePopupBtn2) {
        closePopupBtn2.addEventListener('click', () => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            if (typeof ProgressReset !== 'undefined') {
                ProgressReset.resetAllProgress();
            }
            if (typeof HerculesMainApp !== 'undefined' && HerculesMainApp.clearRepoInput) {
                HerculesMainApp.clearRepoInput();
            }
        });
    }
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            if (typeof ProgressReset !== 'undefined') {
                ProgressReset.resetAllProgress();
            }
            if (typeof HerculesMainApp !== 'undefined' && HerculesMainApp.clearRepoInput) {
                HerculesMainApp.clearRepoInput();
            }
        }
    });
    
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
                if (typeof ProgressReset !== 'undefined') {
                    ProgressReset.resetAllProgress();
                }
                if (typeof HerculesMainApp !== 'undefined' && HerculesMainApp.clearRepoInput) {
                    HerculesMainApp.clearRepoInput();
                }
                document.removeEventListener('keydown', escHandler);
            }
        }
    };
    document.addEventListener('keydown', escHandler);
    
    const downloadBtn = overlay.querySelector('#downloadReport');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => this.downloadReport());
    }
}
    
    downloadReport() {
        const dataStr = JSON.stringify(this.report, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sca-report-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }
}
function handleReportData(reportData) {
    if (!reportData) {
        alert('Ошибка: нет данных для отображения');
        return;
    }
    try {
        const reporter = new SCAPopupReporter(reportData);
        reporter.showPopup();
    } catch (error) {
        console.error('Error in handleReportData:', error);
        alert('Ошибка при отображении отчета: ' + error.message);
    }
}



window.showToolNotification = showToolNotification;
window.setActiveTool = setActiveTool;
window.updateTaskStatus = updateTaskStatus;
window.animateProgress = animateProgress;
window.findTaskElement = findTaskElement;
window.clearRepoInput = clearRepoInput;
