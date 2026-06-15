import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== ЛОГИРОВАНИЕ ====================

const LOG_DIR = path.join(process.cwd(), 'logs', 'hercules');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function logToFile(message, level = 'INFO') {
    try {
        ensureLogDir();
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}\n`;
        fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
    } catch (err) {
        // Игнорируем ошибки логгера
    }
}

// ==================== ЗАГРУЗКА КОНФИГА ====================

function loadConfig() {
    try {
        const configPath = path.join(process.cwd(), 'hercules', 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            return config.email || {};
        }
    } catch (err) {
        logToFile(`Ошибка загрузки конфига: ${err.message}`, 'ERROR');
    }
    return {};
}

// ==================== ГЕНЕРАТОРЫ HTML ШАБЛОНОВ ====================

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Генерация HTML письма с критическими проблемами
 */
function generateCriticalAlertHTML(reportData) {
    const {
        projectName = 'Unknown Project',
        scanTime = new Date().toISOString(),
        source = 'unknown',
        vulnerabilities = [],
        sastIssues = [],
        licenseIssues = [],
        summary = {}
    } = reportData;
    
    const criticalVulns = vulnerabilities.filter(v => 
        v.severity === 'critical' || v.severity === 'CRITICAL'
    );
    
    const criticalSAST = sastIssues.filter(v => 
        v.severity === 'CRITICAL'
    );
    
    const criticalLicenses = licenseIssues?.filter(v => 
        v.severity === 'CRITICAL'
    ) || [];
    
    const now = new Date(scanTime);
    const formattedTime = now.toLocaleString('ru-RU');
    
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SECURITY ALERT: Критические уязвимости найдены</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&family=Alef:wght@400;700&display=swap');
        
        body {
            font-family: 'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #1a1a2e;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-family: 'Ubuntu', sans-serif;
            font-weight: 700;
        }
        .header .badge {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            border-radius: 20px;
            padding: 5px 15px;
            margin-top: 10px;
            font-size: 14px;
            font-family: 'Ubuntu', sans-serif;
        }
        .content {
            padding: 30px;
        }
        .summary {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
            border-left: 4px solid #e74c3c;
        }
        .summary h3 {
            margin-top: 0;
            color: #c0392b;
            font-family: 'Ubuntu', sans-serif;
            font-weight: 700;
        }
        .stats {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin-top: 15px;
        }
        .stat {
            flex: 1;
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .stat-number {
            font-size: 32px;
            font-weight: bold;
            color: #c0392b;
            font-family: 'Alef', monospace;
            font-weight: 700;
        }
        .stat-label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
            font-family: 'Ubuntu', sans-serif;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e74c3c;
            font-family: 'Ubuntu', sans-serif;
        }
        .vuln-card {
            background: #fff5f5;
            border-left: 4px solid #e74c3c;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 8px;
        }
        .vuln-title {
            font-weight: bold;
            color: #c0392b;
            margin-bottom: 8px;
            font-family: 'Ubuntu', sans-serif;
        }
        .vuln-package {
            font-family: 'Alef', monospace;
            font-size: 13px;
            color: #666;
            margin-bottom: 8px;
        }
        .vuln-description {
            color: #333;
            margin-bottom: 10px;
            font-family: 'Ubuntu', sans-serif;
        }
        .vuln-meta {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            margin-top: 10px;
            font-size: 12px;
        }
        .severity-critical {
            background: #c0392b;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: bold;
            font-family: 'Ubuntu', sans-serif;
        }
        .severity-high {
            background: #e67e22;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: bold;
            font-family: 'Ubuntu', sans-serif;
        }
        .file-link {
            font-family: 'Alef', monospace;
            font-size: 12px;
            color: #2980b9;
        }
        .recommendation {
            background: #e8f4fd;
            padding: 10px;
            border-radius: 6px;
            margin-top: 10px;
            font-size: 13px;
            font-family: 'Ubuntu', sans-serif;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #eee;
            font-family: 'Ubuntu', sans-serif;
        }
        .actions-list {
            margin: 10px 0 0 20px;
            font-family: 'Ubuntu', sans-serif;
        }
        .actions-list li {
            margin-bottom: 5px;
        }
        @media (max-width: 600px) {
            .stats { flex-direction: column; }
            .content { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>SECURITY ALERT</h1>
            <div class="badge">КРИТИЧЕСКИЕ УЯЗВИМОСТИ</div>
        </div>
        
        <div class="content">
            <div class="summary">
                <h3>Сводка по проекту: ${escapeHtml(projectName)}</h3>
                <p><strong>Источник:</strong> ${escapeHtml(source)}</p>
                <p><strong>Время сканирования:</strong> ${formattedTime}</p>
                
                <div class="stats">
                    <div class="stat">
                        <div class="stat-number">${criticalVulns.length}</div>
                        <div class="stat-label">Critical SCA</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">${criticalSAST.length}</div>
                        <div class="stat-label">Critical SAST</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">${criticalLicenses.length}</div>
                        <div class="stat-label">Critical License</div>
                    </div>
                </div>
            </div>
            
            ${criticalVulns.length > 0 ? `
            <div class="section">
                <div class="section-title">Критические уязвимости зависимостей (SCA)</div>
                ${criticalVulns.map(v => `
                <div class="vuln-card">
                    <div class="vuln-title">${escapeHtml(v.id || v.title || 'Unknown CVE')}</div>
                    <div class="vuln-package">${escapeHtml(v.package || v.name)}@${escapeHtml(v.version || 'unknown')}</div>
                    <div class="vuln-description">${escapeHtml(v.summary || v.description || 'Нет описания')}</div>
                    <div class="vuln-meta">
                        <span class="severity-critical">CRITICAL</span>
                        ${v.cvssScore ? `<span>CVSS: ${v.cvssScore}</span>` : ''}
                        ${v.published ? `<span>${new Date(v.published).toLocaleDateString()}</span>` : ''}
                    </div>
                    <div class="recommendation">
                        <strong>Рекомендация:</strong> ${v.recommendation || 'Немедленно обновите зависимость до последней версии'}
                    </div>
                </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${criticalSAST.length > 0 ? `
            <div class="section">
                <div class="section-title">Критические уязвимости кода (SAST)</div>
                ${criticalSAST.map(v => `
                <div class="vuln-card">
                    <div class="vuln-title">${escapeHtml(v.ruleId || v.type)}</div>
                    <div class="vuln-package">${escapeHtml(v.file)}:${v.line || '?'}</div>
                    <div class="vuln-description">${escapeHtml(v.message)}</div>
                    ${v.codeBlock ? `
                    <div class="file-link">
                        <details>
                            <summary>Показать код</summary>
                            <pre style="background:#f0f0f0; padding:10px; border-radius:4px; overflow-x:auto; font-size:11px; font-family:'Alef',monospace;">${escapeHtml(JSON.stringify(v.codeBlock, null, 2))}</pre>
                        </details>
                    </div>
                    ` : ''}
                    <div class="recommendation">
                        <strong>Рекомендация:</strong> ${v.recommendation || 'Исправьте уязвимость согласно описанию'}
                    </div>
                </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${criticalLicenses.length > 0 ? `
            <div class="section">
                <div class="section-title">Проблемы с лицензиями</div>
                ${criticalLicenses.map(v => `
                <div class="vuln-card">
                    <div class="vuln-title">${escapeHtml(v.license || 'Unknown License')}</div>
                    <div class="vuln-package">${escapeHtml(v.package || v.name)}</div>
                    <div class="vuln-description">${escapeHtml(v.message || 'Лицензия несовместима с коммерческим использованием')}</div>
                    <div class="recommendation">
                        <strong>Рекомендация:</strong> ${v.recommendation || 'Замените компонент или получите юридическую консультацию'}
                    </div>
                </div>
                `).join('')}
            </div>
            ` : ''}
            
            <div class="recommendation" style="background:#fef3c7; border-left-color:#f59e0b;">
                <strong>НЕМЕДЛЕННЫЕ ДЕЙСТВИЯ:</strong>
                <ol class="actions-list">
                    <li>Немедленно обновите все компоненты с критическими уязвимостями</li>
                    <li>Проверьте SAST-уязвимости и исправьте код</li>
                    <li>Согласуйте лицензионные ограничения с юристами</li>
                    <li>Перезапустите сканирование после исправлений</li>
                </ol>
            </div>
        </div>
        
        <div class="footer">
            <p>Это автоматическое сообщение от Hercules Security Scanner</p>
            <p>Hercules v4.2.0 | ${new Date().toISOString()}</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Генерация HTML письма с общим отчетом
 */
function generateFullReportHTML(reportData) {
    const {
        projectName = 'Unknown Project',
        scanTime = new Date().toISOString(),
        source = 'unknown',
        summary = {},
        sca = {},
        sast = {},
        licenses = {}
    } = reportData;
    
    const formattedTime = new Date(scanTime).toLocaleString('ru-RU');
    
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Отчет безопасности Hercules</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&family=Alef:wght@400;700&display=swap');
        
        body {
            font-family: 'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-family: 'Ubuntu', sans-serif;
            font-weight: 700;
        }
        .content {
            padding: 30px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }
        .stat-value {
            font-size: 36px;
            font-weight: bold;
            font-family: 'Alef', monospace;
            font-weight: 700;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
            font-family: 'Ubuntu', sans-serif;
        }
        .severity-critical {
            color: #c0392b;
        }
        .severity-high {
            color: #e67e22;
        }
        .severity-medium {
            color: #f39c12;
        }
        .severity-low {
            color: #27ae60;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            font-family: 'Ubuntu', sans-serif;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'Ubuntu', sans-serif;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        th {
            background: #f8f9fa;
            font-weight: bold;
            font-family: 'Ubuntu', sans-serif;
        }
        .package-name {
            font-family: 'Alef', monospace;
            font-size: 13px;
        }
        .version-number {
            font-family: 'Alef', monospace;
        }
        h2, h3 {
            font-family: 'Ubuntu', sans-serif;
            font-weight: 700;
        }
        p {
            font-family: 'Ubuntu', sans-serif;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Отчет безопасности</h1>
            <p>Hercules Security Scanner</p>
        </div>
        <div class="content">
            <h2>Проект: ${escapeHtml(projectName)}</h2>
            <p>Источник: ${escapeHtml(source)} | Время: ${formattedTime}</p>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value severity-critical">${summary.critical || 0}</div>
                    <div class="stat-label">Critical</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value severity-high">${summary.high || 0}</div>
                    <div class="stat-label">High</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value severity-medium">${summary.medium || 0}</div>
                    <div class="stat-label">Medium</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value severity-low">${summary.low || 0}</div>
                    <div class="stat-label">Low</div>
                </div>
            </div>
            
            <h3>Зависимости</h3>
            <table>
                <thead>
                    <tr>
                        <th>Пакет</th>
                        <th>Версия</th>
                        <th>Уязвимости</th>
                        <th>Лицензия</th>
                    </tr>
                </thead>
                <tbody>
                    ${(sca.dependencies || []).slice(0, 20).map(d => `
                    <tr>
                        <td class="package-name">${escapeHtml(d.name)}</td>
                        <td class="version-number">${escapeHtml(d.version)}</td>
                        <td class="${d.cveCount > 0 ? 'severity-critical' : ''}">${d.cveCount || 0}</td>
                        <td>${escapeHtml(d.license || 'UNKNOWN')}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            
            ${(sca.dependencies || []).length > 20 ? `<p style="text-align:center; margin-top:10px;">... и еще ${sca.dependencies.length - 20} зависимостей</p>` : ''}
        </div>
        <div class="footer">
            <p>Hercules Security Scanner | ${new Date().toISOString()}</p>
        </div>
    </div>
</body>
</html>`;
}

// ==================== ПОЧТОВЫЙ КЛИЕНТ ====================

const DEFAULT_RECIPIENTS = [
    'security@example.com',
    'devops@example.com',
    'admin@example.com'
];

class EmailNotifier {
    constructor(config = null) {
        this.config = config || loadConfig();
        this.transporter = null;
    }
    
    async init() {
        if (!this.config.enabled) {
            logToFile('Email уведомления отключены в конфиге', 'INFO');
            return false;
        }
        
        if (!this.config.smtpHost || !this.config.auth?.user || !this.config.auth?.pass) {
            logToFile('Email конфиг неполный. Нужны: smtpHost, auth.user, auth.pass', 'ERROR');
            return false;
        }
        
        try {
            this.transporter = nodemailer.createTransport({
                host: this.config.smtpHost,
                port: this.config.smtpPort || 587,
                secure: this.config.smtpPort === 465,
                auth: {
                    user: this.config.auth.user,
                    pass: this.config.auth.pass
                }
            });
            
            await this.transporter.verify();
            logToFile('Email клиент инициализирован', 'INFO');
            return true;
        } catch (err) {
            logToFile(`Ошибка инициализации email: ${err.message}`, 'ERROR');
            return false;
        }
    }
    
    async sendCriticalAlert(reportData, recipients = null, customHtml = null) {
        if (!this.transporter) {
            const inited = await this.init();
            if (!inited) return false;
        }
        
        const to = recipients || this.config.to || DEFAULT_RECIPIENTS.join(',');
        const projectName = reportData.source?.replace(/\.zip$/, '') || 'Unknown';
        
        const html = customHtml || generateCriticalAlertHTML({
            ...reportData,
            projectName,
            scanTime: new Date().toISOString()
        });
        
        const mailOptions = {
            from: this.config.from || `"Hercules Security" <${this.config.auth?.user}>`,
            to: to,
            subject: `[CRITICAL] Hercules: Найдены критические уязвимости в ${projectName}`,
            html: html,
            priority: 'high',
            headers: {
                'X-Priority': '1',
                'X-MSMail-Priority': 'High',
                'Importance': 'high'
            }
        };
        
        try {
            const info = await this.transporter.sendMail(mailOptions);
            logToFile(`Critical alert отправлен на ${to}`, 'INFO');
            logToFile(`Message ID: ${info.messageId}`, 'INFO');
            return true;
        } catch (err) {
            logToFile(`Ошибка отправки критического алерта: ${err.message}`, 'ERROR');
            return false;
        }
    }
    
    async sendFullReport(reportData, recipients = null, customHtml = null) {
        if (!this.transporter) {
            const inited = await this.init();
            if (!inited) return false;
        }
        
        const to = recipients || this.config.to || DEFAULT_RECIPIENTS.join(',');
        const projectName = reportData.source?.replace(/\.zip$/, '') || 'Unknown';
        
        const scaStats = reportData.sca?.statistics || {};
        const sastStats = reportData.sast?.statistics || {};
        
        const summary = {
            critical: (scaStats.totalCriticalVulnerabilities || 0) + (sastStats.critical || 0),
            high: (scaStats.totalHighVulnerabilities || 0) + (sastStats.high || 0),
            medium: (scaStats.totalMediumVulnerabilities || 0) + (sastStats.medium || 0),
            low: (scaStats.totalLowVulnerabilities || 0) + (sastStats.low || 0)
        };
        
        const html = customHtml || generateFullReportHTML({
            ...reportData,
            projectName,
            scanTime: new Date().toISOString(),
            summary,
            sca: reportData.sca || {},
            sast: reportData.sast || {}
        });
        
        const mailOptions = {
            from: this.config.from || `"Hercules Security" <${this.config.auth?.user}>`,
            to: to,
            subject: `Hercules: Отчет безопасности для ${projectName}`,
            html: html
        };
        
        try {
            const info = await this.transporter.sendMail(mailOptions);
            logToFile(`Full report отправлен на ${to}`, 'INFO');
            return true;
        } catch (err) {
            logToFile(`Ошибка отправки полного отчета: ${err.message}`, 'ERROR');
            return false;
        }
    }
    
    async sendHtmlReport(html, subject, recipients = null) {
        if (!this.transporter) {
            const inited = await this.init();
            if (!inited) return false;
        }
        
        const to = recipients || this.config.to || DEFAULT_RECIPIENTS.join(',');
        
        const mailOptions = {
            from: this.config.from || `"Hercules Security" <${this.config.auth?.user}>`,
            to: to,
            subject: subject || 'Hercules: Отчет безопасности',
            html: html
        };
        
        try {
            const info = await this.transporter.sendMail(mailOptions);
            logToFile(`HTML report отправлен на ${to}`, 'INFO');
            return true;
        } catch (err) {
            logToFile(`Ошибка отправки HTML отчета: ${err.message}`, 'ERROR');
            return false;
        }
    }
    
    async sendNotification(reportData, options = {}) {
        const { minSeverity = 'high', alwaysSendReport = false, customHtml = null } = options;
        
        const scaStats = reportData.sca?.statistics || {};
        const sastStats = reportData.sast?.statistics || {};
        
        const criticalCount = (scaStats.totalCriticalVulnerabilities || 0) + (sastStats.critical || 0);
        const highCount = (scaStats.totalHighVulnerabilities || 0) + (sastStats.high || 0);
        
        if (minSeverity === 'critical' && criticalCount > 0) {
            await this.sendCriticalAlert(reportData, null, customHtml);
        } else if (minSeverity === 'high' && (criticalCount > 0 || highCount > 0)) {
            await this.sendCriticalAlert(reportData, null, customHtml);
        } else if (alwaysSendReport) {
            await this.sendFullReport(reportData, null, customHtml);
        } else {
            logToFile('Нет уязвимостей для отправки уведомления', 'INFO');
        }
    }
}

// ==================== ФУНКЦИИ ДЛЯ ВЫЗОВА ====================

export async function sendSecurityNotification(reportData, options = {}) {
    const notifier = new EmailNotifier();
    return await notifier.sendNotification(reportData, options);
}

export async function sendCriticalOnly(reportData, customHtml = null) {
    const notifier = new EmailNotifier();
    return await notifier.sendCriticalAlert(reportData, null, customHtml);
}

export async function sendFullReportOnly(reportData, customHtml = null) {
    const notifier = new EmailNotifier();
    return await notifier.sendFullReport(reportData, null, customHtml);
}

export async function sendHtmlReport(html, subject, recipients = null) {
    const notifier = new EmailNotifier();
    return await notifier.sendHtmlReport(html, subject, recipients);
}

// ==================== ЭКСПОРТ ====================

export { 
    EmailNotifier, 
    generateCriticalAlertHTML, 
    generateFullReportHTML, 
    escapeHtml,
    sendSecurityNotification,
    sendCriticalOnly,
    sendFullReportOnly,
    sendHtmlReport
};