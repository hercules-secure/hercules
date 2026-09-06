
let serverSettings = null;



async function loadSettingsFromServer() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        
        if (data.success) {
            const config = data.settings || {};
            
            function flattenConfig(obj, prefix = '') {
                const result = {};
                for (const [key, value] of Object.entries(obj)) {
                    const newKey = prefix ? `${prefix}.${key}` : key;
                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        Object.assign(result, flattenConfig(value, newKey));
                    } else {
                        result[newKey] = value;
                    }
                }
                return result;
            }
            
            const flatConfig = flattenConfig(config);
            
            document.querySelectorAll('[data-path]').forEach(element => {
                const path = element.getAttribute('data-path');
                const value = flatConfig[path];

                if (value === undefined) return;
                
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else if (element.tagName === 'SELECT' || element.tagName === 'INPUT') {
                    element.value = value;
                } else {
                    element.textContent = value;
                }
            });
            
            for (const [path, value] of Object.entries(flatConfig)) {
                if (path === 'auth.authEnabled') {
                    const passwordFields = document.getElementById('passwordFields');
                    if (passwordFields) passwordFields.style.display = value ? 'block' : 'none';
                }

                if (path === 'history.enabled') {
                    const historyRow = document.getElementById('historyStorageRow');
                    if (historyRow) historyRow.style.display = value ? 'flex' : 'none';
                }

                if (path === 'integrations.git.enabled') {
                    const gitSettings = document.getElementById('gitIntegrationSettings');
                    if (gitSettings) gitSettings.style.display = value ? 'block' : 'none';
                }

                if (path === 'integrations.mattermost.enabled') {
                    const mattermostSettings = document.getElementById('mattermostSettings');
                    if (mattermostSettings) mattermostSettings.style.display = value ? 'block' : 'none';
                }
                
                if (path === 'integrations.email.enabled') {
                    const emailSettings = document.getElementById('emailSettings');
                    if (emailSettings) emailSettings.style.display = value ? 'block' : 'none';
                }

                if (path === 'integrations.jira.enabled') {
                    const jiraSettings = document.getElementById('jiraSettings');
                    if (jiraSettings) jiraSettings.style.display = value ? 'block' : 'none';
                }

                if (path === 'integrations.yandex.enabled') {
                    const yandexSettings = document.getElementById('yandexSettings');
                    if (yandexSettings) yandexSettings.style.display = value ? 'block' : 'none';
                }
            }
            
            return config.info;
        }
        return null;
    } catch (error) {
        
        return null;
    }
}


async function patchConfig(items) {
    try {
        
        const response = await fetch('/api/config', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items: items })
        });
        
        const data = await response.json();
        
        if (data.success) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (!data.success) {
            return { authenticated: false, authEnabled: false };
        }
        
        if (data.authenticated) {
            localStorage.setItem('hercules_auth', JSON.stringify({
                authenticated: true,
                checkedAt: Date.now()
            }));
        } else if (data.authEnabled) {
            localStorage.removeItem('hercules_auth');
        }
        
        return {
            authenticated: data.authenticated,
            authEnabled: data.authEnabled
        };
    } catch (error) {
        return { authenticated: false, authEnabled: false };
    }
}

async function login(username, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('hercules_auth', JSON.stringify({
                authenticated: true,
                checkedAt: Date.now()
            }));
            return { success: true, sessionTimeout: data.sessionTimeout };
        }
        return { success: false, error: data.message || 'Ошибка входа' };
    } catch (error) {
        return { success: false, error: 'Ошибка соединения' };
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        localStorage.removeItem('hercules_auth');
        return true;
    } catch (error) {
        return false;
    }
}

async function getAuthConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        
        if (data.success && data.settings.auth) {
            return data.settings.auth;
        }
        return { authEnabled: false, users: {} };
    } catch (error) {
        return { authEnabled: false, users: {} };
    }
}

async function checkUpdatesOnServer(channel) {
    try {
        const response = await fetch(`/api/updates/check?channel=${channel}`);
        const data = await response.json();
        return data;
    } catch (error) {
        return null;
    }
}


function downloadUpdate() {
    window.open('/api/updates/download', '_blank');
}

async function clearLogsOnServer() {
    try {
        const response = await fetch('/api/logs/clear', {
            method: 'DELETE'
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        return false;
    }
}

function downloadLogs() {
    window.open('/api/logs/download', '_blank');
}

async function loadHistory(filter = 'all') {
    try {
        const response = await fetch(`/api/history?filter=${filter}`);
        const data = await response.json();
        return data.history || [];
    } catch (error) {
        return [];
    }
}

async function saveAnalysisResult(result) {
    try {
        const response = await fetch('/api/history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(result)
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        return false;
    }
}


async function clearHistory() {
    try {
        const response = await fetch('/api/history', {
            method: 'DELETE'
        });
        const data = await response.json();
        return data.success;
    } catch (error) {
        return false;
    }
}

async function getCurrentVersion() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        if (data.success && data.settings.info) {
            return data.settings.info['version-number'] || 'v1.0.0';
        }
    } catch (error) {
    }
    
    return 'v1.0.0';
}





export {

    loadSettingsFromServer,
    patchConfig,
    checkAuthStatus,
    login,
    logout,
    getAuthConfig,
    checkUpdatesOnServer,
    downloadUpdate,
    clearLogsOnServer,
    downloadLogs,
    loadHistory,
    saveAnalysisResult,
    clearHistory,
    getCurrentVersion,
    serverSettings
};