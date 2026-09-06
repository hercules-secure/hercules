#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="${SCRIPT_DIR}/temp_docker_$(date +%s)"

# Конвертируем Windows-путь в Unix-путь для Git Bash
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    TEMP_DIR=$(cygpath -m "$TEMP_DIR" 2>/dev/null || echo "$TEMP_DIR")
fi

VERSION="$1"
if [ -z "$VERSION" ]; then
    echo "Введите версию (например, 1.0.0):"
    read -r VERSION
fi

DOCKER_USER="herculessecurity"
IMAGE_NAME="hercules"

# Файлы для исключения (НЕ попадают в образ)
EXCLUDE_FILES=(
    ".env" ".env.local" "build.sh" ".gitignore"
    "build.log" 
    ".DS_Store" "addon.md" "dast.html" "app.log" "app.pid"
    "create-addon.sh"
    "config.json"
    "history.json"
    "build-release-delta.sh"
    "build-msi.sh"
    "build-macos.sh"
    "build-linux.sh"
    "installer.iss"
    "build-docker.sh"
    ".Dockerfile"
    ".env.example"   # <--- ДОБАВЬТЕ ЭТУ СТРОКУ!
)

# Папки для исключения
EXCLUDE_DIRS=(
    "node_modules" ".git" "build" "releases" ".vscode"
    ".github" ".idea" "logs" "tmp" "temp" "extracted"
    "uploads" "dast" "test" "tests" "__pycache__" "venv" 
    "v2"
)

# Счётчики для статистики
JS_COUNT=0
UI_JS_COUNT=0
ADDON_JS_COUNT=0
HERCULES_JS_COUNT=0
SERVER_JS_COUNT=0
CHECK_ENV_COUNT=0

should_exclude() {
    local name=$(basename "$1")
    
    for exclude in "${EXCLUDE_FILES[@]}"; do
        [[ "$name" == "$exclude" ]] && return 0
    done
    
    for exclude in "${EXCLUDE_DIRS[@]}"; do
        [[ "$name" == "$exclude" ]] && return 0
    done
    
    return 1
}

echo "[INFO] Сборка файлов для Docker образа..."
rm -rf "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}/addons"
mkdir -p "${TEMP_DIR}/hercules"
mkdir -p "${TEMP_DIR}/ui"

# ========== 1. КОПИРУЕМ package.json ==========
echo "[INFO] Копирование package.json..."

if [ ! -f "${SCRIPT_DIR}/package.json" ]; then
    echo "  ERROR: package.json не найден"
    exit 1
fi

cp -f "${SCRIPT_DIR}/package.json" "${TEMP_DIR}/package.json"
echo "  package.json скопирован"

# ========== 2. ОБНОВЛЯЕМ package.json ==========
echo "[INFO] Обновление package.json..."

cat "${TEMP_DIR}/package.json" | node -e "
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => {
        const pkg = JSON.parse(data);
        pkg.scripts = pkg.scripts || {};
        pkg.scripts.start = 'node server.js';
        pkg.scripts['start:prod'] = 'NODE_ENV=production node server.js';
        console.log(JSON.stringify(pkg, null, 2));
    });
" > "${TEMP_DIR}/package.json.tmp"

mv "${TEMP_DIR}/package.json.tmp" "${TEMP_DIR}/package.json"
echo "  package.json обновлён"

# ========== 3. ДОБАВЛЕНИЕ ЗАЩИТЫ ==========
echo "[INFO] Добавление защиты..."

if ! command -v javascript-obfuscator &> /dev/null; then
    echo "[WARN] javascript-obfuscator не установлен, устанавливаем..."
    npm install -g javascript-obfuscator
fi

cat > "${TEMP_DIR}/_check_env.js" << 'EOF'
if (typeof window !== 'undefined') {
    setInterval(() => {
        const start = performance.now();
        debugger;
        if (performance.now() - start > 100) {
            document.body.innerHTML = '<h1>Access Denied</h1>';
            throw new Error('Debugger detected');
        }
    }, 1000);
}
if (process.env.NODE_ENV !== 'production') {
    console.log('Development mode');
}
EOF

if command -v javascript-obfuscator &> /dev/null; then
    echo "  Обфускация защиты..."
    javascript-obfuscator "${TEMP_DIR}/_check_env.js" \
        --output "${TEMP_DIR}/check-env.js" \
        --compact true \
        --control-flow-flattening true \
        --debug-protection true \
        --identifier-names-generator hexadecimal \
        --string-array true \
        --string-array-encoding rc4 \
        2>/dev/null
    rm -f "${TEMP_DIR}/_check_env.js"
    echo "  check-env.js обфусцирован"
    CHECK_ENV_COUNT=1
else
    mv "${TEMP_DIR}/_check_env.js" "${TEMP_DIR}/check-env.js"
    echo "  check-env.js скопирован (без обфускации)"
fi

# ========== 4. ОБФУСКАЦИЯ СЕРВЕРНЫХ ФАЙЛОВ ==========
echo "[INFO] Обфускация серверных файлов..."

obfuscate_file() {
    local input_file="$1"
    local output_file="$2"
    
    javascript-obfuscator "$input_file" \
        --output "$output_file" \
        --compact true \
        --control-flow-flattening true \
        --dead-code-injection true \
        --debug-protection true \
        --disable-console-output false \
        --identifier-names-generator hexadecimal \
        --rename-globals true \
        --self-defending true \
        --string-array true \
        --string-array-encoding rc4 \
        --string-array-threshold 0.8 \
        --transform-object-keys true \
        --unicode-escape-sequence false \
        2>/dev/null
}

# ========== 5. UI - ТОЛЬКО КОПИРОВАНИЕ (БЕЗ ОБФУСКАЦИИ) ==========
echo "[INFO] Копирование ui (без обфускации)..."

if [ -d "${SCRIPT_DIR}/ui" ]; then
    cp -r "${SCRIPT_DIR}/ui" "${TEMP_DIR}/"
    echo "  ui скопирована"
    
    while IFS= read -r -d '' js_file; do
        rel_path="${js_file#${SCRIPT_DIR}/}"
        target_file="${TEMP_DIR}/${rel_path}"
        mkdir -p "$(dirname "$target_file")"
        
        echo "    Копирование: ${rel_path}"
        cp "$js_file" "$target_file"
        UI_JS_COUNT=$((UI_JS_COUNT + 1))
        JS_COUNT=$((JS_COUNT + 1))
        
    done < <(find "${SCRIPT_DIR}/ui" -type f -name "*.js" 2>/dev/null | grep -v "node_modules" | xargs -0 2>/dev/null || true)
fi

# ========== 6. HERCULES - ОБФУСКАЦИЯ ==========
echo "[INFO] Обфускация hercules..."

if [ -d "${SCRIPT_DIR}/hercules" ]; then
    cp -r "${SCRIPT_DIR}/hercules" "${TEMP_DIR}/"
    echo "  hercules скопирована"
    
    find "${TEMP_DIR}/hercules" -type f -name "*.js" 2>/dev/null | while IFS= read -r js_file; do
        [ -z "$js_file" ] && continue
        echo "    Обфускация: ${js_file#${TEMP_DIR}/}"
        obfuscate_file "$js_file" "$js_file"
        HERCULES_JS_COUNT=$((HERCULES_JS_COUNT + 1))
        JS_COUNT=$((JS_COUNT + 1))
    done
fi

# ========== 7. ADDONS - ОБФУСКАЦИЯ ==========
echo "[INFO] Обфускация addons..."

if [ -d "${SCRIPT_DIR}/addons" ]; then
    cp -r "${SCRIPT_DIR}/addons" "${TEMP_DIR}/"
    echo "  addons скопированы"
    
    find "${TEMP_DIR}/addons" -type f -name "*.js" 2>/dev/null | while IFS= read -r js_file; do
        [ -z "$js_file" ] && continue
        echo "    Обфускация: ${js_file#${TEMP_DIR}/}"
        obfuscate_file "$js_file" "$js_file"
        ADDON_JS_COUNT=$((ADDON_JS_COUNT + 1))
        JS_COUNT=$((JS_COUNT + 1))
    done
fi

# ========== 8. ОБФУСКАЦИЯ server.js ==========
echo "[INFO] Обфускация server.js..."

if [ -f "${SCRIPT_DIR}/server.js" ]; then
    if should_exclude "${SCRIPT_DIR}/server.js"; then
        echo "  server.js исключён"
        cp "${SCRIPT_DIR}/server.js" "${TEMP_DIR}/server.js"
    else
        cp "${SCRIPT_DIR}/server.js" "${TEMP_DIR}/server.js"
        echo "  Обфускация: server.js"
        obfuscate_file "${TEMP_DIR}/server.js" "${TEMP_DIR}/server.js"
        SERVER_JS_COUNT=1
        JS_COUNT=$((JS_COUNT + 1))
    fi
fi

# ========== 9. КОПИРУЕМ ОСТАЛЬНЫЕ ФАЙЛЫ ==========
echo "[INFO] Копирование остальных файлов..."

for item in "${SCRIPT_DIR}"/*; do
    name=$(basename "$item")
    
    [[ "$name" == "temp_docker_"* ]] && continue
    [[ "$name" == "server.js" ]] && continue
    [[ "$name" == "addons" ]] && continue
    [[ "$name" == "hercules" ]] && continue
    [[ "$name" == "ui" ]] && continue
    [[ "$name" == "package.json" ]] && continue
    [[ "$name" == "check-env.js" ]] && continue
    [[ "$name" == ".gitignore" ]] && continue  # <-- ДОБАВЛЕНО
    [[ "$name" == ".dockerignore" ]] && continue # <-- ДОБАВЛЕНО
    
    should_exclude "$item" && continue
    
    if [ -d "$item" ]; then
        cp -r "$item" "${TEMP_DIR}/"
    else
        cp "$item" "${TEMP_DIR}/"
    fi
    echo "  Скопировано: $name"
done

# Копируем скрытые файлы (кроме .git)
for item in "${SCRIPT_DIR}"/.[!.]*; do
    [ ! -e "$item" ] && continue
    name=$(basename "$item")
    
    [[ "$name" == ".git" ]] && continue
    [[ "$name" == "temp_docker_"* ]] && continue
    [[ "$name" == "package.json" ]] && continue
    [[ "$name" == "check-env.js" ]] && continue
    [[ "$name" == ".gitignore" ]] && continue
    [[ "$name" == ".dockerignore" ]] && continue
    
    should_exclude "$item" && continue
    
    cp -r "$item" "${TEMP_DIR}/"
    echo "  Скопировано: $name"
done

# ========== 10. КОПИРУЕМ CONFIG.DEFAULT.JSON В HERCULES ==========
echo "[INFO] Копирование конфигурационного шаблона в hercules/config.json..."

mkdir -p "${TEMP_DIR}/hercules"

if [ -f "${SCRIPT_DIR}/config.default.json" ]; then
    cp "${SCRIPT_DIR}/config.default.json" "${TEMP_DIR}/hercules/config.json"
    echo "  config.default.json скопирован в hercules/config.json"
else
    echo "  WARNING: config.default.json не найден, создаём шаблон..."
    
    cat > "${TEMP_DIR}/hercules/config.json" << 'EOF'
{
    "info": {
        "name": "Hercules Security Platform",
        "version": "1.0.0",
        "description": "Enterprise Security Platform"
    },
    "server": {
        "port": 6565,
        "host": "localhost",
        "maxFileSize": 104857600
    },
    "security": {
        "rateLimit": {
            "enabled": true,
            "maxRequests": 100,
            "windowMs": 60000
        }
    },
    "logging": {
        "level": "info",
        "directory": "./logs"
    },
    "license": {
        "type": "community"
    }
}
EOF
    echo "  hercules/config.json создан из шаблона"
fi

# ========== 11. СОЗДАЁМ .env ПРИМЕР ==========
echo "[INFO] Создание .env"
    cat > "${TEMP_DIR}/.env" << 'EOF'
# Hercules Server Configuration
PORT=6565
HOST=0.0.0.0
NODE_ENV=production

# Logging
LOG_DIR=./logs
EOF
    echo "  .env.example создан"

# ========== 12. СОЗДАЁМ DOCKERFILE ==========

echo "[INFO] Удаление мешающего .dockerignore..."
rm -f "${TEMP_DIR}/.dockerignore"

echo "[INFO] Генерация Dockerfile..."

cat > "${TEMP_DIR}/Dockerfile" << EOF
FROM node:20-alpine

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci --only=production

# Копируем всё содержимое (включая обфусцированные файлы)
COPY . .

EXPOSE 6565

# Запуск продакшена
CMD ["npm", "run", "start:prod"]
EOF

echo "  Dockerfile создан"

# ========== 13. DOCKER BUILD И PUSH ==========
echo "[INFO] Сборка Docker образа..."
cd "${TEMP_DIR}"

FULL_TAG="${DOCKER_USER}/${IMAGE_NAME}:${VERSION}"
LATEST_TAG="${DOCKER_USER}/${IMAGE_NAME}:latest"

docker build -t "${FULL_TAG}" .
docker tag "${FULL_TAG}" "${LATEST_TAG}"

echo "[INFO] Отправка образа в Docker Hub..."
docker push "${FULL_TAG}"
docker push "${LATEST_TAG}"

cd "${SCRIPT_DIR}"
rm -rf "${TEMP_DIR}"

echo "[SUCCESS] Docker образ ${FULL_TAG} успешно собран и отправлен!"
echo ""
echo "Статистика:"
echo "  - package.json: обновлён"
echo "  - hercules/config.json: создан из шаблона"
echo "  - .env.example: создан"
echo "  - check-env.js: обфусцирован"
echo "  - server.js: обфусцирован"
echo "  - hercules/**/*.js: ${HERCULES_JS_COUNT} файлов обфусцировано"
echo "  - addons/**/*.js: ${ADDON_JS_COUNT} файлов обфусцировано (включая modules)"
echo "  - ui/**/*.js: ${UI_JS_COUNT} файлов (БЕЗ ОБФУСКАЦИИ)"
echo "  - Всего JS файлов: ${JS_COUNT}"