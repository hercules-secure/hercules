// ============================================================
// palette-client.js - КЛИЕНТ ДЛЯ ВЗАИМОДЕЙСТВИЯ С РОУТЕРОМ
// ============================================================

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getAuthHeaders() {
    var token = localStorage.getItem('licenseToken');
    if (token) {
        return { 'Authorization': 'Bearer ' + token };
    }
    return {};
}

// ============================================================
// КЛИЕНТ
// ============================================================

var PaletteClient = function(options) {
    options = options || {};
    this.baseUrl = options.baseUrl || '/api/palette';
    this.timeout = options.timeout || 30000;
    this.workflowId = null;
    this.statusInterval = null;
    this.currentStatus = null;
};

// ============================================================
// БАЗОВЫЙ ЗАПРОС
// ============================================================
PaletteClient.prototype.request = async function(endpoint, options) {
    options = options || {};
    var url = this.baseUrl + endpoint;
    var headers = {
        'Content-Type': 'application/json'
    };
    
    var authHeaders = getAuthHeaders();
    for (var key in authHeaders) {
        headers[key] = authHeaders[key];
    }
    
    if (options.headers) {
        for (var key in options.headers) {
            headers[key] = options.headers[key];
        }
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, this.timeout);

    try {
        var response = await fetch(url, {
            method: options.method || 'GET',
            headers: headers,
            body: options.body || null,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 403) {
            if (typeof window.showLicenseModal === 'function') {
                window.showLicenseModal('palette');
            } else {
                console.error('Функция showLicenseModal не найдена');
            }
            
            var error = new Error('LICENSE_REQUIRED');
            error.status = 403;
            error.needLicense = true;
            throw error;
        }

        var data = await response.json();

        if (!response.ok) {
            if (data.needLicense || data.needReauth) {
                if (typeof window.showLicenseModal === 'function') {
                    window.showLicenseModal('fuzz');
                }
                var err = new Error('LICENSE_REQUIRED');
                err.needLicense = true;
                throw err;
            }
            throw new Error(data.error || 'HTTP ' + response.status);
        }

        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new Error('REQUEST_TIMEOUT');
        }
        
        if (error.message === 'LICENSE_REQUIRED' || error.needLicense) {
            throw new Error('Требуется активация лицензии');
        }
        
        throw error;
    }
};

// ============================================================
// ЗАПУСК WORKFLOW
// ============================================================
PaletteClient.prototype.startWorkflow = async function(workflowData) {
    try {
        var result = await this.request('/start', {
            method: 'POST',
            body: JSON.stringify(workflowData)
        });

        if (result.success) {
            this.workflowId = result.workflowId;
            return {
                success: true,
                workflowId: result.workflowId,
                workflowName: result.workflowName,
                message: result.message,
                license: result.license
            };
        } else {
            throw new Error(result.error || 'Ошибка запуска workflow');
        }

    } catch (error) {
        if (error.message === 'Требуется активация лицензии' || error.needLicense) {
            throw error;
        }
        return {
            success: false,
            error: error.message
        };
    }
};

// ============================================================
// ПОЛУЧЕНИЕ СТАТУСА
// ============================================================
PaletteClient.prototype.getStatus = async function() {
    try {
        var result = await this.request('/status');
        this.currentStatus = result.status || { running: false };
        return this.currentStatus;
    } catch (error) {
        if (error.message === 'Требуется активация лицензии' || error.needLicense) {
            throw error;
        }
        return {
            running: false,
            error: error.message
        };
    }
};

// ============================================================
// ПОЛУЧЕНИЕ ЛОГОВ
// ============================================================
PaletteClient.prototype.getLogs = async function(limit) {
    limit = limit || 50;
    try {
        var result = await this.request('/logs?limit=' + limit);
        return result.logs || [];
    } catch (error) {
        if (error.message === 'Требуется активация лицензии' || error.needLicense) {
            throw error;
        }
        return [];
    }
};

// ============================================================
// ПОЛУЧЕНИЕ ИСТОРИИ
// ============================================================
PaletteClient.prototype.getHistory = async function() {
    try {
        var result = await this.request('/history');
        return result.workflows || [];
    } catch (error) {
        if (error.message === 'Требуется активация лицензии' || error.needLicense) {
            throw error;
        }
        return [];
    }
};

// ============================================================
// ПОЛУЧЕНИЕ ОТЧЁТА ПО ID
// ============================================================
PaletteClient.prototype.getReport = async function(workflowId) {
    try {
        var result = await this.request('/history/' + workflowId);
        return result.report || null;
    } catch (error) {
        if (error.message === 'Требуется активация лицензии' || error.needLicense) {
            throw error;
        }
        return null;
    }
};

// ============================================================
// МОНИТОРИНГ СТАТУСА
// ============================================================
PaletteClient.prototype.startMonitoring = function(onUpdate, interval) {
    interval = interval || 2000;
    var self = this;
    
    if (this.statusInterval) {
        this.stopMonitoring();
    }

    this.statusInterval = setInterval(async function() {
        try {
            var status = await self.getStatus();
            
            if (onUpdate) {
                onUpdate(status);
            }

            if (!status.running && (status.status === 'completed' || status.status === 'failed')) {
                self.stopMonitoring();
            }
        } catch (error) {
            if (error.message === 'Требуется активация лицензии' || error.needLicense) {
                self.stopMonitoring();
                if (onUpdate) {
                    onUpdate({ running: false, status: 'error', error: 'Требуется активация лицензии' });
                }
            }
        }
    }, interval);

    return this.statusInterval;
};

PaletteClient.prototype.stopMonitoring = function() {
    if (this.statusInterval) {
        clearInterval(this.statusInterval);
        this.statusInterval = null;
    }
};

// ============================================================
// ПРОВЕРКА ЛИЦЕНЗИИ
// ============================================================
PaletteClient.prototype.checkLicense = async function() {
    try {
        await this.request('/status');
        return { valid: true };
    } catch (error) {
        if (error.message === 'Требуется активация лицензии' || error.needLicense) {
            return { valid: false, needLicense: true };
        }
        return { valid: false, error: error.message };
    }
};

// ============================================================
// ВЫПОЛНЕНИЕ WORKFLOW С МОНИТОРИНГОМ
// ============================================================
PaletteClient.prototype.runWorkflowWithMonitoring = async function(workflowData, options) {
    options = options || {};
    var self = this;
    
    var onStart = options.onStart || null;
    var onStep = options.onStep || null;
    var onComplete = options.onComplete || null;
    var onError = options.onError || null;
    var onStatus = options.onStatus || null;
    var interval = options.interval || 2000;

    try {
        var startResult = await this.startWorkflow(workflowData);
        
        if (!startResult.success) {
            if (onError) onError(startResult.error);
            return startResult;
        }

        if (onStart) onStart(startResult);

        return new Promise(function(resolve) {
            var lastSteps = [];

            var monitor = async function() {
                try {
                    var status = await self.getStatus();
                    
                    if (onStatus) onStatus(status);
                    
                    if (status.steps && status.steps.length > 0) {
                        var newSteps = status.steps.filter(function(s) {
                            return s.status === 'completed' || s.status === 'failed';
                        });
                        
                        if (onStep && newSteps.length > lastSteps.length) {
                            var newCompleted = newSteps.slice(lastSteps.length);
                            onStep(newCompleted);
                        }
                        
                        lastSteps = newSteps;
                    }

                    if (!status.running) {
                        self.stopMonitoring();
                        
                        if (status.status === 'completed' || status.status === 'success') {
                            if (onComplete) onComplete(status);
                            resolve({ success: true, status: status });
                        } else if (status.status === 'failed' || status.status === 'error') {
                            var error = status.error || 'Workflow завершился с ошибкой';
                            if (onError) onError(error);
                            resolve({ success: false, error: error, status: status });
                        } else {
                            resolve({ success: true, status: status });
                        }
                        return;
                    }

                    setTimeout(monitor, interval);
                } catch (error) {
                    self.stopMonitoring();
                    if (error.message === 'Требуется активация лицензии' || error.needLicense) {
                        if (onError) onError('Требуется активация лицензии');
                        resolve({ success: false, error: 'Требуется активация лицензии' });
                    } else {
                        if (onError) onError(error.message);
                        resolve({ success: false, error: error.message });
                    }
                }
            };

            setTimeout(monitor, interval);
        });

    } catch (error) {
        if (error.message === 'Требуется активация лицензии' || error.needLicense) {
            if (onError) onError('Требуется активация лицензии');
            return { success: false, error: 'Требуется активация лицензии' };
        }
        if (onError) onError(error.message);
        return { success: false, error: error.message };
    }
};

// ============================================================
// ПОЛУЧЕНИЕ HTML ОТЧЁТА
// ============================================================
PaletteClient.prototype.getReportHTML = async function(workflowId) {
    try {
        var url = this.baseUrl + '/history/' + workflowId;
        var headers = {
            'Accept': 'text/html'
        };
        
        var authHeaders = getAuthHeaders();
        for (var key in authHeaders) {
            headers[key] = authHeaders[key];
        }

        var response = await fetch(url, { headers: headers });
        
        if (response.status === 403) {
            if (typeof window.showLicenseModal === 'function') {
                window.showLicenseModal('fuzz');
            }
            return null;
        }
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        
        return await response.text();
    } catch (error) {
        if (error.message === 'Требуется активация лицензии' || error.needLicense) {
            if (typeof window.showLicenseModal === 'function') {
                window.showLicenseModal('fuzz');
            }
        }
        return null;
    }
};

// ============================================================
// ИНИЦИАЛИЗАЦИЯ КЛИЕНТА
// ============================================================

var paletteClient = null;

function initPaletteClient(options) {
    options = options || {};
    paletteClient = new PaletteClient({
        baseUrl: options.baseUrl || '/api/palette',
        timeout: options.timeout || 30000
    });
    return paletteClient;
}

// ============================================================
// ФУНКЦИЯ ДЛЯ ЗАПУСКА ИЗ ПАЛИТРЫ
// ============================================================

async function runPaletteWorkflow(workflowData, options) {
    options = options || {};
    
    if (!paletteClient) {
        initPaletteClient();
    }

    var onStart = options.onStart || null;
    var onStep = options.onStep || null;
    var onComplete = options.onComplete || null;
    var onError = options.onError || null;
    var onStatus = options.onStatus || null;

    showWorkflowProgress();

    try {
        var result = await paletteClient.runWorkflowWithMonitoring(workflowData, {
            onStart: function(data) {
                updateWorkflowProgress('start', data);
                if (onStart) onStart(data);
            },
            onStep: function(steps) {
                updateWorkflowProgress('step', steps);
                if (onStep) onStep(steps);
            },
            onComplete: function(status) {
                updateWorkflowProgress('complete', status);
                if (onComplete) onComplete(status);
            },
            onError: function(error) {
                updateWorkflowProgress('error', error);
                if (onError) onError(error);
            },
            onStatus: function(status) {
                if (onStatus) onStatus(status);
            }
        });

        return result;

    } catch (error) {
        updateWorkflowProgress('error', error.message);
        if (onError) onError(error.message);
        return { success: false, error: error.message };
    }
}

// ============================================================
// UI ИНДИКАТОР ВЫПОЛНЕНИЯ
// ============================================================

function showWorkflowProgress() {
    var indicator = document.getElementById('workflowProgress');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'workflowProgress';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            border-radius: 12px;
            padding: 16px 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            z-index: 100000;
            min-width: 250px;
            font-family: 'Ubuntu', sans-serif;
            border: 1px solid #e5e7eb;
            display: none;
        `;
        indicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div class="workflow-spinner" style="width: 16px; height: 16px; border: 2px solid #e5e7eb; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <span style="font-weight: 600; font-size: 14px; color: #1a1a2e;">Выполнение workflow</span>
            </div>
            <div style="font-size: 12px; color: #6b7280;" id="workflowStatus">Запуск...</div>
            <div style="margin-top: 8px;">
                <div style="background: #f3f4f6; border-radius: 4px; height: 4px; overflow: hidden;">
                    <div id="workflowProgressBar" style="width: 0%; height: 100%; background: #3B82F6; transition: width 0.3s;"></div>
                </div>
            </div>
            <div style="margin-top: 8px; font-size: 11px; color: #9ca3af;" id="workflowSteps">0 / 0 шагов</div>
        `;
        document.body.appendChild(indicator);

        if (!document.getElementById('workflowSpinnerStyle')) {
            var style = document.createElement('style');
            style.id = 'workflowSpinnerStyle';
            style.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    indicator.style.display = 'block';
}

function updateWorkflowProgress(type, data) {
    var indicator = document.getElementById('workflowProgress');
    if (!indicator) return;

    var statusEl = document.getElementById('workflowStatus');
    var progressBar = document.getElementById('workflowProgressBar');
    var stepsEl = document.getElementById('workflowSteps');

    switch (type) {
        case 'start':
            statusEl.textContent = 'Запуск: ' + (data.workflowName || 'Workflow');
            progressBar.style.width = '10%';
            stepsEl.textContent = '0 / ' + (data.totalSteps || 0) + ' шагов';
            break;

        case 'step':
            if (data && data.length > 0) {
                var lastStep = data[data.length - 1];
                statusEl.textContent = 'Выполняется: ' + (lastStep.name || 'Шаг');
                var total = parseInt(stepsEl.textContent.split('/')[1]) || 1;
                var completed = parseInt(stepsEl.textContent.split('/')[0]) || 0;
                var newCompleted = completed + data.length;
                var percent = Math.min((newCompleted / total) * 100, 95);
                progressBar.style.width = percent + '%';
                stepsEl.textContent = newCompleted + ' / ' + total + ' шагов';
            }
            break;

        case 'complete':
            statusEl.textContent = 'Workflow завершен успешно!';
            progressBar.style.width = '100%';
            var spinner = document.querySelector('.workflow-spinner');
            if (spinner) spinner.remove();
            setTimeout(function() {
                indicator.style.display = 'none';
            }, 5000);
            break;

        case 'error':
            statusEl.textContent = 'Ошибка: ' + (typeof data === 'string' ? data : data.message || 'Неизвестная ошибка');
            progressBar.style.width = '100%';
            progressBar.style.background = '#EF4444';
            var spinner = document.querySelector('.workflow-spinner');
            if (spinner) spinner.remove();
            setTimeout(function() {
                indicator.style.display = 'none';
            }, 8000);
            break;
    }
}

// ============================================================
// РЕГИСТРАЦИЯ ФУНКЦИЙ
// ============================================================

window.PaletteClient = PaletteClient;
window.initPaletteClient = initPaletteClient;
window.runPaletteWorkflow = runPaletteWorkflow;
window.getAuthHeaders = getAuthHeaders;
window.paletteClient = paletteClient;