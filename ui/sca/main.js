// ============================================================
// HELPER FUNCTIONS
// ============================================================

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
        font-family: 'Fira Sans', sans-serif;
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
        'pending': 'Pending',
        'in-progress': 'In progress',
        'completed': 'Completed'
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
            status.textContent = 'Pending';
            status.className = 'task-status pending';
        });
        
        var progressBars = document.querySelectorAll('.progress');
        progressBars.forEach(function(bar) {
            bar.style.width = '0%';
        });
        
        var startButton = document.getElementById('start-btn');
        if (startButton) {
            startButton.textContent = 'Start analysis';
            startButton.disabled = false;
            startButton.classList.add('active');
        }
    }
};

// ============================================================
// TOKEN MODAL
// ============================================================

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
        font-family: 'Fira Sans', sans-serif;
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
                    <h3 style="margin: 0; font-size: 18px;">Access token required</h3>
                </div>
            </div>
            <div style="padding: 24px;">
                <p style="margin-bottom: 16px; color: #374151;">
                    To access the private repository <strong id="modalRepoUrl" style="color: #667eea; word-break: break-all;"></strong> a personal token is required.
                </p>
                
                <div style="background: #f3f4f6; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                    <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">
                        How to get a token:
                    </p>
                    <ol style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 13px;">
                        <li>Go to <strong>private repository</strong></li>
                        <li>Create a token with <code>read_api</code> and <code>read_repository</code> permissions</li>
                        <li>Copy the token and paste it below</li>
                    </ol>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-weight: 500; margin-bottom: 8px; color: #374151;">Your token</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="password" id="tokenInputValue" placeholder="glpat-..." style="
                            flex: 1;
                            padding: 12px 16px;
                            border: 2px solid #e5e7eb;
                            border-radius: 10px;
                            font-size: 14px;
                            font-family: 'Fira Sans', sans-serif;
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
                        font-family: 'Fira Sans', sans-serif;
                    ">Cancel</button>
                    <button id="submitTokenBtn" style="
                        padding: 10px 20px;
                        background: #667eea;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: all 0.2s;
                        font-family: 'Fira Sans', sans-serif;
                    ">
                        Save and continue
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
        this.showError('Please enter a token');
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
        font-family: 'Fira Sans', sans-serif;
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

// ============================================================
// ACCESS CHECKER
// ============================================================

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
    
    return Promise.resolve({ accessible: false, requiresAuth: false, error: 'Unknown platform' });
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
        return Promise.resolve({ accessible: false, requiresAuth: false, error: 'Invalid GitLab URL format' });
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
                            error: 'Repository requires authentication. Possibly private.',
                            platform: 'gitlab',
                            baseUrl: baseUrl,
                            projectPath: projectPath
                        };
                    });
                }
                return { 
                    accessible: false, 
                    requiresAuth: true, 
                    error: 'Repository requires authentication. Possibly private.',
                    platform: 'gitlab',
                    baseUrl: baseUrl,
                    projectPath: projectPath
                };
            });
        } else {
            return { 
                accessible: false, 
                requiresAuth: false, 
                error: 'HTTP error: ' + response.status,
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
        return Promise.resolve({ accessible: false, requiresAuth: false, error: 'Invalid GitHub URL format' });
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
                error: 'Private repository, authentication required',
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
                                    error: 'Repository not found or requires authentication. Possibly private.',
                                    platform: 'github'
                                };
                            });
                        }
                        return { 
                            accessible: false, 
                            requiresAuth: true, 
                            error: 'Repository not found or requires authentication. Possibly private.',
                            platform: 'github'
                        };
                    });
                }
                return { 
                    accessible: false, 
                    requiresAuth: true, 
                    error: 'Repository not found or requires authentication. Possibly private.',
                    platform: 'github'
                };
            });
        } else {
            return { 
                accessible: false, 
                requiresAuth: false, 
                error: 'HTTP error: ' + response.status,
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

// ============================================================
// TOKEN STORAGE
// ============================================================

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

// ============================================================
// HERCULES MAIN APP
// ============================================================

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
        this.showValidationMessage('Enter repository link', '');
        return;
    }
    
    if (!this.isValidRepoURL(url)) {
        this.setButtonState(false);
        this.showValidationMessage('Enter a valid repository link', 'invalid');
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

    this.startButton.textContent = 'Checking access...';
    this.startButton.disabled = true;
    
    this.accessChecker.checkRepositoryAccess(url).then(function(accessResult) {
        if (accessResult.accessible) {
            self.performAnalysis(url);
        } else if (accessResult.requiresAuth) {
            self.tokenModal.show(url).then(function(token) {
                if (token) {
                    var domain = accessResult.baseUrl || (accessResult.platform === 'github' ? 'github.com' : 'gitlab.com');
                    self.tokenStorage.setToken(domain, token).then(function() {
                        showToolNotification('Token saved, retrying...');
                        self.performAnalysis(url, token);
                    });
                } else {
                    alert('Access to repository denied. Token not provided.');
                    self.resetButton();
                }
            });
        } else {
            alert('Access error: ' + (accessResult.error || 'Failed to access repository'));
            self.resetButton();
        }
    }).catch(function(error) {
        alert('Failed to check repository access');
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
                                throw new Error('Invalid token. Please enter a new token.');
                            });
                        }
                        throw new Error(errorData.message || 'HTTP error! status: ' + response.status);
                    });
                }
                return response.json();
            }).then(function(data) {
                self.animateProgress('2.2', 100, 1000, function() {
                    self.updateTaskStatus('2.2', 'completed');
                    self.startButton.textContent = 'Analysis completed';
                    showToolNotification('Analysis completed successfully');
                    handleReportData(data);
                });
            }).catch(function(error) {
                if (error.message.includes('Invalid token')) {
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
                
                var errorMessage = 'Connection error';
                if (error.message.includes('Failed to fetch')) {
                    errorMessage = 'Server unavailable';
                } else if (error.message.includes('500')) {
                    errorMessage = 'Internal server error (500)';
                } else if (error.message.includes('404')) {
                    errorMessage = 'API endpoint not found (404)';
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
    this.startButton.textContent = 'Start analysis';
    this.startButton.disabled = false;
    this.startButton.classList.add('active');
};

HerculesMainApp.prototype.updateTaskStatus = function(taskId, status) {
    var statusMap = { 'pending': 'Pending', 'in-progress': 'In progress', 'completed': 'Completed' };
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

// ============================================================
// UPDATED SCAPopupReporter WITH GROUPING
// ============================================================

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
            font-family: 'Fira Sans', sans-serif;
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
            font-family: 'Fira Sans', sans-serif;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .sca-btn-html { background: #6f42c1; color: white; }
        .sca-btn-html:hover { background: #5a32a3; }
        .sca-btn-pdf { background: #dc3545; color: white; }
        .sca-btn-pdf:hover { background: #b02a37; }
        .sca-btn-json { background: #10b981; color: white; }
        .sca-btn-json:hover { background: #0e9f6e; }
        
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
        
        .sca-component-block {
            background: white;
            border-radius: 8px;
            margin-bottom: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            overflow: hidden;
        }

        .sca-component-header {
            padding: 12px 16px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            transition: background 0.2s;
            flex-wrap: wrap;
            gap: 6px;
        }
        .sca-component-header:hover {
            background: #f8f9fa;
        }
        .sca-component-name {
            font-weight: 600;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        .sca-component-version {
            font-weight: 400;
            color: #6c757d;
            font-size: 12px;
        }
        .sca-component-badge {
            font-size: 11px;
            padding: 2px 12px;
            border-radius: 20px;
            font-weight: 500;
        }
        .sca-component-badge.ok {
            background: #d4edda;
            color: #155724;
        }
        .sca-component-badge.issues {
            background: #fff3cd;
            color: #856404;
        }
        .sca-component-badge.critical {
            background: #f8d7da;
            color: #721c24;
        }
        .sca-component-stats {
            font-size: 12px;
            color: #6c757d;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .sca-component-arrow {
            font-size: 16px;
            color: #999;
            transition: transform 0.3s;
            margin-left: 4px;
        }
        .sca-component-arrow.open {
            transform: rotate(180deg);
        }
        .sca-component-body {
            display: none;
            padding: 0 16px 16px 16px;
            border-top: 1px solid #f0f0f0;
        }
        .sca-component-body.open {
            display: block;
        }
        
        .sca-vuln-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 8px;
        }
        .sca-vuln-table th {
            background: #f8f9fa;
            padding: 10px 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #dee2e6;
            font-size: 11px;
        }
        .sca-vuln-table td {
            padding: 8px 12px;
            border-bottom: 1px solid #e9ecef;
            vertical-align: top;
            font-size: 12px;
        }
        .sca-vuln-table tr:hover {
            background: #f8f9fa;
        }
        .sca-severity-CRITICAL { color: #dc3545; font-weight: bold; }
        .sca-severity-HIGH { color: #fd7e14; font-weight: bold; }
        .sca-severity-MODERATE { color: #ffc107; font-weight: bold; }
        .sca-severity-LOW { color: #28a745; font-weight: bold; }
        .sca-severity-UNKNOWN { color: #6c757d; }
        
        .sca-cve-link {
            color: #0066cc;
            text-decoration: none;
        }
        .sca-cve-link:hover {
            text-decoration: underline;
        }
        .sca-empty-state {
            text-align: center;
            padding: 30px;
            color: #999;
            font-size: 13px;
        }
        .sca-no-vulns-text {
            color: #28a745;
            font-weight: 500;
            font-size: 13px;
        }
        .sca-remediation {
            font-size: 11px;
            color: #6c757d;
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1px dashed #e5e7eb;
        }
        .sca-vuln-description {
            font-size: 12px;
            color: #495057;
            max-width: 400px;
        }
        
        .sca-toolbar {
            display: flex;
            gap: 10px;
            margin-bottom: 16px;
            flex-wrap: wrap;
            align-items: center;
        }
        .sca-search-input {
            flex: 1;
            min-width: 180px;
            padding: 8px 14px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 13px;
            font-family: 'Fira Sans', sans-serif;
            background: white;
        }
        .sca-search-input:focus {
            outline: none;
            border-color: #667eea;
        }
        .sca-filter-select {
            padding: 8px 14px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: white;
            font-size: 13px;
            font-family: 'Fira Sans', sans-serif;
            cursor: pointer;
        }
        .sca-block-count {
            font-size: 12px;
            color: #6c757d;
            margin-left: auto;
        }
        
        @media (max-width: 768px) {
            .sca-stats-grid { grid-template-columns: repeat(3, 1fr); }
            .sca-component-header { flex-direction: column; align-items: flex-start; gap: 4px; }
            .sca-component-stats { font-size: 11px; flex-wrap: wrap; }
            .sca-vuln-table { font-size: 11px; }
            .sca-vuln-table th, .sca-vuln-table td { padding: 4px 8px; }
            .sca-toolbar { flex-direction: column; align-items: stretch; }
            .sca-search-input { min-width: auto; }
        }
    `;
    
    var stats = this.extractStats();
    var groupedComponents = this.groupComponents();
    var totalVulns = 0;
    for (var i = 0; i < groupedComponents.length; i++) {
        totalVulns += groupedComponents[i].vulns.length;
    }
    
    popup.innerHTML = `
        <div class="sca-popup-header">
            <div class="sca-popup-title">
                SCA Analysis Results
            </div>
            <button class="sca-popup-close" id="closePopup">&times;</button>
        </div>
        <div class="sca-popup-content">
            <div class="sca-stats-grid">
                <div class="sca-stat-card">
                    <div class="sca-stat-number">${stats.components}</div>
                    <div class="sca-stat-label">Components</div>
                </div>
                <div class="sca-stat-card">
                    <div class="sca-stat-number">${totalVulns}</div>
                    <div class="sca-stat-label">Vulnerabilities</div>
                </div>
                <div class="sca-stat-card">
                    <div class="sca-stat-number" style="color:#dc3545">${stats.critical}</div>
                    <div class="sca-stat-label">Critical</div>
                </div>
                <div class="sca-stat-card">
                    <div class="sca-stat-number" style="color:#fd7e14">${stats.high}</div>
                    <div class="sca-stat-label">High</div>
                </div>
                <div class="sca-stat-card">
                    <div class="sca-stat-number" style="color:#ffc107">${stats.moderate}</div>
                    <div class="sca-stat-label">Moderate</div>
                </div>
                <div class="sca-stat-card">
                    <div class="sca-stat-number" style="color:#28a745">${stats.low}</div>
                    <div class="sca-stat-label">Low</div>
                </div>
            </div>
            
            <div class="sca-toolbar">
                <input type="text" class="sca-search-input" id="scaSearch" placeholder="Search component...">
                <select class="sca-filter-select" id="scaFilter">
                    <option value="all">All components</option>
                    <option value="has-issues">With vulnerabilities</option>
                    <option value="no-issues">Without vulnerabilities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                </select>
                <span class="sca-block-count">${groupedComponents.length} components</span>
            </div>
            
            <div id="scaComponents">
                ${this.renderComponentBlocks(groupedComponents)}
            </div>
        </div>
        <div class="sca-popup-footer">
            <button id="downloadHtmlBtn" class="sca-btn sca-btn-html">Download HTML</button>
            <button id="downloadJsonBtn" class="sca-btn sca-btn-json">Download JSON</button>
        </div>
    `;
    
    document.head.appendChild(styles);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    this.addEventListeners(overlay);
    this.initComponentToggles(overlay);
    this.initSearchFilter(overlay);
};

// ============================================================
// COMPONENT GROUPING
// ============================================================

SCAPopupReporter.prototype.groupComponents = function() {
    var report = this.report;
    var sbomData = report.sbom || report;
    
    var components = [];
    var vulnerabilities = [];
    
    if (sbomData.components) {
        components = sbomData.components;
    }
    
    if (sbomData.vulnerabilities) {
        vulnerabilities = sbomData.vulnerabilities;
    }
    
    var vulnMap = {};
    for (var i = 0; i < vulnerabilities.length; i++) {
        var v = vulnerabilities[i];
        var componentName = v.component && v.component.name ? v.component.name : 'Unknown';
        var componentVersion = v.component && v.component.version ? v.component.version : 'Unknown';
        var key = componentName + '@' + componentVersion;
        
        if (!vulnMap[key]) {
            vulnMap[key] = {
                name: componentName,
                version: componentVersion,
                vulns: []
            };
        }
        vulnMap[key].vulns.push(v);
    }
    
    var result = [];
    var processedKeys = {};
    
    for (var key in vulnMap) {
        if (vulnMap.hasOwnProperty(key)) {
            var item = vulnMap[key];
            result.push({
                name: item.name,
                version: item.version,
                vulns: item.vulns,
                hasVulns: item.vulns.length > 0
            });
            processedKeys[key] = true;
        }
    }
    
    for (var j = 0; j < components.length; j++) {
        var comp = components[j];
        var compName = comp.name || 'Unknown';
        var compVersion = comp.version || 'Unknown';
        var key2 = compName + '@' + compVersion;
        
        if (!processedKeys[key2]) {
            result.push({
                name: compName,
                version: compVersion,
                vulns: [],
                hasVulns: false
            });
        }
    }
    
    result.sort(function(a, b) {
        if (a.hasVulns && !b.hasVulns) return -1;
        if (!a.hasVulns && b.hasVulns) return 1;
        return a.name.localeCompare(b.name);
    });
    
    return result;
};

// ============================================================
// RENDER COMPONENT BLOCKS
// ============================================================

SCAPopupReporter.prototype.renderComponentBlocks = function(components) {
    if (!components || components.length === 0) {
        return '<div class="sca-empty-state">No components found</div>';
    }
    
    var html = '';
    
    for (var i = 0; i < components.length; i++) {
        var comp = components[i];
        var vulns = comp.vulns || [];
        var hasVulns = vulns.length > 0;
        var hasCritical = false;
        var hasHigh = false;
        
        for (var v = 0; v < vulns.length; v++) {
            var severity = this.getSeverity(vulns[v]);
            if (severity === 'CRITICAL') hasCritical = true;
            if (severity === 'HIGH') hasHigh = true;
        }
        
        var blockClass = 'sca-component-block';
        if (hasCritical) blockClass += ' has-critical';
        else if (hasVulns) blockClass += ' has-issues';
        
        var badgeHtml = '';
        if (!hasVulns) {
            badgeHtml = '<span class="sca-component-badge ok"><i class="fas fa-check"></i> Safe</span>';
        } else if (hasCritical) {
            badgeHtml = '<span class="sca-component-badge critical"><i class="fas fa-times"></i> Critical</span>';
        } else if (hasHigh) {
            badgeHtml = '<span class="sca-component-badge issues"><i class="fas fa-times"></i> High</span>';
        } else {
            badgeHtml = '<span class="sca-component-badge issues"><i class="fas fa-times"></i> Has vulnerabilities</span>';
        }
        
        var statsHtml = '';
        if (hasVulns) {
            var criticalCount = 0, highCount = 0, moderateCount = 0, lowCount = 0;
            for (var s = 0; s < vulns.length; s++) {
                var sev = this.getSeverity(vulns[s]);
                if (sev === 'CRITICAL') criticalCount++;
                else if (sev === 'HIGH') highCount++;
                else if (sev === 'MODERATE' || sev === 'MEDIUM') moderateCount++;
                else if (sev === 'LOW') lowCount++;
            }
            var parts = [];
            if (criticalCount > 0) parts.push('<span style="color:#dc3545;"><i class="fas fa-times"></i> ' + criticalCount + '</span>');
            if (highCount > 0) parts.push('<span style="color:#fd7e14;"><i class="fas fa-times"></i> ' + highCount + '</span>');
            if (moderateCount > 0) parts.push('<span style="color:#ffc107;"><i class="fas fa-exclamation-triangle"></i> ' + moderateCount + '</span>');
            if (lowCount > 0) parts.push('<span style="color:#28a745;"><i class="fas fa-check"></i> ' + lowCount + '</span>');
            statsHtml = parts.join(' ');
        } else {
            statsHtml = '<span class="sca-no-vulns-text"><i class="fas fa-check"></i> No vulnerabilities</span>';
        }
        
        var tableHtml = '';
        if (hasVulns) {
            tableHtml = `
                <table class="sca-vuln-table">
                    <thead>
                        <tr>
                            <th style="width:30px;">#</th>
                            <th style="min-width:120px;">CVE ID</th>
                            <th>Description</th>
                            <th style="width:100px;">Severity</th>
                            <th style="min-width:140px;">Remediation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${vulns.map(function(vuln, idx) {
                            var severity = this.getSeverity(vuln);
                            var id = vuln.id || vuln.vulnerability?.id || 'N/A';
                            var description = vuln.description || vuln.vulnerability?.description || 'No description';
                            var url = vuln.source?.url || vuln.vulnerability?.source?.url || 'https://osv.dev/vulnerability/' + id;
                            var remediation = vuln.remediation || vuln.vulnerability?.remediation || vuln.analysis?.detail || 'Update to latest version';
                            var severityClass = 'sca-severity-' + severity;
                            
                            return `
                                <tr>
                                    <td style="text-align:center; color:#6c757d;">${idx + 1}</td>
                                    <td><a href="${url}" target="_blank" class="sca-cve-link">${id}</a></td>
                                    <td class="sca-vuln-description">${this.escapeHtml(description.substring(0, 120))}${description.length > 120 ? '...' : ''}</td>
                                    <td class="${severityClass}">${severity}</td>
                                    <td class="sca-remediation">${this.escapeHtml(remediation)}</td>
                                </tr>
                            `;
                        }.bind(this)).join('')}
                    </tbody>
                </table>
            `;
        }
        
        var bodyId = 'sca-body-' + i;
        var arrowId = 'sca-arrow-' + i;
        var dataAttrs = 'data-name="' + this.escapeHtml(comp.name).toLowerCase() + '" data-has-vulns="' + hasVulns + '" data-critical="' + hasCritical + '" data-high="' + hasHigh + '"';
        
        html += `
            <div class="${blockClass}" ${dataAttrs}>
                <div class="sca-component-header" onclick="window.toggleScaBlock('${bodyId}', '${arrowId}')">
                    <div class="sca-component-name">
                        <strong>${this.escapeHtml(comp.name)}</strong>
                        <span class="sca-component-version">v${this.escapeHtml(comp.version)}</span>
                        ${badgeHtml}
                    </div>
                    <div class="sca-component-stats">
                        <span>${statsHtml}</span>
                        <span class="sca-component-arrow" id="${arrowId}">${hasVulns ? '▾' : '▸'}</span>
                    </div>
                </div>
                <div class="sca-component-body ${hasVulns ? 'open' : ''}" id="${bodyId}">
                    ${tableHtml}
                    ${!hasVulns ? '<div style="text-align:center;padding:12px;color:#28a745;font-size:13px;"><i class="fas fa-check"></i> All checks passed, no vulnerabilities found</div>' : ''}
                </div>
            </div>
        `;
    }
    
    return html;
};

// ============================================================
// GET SEVERITY
// ============================================================

SCAPopupReporter.prototype.getSeverity = function(vuln) {
    if (vuln.ratings && vuln.ratings.length > 0 && vuln.ratings[0].severity) {
        var sev = vuln.ratings[0].severity.toUpperCase();
        if (sev === 'CRITICAL') return 'CRITICAL';
        if (sev === 'HIGH') return 'HIGH';
        if (sev === 'MODERATE' || sev === 'MEDIUM') return 'MODERATE';
        if (sev === 'LOW') return 'LOW';
        return sev;
    }
    
    if (vuln.vulnerability) {
        var v = vuln.vulnerability;
        if (v.severity) {
            var sev2 = v.severity.toUpperCase();
            if (sev2 === 'CRITICAL') return 'CRITICAL';
            if (sev2 === 'HIGH') return 'HIGH';
            if (sev2 === 'MODERATE' || sev2 === 'MEDIUM') return 'MODERATE';
            if (sev2 === 'LOW') return 'LOW';
            return sev2;
        }
        if (v.ratings && v.ratings.length > 0 && v.ratings[0].severity) {
            var sev3 = v.ratings[0].severity.toUpperCase();
            if (sev3 === 'CRITICAL') return 'CRITICAL';
            if (sev3 === 'HIGH') return 'HIGH';
            if (sev3 === 'MODERATE' || sev3 === 'MEDIUM') return 'MODERATE';
            if (sev3 === 'LOW') return 'LOW';
            return sev3;
        }
    }
    
    if (vuln.severity) {
        var sev4 = vuln.severity.toUpperCase();
        if (sev4 === 'CRITICAL') return 'CRITICAL';
        if (sev4 === 'HIGH') return 'HIGH';
        if (sev4 === 'MODERATE' || sev4 === 'MEDIUM') return 'MODERATE';
        if (sev4 === 'LOW') return 'LOW';
        return sev4;
    }
    
    return 'UNKNOWN';
};

// ============================================================
// ESCAPE HTML
// ============================================================

SCAPopupReporter.prototype.escapeHtml = function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

// ============================================================
// EXTRACT STATS
// ============================================================

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
            var severity = this.getSeverity(v);
            if (severity === 'CRITICAL') critical++;
            else if (severity === 'HIGH') high++;
            else if (severity === 'MODERATE' || severity === 'MEDIUM') moderate++;
            else if (severity === 'LOW') low++;
        }
    }
    
    return { components: components, vulnerabilities: vulnerabilities, critical: critical, high: high, moderate: moderate, low: low };
};

// ============================================================
// INIT TOGGLES
// ============================================================

SCAPopupReporter.prototype.initComponentToggles = function(overlay) {
    window.toggleScaBlock = function(bodyId, arrowId) {
        var body = document.getElementById(bodyId);
        var arrow = document.getElementById(arrowId);
        if (body) {
            body.classList.toggle('open');
            if (arrow) {
                arrow.classList.toggle('open');
            }
        }
    };
};

// ============================================================
// SEARCH AND FILTER
// ============================================================

SCAPopupReporter.prototype.initSearchFilter = function(overlay) {
    var searchInput = overlay.querySelector('#scaSearch');
    var filterSelect = overlay.querySelector('#scaFilter');
    var blocks = overlay.querySelectorAll('.sca-component-block');
    var countSpan = overlay.querySelector('.sca-block-count');
    
    function filterBlocks() {
        var searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        var filterValue = filterSelect ? filterSelect.value : 'all';
        var visibleCount = 0;
        
        blocks.forEach(function(block) {
            var name = block.getAttribute('data-name') || '';
            var hasVulns = block.getAttribute('data-has-vulns') === 'true';
            var hasCritical = block.getAttribute('data-critical') === 'true';
            var hasHigh = block.getAttribute('data-high') === 'true';
            
            var matchesSearch = searchTerm === '' || name.indexOf(searchTerm) !== -1;
            var matchesFilter = true;
            
            switch (filterValue) {
                case 'has-issues': matchesFilter = hasVulns; break;
                case 'no-issues': matchesFilter = !hasVulns; break;
                case 'critical': matchesFilter = hasCritical; break;
                case 'high': matchesFilter = hasHigh && !hasCritical; break;
                default: matchesFilter = true;
            }
            
            if (matchesSearch && matchesFilter) {
                block.style.display = '';
                visibleCount++;
            } else {
                block.style.display = 'none';
            }
        });
        
        if (countSpan) {
            countSpan.textContent = visibleCount + ' components';
        }
    }
    
    if (searchInput) searchInput.addEventListener('input', filterBlocks);
    if (filterSelect) filterSelect.addEventListener('change', filterBlocks);
};

SCAPopupReporter.prototype.downloadHTML = function() {
    try {
        var defaultName = 'sca-report-' + new Date().toISOString().split('T')[0];
        var reportName = prompt('Enter report name:', defaultName);
        if (reportName === null) return;
        if (reportName.trim() === '') reportName = defaultName;
        reportName = reportName.trim().replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').substring(0, 100);
        
        var htmlContent = this.generateFullHTMLReport();
        var blob = new Blob([htmlContent], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = reportName + '.html';
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('HTML report "' + reportName + '.html" downloaded successfully', 'success');
    } catch (error) {
        this.showNotification('Error downloading HTML', 'error');
    }
};

// ============================================================
// DOWNLOAD JSON
// ============================================================

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
        this.showNotification('JSON report downloaded successfully', 'success');
    } catch (error) {
        this.showNotification('Error downloading JSON', 'error');
    }
};

// ============================================================
// NOTIFICATIONS
// ============================================================

SCAPopupReporter.prototype.showNotification = function(message, type) {
    type = type || 'success';
    var notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: ' + (type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6') + '; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10001; animation: slideIn 0.3s ease; font-family: "Fira Sans", sans-serif; font-size: 14px;';
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

// ============================================================
// GENERATE FULL HTML REPORT
// ============================================================

SCAPopupReporter.prototype.generateFullHTMLReport = function() {
    var stats = this.extractStats();
    var groupedComponents = this.groupComponents();
    
    var totalVulns = 0;
    for (var i = 0; i < groupedComponents.length; i++) {
        totalVulns += groupedComponents[i].vulns.length;
    }
    
    var componentBlocks = '';
    for (var i = 0; i < groupedComponents.length; i++) {
        var comp = groupedComponents[i];
        var vulns = comp.vulns || [];
        var hasVulns = vulns.length > 0;
        var hasCritical = false;
        var hasHigh = false;
        
        for (var v = 0; v < vulns.length; v++) {
            var severity = this.getSeverity(vulns[v]);
            if (severity === 'CRITICAL') hasCritical = true;
            if (severity === 'HIGH') hasHigh = true;
        }
        
        var badgeText = hasVulns ? (hasCritical ? '🔴 Critical' : hasHigh ? '🟠 High' : '<i class="fas fa-times"></i>Has vulnerabilities') : '<i class="fas fa-check"></i> Safe';
        
        var vulnRows = '';
        if (hasVulns) {
            vulnRows = vulns.map(function(vuln, idx) {
                var severity = this.getSeverity(vuln);
                var id = vuln.id || vuln.vulnerability?.id || 'N/A';
                var description = vuln.description || vuln.vulnerability?.description || 'No description';
                var url = vuln.source?.url || vuln.vulnerability?.source?.url || 'https://osv.dev/vulnerability/' + id;
                var remediation = vuln.remediation || vuln.vulnerability?.remediation || vuln.analysis?.detail || 'Update to latest version';
                var severityClass = 'severity-' + severity;
                
                return '<tr><td>' + (idx + 1) + '</td><td><a href="' + url + '" target="_blank" class="cve-link">' + id + '</a></td><td>' + this.escapeHtml(description.substring(0, 150)) + (description.length > 150 ? '...' : '') + '</td><td class="' + severityClass + '">' + severity + '</td><td style="font-size:11px;color:#6c757d;">' + this.escapeHtml(remediation) + '</td></tr>';
            }.bind(this)).join('');
        }
        
        componentBlocks += `
            <div class="component-block${hasCritical ? ' critical' : hasVulns ? ' issues' : ''}">
                <div class="component-header">
                    <div class="component-name">
                        <strong>${this.escapeHtml(comp.name)}</strong>
                        <span class="component-version">v${this.escapeHtml(comp.version)}</span>
                        <span class="badge${hasVulns ? (hasCritical ? '-critical' : '-issues') : '-ok'}">${badgeText}</span>
                    </div>
                    <div class="component-stats">${hasVulns ? vulns.length + ' vulnerabilities' : '<i class="fas fa-check"></i> Safe'}</div>
                </div>
                ${hasVulns ? `<div class="component-body"><table class="vuln-table"><thead><tr><th>#</th><th>CVE ID</th><th>Description</th><th>Severity</th><th>Remediation</th></tr></thead><tbody>${vulnRows}</tbody></table></div>` : `<div class="component-body" style="padding:10px 16px;color:#28a745;font-size:13px;"><i class="fas fa-check"></i> All checks passed, no vulnerabilities found</div>`}
            </div>
        `;
    }
    
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">\n    <title>Hercules | SCA - ' + new Date().toLocaleDateString() + '</title>\n    <style>\n        * { margin: 0; padding: 0; box-sizing: border-box; }\n        body { font-family: "Fira Sans", sans-serif; background: white; padding: 20px; color: #333; }\n        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }\n        .header { background: black; color: white; padding: 40px; }\n        .header h1 { font-size: 32px; margin-bottom: 10px; }\n        .header .meta { opacity: 0.9; font-size: 14px; }\n        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; padding: 30px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; }\n        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }\n        .stat-card .label { font-size: 14px; color: #6c757d; margin-bottom: 10px; }\n        .stat-card .value { font-size: 36px; font-weight: bold; }\n        .content { padding: 30px; }\n        .component-block { background: white; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px; overflow: hidden; }\n        .component-block.issues { }\n        .component-block.critical { border-left-color: #dc3545; }\n        .component-header { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; background: #fafbfc; }\n        .component-name { font-size: 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }\n        .component-version { font-weight: 400; color: #6c757d; font-size: 12px; }\n        .component-stats { font-size: 12px; color: #6c757d; }\n        .badge-ok { background: #d4edda; color: #155724; padding: 2px 12px; border-radius: 20px; font-size: 11px; font-weight: 500; }\n        .badge-issues { background: #fff3cd; color: #856404; padding: 2px 12px; border-radius: 20px; font-size: 11px; font-weight: 500; }\n        .badge-critical { background: #f8d7da; color: #721c24; padding: 2px 12px; border-radius: 20px; font-size: 11px; font-weight: 500; }\n        .component-body { padding: 0 16px 16px 16px; border-top: 1px solid #f0f0f0; }\n        .vuln-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }\n        .vuln-table th { background: #f8f9fa; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }\n        .vuln-table td { padding: 6px 12px; border-bottom: 1px solid #e9ecef; }\n        .vuln-table tr:hover { background: #f8f9fa; }\n        .severity-CRITICAL { color: #dc3545; font-weight: bold; }\n        .severity-HIGH { color: #fd7e14; font-weight: bold; }\n        .severity-MODERATE { color: #ffc107; font-weight: bold; }\n        .severity-MEDIUM { color: #ffc107; font-weight: bold; }\n        .severity-LOW { color: #28a745; font-weight: bold; }\n        .cve-link { color: #0066cc; text-decoration: none; }\n        .cve-link:hover { text-decoration: underline; }\n        .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }\n        @media (max-width: 768px) {\n            .stats { grid-template-columns: repeat(3, 1fr); padding: 12px 16px; }\n            .content { padding: 12px 16px; }\n            .header { padding: 16px 20px; }\n            .component-header { flex-direction: column; align-items: flex-start; gap: 4px; }\n            .vuln-table { font-size: 10px; }\n            .vuln-table th, .vuln-table td { padding: 4px 6px; }\n        }\n    </style>\n</head>\n<body>\n    <div class="container">\n        <div class="header">\n            <h1>Hercules | SCA</h1>\n            <div class="meta">Generated: ' + new Date().toLocaleString() + '</div>\n        </div>\n        <div class="stats">\n            <div class="stat-card"><div class="label">Components</div><div class="value" style="color:#667eea;">' + stats.components + '</div></div>\n            <div class="stat-card"><div class="label">Vulnerabilities</div><div class="value" style="color:#fd7e14;">' + totalVulns + '</div></div>\n            <div class="stat-card"><div class="label">Critical</div><div class="value" style="color:#dc3545;">' + stats.critical + '</div></div>\n            <div class="stat-card"><div class="label">High</div><div class="value" style="color:#fd7e14;">' + stats.high + '</div></div>\n            <div class="stat-card"><div class="label">Moderate</div><div class="value" style="color:#ffc107;">' + stats.moderate + '</div></div>\n            <div class="stat-card"><div class="label">Low</div><div class="value" style="color:#28a745;">' + stats.low + '</div></div>\n        </div>\n        <div class="content">\n            <h3 style="margin-bottom:16px;font-size:16px;">All components (' + groupedComponents.length + ')</h3>\n            ' + (groupedComponents.length > 0 ? componentBlocks : '<div style="text-align:center;padding:40px;color:#999;">No components found</div>') + '\n        </div>\n        <div class="footer">\n            <p>Generated with Hercules | Analysis based on public CVE databases</p>\n            <p>It is recommended to update vulnerable components to the latest versions</p>\n        </div>\n    </div>\n</body>\n</html>';
};

// ============================================================
// ADD EVENT LISTENERS
// ============================================================

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

// ============================================================
// HANDLE REPORT DATA
// ============================================================

function handleReportData(reportData) {
    if (!reportData) {
        alert('Error: no data to display');
        return;
    }
    try {
        var reporter = new SCAPopupReporter(reportData);
        reporter.showPopup();
    } catch (error) {
        alert('Error displaying report: ' + error.message);
    }
}

// ============================================================
// GLOBAL EXPORTS
// ============================================================

window.showToolNotification = showToolNotification;
window.setActiveTool = setActiveTool;
window.updateTaskStatus = updateTaskStatus;
window.animateProgress = animateProgress;
window.findTaskElement = findTaskElement;
window.clearRepoInput = clearRepoInput;
window.handleReportData = handleReportData;
window.SCAPopupReporter = SCAPopupReporter;
window.toggleScaBlock = function(bodyId, arrowId) {
    var body = document.getElementById(bodyId);
    var arrow = document.getElementById(arrowId);
    if (body) {
        body.classList.toggle('open');
        if (arrow) {
            arrow.classList.toggle('open');
        }
    }
};