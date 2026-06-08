 // Показать/скрыть дополнительные настройки
    document.getElementById('gitIntegrationEnabled')?.addEventListener('change', (e) => {
        const settings = document.getElementById('gitIntegrationSettings');
        if (settings) settings.style.display = e.target.checked ? 'block' : 'none';
    });
    
    document.getElementById('mattermostEnabled')?.addEventListener('change', (e) => {
        const settings = document.getElementById('mattermostSettings');
        if (settings) settings.style.display = e.target.checked ? 'block' : 'none';
    });
    
    document.getElementById('emailEnabled')?.addEventListener('change', (e) => {
        const settings = document.getElementById('emailSettings');
        if (settings) settings.style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Предупреждение о localhost для webhook
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const warning = document.getElementById('webhookLocalhostWarning');
        if (warning) warning.style.display = 'block';
    }
    
    // Копирование Webhook URL
    window.copyWebhookUrl = function() {
        const url = window.location.origin + '/api/webhook';
        navigator.clipboard.writeText(url);
        showNotification('URL скопирован', 'success');
    };
    
    // Тестовое письмо
    async function sendTestEmail() {
        const response = await fetch('/api/integrations/email/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success) {
            showNotification('Тестовое письмо отправлено', 'success');
        } else {
            showNotification('Ошибка: ' + data.error, 'error');
        }
    }

    async function testMattermostConnection() {
    const webhookUrl = document.getElementById('mattermostWebhook')?.value;
    const channel = document.getElementById('mattermostChannel')?.value;
    
    if (!webhookUrl) {
        showNotification('Сначала укажите Webhook URL', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/integrations/mattermost/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhookUrl, channel })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Mattermost подключение работает!', 'success');
        } else {
            showNotification(data.error || 'Ошибка подключения', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения', 'error');
    }
}

async function testJiraConnection() {
    const url = document.getElementById('jiraUrl')?.value;
    const email = document.getElementById('jiraEmail')?.value;
    const token = document.getElementById('jiraToken')?.value;
    
    if (!url) {
        showNotification('Укажите Jira URL', 'error');
        return;
    }
    if (!email) {
        showNotification('Укажите email', 'error');
        return;
    }
    if (!token) {
        showNotification('Укажите API токен', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/integrations/jira/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, email, token })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Jira подключение работает!', 'success');
        } else {
            showNotification(data.error || 'Ошибка подключения', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения', 'error');
    }
}

async function testYandexConnection() {
    const orgId = document.getElementById('yandexOrgId')?.value;
    const token = document.getElementById('yandexToken')?.value;
    
    if (!orgId) {
        showNotification('Укажите Organization ID', 'error');
        return;
    }
    if (!token) {
        showNotification('Укажите OAuth токен', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/integrations/yandex/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, token })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Yandex Tracker подключение работает!', 'success');
        } else {
            showNotification(data.error || 'Ошибка подключения', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения', 'error');
    }
}
document.getElementById('copySecretBtn')?.addEventListener('click', () => {
    const secretInput = document.getElementById('webhookSecret');
    if (secretInput && secretInput.value) {
        navigator.clipboard.writeText(secretInput.value);
        showNotification('Секретный ключ скопирован', 'success');
    } else {
        showNotification('Сначала сгенерируйте ключ', 'warning');
    }
});

// В скрипте на странице настроек

// Функция генерации случайного секрета
function generateWebhookSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let secret = '';
    for (let i = 0; i < 32; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
}

// Обработчик кнопки
document.getElementById('generateSecretBtn')?.addEventListener('click', () => {
    const secretInput = document.getElementById('webhookSecret');
    if (secretInput) {
        const newSecret = generateWebhookSecret();
        secretInput.value = newSecret;
        
        // Показываем уведомление
        showNotification('Секретный ключ сгенерирован', 'success');
    }
});
    window.generateWebhookSecret = generateWebhookSecret;
    window.testJiraConnection = testJiraConnection;
    window.testYandexConnection = testYandexConnection;
    window.testMattermostConnection = testMattermostConnection;
    window.sendTestEmail = sendTestEmail;