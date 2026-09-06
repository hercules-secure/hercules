document.addEventListener('DOMContentLoaded', function() {
    
    function generateWebhookSecret() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let secret = '';
        for (let i = 0; i < 32; i++) {
            secret += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return secret;
    }
    

    const gitEnabled = document.getElementById('gitIntegrationEnabled');
    if (gitEnabled) {
        gitEnabled.addEventListener('change', (e) => {
            const settings = document.getElementById('gitIntegrationSettings');
            if (settings) settings.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    const mattermostEnabled = document.getElementById('mattermostEnabled');
    if (mattermostEnabled) {
        mattermostEnabled.addEventListener('change', (e) => {
            const settings = document.getElementById('mattermostSettings');
            if (settings) settings.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    

    const emailEnabled = document.getElementById('emailEnabled');
    if (emailEnabled) {
        emailEnabled.addEventListener('change', (e) => {
            const settings = document.getElementById('emailSettings');
            if (settings) settings.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const warning = document.getElementById('webhookLocalhostWarning');
        if (warning) warning.style.display = 'block';
    }
    

    window.copyWebhookUrl = function() {
        const url = window.location.origin + '/api/webhook';
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                showNotification('URL скопирован', 'success');
            }).catch(() => {
                fallbackCopyText(url);
            });
        } else {
            fallbackCopyText(url);
        }
    };
    
    function fallbackCopyText(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('URL скопирован', 'success');
    }
    

    const generateSecretBtn = document.getElementById('generateSecretBtn');
    if (generateSecretBtn) {
        generateSecretBtn.addEventListener('click', () => {
            const secretInput = document.getElementById('webhookSecret');
            if (secretInput) {
                const newSecret = generateWebhookSecret();
                secretInput.value = newSecret;
                showNotification('Секретный ключ сгенерирован', 'success');
            }
        });
    }
    

    const copySecretBtn = document.getElementById('copySecretBtn');
    if (copySecretBtn) {
        copySecretBtn.addEventListener('click', () => {
            const secretInput = document.getElementById('webhookSecret');
            if (secretInput && secretInput.value) {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(secretInput.value).then(() => {
                        showNotification('Секретный ключ скопирован', 'success');
                    });
                } else {
                    fallbackCopyText(secretInput.value);
                }
            } else {
                showNotification('Сначала сгенерируйте ключ', 'warning');
            }
        });
    }
    
    window.sendTestEmail = async function() {
        try {
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
        } catch (error) {
            showNotification('Ошибка соединения', 'error');
        }
    };
    

    window.testMattermostConnection = async function() {
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
    };
    

    window.testJiraConnection = async function() {
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
    };
    
    window.testYandexConnection = async function() {
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
    };
    

    window.generateWebhookSecret = generateWebhookSecret;
    
});

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
    
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
    notification.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}