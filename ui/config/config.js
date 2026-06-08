import { loadSettingsFromServer, patchConfig, checkUpdatesOnServer, downloadUpdate } from './client.js';

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
    // Собираем ВСЕ настройки в один массив
    const items = [];

    // Авторизация
    const authToggle = document.getElementById('authEnabled');
    if (authToggle) {
        items.push({
            item: 'auth',
            authEnabled: authToggle.checked,
            loginUsername: document.getElementById('loginUsername')?.value || '',
            loginPassword: document.getElementById('loginPassword')?.value || '',
            sessionTimeout: document.getElementById('sessionTimeout')?.value || '30'
        });
    }

    // История
    const historyToggle = document.getElementById('historyEnabled');
    if (historyToggle) {
        items.push({
            item: 'history',
            enabled: historyToggle.checked,
            retention: parseInt(document.getElementById('historyRetention')?.value || '30')
        });
    }

    // ========== ИНТЕГРАЦИИ ==========
    
    // Git (Webhook)
    const gitEnabled = document.getElementById('gitIntegrationEnabled');
    if (gitEnabled) {
        items.push({
            item: 'integrations',
            git: {
                enabled: gitEnabled.checked,
                tool: document.getElementById('gitTool')?.value || '',
                secret: document.getElementById('webhookSecret')?.value || '',
                branches: document.getElementById('webhookBranches')?.value || ''
            }
        });
    }

    // Mattermost
    const mattermostEnabled = document.getElementById('mattermostEnabled');
    if (mattermostEnabled) {
        items.push({
            item: 'integrations',
            mattermost: {
                enabled: mattermostEnabled.checked,
                webhookUrl: document.getElementById('mattermostWebhook')?.value || '',
                channel: document.getElementById('mattermostChannel')?.value || '',
                notifyOnSuccess: document.getElementById('mattermostNotifySuccess')?.checked || false,
                notifyOnError: document.getElementById('mattermostNotifyError')?.checked || false
            }
        });
    }

    // Email
    const emailEnabled = document.getElementById('emailEnabled');
    if (emailEnabled) {
        items.push({
            item: 'integrations',
            email: {
                enabled: emailEnabled.checked,
                smtpHost: document.getElementById('smtpHost')?.value || '',
                smtpPort: parseInt(document.getElementById('smtpPort')?.value || '587'),
                from: document.getElementById('emailFrom')?.value || '',
                to: document.getElementById('emailTo')?.value || '',
                password: document.getElementById('emailPassword')?.value || ''
            }
        });
    }

    // Jira
    const jiraEnabled = document.getElementById('jiraEnabled');
    if (jiraEnabled) {
        items.push({
            item: 'integrations',
            jira: {
                enabled: jiraEnabled.checked,
                url: document.getElementById('jiraUrl')?.value || '',
                email: document.getElementById('jiraEmail')?.value || '',
                token: document.getElementById('jiraToken')?.value || '',
                project: document.getElementById('jiraProject')?.value || '',
                issueType: document.getElementById('jiraIssueType')?.value || 'Task',
                onCritical: document.getElementById('jiraOnCritical')?.checked || false,
                onHigh: document.getElementById('jiraOnHigh')?.checked || false,
                onError: document.getElementById('jiraOnError')?.checked || false
            }
        });
    }

    // Yandex Tracker
    const yandexEnabled = document.getElementById('yandexEnabled');
    if (yandexEnabled) {
        items.push({
            item: 'integrations',
            yandex: {
                enabled: yandexEnabled.checked,
                orgId: document.getElementById('yandexOrgId')?.value || '',
                token: document.getElementById('yandexToken')?.value || '',
                queue: document.getElementById('yandexQueue')?.value || '',
                onCritical: document.getElementById('yandexOnCritical')?.checked || false,
                onHigh: document.getElementById('yandexOnHigh')?.checked || false,
                onError: document.getElementById('yandexOnError')?.checked || false
            }
        });
    }

    // Отправляем одним запросом
    const success = await patchConfig(items);

    if (success) {
        showNotification('Все настройки сохранены!', 'success');
    } else {
        showNotification('Ошибка сохранения настроек', 'error');
    }
}
// ==================== ЗАГРУЗКА НАСТРОЕК ====================

async function loadSettings() {
    // Загружаем с сервера
    await loadSettingsFromServer();
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
    if (confirm('ВНИМАНИЕ! Это действие сбросит ВСЕ настройки платформы.\n\nВы уверены?')) {
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
    //await loadSettingsFromServer();
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

let currentVersion = '';


function showUpdateModal(currentVer, latestVer, changelog) {
    const modal = document.getElementById('updateModal');
    const modalCurrentVersion = document.getElementById('modalCurrentVersion');
    const modalLatestVersion = document.getElementById('modalLatestVersion');
    const modalChangelog = document.getElementById('modalChangelog');
    const updateBtn = document.getElementById('updateNowBtn');

    // Заполняем данные
    modalCurrentVersion.textContent = currentVer;
    modalLatestVersion.textContent = latestVer;
    modalChangelog.textContent = changelog || 'Нет описания изменений';

    // Кнопка обновления
    updateBtn.onclick = async () => {
        // Меняем текст кнопки и блокируем
        const originalText = updateBtn.innerHTML;
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обновление...';

        try {
            // Запрос к серверу на обновление
            const response = await fetch('/api/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                // Показываем уведомление
                showNotification('Обновление запущено. Сервер будет перезапущен...', 'info');

                // Закрываем модальное окно
                closeUpdateModal();

                // Ждём 5 секунд и перезагружаем страницу
                setTimeout(() => {
                    location.reload();
                }, 5000);
            } else {
                showNotification(data.error || 'Ошибка запуска обновления', 'error');
                updateBtn.disabled = false;
                updateBtn.innerHTML = originalText;
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showNotification('Ошибка соединения с сервером', 'error');
            updateBtn.disabled = false;
            updateBtn.innerHTML = originalText;
        }
    };

    modal.style.display = 'flex';
}

// Функция проверки обновления
async function checkForUpdates() {
    const checkBtn = document.getElementById('checkUpdateBtn');
    const originalText = checkBtn.innerHTML;

    // Показываем загрузку
    checkBtn.classList.add('checking');
    checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Проверка...</span>';

    try {
        const response = await fetch('/api/version/check');
        const data = await response.json();

        currentVersion = data.currentVersion;

        if (data.hasUpdate) {
            // Показать модалку с предложением обновиться
            showUpdateModal(data.currentVersion, data.latestVersion, data.changelog, data.downloadUrl);
        } else {
            // Показать уведомление "У вас последняя версия"
            showNotification(`У вас последняя версия ${data.currentVersion}`, 'success');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка проверки обновлений', 'error');
    } finally {
        // Восстанавливаем кнопку
        checkBtn.classList.remove('checking');
        checkBtn.innerHTML = originalText;
    }
}


// Навешиваем обработчик на кнопку после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    const checkBtn = document.getElementById('checkUpdateBtn');
    if (checkBtn) {
        checkBtn.addEventListener('click', checkForUpdates);
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const webhookUrlElement = document.getElementById('webhookUrl');
    if (webhookUrlElement) {
        webhookUrlElement.textContent = window.location.origin + '/api/webhook';
    }
});  

document.getElementById('jiraEnabled')?.addEventListener('change', (e) => {
    const settings = document.getElementById('jiraSettings');
    if (settings) settings.style.display = e.target.checked ? 'block' : 'none';
});

// Yandex Tracker
document.getElementById('yandexEnabled')?.addEventListener('change', (e) => {
    const settings = document.getElementById('yandexSettings');
    if (settings) settings.style.display = e.target.checked ? 'block' : 'none';
});


// Показываем/скрываем дополнительные настройки хранения
const historyToggle = document.getElementById('historyEnabled');
const historyStorageRow = document.getElementById('historyStorageRow');

if (historyToggle) {
    const updateHistoryOptions = () => {
        if (historyStorageRow) {
            historyStorageRow.style.display = historyToggle.checked ? 'flex' : 'none';
        }
    };
    
    historyToggle.addEventListener('change', updateHistoryOptions);
    updateHistoryOptions();
}

window.showNotification = showNotification;