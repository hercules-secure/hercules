// ============================================================
// ПРОГРЕСС-БАР ВЫПОЛНЕНИЯ WORKFLOW (МОДАЛЬНОЕ ОКНО)
// ============================================================

function showWorkflowProgressModal(title, totalSteps) {
    // Удаляем старую модалку если есть
    var oldModal = document.querySelector('.workflow-progress-modal');
    if (oldModal) oldModal.remove();

    var overlay = document.createElement('div');
    overlay.className = 'workflow-progress-modal';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: alertFadeIn 0.3s ease;
    `;

    var modal = document.createElement('div');
    modal.className = 'workflow-progress-content';
    modal.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 32px 36px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        animation: alertScaleIn 0.3s ease;
        text-align: center;
    `;

    modal.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 12px;">
                <i class="fas fa-play-circle" style="font-size: 28px; color: #3B82F6;"></i>
                <h3 style="font-size: 18px; font-weight: 600; color: #1a1a2e; margin: 0; font-family: 'Ubuntu', sans-serif;" id="progressModalTitle">${title || 'Выполнение workflow'}</h3>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin: 0; font-family: 'Ubuntu', sans-serif;" id="progressModalStatus">Подготовка...</p>
        </div>
        
        <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #6b7280; margin-bottom: 6px; font-family: 'Ubuntu', sans-serif;">
                <span id="progressModalSteps">0 / ${totalSteps}</span>
                <span id="progressModalPercent">0%</span>
            </div>
            <div style="background: #f3f4f6; border-radius: 8px; height: 8px; overflow: hidden;">
                <div id="progressModalFill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3B82F6, #10B981); transition: width 0.5s ease; border-radius: 8px;"></div>
            </div>
        </div>
        
        <div style="margin-bottom: 20px; padding: 12px; background: #f8fafc; border-radius: 8px; min-height: 40px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 13px; color: #374151; font-family: 'Ubuntu', sans-serif;" id="progressModalCurrentStep">Ожидание начала...</span>
        </div>
        
        <div style="display: flex; justify-content: center; gap: 10px;">
            <button onclick="cancelWorkflowProgress()" style="
                padding: 8px 24px;
                border: none;
                border-radius: 8px;
                background: #EF4444;
                color: white;
                font-family: 'Ubuntu', sans-serif;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">Отменить</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    window._progressModal = {
        overlay: overlay,
        modal: modal,
        total: totalSteps,
        completed: 0
    };
}

function updateWorkflowProgressModal(status) {
    var modal = window._progressModal;
    if (!modal) return;

    var steps = status.steps || [];
    var total = modal.total || steps.length || 1;
    var completed = steps.filter(function(s) { 
        return s.status === 'completed' || s.status === 'success'; 
    }).length;
    var failed = steps.filter(function(s) { 
        return s.status === 'failed' || s.status === 'error'; 
    }).length;
    var running = steps.filter(function(s) { 
        return s.status === 'running'; 
    });

    var percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    var fill = document.getElementById('progressModalFill');
    var percentEl = document.getElementById('progressModalPercent');
    var stepsEl = document.getElementById('progressModalSteps');
    var statusEl = document.getElementById('progressModalStatus');
    var currentStepEl = document.getElementById('progressModalCurrentStep');

    if (fill) fill.style.width = Math.min(percent, 100) + '%';
    if (percentEl) percentEl.textContent = Math.min(percent, 100) + '%';
    if (stepsEl) stepsEl.textContent = completed + ' / ' + total;

    if (running.length > 0) {
        var currentStep = running[0];
        var stepName = currentStep.name || currentStep.tool || 'Шаг';
        if (currentStepEl) currentStepEl.textContent = 'Выполняется: ' + stepName;
        if (statusEl) statusEl.textContent = 'Выполняется...';
    } else if (failed > 0) {
        var failedStep = steps.find(function(s) { return s.status === 'failed' || s.status === 'error'; });
        if (statusEl) statusEl.textContent = 'Ошибка!';
        if (currentStepEl) currentStepEl.textContent = 'Ошибка: ' + (failedStep?.name || 'Ошибка выполнения');
    } else if (completed === total && total > 0) {
        if (statusEl) statusEl.textContent = 'Завершено успешно!';
        if (currentStepEl) currentStepEl.textContent = 'Все шаги выполнены';
        setTimeout(function() {
            closeWorkflowProgressModal();
        }, 3000);
    } else if (completed > 0) {
        if (statusEl) statusEl.textContent = 'Выполнение...';
        if (currentStepEl) currentStepEl.textContent = 'Выполнено ' + completed + ' из ' + total;
    } else {
        if (statusEl) statusEl.textContent = 'Ожидание...';
        if (currentStepEl) currentStepEl.textContent = 'Ожидание начала...';
    }

    modal.completed = completed;
}

function closeWorkflowProgressModal() {
    var modal = window._progressModal;
    if (modal && modal.overlay) {
        modal.overlay.remove();
        window._progressModal = null;
    }
}

function cancelWorkflowProgress() {
    showCustomAlert(
        'Подтверждение',
        'Остановить выполнение workflow?',
        'warning',
        'Остановить',
        function() {
            closeWorkflowProgressModal();
            showCustomAlert('Отмена', 'Workflow остановлен', 'warning');
        }
    );
}