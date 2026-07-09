// ============================================================
// ПАЛИТРА - КАСТОМНЫЙ АЛЕРТ
// ============================================================

var emptyState = null


// ============================================================
// ГЛОБАЛЬНЫЕ ДАННЫЕ
// ============================================================

var elements = [];
var connections = [];
var selectedElement = null;
var elementIdCounter = 0;
var currentDataConnectionId = null;
var connectionFromId = null;
var connectionToId = null;
var isConnecting = false;
var connectFromId = null;
var connectFromType = null;
var currentConnectionPropsId = null;
var pendingConnectionData = null;

// ============================================================
// КОНФИГУРАЦИЯ ПОЛЕЙ ДЛЯ ИНСТРУМЕНТОВ
// ============================================================

const toolFieldsConfig = {
    'scout': {
        label: 'Скаут',
        type: 'recon',
        icon: 'fa-binoculars',
        color: '#8B5CF6',
        description: 'Сканирование веб-ресурсов и сбор информации',
        fields: [
            { id: 'source', label: 'Источник', type: 'select', options: ['url'], default: 'url' },
            { id: 'sourceValue', label: 'Целевой URL', type: 'text', placeholder: 'https://example.com', required: true, showFor: ['url'] }
        ]
    },
    'echo': {
        label: 'Эхолот',
        type: 'network_scan',
        icon: 'fa-satellite-dish',
        color: '#3B82F6',
        description: 'Сканирование сети и портов',
        fields: [
            { id: 'source', label: 'Источник', type: 'select', options: ['ip', 'range', 'network'], default: 'ip' },
            { id: 'sourceValue', label: 'Значение', type: 'text', placeholder: '192.168.1.1 или 192.168.1.0/24', required: true, showFor: ['ip', 'range', 'network'] },
            { id: 'ports', label: 'Порты', type: 'text', placeholder: '80,443,1-1000', default: '1-1000' }
        ]
    },
    'sca': {
        label: 'Матрешка',
        type: 'composition',
        icon: 'fa-sitemap',
        color: '#8B5CF6',
        description: 'Композиционный анализ зависимостей',
        fields: [
            { id: 'source', label: 'Источник', type: 'select', options: ['git'], default: 'git' },
            { id: 'sourceValue', label: 'URL репозитория', type: 'text', placeholder: 'https://github.com/user/repo.git', required: true, showFor: ['git'] }
        ]
    },
    'blender': {
        label: 'Блендер',
        type: 'code_analysis',
        icon: 'fa-flask',
        color: '#10B981',
        description: 'Анализ исходного кода',
        fields: [
            { id: 'source', label: 'Источник', type: 'select', options: ['git'], default: 'git' },
            { id: 'sourceValue', label: 'URL репозитория', type: 'text', placeholder: 'https://github.com/user/repo.git', required: true, showFor: ['git'] }
        ]
    },
    'fuzz': {
        label: 'Баба Яга',
        type: 'fuzzing',
        icon: 'fa-radiation',
        color: '#EF4444',
        description: 'Динамический анализ и фаззинг',
        fields: [
            { id: 'mode', label: 'Режим', type: 'select', options: ['domovoy', 'metla'], default: 'domovoy' },
            { id: 'source', label: 'Источник', type: 'select', options: ['url', 'ip'], default: 'url' },
            { id: 'sourceValue', label: 'Цель', type: 'text', placeholder: 'https://example.com/api или 192.168.1.1', required: true, showFor: ['url', 'ip'] }
        ]
    }
};

function getToolConfig(toolName) {
    return toolFieldsConfig[toolName] || null;
}

// ============================================================
// КОНФИГУРАЦИЯ ПОЛЕЙ ДЛЯ БАЗОВЫХ ЭЛЕМЕНТОВ
// ============================================================

const elementFieldsConfig = {
    asset: {
        label: 'Компонент',
        fields: [
            { id: 'propVersion', label: 'Версия', type: 'text', placeholder: '1.24.0' },
            { id: 'propDescription', label: 'Описание', type: 'textarea', placeholder: 'Описание компонента...' }
        ]
    },
    threat: {
        label: 'Угроза',
        fields: [
            { id: 'propSeverity', label: 'Критичность', type: 'select', options: ['critical', 'high', 'medium', 'low'] },
            { id: 'propCve', label: 'CVE', type: 'text', placeholder: 'CVE-2024-XXXX' },
            { id: 'propDescription', label: 'Описание', type: 'textarea', placeholder: 'Описание угрозы...' },
            { id: 'propMitigation', label: 'Методы защиты', type: 'textarea', placeholder: 'Способы защиты...' }
        ]
    },
    data: {
        label: 'Данные',
        fields: [
            { id: 'propSensitivity', label: 'Чувствительность', type: 'select', options: ['public', 'internal', 'confidential', 'top-secret'] },
            { id: 'propFormat', label: 'Формат', type: 'text', placeholder: 'JSON, XML, CSV...' },
            { id: 'propStorage', label: 'Хранилище', type: 'text', placeholder: 'S3, PostgreSQL, Redis...' }
        ]
    },
    actor: {
        label: 'Субъект',
        fields: [
            { id: 'propRole', label: 'Роль', type: 'text', placeholder: 'admin, user, service...' },
            { id: 'propPermissions', label: 'Права доступа', type: 'text', placeholder: 'read, write, admin...' },
            { id: 'propDescription', label: 'Описание', type: 'textarea', placeholder: 'Описание субъекта...' }
        ]
    },
    network: {
        label: 'Сеть',
        fields: [
            { id: 'propProtocol', label: 'Протокол', type: 'text', placeholder: 'TCP, UDP, HTTP...' },
            { id: 'propPorts', label: 'Порты', type: 'text', placeholder: '80, 443, 8080...' },
            { id: 'propDescription', label: 'Описание', type: 'textarea', placeholder: 'Описание сетевого взаимодействия...' }
        ]
    },
    'gate-and': {
        label: 'AND',
        fields: [
            { id: 'propDescription', label: 'Описание', type: 'textarea', placeholder: 'Условия срабатывания...' }
        ]
    },
    'gate-or': {
        label: 'OR',
        fields: [
            { id: 'propDescription', label: 'Описание', type: 'textarea', placeholder: 'Условия срабатывания...' }
        ]
    },
    'gate-if': {
        label: 'IF',
        fields: [
            { id: 'propCondition', label: 'Условие', type: 'text', placeholder: 'Условие для ветвления...' },
            { id: 'propDescription', label: 'Описание', type: 'textarea', placeholder: 'Описание условий...' }
        ]
    },
    'gate-switch': {
        label: 'SWITCH',
        fields: [
            { id: 'propCases', label: 'Варианты', type: 'text', placeholder: 'case1, case2, case3...' },
            { id: 'propDefault', label: 'По умолчанию', type: 'text', placeholder: 'default' },
            { id: 'propDescription', label: 'Описание', type: 'textarea', placeholder: 'Описание переключателя...' }
        ]
    },
    'event-start': {
        label: 'Старт',
        fields: [
            { id: 'eventTrigger', label: 'Триггер', type: 'select', options: ['none', 'message', 'timer', 'signal', 'conditional'], default: 'none' },
            { id: 'eventTimer', label: 'Таймер (ms)', type: 'text', placeholder: '5000', showFor: ['timer'] },
            { id: 'eventMessage', label: 'Сообщение', type: 'text', placeholder: 'start.event', showFor: ['message'] }
        ]
    },
    'event-end': {
        label: 'Финиш',
        fields: [
            { id: 'eventResult', label: 'Результат', type: 'select', options: ['success', 'error', 'cancel'], default: 'success' },
            { id: 'eventMessage', label: 'Сообщение', type: 'text', placeholder: 'Результат выполнения' }
        ]
    },
    'event-pause': {
        label: 'Пауза',
        fields: [
            { id: 'eventDuration', label: 'Длительность (ms)', type: 'text', placeholder: '5000' },
            { id: 'eventCondition', label: 'Условие продолжения', type: 'text', placeholder: 'condition === true' }
        ]
    },
    'event-timeout': {
        label: 'Таймаут',
        fields: [
            { id: 'eventTimeout', label: 'Таймаут (ms)', type: 'text', placeholder: '30000', default: '30000' },
            { id: 'eventAction', label: 'Действие', type: 'select', options: ['interrupt', 'continue', 'retry', 'fail'], default: 'interrupt' },
            { id: 'eventRetryCount', label: 'Количество попыток', type: 'text', placeholder: '3', showFor: ['retry'] }
        ]
    },
    'event-error': {
        label: 'Ошибка',
        fields: [
            { id: 'eventErrorCode', label: 'Код ошибки', type: 'text', placeholder: 'ERR-001' },
            { id: 'eventErrorMessage', label: 'Сообщение', type: 'textarea', placeholder: 'Описание ошибки...' },
            { id: 'eventAction', label: 'Действие', type: 'select', options: ['retry', 'fail', 'ignore'], default: 'fail' }
        ]
    },
    'event-interrupt': {
        label: 'Прерывание',
        fields: [
            { id: 'eventInterruptType', label: 'Тип', type: 'select', options: ['cancel', 'terminate'], default: 'cancel' },
            { id: 'eventMessage', label: 'Сообщение', type: 'text', placeholder: 'Прерывание выполнения' }
        ]
    }
};

function getEventConfig(eventType) {
    return elementFieldsConfig[eventType] || null;
}

// ============================================================
// ФУНКЦИЯ ПЕРЕТАСКИВАНИЯ ЭЛЕМЕНТОВ
// ============================================================

window.startDrag = function(e, id) {
    var el = elements.find(function(item) { return item.id === id; });
    if (!el) return;
    
    var canvas = document.getElementById('paletteCanvas');
    var rect = canvas.getBoundingClientRect();
    
    var offsetX = e.clientX - rect.left - el.x;
    var offsetY = e.clientY - rect.top - el.y;
    
    function onMouseMove(ev) {
        var newX = ev.clientX - rect.left - offsetX;
        var newY = ev.clientY - rect.top - offsetY;
        
        newX = Math.max(0, Math.min(newX, canvas.clientWidth - 120));
        newY = Math.max(0, Math.min(newY, canvas.clientHeight - 40));
        
        el.x = newX;
        el.y = newY;
        renderElements();
    }
    
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

// ============================================================
// ФУНКЦИИ ДЛЯ МОДАЛКИ СВОЙСТВ ЭЛЕМЕНТА
// ============================================================

window.openElementPropsModal = function(id) {
    var el = elements.find(function(e) { return e.id === id; });
    if (!el) {
        showCustomAlert('Ошибка', 'Элемент не найден', 'error');
        return;
    }

    selectedElement = el;
    var modal = document.getElementById('elementPropsModal');
    if (!modal) {
        showCustomAlert('Ошибка', 'Модалка свойств элемента не найдена', 'error');
        return;
    }
    
    modal.classList.add('active');
    modal.style.display = 'flex';

    document.getElementById('propName').value = el.name || '';
    document.getElementById('propType').value = el.type || 'asset';
    document.getElementById('propColor').value = el.color || '#3B82F6';
    
    var dynamicContainer = document.getElementById('dynamicFieldsContainer');
    dynamicContainer.innerHTML = '';
    
    var config;
    
    // Проверяем, является ли элемент событием
    var isEvent = el.type && el.type.startsWith('event-');

    // В openElementPropsModal, после проверки isEvent, добавьте:

// UML Класс
if (el.type === 'uml-class') {
    var modalTitle = document.querySelector('#elementPropsModal .modal-title');
    if (modalTitle) {
        modalTitle.textContent = 'Свойства класса: ' + el.name;
    }
    
    // var header = document.createElement('div');
    // header.style.cssText = 'margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;';
    // header.innerHTML = `
    //     <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1a1a2e; font-family: Ubuntu, sans-serif;">
    //         <i class="fas fa-cube"></i> Поля и методы класса
    //     </h4>
    // `;
    // dynamicContainer.appendChild(header);
    
    // // Поля
    // var fieldsWrapper = document.createElement('div');
    // fieldsWrapper.style.cssText = 'margin-bottom: 12px;';
    // fieldsWrapper.innerHTML = `
    //     <label style="display: block; font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px; font-family: Ubuntu, sans-serif;">
    //         Свойства (поля):
    //     </label>
    //     <div id="umlFieldsContainer" style="margin-bottom: 8px;">
    //         ${(el.fields || []).map(function(f, i) {
    //             return `<div style="display: flex; gap: 6px; margin-bottom: 4px; align-items: center;">
    //                 <input type="text" value="${f}" class="uml-field-input" data-index="${i}" style="flex: 1; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; font-family: Ubuntu, sans-serif;">
    //                 <button onclick="removeUmlField(${el.id}, ${i})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px;">×</button>
    //             </div>`;
    //         }).join('')}
    //     </div>
    //     <button onclick="addUmlFieldModal(${el.id})" style="
    //         padding: 4px 12px;
    //         border: 1px dashed #8B5CF6;
    //         border-radius: 4px;
    //         background: none;
    //         color: #8B5CF6;
    //         cursor: pointer;
    //         font-size: 12px;
    //         font-family: Ubuntu, sans-serif;
    //     ">+ Добавить поле</button>
    // `;
    // dynamicContainer.appendChild(fieldsWrapper);
    
    // // Методы
    // var methodsWrapper = document.createElement('div');
    // methodsWrapper.style.cssText = 'margin-top: 12px;';
    // methodsWrapper.innerHTML = `
    //     <label style="display: block; font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px; font-family: Ubuntu, sans-serif;">
    //         Методы:
    //     </label>
    //     <div id="umlMethodsContainer" style="margin-bottom: 8px;">
    //         ${(el.methods || []).map(function(m, i) {
    //             var params = m.params && m.params.length > 0 ? '(' + m.params.join(', ') + ')' : '()';
    //             return `<div style="display: flex; gap: 6px; margin-bottom: 4px; align-items: center;">
    //                 <input type="text" value="${m.name + params}" class="uml-method-input" data-index="${i}" style="flex: 1; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; font-family: Ubuntu, sans-serif;">
    //                 <button onclick="removeUmlMethod(${el.id}, ${i})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px;">×</button>
    //             </div>`;
    //         }).join('')}
    //     </div>
    //     <button onclick="addUmlMethodModal(${el.id})" style="
    //         padding: 4px 12px;
    //         border: 1px dashed #10B981;
    //         border-radius: 4px;
    //         background: none;
    //         color: #10B981;
    //         cursor: pointer;
    //         font-size: 12px;
    //         font-family: Ubuntu, sans-serif;
    //     ">+ Добавить метод</button>
    // `;
    // dynamicContainer.appendChild(methodsWrapper);
    
    // Сохраняем ID элемента для обработчиков
    dynamicContainer.dataset.elementId = el.id;
}
    
    if (el.isTool && el.tool) {
        config = getToolConfig(el.tool);
        if (config) {
            var modalTitle = document.querySelector('#elementPropsModal .modal-title');
            if (modalTitle) {
                modalTitle.textContent = 'Свойства: ' + config.label;
            }
            
            var header = document.createElement('div');
            header.style.cssText = 'margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;';
            header.innerHTML = `
                <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1a1a2e; font-family: Ubuntu, sans-serif;">
                    Параметры инструмента
                </h4>
                <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280; font-family: Ubuntu, sans-serif;">
                    ${config.description || ''}
                </p>
            `;
            dynamicContainer.appendChild(header);
            
            var currentSource = el.source || config.fields[0]?.default || 'git';
            var fieldsWrapper = document.createElement('div');
            fieldsWrapper.id = 'fieldsWrapper';
            
            config.fields.forEach(function(field) {
                var fieldDiv = document.createElement('div');
                fieldDiv.style.cssText = 'margin-bottom: 12px;';
                fieldDiv.className = 'param-field';
                if (field.showFor) {
                    fieldDiv.dataset.showFor = field.showFor.join(',');
                }
                if (field.showFor && !field.showFor.includes(currentSource)) {
                    fieldDiv.style.display = 'none';
                }
                
                var label = document.createElement('label');
                label.style.cssText = 'display: block; font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px; font-family: Ubuntu, sans-serif;';
                label.textContent = field.label + (field.required ? ' *' : '');
                fieldDiv.appendChild(label);
                
                if (field.type === 'select') {
                    var select = document.createElement('select');
                    select.id = field.id;
                    select.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Ubuntu, sans-serif; background: white;';
                    
                    var optionLabels = {
                        'git': 'Git репозиторий',
                        'domovoy': 'Домовой',
                        'metla': 'Метла',
                        'url': 'URL',
                        'ip': 'IP адрес',
                        'range': 'Диапазон IP',
                        'network': 'Сеть (CIDR)',
                        'all': 'Все типы',
                        'xss': 'XSS',
                        'sqli': 'SQL Injection',
                        'path_traversal': 'Path Traversal',
                        'rce': 'RCE'
                    };
                    
                    field.options.forEach(function(opt) {
                        var option = document.createElement('option');
                        option.value = opt;
                        option.textContent = optionLabels[opt] || opt;
                        if (el[field.id] === opt || (field.default && field.default === opt && !el[field.id])) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                    
                    if (field.id === 'source') {
                        select.addEventListener('change', function() {
                            var newSource = this.value;
                            var allFields = fieldsWrapper.querySelectorAll('.param-field');
                            allFields.forEach(function(fieldEl) {
                                var showFor = fieldEl.dataset.showFor;
                                if (showFor) {
                                    var showValues = showFor.split(',');
                                    if (showValues.includes(newSource)) {
                                        fieldEl.style.display = 'block';
                                    } else {
                                        fieldEl.style.display = 'none';
                                    }
                                }
                            });
                        });
                    }
                    
                    fieldDiv.appendChild(select);
                } else if (field.type === 'file') {
                    var fileWrapper = document.createElement('div');
                    fileWrapper.style.cssText = 'display: flex; gap: 10px; align-items: center; flex-wrap: wrap;';
                    
                    var fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.id = field.id;
                    fileInput.accept = field.accept || '*/*';
                    fileInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Ubuntu, sans-serif; min-width: 150px;';
                    
                    var fileNameDisplay = document.createElement('span');
                    fileNameDisplay.style.cssText = 'font-size: 12px; color: #6b7280;';
                    fileNameDisplay.textContent = 'Файл не выбран';
                    
                    fileInput.addEventListener('change', function() {
                        if (this.files && this.files[0]) {
                            fileNameDisplay.textContent = this.files[0].name;
                        }
                    });
                    
                    fileWrapper.appendChild(fileInput);
                    fileWrapper.appendChild(fileNameDisplay);
                    fieldDiv.appendChild(fileWrapper);
                } else if (field.type === 'folder') {
                    var folderWrapper = document.createElement('div');
                    folderWrapper.style.cssText = 'display: flex; gap: 10px; align-items: center; flex-wrap: wrap;';
                    
                    var folderInput = document.createElement('input');
                    folderInput.type = 'text';
                    folderInput.id = field.id;
                    folderInput.placeholder = field.placeholder || 'Выберите папку...';
                    folderInput.style.cssText = 'flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Ubuntu, sans-serif; min-width: 150px; background: #f8fafc;';
                    if (el[field.id]) {
                        folderInput.value = el[field.id];
                    }
                    
                    var folderBtn = document.createElement('button');
                    folderBtn.type = 'button';
                    folderBtn.innerHTML = '<i class="fas fa-folder-open"></i> Выбрать';
                    folderBtn.style.cssText = `
                        padding: 8px 16px;
                        border: 1px solid #3B82F6;
                        border-radius: 6px;
                        background: #3B82F6;
                        color: white;
                        cursor: pointer;
                        font-family: Ubuntu, sans-serif;
                        font-size: 13px;
                        font-weight: 500;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    `;
                    folderBtn.onmouseover = function() {
                        this.style.background = '#2563EB';
                        this.style.borderColor = '#2563EB';
                    };
                    folderBtn.onmouseout = function() {
                        this.style.background = '#3B82F6';
                        this.style.borderColor = '#3B82F6';
                    };
                    folderBtn.onclick = function() {
                        var dirPicker = document.createElement('input');
                        dirPicker.type = 'file';
                        dirPicker.setAttribute('webkitdirectory', '');
                        dirPicker.setAttribute('directory', '');
                        dirPicker.style.display = 'none';
                        dirPicker.onchange = function(e) {
                            if (this.files && this.files.length > 0) {
                                var path = this.files[0].webkitRelativePath.split('/')[0];
                                folderInput.value = path;
                                el[field.id] = path;
                            }
                        };
                        document.body.appendChild(dirPicker);
                        dirPicker.click();
                        document.body.removeChild(dirPicker);
                    };
                    
                    folderWrapper.appendChild(folderInput);
                    folderWrapper.appendChild(folderBtn);
                    fieldDiv.appendChild(folderWrapper);
                } else {
                    var input = document.createElement('input');
                    input.type = 'text';
                    input.id = field.id;
                    input.placeholder = field.placeholder || '';
                    input.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Ubuntu, sans-serif;';
                    if (field.default && !el[field.id]) {
                        input.value = field.default;
                    }
                    if (el[field.id]) {
                        input.value = el[field.id];
                    }
                    fieldDiv.appendChild(input);
                }
                
                if (field.description) {
                    var desc = document.createElement('div');
                    desc.style.cssText = 'font-size: 11px; color: #9ca3af; margin-top: 2px; font-family: Ubuntu, sans-serif;';
                    desc.textContent = field.description;
                    fieldDiv.appendChild(desc);
                }
                
                fieldsWrapper.appendChild(fieldDiv);
            });
            
            dynamicContainer.appendChild(fieldsWrapper);
        }
    } else if (isEvent) {
        // Блок для событий
        var eventConfig = getEventConfig(el.type);
        if (eventConfig) {
            var modalTitle = document.querySelector('#elementPropsModal .modal-title');
            if (modalTitle) {
                modalTitle.textContent = 'Свойства: ' + eventConfig.label;
            }
            
            var header = document.createElement('div');
            header.style.cssText = 'margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;';
            header.innerHTML = `
                <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1a1a2e; font-family: Ubuntu, sans-serif;">
                    <i class="fas fa-clock"></i> Свойства события
                </h4>
            `;
            dynamicContainer.appendChild(header);
            
            var fieldsWrapper = document.createElement('div');
            fieldsWrapper.id = 'fieldsWrapper';
            
            eventConfig.fields.forEach(function(field) {
                var fieldDiv = document.createElement('div');
                fieldDiv.style.cssText = 'margin-bottom: 12px;';
                fieldDiv.className = 'event-field';
                if (field.showFor) {
                    fieldDiv.dataset.showFor = field.showFor.join(',');
                }
                
                var label = document.createElement('label');
                label.style.cssText = 'display: block; font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px; font-family: Ubuntu, sans-serif;';
                label.textContent = field.label + (field.required ? ' *' : '');
                fieldDiv.appendChild(label);
                
                if (field.type === 'select') {
                    var select = document.createElement('select');
                    select.id = field.id;
                    select.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Ubuntu, sans-serif; background: white;';
                    
                    field.options.forEach(function(opt) {
                        var option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
                        if (el[field.id] === opt || (field.default && field.default === opt && !el[field.id])) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                    
                    if (field.id === 'eventTrigger') {
                        select.addEventListener('change', function() {
                            var value = this.value;
                            var allFields = fieldsWrapper.querySelectorAll('.event-field');
                            allFields.forEach(function(fieldEl) {
                                var showFor = fieldEl.dataset.showFor;
                                if (showFor) {
                                    var showValues = showFor.split(',');
                                    if (showValues.includes(value)) {
                                        fieldEl.style.display = 'block';
                                    } else {
                                        fieldEl.style.display = 'none';
                                    }
                                }
                            });
                        });
                    }
                    
                    fieldDiv.appendChild(select);
                } else if (field.type === 'textarea') {
                    var textarea = document.createElement('textarea');
                    textarea.id = field.id;
                    textarea.rows = 2;
                    textarea.placeholder = field.placeholder || '';
                    textarea.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Ubuntu, sans-serif; resize: vertical;';
                    if (el[field.id]) {
                        textarea.value = el[field.id];
                    }
                    fieldDiv.appendChild(textarea);
                } else {
                    var input = document.createElement('input');
                    input.type = 'text';
                    input.id = field.id;
                    input.placeholder = field.placeholder || '';
                    input.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Ubuntu, sans-serif;';
                    if (field.default && !el[field.id]) {
                        input.value = field.default;
                    }
                    if (el[field.id]) {
                        input.value = el[field.id];
                    }
                    fieldDiv.appendChild(input);
                }
                
                if (field.description) {
                    var desc = document.createElement('div');
                    desc.style.cssText = 'font-size: 11px; color: #9ca3af; margin-top: 2px; font-family: Ubuntu, sans-serif;';
                    desc.textContent = field.description;
                    fieldDiv.appendChild(desc);
                }
                
                fieldsWrapper.appendChild(fieldDiv);
            });
            
            // Обновляем видимость зависимых полей
            setTimeout(function() {
                var firstSelect = fieldsWrapper.querySelector('select');
                if (firstSelect) {
                    firstSelect.dispatchEvent(new Event('change'));
                }
            }, 10);
            
            dynamicContainer.appendChild(fieldsWrapper);
        }
    } else {
        var typeKey = el.type || 'asset';
        config = elementFieldsConfig[typeKey] || elementFieldsConfig.asset;
        
        var modalTitle = document.querySelector('#elementPropsModal .modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'Свойства: ' + config.label;
        }
        
        if (config.fields && config.fields.length > 0) {
            var header = document.createElement('div');
            header.style.cssText = 'margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;';
            header.innerHTML = '<h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1a1a2e; font-family: Ubuntu, sans-serif;">Дополнительные параметры</h4>';
            dynamicContainer.appendChild(header);
        }
        
        config.fields.forEach(function(field) {
            var fieldDiv = document.createElement('div');
            fieldDiv.style.cssText = 'margin-bottom: 14px;';
            
            var label = document.createElement('label');
            label.style.cssText = 'display: block; font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px; font-family: Ubuntu, sans-serif;';
            label.textContent = field.label;
            fieldDiv.appendChild(label);
            
            if (field.type === 'select') {
                var select = document.createElement('select');
                select.id = field.id;
                select.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Ubuntu, sans-serif; background: white;';
                
                field.options.forEach(function(opt) {
                    var option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
                    if (el[field.id] === opt) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
                fieldDiv.appendChild(select);
            } else if (field.type === 'textarea') {
                var textarea = document.createElement('textarea');
                textarea.id = field.id;
                textarea.rows = 2;
                textarea.placeholder = field.placeholder || '';
                textarea.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Ubuntu, sans-serif; resize: vertical;';
                if (el[field.id]) {
                    textarea.value = el[field.id];
                }
                fieldDiv.appendChild(textarea);
            } else {
                var input = document.createElement('input');
                input.type = field.type || 'text';
                input.id = field.id;
                input.placeholder = field.placeholder || '';
                input.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Ubuntu, sans-serif;';
                if (el[field.id]) {
                    input.value = el[field.id];
                }
                fieldDiv.appendChild(input);
            }
            
            dynamicContainer.appendChild(fieldDiv);
        });
    }
};

window.closeElementPropsModal = function() {
    var modal = document.getElementById('elementPropsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    selectedElement = null;
};

window.saveElementProps = function() {
    if (!selectedElement) {
        showCustomAlert('Ошибка', 'Элемент не выбран', 'error');
        return;
    }

    var name = document.getElementById('propName').value.trim() || selectedElement.name;
    var type = document.getElementById('propType').value;
    var color = document.getElementById('propColor').value;
    
    selectedElement.name = name;
    selectedElement.type = type;
    selectedElement.color = color;
    
    var isEvent = type && type.startsWith('event-');
    
    if (selectedElement.isTool && selectedElement.tool) {
        var config = getToolConfig(selectedElement.tool);
        if (config) {
            var currentSource = selectedElement.source || config.fields[0]?.default || 'git';
            var visibleFields = config.fields.filter(function(field) {
                if (!field.showFor) return true;
                return field.showFor.includes(currentSource);
            });
            
            visibleFields.forEach(function(field) {
                var fieldElement = document.getElementById(field.id);
                if (fieldElement) {
                    if (field.type === 'file') {
                        if (fieldElement.files && fieldElement.files[0]) {
                            selectedElement[field.id + 'Name'] = fieldElement.files[0].name;
                        }
                    } else if (field.type === 'folder') {
                        selectedElement[field.id] = fieldElement.value;
                    } else {
                        selectedElement[field.id] = fieldElement.value;
                    }
                }
            });
        }
    } else if (isEvent) {
        var eventConfig = getEventConfig(type);
        if (eventConfig) {
            eventConfig.fields.forEach(function(field) {
                var fieldElement = document.getElementById(field.id);
                if (fieldElement) {
                    if (field.type === 'select') {
                        selectedElement[field.id] = fieldElement.value;
                    } else if (field.type === 'textarea') {
                        selectedElement[field.id] = fieldElement.value.trim();
                    } else {
                        selectedElement[field.id] = fieldElement.value.trim();
                    }
                }
            });
        }
    } else {
        var typeKey = selectedElement.type || 'asset';
        var config = elementFieldsConfig[typeKey] || elementFieldsConfig.asset;
        
        config.fields.forEach(function(field) {
            var fieldElement = document.getElementById(field.id);
            if (fieldElement) {
                if (field.type === 'select') {
                    selectedElement[field.id] = fieldElement.value;
                } else if (field.type === 'textarea') {
                    selectedElement[field.id] = fieldElement.value.trim();
                } else {
                    selectedElement[field.id] = fieldElement.value.trim();
                }
            }
        });
    }
    
    if (selectedElement.type === 'uml-class') {
    // Сохраняем поля
    var fieldInputs = document.querySelectorAll('.uml-field-input');
    var newFields = [];
    fieldInputs.forEach(function(input) {
        var val = input.value.trim();
        if (val) newFields.push(val);
    });
    selectedElement.fields = newFields;
    
    // Сохраняем методы
    var methodInputs = document.querySelectorAll('.uml-method-input');
    var newMethods = [];
    methodInputs.forEach(function(input) {
        var val = input.value.trim();
        if (val) {
            // Парсим имя метода и параметры
            var match = val.match(/^(\w+)\s*\(([^)]*)\)$/);
            if (match) {
                var params = match[2] ? match[2].split(',').map(function(p) { return p.trim(); }).filter(function(p) { return p; }) : [];
                newMethods.push({ name: match[1], params: params, type: 'method' });
            } else {
                newMethods.push({ name: val, params: [], type: 'method' });
            }
        }
    });
    selectedElement.methods = newMethods;
    
    // Пересчитываем высоту
    recalculateUmlClassHeight(selectedElement);
}


    renderElements();
    closeElementPropsModal();
    showCustomAlert('Успешно', 'Свойства сохранены', 'success');
};

// ============================================================
// ФУНКЦИИ ДЛЯ СВЯЗЕЙ
// ============================================================

window.startConnection = function(e, fromId, portType) {
    e.stopPropagation();
    e.preventDefault();
    
    if (isConnecting) {
        cancelCurrentConnection();
        setTimeout(function() {
            startConnection(e, fromId, portType);
        }, 50);
        return;
    }
    
    isConnecting = true;
    connectFromId = fromId;
    connectFromType = portType;

    var portEl = e.currentTarget;
    if (portEl) {
        portEl.classList.add('active');
    }

    var canvas = document.getElementById('paletteCanvas');
    if (canvas) canvas.style.cursor = 'crosshair';
};

function openConnectionTypeModal(fromId, toId) {
    connectionFromId = fromId;
    connectionToId = toId;
    
    var modal = document.getElementById('connectionTypeModal');
    if (!modal) {
        showCustomAlert('Ошибка', 'Модалка выбора типа связи не найдена', 'error');
        return;
    }
    
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0, 0, 0, 0.5)';
    modal.style.backdropFilter = 'blur(4px)';
    modal.style.zIndex = '100000';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    var content = modal.querySelector('.modal-content');
    if (content) {
        content.style.background = 'white';
        content.style.borderRadius = '16px';
        content.style.padding = '28px 32px';
        content.style.maxWidth = '480px';
        content.style.width = '90%';
        content.style.boxShadow = '0 25px 50px rgba(0,0,0,0.25)';
        content.style.position = 'relative';
        content.style.zIndex = '100001';
    }
    
    modal.classList.add('active');
}

function cancelConnectionType() {
    var modal = document.getElementById('connectionTypeModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    connectionFromId = null;
    connectionToId = null;
    isConnecting = false;
    connectFromId = null;
    connectFromType = null;
    clearDragLine();
    document.querySelectorAll('.element-port.active').forEach(function(el) { 
        el.classList.remove('active'); 
    });
    var canvas = document.getElementById('paletteCanvas');
    if (canvas) canvas.style.cursor = 'default';
}

function openDataStructureModalWithData(connectionData) {
    pendingConnectionData = connectionData;
    
    var modal = document.getElementById('dataStructureModal');
    if (!modal) {
        showCustomAlert('Ошибка', 'Модалка структуры данных не найдена', 'error');
        return;
    }
    
    modal.classList.add('active');
    modal.style.display = 'flex';
    
    var container = document.getElementById('dataFieldsContainer');
    if (container) {
        container.innerHTML = '';
        addField('id', 'number');
        addField('name', 'string');
        addField('email', 'string');
        updatePreview();
    }
}

window.selectConnectionType = function(type) {
    if (connectionFromId === null || connectionToId === null) {
        showCustomAlert('Ошибка', 'Не выбраны элементы для соединения', 'error');
        return;
    }

    var fromEl = elements.find(function(e) { return e.id === connectionFromId; });
    var toEl = elements.find(function(e) { return e.id === connectionToId; });
    if (!fromEl || !toEl) {
        showCustomAlert('Ошибка', 'Один из элементов не найден', 'error');
        cancelConnectionType();
        return;
    }

    var existingConnection = connections.find(function(c) {
        return c.from === connectionFromId && c.to === connectionToId;
    });
    if (existingConnection) {
        showCustomAlert('Внимание', 'Связь между этими элементами уже существует', 'warning');
        cancelConnectionType();
        return;
    }

    var connectionData = {
        from: connectionFromId,
        to: connectionToId,
        type: type,
        label: type === 'control' ? 'управление' : 'поток данных',
        color: type === 'control' ? '#8B5CF6' : '#10B981',
        dataStructure: null
    };

    if (type === 'control') {
        var connection = {
            id: connections.length + 1,
            from: connectionData.from,
            to: connectionData.to,
            type: connectionData.type,
            label: connectionData.label,
            color: connectionData.color,
            dataStructure: null
        };
        
        connections.push(connection);
        cancelConnectionType();
        renderConnections();
        showCustomAlert('Соединение создано', 'Связь "Управление" создана', 'success');
    } else {
        cancelConnectionType();
        openDataStructureModalWithData(connectionData);
    }
};

// ============================================================
// ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ ЛИНИИ ПРИ ПРОТЯГИВАНИИ
// ============================================================

function updateDragLine(x, y) {
    var dragLineContainer = document.getElementById('dragLine');
    if (!dragLineContainer) return;
    
    if (!isConnecting || connectFromId === null) {
        dragLineContainer.innerHTML = '';
        return;
    }

    var fromEl = elements.find(function(el) { return el.id === connectFromId; });
    if (!fromEl) {
        dragLineContainer.innerHTML = '';
        return;
    }

    var fromX = fromEl.x + 120 + (connectFromType === 'right' ? 10 : -10);
    var fromY = fromEl.y + 20;

    dragLineContainer.innerHTML = `
        <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 20;">
            <line x1="${fromX}" y1="${fromY}" x2="${x}" y2="${y}" stroke="#3B82F6" stroke-width="2" stroke-dasharray="6,4" />
            <circle cx="${fromX}" cy="${fromY}" r="4" fill="#3B82F6" />
        </svg>
    `;
}

function clearDragLine() {
    var dragLineContainer = document.getElementById('dragLine');
    if (dragLineContainer) dragLineContainer.innerHTML = '';
}

function cancelCurrentConnection() {
    isConnecting = false;
    connectFromId = null;
    connectFromType = null;
    clearDragLine();
    document.querySelectorAll('.element-port.active').forEach(function(el) { 
        el.classList.remove('active'); 
    });
    var canvas = document.getElementById('paletteCanvas');
    if (canvas) canvas.style.cursor = 'default';
}

// ============================================================
// МОДАЛКА ДЛЯ КЛИКА ПО ШЕСТЕРЕНКЕ (СВЯЗИ)
// ============================================================

window.openConnectionPropsModal = function(connectionId) {
    var conn = connections.find(function(c) { return c.id === connectionId; });
    if (!conn) {
        showCustomAlert('Ошибка', 'Соединение не найдено', 'error');
        return;
    }
    
    if (conn.type === 'dataflow' || conn.type === 'data' ) {
        openDataStructureModal(connectionId);
    } else {
        showCustomAlert('Информация', 'Для связи типа "Управление" структура данных не требуется', 'info');
    }
};

// ============================================================
// ФУНКЦИИ ДЛЯ МОДАЛКИ СТРУКТУРЫ ДАННЫХ
// ============================================================

function openDataStructureModal(connectionId) {
    currentDataConnectionId = connectionId;
    var modal = document.getElementById('dataStructureModal');
    
    if (!modal) {
        showCustomAlert('Ошибка', 'Модалка структуры данных не найдена', 'error');
        return;
    }
    
    modal.classList.add('active');
    modal.style.display = 'flex';
    
    var conn = connections.find(function(c) { return c.id === connectionId; });
    if (conn && conn.dataStructure && conn.dataStructure.fields && conn.dataStructure.fields.length > 0) {
        var container = document.getElementById('dataFieldsContainer');
        container.innerHTML = '';
        conn.dataStructure.fields.forEach(function(field) {
            addField(field.name, field.type);
        });
        updatePreview();
    } else {
        var container = document.getElementById('dataFieldsContainer');
        container.innerHTML = '';
        addField('id', 'number');
        addField('name', 'string');
        addField('email', 'string');
        updatePreview();
    }
};

window.closeDataStructureModal = function() {
    var modal = document.getElementById('dataStructureModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    currentDataConnectionId = null;
    pendingConnectionData = null;
};

window.addField = function(name, type) {
    var container = document.getElementById('dataFieldsContainer');
    if (!container) return;
    
    var row = document.createElement('div');
    row.className = 'field-row';
    row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
    row.innerHTML = `
        <input type="text" placeholder="Имя поля" value="${name || ''}" style="flex: 1; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px; font-family: Ubuntu, sans-serif;">
        <select style="padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px; font-family: Ubuntu, sans-serif; background: white; min-width: 80px;">
            <option value="string" ${type === 'string' ? 'selected' : ''}>string</option>
            <option value="number" ${type === 'number' ? 'selected' : ''}>number</option>
            <option value="boolean" ${type === 'boolean' ? 'selected' : ''}>boolean</option>
            <option value="array" ${type === 'array' ? 'selected' : ''}>array</option>
            <option value="object" ${type === 'object' ? 'selected' : ''}>object</option>
            <option value="date" ${type === 'date' ? 'selected' : ''}>date</option>
        </select>
        <button class="remove-field" onclick="removeField(this)" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px; padding: 4px 8px;">&times;</button>
    `;
    container.appendChild(row);
    updatePreview();
};

window.removeField = function(btn) {
    var container = document.getElementById('dataFieldsContainer');
    if (container.children.length <= 1) {
        showCustomAlert('Внимание', 'Должно быть хотя бы одно поле', 'warning');
        return;
    }
    btn.closest('.field-row').remove();
    updatePreview();
};

function updatePreview() {
    var rows = document.querySelectorAll('#dataFieldsContainer .field-row');
    var fields = {};
    rows.forEach(function(row) {
        var inputs = row.querySelectorAll('input');
        var select = row.querySelector('select');
        if (inputs[0].value.trim()) {
            var typeMap = {
                'string': '""',
                'number': '0',
                'boolean': 'true',
                'array': '[]',
                'object': '{}',
                'date': '"2024-01-01"'
            };
            fields[inputs[0].value.trim()] = typeMap[select.value] || '""';
        }
    });
    
    var preview = document.getElementById('dataStructurePreview');
    if (!preview) return;
    
    if (Object.keys(fields).length === 0) {
        preview.textContent = '{ }';
        return;
    }
    
    var text = '{\n';
    var keys = Object.keys(fields);
    keys.forEach(function(key, index) {
        var example = fields[key];
        text += '    "' + key + '": ' + example;
        if (index < keys.length - 1) text += ',';
        text += '\n';
    });
    text += '}';
    preview.textContent = text;
}

window.saveDataStructure = function() {
    var rows = document.querySelectorAll('#dataFieldsContainer .field-row');
    var fields = [];
    rows.forEach(function(row) {
        var inputs = row.querySelectorAll('input');
        var select = row.querySelector('select');
        if (inputs[0].value.trim()) {
            fields.push({
                name: inputs[0].value.trim(),
                type: select.value
            });
        }
    });
    
    if (fields.length === 0) {
        showCustomAlert('Ошибка', 'Добавьте хотя бы одно поле', 'warning');
        return;
    }
    
    if (pendingConnectionData) {
        var connection = {
            id: connections.length + 1,
            from: pendingConnectionData.from,
            to: pendingConnectionData.to,
            type: pendingConnectionData.type,
            label: pendingConnectionData.label,
            color: pendingConnectionData.color,
            dataStructure: { fields: fields }
        };
        
        connections.push(connection);
        pendingConnectionData = null;
        closeDataStructureModal();
        renderConnections();
        showCustomAlert('Успешно', 'Структура данных сохранена и связь создана', 'success');
    } else {
        var conn = connections.find(function(c) { return c.id === currentDataConnectionId; });
        if (conn) {
            conn.dataStructure = { fields: fields };
            showCustomAlert('Успешно', 'Структура данных сохранена', 'success');
            renderConnections();
        }
        closeDataStructureModal();
    }
};

// ============================================================
// ФУНКЦИИ РЕНДЕРИНГА
// ============================================================

window.renderConnections = function() {
    var connectionsContainer = document.getElementById('canvasConnections');
    if (!connectionsContainer) {
        return;
    }
    connectionsContainer.innerHTML = '';

    if (connections.length === 0) return;

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;';

    // Добавляем defs для маркеров стрелок
    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    // Маркер для секвенс-диаграммы
    var markerSeq = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    markerSeq.setAttribute('id', 'arrowhead-sequence');
    markerSeq.setAttribute('markerWidth', '12');
    markerSeq.setAttribute('markerHeight', '8');
    markerSeq.setAttribute('refX', '10');
    markerSeq.setAttribute('refY', '4');
    markerSeq.setAttribute('orient', 'auto');
    var polySeq = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polySeq.setAttribute('points', '0 0, 10 4, 0 8');
    polySeq.setAttribute('fill', '#10B981');
    markerSeq.appendChild(polySeq);
    defs.appendChild(markerSeq);
    
    // Маркер для потока данных
    var markerData = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    markerData.setAttribute('id', 'arrowhead-dataflow');
    markerData.setAttribute('markerWidth', '12');
    markerData.setAttribute('markerHeight', '8');
    markerData.setAttribute('refX', '10');
    markerData.setAttribute('refY', '4');
    markerData.setAttribute('orient', 'auto');
    var polyData = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polyData.setAttribute('points', '0 0, 10 4, 0 8');
    polyData.setAttribute('fill', '#10B981');
    markerData.appendChild(polyData);
    defs.appendChild(markerData);
    
    svg.appendChild(defs);

    connections.forEach(function(conn) {
        var fromEl = elements.find(function(e) { return e.id === conn.from; });
        var toEl = elements.find(function(e) { return e.id === conn.to; });
        if (!fromEl || !toEl) {
            return;
        }

        // ============================================================
        // ДИАГРАММА ПОТОКА ДАННЫХ - ПРЯМЫЕ ЛИНИИ
        // ============================================================
        if (conn.type === 'data-flow') {
            var fromX = conn.fromX || (fromEl.x + fromEl.width);
            var fromY = conn.fromY || (fromEl.y + fromEl.height / 2);
            var toX = conn.toX || toEl.x;
            var toY = conn.toY || (toEl.y + toEl.height / 2);
            var color = conn.color || '#10B981';
            
            // Линия потока данных
            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            var pathData = 'M ' + fromX + ' ' + fromY + 
                           ' L ' + (toX - 10) + ' ' + toY;
            path.setAttribute('d', pathData);
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            path.setAttribute('marker-end', 'url(#arrowhead-dataflow)');
            svg.appendChild(path);
            
            // Метка потока
            if (conn.label) {
                var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                var midX = (fromX + toX) / 2;
                var midY = (fromY + toY) / 2 - 10;
                label.setAttribute('x', midX);
                label.setAttribute('y', midY);
                label.setAttribute('fill', '#475569');
                label.setAttribute('font-size', '10');
                label.setAttribute('font-family', 'Ubuntu, sans-serif');
                label.setAttribute('text-anchor', 'middle');
                label.textContent = conn.label;
                svg.appendChild(label);
            }
            
            return;
        }

        // ============================================================
        // СТАНДАРТНАЯ ОТРИСОВКА ДЛЯ ОСТАЛЬНЫХ ТИПОВ
        // ============================================================
        var fromX = fromEl.x + 120;
        var fromY = fromEl.y + 20;
        var toX = toEl.x;
        var toY = toEl.y + 20;

        var color = conn.color || (conn.type === 'control' ? '#8B5CF6' : '#10B981');

        var dx = toX - fromX;
        var dy = toY - fromY;
        var midX = (fromX + toX) / 2;
        var midY = (fromY + toY) / 2;
        
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 10) return;

        var curvature = Math.min(Math.abs(dx) * 0.3, 80);
        var pathData = 'M ' + fromX + ' ' + fromY + 
                      ' C ' + (fromX + curvature) + ' ' + fromY + 
                      ', ' + (toX - curvature) + ' ' + toY + 
                      ', ' + toX + ' ' + toY;

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);

        var angle = Math.atan2(dy, dx);
        var arrowSize = 7;
        
        var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        var arrowPoints = [
            [toX - 10 * Math.cos(angle) - arrowSize * Math.cos(angle - 0.5), 
             toY - 10 * Math.sin(angle) - arrowSize * Math.sin(angle - 0.5)],
            [toX, toY],
            [toX - 10 * Math.cos(angle) - arrowSize * Math.cos(angle + 0.5), 
             toY - 10 * Math.sin(angle) - arrowSize * Math.sin(angle + 0.5)]
        ];
        arrow.setAttribute('points', arrowPoints.map(function(p) { return p.join(','); }).join(' '));
        arrow.setAttribute('fill', color);
        svg.appendChild(arrow);

        if (distance > 60) {
            var perpAngle = angle + Math.PI / 2;
            var offset = 16;
            
            var textPositions = [
                { x: midX + offset * Math.cos(perpAngle), y: midY + offset * Math.sin(perpAngle) },
                { x: midX - offset * Math.cos(perpAngle), y: midY - offset * Math.sin(perpAngle) }
            ];
            
            var finalX = midX + offset * Math.cos(perpAngle);
            var finalY = midY + offset * Math.sin(perpAngle);
            
            for (var ti = 0; ti < textPositions.length; ti++) {
                var pos = textPositions[ti];
                var isOver = false;
                
                for (var ei = 0; ei < elements.length; ei++) {
                    var el = elements[ei];
                    var elCenterX = el.x + 60;
                    var elCenterY = el.y + 20;
                    var dist = Math.sqrt(Math.pow(pos.x - elCenterX, 2) + Math.pow(pos.y - elCenterY, 2));
                    if (dist < 45) {
                        isOver = true;
                        break;
                    }
                }
                
                if (!isOver) {
                    finalX = pos.x;
                    finalY = pos.y;
                    break;
                }
            }

            var canvas = document.getElementById('paletteCanvas');
            var canvasW = canvas.clientWidth || 800;
            var canvasH = canvas.clientHeight || 500;
            finalX = Math.max(15, Math.min(finalX, canvasW - 15));
            finalY = Math.max(15, Math.min(finalY, canvasH - 15));

            var label = conn.label || (conn.type === 'control' ? 'управление' : 'поток данных');
            
            var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', finalX);
            text.setAttribute('y', finalY + 3);
            text.setAttribute('fill', '#374151');
            text.setAttribute('font-size', '10');
            text.setAttribute('font-weight', '500');
            text.setAttribute('font-family', 'Ubuntu, sans-serif');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.textContent = label;
            svg.appendChild(text);

            var gearX = midX;
            var gearY = midY;
            
            var gearOver = false;
            for (var ei = 0; ei < elements.length; ei++) {
                var el = elements[ei];
                var elCenterX = el.x + 60;
                var elCenterY = el.y + 20;
                var dist = Math.sqrt(Math.pow(gearX - elCenterX, 2) + Math.pow(gearY - elCenterY, 2));
                if (dist < 40) {
                    gearOver = true;
                    break;
                }
            }
            
            if (gearOver) {
                gearX = midX + 30 * Math.cos(angle);
                gearY = midY + 30 * Math.sin(angle);
            }

            var gearGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            gearGroup.setAttribute('pointer-events', 'all');
            gearGroup.style.cursor = 'pointer';
            gearGroup.setAttribute('data-connection-id', conn.id);
            
            var clickRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            clickRect.setAttribute('x', gearX - 18);
            clickRect.setAttribute('y', gearY - 18);
            clickRect.setAttribute('width', '36');
            clickRect.setAttribute('height', '36');
            clickRect.setAttribute('rx', '18');
            clickRect.setAttribute('fill', 'transparent');
            clickRect.setAttribute('stroke', 'none');
            clickRect.setAttribute('pointer-events', 'all');
            gearGroup.appendChild(clickRect);
            
            var gearBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            gearBg.setAttribute('cx', gearX);
            gearBg.setAttribute('cy', gearY);
            gearBg.setAttribute('r', '11');
            gearBg.setAttribute('fill', 'white');
            gearBg.setAttribute('stroke', color);
            gearBg.setAttribute('stroke-width', '1.5');
            gearBg.setAttribute('opacity', '0.95');
            gearBg.setAttribute('pointer-events', 'none');
            gearGroup.appendChild(gearBg);
            
            var gearIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            gearIcon.setAttribute('x', gearX);
            gearIcon.setAttribute('y', gearY + 3);
            gearIcon.setAttribute('fill', color);
            gearIcon.setAttribute('font-size', '14');
            gearIcon.setAttribute('font-family', '"Font Awesome 6 Free", "Font Awesome 5 Free", Arial, sans-serif');
            gearIcon.setAttribute('font-weight', '900');
            gearIcon.setAttribute('text-anchor', 'middle');
            gearIcon.setAttribute('dominant-baseline', 'middle');
            gearIcon.setAttribute('pointer-events', 'none');
            gearIcon.textContent = '\u2699';
            gearGroup.appendChild(gearIcon);
            
            gearGroup.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                var connId = parseInt(this.getAttribute('data-connection-id'));
                window.openConnectionPropsModal(connId);
            });
            
            svg.appendChild(gearGroup);
        }
    });

    connectionsContainer.appendChild(svg);
};

window.renderElements = function() {
    var elementsContainer = document.getElementById('canvasElements');
    elementsContainer.innerHTML = '';
    
    elements.forEach(function(el) {
        var div = document.createElement('div');
        

if (el.type === 'uml-class') {
    var div = document.createElement('div');
    div.style.cssText = `
        position: absolute;
        left: ${el.x}px;
        top: ${el.y}px;
        width: ${el.width}px;
        height: ${el.height}px;
        background: ${el.bgColor || '#ffffff'};
        border: 2px solid ${el.borderColor || '#8B5CF6'};
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 6;
        cursor: grab;
        overflow: hidden;
        font-family: 'Ubuntu', sans-serif;
        display: flex;
        flex-direction: column;
        user-select: none;
    `;
    
    // Заголовок класса
    var header = document.createElement('div');
    header.style.cssText = `
        padding: 8px 12px;
        background: ${el.borderColor || '#8B5CF6'}20;
        border-bottom: 2px solid ${el.borderColor || '#8B5CF6'};
        font-weight: 600;
        font-size: 13px;
        color: ${el.textColor || '#1a1a2e'};
        text-align: center;
        flex-shrink: 0;
        cursor: grab;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    header.innerHTML = `
        <span>📦 ${el.name}</span>
        <span style="display: flex; gap: 4px;">
            <button class="props-btn" onclick="event.stopPropagation(); openUmlClassModal(${el.id})" title="Свойства" style="
                background: none;
                border: none;
                color: ${el.borderColor || '#8B5CF6'};
                cursor: pointer;
                font-size: 12px;
                padding: 2px 6px;
                border-radius: 4px;
            ">
                <i class="fas fa-cog"></i>
            </button>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteElement(${el.id}, event)" title="Удалить" style="
                background: none;
                border: none;
                color: #ef4444;
                cursor: pointer;
                font-size: 12px;
                padding: 2px 6px;
                border-radius: 4px;
            ">
                <i class="fas fa-times"></i>
            </button>
        </span>
    `;
    div.appendChild(header);
    
    // Контейнер для полей и методов
    var bodyContainer = document.createElement('div');
    bodyContainer.style.cssText = `
        flex: 1;
        padding: 4px 8px;
        overflow: hidden;
        font-size: 11px;
        color: #374151;
        display: flex;
        flex-direction: column;
    `;
    
    // Добавляем поля
    if (el.fields && el.fields.length > 0) {
        el.fields.forEach(function(field) {
            var fieldDiv = document.createElement('div');
            fieldDiv.style.cssText = `
                color: #6b7280;
                padding: 1px 0;
                font-size: 11px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
            fieldDiv.textContent = '▸ ' + field;
            bodyContainer.appendChild(fieldDiv);
        });
    }
    
    // Разделитель
    if (el.fields && el.fields.length > 0 && el.methods && el.methods.length > 0) {
        var separator = document.createElement('div');
        separator.style.cssText = `
            border-top: 1px solid ${el.borderColor || '#8B5CF6'}40;
            margin: 2px 0;
        `;
        bodyContainer.appendChild(separator);
    }
    
    // Добавляем методы
    if (el.methods && el.methods.length > 0) {
        el.methods.forEach(function(method) {
            var params = method.params && method.params.length > 0 ? '(' + method.params.join(', ') + ')' : '()';
            var methodName = method.name + params;
            var methodColor = method.type === 'function' ? '#3B82F6' : '#10B981';
            
            var methodDiv = document.createElement('div');
            methodDiv.style.cssText = `
                color: ${methodColor};
                padding: 1px 0;
                font-size: 11px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
            methodDiv.textContent = '▸ ' + methodName;
            bodyContainer.appendChild(methodDiv);
        });
    }
    
    div.appendChild(bodyContainer);
    
    // ============================================================
    // ПЕРЕТАСКИВАНИЕ
    // ============================================================
    div.addEventListener('mousedown', function(e) {
        if (e.target.closest('.props-btn')) return;
        if (e.target.closest('.delete-btn')) return;
        selectElement(el.id);
        startDrag(e, el.id);
    });
    
    // ============================================================
    // ДВОЙНОЙ КЛИК - СВОЙСТВА
    // ============================================================
div.addEventListener('dblclick', function(e) {
    e.stopPropagation();
    openUmlClassModal(el.id);
});
    // ============================================================
    // ПРАВАЯ КНОПКА - КОНТЕКСТНОЕ МЕНЮ
    // ============================================================
//     if (contextMenuTarget && contextMenuTarget.type === 'uml-class') {
//     openUmlClassModal(contextMenuTarget.id);
// } else {
//     openElementPropsModal(contextMenuTarget.id);
// }
    
    elementsContainer.appendChild(div);
    return;
}
// // UML Поле (свойство класса)
if (el.type === 'uml-field') {
    // var div = document.createElement('div');
    // div.style.cssText = `
    //     position: absolute;
    //     left: ${el.x}px;
    //     top: ${el.y}px;
    //     width: ${el.width}px;
    //     height: ${el.height}px;
    //     font-size: 11px;
    //     color: ${el.color || '#6b7280'};
    //     font-family: 'Ubuntu', sans-serif;
    //     z-index: 7;
    //     pointer-events: none;
    //     padding-left: 4px;
    //     white-space: nowrap;
    //     overflow: hidden;
    //     text-overflow: ellipsis;
    // `;
    // div.textContent = '▸ ' + el.name;
    // elementsContainer.appendChild(div);
    return;
}

// // UML Метод
// if (el.type === 'uml-method') {
//     var div = document.createElement('div');
//     div.style.cssText = `
//         position: absolute;
//         left: ${el.x}px;
//         top: ${el.y}px;
//         width: ${el.width}px;
//         height: ${el.height}px;
//         font-size: 11px;
//         color: ${el.color || '#3B82F6'};
//         font-family: 'Ubuntu', sans-serif;
//         z-index: 7;
//         pointer-events: none;
//         padding-left: 4px;
//         white-space: nowrap;
//         overflow: hidden;
//         text-overflow: ellipsis;
//     `;
//     div.textContent = '▸ ' + el.name;
//     elementsContainer.appendChild(div);
//     return;
// }
        // ============================================================
        // ОБЩАЯ ОТРИСОВКА ДЛЯ ВСЕХ ЭЛЕМЕНТОВ
        // ============================================================
        
        var typeClass = el.isTool ? 'type-tool' : 'type-' + el.type;
        if (el.type === 'gate-and' || el.type === 'gate-or' || el.type === 'gate-if' || el.type === 'gate-switch') {
            typeClass = 'type-gate';
        }
        if (el.type && el.type.startsWith('event-')) {
            typeClass = 'type-event';
        }
        if (el.type === 'sequence-actor') {
            typeClass = 'type-sequence-actor';
        }
        div.className = 'canvas-element ' + typeClass;
        div.dataset.id = el.id;
        div.style.left = el.x + 'px';
        div.style.top = el.y + 'px';
        div.style.background = el.bgColor || el.color + '20';
        div.style.borderColor = el.borderColor || el.color;
        div.style.color = el.textColor || el.color;

        if (selectedElement && selectedElement.id === el.id) {
            div.classList.add('selected');
        }

        var icon;
        if (el.isTool) {
            var config = getToolConfig(el.tool);
            icon = '<i class="fas ' + (config ? config.icon : 'fa-cube') + '"></i>';
        } else if (el.type === 'sequence-actor') {
            icon = '<i class="fas fa-user" style="color: #3B82F6;"></i>';
        } else {
            icon = getElementIcon(el.type);
        }

        var versionBadge = '';
        if (el.version) {
            versionBadge = `<span style="font-size: 8px; background: ${el.color}30; padding: 1px 6px; border-radius: 4px; margin-left: 4px; color: ${el.color};">v${el.version}</span>`;
        }

        // ============================================================
        // ПРАВЫЙ ПОРТ - ДЛЯ ВСЕХ ЭЛЕМЕНТОВ
        // ============================================================
        var rightPort = document.createElement('div');
        rightPort.className = 'element-port right';
        rightPort.title = 'Перетащите для создания связи';
        rightPort.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            e.preventDefault();
            if (!isConnecting) {
                startConnection(e, el.id, 'right');
            }
        });

        // ============================================================
        // ЛЕВЫЙ ПОРТ - ДЛЯ ВСЕХ ЭЛЕМЕНТОВ
        // ============================================================
        var leftPort = document.createElement('div');
        leftPort.className = 'element-port left';
        leftPort.style.cssText = 'background: #d1d5db; cursor: default;';
        leftPort.title = 'Входящий порт';

        // ============================================================
        // КНОПКИ ДЕЙСТВИЙ - ДЛЯ ВСЕХ ЭЛЕМЕНТОВ
        // ============================================================
        var actions = document.createElement('span');
        actions.className = 'element-actions';
        actions.innerHTML = `
            <button class="props-btn" onclick="openElementPropsModal(${el.id})" title="Свойства">
                <i class="fas fa-cog"></i>
            </button>
            <button class="delete-btn" onclick="deleteElement(${el.id}, event)" title="Удалить">
                <i class="fas fa-times"></i>
            </button>
        `;

        var iconSpan = document.createElement('span');
        iconSpan.className = 'element-icon';
        iconSpan.innerHTML = icon;

        var labelSpan = document.createElement('span');
        labelSpan.className = 'element-label';
        labelSpan.innerHTML = el.name + ' ' + versionBadge;

        div.appendChild(iconSpan);
        div.appendChild(labelSpan);
        div.appendChild(rightPort);
        div.appendChild(leftPort);
        div.appendChild(actions);

        div.addEventListener('mousedown', function(e) {
            if (e.target.closest('.element-actions')) return;
            if (e.target.closest('.element-port')) return;
            selectElement(el.id);
            startDrag(e, el.id);
        });

        div.addEventListener('dblclick', function() {
            openElementPropsModal(el.id);
        });

        elementsContainer.appendChild(div);
    });

    renderConnections();
};

function getElementIcon(type) {
    var icons = {
        asset: '<i class="fas fa-puzzle-piece"></i>',
        threat: '<i class="fas fa-skull"></i>',
        control: '<i class="fas fa-shield-alt"></i>',
        data: '<i class="fas fa-file-alt"></i>',
        actor: '<i class="fas fa-user"></i>',
        network: '<i class="fas fa-network-wired"></i>',
        'gate-and': '<i class="fas fa-code-branch"></i>',
        'gate-or': '<i class="fas fa-code-fork"></i>',
        'gate-if': '<i class="fas fa-question-circle"></i>',
        'gate-switch': '<i class="fas fa-code-branch"></i>',
        'event-start': '<i class="fas fa-play-circle"></i>',
        'event-end': '<i class="fas fa-stop-circle"></i>',
        'event-pause': '<i class="fas fa-pause-circle"></i>',
        'event-timeout': '<i class="fas fa-clock"></i>',
        'event-error': '<i class="fas fa-exclamation-circle"></i>',
        'event-interrupt': '<i class="fas fa-ban"></i>',
        'uml-class': '<i class="fas fa-cube"></i>',
    };
    return icons[type] || '<i class="fas fa-cube"></i>';
}

function selectElement(id) {
    selectedElement = elements.find(function(el) { return el.id === id; }) || null;
    renderElements();
}

window.deleteElement = function(id, event) {
    if (event) event.stopPropagation();
    elements = elements.filter(function(el) { return el.id !== id; });
    connections = connections.filter(function(c) { return c.from !== id && c.to !== id; });
    if (selectedElement && selectedElement.id === id) {
        selectedElement = null;
    }
    renderElements();
    if (elements.length === 0) {
        document.getElementById('paletteEmpty').classList.remove('hidden');
    }
};

// ============================================================
// ДОБАВЛЕНИЕ ЭЛЕМЕНТОВ
// ============================================================

function addToolElement(tool, x, y) {
    var config = getToolConfig(tool);
    if (!config) {
        showCustomAlert('Ошибка', 'Инструмент не найден: ' + tool, 'error');
        return null;
    }
    
    var id = ++elementIdCounter;
    var element = {
        id: id,
        type: 'tool',
        tool: tool,
        name: config.label,
        x: Math.max(10, x),
        y: Math.max(10, y),
        color: config.color || '#6B7280',
        icon: config.icon || 'fa-cube',
        width: 120,
        height: 40,
        isTool: true
    };

    config.fields.forEach(function(field) {
        if (field.default) {
            element[field.id] = field.default;
        }
    });

    elements.push(element);
    renderElements();
    selectElement(id);
    document.getElementById('paletteEmpty').classList.add('hidden');
    
    // Автоматически открываем окно свойств
    setTimeout(function() {
        openElementPropsModal(id);
    }, 100);
    
    return element;
}

function addElement(type, x, y) {
    var id = ++elementIdCounter;
    var element = {
        id: id,
        type: type,
        name: getDefaultName(type),
        x: Math.max(10, x),
        y: Math.max(10, y),
        color: getDefaultColor(type),
        width: 120,
        height: 40,
        isTool: false
    };

    if (type === 'class') {
        element.type = 'uml-class';
        element.width = 240;
        element.height = 60;
        element.fields = [];
        element.methods = [];
        element.bgColor = '#ffffff';
        element.borderColor = '#8B5CF6';
        element.textColor = '#1a1a2e';
        element.isUmlClass = true;
        element.name = 'Новый класс';
    }

    elements.push(element);
    renderElements();
    selectElement(id);
    document.getElementById('paletteEmpty').classList.add('hidden');
    
    // Автоматически открываем окно свойств
    setTimeout(function() {
        openElementPropsModal(id);
    }, 100);
    
    return element;
}


function getDefaultName(type) {
    var names = {
        asset: 'Компонент',
        threat: 'Угроза',
        control: 'Контроль',
        data: 'Данные',
        actor: 'Субъект',
        network: 'Сеть',
        'gate-and': 'AND',
        'gate-or': 'OR',
        'gate-if': 'IF',
        'gate-switch': 'SWITCH',
        'event-start': 'Старт',
        'event-end': 'Финиш',
        'event-pause': 'Пауза',
        'event-timeout': 'Таймаут',
        'event-error': 'Ошибка',
        'event-interrupt': 'Прерывание',
        'uml-class': 'Класс'
    };
    return names[type] || 'Элемент';
}

function getDefaultColor(type) {
    var colors = {
        asset: '#3B82F6',
        threat: '#EF4444',
        control: '#10B981',
        data: '#F59E0B',
        actor: '#6366F1',
        network: '#EC4899',
        'gate-and': '#065f46',
        'gate-or': '#92400e',
        'gate-if': '#5b21b6',
        'gate-switch': '#7c3aed',
        'event-start': '#10B981',
        'event-end': '#EF4444',
        'event-pause': '#3B82F6',
        'event-timeout': '#8B5CF6',
        'event-error': '#EF4444',
        'event-interrupt': '#EF4444'
    };
    return colors[type] || '#6B7280';
}

// ============================================================
// ЭКСПОРТ МОДЕЛИ
// ============================================================

window.exportModel = function() {
    var model = {
        version: '1.0',
        workflow: {
            name: 'Мой workflow',
            steps: elements.map(function(el) {
                var step = {
                    id: el.id,
                    name: el.name,
                    type: el.type
                };
                
                if (el.isTool && el.tool) {
                    step.tool = el.tool;
                    step.params = {};
                    var config = getToolConfig(el.tool);
                    if (config) {
                        config.fields.forEach(function(field) {
                            if (el[field.id]) {
                                step.params[field.id] = el[field.id];
                            }
                        });
                    }
                }
                
                // Добавляем параметры событий
                if (el.type && el.type.startsWith('event-')) {
                    var eventConfig = getEventConfig(el.type);
                    if (eventConfig) {
                        step.params = step.params || {};
                        eventConfig.fields.forEach(function(field) {
                            if (el[field.id]) {
                                step.params[field.id] = el[field.id];
                            }
                        });
                    }
                }
                
                return step;
            }),
            transitions: connections.map(function(conn) {
                var transition = {
                    id: conn.id,
                    from: conn.from,
                    to: conn.to,
                    type: conn.type
                };
                
                if (conn.type === 'data' && conn.dataStructure) {
                    transition.dataStructure = conn.dataStructure;
                }
                
                return transition;
            })
        }
    };
    
    return model;
};

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    var canvas = document.getElementById('paletteCanvas');
        emptyState = document.getElementById('paletteEmpty');

    if (emptyState) emptyState.classList.remove('hidden');

    // ============================================================
    // ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК (ИСТОЧНИКИ)
    // ============================================================

    var sourceBtns = document.querySelectorAll('.source-btn');
    var sourceContents = {
        empty: document.getElementById('empty-source'),
        json: document.getElementById('json-source'),
        template: document.getElementById('template-source')
    };

    sourceBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            sourceBtns.forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            
            var source = this.dataset.source;
            Object.keys(sourceContents).forEach(function(key) {
                if (sourceContents[key]) {
                    sourceContents[key].classList.toggle('active', key === source);
                }
            });
        });
    });

    // ============================================================
    // Drag & Drop
    // ============================================================

    document.querySelectorAll('.element-library-item').forEach(function(item) {
        item.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', this.dataset.type);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    document.querySelectorAll('.flow-tool-item').forEach(function(item) {
        item.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', 'tool:' + this.dataset.tool);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    if (canvas) {
        canvas.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvas.addEventListener('drop', function(e) {
            e.preventDefault();
            var data = e.dataTransfer.getData('text/plain');
            if (!data) return;

            var rect = canvas.getBoundingClientRect();
            var x = e.clientX - rect.left - 60;
            var y = e.clientY - rect.top - 20;

            if (data.startsWith('tool:')) {
                var toolName = data.replace('tool:', '');
                addToolElement(toolName, x, y);
            } else {
                addElement(data, x, y);
            }
            if (emptyState) emptyState.classList.add('hidden');
        });

        canvas.addEventListener('mousemove', function(e) {
            if (!isConnecting) return;

            var rect = canvas.getBoundingClientRect();
            var mouseX = e.clientX - rect.left;
            var mouseY = e.clientY - rect.top;
            updateDragLine(mouseX, mouseY);
        });
    }

    // Глобальные обработчики
    document.addEventListener('mouseup', function(e) {
        if (!isConnecting) return;
        
        var elementDiv = e.target.closest('.canvas-element');
        
        if (e.target.closest('.element-port')) {
            return;
        }
        
        if (!elementDiv) {
            cancelCurrentConnection();
            return;
        }
        
        var toId = parseInt(elementDiv.dataset.id);
        
        if (toId === connectFromId) {
            cancelCurrentConnection();
            return;
        }
        
        var fromEl = elements.find(function(el) { return el.id === connectFromId; });
        var toEl = elements.find(function(el) { return el.id === toId; });
        if (!fromEl || !toEl) {
            showCustomAlert('Ошибка', 'Элемент не найден', 'error');
            cancelCurrentConnection();
            return;
        }
        
        openConnectionTypeModal(connectFromId, toId);
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isConnecting) {
            cancelCurrentConnection();
            showCustomAlert('Отмена', 'Создание связи отменено', 'info');
        }
    });



});