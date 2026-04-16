// email-checker-server.js
// Простой сервер для проверки email (синтаксис + DNS)
// Запуск: node email-checker-server.js

import express from 'express';
import dns from 'dns';
import { promisify } from 'util';

const app = express();
const PORT = process.env.PORT || 3000;

// DNS промисы
const resolveMx = promisify(dns.resolveMx);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============= ФУНКЦИИ ПРОВЕРКИ =============

/**
 * Валидация синтаксиса email
 */
function validateEmailSyntax(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Простое, но эффективное регулярное выражение
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Проверка MX записей домена
 */
async function checkDomainMx(domain) {
    try {
        const mxRecords = await resolveMx(domain);
        return {
            hasMx: mxRecords && mxRecords.length > 0,
            records: mxRecords || []
        };
    } catch (error) {
        return {
            hasMx: false,
            records: [],
            error: error.message
        };
    }
}

/**
 * Основная функция проверки email
 */
async function checkEmail(email) {
    const result = {
        email,
        syntax: false,
        domain: null,
        mxCheck: null,
        isValid: false,
        message: ''
    };
    
    // Шаг 1: Проверка синтаксиса
    result.syntax = validateEmailSyntax(email);
    if (!result.syntax) {
        result.message = 'Неверный формат email';
        result.isValid = false;
        return result;
    }
    
    // Шаг 2: Извлекаем домен
    const domain = email.split('@')[1];
    result.domain = domain;
    
    // Шаг 3: Проверяем MX записи
    const mxCheck = await checkDomainMx(domain);
    result.mxCheck = mxCheck;
    
    if (!mxCheck.hasMx) {
        result.message = 'Домен не принимает почту (нет MX записей)';
        result.isValid = false;
    } else {
        result.message = '✅ Email прошел базовую проверку';
        result.isValid = true;
    }
    
    return result;
}

// ============= ВЕБ-ИНТЕРФЕЙС =============

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Email Checker</title>
            <meta charset="utf-8">
            <style>
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .container {
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    max-width: 700px;
                    width: 100%;
                    overflow: hidden;
                }
                .header {
                    background: #2c3e50;
                    color: white;
                    padding: 30px;
                    text-align: center;
                }
                .header h1 {
                    font-size: 2.2em;
                    margin-bottom: 10px;
                }
                .header p {
                    color: #a0c0e0;
                    font-size: 1.1em;
                }
                .content {
                    padding: 30px;
                }
                .input-group {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                }
                .input-group input {
                    flex: 1;
                    padding: 15px;
                    font-size: 1.1em;
                    border: 2px solid #dee2e6;
                    border-radius: 10px;
                    outline: none;
                    transition: 0.3s;
                }
                .input-group input:focus {
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
                }
                .input-group button {
                    padding: 15px 30px;
                    font-size: 1.1em;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: 0.3s;
                }
                .input-group button:hover {
                    background: #5a67d8;
                    transform: translateY(-2px);
                }
                .input-group button:disabled {
                    background: #a0aec0;
                    cursor: not-allowed;
                    transform: none;
                }
                .examples {
                    margin-bottom: 20px;
                    color: #718096;
                }
                .examples span {
                    cursor: pointer;
                    color: #667eea;
                    text-decoration: underline;
                    margin: 0 5px;
                }
                .result {
                    background: #f8f9fa;
                    border-radius: 10px;
                    padding: 20px;
                    margin-top: 20px;
                    border: 1px solid #e9ecef;
                    display: none;
                }
                .result.active {
                    display: block;
                }
                .result-item {
                    padding: 10px 0;
                    border-bottom: 1px solid #dee2e6;
                }
                .result-item:last-child {
                    border-bottom: none;
                }
                .label {
                    color: #718096;
                    font-size: 0.9em;
                    text-transform: uppercase;
                }
                .value {
                    font-size: 1.2em;
                    font-weight: 600;
                    color: #2d3748;
                }
                .valid {
                    color: #27ae60;
                }
                .invalid {
                    color: #c0392b;
                }
                .mx-list {
                    margin-top: 10px;
                    background: white;
                    border-radius: 5px;
                    padding: 10px;
                }
                .mx-item {
                    padding: 5px 10px;
                    font-family: monospace;
                }
                .loading {
                    text-align: center;
                    padding: 20px;
                    display: none;
                }
                .loading.active {
                    display: block;
                }
                .spinner {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #667eea;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 10px;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .footer {
                    background: #f1f5f9;
                    padding: 20px;
                    text-align: center;
                    color: #64748b;
                    border-top: 1px solid #e2e8f0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📧 Email Checker</h1>
                    <p>Проверка синтаксиса и MX записей домена</p>
                </div>
                
                <div class="content">
                    <div class="examples">
                        🔍 Примеры: 
                        <span onclick="setExample('test@gmail.com')">gmail.com</span>
                        <span onclick="setExample('user@yandex.ru')">yandex.ru</span>
                        <span onclick="setExample('info@tedo.ru')">tedo.ru</span>
                        <span onclick="setExample('admin@mail.ru')">mail.ru</span>
                    </div>
                    
                    <div class="input-group">
                        <input type="email" id="emailInput" placeholder="email@example.com" value="test@gmail.com">
                        <button id="checkBtn" onclick="checkEmail()">Проверить</button>
                    </div>
                    
                    <div class="loading" id="loading">
                        <div class="spinner"></div>
                        <p>Проверка email...</p>
                    </div>
                    
                    <div class="result" id="result">
                        <div class="result-item">
                            <div class="label">Email</div>
                            <div class="value" id="resultEmail"></div>
                        </div>
                        <div class="result-item">
                            <div class="label">Синтаксис</div>
                            <div class="value" id="resultSyntax"></div>
                        </div>
                        <div class="result-item">
                            <div class="label">Домен</div>
                            <div class="value" id="resultDomain"></div>
                        </div>
                        <div class="result-item">
                            <div class="label">MX записи</div>
                            <div class="value" id="resultMx"></div>
                            <div class="mx-list" id="mxList"></div>
                        </div>
                        <div class="result-item">
                            <div class="label">Статус</div>
                            <div class="value" id="resultStatus"></div>
                        </div>
                        <div class="result-item">
                            <div class="label">Сообщение</div>
                            <div class="value" id="resultMessage"></div>
                        </div>
                    </div>
                </div>
                
                <div class="footer">
                    <p>⚡ Сервер работает на порту ${PORT}</p>
                    <p><small>API: /api/check?email=user@example.com</small></p>
                </div>
            </div>
            
            <script>
                function setExample(email) {
                    document.getElementById('emailInput').value = email;
                }
                
                async function checkEmail() {
                    const email = document.getElementById('emailInput').value;
                    if (!email) {
                        alert('Введите email');
                        return;
                    }
                    
                    const button = document.getElementById('checkBtn');
                    const loading = document.getElementById('loading');
                    const result = document.getElementById('result');
                    
                    button.disabled = true;
                    loading.classList.add('active');
                    result.classList.remove('active');
                    
                    try {
                        const response = await fetch('/api/check?email=' + encodeURIComponent(email));
                        const data = await response.json();
                        
                        // Отображаем результаты
                        document.getElementById('resultEmail').textContent = data.email;
                        document.getElementById('resultSyntax').innerHTML = data.syntax ? 
                            '<span class="valid">✅ Корректный</span>' : 
                            '<span class="invalid">❌ Некорректный</span>';
                        document.getElementById('resultDomain').textContent = data.domain || '-';
                        
                        if (data.mxCheck) {
                            document.getElementById('resultMx').innerHTML = data.mxCheck.hasMx ? 
                                '<span class="valid">✅ Найдены</span>' : 
                                '<span class="invalid">❌ Не найдены</span>';
                            
                            if (data.mxCheck.records && data.mxCheck.records.length > 0) {
                                let mxHtml = '<strong>Серверы:</strong><br>';
                                data.mxCheck.records.sort((a, b) => a.priority - b.priority).forEach(mx => {
                                    mxHtml += \`<div class="mx-item">📡 \${mx.exchange} (приоритет: \${mx.priority})</div>\`;
                                });
                                document.getElementById('mxList').innerHTML = mxHtml;
                            } else {
                                document.getElementById('mxList').innerHTML = '';
                            }
                        }
                        
                        const statusEl = document.getElementById('resultStatus');
                        if (data.isValid) {
                            statusEl.innerHTML = '<span class="valid">✅ Валидный</span>';
                        } else {
                            statusEl.innerHTML = '<span class="invalid">❌ Невалидный</span>';
                        }
                        
                        document.getElementById('resultMessage').textContent = data.message || '';
                        
                        result.classList.add('active');
                    } catch (error) {
                        alert('Ошибка: ' + error.message);
                    } finally {
                        button.disabled = false;
                        loading.classList.remove('active');
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// ============= API ЭНДПОИНТ =============

app.get('/api/check', async (req, res) => {
    const email = req.query.email;
    
    if (!email) {
        return res.status(400).json({
            error: 'Missing email parameter',
            example: '/api/check?email=user@example.com'
        });
    }
    
    console.log(`📧 Проверка: ${email}`);
    
    try {
        const result = await checkEmail(email);
        res.json(result);
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// ============= ЗАПУСК СЕРВЕРА =============

const server = app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('✅ EMAIL CHECKER SERVER ЗАПУЩЕН');
    console.log('='.repeat(50));
    console.log(`📍 Порт: ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📍 Проверка: http://localhost:${PORT}/api/check?email=test@gmail.com`);
    console.log('='.repeat(50) + '\n');
});

// Обработка ошибок
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Порт ${PORT} уже используется. Попробуйте другой порт:`);
        console.error(`   PORT=3001 node email-checker-server.js`);
    } else {
        console.error('❌ Ошибка сервера:', error);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Получен сигнал SIGTERM, закрываем сервер...');
    server.close(() => {
        console.log('Сервер остановлен');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Получен сигнал SIGINT, закрываем сервер...');
    server.close(() => {
        console.log('Сервер остановлен');
        process.exit(0);
    });
});