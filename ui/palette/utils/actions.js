// ============================================================
// МОДАЛКА ДЛЯ ВВОДА НАЗВАНИЯ WORKFLOW
// ============================================================

function showWorkflowNameModal(callback) {
    var overlay = document.createElement('div');
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

    var modal = document.createElement('div');
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
                <i class="fas fa-file-export" style="font-size: 28px; color: #3B82F6;"></i>
                <h3 style="font-size: 18px; font-weight: 600; color: #1a1a2e; margin: 0; font-family: 'Ubuntu', sans-serif;">Название цепочки событий</h3>
            </div>
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px 0; font-family: 'Ubuntu', sans-serif;">Введите название для вашего workflow</p>
            <input id="workflowNameInput" type="text" placeholder="Мой workflow" value="Workflow-" + new Date().toISOString().split('T')[0] style="
                width: 100%;
                padding: 10px 14px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                font-size: 14px;
                font-family: 'Ubuntu', sans-serif;
                transition: border-color 0.2s;
                outline: none;
            ">
        </div>
        <div style="display: flex; justify-content: center; gap: 10px;">
            <button class="alert-cancel-btn" style="
                padding: 10px 24px;
                border: none;
                border-radius: 8px;
                background: #e5e7eb;
                color: #374151;
                font-family: 'Ubuntu', sans-serif;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">Отмена</button>
            <button class="alert-confirm-btn" style="
                padding: 10px 32px;
                border: none;
                border-radius: 8px;
                background: #3B82F6;
                color: white;
                font-family: 'Ubuntu', sans-serif;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">Продолжить</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var input = modal.querySelector('#workflowNameInput');
    var confirmBtn = modal.querySelector('.alert-confirm-btn');
    var cancelBtn = modal.querySelector('.alert-cancel-btn');

    setTimeout(function() {
        input.focus();
        input.select();
    }, 100);

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            confirmBtn.click();
        }
    });

    confirmBtn.addEventListener('click', function() {
        var name = input.value.trim() || 'Workflow-' + new Date().toISOString().split('T')[0];
        overlay.remove();
        if (callback) callback(name);
    });

    cancelBtn.addEventListener('click', function() {
        overlay.remove();
    });

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

// ============================================================
// ЭКСПОРТ МОДЕЛИ С ВВОДОМ НАЗВАНИЯ
// ============================================================

var exportBtn = document.getElementById('exportModelBtn');
if (exportBtn) {
    exportBtn.addEventListener('click', function() {
        if (elements.length === 0) {
            showCustomAlert('Внимание', 'Нет элементов для экспорта', 'warning');
            return;
        }
        
        showWorkflowNameModal(function(workflowName) {
            var model = window.exportModel();
            model.workflow.name = workflowName;
            
            var json = JSON.stringify(model, null, 2);
            var blob = new Blob([json], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = workflowName.toLowerCase().replace(/\s+/g, '-') + '-' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            URL.revokeObjectURL(url);
            showCustomAlert('Успешно', 'Workflow "' + workflowName + '" экспортирован', 'success');
        });
    });
}

var importBtn = document.getElementById('importModelBtn');
if (importBtn) {
    importBtn.addEventListener('click', function() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var data = JSON.parse(ev.target.result);
                    if (data.workflow) {
                        elements = data.workflow.steps.map(function(step) {
                            var el = {
                                id: step.id,
                                name: step.name,
                                type: step.type,
                                x: 50 + (step.id - 1) * 200,
                                y: 100,
                                color: '#3B82F6',
                                width: 120,
                                height: 40,
                                isTool: step.tool ? true : false
                            };
                            if (step.tool) {
                                el.tool = step.tool;
                                var config = getToolConfig(step.tool);
                                if (config) {
                                    el.color = config.color || '#3B82F6';
                                    config.fields.forEach(function(field) {
                                        if (step.params && step.params[field.id]) {
                                            el[field.id] = step.params[field.id];
                                        }
                                    });
                                }
                            }
                            if (el.id > elementIdCounter) elementIdCounter = el.id;
                            return el;
                        });
                        connections = data.workflow.transitions || [];
                        selectedElement = null;
                        renderElements();
                        if (elements.length > 0) {
                            if (emptyState) emptyState.classList.add('hidden');
                        }
                        showCustomAlert('Успешно', 'Workflow импортирован', 'success');
                    }
                } catch (err) {
                    showCustomAlert('Ошибка', 'Ошибка импорта: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });
}

var clearBtn = document.getElementById('clearCanvasBtn');
if (clearBtn) {
    clearBtn.addEventListener('click', function() {
        if (elements.length === 0) return;
        showCustomAlert(
            'Подтверждение',
            'Удалить все элементы с холста?',
            'warning',
            'Удалить',
            function() {
                elements = [];
                connections = [];
                selectedElement = null;
                renderElements();
                if (emptyState) emptyState.classList.remove('hidden');
                showCustomAlert('Готово', 'Холст очищен', 'success');
            }
        );
    });
}

// ============================================================
// КНОПКА PLAY - ЗАПУСК WORKFLOW С МОДАЛЬНЫМ ПРОГРЕССОМ
// ============================================================

var playBtn = document.getElementById('playBtn');
if (playBtn) {
    playBtn.addEventListener('click', function() {
        if (elements.length === 0) {
            showCustomAlert('Внимание', 'Нет элементов для запуска', 'warning');
            return;
        }
        
        showWorkflowNameModal(function(workflowName) {
            var model = window.exportModel();
            model.workflow.name = workflowName;
            
            var totalSteps = model.workflow.steps.length;
            
            showWorkflowProgressModal('Выполнение: ' + workflowName, totalSteps);
            
            if (typeof PaletteClient === 'undefined') {
                showCustomAlert('Ошибка', 'Клиент Palette не инициализирован', 'error');
                closeWorkflowProgressModal();
                return;
            }
            
            if (!paletteClient) {
                initPaletteClient();
            }
            
            paletteClient.startWorkflow(model.workflow)
                .then(function(result) {
                    if (result.success) {
                        paletteClient.startMonitoring(function(status) {
                            if (status.steps) {
                                updateWorkflowProgressModal(status);
                            }
                        }, 1000);
                    } else {
                        closeWorkflowProgressModal();
                        showCustomAlert('Ошибка', 'Не удалось запустить workflow: ' + result.error, 'error');
                    }
                })
                .catch(function(error) {
                    closeWorkflowProgressModal();
                    showCustomAlert('Ошибка', 'Ошибка запуска: ' + error.message, 'error');
                });
        });
    });
}

// ============================================================
// ШАБЛОНЫ — ЗАГРУЗКА ПО КЛИКУ
// ============================================================

// var loadTemplateBtn = document.getElementById('loadTemplateBtn');
// var templateSelect = document.getElementById('templateSelect');

// if (loadTemplateBtn && templateSelect) {
//     loadTemplateBtn.addEventListener('click', function() {
//         var template = templateSelect.value;
//         if (!template) {
//             showCustomAlert('Ошибка', 'Выберите шаблон из списка', 'warning');
//             return;
//         }
//         loadTemplateData(template);
//     });

//     templateSelect.addEventListener('change', function() {
//         if (this.value !== '') {
//             loadTemplateBtn.style.background = '#3B82F6';
//             loadTemplateBtn.style.color = 'white';
//             loadTemplateBtn.style.opacity = '1';
//             loadTemplateBtn.style.cursor = 'pointer';
//         } else {
//             loadTemplateBtn.style.background = '#e5e7eb';
//             loadTemplateBtn.style.color = '#9ca3af';
//             loadTemplateBtn.style.opacity = '0.6';
//             loadTemplateBtn.style.cursor = 'not-allowed';
//         }
//     });
// }

// ============================================================
// ШАБЛОНЫ — DRAG & DROP НА ХОЛСТ
// ============================================================

// 1. Настройка перетаскивания для шаблонов
document.querySelectorAll('.flow-tool-item[draggable="true"]').forEach(function(item) {

    var templateName = item.getAttribute('data-template');

    var templateList = ['web-app', 'api', 'database', 'microservices', 'cloud', 'devops'];
    
    if (templateList.includes(templateName)) {
        item.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', 'template:' + templateName);
            e.dataTransfer.effectAllowed = 'copy';
            this.style.opacity = '0.5';
        });

        item.addEventListener('dragend', function(e) {
            this.style.opacity = '1';
        });
    }
});

// 2. Обработка drop на холсте
var canvas = document.getElementById('paletteCanvas');
if (canvas) {
    canvas.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        this.style.borderColor = '#8B5CF6';
        this.style.background = 'rgba(139, 92, 246, 0.05)';
    });

    canvas.addEventListener('dragleave', function(e) {
        this.style.borderColor = '';
        this.style.background = '';
    });

    canvas.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.borderColor = '';
        this.style.background = '';
        
        var data = e.dataTransfer.getData('text/plain');
        if (!data) return;
        
        if (data.startsWith('template:')) {
            var template = data.replace('template:', '');
            // Автоматически выбираем в select и загружаем
            if (templateSelect) {
                templateSelect.value = template;
                loadTemplateData(template);
            }
        }
    });
}

// 3. Общая функция загрузки шаблона
function loadTemplateData(template) {
    var templates = {
        'web-app': {
            elements: [
                { id: 1, type: 'actor', name: 'Пользователь', x: 50, y: 50, color: '#6366F1' },
                { id: 2, type: 'asset', name: 'Веб-сервер', x: 250, y: 30, color: '#3B82F6' },
                { id: 3, type: 'asset', name: 'База данных', x: 250, y: 200, color: '#3B82F6' },
                { id: 4, type: 'control', name: 'WAF', x: 420, y: 80, color: '#10B981' },
                { id: 5, type: 'threat', name: 'XSS', x: 420, y: 200, color: '#EF4444' },
                { id: 6, type: 'data', name: 'Пользовательские данные', x: 80, y: 250, color: '#F59E0B' }
            ],
            connections: []
        },
        'api': {
            elements: [
                { id: 1, type: 'actor', name: 'Клиент', x: 50, y: 80, color: '#6366F1' },
                { id: 2, type: 'asset', name: 'API Gateway', x: 220, y: 40, color: '#3B82F6' },
                { id: 3, type: 'asset', name: 'Auth Service', x: 220, y: 200, color: '#3B82F6' },
                { id: 4, type: 'asset', name: 'User Service', x: 380, y: 80, color: '#3B82F6' },
                { id: 5, type: 'asset', name: 'БД пользователей', x: 380, y: 220, color: '#3B82F6' },
                { id: 6, type: 'control', name: 'Rate Limiter', x: 400, y: 40, color: '#10B981' }
            ],
            connections: []
        },
        'database': {
            elements: [
                { id: 1, type: 'asset', name: 'Master DB', x: 150, y: 80, color: '#3B82F6' },
                { id: 2, type: 'asset', name: 'Slave DB', x: 350, y: 80, color: '#3B82F6' },
                { id: 3, type: 'asset', name: 'Backup Storage', x: 250, y: 220, color: '#3B82F6' },
                { id: 4, type: 'control', name: 'Replication', x: 250, y: 150, color: '#10B981' },
                { id: 5, type: 'threat', name: 'SQL Injection', x: 450, y: 150, color: '#EF4444' },
                { id: 6, type: 'data', name: 'Customer Data', x: 50, y: 150, color: '#F59E0B' }
            ],
            connections: []
        },
        'microservices': {
            elements: [
                { id: 1, type: 'actor', name: 'Пользователь', x: 30, y: 120, color: '#6366F1' },
                { id: 2, type: 'asset', name: 'API Gateway', x: 150, y: 30, color: '#3B82F6' },
                { id: 3, type: 'asset', name: 'Order Service', x: 150, y: 180, color: '#3B82F6' },
                { id: 4, type: 'asset', name: 'Payment Service', x: 300, y: 80, color: '#3B82F6' },
                { id: 5, type: 'asset', name: 'Notification', x: 300, y: 220, color: '#3B82F6' },
                { id: 6, type: 'asset', name: 'БД Orders', x: 450, y: 180, color: '#3B82F6' },
                { id: 7, type: 'control', name: 'Circuit Breaker', x: 450, y: 30, color: '#10B981' }
            ],
            connections: []
        },
        'cloud': {
            elements: [
                { id: 1, type: 'actor', name: 'Пользователь', x: 30, y: 100, color: '#6366F1' },
                { id: 2, type: 'asset', name: 'Load Balancer', x: 180, y: 30, color: '#3B82F6' },
                { id: 3, type: 'asset', name: 'App Server 1', x: 140, y: 160, color: '#3B82F6' },
                { id: 4, type: 'asset', name: 'App Server 2', x: 280, y: 160, color: '#3B82F6' },
                { id: 5, type: 'asset', name: 'БД Cluster', x: 210, y: 280, color: '#3B82F6' },
                { id: 6, type: 'asset', name: 'Cache (Redis)', x: 380, y: 100, color: '#3B82F6' },
                { id: 7, type: 'control', name: 'Auto-scaling', x: 380, y: 250, color: '#10B981' }
            ],
            connections: []
        },
        'devops': {
            elements: [
                { id: 1, type: 'actor', name: 'Разработчик', x: 30, y: 50, color: '#6366F1' },
                { id: 2, type: 'asset', name: 'Git', x: 180, y: 20, color: '#F97316' },
                { id: 3, type: 'asset', name: 'CI/CD Server', x: 180, y: 140, color: '#3B82F6' },
                { id: 4, type: 'asset', name: 'Artifactory', x: 330, y: 60, color: '#3B82F6' },
                { id: 5, type: 'asset', name: 'Kubernetes', x: 330, y: 200, color: '#3B82F6' },
                { id: 6, type: 'asset', name: 'Monitoring', x: 480, y: 130, color: '#10B981' },
                { id: 7, type: 'control', name: 'Auto-deploy', x: 200, y: 260, color: '#10B981' }
            ],
            connections: []
        }
    };

    var data = templates[template];
    if (!data) {
        showCustomAlert('Ошибка', 'Шаблон не найден', 'error');
        return;
    }

    if (elements.length > 0) {
        var templateName = templateSelect ? templateSelect.options[templateSelect.selectedIndex]?.text || 'Шаблон' : 'Шаблон';
        showCustomAlert(
            'Подтверждение',
            'Это заменит текущую модель. Продолжить?',
            'warning',
            'Продолжить',
            function() {
                applyTemplate(data);
                showCustomAlert('Успешно', 'Шаблон "' + templateName + '" загружен!', 'success');
            }
        );
        return;
    }

    applyTemplate(data);
    var templateName = templateSelect ? templateSelect.options[templateSelect.selectedIndex]?.text || 'Шаблон' : 'Шаблон';
    showCustomAlert('Успешно', 'Шаблон "' + templateName + '" загружен!', 'success');
}

function applyTemplate(data) {
    elements = JSON.parse(JSON.stringify(data.elements));
    elements.forEach(function(el) {
        if (el.id > elementIdCounter) elementIdCounter = el.id;
    });
    connections = data.connections || [];
    selectedElement = null;
    renderElements();
    if (elements.length > 0) {
        var emptyState = document.getElementById('paletteEmpty');
        if (emptyState) emptyState.classList.add('hidden');
    }
    
    if (typeof updateStats === 'function') updateStats();
    if (typeof updateMinimap === 'function') updateMinimap();
}

// ============================================================
// DRAG & DROP ДЛЯ МОДАЛЬНОГО ОКНА ЗАГРУЗКИ КОДА
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    var dropZone = document.getElementById('dropZone');
    var fileInput = document.getElementById('codeFileInputModal');
    var statusText = document.getElementById('fileStatusText');
    var infoText = document.getElementById('fileInfoText');
    var icon = document.getElementById('dropIcon');
    
    if (dropZone && fileInput) {
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderColor = '#8B5CF6';
            this.style.background = '#f5f3ff';
            if (icon) icon.style.background = '#ede9fe';
        });
        
        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.style.borderColor = '#d1d5db';
            this.style.background = '#fafafa';
            if (icon) icon.style.background = '#f3f4f6';
        });
        
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = '#d1d5db';
            this.style.background = '#fafafa';
            if (icon) icon.style.background = '#f3f4f6';
            
            var files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });
        
        fileInput.addEventListener('change', function() {
            var file = this.files[0];
            var infoModal = document.getElementById('codeFileInfoModal');
            var loadBtn = document.getElementById('loadCodeFileBtn');
            
            if (file) {
                statusText.textContent = '📄 ' + file.name;
                statusText.style.color = '#065f46';
                infoText.textContent = (file.size / 1024).toFixed(2) + ' KB';
                
                if (infoModal) infoModal.style.display = 'block';
                if (loadBtn) {
                    loadBtn.style.background = '#8B5CF6';
                    loadBtn.style.color = 'white';
                    loadBtn.style.cursor = 'pointer';
                }
                
                if (icon) {
                    icon.style.background = '#ede9fe';
                    icon.querySelector('i').style.color = '#8B5CF6';
                }
            } else {
                statusText.textContent = 'Перетащите файл сюда или нажмите для выбора';
                statusText.style.color = '#374151';
                infoText.textContent = 'Поддерживаются: .js, .py, .java, .go, .rs, ...';
                
                if (infoModal) infoModal.style.display = 'none';
                if (loadBtn) {
                    loadBtn.style.background = '#e5e7eb';
                    loadBtn.style.color = '#9ca3af';
                    loadBtn.style.cursor = 'not-allowed';
                }
                if (icon) {
                    icon.style.background = '#f3f4f6';
                    icon.querySelector('i').style.color = '#9ca3af';
                }
            }
        });
    }
});

// ============================================================
// ЭКСПОРТ ФУНКЦИЙ
// ============================================================
window.loadTemplateData = loadTemplateData;
window.applyTemplate = applyTemplate;