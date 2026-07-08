// modal.js
// Модальное окно для отображения отчёта Эхолота

// ============================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================
var scanData = window.scanData || { currentReportId: null };

// ============================================================
// ОТКРЫТИЕ / ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА
// ============================================================
function openEchoModal() {
    var modal = document.getElementById('echoReportModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeEchoModal() {
    var modal = document.getElementById('echoReportModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Сброс прогресс-бара при закрытии модального окна
    resetProgress();
    
    // Очистка полей ввода IP
    clearInputFields();
}

// ============================================================
// СБРОС ПРОГРЕСС-БАРА
// ============================================================
function resetProgress() {
    var steps = document.querySelectorAll('.progress-step');
    if (steps.length > 0) {
        steps.forEach(function(step) {
            step.className = 'progress-step idle';
        });
    }
    
    var fill = document.getElementById('progressFill');
    if (fill) {
        fill.className = 'progress-bar-fill';
        fill.style.width = '0%';
    }
    
    var percent = document.getElementById('progressPercent');
    if (percent) {
        percent.textContent = '0%';
    }
    
    var status = document.getElementById('progressStatus');
    if (status) {
        status.textContent = 'Ожидание начала сканирования';
    }
}

// ============================================================
// ОЧИСТКА ПОЛЕЙ ВВОДА
// ============================================================
function clearInputFields() {
    var fields = ['networkTarget', 'singleTarget', 'rangeStart', 'rangeEnd'];
    
    fields.forEach(function(id) {
        var input = document.getElementById(id);
        if (input) {
            input.value = '';
        }
    });
    
    // Деактивируем кнопки сканирования
    var buttons = ['startScanBtn', 'startSingleScanBtn', 'startRangeScanBtn'];
    buttons.forEach(function(id) {
        var btn = document.getElementById(id);
        if (btn) {
            btn.disabled = true;
            btn.classList.remove('active');
        }
    });
}

// ============================================================
// Закрытие по Escape
// ============================================================
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeEchoModal();
    }
});

// ============================================================
// СКАЧИВАНИЕ ОТЧЁТА
// ============================================================
function downloadEchoReportHTML(reportId) {
    if (!reportId) {
        alert('ID отчёта не указан');
        return;
    }
    var url = '/api/echo/history/' + reportId;
    window.open(url, '_blank');
}

function downloadEchoReportJSON(reportId) {
    if (!reportId) {
        alert('ID отчёта не указан');
        return;
    }
    
    fetch('/api/echo/history/' + reportId, {
        headers: { 'Accept': 'application/json' }
    })
    .then(function(response) {
        if (!response.ok) {
            throw new Error('Ошибка загрузки отчёта');
        }
        return response.json();
    })
    .then(function(data) {
        var report = data.report || data;
        var json = JSON.stringify(report, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'echo-report-' + reportId + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    })
    .catch(function(error) {
        alert('Ошибка скачивания: ' + error.message);
    });
}

// ============================================================
// РЕНДЕРИНГ ОТЧЁТА ИЗ JSON
// ============================================================
function renderEchoReport(data) {
    if (!data) {
        console.error('Нет данных для отображения');
        return;
    }
    
    var modalBody = document.getElementById('echoModalBody');
    if (!modalBody) return;
    
    // Извлекаем данные из структуры
    var reportId = data.reportId || '—';
    
    // Определяем, где находятся результаты
    var resultsData = null;
    var results = [];
    var summary = {};
    var target = '—';
    var duration = '—';
    var scanType = 'unknown';
    var timestamp = '—';
    
    // Проверяем структуру: data.results.results (из вашего примера)
    if (data.results && data.results.results) {
        resultsData = data.results;
        results = data.results.results || [];
        summary = {
            totalIPs: data.results.totalIPs || 0,
            aliveIPs: data.results.aliveIPs || 0,
            totalOpenPorts: data.results.totalOpenPorts || 0
        };
        target = data.results.target || '—';
        duration = data.results.duration || '—';
        scanType = data.results.type || 'unknown';
        timestamp = data.results.timestamp || '—';
    } else if (data.results && Array.isArray(data.results)) {
        results = data.results;
        summary = {
            totalIPs: results.length,
            aliveIPs: results.filter(function(h) { return h.alive; }).length,
            totalOpenPorts: results.reduce(function(sum, h) { return sum + (h.portCount || 0); }, 0)
        };
        target = data.target || '—';
        duration = data.duration || '—';
        scanType = data.type || 'unknown';
        timestamp = data.timestamp || '—';
    } else if (data.results && data.results.results && data.results.results.length > 0) {
        results = data.results.results;
        summary = {
            totalIPs: data.results.totalIPs || results.length,
            aliveIPs: data.results.aliveIPs || results.filter(function(h) { return h.alive; }).length,
            totalOpenPorts: data.results.totalOpenPorts || 0
        };
        target = data.results.target || data.target || '—';
        duration = data.results.duration || data.duration || '—';
        scanType = data.results.type || data.type || 'unknown';
        timestamp = data.results.timestamp || data.timestamp || '—';
    } else {
        results = data.results || [];
        summary = {
            totalIPs: results.length || 0,
            aliveIPs: results.filter(function(h) { return h.alive; }).length || 0,
            totalOpenPorts: results.reduce(function(sum, h) { return sum + (h.portCount || 0); }, 0) || 0
        };
        target = data.target || '—';
        duration = data.duration || '—';
        scanType = data.type || 'unknown';
        timestamp = data.timestamp || '—';
    }
    
    // Форматируем дату
    var formattedDate = '—';
    if (timestamp && timestamp !== '—') {
        try {
            var date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                formattedDate = date.toLocaleString('ru-RU');
            }
        } catch (e) {
            formattedDate = '—';
        }
    }
    
    // Подсчёт статистики
    var totalIPs = summary.totalIPs || 0;
    var aliveIPs = summary.aliveIPs || 0;
    var totalPorts = summary.totalOpenPorts || 0;
    
    // Собираем все порты
    var allPorts = [];
    results.forEach(function(host) {
        if (host.openPorts && Array.isArray(host.openPorts)) {
            host.openPorts.forEach(function(p) {
                allPorts.push({
                    ip: host.ip,
                    port: p.port,
                    service: p.service || 'unknown',
                    banner: p.banner || null,
                    os: host.os || 'unknown'
                });
            });
        }
    });
    
    // Уникальные сервисы
    var uniqueServices = [];
    var serviceSet = {};
    allPorts.forEach(function(p) {
        if (!serviceSet[p.service]) {
            serviceSet[p.service] = true;
            uniqueServices.push(p.service);
        }
    });
    
    // Статистика по ОС
    var osStats = {};
    results.forEach(function(host) {
        if (host.os && host.os !== 'unknown') {
            osStats[host.os] = (osStats[host.os] || 0) + 1;
        }
    });
    
    // Экранирование HTML
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    
    // Сохраняем ID отчёта для кнопок скачивания
    if (window.scanData) {
        window.scanData.currentReportId = reportId;
    }
    
    // Обновляем ID в хедере
    var idEl = document.getElementById('echoReportModalId');
    if (idEl) {
        idEl.textContent = 'ID: ' + reportId;
    }
    
    var html = '';
    
    // Информационная панель
    html += `
        <div class="echo-info-bar">
            <div class="echo-info-item">
                <span class="echo-info-label">Цель:</span>
                <span class="echo-info-value">${escapeHtml(target)}</span>
            </div>
            <div class="echo-info-item">
                <span class="echo-info-label">Тип:</span>
                <span class="echo-info-value">${escapeHtml(scanType)}</span>
            </div>
            <div class="echo-info-item">
                <span class="echo-info-label">Длительность:</span>
                <span class="echo-info-value">${escapeHtml(duration)}</span>
            </div>
            <div class="echo-info-item">
                <span class="echo-info-label">Дата:</span>
                <span class="echo-info-value">${escapeHtml(formattedDate)}</span>
            </div>
        </div>
    `;
    
    // Статистика
    html += `
        <div class="echo-stats-grid">
            <div class="echo-stat-card">
                <div class="echo-stat-number" style="color: #3B82F6;">${totalIPs}</div>
                <div class="echo-stat-label">Всего хостов</div>
            </div>
            <div class="echo-stat-card">
                <div class="echo-stat-number" style="color: #10B981;">${aliveIPs}</div>
                <div class="echo-stat-label">Доступно</div>
            </div>
            <div class="echo-stat-card">
                <div class="echo-stat-number" style="color: #EF4444;">${totalIPs - aliveIPs}</div>
                <div class="echo-stat-label">Недоступно</div>
            </div>
            <div class="echo-stat-card">
                <div class="echo-stat-number" style="color: #8B5CF6;">${totalPorts}</div>
                <div class="echo-stat-label">Открытых портов</div>
            </div>
            <div class="echo-stat-card">
                <div class="echo-stat-number" style="color: #F59E0B;">${uniqueServices.length}</div>
                <div class="echo-stat-label">Уникальных сервисов</div>
            </div>
            <div class="echo-stat-card">
                <div class="echo-stat-number" style="color: #EC4899;">${Object.keys(osStats).length}</div>
                <div class="echo-stat-label">Типов ОС</div>
            </div>
        </div>
    `;
    
    // Вкладки
    html += `
        <div class="echo-tabs">
            <button class="echo-tab-btn active" data-tab="hosts">Хосты <span class="echo-tab-count">${results.length}</span></button>
            <button class="echo-tab-btn" data-tab="ports">Порты <span class="echo-tab-count">${allPorts.length}</span></button>
            <button class="echo-tab-btn" data-tab="os">ОС <span class="echo-tab-count">${Object.keys(osStats).length}</span></button>
        </div>
    `;
    
    // Таблица хостов
    var hostsHtml = '';
    if (results.length === 0) {
        hostsHtml = '<div class="echo-empty">Хосты не обнаружены</div>';
    } else {
        hostsHtml = `
            <table class="echo-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>IP адрес</th>
                        <th>Статус</th>
                        <th>RTT</th>
                        <th>ОС</th>
                        <th>Портов</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(function(host, idx) {
                        return `
                            <tr>
                                <td>${idx + 1}</td>
                                <td><strong>${escapeHtml(host.ip)}</strong></td>
                                <td><span class="echo-status-badge ${host.alive ? 'online' : 'offline'}">${host.alive ? 'Доступен' : 'Недоступен'}</span></td>
                                <td>${host.rtt ? host.rtt + 'ms' : '—'}</td>
                                <td>${host.os && host.os !== 'unknown' ? escapeHtml(host.os) : '—'}</td>
                                <td>${host.portCount || 0}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            <div class="echo-table-footer">Всего хостов: ${results.length}</div>
        `;
    }
    
    // Таблица портов
    var portsHtml = '';
    if (allPorts.length === 0) {
        portsHtml = '<div class="echo-empty">Открытые порты не обнаружены</div>';
    } else {
        portsHtml = `
            <table class="echo-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>IP адрес</th>
                        <th>Порт</th>
                        <th>Сервис</th>
                        <th>Баннер</th>
                        <th>ОС</th>
                    </tr>
                </thead>
                <tbody>
                    ${allPorts.map(function(p, idx) {
                        var banner = p.banner || '—';
                        if (banner.length > 80) {
                            banner = banner.substring(0, 80) + '...';
                        }
                        return `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${escapeHtml(p.ip)}</td>
                                <td><span class="echo-port-badge">${p.port}</span></td>
                                <td><strong>${escapeHtml(p.service)}</strong></td>
                                <td><code class="echo-banner">${escapeHtml(banner)}</code></td>
                                <td>${p.os && p.os !== 'unknown' ? escapeHtml(p.os) : '—'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            <div class="echo-table-footer">Всего открытых портов: ${allPorts.length}</div>
        `;
    }
    
    // ОС
    var osHtml = '';
    var osEntries = Object.entries(osStats);
    if (osEntries.length === 0) {
        osHtml = '<div class="echo-empty">Информация об ОС не определена</div>';
    } else {
        osHtml = `
            <table class="echo-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Операционная система</th>
                        <th>Количество</th>
                        <th>Процент</th>
                    </tr>
                </thead>
                <tbody>
                    ${osEntries.map(function(os, idx) {
                        return `
                            <tr>
                                <td>${idx + 1}</td>
                                <td><strong>${escapeHtml(os[0])}</strong></td>
                                <td>${os[1]}</td>
                                <td>${Math.round((os[1] / results.length) * 100)}%</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }
    
    html += `
        <div class="echo-tab-content active" id="echo-tab-hosts">${hostsHtml}</div>
        <div class="echo-tab-content" id="echo-tab-ports">${portsHtml}</div>
        <div class="echo-tab-content" id="echo-tab-os">${osHtml}</div>
    `;
    
    modalBody.innerHTML = html;
    
    // Инициализация вкладок
    document.querySelectorAll('.echo-tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.echo-tab-btn').forEach(function(b) {
                b.classList.remove('active');
            });
            this.classList.add('active');
            var tab = this.getAttribute('data-tab');
            document.querySelectorAll('.echo-tab-content').forEach(function(c) {
                c.classList.remove('active');
            });
            var target = document.getElementById('echo-tab-' + tab);
            if (target) target.classList.add('active');
        });
    });
    
    // Открываем модальное окно
    openEchoModal();
}

// ============================================================
// ЗАГРУЗКА ОТЧЁТА ПО ID
// ============================================================
function loadAndRenderReport(reportId) {
    if (!reportId) {
        alert('ID отчёта не указан');
        return;
    }
    
    var body = document.getElementById('echoModalBody');
    if (body) {
        body.innerHTML = '<div class="echo-loading"><i class="fas fa-spinner fa-spin fa-2x"></i><span>Загрузка отчёта...</span></div>';
    }
    
    // Открываем модальное окно сразу
    openEchoModal();
    
    fetch('/api/echo/history/' + reportId, {
        headers: { 'Accept': 'application/json' }
    })
    .then(function(response) {
        if (!response.ok) {
            throw new Error('Ошибка загрузки отчёта');
        }
        return response.json();
    })
    .then(function(data) {
        var report = data.report || data;
        renderEchoReport(report);
    })
    .catch(function(error) {
        var body = document.getElementById('echoModalBody');
        if (body) {
            body.innerHTML = '<div class="echo-empty" style="color: #EF4444;"><i class="fas fa-exclamation-circle"></i> Ошибка загрузки: ' + escapeHtml(error.message) + '</div>';
        }
        console.error('Ошибка загрузки отчёта:', error);
    });
}

// Экранирование для ошибок
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ КНОПОК
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // Кнопка "Скачать HTML"
    var downloadHtmlBtn = document.getElementById('echoDownloadHtml');
    if (downloadHtmlBtn) {
        downloadHtmlBtn.addEventListener('click', function() {
            if (window.scanData && window.scanData.currentReportId) {
                downloadEchoReportHTML(window.scanData.currentReportId);
            } else {
                alert('Отчёт не найден');
            }
        });
    }
    
    // Кнопка "Скачать JSON"
    var downloadJsonBtn = document.getElementById('echoDownloadJson');
    if (downloadJsonBtn) {
        downloadJsonBtn.addEventListener('click', function() {
            if (window.scanData && window.scanData.currentReportId) {
                downloadEchoReportJSON(window.scanData.currentReportId);
            } else {
                alert('Отчёт не найден');
            }
        });
    }
});

// Экспорт в глобальный объект
window.openEchoModal = openEchoModal;
window.closeEchoModal = closeEchoModal;
window.renderEchoReport = renderEchoReport;
window.loadAndRenderReport = loadAndRenderReport;
window.downloadEchoReportHTML = downloadEchoReportHTML;
window.downloadEchoReportJSON = downloadEchoReportJSON;
window.resetProgress = resetProgress;
window.clearInputFields = clearInputFields;