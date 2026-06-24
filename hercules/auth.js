// hercules/auth.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, 'config.json');

async function loadAuthConfig() {
    try {
        const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(configData);
        const auth = config.auth || {};
        
        return {
            authEnabled: auth.authEnabled || false,
            loginUsername: auth.loginUsername || '',
            loginPassword: auth.loginPassword || '',
            sessionTimeout: auth.sessionTimeout || '30'
        };
    } catch (error) {
        return {
            authEnabled: false,
            loginUsername: '',
            loginPassword: '',
            sessionTimeout: '30'
        };
    }
}

export async function isAuthEnabled() {
    const config = await loadAuthConfig();
    return config.authEnabled === true;
}

// hercules/auth.js

// Для страниц - редирект на логин (НО логин не должен требовать авторизации)
export async function requireAuth(req, res, next) {
    const authEnabled = await isAuthEnabled();
    
    // Если авторизация выключена - пропускаем
    if (!authEnabled) {
        return next();
    }
    
    // Если уже авторизован - пропускаем
    if (req.session && req.session.authenticated === true) {
        req.session.touch();
        return next();
    }
    
    // Страница логина - не требует авторизации (важно!)
    if (req.path === '/login' || req.path.startsWith('/login?')) {
        return next();
    }
    
    // Все остальные страницы - редирект на логин
    const returnTo = encodeURIComponent(req.originalUrl);
    res.redirect(`/login?returnTo=${returnTo}`);
}

export async function checkAuth(username, password) {
    const config = await loadAuthConfig();
    
    if (!config.authEnabled) {
        return true;
    }
    
    return config.loginUsername === username && config.loginPassword === password;
}

export async function getSessionTimeoutMs() {
    const config = await loadAuthConfig();
    return (parseInt(config.sessionTimeout) || 30) * 60 * 1000;
}