import { loadSettingsFromServer, updateAuth, checkUpdatesOnServer, downloadUpdate, getCurrentVersion } from './client.js';

// ==================== НАСТРОЙКИ ОБНОВЛЕНИЙ ====================

function saveUpdateSettings() {
    const autoCheckToggle = document.getElementById('autoCheckUpdates');
    const updateChannel = document.getElementById('updateChannel');
    
    const settings = {
        autoCheckUpdates: autoCheckToggle ? autoCheckToggle.checked : true,
        updateChannel: updateChannel ? updateChannel.value : 'stable'
    };
    localStorage.setItem('hercules_update_settings', JSON.stringify(settings));
}

// ==================== НАСТРОЙКИ ДОСТУПА ====================

async function saveSettings() {
    const authToggle = document.getElementById('authEnabled');
    const password = document.getElementById('loginPassword');
    const confirm = document.getElementById('confirmPassword');
    
    if (authToggle && authToggle.checked && password && confirm) {
        if (password.value !== confirm.value) {
            showNotification('Пароли не совпадают!', 'error');
            return;
        }
        if (password.value.length < 4 && password.value.length > 0) {
            showNotification('Пароль должен быть не менее 4 символов!', 'error');
            return;
        }
    }
    
    const settings = {
        authEnabled: authToggle ? authToggle.checked : false,
        loginUsername: document.getElementById('loginUsername')?.value || '',
        loginPassword: document.getElementById('loginPassword')?.value || '',
        sessionTimeout: document.getElementById('sessionTimeout')?.value || '30'
    };
    
    // Сохраняем локально
    localStorage.setItem('hercules_settings', JSON.stringify(settings));
    
    // Сохраняем на сервер
    const saved = await updateAuth(settings);
    if (saved) {
        showNotification('Настройки сохранены на сервере!', 'success');
    } else {
        showNotification('Настройки сохранены локально', 'warning');
    }
}
// ==================== ЗАГРУЗКА НАСТРОЕК ====================

async function loadSettings() {
    await loadSettingsFromServer();
    
    // Загружаем локальные настройки пользователя
    const saved = localStorage.getItem('hercules_settings');
    if (saved) {
        const settings = JSON.parse(saved);
        
        const authToggle = document.getElementById('authEnabled');
        const passwordFields = document.getElementById('passwordFields');
        
        if (authToggle && settings.authEnabled !== undefined) {
            authToggle.checked = settings.authEnabled;
            if (passwordFields) passwordFields.style.display = settings.authEnabled ? 'block' : 'none';
        }
        if (document.getElementById('loginUsername')) 
            document.getElementById('loginUsername').value = settings.loginUsername || '';
        if (document.getElementById('loginPassword')) 
            document.getElementById('loginPassword').value = settings.loginPassword || '';
        /*if (document.getElementById('confirmPassword')) 
            document.getElementById('confirmPassword').value = '';*/
        if (document.getElementById('sessionTimeout')) 
            document.getElementById('sessionTimeout').value = settings.sessionTimeout || '30';
    }
}

// ==================== ПРОВЕРКА ОБНОВЛЕНИЙ ====================

async function checkUpdates() {
    const resultDiv = document.getElementById('updateCheckResult');
    const downloadBtn = document.getElementById('downloadUpdateBtn');
    
    if (!resultDiv) return;
    
    resultDiv.style.display = 'block';
    resultDiv.className = 'update-result';
    resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка обновлений...';
    
    try {
        const channel = document.getElementById('updateChannel')?.value || 'stable';
        const data = await checkUpdatesOnServer(channel);
        
        if (data && data.updateAvailable) {
            resultDiv.className = 'update-result warning';
            resultDiv.innerHTML = `
                <i class="fas fa-download"></i>
                <strong>Доступна новая версия ${data.latestVersion}</strong><br>
                <span style="font-size: 12px;">Текущая: ${data.currentVersion} | Выпущена: ${data.releaseDate}</span>
            `;
            if (downloadBtn) downloadBtn.style.display = 'inline-flex';
        } else {
            resultDiv.className = 'update-result success';
            resultDiv.innerHTML = '<i class="fas fa-check-circle"></i> У вас актуальная версия';
            if (downloadBtn) downloadBtn.style.display = 'none';
        }
    } catch (error) {
        resultDiv.className = 'update-result error';
        resultDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ошибка проверки: ${error.message}`;
        if (downloadBtn) downloadBtn.style.display = 'none';
    }
}

// ==================== СБРОС НАСТРОЕК ====================

function factoryReset() {
    if (confirm('⚠️ ВНИМАНИЕ! Это действие сбросит ВСЕ настройки платформы.\n\nВы уверены?')) {
        localStorage.removeItem('hercules_settings');
        localStorage.removeItem('hercules_update_settings');
        localStorage.removeItem('hercules_analysis_history');
        location.reload();
    }
}

// ==================== УВЕДОМЛЕНИЯ ====================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : (type === 'warning' ? '#f59e0b' : '#3b82f6'));
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
    
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : (type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'));
    notification.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettingsFromServer();
    await loadSettings();
    
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) checkUpdatesBtn.addEventListener('click', checkUpdates);
    
    const downloadBtn = document.getElementById('downloadUpdateBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadUpdate);
    }
    
    const factoryResetBtn = document.getElementById('factoryResetBtn');
    if (factoryResetBtn) factoryResetBtn.addEventListener('click', factoryReset);
    
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            await saveSettings();
            saveUpdateSettings();
        });
    }
    
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            localStorage.removeItem('hercules_settings');
            localStorage.removeItem('hercules_update_settings');
            location.reload();
        });
    }
    
    const authToggle = document.getElementById('authEnabled');
    const passwordFields = document.getElementById('passwordFields');
    if (authToggle && passwordFields) {
        authToggle.addEventListener('change', () => {
            passwordFields.style.display = authToggle.checked ? 'block' : 'none';
        });
    }
});