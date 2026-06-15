import fs from 'fs/promises';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'hercules', 'config.json');

// Функция для логирования
async function log(message, level = 'INFO') {
    try {
        const logDir = path.join(process.cwd(), 'logs', 'hercules');
        const logFile = path.join(logDir, 'log.txt');
        await fs.mkdir(logDir, { recursive: true });
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message}\n`;
        await fs.appendFile(logFile, logLine);
    } catch (err) {
        // Silent fail
    }
}

// Валидация формата ключа
export function isValidLicenseKey(key) {
    const normalizedKey = key.trim().toUpperCase();
    const pattern = /^[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/;
    return pattern.test(normalizedKey);
}

// Получение текущей конфигурации
async function getConfig() {
    try {
        const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(configData);
    } catch {
        return { info: {} };
    }
}

// Сохранение конфигурации
async function saveConfig(config) {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Проверка ключа через удалённый API
export async function validateLicenseKey(key) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('https://hercules-security.ru/licence/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenceKey: key, productId: 'plus' }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.valid && data.token) {
                return {
                    valid: true,
                    token: data.token,
                    expiresAt: data.expiresAt,
                    remainingDays: data.remainingDays,
                    licenseType: 'plus'
                };
            }
        }
    } catch (error) {
        await log(`Activation error: ${error.message}`, 'ERROR');
    }
    
    return { valid: false, error: 'Activation failed' };
}

// Сохранение лицензии в config.json
export async function saveLicenseInfo(licenseData) {
    try {
        const config = await getConfig();
        
        if (!config.info) config.info = {};
        
        config.info.licenseType = licenseData.licenseType === 'plus' ? 'Геркулес Плюс' : 'Геркулес Бесплатная';
        config.info.licenseExpiry = licenseData.expiresAt || 'Бессрочно';
        config.info.licenseKeyHash = licenseData.keyHash || null;
        config.info.licenseToken = licenseData.token || null;
        config.info.licenseActivatedAt = new Date().toISOString();
        config.info.remainingDays = licenseData.remainingDays || null;
        
        await saveConfig(config);
        
        await log(`License saved: ${config.info.licenseType}`, 'INFO');
        
        return true;
    } catch (error) {
        await log(`Error saving license: ${error.message}`, 'ERROR');
        return false;
    }
}

// Активация лицензии (полный цикл)
export async function activateLicense(key, productId) {
    // Валидация формата ключа
    if (!isValidLicenseKey(key)) {
        return { success: false, error: 'Неверный формат лицензионного ключа' };
    }
    
    // Проверка через API
    const validation = await validateLicenseKey(key, productId);
    
    if (!validation.valid) {
        return { success: false, error: validation.error || 'Недействительный лицензионный ключ' };
    }
    
    // Сохранение лицензии
    const saved = await saveLicenseInfo({
        licenseType: validation.licenseType,
        expiresAt: validation.expiresAt,
        token: validation.token,
        remainingDays: validation.remainingDays,
        keyHash: hashKey(key)
    });
    
    if (!saved) {
        return { success: false, error: 'Ошибка сохранения лицензии' };
    }
    
    return {
        success: true,
        licenseType: validation.licenseType === 'plus' ? 'Геркулес Плюс' : 'Геркулес Бесплатная',
        expiresAt: validation.expiresAt,
        remainingDays: validation.remainingDays
    };
}

// Деактивация лицензии
export async function deactivateLicense() {
    try {
        const config = await getConfig();
        
        if (config.info) {
            delete config.info.licenseType;
            delete config.info.licenseExpiry;
            delete config.info.licenseKeyHash;
            delete config.info.licenseToken;
            delete config.info.licenseActivatedAt;
            delete config.info.remainingDays;
        }
        
        // Устанавливаем бесплатную версию по умолчанию
        config.info = config.info || {};
        config.info.licenseType = 'Геркулес Бесплатная';
        config.info.licenseExpiry = 'Бессрочно';
        
        await saveConfig(config);
        
        await log('License deactivated', 'INFO');
        
        return { success: true };
    } catch (error) {
        await log(`Error deactivating license: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
}

// Получение текущей лицензии
export async function getCurrentLicense() {
    try {
        const config = await getConfig();
        
        const licenseType = config.info?.licenseType || 'Геркулес Бесплатная';
        const isPlus = licenseType === 'Геркулес Плюс';
        
        // Проверка срока действия для плюс-лицензии
        let isValid = true;
        let remainingDays = null;
        
        if (isPlus && config.info?.licenseExpiry && config.info.licenseExpiry !== 'Бессрочно') {
            const expiryDate = new Date(config.info.licenseExpiry);
            const now = new Date();
            isValid = expiryDate > now;
            remainingDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            
            if (!isValid) {
                // Лицензия истекла, деактивируем
                await deactivateLicense();
                return {
                    licenseType: 'Геркулес Бесплатная',
                    licenseExpiry: 'Бессрочно',
                    isPlus: false,
                    activatedAt: null,
                    isValid: false,
                    remainingDays: 0
                };
            }
        }
        
        return {
            licenseType: licenseType,
            licenseExpiry: config.info?.licenseExpiry || 'Бессрочно',
            isPlus: isPlus && isValid,
            activatedAt: config.info?.licenseActivatedAt || null,
            isValid: isValid,
            remainingDays: remainingDays,
            token: config.info?.licenseToken || null
        };
    } catch (error) {
        await log(`Error getting license: ${error.message}`, 'ERROR');
        return {
            licenseType: 'Геркулес Бесплатная',
            licenseExpiry: 'Бессрочно',
            isPlus: false,
            activatedAt: null,
            isValid: true,
            remainingDays: null,
            token: null
        };
    }
}

// Проверка доступа к плюс-функции
export async function hasPlusAccess() {
    const license = await getCurrentLicense();
    return license.isPlus && license.isValid;
}

// Хеширование ключа для безопасного хранения
function hashKey(key) {
    // Простое хеширование для примера
    // В реальном проекте используйте crypto.createHash('sha256')
    const normalized = key.trim().toUpperCase();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

// Список плюс-функций
export const PLUS_FEATURES = [
    'CI/CD интеграция',
    'Экспорт SBOM (CycloneDX/SPDX)',
    'Анализ достижимости',
    'Анализ потока данных',
    'Call Graph анализ',
    'Taint Analysis',
    'Корпоративные репозитории',
    'PDF отчеты'
];

// Проверка статуса лицензии (для отображения в UI)
export async function getLicenseStatus() {
    const license = await getCurrentLicense();
    
    return {
        isActive: license.isPlus && license.isValid,
        type: license.licenseType,
        expiryDate: license.licenseExpiry,
        remainingDays: license.remainingDays,
        features: license.isPlus && license.isValid ? PLUS_FEATURES : []
    };
}