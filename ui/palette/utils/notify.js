function showCustomAlert(title, message, type = 'info', confirmText = 'OK', onConfirm = null) {
    // 🆕 Цвета на CSS-переменных Hercules
    const colors = {
        info: {
            icon: 'fa-info-circle',
            accentVar: 'var(--accent)',
            bgVar: 'var(--logo-bg)',
            borderVar: 'var(--logo-border)',
            glowVar: 'var(--logo-glow-strong)',
            btnBg: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            btnColor: 'var(--accent-ink)'
        },
        success: {
            icon: 'fa-check-circle',
            accentVar: 'var(--success-text)',
            bgVar: 'var(--success-bg)',
            borderVar: 'var(--success-border)',
            glowVar: 'var(--success-border)',
            btnBg: 'linear-gradient(135deg, var(--success-text), var(--accent))',
            btnColor: 'var(--accent-ink)'
        },
        warning: {
            icon: 'fa-exclamation-triangle',
            accentVar: 'var(--warning-text)',
            bgVar: 'var(--warning-bg)',
            borderVar: 'var(--warning-border)',
            glowVar: 'var(--warning-border)',
            btnBg: 'var(--warning-bg)',
            btnColor: 'var(--warning-text)',
            btnBorder: 'var(--warning-border)'
        },
        error: {
            icon: 'fa-times-circle',
            accentVar: 'var(--error-text)',
            bgVar: 'var(--error-bg)',
            borderVar: 'var(--error-border)',
            glowVar: 'var(--error-border)',
            btnBg: 'var(--error-bg)',
            btnColor: 'var(--error-text)',
            btnBorder: 'var(--error-border)'
        }
    };

    const color = colors[type] || colors.info;

    // Удаляем старый алерт
    const oldAlert = document.querySelector('.custom-alert-overlay');
    if (oldAlert) oldAlert.remove();

    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';

    // 🆕 Стили на CSS-переменных
    const modal = document.createElement('div');
    modal.className = 'custom-alert-modal';

    modal.innerHTML = `
        <div class="custom-alert-header">
            <div class="custom-alert-icon" style="
                background: ${color.bgVar};
                border: 1px solid ${color.borderVar};
                box-shadow: 0 0 20px ${color.glowVar};
            ">
                <i class="fas ${color.icon}" style="color: ${color.accentVar};"></i>
            </div>
            <h3 class="custom-alert-title">${title}</h3>
        </div>
        <p class="custom-alert-message">${message}</p>
        <div class="custom-alert-footer">
            <button class="alert-confirm-btn" style="
                background: ${color.btnBg};
                color: ${color.btnColor};
                border: 1px solid ${color.btnBorder || 'transparent'};
                box-shadow: 0 0 16px ${color.glowVar};
            ">${confirmText}</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 🆕 Стили — один раз, через CSS-классы
    if (!document.querySelector('#alert-styles')) {
        const style = document.createElement('style');
        style.id = 'alert-styles';
        style.textContent = `
            @keyframes alertFadeIn {
                from { opacity: 0; }
                to   { opacity: 1; }
            }
            @keyframes alertScaleIn {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to   { opacity: 1; transform: scale(1) translateY(0); }
            }

            .custom-alert-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                animation: alertFadeIn 0.3s ease;
            }

            .custom-alert-modal {
                background: var(--bg-card);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid var(--border);
                border-radius: 18px;
                padding: 32px 36px;
                max-width: 440px;
                width: 100%;
                box-shadow:
                    0 0 0 1px rgba(34, 211, 238, 0.05),
                    0 24px 60px rgba(0, 0, 0, 0.35);
                animation: alertScaleIn 0.3s ease;
                color: var(--text);
                position: relative;
            }

            .custom-alert-modal::before {
                content: "";
                position: absolute;
                top: 0;
                left: 15%;
                right: 15%;
                height: 1px;
                background: linear-gradient(90deg, transparent, var(--accent), transparent);
                border-radius: 1px;
                opacity: 0.6;
            }

            .custom-alert-header {
                text-align: center;
                margin-bottom: 20px;
            }

            .custom-alert-icon {
                width: 64px;
                height: 64px;
                margin: 0 auto 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                font-size: 26px;
                transition: all 0.3s ease;
            }

            .custom-alert-title {
                font-family: 'Fira Sans', sans-serif;
                font-size: 1.15rem;
                font-weight: 700;
                color: var(--text);
                margin: 0;
                letter-spacing: -0.01em;
            }

            .custom-alert-message {
                font-family: 'Fira Sans', sans-serif;
                font-size: 0.9rem;
                color: var(--text-dim);
                margin: 0 0 24px 0;
                line-height: 1.6;
                text-align: center;
            }

            .custom-alert-footer {
                display: flex;
                justify-content: center;
            }

            .custom-alert-overlay .alert-confirm-btn {
                padding: 11px 32px;
                border-radius: 10px;
                font-family: 'Fira Code', monospace;
                font-size: 0.78rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 140px;
                letter-spacing: 0.02em;
            }

            .custom-alert-overlay .alert-confirm-btn:hover {
                transform: translateY(-1px);
                opacity: 0.95;
            }

            .custom-alert-overlay .alert-confirm-btn:active {
                transform: translateY(0) scale(0.98);
            }

            /* Адаптив */
            @media (max-width: 500px) {
                .custom-alert-modal {
                    padding: 24px 20px;
                }
                .custom-alert-icon {
                    width: 56px;
                    height: 56px;
                    font-size: 22px;
                }
                .custom-alert-title {
                    font-size: 1rem;
                }
                .custom-alert-message {
                    font-size: 0.85rem;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Закрытие по клику на overlay
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.remove();
            if (onConfirm) onConfirm();
        }
    });

    // Закрытие по Escape
    const escHandler = function(e) {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
            if (onConfirm) onConfirm();
        }
    };
    document.addEventListener('keydown', escHandler);

    // Кнопка подтверждения
    const confirmBtn = modal.querySelector('.alert-confirm-btn');
    confirmBtn.addEventListener('click', function() {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
        if (onConfirm) onConfirm();
    });
}