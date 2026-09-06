function showCustomAlert(title, message, type = 'info', confirmText = 'OK', onConfirm = null) {
    const colors = {
        info: { border: '#3B82F6', bg: '#eff6ff', icon: 'fa-info-circle', iconColor: '#3B82F6' },
        success: { border: '#10B981', bg: '#ecfdf5', icon: 'fa-check-circle', iconColor: '#10B981' },
        warning: { border: '#F59E0B', bg: '#fffbeb', icon: 'fa-exclamation-triangle', iconColor: '#F59E0B' },
        error: { border: '#EF4444', bg: '#fef2f2', icon: 'fa-times-circle', iconColor: '#EF4444' }
    };

    const color = colors[type] || colors.info;

    const oldAlert = document.querySelector('.custom-alert-overlay');
    if (oldAlert) oldAlert.remove();

    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';
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

    const modal = document.createElement('div');
    modal.className = 'custom-alert-modal';
    modal.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 32px 36px;
        max-width: 440px;
        width: 90%;
        box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        animation: alertScaleIn 0.3s ease;
    `;

    modal.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 12px;">
                <i class="fas ${color.icon}" style="font-size: 28px; color: ${color.iconColor};"></i>
                <h3 style="font-size: 18px; font-weight: 600; color: #1a1a2e; margin: 0; font-family: 'Fira Sans', 'Fira Code', sans-serif;">${title}</h3>
            </div>
            <p style="font-size: 14px; color: #4b5563; margin: 0; line-height: 1.6; font-family: 'Fira Sans', 'Fira Code', sans-serif;">${message}</p>
        </div>
        <div style="display: flex; justify-content: center;">
            <button class="alert-confirm-btn" style="
                padding: 10px 32px;
                border: none;
                border-radius: 8px;
                background: ${color.border};
                color: white;
                font-family: 'Fira Sans', 'Fira Code', sans-serif;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                min-width: 120px;
            ">${confirmText}</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (!document.querySelector('#alert-styles')) {
        const style = document.createElement('style');
        style.id = 'alert-styles';
        style.textContent = `
            @keyframes alertFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes alertScaleIn {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .custom-alert-overlay .alert-confirm-btn:hover {
                transform: scale(1.02);
                opacity: 0.9;
            }
            .custom-alert-overlay .alert-confirm-btn:active {
                transform: scale(0.98);
            }
        `;
        document.head.appendChild(style);
    }

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.remove();
            if (onConfirm) onConfirm();
        }
    });

    const escHandler = function(e) {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
            if (onConfirm) onConfirm();
        }
    };
    document.addEventListener('keydown', escHandler);

    const confirmBtn = modal.querySelector('.alert-confirm-btn');
    confirmBtn.addEventListener('click', function() {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
        if (onConfirm) onConfirm();
    });
}