/**
 * UI компоненты
 */

import { showToolNotification } from './notifications.js';
import { getShortPath } from './utils.js';

/**
 * Показать модальное окно с результатами
 */
export function showResultsModal(results, onClose) {
    const criticalHigh = results.results.filter(r => 
        r.severity === 'critical' || r.severity === 'high'
    );
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;

    const severityColors = {
        critical: '#dc3545',
        high: '#fd7e14',
        medium: '#ffc107',
        low: '#28a745',
        info: '#6c757d'
    };

    const severityNames = {
        critical: 'Критический',
        high: 'Высокий',
        medium: 'Средний',
        low: 'Низкий',
        info: 'Информационный'
    };

    const criticalHighHtml = criticalHigh.length > 0 ? criticalHigh.map((item) => {
        const shortPath = getShortPath(item.file);
        
        return `
        <div style="background: #f8f9fa; padding: 16px; margin-bottom: 12px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                <div>
                    <span class="method-badge" style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; color: white; background: ${severityColors[item.severity]};">
                        ${severityNames[item.severity]}
                    </span>
                    <code style="background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 12px;">
                        ${shortPath}:${item.line || '?'}
                    </code>
                </div>
                <span style="color: #6c757d;">${item.ruleId || 'unknown'}</span>
            </div>
            <p style="margin: 0 0 12px 0; font-weight: 500;">${item.message}</p>
            <div style="background: #1f2937; color: #e5e7eb; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 12px; margin-bottom: 10px; overflow-x: auto;">
                ${item.code ? item.code.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}
            </div>
            <div style="background: rgba(40, 167, 69, 0.1); padding: 10px; border-radius: 6px; font-size: 12px; color: #28a745;">
                ${item.recommendation || 'Рекомендация не указана'}
            </div>
        </div>
    `}).join('') : '<div style="text-align: center; padding: 40px;">Критических и высоких уязвимостей не найдено 🎉</div>';

    overlay.innerHTML = `
        <div class="modal-container" style="background: white; border-radius: 16px; width: 90%; max-width: 1000px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); animation: modalFadeIn 0.3s ease;">
            <div class="modal-header" style="padding: 20px 24px; background: black; display: flex; justify-content: space-between; align-items: center; color: white;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Результаты анализа</h3>
                <span class="modal-close" style="cursor: pointer; font-size: 24px; color: white; line-height: 1;">&times;</span>
            </div>
            <div class="modal-body" style="padding: 24px; overflow-y: auto; flex: 1; background: #f8f9fa;">
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 24px;">
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                        <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #dc3545;">${results.summary.bySeverity.critical}</div>
                        <div class="stat-label" style="color: #6c757d; font-size: 12px;">Критические</div>
                    </div>
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                        <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #fd7e14;">${results.summary.bySeverity.high}</div>
                        <div class="stat-label" style="color: #6c757d; font-size: 12px;">Высокие</div>
                    </div>
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                        <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #ffc107;">${results.summary.bySeverity.medium}</div>
                        <div class="stat-label" style="color: #6c757d; font-size: 12px;">Средние</div>
                    </div>
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                        <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #28a745;">${results.summary.bySeverity.low}</div>
                        <div class="stat-label" style="color: #6c757d; font-size: 12px;">Низкие</div>
                    </div>
                    <div class="stat-card" style="background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                        <div class="stat-number" style="font-size: 28px; font-weight: bold; color: #6c757d;">${results.summary.bySeverity.info}</div>
                        <div class="stat-label" style="color: #6c757d; font-size: 12px;">Инфо</div>
                    </div>
                </div>
                <h4 style="margin: 20px 0 16px 0; color: #212529;">Критические и высокие уязвимости (${criticalHigh.length})</h4>
                <div id="vulnerabilities-list">${criticalHighHtml}</div>
            </div>
            <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 12px; background: white;">
                <button id="downloadReportBtn" class="btn-download" style="background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                    <i class="fas fa-download"></i> Скачать отчет
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    
    const closePopup = () => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s';
        setTimeout(() => {
            overlay.remove();
            if (onClose) onClose();
        }, 200);
    };

    const downloadReport = () => {
        try {
            const reportData = JSON.stringify(results, null, 2);
            const blob = new Blob([reportData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sast-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToolNotification('Отчет успешно скачан', 'success');
        } catch (error) {
            showToolNotification('Ошибка при скачивании отчета', 'error');
        }
    };

    overlay.querySelector('.modal-close').addEventListener('click', closePopup);
    overlay.querySelector('#downloadReportBtn').addEventListener('click', downloadReport);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePopup();
    });
}

/**
 * Показать сообщение о недоступности репозитория
 */
export function showRepositoryUnavailableMessage(url, onClose) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        backdrop-filter: blur(5px);
        animation: fadeIn 0.3s ease;
        padding: 16px;
    `;

    overlay.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: clamp(20px, 5vw, 40px); max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); animation: slideUp 0.4s ease; text-align: center;">
            <div style="width: clamp(60px, 15vw, 80px); height: clamp(60px, 15vw, 80px); background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto clamp(16px, 4vw, 24px); font-size: clamp(30px, 8vw, 40px); color: #dc2626;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h2 style="margin: 0 0 clamp(8px, 2vw, 12px); color: #1f2937; font-size: clamp(20px, 5vw, 24px);">Репозиторий недоступен</h2>
            <p style="margin: 0 0 clamp(16px, 4vw, 20px); color: #6b7280; font-size: clamp(13px, 3.5vw, 16px); line-height: 1.5;">
                Не удалось подключиться к репозиторию<br>
                <strong style="color: #4b5563; word-break: break-all;">${url}</strong>
            </p>
            <div style="background: #f3f4f6; border-radius: 12px; padding: clamp(16px, 4vw, 20px); margin-bottom: clamp(16px, 4vw, 24px); text-align: left;">
                <p style="margin: 0 0 12px; color: #374151; font-weight: 600; font-size: clamp(13px, 3.5vw, 14px);">
                    <i class="fas fa-lightbulb" style="color: #f59e0b; margin-right: 8px;"></i> Рекомендации:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: clamp(12px, 3vw, 13px);">
                    <li style="margin-bottom: 8px;">Проверьте доступность репозитория</li>
                    <li style="margin-bottom: 8px;">Скачайте архив вручную</li>
                    <li style="margin-bottom: 8px;">Загрузите архив через форму выше</li>
                </ul>
            </div>
            <div style="display: flex; gap: clamp(8px, 2vw, 12px); justify-content: center; flex-wrap: wrap;">
                <button id="close-unavailable-btn" style="background: #6b7280; color: white; border: none; padding: clamp(10px, 2.5vw, 14px) clamp(16px, 4vw, 24px); border-radius: 8px; cursor: pointer; font-size: clamp(12px, 3vw, 14px); min-width: 100px;">Закрыть</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#close-unavailable-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
            if (onClose) onClose();
        });
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
            if (onClose) onClose();
        }
    });
}