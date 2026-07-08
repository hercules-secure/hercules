var exportBtn = document.getElementById('exportModelBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            if (elements.length === 0) {
                showCustomAlert('Внимание', 'Нет элементов для экспорта', 'warning');
                return;
            }
            
            var model = window.exportModel();
            var json = JSON.stringify(model, null, 2);
            var blob = new Blob([json], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'hercules-workflow-' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            URL.revokeObjectURL(url);
            showCustomAlert('Успешно', 'Workflow экспортирован', 'success');
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

    
var playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.addEventListener('click', function() {
            if (elements.length === 0) {
                showCustomAlert('Внимание', 'Нет элементов для запуска', 'warning');
                return;
            }
            var model = window.exportModel();
            showCustomAlert('Запуск', 'Workflow запущен! Смотрите консоль для деталей.', 'success');
        });
    }

var loadJsonBtn = document.getElementById('loadJsonBtn');
    var jsonFileInput = document.getElementById('jsonFileInput');

    if (loadJsonBtn && jsonFileInput) {
        loadJsonBtn.addEventListener('click', function() {
            var file = jsonFileInput.files[0];
            if (!file) {
                showCustomAlert('Ошибка', 'Выберите JSON файл для загрузки', 'warning');
                return;
            }

            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var data = JSON.parse(e.target.result);
                    
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
                            // Загружаем параметры событий
                            if (step.type && step.type.startsWith('event-')) {
                                var eventConfig = getEventConfig(step.type);
                                if (eventConfig) {
                                    eventConfig.fields.forEach(function(field) {
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
                    } else if (data.elements) {
                        elements = data.elements;
                        elements.forEach(function(el) {
                            if (el.id > elementIdCounter) elementIdCounter = el.id;
                        });
                        connections = data.connections || [];
                    } else {
                        showCustomAlert('Ошибка', 'Неверный формат файла', 'error');
                        return;
                    }
                    
                    selectedElement = null;
                    renderElements();
                    if (elements.length > 0) {
                        if (emptyState) emptyState.classList.add('hidden');
                    }
                    showCustomAlert('Успешно', 'Модель загружена!', 'success');
                } catch (err) {
                    showCustomAlert('Ошибка', 'Ошибка загрузки: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        });

        jsonFileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                loadJsonBtn.style.background = '#3B82F6';
                loadJsonBtn.style.color = 'white';
                loadJsonBtn.style.opacity = '1';
                loadJsonBtn.style.cursor = 'pointer';
            } else {
                loadJsonBtn.style.background = '#e5e7eb';
                loadJsonBtn.style.color = '#9ca3af';
                loadJsonBtn.style.opacity = '0.6';
                loadJsonBtn.style.cursor = 'not-allowed';
            }
        });
    }

    var loadTemplateBtn = document.getElementById('loadTemplateBtn');
    var templateSelect = document.getElementById('templateSelect');

    if (loadTemplateBtn && templateSelect) {
        loadTemplateBtn.addEventListener('click', function() {
            var template = templateSelect.value;
            if (!template) {
                showCustomAlert('Ошибка', 'Выберите шаблон из списка', 'warning');
                return;
            }

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
                }
            };

            var data = templates[template];
            if (!data) {
                showCustomAlert('Ошибка', 'Шаблон не найден', 'error');
                return;
            }

            if (elements.length > 0) {
                showCustomAlert(
                    'Подтверждение',
                    'Это заменит текущую модель. Продолжить?',
                    'warning',
                    'Продолжить',
                    function() {
                        elements = JSON.parse(JSON.stringify(data.elements));
                        elements.forEach(function(el) {
                            if (el.id > elementIdCounter) elementIdCounter = el.id;
                        });
                        connections = data.connections || [];
                        selectedElement = null;
                        renderElements();
                        if (elements.length > 0) {
                            document.getElementById('paletteEmpty').classList.add('hidden');
                        }
                        showCustomAlert('Успешно', 'Шаблон "' + templateSelect.options[templateSelect.selectedIndex].text + '" загружен!', 'success');
                    }
                );
                return;
            }

            elements = JSON.parse(JSON.stringify(data.elements));
            elements.forEach(function(el) {
                if (el.id > elementIdCounter) elementIdCounter = el.id;
            });
            connections = data.connections || [];
            selectedElement = null;
            renderElements();
            if (elements.length > 0) {
                if (emptyState) emptyState.classList.add('hidden');
            }
            showCustomAlert('Успешно', 'Шаблон "' + templateSelect.options[templateSelect.selectedIndex].text + '" загружен!', 'success');
        });

        templateSelect.addEventListener('change', function() {
            if (this.value !== '') {
                loadTemplateBtn.style.background = '#3B82F6';
                loadTemplateBtn.style.color = 'white';
                loadTemplateBtn.style.opacity = '1';
                loadTemplateBtn.style.cursor = 'pointer';
            } else {
                loadTemplateBtn.style.background = '#e5e7eb';
                loadTemplateBtn.style.color = '#9ca3af';
                loadTemplateBtn.style.opacity = '0.6';
                loadTemplateBtn.style.cursor = 'not-allowed';
            }
        });
    }