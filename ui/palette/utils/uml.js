// ============================================================
// МОДАЛКА РЕДАКТИРОВАНИЯ UML КЛАССА
// ============================================================

var currentUmlClassId = null;

function openUmlClassModal(elementId) {
    var el = elements.find(function(e) { return e.id === elementId; });
    if (!el || el.type !== 'uml-class') return;
    
    currentUmlClassId = elementId;
    
    var modal = document.getElementById('umlClassModal');
    if (!modal) return;
    
    // Заполняем данные
    document.getElementById('umlModalTitle').textContent = 'Редактирование класса: ' + el.name;
    document.getElementById('umlClassName').value = el.name || '';
    
    // Рендерим поля и методы
    renderUmlFields(el);
    renderUmlMethods(el);
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function closeUmlClassModal() {
    var modal = document.getElementById('umlClassModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    currentUmlClassId = null;
}

// ============================================================
// РЕНДЕРИНГ ПОЛЕЙ В МОДАЛКЕ
// ============================================================

function renderUmlFields(el) {
    var container = document.getElementById('umlFieldsList');
    if (!container) return;
    
    var fields = el.fields || [];
    if (fields.length === 0) {
        container.innerHTML = `<div style="color: #9ca3af; text-align: center; padding: 20px; font-size: 13px; font-family: 'Ubuntu', sans-serif;">Нет полей. Нажмите "Добавить поле"</div>`;
        return;
    }
    
    container.innerHTML = fields.map(function(field, index) {
        // Парсим поле: может быть "name: type" или просто "name"
        var parts = field.split(':');
        var fieldName = parts[0].trim();
        var fieldType = parts.length > 1 ? parts.slice(1).join(':').trim() : '';
        
        // Определяем модификатор доступа (public, private, protected)
        var visibility = 'public';
        var displayName = fieldName;
        if (fieldName.startsWith('+')) { visibility = 'public'; displayName = fieldName.substring(1).trim(); }
        else if (fieldName.startsWith('-')) { visibility = 'private'; displayName = fieldName.substring(1).trim(); }
        else if (fieldName.startsWith('#')) { visibility = 'protected'; displayName = fieldName.substring(1).trim(); }
        
        return `
            <div style="display: flex; gap: 6px; margin-bottom: 4px; align-items: center; background: #f9fafb; padding: 4px 8px; border-radius: 4px;">
                <select class="uml-field-visibility" data-index="${index}" style="
                    padding: 2px 4px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 11px;
                    font-family: 'Ubuntu', sans-serif;
                    background: white;
                ">
                    <option value="public" ${visibility === 'public' ? 'selected' : ''}>+ public</option>
                    <option value="private" ${visibility === 'private' ? 'selected' : ''}>- private</option>
                    <option value="protected" ${visibility === 'protected' ? 'selected' : ''}># protected</option>
                </select>
                <input type="text" class="uml-field-name" data-index="${index}" value="${displayName}" placeholder="имя" style="
                    flex: 1;
                    padding: 2px 6px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: 'Ubuntu', sans-serif;
                ">
                <input type="text" class="uml-field-type" data-index="${index}" value="${fieldType}" placeholder="тип" style="
                    width: 80px;
                    padding: 2px 6px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: 'Ubuntu', sans-serif;
                ">
                <button onclick="removeUmlFieldModal(${index})" style="
                    background: none;
                    border: none;
                    color: #ef4444;
                    cursor: pointer;
                    font-size: 14px;
                    padding: 0 4px;
                ">×</button>
            </div>
        `;
    }).join('');
}

// ============================================================
// РЕНДЕРИНГ МЕТОДОВ В МОДАЛКЕ
// ============================================================

function renderUmlMethods(el) {
    var container = document.getElementById('umlMethodsList');
    if (!container) return;
    
    var methods = el.methods || [];
    if (methods.length === 0) {
        container.innerHTML = `<div style="color: #9ca3af; text-align: center; padding: 20px; font-size: 13px; font-family: 'Ubuntu', sans-serif;">Нет методов. Нажмите "Добавить метод"</div>`;
        return;
    }
    
    container.innerHTML = methods.map(function(method, index) {
        var params = method.params && method.params.length > 0 ? method.params.join(', ') : '';
        var methodName = method.name || 'новыйМетод';
        
        // Определяем модификатор доступа
        var visibility = 'public';
        var displayName = methodName;
        if (methodName.startsWith('+')) { visibility = 'public'; displayName = methodName.substring(1).trim(); }
        else if (methodName.startsWith('-')) { visibility = 'private'; displayName = methodName.substring(1).trim(); }
        else if (methodName.startsWith('#')) { visibility = 'protected'; displayName = methodName.substring(1).trim(); }
        
        return `
            <div style="display: flex; gap: 6px; margin-bottom: 4px; align-items: center; background: #f9fafb; padding: 4px 8px; border-radius: 4px;">
                <select class="uml-method-visibility" data-index="${index}" style="
                    padding: 2px 4px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 11px;
                    font-family: 'Ubuntu', sans-serif;
                    background: white;
                ">
                    <option value="public" ${visibility === 'public' ? 'selected' : ''}>+ public</option>
                    <option value="private" ${visibility === 'private' ? 'selected' : ''}>- private</option>
                    <option value="protected" ${visibility === 'protected' ? 'selected' : ''}># protected</option>
                </select>
                <input type="text" class="uml-method-name" data-index="${index}" value="${displayName}" placeholder="имя" style="
                    flex: 1;
                    padding: 2px 6px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: 'Ubuntu', sans-serif;
                ">
                <input type="text" class="uml-method-params" data-index="${index}" value="${params}" placeholder="параметры" style="
                    width: 100px;
                    padding: 2px 6px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: 'Ubuntu', sans-serif;
                ">
                <button onclick="removeUmlMethodModal(${index})" style="
                    background: none;
                    border: none;
                    color: #ef4444;
                    cursor: pointer;
                    font-size: 14px;
                    padding: 0 4px;
                ">×</button>
            </div>
        `;
    }).join('');
}

// ============================================================
// ДОБАВЛЕНИЕ/УДАЛЕНИЕ ПОЛЕЙ И МЕТОДОВ
// ============================================================

function addUmlFieldModal() {
    var el = elements.find(function(e) { return e.id === currentUmlClassId; });
    if (!el) return;
    if (!el.fields) el.fields = [];
    el.fields.push('новое_поле');
    renderUmlFields(el);
}

function removeUmlFieldModal(index) {
    var el = elements.find(function(e) { return e.id === currentUmlClassId; });
    if (!el) return;
    if (!el.fields) el.fields = [];
    el.fields.splice(index, 1);
    renderUmlFields(el);
}

function addUmlMethodModal() {
    var el = elements.find(function(e) { return e.id === currentUmlClassId; });
    if (!el) return;
    if (!el.methods) el.methods = [];
    el.methods.push({ name: 'новыйМетод', params: [], type: 'method' });
    renderUmlMethods(el);
}

function removeUmlMethodModal(index) {
    var el = elements.find(function(e) { return e.id === currentUmlClassId; });
    if (!el) return;
    if (!el.methods) el.methods = [];
    el.methods.splice(index, 1);
    renderUmlMethods(el);
}


function recalculateUmlClassHeight(el) {
    if (el.type !== 'uml-class') return;
    
    var headerHeight = 36;
    var fieldsCount = (el.fields || []).length;
    var methodsCount = (el.methods || []).length;
    var fieldsHeight = fieldsCount * 18;
    var methodsHeight = methodsCount * 18;
    var padding = 8;
    var separator = (fieldsCount > 0 && methodsCount > 0) ? 4 : 0;
    
    var totalHeight = headerHeight + padding + fieldsHeight + separator + methodsHeight + 8;
    if (totalHeight < 60) totalHeight = 60;
    if (totalHeight > 450) totalHeight = 450;
    
    el.height = totalHeight;
    
    // Обновляем отображение
    renderElements();
}

// ============================================================
// СОХРАНЕНИЕ UML КЛАССА
// ============================================================

function saveUmlClass() {
    var el = elements.find(function(e) { return e.id === currentUmlClassId; });
    if (!el) return;
    
    // Сохраняем имя
    var className = document.getElementById('umlClassName').value.trim();
    if (className) el.name = className;
    
    // Сохраняем поля
    var fieldNames = document.querySelectorAll('.uml-field-name');
    var fieldTypes = document.querySelectorAll('.uml-field-type');
    var fieldVisibilities = document.querySelectorAll('.uml-field-visibility');
    var newFields = [];
    
    for (var i = 0; i < fieldNames.length; i++) {
        var name = fieldNames[i].value.trim();
        var type = fieldTypes[i] ? fieldTypes[i].value.trim() : '';
        var visibility = fieldVisibilities[i] ? fieldVisibilities[i].value : 'public';
        
        if (name) {
            var prefix = visibility === 'public' ? '+' : visibility === 'private' ? '-' : '#';
            var fieldStr = prefix + name + (type ? ': ' + type : '');
            newFields.push(fieldStr);
        }
    }
    el.fields = newFields;
    
    // Сохраняем методы
    var methodNames = document.querySelectorAll('.uml-method-name');
    var methodParams = document.querySelectorAll('.uml-method-params');
    var methodVisibilities = document.querySelectorAll('.uml-method-visibility');
    var newMethods = [];
    
    for (var j = 0; j < methodNames.length; j++) {
        var name = methodNames[j].value.trim();
        var params = methodParams[j] ? methodParams[j].value.trim() : '';
        var visibility = methodVisibilities[j] ? methodVisibilities[j].value : 'public';
        
        if (name) {
            var prefix = visibility === 'public' ? '+' : visibility === 'private' ? '-' : '#';
            var methodName = prefix + name;
            var paramList = params ? params.split(',').map(function(p) { return p.trim(); }).filter(function(p) { return p; }) : [];
            newMethods.push({ name: methodName, params: paramList, type: 'method' });
        }
    }
    el.methods = newMethods;
    
    // Пересчитываем высоту
    recalculateUmlClassHeight(el);
    
    // Обновляем отображение
    renderElements();
    closeUmlClassModal();
    showCustomAlert('Успешно', 'Класс "' + el.name + '" сохранен', 'success');
}