function showToolNotification(message, type) {
    type = type || 'success';
    var notification = document.createElement('div');
    notification.innerHTML = message;
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
    setTimeout(function() {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(function() {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function setActiveTool(element, toolName) {
    var items = document.querySelectorAll('.tool-item');
    for (var i = 0; i < items.length; i++) {
        items[i].classList.remove('active');
    }
    element.classList.add('active');
}

function updateTaskStatus(taskId, status) {
    var statusMap = {
        'pending': 'В ожидании',
        'in-progress': 'В работе',
        'completed': 'Завершено'
    };
    
    var taskElement = findTaskElement(taskId);
    if (taskElement) {
        var statusElement = taskElement.querySelector('.task-status');
        if (statusElement) {
            statusElement.textContent = statusMap[status] || status;
            statusElement.className = 'task-status ' + status;
        }
    }
}

function animateProgress(taskId, targetPercent, duration, callback) {
    var taskElement = findTaskElement(taskId);
    if (!taskElement) {
        if (callback) callback();
        return;
    }

    var progressElement = taskElement.querySelector('.progress');
    if (!progressElement) {
        if (callback) callback();
        return;
    }

    var startTime = Date.now();
    var initialWidth = parseFloat(progressElement.style.width) || 0;

    function animate() {
        var elapsed = Date.now() - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var easedProgress = 1 - Math.pow(1 - progress, 3);
        var currentWidth = initialWidth + (targetPercent - initialWidth) * easedProgress;
        progressElement.style.width = currentWidth + '%';

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            progressElement.style.width = targetPercent + '%';
            if (callback) callback();
        }
    }
    animate();
}

function findTaskElement(taskId) {
    var parts = taskId.split('.');
    var sectionIndex = parseInt(parts[0]) - 1;
    var taskIndex = parseInt(parts[1]) - 1;
    
    var sections = document.querySelectorAll('.card-section');
    if (sectionIndex >= sections.length) return null;
    
    var cards = sections[sectionIndex].querySelectorAll('.card');
    if (taskIndex >= cards.length) return null;
    
    return cards[taskIndex];
}

function clearRepoInput() {
    var repoInput = document.getElementById('repo');
    if (repoInput) {
        repoInput.value = '';
        var clearBtn = document.querySelector('.clear-input');
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        var event = new Event('input', { bubbles: true });
        repoInput.dispatchEvent(event);
    }
}

var ProgressReset = {
    resetAllProgress: function() {
        var taskStatuses = document.querySelectorAll('.task-status');
        taskStatuses.forEach(function(status) {
            status.textContent = 'В ожидании';
            status.className = 'task-status pending';
        });
        
        var progressBars = document.querySelectorAll('.progress');
        progressBars.forEach(function(bar) {
            bar.style.width = '0%';
        });
        
        var startButton = document.getElementById('start-btn');
        if (startButton) {
            startButton.textContent = 'Начать анализ';
            startButton.disabled = false;
            startButton.classList.add('active');
        }
    }
};

var TokenModal = function() {
    this.createModal();
    this.resolve = null;
};

TokenModal.prototype.createModal = function() {
    var oldModal = document.getElementById('tokenInputModal');
    if (oldModal) oldModal.remove();

    var modal = document.createElement('div');
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
};

TokenModal.prototype.initEventListeners = function() {
    var self = this;
    var submitBtn = document.getElementById('submitTokenBtn');
    var cancelBtn = document.getElementById('cancelTokenBtn');
    var toggleBtn = document.getElementById('toggleTokenVisibility');
    var tokenInput = document.getElementById('tokenInputValue');

    if (submitBtn) {
        submitBtn.onclick = function() { self.submit(); };
    }
    if (cancelBtn) {
        cancelBtn.onclick = function() { self.cancel(); };
    }
    if (toggleBtn && tokenInput) {
        toggleBtn.onclick = function() {
            var type = tokenInput.type === 'password' ? 'text' : 'password';
            tokenInput.type = type;
            var icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
            }
        };
    }
    if (tokenInput) {
        tokenInput.onkeypress = function(e) {
            if (e.key === 'Enter') self.submit();
        };
    }
};

TokenModal.prototype.show = function(repoUrl) {
    var self = this;
    var repoUrlSpan = document.getElementById('modalRepoUrl');
    if (repoUrlSpan) {
        repoUrlSpan.textContent = repoUrl;
    }
    
    var tokenInput = document.getElementById('tokenInputValue');
    if (tokenInput) {
        tokenInput.value = '';
        tokenInput.type = 'password';
        var toggleIcon = document.getElementById('toggleTokenVisibility');
        if (toggleIcon) {
            var icon = toggleIcon.querySelector('i');
            if (icon) icon.className = 'fas fa-eye';
        }
    }
    
    this.modal.style.display = 'flex';
    
    setTimeout(function() {
        if (tokenInput) tokenInput.focus();
    }, 100);
    
    return new Promise(function(resolve) {
        self.resolve = resolve;
    });
};

TokenModal.prototype.submit = function() {
    var tokenInput = document.getElementById('tokenInputValue');
    var token = tokenInput ? tokenInput.value.trim() : '';
    
    if (token && this.resolve) {
        this.resolve(token);
        this.hide();
    } else if (!token) {
        this.showError('Пожалуйста, введите токен');
    }
};

TokenModal.prototype.cancel = function() {
    if (this.resolve) {
        this.resolve(null);
    }
    this.hide();
};

TokenModal.prototype.hide = function() {
    this.modal.style.display = 'none';
};

TokenModal.prototype.showError = function(message) {
    var errorDiv = document.createElement('div');
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        color: #ef4444;
        font-size: 12px;
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
    `;
    
    var existingError = this.modal.querySelector('.token-error');
    if (existingError) existingError.remove();
    
    errorDiv.className = 'token-error';
    
    var inputContainer = document.querySelector('#tokenInputValue');
    if (inputContainer && inputContainer.parentElement) {
        inputContainer.parentElement.after(errorDiv);
    }
    
    setTimeout(function() {
        if (errorDiv.parentNode) errorDiv.remove();
    }, 3000);
};

var AccessChecker = function() {
    this.tokenStorage = new TokenStorage();
};

AccessChecker.prototype.checkRepositoryAccess = function(url) {
    var platform = this.detectPlatform(url);
    
    if (platform === 'github') {
        return this.checkGitHubAccess(url);
    } else if (platform === 'gitlab') {
        return this.checkGitLabAccess(url);
    }
    
    return Promise.resolve({ accessible: false, requiresAuth: false, error: 'Неизвестная платформа' });
};

AccessChecker.prototype.detectPlatform = function(url) {
    if (url.includes('github.com')) return 'github';
    if (url.includes('gitlab.com') || url.includes('ispras.ru')) return 'gitlab';
    if (url.includes('gitlab')) return 'gitlab';
    return 'unknown';
};

AccessChecker.prototype.checkGitLabAccess = function(url) {
    var self = this;
    var match = url.match(/^(https?:\/\/)?([^\/]+)\/(.+)$/);
    if (!match) {
        return Promise.resolve({ accessible: false, requiresAuth: false, error: 'Неверный формат GitLab URL' });
    }
    
    var protocol = match[1] || 'https://';
    var host = match[2];
    var projectPath = match[3].replace(/\.git$/, '').replace(/\/$/, '');
    
    var baseUrl = protocol + host;
    var encodedPath = encodeURIComponent(projectPath);
    var apiUrl = baseUrl + '/api/v4/projects/' + encodedPath;
    
    return fetch(apiUrl, {
        headers: { 
            'Accept': 'application/json',
            'User-Agent': 'Hercules-SCA-Analyzer/1.0'
        }
    }).then(function(response) {
        if (response.status === 200) {
            return response.json().then(function(data) {
                return { 
                    accessible: true, 
                    requiresAuth: false, 
                    isPrivate: data.visibility === 'private',
                    platform: 'gitlab',
                    baseUrl: baseUrl,
                    projectPath: projectPath
                };
            });
        } else if (response.status === 401 || response.status === 403 || response.status === 404) {
            return self.tokenStorage.getToken(host).then(function(tokens) {
                if (tokens) {
                    return fetch(apiUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'PRIVATE-TOKEN': tokens,
                            'User-Agent': 'Hercules-SCA-Analyzer/1.0'
                        }
                    }).then(function(authResponse) {
                        if (authResponse.status === 200) {
                            return authResponse.json().then(function(data) {
                                return { 
                                    accessible: true, 
                                    requiresAuth: true, 
                                    token: tokens,
                                    isPrivate: data.visibility === 'private',
                                    platform: 'gitlab',
                                    baseUrl: baseUrl,
                                    projectPath: projectPath
                                };
                            });
                        }
                        return { 
                            accessible: false, 
                            requiresAuth: true, 
                            error: 'Репозиторий требует авторизации. Возможно, репозиторий приватный.',
                            platform: 'gitlab',
                            baseUrl: baseUrl,
                            projectPath: projectPath
                        };
                    });
                }
                return { 
                    accessible: false, 
                    requiresAuth: true, 
                    error: 'Репозиторий требует авторизации. Возможно, репозиторий приватный.',
                    platform: 'gitlab',
                    baseUrl: baseUrl,
                    projectPath: projectPath
                };
            });
        } else {
            return { 
                accessible: false, 
                requiresAuth: false, 
                error: 'HTTP ошибка: ' + response.status,
                platform: 'gitlab',
                baseUrl: baseUrl,
                projectPath: projectPath
            };
        }
    }).catch(function(error) {
        return { 
            accessible: false, 
            requiresAuth: false, 
            error: error.message,
            platform: 'gitlab',
            baseUrl: baseUrl,
            projectPath: projectPath
        };
    });
};

AccessChecker.prototype.checkGitHubAccess = function(url) {
    var self = this;
    var match = url.match(/(?:github\.com[\/:]|^)([^\/]+)\/([^\/\.]+)/);
    if (!match) {
        return Promise.resolve({ accessible: false, requiresAuth: false, error: 'Неверный формат GitHub URL' });
    }
    
    var owner = match[1];
    var repo = match[2].replace('.git', '');
    var apiUrl = 'https://api.github.com/repos/' + owner + '/' + repo;

    return fetch(apiUrl, {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Hercules-SCA-Analyzer'
        }
    }).then(function(response) {
        if (response.status === 200) {
            return response.json().then(function(data) {
                return { 
                    accessible: true, 
                    requiresAuth: false, 
                    isPrivate: data.private === true,
                    platform: 'github'
                };
            });
        } else if (response.status === 401 || response.status === 403) {
            return { 
                accessible: false, 
                requiresAuth: true, 
                error: 'Репозиторий приватный, требуется авторизация',
                platform: 'github'
            };
        } else if (response.status === 404) {
            return self.tokenStorage.getToken('github.com').then(function(savedToken) {
                if (savedToken) {
                    return fetch(apiUrl, {
                        headers: {
                            'Accept': 'application/vnd.github.v3+json',
                            'Authorization': 'token ' + savedToken,
                            'User-Agent': 'Hercules-SCA-Analyzer'
                        }
                    }).then(function(authResponse) {
                        if (authResponse.status === 200) {
                            return authResponse.json().then(function(data) {
                                return { 
                                    accessible: true, 
                                    requiresAuth: true, 
                                    token: savedToken,
                                    isPrivate: data.private === true,
                                    platform: 'github'
                                };
                            });
                        } else if (authResponse.status === 401 || authResponse.status === 403) {
                            return self.tokenStorage.deleteToken('github.com').then(function() {
                                return { 
                                    accessible: false, 
                                    requiresAuth: true, 
                                    error: 'Репозиторий не найден или требует авторизации. Возможно, репозиторий приватный.',
                                    platform: 'github'
                                };
                            });
                        }
                        return { 
                            accessible: false, 
                            requiresAuth: true, 
                            error: 'Репозиторий не найден или требует авторизации. Возможно, репозиторий приватный.',
                            platform: 'github'
                        };
                    });
                }
                return { 
                    accessible: false, 
                    requiresAuth: true, 
                    error: 'Репозиторий не найден или требует авторизации. Возможно, репозиторий приватный.',
                    platform: 'github'
                };
            });
        } else {
            return { 
                accessible: false, 
                requiresAuth: false, 
                error: 'HTTP ошибка: ' + response.status,
                platform: 'github'
            };
        }
    }).catch(function(error) {
        return { 
            accessible: false, 
            requiresAuth: false, 
            error: error.message,
            platform: 'github'
        };
    });
};

var TokenStorage = function() {
    this.storageKey = 'hercules_repo_tokens';
    this.useChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
};

TokenStorage.prototype.getToken = function(domain) {
    var self = this;
    if (this.useChromeStorage) {
        return new Promise(function(resolve) {
            chrome.storage.local.get([self.storageKey], function(result) {
                var tokens = result[self.storageKey] || {};
                resolve(tokens[domain] || null);
            });
        });
    } else {
        try {
            var tokens = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            return Promise.resolve(tokens[domain] || null);
        } catch (error) {
            return Promise.resolve(null);
        }
    }
};

TokenStorage.prototype.setToken = function(domain, token) {
    var self = this;
    if (this.useChromeStorage) {
        return new Promise(function(resolve) {
            chrome.storage.local.get([self.storageKey], function(result) {
                var tokens = result[self.storageKey] || {};
                tokens[domain] = token;
                chrome.storage.local.set({ [self.storageKey]: tokens }, resolve);
            });
        });
    } else {
        try {
            var tokens = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            tokens[domain] = token;
            localStorage.setItem(this.storageKey, JSON.stringify(tokens));
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }
};

TokenStorage.prototype.deleteToken = function(domain) {
    var self = this;
    if (this.useChromeStorage) {
        return new Promise(function(resolve) {
            chrome.storage.local.get([self.storageKey], function(result) {
                var tokens = result[self.storageKey] || {};
                delete tokens[domain];
                chrome.storage.local.set({ [self.storageKey]: tokens }, resolve);
            });
        });
    } else {
        try {
            var tokens = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            delete tokens[domain];
            localStorage.setItem(this.storageKey, JSON.stringify(tokens));
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }
};

var HerculesMainApp = function() {
    this.repoInput = document.getElementById('repo');
    this.startButton = document.getElementById('start-btn');
    this.urlValidation = document.getElementById('url-validation');
    this.accessChecker = new AccessChecker();
    this.tokenStorage = new TokenStorage();
    this.tokenModal = new TokenModal();
    
    this.init();
};

HerculesMainApp.prototype.init = function() {
    this.setupEventListeners();
    this.focusInput();
};

HerculesMainApp.prototype.setupEventListeners = function() {
    var self = this;
    if (this.repoInput) {
        this.repoInput.addEventListener('input', function(e) { self.validateURL(e); });
        this.repoInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && self.startButton && !self.startButton.disabled) {
                self.startAnalysis();
            }
        });
    }

    if (this.startButton) {
        this.startButton.addEventListener('click', function(e) {
            e.preventDefault();
            self.startAnalysis();
        });
    }
};

HerculesMainApp.prototype.focusInput = function() {
    var self = this;
    if (this.repoInput) {
        setTimeout(function() { self.repoInput.focus(); }, 100);
    }
};

HerculesMainApp.prototype.isValidRepoURL = function(url) {
    if (!url) return false;
    
    var normalizedUrl = url.trim().replace(/\.git$/, '');
    var checkUrl = normalizedUrl.replace(/^https?:\/\//, '');
    
    var gitlabPattern = /^([a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,})\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(\/)?$/i;
    if (gitlabPattern.test(checkUrl)) {
        return true;
    }
    
    var githubPattern = /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(\/)?$/i;
    if (githubPattern.test(normalizedUrl)) {
        return true;
    }
    
    var shortPattern = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;
    if (shortPattern.test(normalizedUrl)) {
        return true;
    }
    
    return false;
};

HerculesMainApp.prototype.validateURL = function(e) {
    var url = this.repoInput.value.trim();
    
    if (!url) {
        this.setButtonState(false);
        this.showValidationMessage('Введите ссылку на репозиторий', '');
        return;
    }
    
    if (!this.isValidRepoURL(url)) {
        this.setButtonState(false);
        this.showValidationMessage('Введите корректную ссылку на репозиторий', 'invalid');
        this.repoInput.value = "";
    } else {
        this.setButtonState(true);
        this.showValidationMessage('', 'valid');
    }
};

HerculesMainApp.prototype.setButtonState = function(enabled) {
    if (this.startButton) {
        this.startButton.disabled = !enabled;
        if (enabled) {
            this.startButton.classList.add('active');
        } else {
            this.startButton.classList.remove('active');
        }
    }
};

HerculesMainApp.prototype.showValidationMessage = function(message, type) {
    if (!this.urlValidation) return;
    this.urlValidation.textContent = message;
    this.urlValidation.className = 'url-validation';
    if (type === 'valid') {
        this.urlValidation.classList.add('valid');
    } else if (type === 'invalid') {
        this.urlValidation.classList.add('invalid');
    }
};

HerculesMainApp.prototype.startAnalysis = function() {
    var self = this;
    var url = this.repoInput.value.trim();
    
    if (this.startButton.disabled) {
        return;
    }

    this.startButton.textContent = 'Проверка доступа...';
    this.startButton.disabled = true;
    
    this.accessChecker.checkRepositoryAccess(url).then(function(accessResult) {
        if (accessResult.accessible) {
            self.performAnalysis(url);
        } else if (accessResult.requiresAuth) {
            self.tokenModal.show(url).then(function(token) {
                if (token) {
                    var domain = accessResult.baseUrl || (accessResult.platform === 'github' ? 'github.com' : 'gitlab.com');
                    self.tokenStorage.setToken(domain, token).then(function() {
                        showToolNotification('Токен сохранен, повторяем попытку...');
                        self.performAnalysis(url, token);
                    });
                } else {
                    alert('Доступ к репозиторию запрещен. Токен не предоставлен.');
                    self.resetButton();
                }
            });
        } else {
            alert('Ошибка доступа: ' + (accessResult.error || 'Не удалось получить доступ к репозиторию'));
            self.resetButton();
        }
    }).catch(function(error) {
        alert('Не удалось проверить доступ к репозиторию');
        self.resetButton();
    });
};

HerculesMainApp.prototype.performAnalysis = function(url, token) {
    token = token || null;
    var self = this;
    
    this.updateTaskStatus('1.1', 'in-progress');
    this.animateProgress('1.1', 100, 1500, function() {
        self.updateTaskStatus('1.1', 'completed');
        self.updateTaskStatus('2.1', 'in-progress');
        
        self.animateProgress('2.1', 100, 2000, function() {
            self.updateTaskStatus('2.1', 'completed');
            self.updateTaskStatus('2.2', 'in-progress');
            
            var formattedUrl = url;
            if (!url.startsWith('http')) {
                if (url.includes('/')) {
                    formattedUrl = 'https://github.com/' + url;
                }
            }
            
            fetch('/api/sca/git', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: formattedUrl,
                    token: token
                })
            }).then(function(response) {
                if (!response.ok) {
                    return response.json().catch(function() { return {}; }).then(function(errorData) {
                        if (response.status === 401 || response.status === 403) {
                            var domain = url.includes('github.com') ? 'github.com' : 'gitlab.com';
                            return self.tokenStorage.deleteToken(domain).then(function() {
                                throw new Error('Токен недействителен. Пожалуйста, введите новый токен.');
                            });
                        }
                        throw new Error(errorData.message || 'HTTP error! status: ' + response.status);
                    });
                }
                return response.json();
            }).then(function(data) {
                self.animateProgress('2.2', 100, 1000, function() {
                    self.updateTaskStatus('2.2', 'completed');
                    self.startButton.textContent = 'Анализ завершен';
                    showToolNotification('Анализ успешно завершен');
                    handleReportData(data);
                });
            }).catch(function(error) {
                if (error.message.includes('Токен недействителен')) {
                    self.tokenModal.show(url).then(function(newToken) {
                        if (newToken) {
                            var domain = url.includes('github.com') ? 'github.com' : 'gitlab.com';
                            self.tokenStorage.setToken(domain, newToken).then(function() {
                                self.performAnalysis(url, newToken);
                            });
                            return;
                        }
                        self.resetButton();
                    });
                    return;
                }
                
                var errorMessage = 'Ошибка соединения с сервером';
                if (error.message.includes('Failed to fetch')) {
                    errorMessage = 'Сервер недоступен';
                } else if (error.message.includes('500')) {
                    errorMessage = 'Внутренняя ошибка сервера (500)';
                } else if (error.message.includes('404')) {
                    errorMessage = 'API эндпоинт не найден (404)';
                } else {
                    errorMessage = error.message;
                }

                self.resetButton();
                self.updateTaskStatus('2.2', 'pending');
                var taskElement = self.findTaskElement('2.2');
                if (taskElement) {
                    var progressElement = taskElement.querySelector('.progress');
                    if (progressElement) {
                        progressElement.style.width = '0%';
                    }
                }
            });
        });
    });
};

HerculesMainApp.prototype.resetButton = function() {
    this.startButton.textContent = 'Начать анализ';
    this.startButton.disabled = false;
    this.startButton.classList.add('active');
};

HerculesMainApp.prototype.updateTaskStatus = function(taskId, status) {
    var statusMap = { 'pending': 'В ожидании', 'in-progress': 'В работе', 'completed': 'Завершено' };
    var taskElement = this.findTaskElement(taskId);
    if (taskElement) {
        var statusElement = taskElement.querySelector('.task-status');
        if (statusElement) {
            statusElement.textContent = statusMap[status] || status;
            statusElement.className = 'task-status ' + status;
        }
    }
};

HerculesMainApp.prototype.animateProgress = function(taskId, targetPercent, duration, callback) {
    var taskElement = this.findTaskElement(taskId);
    if (!taskElement) {
        if (callback) callback();
        return;
    }

    var progressElement = taskElement.querySelector('.progress');
    if (!progressElement) {
        if (callback) callback();
        return;
    }

    var startTime = Date.now();
    var initialWidth = parseFloat(progressElement.style.width) || 0;

    function animate() {
        var elapsed = Date.now() - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var easedProgress = 1 - Math.pow(1 - progress, 3);
        var currentWidth = initialWidth + (targetPercent - initialWidth) * easedProgress;
        progressElement.style.width = currentWidth + '%';

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            progressElement.style.width = targetPercent + '%';
            if (callback) callback();
        }
    }
    animate();
};

HerculesMainApp.prototype.findTaskElement = function(taskId) {
    var parts = taskId.split('.');
    var sectionIndex = parseInt(parts[0]) - 1;
    var taskIndex = parseInt(parts[1]) - 1;
    var sections = document.querySelectorAll('.card-section');
    if (sectionIndex >= sections.length) return null;
    var cards = sections[sectionIndex].querySelectorAll('.card');
    if (taskIndex >= cards.length) return null;
    return cards[taskIndex];
};

function initApp() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            window.herculesApp = new HerculesMainApp();
        });
    } else {
        window.herculesApp = new HerculesMainApp();
    }
}

initApp();

var SCAPopupReporter = function(reportData) {
    this.report = reportData;
    this.currentPage = 1;
    this.rowsPerPage = 10;
    this.filteredVulns = [];
    this.isMobile = window.innerWidth <= 768;
    if (this.isMobile) {
        this.rowsPerPage = 5;
    }
};

SCAPopupReporter.prototype.showPopup = function() {
    var overlay = document.createElement('div');
    overlay.className = 'sca-popup-overlay';
    var popup = document.createElement('div');
    popup.className = 'sca-popup';
    
    var styles = document.createElement('style');
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
            gap: 12px;
        }
        .sca-btn {
            padding: 10px 24px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            font-family: Ubuntu;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .sca-btn-html {
            background: #6f42c1;
            color: white;
        }
        .sca-btn-html:hover {
            background: #5a32a3;
        }
        .sca-btn-pdf {
            background: #dc3545;
            color: white;
        }
        .sca-btn-pdf:hover {
            background: #b02a37;
        }
        .sca-btn-json {
            background: #10b981;
            color: white;
        }
        .sca-btn-json:hover {
            background: #0e9f6e;
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
            font-family: 'Ubuntu';
        }
        .sca-vuln-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 500px;
            font-family: 'Ubuntu';
            font-size: 12px;
        }
        .sca-vuln-table th {
            background: #f8f9fa;
            padding: 13px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #dee2e6;
        }
        .sca-vuln-table td {
            padding: 11px;
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
    `;
    
    var stats = this.extractStats();
    var vulnerabilities = this.extractVulnerabilities();
    
    popup.innerHTML = `
        <div class="sca-popup-header">
            <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
                Результаты SCA анализа
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
                    <div class="sca-stat-number" style="color:#dc3545">${stats.critical}</div>
                    <div class="sca-stat-label">Критических</div>
                </div>
                <div class="sca-stat-card">
                    <div class="sca-stat-number" style="color:#fd7e14">${stats.high}</div>
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
                        ${vulnerabilities.map(function(v) {
                            return '<tr><td><strong>' + this.escapeHtml(v.component) + '</strong> (' + v.version + ')</td><td><a href="' + v.url + '" target="_blank" class="sca-cve-link">' + v.id + '</a></td><td style="font-size:13px">' + this.escapeHtml(v.description.substring(0, 150)) + (v.description.length > 150 ? '...' : '') + '</td><td class="sca-severity-' + v.severity + '">' + v.severity + '</td></tr>';
                        }.bind(this)).join('')}
                    </tbody>
                </table>
                ` : '<div style="text-align:center;padding:40px;">Уязвимостей не найдено</div>'}
            </div>
        </div>
        <div class="sca-popup-footer">
            <button id="downloadHtmlBtn" class="sca-btn sca-btn-html">
                Скачать HTML
            </button>
            <button id="downloadJsonBtn" class="sca-btn sca-btn-json">
                Скачать JSON
            </button>
        </div>
    `;
    
    document.head.appendChild(styles);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    this.addEventListeners(overlay);
};

SCAPopupReporter.prototype.escapeHtml = function(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
};

SCAPopupReporter.prototype.extractStats = function() {
    var report = this.report;
    var sbomData = report.sbom || report;
    
    var components = 0;
    var vulnerabilities = 0;
    var critical = 0, high = 0, moderate = 0, low = 0;
    
    if (sbomData.components) {
        components = sbomData.components.length;
    }
    
    if (sbomData.vulnerabilities) {
        vulnerabilities = sbomData.vulnerabilities.length;
        for (var i = 0; i < sbomData.vulnerabilities.length; i++) {
            var v = sbomData.vulnerabilities[i];
            var severity = 'UNKNOWN';
            if (v.ratings && v.ratings.length > 0 && v.ratings[0].severity) {
                severity = v.ratings[0].severity;
            } else if (v.severity) {
                severity = v.severity;
            }
            severity = severity.toUpperCase();
            if (severity === 'CRITICAL') critical++;
            else if (severity === 'HIGH') high++;
            else if (severity === 'MODERATE' || severity === 'MEDIUM') moderate++;
            else if (severity === 'LOW') low++;
        }
    }
    
    return { components: components, vulnerabilities: vulnerabilities, critical: critical, high: high, moderate: moderate, low: low };
};

SCAPopupReporter.prototype.extractVulnerabilities = function() {
    var report = this.report;
    var sbomData = report.sbom || report;
    
    if (!sbomData.vulnerabilities) return [];
    
    var result = [];
    for (var i = 0; i < sbomData.vulnerabilities.length; i++) {
        var v = sbomData.vulnerabilities[i];
        
        var severity = 'UNKNOWN';
        if (v.ratings && v.ratings.length > 0 && v.ratings[0].severity) {
            severity = v.ratings[0].severity;
        } else if (v.severity) {
            severity = v.severity;
        }
        severity = severity.toUpperCase();
        if (severity === 'MEDIUM') severity = 'MODERATE';
        
        var componentName = v.component && v.component.name ? v.component.name : 'Unknown';
        var componentVersion = v.component && v.component.version ? v.component.version : 'Unknown';
        var description = v.description || 'Нет описания';
        var id = v.id || 'N/A';
        var url = v.source && v.source.url ? v.source.url : 'https://osv.dev/vulnerability/' + id;
        
        result.push({
            id: id,
            component: componentName,
            version: componentVersion,
            severity: severity,
            url: url,
            description: description
        });
    }
    
    return result;
};

SCAPopupReporter.prototype.downloadJSON = function() {
    try {
        var dataStr = JSON.stringify(this.report, null, 2);
        var blob = new Blob([dataStr], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'sca-report-' + new Date().toISOString().split('T')[0] + '.json';
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('JSON отчет успешно скачан', 'success');
    } catch (error) {
        this.showNotification('Ошибка при скачивании JSON', 'error');
    }
};

SCAPopupReporter.prototype.downloadHTML = function() {
    try {
        var defaultName = 'sca-report-' + new Date().toISOString().split('T')[0];
        var reportName = prompt('Введите имя отчета:', defaultName);
        
        if (reportName === null) {
            return;
        }
        
        if (reportName.trim() === '') {
            reportName = defaultName;
        }
        
        reportName = reportName.trim().replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').substring(0, 100);
        
        this.showNotification('Генерация HTML отчета...', 'info');
        var htmlContent = this.generateFullHTMLReport();
        var blob = new Blob([htmlContent], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = reportName + '.html';
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('HTML отчет "' + reportName + '.html" успешно скачан', 'success');
    } catch (error) {
        this.showNotification('Ошибка при скачивании HTML', 'error');
    }
};

SCAPopupReporter.prototype.generateFullHTMLReport = function() {
    var stats = this.extractStats();
    var vulnerabilities = this.extractVulnerabilities();
    
    var severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MODERATE': 2, 'LOW': 3, 'UNKNOWN': 4 };
    var sortedVulns = vulnerabilities.slice().sort(function(a, b) {
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
    
    var vulnRows = '';
    for (var i = 0; i < sortedVulns.length; i++) {
        var v = sortedVulns[i];
        vulnRows += '<tr data-severity="' + v.severity + '" data-component="' + this.escapeHtml(v.component) + '" data-cve="' + v.id + '" data-description="' + this.escapeHtml(v.description) + '">' +
            '<td><strong>' + this.escapeHtml(v.component) + '</strong></td>' +
            '<td>' + v.version + '</td>' +
            '<td><a href="' + v.url + '" target="_blank" style="color: #0066cc;">' + v.id + '</a></td>' +
            '<td style="font-size:13px">' + this.escapeHtml(v.description.substring(0, 100)) + (v.description.length > 100 ? '...' : '') + '</td>' +
            '<td class="severity-' + v.severity + '">' + v.severity + '</td>' +
            '</tr>';
    }
    
    return '<!DOCTYPE html>\n<html lang="ru">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap">\n    <title>Геркулес | SCA - ' + new Date().toLocaleDateString() + '</title>\n    <style>\n        * { margin: 0; padding: 0; box-sizing: border-box; }\n        body { font-family: "Ubuntu"; background: white; padding: 20px; color: #333; }\n        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }\n        .header { background: black; color: white; padding: 40px; }\n        .header h1 { font-size: 32px; margin-bottom: 10px; }\n        .header .meta { opacity: 0.9; font-size: 14px; }\n        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; padding: 30px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; }\n        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }\n        .stat-card .label { font-size: 14px; color: #6c757d; margin-bottom: 10px; }\n        .stat-card .value { font-size: 36px; font-weight: bold; }\n        .content { padding: 30px; }\n        .filter-bar { margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }\n        .filter-btn { padding: 8px 16px; background: #e9ecef; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; }\n        .filter-btn.active { background: #667eea; color: white; }\n        .filter-btn:hover { background: #667eea; color: white; }\n        .search-box { flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 14px; min-width: 200px; }\n        .search-box:focus { outline: none; border-color: #667eea; }\n        .vuln-table { width: 100%; border-collapse: collapse; margin-top: 20px; }\n        .vuln-table th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; }\n        .vuln-table td { padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 13px; font-family: "Ubuntu"; }\n        .severity-CRITICAL { color: #dc3545; font-weight: bold; }\n        .severity-HIGH { color: #fd7e14; font-weight: bold; }\n        .severity-MODERATE { color: #ffc107; }\n        .severity-LOW { color: #28a745; }\n        .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }\n        @media (max-width: 768px) { .stats { grid-template-columns: repeat(2, 1fr); } .vuln-table { font-size: 12px; } .vuln-table th, .vuln-table td { padding: 8px; } }\n    </style>\n</head>\n<body>\n    <div class="container">\n        <div class="header">\n            <h1>Геркулес | SCA</h1>\n            <div class="meta"><div>Дата генерации: ' + new Date().toLocaleString() + '</div></div>\n        </div>\n        <div class="stats">\n            <div class="stat-card"><div class="label">Компонентов</div><div class="value" style="color: #667eea;">' + stats.components + '</div></div>\n            <div class="stat-card"><div class="label">Уязвимостей</div><div class="value" style="color: #fd7e14;">' + stats.vulnerabilities + '</div></div>\n            <div class="stat-card"><div class="label">Критических</div><div class="value" style="color: #dc3545;">' + stats.critical + '</div></div>\n            <div class="stat-card"><div class="label">Высоких</div><div class="value" style="color: #fd7e14;">' + stats.high + '</div></div>\n            <div class="stat-card"><div class="label">Средних</div><div class="value" style="color: #ffc107;">' + stats.moderate + '</div></div>\n            <div class="stat-card"><div class="label">Низких</div><div class="value" style="color: #28a745;">' + stats.low + '</div></div>\n        </div>\n        <div class="content">\n            <div class="filter-bar">\n                <input type="text" class="search-box" id="searchInput" placeholder="Поиск по компоненту, CVE ID или описанию...">\n                <button class="filter-btn active" data-filter="all">Все (' + vulnerabilities.length + ')</button>\n                <button class="filter-btn" data-filter="CRITICAL">Критические (' + stats.critical + ')</button>\n                <button class="filter-btn" data-filter="HIGH">Высокие (' + stats.high + ')</button>\n                <button class="filter-btn" data-filter="MODERATE">Средние (' + stats.moderate + ')</button>\n                <button class="filter-btn" data-filter="LOW">Низкие (' + stats.low + ')</button>\n            </div>\n            <table class="vuln-table" id="vulnTable">\n                <thead><tr><th>Компонент</th><th>Версия</th><th>CVE ID</th><th>Описание</th><th>Серьезность</th></tr></thead>\n                <tbody id="vulnTableBody">' + vulnRows + '</tbody>\n            </table>\n        </div>\n        <div class="footer"><p>Сгенерировано с помощью Геркулес | Анализ выполнены на основе данных публичных баз CVE</p><p>Рекомендуется обновить уязвимые компоненты до последних версий</p></div>\n    </div>\n    <script>\n        var filterBtns = document.querySelectorAll(".filter-btn[data-filter]");\n        var searchInput = document.getElementById("searchInput");\n        var rows = Array.from(document.querySelectorAll("#vulnTableBody tr"));\n        var currentFilter = "all";\n        function filterRows() {\n            var searchTerm = searchInput.value.toLowerCase();\n            rows.forEach(function(row) {\n                var severity = row.dataset.severity;\n                var component = row.dataset.component ? row.dataset.component.toLowerCase() : "";\n                var cve = row.dataset.cve ? row.dataset.cve.toLowerCase() : "";\n                var description = row.dataset.description ? row.dataset.description.toLowerCase() : "";\n                var matchesFilter = currentFilter === "all" || severity === currentFilter;\n                var matchesSearch = searchTerm === "" || component.indexOf(searchTerm) !== -1 || cve.indexOf(searchTerm) !== -1 || description.indexOf(searchTerm) !== -1;\n                row.style.display = matchesFilter && matchesSearch ? "" : "none";\n            });\n        }\n        filterBtns.forEach(function(btn) {\n            btn.addEventListener("click", function() {\n                filterBtns.forEach(function(b) { b.classList.remove("active"); });\n                btn.classList.add("active");\n                currentFilter = btn.dataset.filter;\n                filterRows();\n            });\n        });\n        searchInput.addEventListener("input", filterRows);\n    </script>\n</body>\n</html>';
};

SCAPopupReporter.prototype.generatePDFHTML = function() {
    var stats = this.extractStats();
    var vulnerabilities = this.extractVulnerabilities();
    
    var severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MODERATE': 2, 'LOW': 3, 'UNKNOWN': 4 };
    var sortedVulns = vulnerabilities.slice().sort(function(a, b) {
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
    
    var tableRows = '';
    for (var i = 0; i < sortedVulns.length; i++) {
        var v = sortedVulns[i];
        tableRows += '<tr><td><strong>' + this.escapeHtml(v.component) + '</strong></td><td>' + v.version + '</td><td><a href="' + v.url + '" style="color: #0066cc;">' + v.id + '</a></td><td class="severity-' + v.severity + '">' + v.severity + '</td></tr>';
    }
    
    return '<!DOCTYPE html>\n<html>\n<head>\n    <meta charset="UTF-8">\n    <title>Геркулес | SCA</title>\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap">\n    <style>\n        * { margin: 0; padding: 0; box-sizing: border-box; }\n        body { font-family: Ubuntu; padding: 20px; color: #212529; background: white; }\n        .header { margin-bottom: 30px; text-align: center; border-bottom: 2px solid #667eea; padding-bottom: 20px; }\n        h1 { color: #1f2937; font-size: 24px; margin-bottom: 10px; }\n        .date { color: #6c757d; font-size: 12px; }\n        .stats-grid { display: flex; justify-content: space-between; gap: 15px; margin: 30px 0; flex-wrap: wrap; }\n        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; flex: 1; min-width: 80px; }\n        .stat-number { font-size: 28px; font-weight: bold; }\n        .stat-label { color: #6c757d; font-size: 11px; margin-top: 5px; }\n        .section-title { margin: 30px 0 20px 0; color: #1f2937; font-size: 18px; padding-left: 12px; }\n        .severity-CRITICAL { color: #dc3545; font-weight: bold; }\n        .severity-HIGH { color: #fd7e14; font-weight: bold; }\n        .severity-MODERATE { color: #ffc107; }\n        .severity-LOW { color: #28a745; }\n        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6c757d; font-size: 10px; }\n        .no-vulns { text-align: center; padding: 40px; color: #28a745; font-size: 16px; }\n        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }\n        th { background: #f8f9fa; padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; }\n        td { padding: 10px; border-bottom: 1px solid #dee2e6; }\n    </style>\n</head>\n<body>\n    <div class="header">\n        <h1>SCA отчет по безопасности</h1>\n        <div class="date">Дата генерации: ' + new Date().toLocaleString() + '</div>\n    </div>\n    <div class="stats-grid">\n        <div class="stat-card"><div class="stat-number" style="color: #667eea;">' + stats.components + '</div><div class="stat-label">Компонентов</div></div>\n        <div class="stat-card"><div class="stat-number" style="color: #fd7e14;">' + stats.vulnerabilities + '</div><div class="stat-label">Уязвимостей</div></div>\n        <div class="stat-card"><div class="stat-number" style="color: #dc3545;">' + stats.critical + '</div><div class="stat-label">Критические</div></div>\n        <div class="stat-card"><div class="stat-number" style="color: #fd7e14;">' + stats.high + '</div><div class="stat-label">Высокие</div></div>\n        <div class="stat-card"><div class="stat-number" style="color: #ffc107;">' + stats.moderate + '</div><div class="stat-label">Средние</div></div>\n        <div class="stat-card"><div class="stat-number" style="color: #28a745;">' + stats.low + '</div><div class="stat-label">Низкие</div></div>\n    </div>\n    <div class="section-title">Все найденные уязвимости (' + vulnerabilities.length + ')</div>\n    ' + (vulnerabilities.length > 0 ? '<table><thead><tr><th>Компонент</th><th>Версия</th><th>CVE ID</th><th>Серьезность</th></tr></thead><tbody>' + tableRows + '</tbody></table>' : '<div class="no-vulns">Уязвимостей не найдено</div>') + '\n    <div class="footer"><p>Сгенерировано с помощью Геркулес</p><p>Всего найдено уязвимостей: ' + stats.vulnerabilities + '</p></div>\n</body>\n</html>';
};

SCAPopupReporter.prototype.showNotification = function(message, type) {
    type = type || 'success';
    var notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: ' + (type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6') + '; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001; animation: slideIn 0.3s ease; font-family: "Ubuntu", sans-serif; font-size: 14px;';
    document.body.appendChild(notification);
    setTimeout(function() {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(function() {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
};

SCAPopupReporter.prototype.addEventListeners = function(overlay) {
    var self = this;
    var closePopupBtn = overlay.querySelector('#closePopup');
    
    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', function() {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            if (typeof ProgressReset !== 'undefined') {
                ProgressReset.resetAllProgress();
            }
        });
    }
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            if (typeof ProgressReset !== 'undefined') {
                ProgressReset.resetAllProgress();
            }
        }
    });
    
    var escHandler = function(e) {
        if (e.key === 'Escape') {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
                if (typeof ProgressReset !== 'undefined') {
                    ProgressReset.resetAllProgress();
                }
                document.removeEventListener('keydown', escHandler);
            }
        }
    };
    document.addEventListener('keydown', escHandler);
    
    var downloadJsonBtn = overlay.querySelector('#downloadJsonBtn');
    if (downloadJsonBtn) {
        downloadJsonBtn.addEventListener('click', function() { self.downloadJSON(); });
    }
    
    var downloadHtmlBtn = overlay.querySelector('#downloadHtmlBtn');
    if (downloadHtmlBtn) {
        downloadHtmlBtn.addEventListener('click', function() { self.downloadHTML(); });
    }
};

function handleReportData(reportData) {
    if (!reportData) {
        alert('Ошибка: нет данных для отображения');
        return;
    }
    try {
        var reporter = new SCAPopupReporter(reportData);
        reporter.showPopup();
    } catch (error) {
        alert('Ошибка при отображении отчета: ' + error.message);
    }
}

window.showToolNotification = showToolNotification;
window.setActiveTool = setActiveTool;
window.updateTaskStatus = updateTaskStatus;
window.animateProgress = animateProgress;
window.findTaskElement = findTaskElement;
window.clearRepoInput = clearRepoInput;