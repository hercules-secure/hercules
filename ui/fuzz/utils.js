// ==================== utils.js ====================
// ВСЕ вспомогательные функции (и DOM, и чистые)

// ============================================================
// УВЕДОМЛЕНИЯ
// ============================================================

function showToolNotification(message, type = 'success', duration = 3000) {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    const notification = document.createElement('div');
    notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${colors[type] || colors.success};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        animation: slideIn 0.3s ease;
        font-family: 'Ubuntu';
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showValidationMessage(message, type) {
    const el = document.getElementById('url-validation');
    if (!el) return;
    el.textContent = message;
    el.className = 'url-validation ' + type;
    setTimeout(() => {
        if (el.textContent === message) el.textContent = '';
    }, 5000);
}

function clearValidationMessage() {
    const el = document.getElementById('url-validation');
    if (el) {
        el.textContent = '';
        el.className = 'url-validation';
    }
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
}

function copyToClipboard(text, successMessage = 'Скопировано') {
    navigator.clipboard.writeText(text);
    showToolNotification(successMessage, 'success');
}

function getNested(obj, path, fallback = undefined) {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result === undefined || result === null) return fallback;
        result = result[key];
    }
    return result !== undefined ? result : fallback;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// МОДАЛЬНЫЕ ОКНА
// ============================================================

function openFuzzModal() {
    const modal = document.getElementById('fuzzModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeFuzzModal() {
    const modal = document.getElementById('fuzzModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function showErrorModal(title, message) {
    const modalBody = document.getElementById('fuzzModalBody');
    if (!modalBody) return;
    
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 30px 20px;">
            <div style="font-size: 48px; margin-bottom: 20px; color: #ef4444;">!</div>
            <h3 style="color: #ef4444; margin-bottom: 12px; font-size: 22px;">${escapeHtml(title || 'Ошибка')}</h3>
            <p style="color: #6b7280; margin-bottom: 24px; font-size: 16px; max-width: 500px; margin-left: auto; margin-right: auto; line-height: 1.6;">
                ${escapeHtml(message || 'Произошла неизвестная ошибка')}
            </p>
            <button onclick="closeFuzzModal()" style="
                background: #6c757d;
                color: white;
                border: none;
                padding: 10px 30px;
                border-radius: 6px;
                font-size: 11px;
                cursor: pointer;
                font-family: Ubuntu;
            ">
                Закрыть
            </button>
        </div>
    `;
    
    openFuzzModal();
}

// ============================================================
// ТАБЛИЦА УЯЗВИМОСТЕЙ
// ============================================================

function toggleVulnDetail(rowId, detailId) {
    const detailRow = document.getElementById(detailId);
    const icon = document.getElementById(detailId + '-icon');
    
    if (detailRow) {
        if (detailRow.style.display === 'none') {
            detailRow.style.display = 'table-row';
            if (icon) icon.textContent = '▲';
        } else {
            detailRow.style.display = 'none';
            if (icon) icon.textContent = '▼';
        }
    }
}

// ============================================================
// ПРОГРЕСС БАРЫ
// ============================================================

function resetAllProgress() {
    const cards = document.querySelectorAll('.card');
    const taskIds = ['1.1', '2.1', '2.2', '2.3'];
    
    taskIds.forEach(function(id) {
        updateTaskStatus(id, 'pending');
    });
    
    cards.forEach(function(card) {
        const progressEl = card.querySelector('.progress');
        if (progressEl) progressEl.style.width = '0%';
    });
}

function updateTaskStatus(taskId, status) {
    const statusMap = {
        'pending': 'В ожидании',
        'in-progress': 'В работе',
        'completed': 'Завершено',
        'error': 'Ошибка'
    };
    const cards = document.querySelectorAll('.card');
    const taskMap = {
        '1.1': cards[0],
        '2.1': cards[1],
        '2.2': cards[2],
        '2.3': cards[3]
    };
    const card = taskMap[taskId];
    if (card) {
        const statusEl = card.querySelector('.task-status');
        if (statusEl) {
            statusEl.textContent = statusMap[status] || status;
            statusEl.className = 'task-status ' + status;
        }
    }
}

function animateProgress(taskId, targetPercent, duration, callback) {
    const cards = document.querySelectorAll('.card');
    const taskMap = {
        '1.1': cards[0],
        '2.1': cards[1],
        '2.2': cards[2],
        '2.3': cards[3]
    };
    const card = taskMap[taskId];
    if (!card) {
        if (callback) callback();
        return;
    }
    const progressEl = card.querySelector('.progress');
    if (!progressEl) {
        if (callback) callback();
        return;
    }
    const startTime = Date.now();
    const startWidth = parseFloat(progressEl.style.width) || 0;
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentWidth = startWidth + (targetPercent - startWidth) * progress;
        progressEl.style.width = currentWidth + '%';
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else if (callback) {
            callback();
        }
    }
    animate();
}

// ============================================================
// ГРАДУСНИК
// ============================================================

const domovoySteps = [
    { id: '1.1', label: 'Загрузка', percent: 20 },
    { id: '2.1', label: 'Генерация', percent: 45 },
    { id: '2.2', label: 'Фаззинг', percent: 70 },
    { id: '2.3', label: 'Анализ', percent: 90 },
    { id: 'done', label: 'Отчет', percent: 100 }
];

const metlaSteps = [
    { id: 'M.1', label: 'Браузер', percent: 20 },
    { id: 'M.2', label: 'Анализ', percent: 45 },
    { id: 'M.3', label: 'Перехват', percent: 70 },
    { id: 'M.4', label: 'Обработка', percent: 90 },
    { id: 'done', label: 'Отчет', percent: 100 }
];

let currentMode = 'domovoy';

function updateThermometer(mode, taskId) {
    const steps = mode === 'domovoy' ? domovoySteps : metlaSteps;
    const fill = document.getElementById('thermometerFill');
    const percent = document.getElementById('thermometerPercent');
    const dots = document.querySelectorAll('.step-dot');
    const labels = document.querySelectorAll('.step-label');
    
    // Находим прогресс для текущего шага
    let currentPercent = 0;
    
    for (let i = 0; i < steps.length; i++) {
        if (steps[i].id === taskId || taskId === 'done') {
            currentPercent = steps[i].percent;
            break;
        }
    }
    
    // Обновляем заполнение
    if (fill) fill.style.width = currentPercent + '%';
    if (percent) percent.textContent = currentPercent + '%';
    
    // Обновляем точки
    dots.forEach((dot, index) => {
        const stepPercent = Math.floor((index / (dots.length - 1)) * 100);
        const nearestStep = steps.reduce((prev, curr) => {
            return Math.abs(curr.percent - stepPercent) < Math.abs(prev.percent - stepPercent) ? curr : prev;
        });
        
        dot.classList.remove('active', 'completed');
        if (nearestStep.percent < currentPercent) {
            dot.classList.add('completed');
        } else if (nearestStep.percent === currentPercent) {
            dot.classList.add('active');
        }
    });
    
    // Обновляем подписи
    labels.forEach((label, index) => {
        const stepPercent = Math.floor((index / (labels.length - 1)) * 100);
        const nearestStep = steps.reduce((prev, curr) => {
            return Math.abs(curr.percent - stepPercent) < Math.abs(prev.percent - stepPercent) ? curr : prev;
        });
        
        label.classList.remove('active', 'completed');
        if (nearestStep.percent < currentPercent) {
            label.classList.add('completed');
        } else if (nearestStep.percent === currentPercent) {
            label.classList.add('active');
        }
    });
}

function resetThermometer() {
    const fill = document.getElementById('thermometerFill');
    const percent = document.getElementById('thermometerPercent');
    const dots = document.querySelectorAll('.step-dot');
    const labels = document.querySelectorAll('.step-label');
    
    if (fill) fill.style.width = '0%';
    if (percent) percent.textContent = '0%';
    
    dots.forEach(dot => dot.classList.remove('active', 'completed'));
    labels.forEach(label => label.classList.remove('active', 'completed'));
}

function switchThermometerMode(mode) {
    currentMode = mode;
    const domovoyStepsEl = document.querySelector('.domovoy-steps');
    const metlaStepsEl = document.querySelector('.metla-steps');
    const title = document.getElementById('thermometerTitle');
    
    if (mode === 'domovoy') {
        if (domovoyStepsEl) domovoyStepsEl.style.display = 'flex';
        if (metlaStepsEl) metlaStepsEl.style.display = 'none';
        //if (title) title.textContent = 'Общий прогресс анализа';
    } else {
        if (domovoyStepsEl) domovoyStepsEl.style.display = 'none';
        if (metlaStepsEl) metlaStepsEl.style.display = 'flex';
        //if (title) title.textContent = 'Общий прогресс анализа';
    }
    
    resetThermometer();
}

// ============================================================
// ЭМУЛЯТОР ПРОГРЕССА (ПРОСТАЯ ВЕРСИЯ)
// ============================================================

let emulatorInterval = null;
let emulatorProgress = 0;

function startProgressEmulator() {
    // Останавливаем старый эмулятор если есть
    stopProgressEmulator();
    
    // Сбрасываем все
    resetAllProgress();
    resetThermometer();
    
    emulatorProgress = 0;
    
    // Запускаем интервал - каждые 2 секунды +25%
    emulatorInterval = setInterval(function() {
        try {
            emulatorProgress += 25;
            
            // Определяем какой шаг
            let stepId = 'done';
            let mode = currentMode || 'domovoy';
            
            if (emulatorProgress <= 25) {
                stepId = '1.1';
            } else if (emulatorProgress <= 50) {
                stepId = '2.1';
            } else if (emulatorProgress <= 75) {
                stepId = '2.2';
            } else if (emulatorProgress <= 100) {
                stepId = '2.3';
            }
            
            // Если достигли 100% - завершаем
            if (emulatorProgress >= 100) {
                emulatorProgress = 100;
                stepId = 'done';
                stopProgressEmulator();
                showToolNotification('Анализ успешно завершен!', 'success');
            }
            
            // Обновляем градусник
            updateThermometer(mode, stepId);
            
            // Обновляем статус задачи
            if (stepId !== 'done') {
                updateTaskStatus(stepId, 'in-progress');
                animateProgress(stepId, 100, 800, function() {
                    updateTaskStatus(stepId, 'completed');
                });
            } else {
                // Все задачи завершены
                ['1.1', '2.1', '2.2', '2.3'].forEach(function(id) {
                    updateTaskStatus(id, 'completed');
                });
            }
            
        } catch (error) {
            stopProgressEmulator();
            showErrorModal('Ошибка эмуляции', 'Произошла ошибка при обновлении прогресса: ' + error.message);
        }
    }, 2000); // Каждые 2 секунды
}

function stopProgressEmulator() {
    if (emulatorInterval) {
        clearInterval(emulatorInterval);
        emulatorInterval = null;
    }
}

// ============================================================
// ЗАМЕНА СТАРОЙ ФУНКЦИИ startProgressBars
// ============================================================

function startProgressBars() {
    startProgressEmulator();
}

// Экспортируем для использования
window.startProgressEmulator = startProgressEmulator;
window.stopProgressEmulator = stopProgressEmulator;
window.startProgressBars = startProgressBars;