#!/bin/bash

# ============================================
# Скрипт создания нового расширения для платформы «Геркулес»
# ============================================

set -e

# Функции вывода
print_success() { echo "[OK] $1"; }
print_error() { echo "[ERROR] $1"; }
print_info() { echo "[INFO] $1"; }
print_warning() { echo "[WARN] $1"; }

# Запрос данных у пользователя
ask() {
    local prompt="$1"
    local default="$2"
    local result
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " result
        echo "${result:-$default}"
    else
        read -p "$prompt: " result
        echo "$result"
    fi
}

# Проверка корректности ID
validate_id() {
    if [[ ! "$1" =~ ^[a-z][a-z0-9_-]*$ ]]; then
        print_error "ID должен начинаться с буквы и содержать только a-z, 0-9, -, _"
        return 1
    fi
    return 0
}

# Проверка версии
validate_version() {
    if [[ ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_error "Версия должна быть в формате x.y.z (например 1.0.0)"
        return 1
    fi
    return 0
}

# Проверка категории
validate_category() {
    local valid_categories="scanner integration reporter rules automation"
    for cat in $valid_categories; do
        if [ "$1" == "$cat" ]; then
            return 0
        fi
    done
    print_error "Категория должна быть одной из: scanner, integration, reporter, rules, automation"
    return 1
}

echo "========================================="
echo "    Создание нового расширения"
echo "========================================="
echo ""

# Запрос ID расширения
while true; do
    EXT_ID=$(ask "ID расширения" "")
    if [ -n "$EXT_ID" ] && validate_id "$EXT_ID"; then
        break
    fi
done

# Запрос остальных данных
EXT_NAME=$(ask "Название расширения" "$EXT_ID")
EXT_VERSION=$(ask "Версия" "1.0.0")
validate_version "$EXT_VERSION"

EXT_DESCRIPTION=$(ask "Описание" "Расширение для платформы Геркулес")

EXT_AUTHOR=$(ask "Автор" "")

# Запрос категории
while true; do
    EXT_CATEGORY=$(ask "Категория (scanner/integration/reporter/rules/automation)" "automation")
    if validate_category "$EXT_CATEGORY"; then
        break
    fi
done

EXT_TAGS=$(ask "Теги (через запятую)" "$EXT_CATEGORY")
EXT_URL=$(ask "URL расширения" "/addon/$EXT_ID")
EXT_ORDER=$(ask "Порядок в меню (число)" "100")

# Определяем директории
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
EXTENSIONS_DIR="$PROJECT_ROOT/extensions"
EXT_DIR="$EXTENSIONS_DIR/$EXT_ID"
UI_DIR="$EXT_DIR/ui"
HTML_DIR="$UI_DIR/html"
CSS_DIR="$UI_DIR/css"
JS_DIR="$UI_DIR/js"
ASSETS_DIR="$EXT_DIR/assets"
BACKEND_DIR="$EXT_DIR/backend"

# Создаём структуру директорий
mkdir -p "$HTML_DIR" "$CSS_DIR" "$JS_DIR" "$ASSETS_DIR" "$BACKEND_DIR"

print_info "Создана структура: $EXT_DIR"

# Создаём manifest.json
cat > "$EXT_DIR/manifest.json" << EOF
{
    "id": "$EXT_ID",
    "name": "$EXT_NAME",
    "version": "$EXT_VERSION",
    "description": "$EXT_DESCRIPTION",
    "author": "$EXT_AUTHOR",
    "tags": [$(echo "$EXT_TAGS" | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/')],
    "category": "$EXT_CATEGORY",
    "price": "Free",
    "url": "$EXT_URL",
    "order": $EXT_ORDER
}
EOF

print_success "Создан manifest.json"

# Создаём index.html
cat > "$HTML_DIR/index.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>$EXT_NAME</title>
    <link rel="stylesheet" href="/css/main.css">
    <link rel="stylesheet" href="$EXT_URL/css/style.css">
</head>
<body>
    <div class="extension-container">
        <h1>$EXT_NAME</h1>
        <p>$EXT_DESCRIPTION</p>
        <button id="actionBtn">Выполнить действие</button>
        <div id="result"></div>
    </div>
    <script src="$EXT_URL/js/main.js"></script>
</body>
</html>
EOF

print_success "Создан ui/html/index.html"

# Создаём style.css
cat > "$CSS_DIR/style.css" << EOF
.extension-container {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

.extension-container h1 {
    color: #2c3e50;
    margin-bottom: 16px;
}

#actionBtn {
    background: #3498db;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
}

#actionBtn:hover {
    background: #2980b9;
}

#result {
    margin-top: 20px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 6px;
}
EOF

print_success "Создан ui/css/style.css"

# Создаём main.js
cat > "$JS_DIR/main.js" << EOF
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('actionBtn');
    const resultDiv = document.getElementById('result');
    
    if (btn) {
        btn.addEventListener('click', async () => {
            try {
                const response = await fetch('/addons/api/extension/$EXT_ID/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'test' })
                });
                
                const data = await response.json();
                resultDiv.innerHTML = \`Результат: \${JSON.stringify(data)}\`;
                
                if (window.showToast) {
                    window.showToast('Действие выполнено', 'success');
                }
            } catch (err) {
                console.error(err);
                resultDiv.innerHTML = 'Ошибка выполнения';
                if (window.showToast) {
                    window.showToast('Ошибка', 'error');
                }
            }
        });
    }
});
EOF

print_success "Создан ui/js/main.js"

# Создаём backend/index.js (опционально)
cat > "$BACKEND_DIR/index.js" << EOF
// Серверная логика расширения $EXT_NAME

export default async function({ app, logger, extId, registerApi }) {
    
    logger.info('[$EXT_ID] Инициализация...');
    
    // Пример API-эндпоинта
    registerApi('POST', '/action', async (req, res) => {
        const { action } = req.body;
        logger.info('[$EXT_ID] Выполнение действия: ' + action);
        
        res.json({
            success: true,
            message: 'Действие выполнено',
            timestamp: new Date().toISOString()
        });
    });
    
    logger.info('[$EXT_ID] Готово');
}
EOF

print_success "Создан backend/index.js"

# Добавляем расширение в catalog.json
CATALOG_FILE="$PROJECT_ROOT/config/catalog.json"

if [ -f "$CATALOG_FILE" ]; then
    # Проверяем, нет ли уже такого ID
    if grep -q "\"id\": \"$EXT_ID\"" "$CATALOG_FILE"; then
        print_warning "Расширение с ID $EXT_ID уже есть в catalog.json"
    else
        # Добавляем новую запись в catalog.json
        # Удаляем закрывающую скобку и добавляем новую запись
        sed -i '' '$ d' "$CATALOG_FILE"
        if [ -s "$CATALOG_FILE" ]; then
            echo "," >> "$CATALOG_FILE"
        fi
        cat >> "$CATALOG_FILE" << EOF
    {
        "id": "$EXT_ID",
        "name": "$EXT_NAME",
        "version": "$EXT_VERSION",
        "description": "$EXT_DESCRIPTION",
        "url": "$EXT_URL",
        "order": $EXT_ORDER
    }
]
EOF
        print_success "Расширение добавлено в catalog.json"
    fi
else
    print_warning "Файл catalog.json не найден: $CATALOG_FILE"
fi

echo ""
echo "========================================="
print_success "Расширение '$EXT_NAME' успешно создано!"
echo "========================================="
echo ""
echo "Директория: $EXT_DIR"
echo ""
echo "Структура:"
echo "  $EXT_ID/"
echo "  ├── manifest.json"
echo "  ├── ui/"
echo "  │   ├── html/index.html"
echo "  │   ├── css/style.css"
echo "  │   └── js/main.js"
echo "  ├── backend/index.js"
echo "  └── assets/"
echo ""
echo "Что делать дальше:"
echo "  1. Перезапустите сервер"
echo "  2. Перейдите на страницу /addon"
echo "  3. Установите расширение"
echo ""