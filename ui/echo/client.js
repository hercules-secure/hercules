// client.js
// Клиентский скрипт для связи с сервером Эхолота

const API_BASE = '/api/echo';

// ============================================
// ПОЛУЧЕНИЕ ТОКЕНА
// ============================================
function getAuthHeaders() {
    const token = localStorage.getItem('licenseToken');
    if (token) {
        return { 'Authorization': 'Bearer ' + token };
    }
    return {};
}

// ============================================
// Функция для вызова API сканирования
// ============================================
async function callScanAPI(target) {
    try {
        if (typeof window.updateProgress === 'function') {
            window.updateProgress(10, 'Отправка запроса...', 'Сканирование: ' + target);
        }
        
        const headers = {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        };

        const response = await fetch(API_BASE + '/scan', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ target: target })
        });
        
        if (response.status === 403 || response.status === 401) {
            const data = await response.json();
            if (typeof window.showLicenseModal === 'function') {
                window.showLicenseModal();
            }
                throw new Error(data.error || 'Требуется активация лицензии');
            
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Ошибка сканирования');
        }

        if (!data.success) {
            throw new Error(data.error || 'Неизвестная ошибка');
        }

        return data;
    } catch (error) {
        throw error;
    }
}

// ============================================
// Функция для загрузки отчёта по ID с повторными попытками
// ============================================
async function loadReportWithRetry(reportId, maxAttempts, delay) {
    if (!maxAttempts) maxAttempts = 10;
    if (!delay) delay = 2000;
    
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            if (typeof window.updateProgress === 'function') {
                window.updateProgress(80 + (attempt / maxAttempts) * 15, 'Загрузка отчёта...', 'Попытка ' + attempt + '/' + maxAttempts);
            }
            
            const headers = {
                'Accept': 'application/json',
                ...getAuthHeaders()
            };

            const response = await fetch(API_BASE + '/history/' + reportId, {
                method: 'GET',
                headers: headers
            });

            if (response.status === 403 || response.status === 401) {
                const data = await response.json();
                if (data.needLicense || data.needReauth) {
                    if (typeof window.showLicenseModal === 'function') {
                        window.showLicenseModal();
                    }
                    throw new Error(data.error || 'Требуется активация лицензии');
                }
                throw new Error(data.error || 'Ошибка авторизации');
            }

            if (!response.ok) {
                throw new Error('Ошибка загрузки отчёта');
            }

            const data = await response.json();
            const report = data.report || data;
            
            // Проверяем, что отчёт содержит результаты
            if (report.results && report.results.results) {
                return report;
            }
            
            // Если отчёт ещё не готов, продолжаем ждать
            if (attempt < maxAttempts) {
                await new Promise(function(r) { setTimeout(r, delay); });
            } else {
                return report;
            }
        } catch (error) {
            if (attempt < maxAttempts) {
                await new Promise(function(r) { setTimeout(r, delay); });
            } else {
                throw error;
            }
        }
    }
}

// ============================================
// Функция для запуска сканирования
// ============================================
async function startScan(target) {
    if (typeof window.isScanning !== 'undefined' && window.isScanning) return;
    window.isScanning = true;
    
    try {
        if (typeof window.showProgress === 'function') {
            window.showProgress();
        }
        
        if (typeof window.updateProgress === 'function') {
            window.updateProgress(5, 'Подготовка...', 'Инициализация сканера');
        }
        
        var steps = [
            { percent: 10, status: 'Проверка цели...', task: 'Анализ: ' + target },
            { percent: 25, status: 'Ping...', task: 'Проверка доступности хостов' },
            { percent: 40, status: 'Сканирование портов...', task: 'Сканирование топ-100 портов' },
            { percent: 60, status: 'Анализ сервисов...', task: 'Определение сервисов и баннеров' },
            { percent: 75, status: 'Сбор данных...', task: 'Сбор информации об устройствах' },
            { percent: 90, status: 'Формирование отчёта...', task: 'Сохранение результатов' }
        ];
        
        for (var i = 0; i < steps.length; i++) {
            await new Promise(function(r) { setTimeout(r, 200 + Math.random() * 300); });
            if (typeof window.updateProgress === 'function') {
                window.updateProgress(steps[i].percent, steps[i].status, steps[i].task);
            }
        }
        
        var result = await callScanAPI(target);
        
        if (result.status === 'processing') {
            if (typeof window.updateProgress === 'function') {
                window.updateProgress(100, 'Запущено', 'Сканирование выполняется в фоне');
            }
            await new Promise(function(r) { setTimeout(r, 500); });
            
            if (typeof window.hideProgress === 'function') {
                window.hideProgress();
            }
            
            // ОТКРЫВАЕМ МОДАЛЬНОЕ ОКНО СРАЗУ
            if (result.reportId && typeof window.openEchoModal === 'function') {
                window.openEchoModal(result.reportId);
            }
            
            // Загружаем отчёт с повторными попытками
            if (result.reportId) {
                try {
                    if (typeof window.showProgress === 'function') {
                        window.showProgress();
                    }
                    
                    var reportData = await loadReportWithRetry(result.reportId, 15, 2000);
                    
                    if (typeof window.hideProgress === 'function') {
                        window.hideProgress();
                    }
                    
                    // Обновляем модальное окно с данными
                    if (typeof window.renderEchoReport === 'function') {
                        window.renderEchoReport(reportData);
                    }
                } catch (loadError) {
                    if (typeof window.hideProgress === 'function') {
                        window.hideProgress();
                    }
                }
            }
            
            window.isScanning = false;
            return;
        }
        
        if (result.success && result.results) {
            var scanResults = result.results;
            var devices = [];
            var ports = [];
            
            if (scanResults.results && scanResults.results.length > 0) {
                for (var j = 0; j < scanResults.results.length; j++) {
                    var host = scanResults.results[j];
                    if (host.alive) {
                        devices.push({
                            ip: host.ip,
                            mac: '—',
                            hostname: host.ip,
                            status: 'online',
                            ports: host.openPorts.map(function(p) { return p.port; }),
                            os: host.os || 'unknown',
                            rtt: host.rtt
                        });
                    }
                    for (var k = 0; k < host.openPorts.length; k++) {
                        var p = host.openPorts[k];
                        ports.push({
                            ip: host.ip,
                            port: p.port,
                            service: p.service || 'unknown',
                            banner: p.banner || null
                        });
                    }
                }
            }
            
            if (typeof window.scanData !== 'undefined') {
                window.scanData.devices = devices;
                window.scanData.ports = ports;
                window.scanData.lastScan = scanResults.timestamp || new Date().toISOString();
            }
            
            if (typeof window.updateUI === 'function') {
                window.updateUI();
            }
            
            if (typeof window.updateProgress === 'function') {
                window.updateProgress(100, 'Готово', 'Сканирование завершено');
            }
            await new Promise(function(r) { setTimeout(r, 500); });
            
            if (typeof window.hideProgress === 'function') {
                window.hideProgress();
            }
            
            if (result.reportId) {
                var reportData = await loadReportWithRetry(result.reportId, 3, 1000);
                
                if (typeof window.renderEchoReport === 'function') {
                    window.renderEchoReport(reportData);
                } else {
                    if (typeof window.openEchoModal === 'function') {
                        window.openEchoModal(result.reportId);
                    }
                }
            }
        } else {
            throw new Error(result.error || 'Не удалось получить результаты');
        }
        
    } catch (error) {
        if (typeof window.updateProgress === 'function') {
            window.updateProgress(100, 'Ошибка', error.message);
        }
        await new Promise(function(r) { setTimeout(r, 1000); });
        if (typeof window.hideProgress === 'function') {
            window.hideProgress();
        }
        
        if (error.message && (error.message.includes('лицензии') || error.message.includes('токен'))) {
            if (typeof window.showLicenseModal === 'function') {
                window.showLicenseModal();
            }
        }
    } finally {
        window.isScanning = false;
    }
}

// ============================================
// Функция для выполнения атаки
// ============================================
async function runAttack(port, ip, service) {
    try {
        var btn = document.activeElement;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
        
        await new Promise(function(r) { setTimeout(r, 2000); });
        
        var success = Math.random() > 0.5;
    } catch (error) {
    } finally {
        var btn2 = document.activeElement;
        if (btn2) {
            btn2.disabled = false;
            btn2.innerHTML = '<i class="fas fa-play"></i>';
        }
    }
}

// ============================================
// Экспорт функций в глобальный объект
// ============================================
window.startScan = startScan;
window.runAttack = runAttack;
window.callScanAPI = callScanAPI;
window.executeAttack = runAttack;
window.loadReportWithRetry = loadReportWithRetry;
window.isScanning = false;