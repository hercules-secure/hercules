
    function showLicenseModal() {
        const modal = document.getElementById('licenseModal');
        if (modal) {
            modal.style.display = 'flex';
            const messageDiv = document.getElementById('licenseMessage');
            if (messageDiv) {
                messageDiv.style.display = 'none';
                messageDiv.innerHTML = '';
            }
            const input = document.getElementById('licenseKey');
            if (input) input.value = '';
        }
    }

    function closeLicenseModal() {
        const modal = document.getElementById('licenseModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Сохранение JWT токена
    function saveLicenseToken(token, expiresAt, remainingDays, licenseKey) {
        if (token) {
            localStorage.setItem('licenseToken', token);
            localStorage.setItem('licenseExpiresAt', expiresAt);
            localStorage.setItem('licenseRemainingDays', remainingDays);
            localStorage.setItem('licenseKey', licenseKey);
            console.log('[LICENSE] Token saved, expires:', expiresAt);
        }
    }

    // Получение заголовков авторизации
    function getAuthHeaders() {
        const token = localStorage.getItem('licenseToken');
        if (!token) return {};
        return { 'Authorization': `Bearer ${token}` };
    }

    async function activateLicense() {
        const tool = document.getElementById('toolId')?.getAttribute('value');
        const keyInput = document.getElementById('licenseKey');
        const key = keyInput?.value.trim();
        const messageDiv = document.getElementById('licenseMessage');
        const activateBtn = document.getElementById('activateLicenseBtn');

        if (!key) {
            if (messageDiv) {
                messageDiv.style.display = 'block';
                messageDiv.className = 'error';
                messageDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Введите лицензионный ключ';
            }
            return;
        }

        try {
            if (activateBtn) {
                activateBtn.disabled = true;
                activateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
            }

            const response = await fetch('/api/license/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: key, tool: null })
            });

            const data = await response.json();

            if (data.success) {
                saveLicenseToken(data.token, data.expiresAt, data.remainingDays, key);
                
                if (messageDiv) {
                    messageDiv.style.display = 'block';
                    messageDiv.className = 'success';
                    messageDiv.innerHTML = '<i class="fas fa-check-circle"></i> Лицензия успешно активирована!';
                }

                setTimeout(() => {
                    closeLicenseModal();
                    location.reload();
                }, 1500);
            } else {
                if (messageDiv) {
                    messageDiv.style.display = 'block';
                    messageDiv.className = 'error';
                    messageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.message || 'Неверный лицензионный ключ'}`;
                }
                if (activateBtn) {
                    activateBtn.disabled = false;
                    activateBtn.innerHTML = '<i class="fas fa-check"></i> Активировать';
                }
            }
        } catch (error) {
            console.error('[LICENSE] Activation error:', error);
            if (messageDiv) {
                messageDiv.style.display = 'block';
                messageDiv.className = 'error';
                messageDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ошибка сервера. Попробуйте позже.';
            }
            if (activateBtn) {
                activateBtn.disabled = false;
                activateBtn.innerHTML = '<i class="fas fa-check"></i> Активировать';
            }
        }
    }

    // Функции для обновления прогресса
    function updateOverallProgress(percent) {
        const overallProgress = document.getElementById('overallProgress');
        const overallPercent = document.getElementById('overallPercent');
        if (overallProgress) {
            overallProgress.style.width = `${percent}%`;
        }
        if (overallPercent) {
            overallPercent.textContent = `${percent}%`;
        }
    }

    function updateThermometerFill(percent) {
        const fill = document.getElementById('thermometerFill');
        if (fill) {
            fill.style.width = `${percent}%`;
        }
    }

    function updateStepStatus(step, status) {
        const dot = document.getElementById(`markDot${step}`);
        const label = document.getElementById(`markLabel${step}`);

        if (dot) {
            dot.classList.remove('completed', 'active');
            if (status === 'completed') {
                dot.classList.add('completed');
            } else if (status === 'active') {
                dot.classList.add('active');
            }
        }

        if (label) {
            label.classList.remove('completed', 'active');
            if (status === 'completed') {
                label.classList.add('completed');
            } else if (status === 'active') {
                label.classList.add('active');
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const activateBtn = document.getElementById('activateLicenseBtn');
        if (activateBtn) {
            activateBtn.onclick = activateLicense;
        }

    });

    // Экспортируем функции для других скриптов
    window.updateOverallProgress = updateOverallProgress;
    window.updateThermometerFill = updateThermometerFill;
    window.updateStepStatus = updateStepStatus;
    window.showLicenseModal = showLicenseModal;
    window.closeLicenseModal = closeLicenseModal;
    window.getAuthHeaders = getAuthHeaders;
