
var templateSelect = null;
var emptyState = null;
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

const elementFieldsConfig = {
    asset: {
        label: 'Component',
        fields: [
            { id: 'propVersion', label: 'Version', type: 'text', placeholder: '1.24.0' },
            { id: 'propDescription', label: 'Description', type: 'textarea', placeholder: 'Component description...' }
        ]
    },
    threat: {
        label: 'Threat',
        fields: [
            { id: 'propSeverity', label: 'Severity', type: 'select', options: ['critical', 'high', 'medium', 'low'] },
            { id: 'propCve', label: 'CVE', type: 'text', placeholder: 'CVE-2024-XXXX' },
            { id: 'propDescription', label: 'Description', type: 'textarea', placeholder: 'Threat description...' },
            { id: 'propMitigation', label: 'Mitigation', type: 'textarea', placeholder: 'Protection methods...' }
        ]
    },
    data: {
        label: 'Data',
        fields: [
            { id: 'propSensitivity', label: 'Sensitivity', type: 'select', options: ['public', 'internal', 'confidential', 'top-secret'] },
            { id: 'propFormat', label: 'Format', type: 'text', placeholder: 'JSON, XML, CSV...' },
            { id: 'propStorage', label: 'Storage', type: 'text', placeholder: 'S3, PostgreSQL, Redis...' }
        ]
    },
    actor: {
        label: 'Actor',
        fields: [
            { id: 'propRole', label: 'Role', type: 'text', placeholder: 'admin, user, service...' },
            { id: 'propPermissions', label: 'Permissions', type: 'text', placeholder: 'read, write, admin...' },
            { id: 'propDescription', label: 'Description', type: 'textarea', placeholder: 'Actor description...' }
        ]
    },
    network: {
        label: 'Network',
        fields: [
            { id: 'propProtocol', label: 'Protocol', type: 'text', placeholder: 'TCP, UDP, HTTP...' },
            { id: 'propPorts', label: 'Ports', type: 'text', placeholder: '80, 443, 8080...' },
            { id: 'propDescription', label: 'Description', type: 'textarea', placeholder: 'Network interaction description...' }
        ]
    },
    'gate-and': {
        label: 'AND',
        fields: [
            { id: 'propDescription', label: 'Description', type: 'textarea', placeholder: 'Conditions...' }
        ]
    },
    'gate-or': {
        label: 'OR',
        fields: [
            { id: 'propDescription', label: 'Description', type: 'textarea', placeholder: 'Conditions...' }
        ]
    },
    'gate-if': {
        label: 'IF',
        fields: [
            { id: 'propCondition', label: 'Condition', type: 'text', placeholder: 'Condition for branching...' },
            { id: 'propDescription', label: 'Description', type: 'textarea', placeholder: 'Conditions description...' }
        ]
    },
    'gate-switch': {
        label: 'SWITCH',
        fields: [
            { id: 'propCases', label: 'Cases', type: 'text', placeholder: 'case1, case2, case3...' },
            { id: 'propDefault', label: 'Default', type: 'text', placeholder: 'default' },
            { id: 'propDescription', label: 'Description', type: 'textarea', placeholder: 'Switch description...' }
        ]
    },
    'event-start': {
        label: 'Start',
        fields: [
            { id: 'eventTrigger', label: 'Trigger', type: 'select', options: ['none', 'message', 'timer', 'signal', 'conditional'], default: 'none' },
            { id: 'eventTimer', label: 'Timer (ms)', type: 'text', placeholder: '5000', showFor: ['timer'] },
            { id: 'eventMessage', label: 'Message', type: 'text', placeholder: 'start.event', showFor: ['message'] }
        ]
    },
    'event-end': {
        label: 'End',
        fields: [
            { id: 'eventResult', label: 'Result', type: 'select', options: ['success', 'error', 'cancel'], default: 'success' },
            { id: 'eventMessage', label: 'Message', type: 'text', placeholder: 'Execution result' }
        ]
    },
    'event-pause': {
        label: 'Pause',
        fields: [
            { id: 'eventDuration', label: 'Duration (ms)', type: 'text', placeholder: '5000' },
            { id: 'eventCondition', label: 'Resume condition', type: 'text', placeholder: 'condition === true' }
        ]
    },
    'event-timeout': {
        label: 'Timeout',
        fields: [
            { id: 'eventTimeout', label: 'Timeout (ms)', type: 'text', placeholder: '30000', default: '30000' },
            { id: 'eventAction', label: 'Action', type: 'select', options: ['interrupt', 'continue', 'retry', 'fail'], default: 'interrupt' },
            { id: 'eventRetryCount', label: 'Retry count', type: 'text', placeholder: '3', showFor: ['retry'] }
        ]
    },
    'event-error': {
        label: 'Error',
        fields: [
            { id: 'eventErrorCode', label: 'Error code', type: 'text', placeholder: 'ERR-001' },
            { id: 'eventErrorMessage', label: 'Message', type: 'textarea', placeholder: 'Error description...' },
            { id: 'eventAction', label: 'Action', type: 'select', options: ['retry', 'fail', 'ignore'], default: 'fail' }
        ]
    },
    'event-interrupt': {
        label: 'Interrupt',
        fields: [
            { id: 'eventInterruptType', label: 'Type', type: 'select', options: ['cancel', 'terminate'], default: 'cancel' },
            { id: 'eventMessage', label: 'Message', type: 'text', placeholder: 'Execution interrupted' }
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
// ШАБЛОНЫ
// ============================================================

var templateData = {
    'web-app': {
        name: 'Web Application',
        elements: [
            { type: 'event-start', name: 'Request', x: 50, y: 100 },
            { type: 'event-end', name: 'Response', x: 50, y: 400 },
            { type: 'asset', name: 'Frontend', x: 250, y: 150 },
            { type: 'asset', name: 'Backend API', x: 250, y: 300 },
            { type: 'data', name: 'User Data', x: 450, y: 250 },
            { type: 'actor', name: 'User', x: 450, y: 100 },
            { type: 'threat', name: 'XSS Attack', x: 50, y: 250 }
        ],
        connections: [
            { from: 1, to: 3, type: 'control' },
            { from: 3, to: 4, type: 'control' },
            { from: 4, to: 5, type: 'data' },
            { from: 6, to: 1, type: 'control' },
            { from: 4, to: 2, type: 'control' }
        ]
    },
    'api': {
        name: 'API Service',
        elements: [
            { type: 'event-start', name: 'Request', x: 50, y: 150 },
            { type: 'event-end', name: 'Response', x: 50, y: 450 },
            { type: 'asset', name: 'API Gateway', x: 250, y: 150 },
            { type: 'asset', name: 'Auth Service', x: 250, y: 300 },
            { type: 'data', name: 'Database', x: 450, y: 300 },
            { type: 'actor', name: 'Client', x: 450, y: 150 }
        ],
        connections: [
            { from: 1, to: 3, type: 'control' },
            { from: 3, to: 4, type: 'control' },
            { from: 3, to: 5, type: 'data' },
            { from: 4, to: 5, type: 'data' },
            { from: 4, to: 2, type: 'control' },
            { from: 6, to: 1, type: 'control' }
        ]
    },
    'database': {
        name: 'Database',
        elements: [
            { type: 'event-start', name: 'Query', x: 50, y: 100 },
            { type: 'event-end', name: 'Result', x: 50, y: 400 },
            { type: 'asset', name: 'Database', x: 250, y: 250 },
            { type: 'data', name: 'Table Data', x: 450, y: 250 },
            { type: 'actor', name: 'Application', x: 450, y: 100 }
        ],
        connections: [
            { from: 1, to: 3, type: 'control' },
            { from: 3, to: 4, type: 'data' },
            { from: 3, to: 2, type: 'control' },
            { from: 5, to: 1, type: 'control' }
        ]
    },
    'microservices': {
        name: 'Microservices',
        elements: [
            { type: 'event-start', name: 'Request', x: 50, y: 150 },
            { type: 'event-end', name: 'Response', x: 50, y: 450 },
            { type: 'asset', name: 'API Gateway', x: 250, y: 150 },
            { type: 'asset', name: 'Order Service', x: 450, y: 100 },
            { type: 'asset', name: 'Inventory Service', x: 450, y: 250 },
            { type: 'asset', name: 'Payment Service', x: 450, y: 400 },
            { type: 'data', name: 'Order DB', x: 650, y: 100 },
            { type: 'data', name: 'Inventory DB', x: 650, y: 250 },
            { type: 'data', name: 'Payment DB', x: 650, y: 400 }
        ],
        connections: [
            { from: 1, to: 3, type: 'control' },
            { from: 3, to: 4, type: 'control' },
            { from: 3, to: 5, type: 'control' },
            { from: 3, to: 6, type: 'control' },
            { from: 4, to: 7, type: 'data' },
            { from: 5, to: 8, type: 'data' },
            { from: 6, to: 9, type: 'data' },
            { from: 4, to: 2, type: 'control' }
        ]
    },
    'cloud': {
        name: 'Cloud Infrastructure',
        elements: [
            { type: 'event-start', name: 'Deploy', x: 50, y: 100 },
            { type: 'asset', name: 'K8s Cluster', x: 250, y: 150 },
            { type: 'asset', name: 'Service Mesh', x: 250, y: 300 },
            { type: 'data', name: 'Config Map', x: 450, y: 100 },
            { type: 'data', name: 'Secrets', x: 450, y: 250 },
            { type: 'network', name: 'Ingress', x: 450, y: 400 },
            { type: 'actor', name: 'DevOps', x: 650, y: 250 }
        ],
        connections: [
            { from: 1, to: 2, type: 'control' },
            { from: 2, to: 3, type: 'control' },
            { from: 2, to: 4, type: 'data' },
            { from: 2, to: 5, type: 'data' },
            { from: 2, to: 6, type: 'data' },
            { from: 7, to: 1, type: 'control' }
        ]
    },
    'devops': {
        name: 'CI/CD Pipeline',
        elements: [
            { type: 'event-start', name: 'Commit', x: 50, y: 100 },
            { type: 'event-end', name: 'Deploy', x: 50, y: 450 },
            { type: 'asset', name: 'Build', x: 250, y: 100 },
            { type: 'asset', name: 'Test', x: 250, y: 200 },
            { type: 'asset', name: 'Security Scan', x: 250, y: 300 },
            { type: 'asset', name: 'Release', x: 250, y: 400 },
            { type: 'threat', name: 'Vulnerability', x: 450, y: 200 },
            { type: 'data', name: 'Artifacts', x: 450, y: 350 }
        ],
        connections: [
            { from: 1, to: 3, type: 'control' },
            { from: 3, to: 4, type: 'control' },
            { from: 4, to: 5, type: 'control' },
            { from: 5, to: 6, type: 'control' },
            { from: 6, to: 2, type: 'control' },
            { from: 5, to: 7, type: 'data' },
            { from: 6, to: 8, type: 'data' }
        ]
    }
};

// ============================================================
// ЗАГРУЗКА ШАБЛОНА
// ============================================================

function loadTemplateData(templateName) {
    var template = templateData[templateName];
    if (!template) {
        showCustomAlert('Error', 'Template not found: ' + templateName, 'error');
        return;
    }
    
    // Удаляем все существующие элементы
    elements = [];
    connections = [];
    selectedElement = null;
    
    var canvas = document.getElementById('paletteCanvas');
    var rect = canvas.getBoundingClientRect();
    var canvasWidth = canvas.clientWidth || 800;
    var canvasHeight = canvas.clientHeight || 500;
    
    var offsetX = 50;
    var offsetY = 50;
    
    var newElements = [];
    template.elements.forEach(function(elData) {
        var newEl = {
            id: ++elementIdCounter,
            type: elData.type,
            name: elData.name || getDefaultName(elData.type),
            x: elData.x + offsetX,
            y: elData.y + offsetY,
            color: getDefaultColor(elData.type),
            width: 120,
            height: 40,
            isTool: false,
            hasChildren: false,
            isExpanded: false,
            childNodes: [],
            hidden: false,
            isVisible: true
        };
        
        if (elData.type === 'uml-class') {
            newEl.fields = [];
            newEl.methods = [];
            newEl.bgColor = '#ffffff';
            newEl.borderColor = '#8B5CF6';
            newEl.textColor = '#1a1a2e';
            newEl.isUmlClass = true;
            newEl.width = 200;
            newEl.height = 60;
        }
        
        elements.push(newEl);
        newElements.push(newEl);
    });
    
    template.connections.forEach(function(connData) {
        var fromId = newElements[connData.from - 1]?.id;
        var toId = newElements[connData.to - 1]?.id;
        if (fromId && toId) {
            connections.push({
                id: connections.length + 1,
                from: fromId,
                to: toId,
                type: connData.type,
                label: connData.label || (connData.type === 'control' ? 'control' : 'data flow'),
                color: connData.type === 'control' ? '#8B5CF6' : '#10B981',
                dataStructure: null
            });
        }
    });
    
    renderElements();
    document.getElementById('paletteEmpty').classList.add('hidden');
    
    showCustomAlert('Success', 'Template "' + template.name + '" loaded successfully!', 'success');
}

// ============================================================
// ФУНКЦИИ ДЛЯ МОДАЛКИ СВОЙСТВ ЭЛЕМЕНТА
// ============================================================

window.openElementPropsModal = function(id) {
    var el = elements.find(function(e) { return e.id === id; });
    if (!el) {
        showCustomAlert('Error', 'Element not found', 'error');
        return;
    }

    selectedElement = el;
    var modal = document.getElementById('elementPropsModal');
    if (!modal) {
        showCustomAlert('Error', 'Element properties modal not found', 'error');
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
    var isEvent = el.type && el.type.startsWith('event-');

    if (el.type === 'uml-class') {
        var modalTitle = document.querySelector('#elementPropsModal .modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'Class properties: ' + el.name;
        }
        dynamicContainer.dataset.elementId = el.id;
    }
    
    if (isEvent) {
        var eventConfig = getEventConfig(el.type);
        if (eventConfig) {
            var modalTitle = document.querySelector('#elementPropsModal .modal-title');
            if (modalTitle) {
                modalTitle.textContent = 'Properties: ' + eventConfig.label;
            }
            
            var header = document.createElement('div');
            header.style.cssText = 'margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;';
            header.innerHTML = `
                <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1a1a2e; font-family: Fira Sans, sans-serif;">
                    <i class="fas fa-clock"></i> Event Properties
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
                label.style.cssText = 'display: block; font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px; font-family: Fira Sans, sans-serif;';
                label.textContent = field.label + (field.required ? ' *' : '');
                fieldDiv.appendChild(label);
                
                if (field.type === 'select') {
                    var select = document.createElement('select');
                    select.id = field.id;
                    select.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Fira Sans, sans-serif; background: white;';
                    
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
                    textarea.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Fira Sans, sans-serif; resize: vertical;';
                    if (el[field.id]) {
                        textarea.value = el[field.id];
                    }
                    fieldDiv.appendChild(textarea);
                } else {
                    var input = document.createElement('input');
                    input.type = 'text';
                    input.id = field.id;
                    input.placeholder = field.placeholder || '';
                    input.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Fira Sans, sans-serif;';
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
                    desc.style.cssText = 'font-size: 11px; color: #9ca3af; margin-top: 2px; font-family: Fira Sans, sans-serif;';
                    desc.textContent = field.description;
                    fieldDiv.appendChild(desc);
                }
                
                fieldsWrapper.appendChild(fieldDiv);
            });
            
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
            modalTitle.textContent = 'Properties: ' + config.label;
        }
        
        if (config.fields && config.fields.length > 0) {
            var header = document.createElement('div');
            header.style.cssText = 'margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;';
            header.innerHTML = '<h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1a1a2e; font-family: Fira Sans, sans-serif;">Additional parameters</h4>';
            dynamicContainer.appendChild(header);
        }
        
        config.fields.forEach(function(field) {
            var fieldDiv = document.createElement('div');
            fieldDiv.style.cssText = 'margin-bottom: 14px;';
            
            var label = document.createElement('label');
            label.style.cssText = 'display: block; font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px; font-family: Fira Sans, sans-serif;';
            label.textContent = field.label;
            fieldDiv.appendChild(label);
            
            if (field.type === 'select') {
                var select = document.createElement('select');
                select.id = field.id;
                select.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Fira Sans, sans-serif; background: white;';
                
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
                textarea.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Fira Sans, sans-serif; resize: vertical;';
                if (el[field.id]) {
                    textarea.value = el[field.id];
                }
                fieldDiv.appendChild(textarea);
            } else {
                var input = document.createElement('input');
                input.type = field.type || 'text';
                input.id = field.id;
                input.placeholder = field.placeholder || '';
                input.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: Fira Sans, sans-serif;';
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
        showCustomAlert('Error', 'No element selected', 'error');
        return;
    }

    var name = document.getElementById('propName').value.trim() || selectedElement.name;
    var type = document.getElementById('propType').value;
    var color = document.getElementById('propColor').value;
    
    selectedElement.name = name;
    selectedElement.type = type;
    selectedElement.color = color;
    
    var isEvent = type && type.startsWith('event-');
    
    if (isEvent) {
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
        var fieldInputs = document.querySelectorAll('.uml-field-input');
        var newFields = [];
        fieldInputs.forEach(function(input) {
            var val = input.value.trim();
            if (val) newFields.push(val);
        });
        selectedElement.fields = newFields;
        
        var methodInputs = document.querySelectorAll('.uml-method-input');
        var newMethods = [];
        methodInputs.forEach(function(input) {
            var val = input.value.trim();
            if (val) {
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
        
        recalculateUmlClassHeight(selectedElement);
    }

    renderElements();
    closeElementPropsModal();
    showCustomAlert('Success', 'Properties saved', 'success');
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
        showCustomAlert('Error', 'Connection type modal not found', 'error');
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
        showCustomAlert('Error', 'Data structure modal not found', 'error');
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
        showCustomAlert('Error', 'No elements selected for connection', 'error');
        return;
    }

    var fromEl = elements.find(function(e) { return e.id === connectionFromId; });
    var toEl = elements.find(function(e) { return e.id === connectionToId; });
    if (!fromEl || !toEl) {
        showCustomAlert('Error', 'One of the elements not found', 'error');
        cancelConnectionType();
        return;
    }

    var existingConnection = connections.find(function(c) {
        return c.from === connectionFromId && c.to === connectionToId;
    });
    if (existingConnection) {
        showCustomAlert('Warning', 'Connection already exists between these elements', 'warning');
        cancelConnectionType();
        return;
    }

    var connectionData = {
        from: connectionFromId,
        to: connectionToId,
        type: type,
        label: type === 'control' ? 'control' : 'data flow',
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
        showCustomAlert('Connection created', 'Control connection created', 'success');
    } else {
        cancelConnectionType();
        openDataStructureModalWithData(connectionData);
    }
};

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

window.openConnectionPropsModal = function(connectionId) {
    var conn = connections.find(function(c) { return c.id === connectionId; });
    if (!conn) {
        showCustomAlert('Error', 'Connection not found', 'error');
        return;
    }
    
    if (conn.type === 'dataflow' || conn.type === 'data' ) {
        openDataStructureModal(connectionId);
    } else {
        showCustomAlert('Info', 'No data structure required for "Control" connections', 'info');
    }
};

function openDataStructureModal(connectionId) {
    currentDataConnectionId = connectionId;
    var modal = document.getElementById('dataStructureModal');
    
    if (!modal) {
        showCustomAlert('Error', 'Data structure modal not found', 'error');
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
}

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
        <input type="text" placeholder="Field name" value="${name || ''}" style="flex: 1; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px; font-family: Fira Sans, sans-serif;">
        <select style="padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px; font-family: Fira Sans, sans-serif; background: white; min-width: 80px;">
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
        showCustomAlert('Warning', 'At least one field is required', 'warning');
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
        showCustomAlert('Error', 'Add at least one field', 'warning');
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
        showCustomAlert('Success', 'Data structure saved and connection created', 'success');
    } else {
        var conn = connections.find(function(c) { return c.id === currentDataConnectionId; });
        if (conn) {
            conn.dataStructure = { fields: fields };
            showCustomAlert('Success', 'Data structure saved', 'success');
            renderConnections();
        }
        closeDataStructureModal();
    }
};

// ============================================================
// ФУНКЦИИ РАСКРЫТИЯ/СВОРАЧИВАНИЯ
// ============================================================

function toggleNodeExpand(elementId) {
    var el = elements.find(function(e) { return e.id === elementId; });
    if (!el) return;
    
    var hasChildren = el.childNodes && el.childNodes.length > 0;
    
    if (!hasChildren) {
        showCustomAlert('Info', 'This node has no child elements', 'info');
        return;
    }
    
    el.isExpanded = !el.isExpanded;
    
    if (el.isExpanded) {
        expandNodeFromPalette(elementId);
    } else {
        collapseNodeFromPalette(elementId);
    }
    
    renderElements();
    renderConnections();
}

function expandNodeFromPalette(nodeId) {
    var el = elements.find(function(e) { return e.id === nodeId; });
    if (!el) return;
    
    el.isExpanded = true;
    
    if (el.childNodes) {
        el.childNodes.forEach(function(childId) {
            var childEl = elements.find(function(e) { return e.id === childId; });
            if (childEl) {
                childEl.hidden = false;
                childEl.isVisible = true;
                if (childEl.isExpanded) {
                    expandNodeFromPalette(childId);
                }
            }
        });
    }
}

function collapseNodeFromPalette(nodeId) {
    var el = elements.find(function(e) { return e.id === nodeId; });
    if (!el) return;
    
    el.isExpanded = false;
    
    function hideDescendants(parentId) {
        var children = elements.filter(function(e) { 
            return e.parentId === parentId; 
        });
        children.forEach(function(child) {
            child.hidden = true;
            child.isVisible = false;
            child.isExpanded = false;
            hideDescendants(child.id);
        });
    }
    
    if (el.childNodes) {
        el.childNodes.forEach(function(childId) {
            var childEl = elements.find(function(e) { return e.id === childId; });
            if (childEl) {
                childEl.hidden = true;
                childEl.isVisible = false;
                childEl.isExpanded = false;
                hideDescendants(childId);
            }
        });
    }
}

function expandAllNodesPalette() {
    var rootNodes = elements.filter(function(e) { 
        return e.isRoot === true || e.parentId === null; 
    });
    rootNodes.forEach(function(root) {
        if (root.childNodes && root.childNodes.length > 0) {
            root.isExpanded = true;
            expandNodeFromPalette(root.id);
        }
    });
    renderElements();
    renderConnections();
    showCustomAlert('Success', 'All nodes expanded', 'success');
}

function collapseAllNodesPalette() {
    var rootNodes = elements.filter(function(e) { 
        return e.isRoot === true || e.parentId === null; 
    });
    rootNodes.forEach(function(root) {
        if (root.childNodes && root.childNodes.length > 0) {
            root.isExpanded = false;
            collapseNodeFromPalette(root.id);
            root.hidden = false;
            root.isVisible = true;
        }
    });
    renderElements();
    renderConnections();
    showCustomAlert('Success', 'All nodes collapsed', 'success');
}

// ============================================================
// ФУНКЦИИ РЕНДЕРИНГА
// ============================================================

window.renderConnections = function() {
    var connectionsContainer = document.getElementById('canvasConnections');
    if (!connectionsContainer) return;
    connectionsContainer.innerHTML = '';
    if (connections.length === 0) return;

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;';

    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
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
    
    var markerContains = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    markerContains.setAttribute('id', 'arrowhead-contains');
    markerContains.setAttribute('markerWidth', '8');
    markerContains.setAttribute('markerHeight', '8');
    markerContains.setAttribute('refX', '4');
    markerContains.setAttribute('refY', '4');
    markerContains.setAttribute('orient', 'auto');
    var circleContains = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circleContains.setAttribute('cx', '4');
    circleContains.setAttribute('cy', '4');
    circleContains.setAttribute('r', '3');
    circleContains.setAttribute('fill', '#6B7280');
    markerContains.appendChild(circleContains);
    defs.appendChild(markerContains);
    
    svg.appendChild(defs);

    connections.forEach(function(conn) {
        var fromEl = elements.find(function(e) { return e.id === conn.from; });
        var toEl = elements.find(function(e) { return e.id === conn.to; });
        if (!fromEl || !toEl) return;
        if (fromEl.hidden === true || toEl.hidden === true) return;
        if (fromEl.isVisible === false || toEl.isVisible === false) return;

        if (conn.type === 'contains') {
            var fromX = fromEl.x + fromEl.width / 2;
            var fromY = fromEl.y + fromEl.height;
            var toX = toEl.x + toEl.width / 2;
            var toY = toEl.y;
            var color = conn.color || '#6B7280';
            
            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            var pathData = 'M ' + fromX + ' ' + fromY + 
                           ' L ' + fromX + ' ' + (fromY + 10) +
                           ' L ' + toX + ' ' + (toY - 10) +
                           ' L ' + toX + ' ' + toY;
            path.setAttribute('d', pathData);
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '1.5');
            path.setAttribute('stroke-dasharray', '5,5');
            path.setAttribute('fill', 'none');
            svg.appendChild(path);
            
            var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', toX);
            circle.setAttribute('cy', toY);
            circle.setAttribute('r', '4');
            circle.setAttribute('fill', color);
            svg.appendChild(circle);
            return;
        }

        if (conn.type === 'data-flow') {
            var fromX = conn.fromX || (fromEl.x + fromEl.width);
            var fromY = conn.fromY || (fromEl.y + fromEl.height / 2);
            var toX = conn.toX || toEl.x;
            var toY = conn.toY || (toEl.y + toEl.height / 2);
            var color = conn.color || '#10B981';
            
            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            var pathData = 'M ' + fromX + ' ' + fromY + 
                           ' L ' + (toX - 10) + ' ' + toY;
            path.setAttribute('d', pathData);
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            path.setAttribute('marker-end', 'url(#arrowhead-dataflow)');
            svg.appendChild(path);
            
            if (conn.label) {
                var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                var midX = (fromX + toX) / 2;
                var midY = (fromY + toY) / 2 - 10;
                label.setAttribute('x', midX);
                label.setAttribute('y', midY);
                label.setAttribute('fill', '#475569');
                label.setAttribute('font-size', '10');
                label.setAttribute('font-family', 'Fira Sans, sans-serif');
                label.setAttribute('text-anchor', 'middle');
                label.textContent = conn.label;
                svg.appendChild(label);
            }
            return;
        }

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
    });

    connectionsContainer.appendChild(svg);
};

window.renderElements = function() {
    var elementsContainer = document.getElementById('canvasElements');
    elementsContainer.innerHTML = '';
    
    var visibleElements = elements.filter(function(el) {
        if (el.hidden === true) return false;
        if (el.isVisible === false) return false;
        return true;
    });
    
    visibleElements.forEach(function(el) {
        var div = document.createElement('div');

        if (el.type === 'package-dependency' || el.type === 'sbom-component' || el.type === 'sbom-root') {
            if (el.hasChildren && el.childNodes && el.childNodes.length > 0) {
                var toggleBtn = document.createElement('button');
                toggleBtn.className = 'toggle-btn';
                toggleBtn.style.cssText = `
                    position: absolute;
                    right: -10px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 1px solid ${el.color};
                    background: white;
                    color: ${el.color};
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                    font-family: 'Fira Sans', sans-serif;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                `;
                toggleBtn.textContent = el.isExpanded ? '−' : '+';
                toggleBtn.title = el.isExpanded ? 'Collapse' : 'Expand';
                toggleBtn.onclick = function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleNodeExpand(el.id);
                };
                div.appendChild(toggleBtn);
            }
        }

        if (el.type === 'uml-class') {
            var divUml = document.createElement('div');
            divUml.style.cssText = `
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
                font-family: 'Fira Sans', sans-serif;
                display: flex;
                flex-direction: column;
                user-select: none;
            `;
            
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
                <span><i class="fas fa-cube"></i> ${el.name}</span>
                <span style="display: flex; gap: 4px;">
                    <button class="props-btn" onclick="event.stopPropagation(); openUmlClassModal(${el.id})" title="Properties" style="background: none; border: none; color: ${el.borderColor || '#8B5CF6'}; cursor: pointer; font-size: 12px; padding: 2px 6px; border-radius: 4px;">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="delete-btn" onclick="event.stopPropagation(); deleteElement(${el.id}, event)" title="Delete" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 12px; padding: 2px 6px; border-radius: 4px;">
                        <i class="fas fa-times"></i>
                    </button>
                </span>
            `;
            divUml.appendChild(header);
            
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
            
            if (el.fields && el.fields.length > 0) {
                el.fields.forEach(function(field) {
                    var fieldDiv = document.createElement('div');
                    fieldDiv.style.cssText = `color: #6b7280; padding: 1px 0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
                    fieldDiv.textContent = '▸ ' + field;
                    bodyContainer.appendChild(fieldDiv);
                });
            }
            
            if (el.fields && el.fields.length > 0 && el.methods && el.methods.length > 0) {
                var separator = document.createElement('div');
                separator.style.cssText = `border-top: 1px solid ${el.borderColor || '#8B5CF6'}40; margin: 2px 0;`;
                bodyContainer.appendChild(separator);
            }
            
            if (el.methods && el.methods.length > 0) {
                el.methods.forEach(function(method) {
                    var params = method.params && method.params.length > 0 ? '(' + method.params.join(', ') + ')' : '()';
                    var methodName = method.name + params;
                    var methodColor = method.type === 'function' ? '#3B82F6' : '#10B981';
                    
                    var methodDiv = document.createElement('div');
                    methodDiv.style.cssText = `color: ${methodColor}; padding: 1px 0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
                    methodDiv.textContent = '▸ ' + methodName;
                    bodyContainer.appendChild(methodDiv);
                });
            }
            
            divUml.appendChild(bodyContainer);
            
            divUml.addEventListener('mousedown', function(e) {
                if (e.target.closest('.props-btn')) return;
                if (e.target.closest('.delete-btn')) return;
                selectElement(el.id);
                startDrag(e, el.id);
            });
            
            divUml.addEventListener('dblclick', function(e) {
                e.stopPropagation();
                openUmlClassModal(el.id);
            });
            
            elementsContainer.appendChild(divUml);
            return;
        }

        if (el.type === 'uml-field') {
            return;
        }
        
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

        var icon = getElementIcon(el.type);

        var versionBadge = '';
        if (el.version) {
            versionBadge = `<span style="font-size: 8px; background: ${el.color}30; padding: 1px 6px; border-radius: 4px; margin-left: 4px; color: ${el.color};">v${el.version}</span>`;
        }

        var rightPort = document.createElement('div');
        rightPort.className = 'element-port right';
        rightPort.title = 'Drag to create connection';
        rightPort.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            e.preventDefault();
            if (!isConnecting) {
                startConnection(e, el.id, 'right');
            }
        });

        var leftPort = document.createElement('div');
        leftPort.className = 'element-port left';
        leftPort.style.cssText = 'background: #d1d5db; cursor: default;';
        leftPort.title = 'Incoming port';

        var actions = document.createElement('span');
        actions.className = 'element-actions';
        actions.innerHTML = `
            <button class="props-btn" onclick="openElementPropsModal(${el.id})" title="Properties">
                <i class="fas fa-cog"></i>
            </button>
            <button class="delete-btn" onclick="deleteElement(${el.id}, event)" title="Delete">
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
        isTool: false,
        hasChildren: false,
        isExpanded: false,
        childNodes: [],
        hidden: false,
        isVisible: true
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
        element.name = 'New Class';
    }

    elements.push(element);
    renderElements();
    selectElement(id);
    document.getElementById('paletteEmpty').classList.add('hidden');
    
    setTimeout(function() {
        openElementPropsModal(id);
    }, 100);
    
    return element;
}

function getDefaultName(type) {
    var names = {
        asset: 'Component',
        threat: 'Threat',
        control: 'Control',
        data: 'Data',
        actor: 'Actor',
        network: 'Network',
        'gate-and': 'AND',
        'gate-or': 'OR',
        'gate-if': 'IF',
        'gate-switch': 'SWITCH',
        'event-start': 'Start',
        'event-end': 'End',
        'event-pause': 'Pause',
        'event-timeout': 'Timeout',
        'event-error': 'Error',
        'event-interrupt': 'Interrupt',
        'uml-class': 'Class'
    };
    return names[type] || 'Element';
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
            name: 'My Workflow',
            steps: elements.map(function(el) {
                var step = {
                    id: el.id,
                    name: el.name,
                    type: el.type
                };
                
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

    var sourceBtns = document.querySelectorAll('.source-btn');
    var sourceContents = {
        empty: document.getElementById('empty-source'),
        template: document.getElementById('template-source'),
        code: document.getElementById('code-source'),
        sbom: document.getElementById('sbom-source')
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

    var sbomBtn = document.querySelector('.source-btn[data-source="sbom"]');
    if (sbomBtn) {
        sbomBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            var allBtns = document.querySelectorAll('.source-btn');
            allBtns.forEach(function(b) { b.classList.remove('active'); });
            sbomBtn.classList.add('active');
            
            var allContents = document.querySelectorAll('.source-content-palette');
            allContents.forEach(function(c) { c.classList.remove('active'); });
            
            var sbomContent = document.getElementById('sbom-source');
            if (sbomContent) {
                sbomContent.classList.add('active');
            }
        });
    }

    document.querySelectorAll('.element-library-item').forEach(function(item) {
        item.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', this.dataset.type);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    document.querySelectorAll('.flow-tool-item').forEach(function(item) {
        item.addEventListener('dragstart', function(e) {
            var template = this.dataset.template;
            if (template) {
                e.dataTransfer.setData('text/plain', 'template:' + template);
                e.dataTransfer.effectAllowed = 'copy';
            }
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

            if (data.startsWith('template:')) {
                var templateName = data.replace('template:', '');
                loadTemplateData(templateName);
                if (emptyState) emptyState.classList.add('hidden');
                return;
            }

            addElement(data, x, y);
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
            showCustomAlert('Error', 'Element not found', 'error');
            cancelCurrentConnection();
            return;
        }
        
        openConnectionTypeModal(connectFromId, toId);
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isConnecting) {
            cancelCurrentConnection();
            showCustomAlert('Cancel', 'Connection creation cancelled', 'info');
        }
    });
});

// ============================================================
// ЭКСПОРТ В ГЛОБАЛ
// ============================================================

window.toggleNodeExpand = toggleNodeExpand;
window.expandNodeFromPalette = expandNodeFromPalette;
window.collapseNodeFromPalette = collapseNodeFromPalette;
window.expandAllNodesPalette = expandAllNodesPalette;
window.collapseAllNodesPalette = collapseAllNodesPalette;
window.loadTemplateData = loadTemplateData;
window.addElement = addElement;
window.renderElements = renderElements;
window.renderConnections = renderConnections;
window.getDefaultName = getDefaultName;
window.getDefaultColor = getDefaultColor;