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
        .sca-popup-overlay{
            position:fixed;inset:0;background:rgba(15,23,42,0.65);
            display:flex;justify-content:center;align-items:center;
            z-index:9999;font-family:'Fira Sans',sans-serif;padding:16px;
            backdrop-filter:blur(2px);
        }
        .sca-popup{
            background:#fff;width:96vw;max-width:1600px;max-height:92vh;
            border-radius:12px;border:1px solid #e3e8f0;
            box-shadow:0 24px 60px rgba(15,23,42,0.35);
            display:flex;flex-direction:column;overflow:hidden;
            animation:sca-slideIn 0.25s ease-out;
        }
        @keyframes sca-slideIn{from{transform:translateY(-16px);opacity:0}to{transform:translateY(0);opacity:1}}

        .sca-popup-header{
            padding:18px 24px;background:#fff;color:#0f172a;
            display:flex;justify-content:space-between;align-items:center;
            border-bottom:1px solid #e3e8f0;
        }
        .sca-popup-title{
            font-size:18px;font-weight:700;display:flex;align-items:center;gap:10px;
            letter-spacing:-0.01em;
        }
        .sca-popup-title i{color:#0891b2;font-size:18px;}
        .sca-popup-title .sub{color:#64748b;font-weight:400;font-size:13px;margin-left:8px;}
        .sca-popup-close{
            background:none;border:none;color:#64748b;font-size:22px;cursor:pointer;
            width:34px;height:34px;display:flex;align-items:center;justify-content:center;
            border-radius:6px;transition:all 0.15s;
        }
        .sca-popup-close:hover{background:#f1f5f9;color:#0f172a;}

        .sca-popup-content{
            padding:20px 24px;overflow-y:auto;flex:1;background:#f4f6fb;
        }

        .sca-stats-grid{
            display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:18px;
        }
        .sca-stat-card{
            background:#fff;padding:16px;border-radius:10px;
            border:1px solid #e3e8f0;text-align:center;transition:border-color 0.15s;
        }
        .sca-stat-card:hover{border-color:#0891b2;}
        .sca-stat-number{
            font-size:28px;font-weight:700;color:#0f172a;
            font-family:'Fira Code',monospace;line-height:1;
        }
        .sca-stat-number.c-total{color:#0891b2;}
        .sca-stat-number.c-vuln{color:#fd7e14;}
        .sca-stat-number.c-critical{color:#dc3545;}
        .sca-stat-number.c-high{color:#fd7e14;}
        .sca-stat-number.c-moderate{color:#d97706;}
        .sca-stat-number.c-low{color:#16a34a;}
        .sca-stat-label{font-size:12px;color:#64748b;margin-top:8px;}

        .sca-toolbar{
            display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;
            background:#fff;padding:12px;border:1px solid #e3e8f0;border-radius:10px;
        }
        .sca-search-input{
            flex:1;min-width:220px;padding:9px 14px;border:1px solid #e3e8f0;border-radius:6px;
            font-size:13px;font-family:'Fira Sans',sans-serif;background:#fff;color:#0f172a;
            transition:border-color 0.15s;
        }
        .sca-search-input:focus{outline:none;border-color:#0891b2;}
        .sca-filter-select{
            padding:9px 14px;border:1px solid #e3e8f0;border-radius:6px;background:#fff;
            font-size:13px;font-family:'Fira Sans',sans-serif;cursor:pointer;color:#0f172a;
        }
        .sca-filter-select:focus{outline:none;border-color:#0891b2;}
        .sca-block-count{
            font-size:12px;color:#64748b;font-family:'Fira Code',monospace;
            margin-left:auto;padding:6px 12px;background:#f8fafc;border-radius:6px;
        }

        .sca-component-block{
            background:#fff;border:1px solid #e3e8f0;border-radius:10px;
            margin-bottom:10px;overflow:hidden;transition:border-color 0.15s;
        }
        .sca-component-block:hover{border-color:#cbd5e1;}

        .sca-component-header{
            padding:14px 18px;cursor:pointer;display:flex;justify-content:space-between;
            align-items:center;user-select:none;transition:background 0.15s;
            flex-wrap:wrap;gap:8px;background:#fff;
        }
        .sca-component-header:hover{background:#f8fafc;}
        .sca-component-name{
            font-weight:600;font-size:14px;display:flex;align-items:center;gap:10px;
            flex-wrap:wrap;color:#0f172a;
        }
        .sca-component-name strong{font-weight:700;}
        .sca-component-version{
            font-weight:400;color:#64748b;font-size:12px;
            font-family:'Fira Code',monospace;padding:2px 8px;background:#f1f5f9;border-radius:4px;
        }
        .sca-component-badge{
            font-size:11px;padding:3px 10px;border-radius:4px;font-weight:600;
            font-family:'Fira Code',monospace;text-transform:uppercase;letter-spacing:0.04em;
            display:inline-flex;align-items:center;gap:6px;
        }
        .sca-component-badge.ok{background:#dcfce7;color:#15803d;}
        .sca-component-badge.issues{background:#fef3c7;color:#a16207;}
        .sca-component-badge.critical{background:#fee2e2;color:#b91c1c;}
        .sca-component-stats{
            font-size:12px;color:#64748b;display:flex;gap:12px;align-items:center;
            font-family:'Fira Code',monospace;
        }
        .sca-component-arrow{
            font-size:14px;color:#94a3b8;transition:transform 0.2s;margin-left:4px;
        }
        .sca-component-arrow.open{transform:rotate(180deg);}

        .sca-component-body{
            display:none;padding:0 18px 18px;border-top:1px solid #f1f5f9;background:#fff;
        }
        .sca-component-body.open{display:block;}

        .sca-vuln-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px;}
        .sca-vuln-table th{
            background:#f8fafc;padding:10px 12px;text-align:left;font-weight:700;
            border-bottom:1px solid #e3e8f0;font-size:10px;color:#64748b;
            text-transform:uppercase;letter-spacing:0.05em;
        }
        .sca-vuln-table td{
            padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-size:12px;
        }
        .sca-vuln-table tr:last-child td{border-bottom:none;}
        .sca-vuln-table tr:hover{background:#f8fafc;}

        .sca-severity-badge{
            display:inline-block;padding:2px 8px;border-radius:4px;
            font-size:10px;font-weight:700;font-family:'Fira Code',monospace;
            text-transform:uppercase;letter-spacing:0.04em;
        }
        .sca-severity-CRITICAL{background:#fee2e2;color:#b91c1c;}
        .sca-severity-HIGH{background:#ffedd5;color:#c2410c;}
        .sca-severity-MODERATE{background:#fef3c7;color:#a16207;}
        .sca-severity-LOW{background:#dcfce7;color:#15803d;}
        .sca-severity-UNKNOWN{background:#f1f5f9;color:#64748b;}

        .sca-cve-link{
            color:#0891b2;text-decoration:none;font-family:'Fira Code',monospace;
            font-weight:600;font-size:12px;
        }
        .sca-cve-link:hover{text-decoration:underline;}

        .sca-empty-state{text-align:center;padding:40px;color:#94a3b8;font-size:13px;}

        .sca-remediation{font-size:11px;color:#64748b;line-height:1.5;}
        .sca-vuln-description{font-size:12px;color:#475569;max-width:520px;line-height:1.5;}
        .sca-safe-text{
            color:#15803d;font-weight:500;font-size:13px;
            display:flex;align-items:center;justify-content:center;gap:6px;padding:14px;
        }

        .sca-popup-footer{
            padding:14px 24px;background:#f8fafc;border-top:1px solid #e3e8f0;
            display:flex;justify-content:flex-end;gap:10px;
        }
        .sca-btn{
            padding:9px 18px;border:none;border-radius:6px;font-size:13px;font-weight:600;
            font-family:'Fira Sans',sans-serif;cursor:pointer;transition:all 0.15s;
            display:inline-flex;align-items:center;gap:8px;
        }
        .sca-btn i{font-size:13px;}
        .sca-btn-html{background:#0891b2;color:#fff;}
        .sca-btn-html:hover{background:#0e7490;}
        .sca-btn-json{background:#10b981;color:#fff;}
        .sca-btn-json:hover{background:#0e9f6e;}
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
                <i class="fas fa-cubes"></i>
                SCA Analysis Results
                <span class="sub">${groupedComponents.length} components · ${totalVulns} vulnerabilities</span>
            </div>
            <button class="sca-popup-close" id="closePopup" aria-label="Close"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="sca-popup-content">
            <div class="sca-stats-grid">
                <div class="sca-stat-card"><div class="sca-stat-number c-total">${stats.components}</div><div class="sca-stat-label">Components</div></div>
                <div class="sca-stat-card"><div class="sca-stat-number c-vuln">${totalVulns}</div><div class="sca-stat-label">Vulnerabilities</div></div>
                <div class="sca-stat-card"><div class="sca-stat-number c-critical">${stats.critical}</div><div class="sca-stat-label">Critical</div></div>
                <div class="sca-stat-card"><div class="sca-stat-number c-high">${stats.high}</div><div class="sca-stat-label">High</div></div>
                <div class="sca-stat-card"><div class="sca-stat-number c-moderate">${stats.moderate}</div><div class="sca-stat-label">Moderate</div></div>
                <div class="sca-stat-card"><div class="sca-stat-number c-low">${stats.low}</div><div class="sca-stat-label">Low</div></div>
            </div>

            <div class="sca-toolbar">
                <input type="text" class="sca-search-input" id="scaSearch" placeholder="Search component...">
                <select class="sca-filter-select" id="scaFilter">
                    <option value="all">All components</option>
                    <option value="has-issues">With vulnerabilities</option>
                    <option value="no-issues">Without vulnerabilities</option>
                    <option value="critical">Critical only</option>
                    <option value="high">High only</option>
                </select>
                <span class="sca-block-count">${groupedComponents.length} components</span>
            </div>

            <div id="scaComponents">
                ${this.renderComponentBlocks(groupedComponents)}
            </div>
        </div>
        <div class="sca-popup-footer">
            <button id="downloadJsonBtn" class="sca-btn sca-btn-json"><i class="fas fa-file-code"></i> Download JSON</button>
            <button id="downloadHtmlBtn" class="sca-btn sca-btn-html"><i class="fas fa-file-arrow-down"></i> Download HTML</button>
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

        var badgeText = hasVulns
            ? (hasCritical ? '<i class="fas fa-triangle-exclamation"></i> Critical' : hasHigh ? '<i class="fas fa-circle-exclamation"></i> High' : '<i class="fas fa-circle-exclamation"></i> Has issues')
            : '<i class="fas fa-check"></i> Safe';

        var vulnRows = '';
        if (hasVulns) {
            vulnRows = vulns.map(function(vuln, idx) {
                var sev = this.getSeverity(vuln);
                var id = vuln.id || (vuln.vulnerability && vuln.vulnerability.id) || 'N/A';
                var description = vuln.description || (vuln.vulnerability && vuln.vulnerability.description) || 'No description';
                var url = (vuln.source && vuln.source.url) || (vuln.vulnerability && vuln.vulnerability.source && vuln.vulnerability.source.url) || ('https://osv.dev/vulnerability/' + id);
                var remediation = vuln.remediation || (vuln.vulnerability && vuln.vulnerability.remediation) || (vuln.analysis && vuln.analysis.detail) || 'Update to latest version';

                return '<tr>' +
                    '<td class="num">' + (idx + 1) + '</td>' +
                    '<td><a href="' + url + '" target="_blank" rel="noopener" class="cve-link">' + id + '</a></td>' +
                    '<td class="desc">' + this.escapeHtml(description.substring(0, 180)) + (description.length > 180 ? '…' : '') + '</td>' +
                    '<td><span class="sev-badge sev-' + sev + '">' + sev + '</span></td>' +
                    '<td class="rem">' + this.escapeHtml(remediation) + '</td>' +
                    '</tr>';
            }.bind(this)).join('');
        }

        componentBlocks += `
            <div class="component-block${hasCritical ? ' critical' : hasVulns ? ' issues' : ''}">
                <div class="component-header">
                    <div class="component-name">
                        <strong>${this.escapeHtml(comp.name)}</strong>
                        <span class="component-version">v${this.escapeHtml(comp.version)}</span>
                        <span class="badge badge-${hasCritical ? 'critical' : hasVulns ? 'issues' : 'ok'}">${badgeText}</span>
                    </div>
                    <div class="component-stats">${hasVulns ? vulns.length + ' vulnerabilities' : '<i class="fas fa-check"></i> Safe'}</div>
                </div>
                ${hasVulns
                    ? `<div class="component-body"><table class="vuln-table"><thead><tr><th>#</th><th>CVE ID</th><th>Description</th><th>Severity</th><th>Remediation</th></tr></thead><tbody>${vulnRows}</tbody></table></div>`
                    : `<div class="component-body"><div class="safe-text"><i class="fas fa-check"></i> All checks passed, no vulnerabilities found</div></div>`}
            </div>
        `;
    }

    var generated = new Date().toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <title>Hercules | SCA - ${new Date().toLocaleDateString()}</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Fira Sans',sans-serif;background:#f4f6fb;padding:24px;color:#0f172a;min-height:100vh;}
        .container{max-width:1600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e3e8f0;box-shadow:0 4px 24px rgba(15,23,42,0.06);overflow:hidden;}

        .header{background:#fff;padding:28px 32px;border-bottom:1px solid #e3e8f0;}
        .header h1{font-size:22px;display:flex;align-items:center;gap:12px;font-weight:700;letter-spacing:-0.01em;}
        .header h1 i{color:#0891b2;font-size:22px;}
        .header p{color:#64748b;font-size:13px;margin-top:10px;}
        .meta{display:flex;gap:22px;font-size:12px;color:#64748b;flex-wrap:wrap;margin-top:10px;}
        .meta span{display:flex;align-items:center;gap:6px;}
        .meta i{color:#0891b2;font-size:12px;}

        .stats{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;padding:28px 32px 0;}
        .stat-card{background:#f8fafc;border:1px solid #e3e8f0;border-radius:10px;padding:18px;text-align:center;transition:border-color 0.15s;}
        .stat-card:hover{border-color:#0891b2;}
        .stat-card .label{font-size:12px;color:#64748b;margin-bottom:8px;}
        .stat-card .value{font-size:30px;font-weight:700;font-family:'Fira Code',monospace;line-height:1;}
        .v-total{color:#0891b2}.v-vuln{color:#fd7e14}.v-critical{color:#dc3545}
        .v-high{color:#fd7e14}.v-moderate{color:#d97706}.v-low{color:#16a34a}

        .content{padding:28px 32px;}

        .component-block{background:#fff;border:1px solid #e3e8f0;border-radius:10px;margin-bottom:10px;overflow:hidden;transition:border-color 0.15s;}

        .component-block:hover{border-color:#cbd5e1;}

        .component-header{padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#fff;border-bottom:1px solid #f1f5f9;}
        .component-name{font-size:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-weight:600;color:#0f172a;}
        .component-name strong{font-weight:700;}
        .component-version{font-weight:400;color:#64748b;font-size:12px;font-family:'Fira Code',monospace;padding:2px 8px;background:#f1f5f9;border-radius:4px;}
        .component-stats{font-size:12px;color:#64748b;font-family:'Fira Code',monospace;}

        .badge{padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;font-family:'Fira Code',monospace;text-transform:uppercase;letter-spacing:0.04em;display:inline-flex;align-items:center;gap:6px;}
        .badge-ok{background:#dcfce7;color:#15803d;}
        .badge-issues{background:#fef3c7;color:#a16207;}
        .badge-critical{background:#fee2e2;color:#b91c1c;}

        .component-body{padding:0 18px 18px;background:#fff;}
        .vuln-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px;}
        .vuln-table th{background:#f8fafc;padding:10px 12px;text-align:left;font-weight:700;border-bottom:1px solid #e3e8f0;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;}
        .vuln-table td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top;}
        .vuln-table tr:last-child td{border-bottom:none;}
        .vuln-table tr:hover{background:#f8fafc;}
        .vuln-table td.num{text-align:center;color:#94a3b8;font-family:'Fira Code',monospace;}
        .vuln-table td.desc{color:#475569;max-width:520px;line-height:1.5;}
        .vuln-table td.rem{color:#64748b;font-size:11px;line-height:1.5;}

        .sev-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;font-family:'Fira Code',monospace;text-transform:uppercase;letter-spacing:0.04em;}
        .sev-CRITICAL{background:#fee2e2;color:#b91c1c;}
        .sev-HIGH{background:#ffedd5;color:#c2410c;}
        .sev-MODERATE{background:#fef3c7;color:#a16207;}
        .sev-LOW{background:#dcfce7;color:#15803d;}
        .sev-UNKNOWN{background:#f1f5f9;color:#64748b;}

        .cve-link{color:#0891b2;text-decoration:none;font-family:'Fira Code',monospace;font-weight:600;font-size:12px;}
        .cve-link:hover{text-decoration:underline;}

        .safe-text{color:#15803d;font-weight:500;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;padding:14px;}

        .footer{padding:18px 32px;background:#f8fafc;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e3e8f0;line-height:1.7;}
        .footer strong{color:#64748b;}

        @media (max-width:1100px){
            .stats{grid-template-columns:repeat(3,1fr);}
        }
        @media (max-width:768px){
            body{padding:12px}
            .header{padding:20px}
            .content{padding:20px}
            .stats{padding:20px 20px 0;grid-template-columns:repeat(2,1fr)}
            .component-header{flex-direction:column;align-items:flex-start;gap:6px;}
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-cubes"></i> Hercules | SCA</h1>
            <p>Software Composition Analysis report</p>
            <div class="meta">
                <span><i class="fas fa-calendar"></i> Generated: ${generated}</span>
                <span><i class="fas fa-cube"></i> ${stats.components} components</span>
                <span><i class="fas fa-shield-halved"></i> ${totalVulns} vulnerabilities</span>
            </div>
        </div>

        <div class="stats">
            <div class="stat-card"><div class="label">Components</div><div class="value v-total">${stats.components}</div></div>
            <div class="stat-card"><div class="label">Vulnerabilities</div><div class="value v-vuln">${totalVulns}</div></div>
            <div class="stat-card"><div class="label">Critical</div><div class="value v-critical">${stats.critical}</div></div>
            <div class="stat-card"><div class="label">High</div><div class="value v-high">${stats.high}</div></div>
            <div class="stat-card"><div class="label">Moderate</div><div class="value v-moderate">${stats.moderate}</div></div>
            <div class="stat-card"><div class="label">Low</div><div class="value v-low">${stats.low}</div></div>
        </div>

        <div class="content">
            <h3 style="margin-bottom:16px;font-size:15px;color:#0f172a;font-weight:700;">All components (${groupedComponents.length})</h3>
            ${groupedComponents.length > 0 ? componentBlocks : '<div class="safe-text">No components found</div>'}
        </div>

        <div class="footer">
            <p>Generated with <strong>Hercules | SCA</strong> · Analysis based on public CVE databases</p>
            <p>It is recommended to update vulnerable components to the latest versions</p>
        </div>
    </div>
</body>
</html>`;
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