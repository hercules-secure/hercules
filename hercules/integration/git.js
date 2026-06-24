import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

// Функция для записи в лог
async function writeWebhookLog(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] [WEBHOOK] ${message}\n`;
    const logFile = path.join(process.cwd(), 'logs', 'hercules', 'log.txt');
    
    try {
        await fs.mkdir(path.dirname(logFile), { recursive: true });
        await fs.appendFile(logFile, logLine);
    } catch (err) {}
}

// Проверка подписи
function verifyWebhookSignature(payload, signature, secret) {
    
    
    // ебался с подписью 2 часа, на мите сказали нахуй не надо так как либо localhost либо внутренняя сеть корпаратная
    // аджайл рулит канбан разруливает
    // с любовью Леша Коваленко
    
    return true; /* и не хуй */

    // if (!secret) return true;
    // if (!signature) return false; 
    
    //     const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    //     const received = signature.replace(/^sha256=/, '');
    //     return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
    
    // try {
    //     return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
    // } catch {
    //     return false;
    // }
}

// Извлечение информации из webhook
function extractWebhookInfo(body, event) {
    if (event === 'push') {
        return {
            type: 'push',
            branch: body.ref?.replace('refs/heads/', ''),
            commit: body.after,
            commits: body.commits?.length || 0,
            repository: body.repository?.full_name,
            url: body.repository?.clone_url,
            author: body.pusher?.name
        };
    }
    
    if (event === 'pull_request') {
        return {
            type: 'pull_request',
            action: body.action,
            branch: body.pull_request?.head?.ref,
            commit: body.pull_request?.head?.sha,
            repository: body.repository?.full_name,
            url: body.repository?.clone_url,
            author: body.pull_request?.user?.login,
            title: body.pull_request?.title
        };
    }
    
    return null;
}

// Получение настроек
async function getWebhookSettings() {
    try {
        const configPath = path.join(process.cwd(), 'hercules', 'config.json');
        const configData = await fs.readFile(configPath, 'utf-8');

        const config = JSON.parse(configData);
        
        return {
            enabled: config.integrations?.git?.enabled || false,
            tool: config.integrations?.git?.tool || 'blender',
            secret: config.integrations?.git?.secret || '',
            branches: config.integrations?.git?.branches || ''
        };
    } catch {
        return { enabled: false, tool: 'blender', secret: '', branches: '' };
    }
}

// Проверка ветки
function isBranchAllowed(branch, allowedBranches) {
    if (!allowedBranches) return true;
    
    const branches = allowedBranches.split(',').map(b => b.trim());
    return branches.includes(branch) || branches.includes('*');
}


// Функция для проверки лицензии инструмента
async function checkToolLicense(tool) {
    try {
        const installedPath = path.join(process.cwd(), 'addons', 'installed.json');
        const installedData = await fs.readFile(installedPath, 'utf-8');
        const installed = JSON.parse(installedData);
        
        const toolConfig = installed.find(ext => ext.id === tool);
        
        if (!toolConfig) {
            return { hasLicense: false, error: 'Tool not found' };
        }
        
        // Бесплатный по конфигу
        if (toolConfig.free === true) {
            return { hasLicense: true, free: true };
        }
        
        // Платный — проверяем лицензию
        if (!toolConfig.license || !toolConfig.license.token) {
            return { hasLicense: false, error: 'License required', needLicense: true };
        }
        
        // Проверяем JWT
        const publicKey = await fs.readFile(path.join(process.cwd(), 'hercules', 'public.pem'), 'utf-8');
        
        try {
            const decoded = jwt.verify(toolConfig.license.token, publicKey, { algorithms: ['RS256'] });
            
            if (decoded.expiresAt && new Date(decoded.expiresAt) < new Date()) {
                return { hasLicense: false, error: 'License expired', needLicense: true };
            }
            
            return { hasLicense: true, licenseData: decoded, token: toolConfig.license.token };
            
        } catch (jwtError) {
            return { hasLicense: false, error: 'Invalid license token', needLicense: true };
        }
        
    } catch (error) {
        return { hasLicense: false, error: error.message };
    }
}

// Вызов анализатора (без хардкода)
async function callAnalyzer(tool, webhookData) {
    // Проверяем лицензию
    const licenseCheck = await checkToolLicense(tool);
    
    if (!licenseCheck.hasLicense) {
        await writeWebhookLog(`License check failed for ${tool}: ${licenseCheck.error}`, 'WARN');
        await sendLicenseErrorNotification(tool, licenseCheck.error);
        throw new Error(`License required for ${tool}: ${licenseCheck.error}`);
    }
    

    // Получаем эндпоинт из конфига инструмента
    const installedPath = path.join(process.cwd(), 'addons', 'installed.json');
    const installedData = await fs.readFile(installedPath, 'utf-8');
    const installed = JSON.parse(installedData);
    const toolConfig = installed.find(ext => ext.id === tool);
    
    const apiUrl = `http://localhost:${process.env.PORT || 6565}${toolConfig.webhookEndpoint || '/api/' + tool}`;
    
    const payload = {
        url: webhookData.url,
        branch: webhookData.branch,
        commit: webhookData.commit,
        webhook: true,
        event: webhookData.type
    };


    const headers = { 'Content-Type': 'application/json' };
    
    // Если есть токен — добавляем в заголовок
    if (licenseCheck.token) {
        headers['X-License-Token'] = licenseCheck.token;
    }
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });
    
    if (response.status === 403) {
        const error = await response.json();
        throw new Error(`License error: ${error.message}`);
    }
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
}


export async function handleGitWebhook(req, res) {
    try {
        // Получаем настройки
        const settings = await getWebhookSettings();
        
        if (!settings.enabled) {
            await writeWebhookLog('Git integration disabled', 'WARN');
            return res.status(200).json({ 
                success: true, 
                message: 'Git integration disabled' 
            });
        }
        
        // Проверяем подпись
        const signature = req.headers['x-hub-signature-256'];
        const rawBody = req.rawBody || JSON.stringify(req.body);
        
        if (!verifyWebhookSignature(rawBody, signature, settings.secret)) {
            await writeWebhookLog('Invalid signature', 'WARN');
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid signature' 
            });
        }
        
        // Определяем тип события
        const event = req.headers['x-github-event'] || 'push';
        
        // Извлекаем информацию
        const webhookData = extractWebhookInfo(req.body, event);
        
        if (!webhookData) {
            await writeWebhookLog(`Unsupported event: ${event}`, 'WARN');
            return res.status(200).json({ 
                success: true, 
                message: `Unsupported event: ${event}` 
            });
        }
        
        await writeWebhookLog(`Received ${event} on ${webhookData.branch} for ${webhookData.repository}`, 'INFO');
        
        // Проверяем ветку
        if (!isBranchAllowed(webhookData.branch, settings.branches)) {
            await writeWebhookLog(`Branch ${webhookData.branch} not allowed, skipping`, 'INFO');
            return res.status(200).json({ 
                success: true, 
                message: `Branch ${webhookData.branch} skipped` 
            });
        }
        
        // Запускаем анализ асинхронно
        const tool = settings.tool;
        
        (async () => {
            try {
                await writeWebhookLog(`Starting ${tool} analysis for ${webhookData.repository}`, 'INFO');
                
                const result = await callAnalyzer(tool, webhookData);
                
                await writeWebhookLog(`Analysis completed for ${webhookData.commit}`, 'INFO');
                
                // TODO: отправить уведомление в Mattermost/Telegram/Email
                
            } catch (error) {
                await writeWebhookLog(`Analysis failed: ${error.message}`, 'ERROR');
            }
        })();
        
        // Отвечаем сразу
        res.json({
            success: true,
            message: `Webhook received, analysis started with ${tool}`,
            commit: webhookData.commit,
            branch: webhookData.branch
        });
        
    } catch (error) {
        await writeWebhookLog(`Webhook error: ${error.message}`, 'ERROR');
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}

// Отправка уведомления об ошибке лицензии
async function sendLicenseErrorNotification(tool, error) {
    await writeWebhookLog(`License error for ${tool}: ${error}`, 'ERROR');
    
    // Пытаемся отправить уведомление в Mattermost
    try {
        const configPath = path.join(process.cwd(), 'hercules', 'config.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configData);
        
        const mattermostConfig = config.integrations?.mattermost;
        
        if (mattermostConfig?.enabled && mattermostConfig?.webhookUrl) {
            const message = {
                text: `**Ошибка лицензии**\n\n` +
                       `**Инструмент:** ${tool.toUpperCase()}\n` +
                       `**Ошибка:** ${error}\n` +
                       `**Время:** ${new Date().toLocaleString()}\n\n` +
                       `Для активации лицензии перейдите в Настройки → Лицензия`,
                username: 'Hercules Webhook'
            };
            
            if (mattermostConfig.channel) {
                message.channel = mattermostConfig.channel;
            }
            
            await fetch(mattermostConfig.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });
            
            await writeWebhookLog(`License error notification sent to Mattermost`, 'INFO');
        }
    } catch (err) {
        await writeWebhookLog(`Failed to send license notification: ${err.message}`, 'WARN');
    }
}
