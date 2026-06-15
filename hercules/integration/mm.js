// hercules/notifications/mattermost.js
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

// Загрузка конфигурации
async function loadMattermostConfig() {
    try {
        const configPath = path.join(process.cwd(), 'hercules', 'config.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configData);
        
        return {
            enabled: config.integrations?.mattermost?.enabled || false,
            webhookUrl: config.integrations?.mattermost?.webhookUrl || '',
            channel: config.integrations?.mattermost?.channel || '',
            tool: config.integrations?.mattermost?.tool || 'all',
            notifyOnSuccess: config.integrations?.mattermost?.notifyOnSuccess !== false,
            notifyOnError: config.integrations?.mattermost?.notifyOnError !== false
        };
    } catch {
        return { enabled: false };
    }
}

// Отправка уведомления
export async function sendMattermostNotification(analysisData) {
    const config = await loadMattermostConfig();
    
    if (!config.enabled) {
        console.log('Mattermost integration disabled');
        return false;
    }
    
    if (!config.webhookUrl) {
        console.error('Mattermost webhook URL not configured');
        return false;
    }
    
    // Проверяем, нужно ли отправлять уведомление для этого инструмента
    if (config.tool !== 'all' && config.tool !== analysisData.tool) {
        console.log(`Mattermost: skipping notification for ${analysisData.tool} (configured for ${config.tool})`);
        return false;
    }
    
    // Проверяем тип события
    if (analysisData.status === 'success' && !config.notifyOnSuccess) {
        return false;
    }
    if (analysisData.status === 'error' && !config.notifyOnError) {
        return false;
    }
    
    const statusIcon = analysisData.status === 'success' ? '✅' : '❌';
    const statusText = analysisData.status === 'success' ? 'Успешно' : 'Ошибка';
    const statusColor = analysisData.status === 'success' ? '#10b981' : '#ef4444';
    
    // Формируем сообщение
    let message = `${statusIcon} **Геркулес - Анализ завершён**\n\n`;
    message += `**Инструмент:** ${analysisData.tool?.toUpperCase() || '—'}\n`;
    message += `**Источник:** ${analysisData.sourceName || '—'}\n`;
    
    if (analysisData.branch) {
        message += `**Ветка:** ${analysisData.branch}\n`;
    }
    
    if (analysisData.commit) {
        message += `**Коммит:** \`${analysisData.commit.substring(0, 7)}\`\n`;
    }
    
    message += `**Статус:** ${statusText}\n`;
    message += `**Длительность:** ${formatDuration(analysisData.duration)}\n`;
    message += `**Время:** ${new Date().toLocaleString()}\n\n`;
    
    // Добавляем статистику если есть
    if (analysisData.stats) {
        if (analysisData.stats.critical !== undefined) {
            message += `**⚠️ Уязвимости:** Крит: ${analysisData.stats.critical}, High: ${analysisData.stats.high}, Medium: ${analysisData.stats.medium}\n`;
        }
        if (analysisData.stats.issues) {
            message += `**🔍 Найдено проблем:** ${analysisData.stats.issues}\n`;
        }
    }
    
    if (analysisData.error) {
        message += `\n**❌ Ошибка:** ${analysisData.error}\n`;
    }
    
    if (analysisData.reportUrl) {
        message += `\n📄 **Отчёт:** ${analysisData.reportUrl}`;
    }
    
    const payload = {
        text: message,
        username: 'Hercules Security',
        icon_url: 'https://hercules.dev/logo.png'
    };
    
    if (config.channel) {
        payload.channel = config.channel;
    }
    
    try {
        const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            console.log(`Mattermost notification sent for ${analysisData.tool}`);
            return true;
        } else {
            console.error(`Mattermost error: ${response.status} ${response.statusText}`);
            return false;
        }
    } catch (error) {
        console.error(`Mattermost send error: ${error.message}`);
        return false;
    }
}

// Форматирование длительности
function formatDuration(ms) {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}мс`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}с`;
    return `${Math.floor(ms / 60000)}м ${Math.floor((ms % 60000) / 1000)}с`;
}

// Отправка тестового уведомления
export async function sendTestNotification() {
    const testData = {
        tool: 'system',
        sourceName: 'Тест',
        status: 'success',
        duration: 1234,
        stats: { critical: 0, high: 0, medium: 0 }
    };
    
    return await sendMattermostNotification(testData);
}

/*

// В конце анализа, после получения результата
import { sendMattermostNotification } from '../../hercules/notifications/mattermost.js';

// Успешный анализ
await sendMattermostNotification({
    tool: 'sca',
    sourceName: repoUrl,
    branch: branch,
    commit: commit,
    status: 'success',
    duration: analysisDuration,
    stats: {
        critical: vulnerabilities.critical,
        high: vulnerabilities.high,
        medium: vulnerabilities.medium
    },
    reportUrl: `/report/sca/${taskId}`
});

// Ошибка
await sendMattermostNotification({
    tool: 'sca',
    sourceName: repoUrl,
    branch: branch,
    status: 'error',
    duration: analysisDuration,
    error: error.message
});

// В router.js добавить тестовый эндпоинт
router.post('/api/integrations/mattermost/test', async (req, res) => {
    const result = await sendTestNotification();
    res.json({ success: result, message: result ? 'Test sent' : 'Failed' });
});

*/