// ==================== CLIENT.JS - API ВЫЗОВЫ К СЕРВЕРУ ====================

// Глобальная переменная для хранения настроек с сервера
let serverSettings = null;

// ==================== НАСТРОЙКИ СЕРВЕРА ====================


async function loadSettingsFromServer() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        
        if (data.success) {
            const config = data.settings || {};
            
            // Рекурсивно собираем все ключи
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
            
            // Пробегаем по всем элементам с атрибутом data-path
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
            
            // Автоматически показываем/скрываем блоки по id, которые совпадают с путем
            for (const [path, value] of Object.entries(flatConfig)) {
                // Авторизация
                if (path === 'auth.authEnabled') {
                    const passwordFields = document.getElementById('passwordFields');
                    if (passwordFields) passwordFields.style.display = value ? 'block' : 'none';
                }
                
                // История
                if (path === 'history.enabled') {
                    const historyRow = document.getElementById('historyStorageRow');
                    if (historyRow) historyRow.style.display = value ? 'flex' : 'none';
                }
                
                // ========== ИНТЕГРАЦИИ ==========
                // Git интеграция
                if (path === 'integrations.git.enabled') {
                    const gitSettings = document.getElementById('gitIntegrationSettings');
                    if (gitSettings) gitSettings.style.display = value ? 'block' : 'none';
                }
                
                // Mattermost
                if (path === 'integrations.mattermost.enabled') {
                    const mattermostSettings = document.getElementById('mattermostSettings');
                    if (mattermostSettings) mattermostSettings.style.display = value ? 'block' : 'none';
                }
                
                // Email
                if (path === 'integrations.email.enabled') {
                    const emailSettings = document.getElementById('emailSettings');
                    if (emailSettings) emailSettings.style.display = value ? 'block' : 'none';
                }
                
                // Jira
                if (path === 'integrations.jira.enabled') {
                    const jiraSettings = document.getElementById('jiraSettings');
                    if (jiraSettings) jiraSettings.style.display = value ? 'block' : 'none';
                }
                
                // Yandex Tracker
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

// ==================== МАССОВОЕ ОБНОВЛЕНИЕ НАСТРОЕК (PATCH) ====================

// Универсальное обновление настроек через PATCH
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

// ==================== АВТОРИЗАЦИЯ ====================

// Проверка статуса сессии
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

// Вход в систему
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

// Выход из системы
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        localStorage.removeItem('hercules_auth');
        return true;
    } catch (error) {
        return false;
    }
}

// Получение настроек авторизации
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

// ==================== ОБНОВЛЕНИЯ ====================

// Проверка обновлений (GET /api/updates/check)
async function checkUpdatesOnServer(channel) {
    try {
        const response = await fetch(`/api/updates/check?channel=${channel}`);
        const data = await response.json();
        return data;
    } catch (error) {
        return null;
    }
}

// Скачивание обновления (GET /api/updates/download)
function downloadUpdate() {
    window.open('/api/updates/download', '_blank');
}

// ==================== ЛОГИ ====================

// Очистка логов (DELETE /api/logs/clear)
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

// Скачивание логов (GET /api/logs/download)
function downloadLogs() {
    window.open('/api/logs/download', '_blank');
}

// ==================== ИСТОРИЯ ====================

// Загрузка истории (GET /api/history)
async function loadHistory(filter = 'all') {
    try {
        const response = await fetch(`/api/history?filter=${filter}`);
        const data = await response.json();
        return data.history || [];
    } catch (error) {
        return [];
    }
}

// Сохранение результата анализа (POST /api/history)
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

// Очистка истории (DELETE /api/history)
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

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// // Получение текущей версии
async function getCurrentVersion() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        if (data.success && data.settings.info) {
            return data.settings.info['version-number'] || 'v1.0.0';
        }
    } catch (error) {
        // Ошибка
    }
    
    return 'v1.0.0';
}




// Экспорт функций
export {
    // Основные
    loadSettingsFromServer,
    patchConfig,
    
    // Авторизация
    checkAuthStatus,
    login,
    logout,
    getAuthConfig,
    
    // Обновления
    checkUpdatesOnServer,
    downloadUpdate,
    
    // Логи
    clearLogsOnServer,
    downloadLogs,
    
    // История
    loadHistory,
    saveAnalysisResult,
    clearHistory,
    
    // Вспомогательные
    getCurrentVersion,
    serverSettings
};