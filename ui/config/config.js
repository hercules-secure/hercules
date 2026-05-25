
// управление версиями и обновлениями
// Управление видимостью полей обновлений (если авто-проверка выключена)
const autoCheckToggle = document.getElementById('autoCheckUpdates');
const updateFields = document.getElementById('updateFields');

if (autoCheckToggle) {
    autoCheckToggle.addEventListener('change', () => {
        updateFields.style.display = autoCheckToggle.checked ? 'block' : 'none';
    });
}

// Загрузка настроек обновлений
function loadUpdateSettings() {
    const saved = localStorage.getItem('hercules_update_settings');
    if (saved) {
        const settings = JSON.parse(saved);
        if (autoCheckToggle) autoCheckToggle.checked = settings.autoCheckUpdates !== false;
        updateFields.style.display = settings.autoCheckUpdates !== false ? 'block' : 'none';
        
        if (document.getElementById('updateChannel')) 
            document.getElementById('updateChannel').value = settings.updateChannel || 'stable';
    } else {
        if (autoCheckToggle) autoCheckToggle.checked = true;
        if (updateFields) updateFields.style.display = 'block';
    }
}

// Сохранение настроек обновлений
function saveUpdateSettings() {
    const settings = {
        autoCheckUpdates: autoCheckToggle ? autoCheckToggle.checked : true,
        updateChannel: document.getElementById('updateChannel')?.value ?? 'stable'
    };
    localStorage.setItem('hercules_update_settings', JSON.stringify(settings));
}

// Проверка обновлений
async function checkUpdates() {
    const resultDiv = document.getElementById('updateCheckResult');
    const downloadBtn = document.getElementById('downloadUpdateBtn');
    
    resultDiv.style.display = 'block';
    resultDiv.className = 'update-result';
    resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка обновлений...';
    
    try {
        const channel = document.getElementById('updateChannel')?.value || 'stable';
        const response = await fetch(`/api/updates/check?channel=${channel}`);
        const data = await response.json();
        
        if (data.updateAvailable) {
            resultDiv.className = 'update-result warning';
            resultDiv.innerHTML = `
                <i class="fas fa-download"></i>
                <strong>Доступна новая версия ${data.latestVersion}</strong><br>
                <span style="font-size: 12px;">Текущая: v1.0.0 | Выпущена: ${data.releaseDate}</span>
            `;
            downloadBtn.style.display = 'inline-flex';
        } else {
            resultDiv.className = 'update-result success';
            resultDiv.innerHTML = '<i class="fas fa-check-circle"></i> У вас актуальная версия';
            downloadBtn.style.display = 'none';
        }
    } catch (error) {
        resultDiv.className = 'update-result error';
        resultDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка проверки: ${error.message}`;
        downloadBtn.style.display = 'none';
    }
}

// Сброс всех настроек
function factoryReset() {
    if (confirm('⚠️ ВНИМАНИЕ! Это действие сбросит ВСЕ настройки платформы.\n\nВы уверены?')) {
        localStorage.removeItem('hercules_settings');
        localStorage.removeItem('hercules_log_settings');
        localStorage.removeItem('hercules_update_settings');
        localStorage.removeItem('hercules_analysis_history');
        location.reload();
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadUpdateSettings();
    
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) checkUpdatesBtn.addEventListener('click', checkUpdates);
    
    const downloadBtn = document.getElementById('downloadUpdateBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            window.open('/api/updates/download', '_blank');
        });
    }
    
    const factoryResetBtn = document.getElementById('factoryResetBtn');
    if (factoryResetBtn) factoryResetBtn.addEventListener('click', factoryReset);
    
    // Добавляем сохранение настроек обновлений в общий save
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        const originalSave = saveBtn.onclick;
        saveBtn.addEventListener('click', () => {
            saveUpdateSettings();
        });
    }
});

// управление доступом
const authToggle = document.getElementById('authEnabled');
        const passwordFields = document.getElementById('passwordFields');

        authToggle.addEventListener('change', () => {
            passwordFields.style.display = authToggle.checked ? 'block' : 'none';
        });

        function loadSettings() {
            const saved = localStorage.getItem('hercules_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                
                if (settings.authEnabled !== undefined) document.getElementById('authEnabled').checked = settings.authEnabled;
                passwordFields.style.display = settings.authEnabled ? 'block' : 'none';
                if (settings.loginUsername) document.getElementById('loginUsername').value = settings.loginUsername;
                if (settings.loginPassword) document.getElementById('loginPassword').value = settings.loginPassword;
                if (settings.confirmPassword) document.getElementById('confirmPassword').value = settings.confirmPassword;
                if (settings.sessionTimeout) document.getElementById('sessionTimeout').value = settings.sessionTimeout;
                
                if (settings.menuSCA !== undefined) document.getElementById('menuSCA').checked = settings.menuSCA;
                if (settings.menuSAST !== undefined) document.getElementById('menuSAST').checked = settings.menuSAST;
                if (settings.menuFuzzing !== undefined) document.getElementById('menuFuzzing').checked = settings.menuFuzzing;
                if (settings.menuReports !== undefined) document.getElementById('menuReports').checked = settings.menuReports;
                if (settings.menuSettings !== undefined) document.getElementById('menuSettings').checked = settings.menuSettings;
                if (settings.menuHelp !== undefined) document.getElementById('menuHelp').checked = settings.menuHelp;
                if (settings.menuAbout !== undefined) document.getElementById('menuAbout').checked = settings.menuAbout;
                if (settings.menuIntegrations !== undefined) document.getElementById('menuIntegrations').checked = settings.menuIntegrations;
                if (settings.hideRestricted !== undefined) document.getElementById('hideRestricted').checked = settings.hideRestricted;
            }
        }

        function saveSettings() {
            const authOn = document.getElementById('authEnabled').checked;
            const password = document.getElementById('loginPassword').value;
            const confirm = document.getElementById('confirmPassword').value;
            
            if (authOn && password !== confirm) {
                showNotification('Пароли не совпадают!', 'error');
                return;
            }
            
            if (authOn && password.length < 4) {
                showNotification('Пароль должен быть не менее 4 символов!', 'error');
                return;
            }
            
            const settings = {
                authEnabled: authOn,
                loginUsername: document.getElementById('loginUsername').value,
                loginPassword: password,
                confirmPassword: confirm,
                sessionTimeout: document.getElementById('sessionTimeout').value,
                menuSCA: document.getElementById('menuSCA').checked,
                menuSAST: document.getElementById('menuSAST').checked,
                menuFuzzing: document.getElementById('menuFuzzing').checked,
                menuReports: document.getElementById('menuReports').checked,
                menuSettings: document.getElementById('menuSettings').checked,
                menuHelp: document.getElementById('menuHelp').checked,
                menuAbout: document.getElementById('menuAbout').checked,
                menuIntegrations: document.getElementById('menuIntegrations').checked,
                hideRestricted: document.getElementById('hideRestricted').checked
            };
            
            localStorage.setItem('hercules_settings', JSON.stringify(settings));
            showNotification('Настройки сохранены!', 'success');
        }

        function resetSettings() {
            localStorage.removeItem('hercules_settings');
            location.reload();
        }

        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            const bgColor = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#3b82f6');
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 24px;
                background: ${bgColor};
                color: white;
                border-radius: 8px;
                font-size: 14px;
                z-index: 9999;
                animation: slideIn 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle')}"></i> ${message}`;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.addEventListener('DOMContentLoaded', () => {
            loadSettings();
            document.getElementById('saveBtn').addEventListener('click', saveSettings);
            document.getElementById('resetBtn').addEventListener('click', resetSettings);
        });


// Управление видимостью полей логов
const logsToggle = document.getElementById('logsEnabled');
const logSettingsFields = document.getElementById('logSettingsFields');

if (logsToggle) {
    logsToggle.addEventListener('change', () => {
        logSettingsFields.style.display = logsToggle.checked ? 'block' : 'none';
    });
}

// Загрузка настроек логов
function loadLogSettings() {
    const saved = localStorage.getItem('hercules_log_settings');
    if (saved) {
        const settings = JSON.parse(saved);
        if (logsToggle) logsToggle.checked = settings.logsEnabled === true;
        logSettingsFields.style.display = settings.logsEnabled ? 'block' : 'none';
        
        if (document.getElementById('maxLogSize')) 
            document.getElementById('maxLogSize').value = settings.maxLogSize || '50';
        if (document.getElementById('logRetentionDays')) 
            document.getElementById('logRetentionDays').value = settings.logRetentionDays || '30';
        if (document.getElementById('logLevel')) 
            document.getElementById('logLevel').value = settings.logLevel || 'info';
        if (document.getElementById('separateLogs')) 
            document.getElementById('separateLogs').checked = settings.separateLogs === true;
    } else {
        // По умолчанию: логи выключены, поля скрыты
        if (logsToggle) logsToggle.checked = false;
        if (logSettingsFields) logSettingsFields.style.display = 'none';
    }
}

// Сохранение настроек логов
function saveLogSettings() {
    const settings = {
        logsEnabled: logsToggle ? logsToggle.checked : false,
        maxLogSize: document.getElementById('maxLogSize')?.value ?? '50',
        logRetentionDays: document.getElementById('logRetentionDays')?.value ?? '30',
        logLevel: document.getElementById('logLevel')?.value ?? 'info',
        separateLogs: document.getElementById('separateLogs')?.checked ?? true
    };
    localStorage.setItem('hercules_log_settings', JSON.stringify(settings));
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadLogSettings();
    loadSettings(); // другие настройки
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveLogSettings();
            saveSettings(); // существующая функция
        });
    }
});