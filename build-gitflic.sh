#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="${SCRIPT_DIR}/temp_public_$(date +%s)"

if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    TEMP_DIR=$(cygpath -m "$TEMP_DIR" 2>/dev/null || echo "$TEMP_DIR")
fi

VERSION="$1"
if [ -z "$VERSION" ]; then
    echo "Введите версию:"
    read -r VERSION
fi

BRANCH="release/v${VERSION}"
PUBLIC_REPO="hercules-community/hercules"  # <--- ИЗМЕНЕНО ДЛЯ GITFLIC

if [ -z "$GITFLIC_TOKEN" ]; then
    echo "Введите GitFlic токен:"
    read -r GITFLIC_TOKEN
fi

EXCLUDE_FILES=(
    ".env" ".env.local" "build.sh" ".gitignore"
    "build.log"
    ".DS_Store" "addon.md" "dast.html" "app.log" "app.pid"
    "create-addon.sh" "config.json" "history.json"
    "build-release-delta.sh" "build-msi.sh" "build-macos.sh" "build-linux.sh"
    "installer.iss" "extractor.js" "uploader.js" "build-docker.sh"
)

EXCLUDE_DIRS=(
    "node_modules" ".git" "build" "releases" ".vscode"
    ".github" ".idea" "logs" "tmp" "temp" "extracted"
    "uploads" "dast" "test" "tests" "__pycache__" "venv"
    "v2" "history" "flexdb"
)

# ✅ Общая функция копирования с исключением папок И файлов
copy_dir_excluding() {
    local src="$1"
    local dst="$2"
    shift 2
    local excludes=("$@")
    mkdir -p "$dst"

    if command -v rsync &>/dev/null; then
        local rsync_excludes=()
        for e in "${excludes[@]}"; do
            if [[ "$e" == *.* ]]; then
                rsync_excludes+=(--exclude="$e")
            else
                rsync_excludes+=(--exclude="$e/")
            fi
        done
        rsync -a "${rsync_excludes[@]}" "$src/" "$dst/"
    else
        local find_expr=()
        for e in "${excludes[@]}"; do
            find_expr+=(-name "$e" -o)
        done
        unset 'find_expr[${#find_expr[@]}-1]'

        ( cd "$src" && find . -mindepth 1 \( "${find_expr[@]}" \) -prune -o -print ) \
            | while IFS= read -r rel; do
                rel="${rel#./}"
                if [ -d "$src/$rel" ]; then
                    mkdir -p "$dst/$rel"
                else
                    mkdir -p "$dst/$(dirname "$rel")"
                    cp "$src/$rel" "$dst/$rel"
                fi
            done
    fi
}

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

JS_COUNT=0
UI_JS_COUNT=0
ADDON_JS_COUNT=0
HERCULES_JS_COUNT=0
SERVER_JS_COUNT=0
CHECK_ENV_COUNT=0

echo "[INFO] Сборка файлов..."
rm -rf "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}/addons"
mkdir -p "${TEMP_DIR}/hercules"
mkdir -p "${TEMP_DIR}/ui"

# ========== 1. package.json ==========
echo "[INFO] Копирование package.json..."
if [ ! -f "${SCRIPT_DIR}/package.json" ]; then
    echo "  ERROR: package.json не найден"
    exit 1
fi
cp -f "${SCRIPT_DIR}/package.json" "${TEMP_DIR}/package.json"

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

# ========== 2. Защита ==========
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
    javascript-obfuscator "${TEMP_DIR}/_check_env.js" \
        --output "${TEMP_DIR}/check-env.js" \
        --compact true --control-flow-flattening true --debug-protection true \
        --identifier-names-generator hexadecimal --string-array true --string-array-encoding rc4 \
        2>/dev/null
    rm -f "${TEMP_DIR}/_check_env.js"
    CHECK_ENV_COUNT=1
else
    mv "${TEMP_DIR}/_check_env.js" "${TEMP_DIR}/check-env.js"
fi

# ========== 3. obfuscate_file ==========
obfuscate_file() {
    local input_file="$1"
    local output_file="$2"
    javascript-obfuscator "$input_file" \
        --output "$output_file" \
        --compact true --control-flow-flattening true --dead-code-injection true \
        --debug-protection true --disable-console-output false \
        --identifier-names-generator hexadecimal --rename-globals true \
        --self-defending true --string-array true --string-array-encoding rc4 \
        --string-array-threshold 0.8 --transform-object-keys true \
        --unicode-escape-sequence false \
        2>/dev/null
}

# ========== 4. UI — только копирование (целиком) ==========
echo "[INFO] Копирование ui (без обфускации)..."
if [ -d "${SCRIPT_DIR}/ui" ]; then
    cp -r "${SCRIPT_DIR}/ui/." "${TEMP_DIR}/ui/"
    while IFS= read -r js_file; do
        [ -z "$js_file" ] && continue
        UI_JS_COUNT=$((UI_JS_COUNT + 1))
        JS_COUNT=$((JS_COUNT + 1))
    done < <(find "${TEMP_DIR}/ui" -type f -name "*.js" -not -path "*/node_modules/*" 2>/dev/null)
    echo "  ui: ${UI_JS_COUNT} JS-файлов"
fi

# ========== 5. Hercules — копирование + обфускация ==========
echo "[INFO] Копирование и обфускация hercules..."
if [ -d "${SCRIPT_DIR}/hercules" ]; then
    copy_dir_excluding "${SCRIPT_DIR}/hercules" "${TEMP_DIR}/hercules" \
        history history.json flexdb node_modules .git logs tmp temp
    mkdir -p "${TEMP_DIR}/hercules/history"

    while IFS= read -r js_file; do
        [ -z "$js_file" ] && continue
        echo "    Обфускация: ${js_file#${TEMP_DIR}/}"
        obfuscate_file "$js_file" "$js_file"
        HERCULES_JS_COUNT=$((HERCULES_JS_COUNT + 1))
        JS_COUNT=$((JS_COUNT + 1))
    done < <(find "${TEMP_DIR}/hercules" -type f -name "*.js" -not -path "*/history/*" 2>/dev/null)
    echo "  hercules: ${HERCULES_JS_COUNT} JS-файлов"
fi

# ========== 6. Addons — копирование + обфускация ==========
echo "[INFO] Копирование и обфускация addons..."
if [ -d "${SCRIPT_DIR}/addons" ]; then
    copy_dir_excluding "${SCRIPT_DIR}/addons" "${TEMP_DIR}/addons" \
        history history.json node_modules .git logs tmp temp

    while IFS= read -r js_file; do
        [ -z "$js_file" ] && continue
        echo "    Обфускация: ${js_file#${TEMP_DIR}/}"
        obfuscate_file "$js_file" "$js_file"
        ADDON_JS_COUNT=$((ADDON_JS_COUNT + 1))
        JS_COUNT=$((JS_COUNT + 1))
    done < <(find "${TEMP_DIR}/addons" -type f -name "*.js" -not -path "*/history/*" 2>/dev/null)
    echo "  addons: ${ADDON_JS_COUNT} JS-файлов"
fi

# ========== 7. server.js ==========
echo "[INFO] Обфускация server.js..."
if [ -f "${SCRIPT_DIR}/server.js" ]; then
    cp "${SCRIPT_DIR}/server.js" "${TEMP_DIR}/server.js"
    if should_exclude "${SCRIPT_DIR}/server.js"; then
        echo "  server.js исключён"
    else
        obfuscate_file "${TEMP_DIR}/server.js" "${TEMP_DIR}/server.js"
        SERVER_JS_COUNT=1
        JS_COUNT=$((JS_COUNT + 1))
    fi
fi

# ========== 8. Остальные файлы ==========
echo "[INFO] Копирование остальных файлов..."
for item in "${SCRIPT_DIR}"/*; do
    name=$(basename "$item")
    [[ "$name" == "temp_public_"* ]] && continue
    [[ "$name" == "server.js" ]] && continue
    [[ "$name" == "addons" ]] && continue
    [[ "$name" == "hercules" ]] && continue
    [[ "$name" == "ui" ]] && continue
    [[ "$name" == "package.json" ]] && continue
    [[ "$name" == "check-env.js" ]] && continue
    should_exclude "$item" && continue

    if [ -d "$item" ]; then
        cp -r "$item" "${TEMP_DIR}/"
    else
        cp "$item" "${TEMP_DIR}/"
    fi
    echo "  Скопировано: $name"
done

for item in "${SCRIPT_DIR}"/.[!.]*; do
    [ ! -e "$item" ] && continue
    name=$(basename "$item")
    [[ "$name" == ".git" ]] && continue
    [[ "$name" == "temp_public_"* ]] && continue
    [[ "$name" == "package.json" ]] && continue
    [[ "$name" == "check-env.js" ]] && continue
    should_exclude "$item" && continue
    cp -r "$item" "${TEMP_DIR}/"
    echo "  Скопировано: $name"
done

# ========== 9. config.default.json ==========
echo "[INFO] Копирование config.default.json в hercules/config.json..."
mkdir -p "${TEMP_DIR}/hercules"
if [ -f "${SCRIPT_DIR}/config.default.json" ]; then
    cp "${SCRIPT_DIR}/config.default.json" "${TEMP_DIR}/hercules/config.json"
else
    cat > "${TEMP_DIR}/hercules/config.json" << 'EOF'
{
    "info": { "name": "Hercules Security Platform", "version": "1.0.0" },
    "server": { "port": 6565, "host": "localhost" },
    "security": { "rateLimit": { "enabled": true, "maxRequests": 100, "windowMs": 60000 } },
    "logging": { "level": "info", "directory": "./logs" },
    "license": { "type": "community" }
}
EOF
fi

# ========== 10. .env ==========
echo "[INFO] Создание .env..."
if [ -f "${SCRIPT_DIR}/.env.example" ]; then
    cp "${SCRIPT_DIR}/.env.example" "${TEMP_DIR}/.env"
else
    cat > "${TEMP_DIR}/.env" << 'EOF'
PORT=6565
HOST=localhost
NODE_ENV=production
GITHUB_TOKEN=
LOG_DIR=./logs
EOF
fi

# ========== 11. .gitignore ==========
cat > "${TEMP_DIR}/.gitignore" << 'EOF'
node_modules
logs
extracted
temp
storage
.DS_Store
modules/dast
app.log
app.pid
.env
hercules/history
hercules/history.json
addons/blender/history
addons/blender/history.json
addons/sast/history
addons/sast/history.json
addons/sca/history
addons/sca/history.json
addons/fuzz/history
addons/fuzz/history.json
addons/palette/history
addons/palette/history.json
flxdb/
releases
hercules/config.json
EOF

# ========== 12. Git (GITFLIC) ==========
echo "[INFO] Клонирование репозитория GitFlic..."
REPO_DIR="${TEMP_DIR}/repo"
# ИЗМЕНЕНО: URL GitFlic
git clone "https://${GITFLIC_TOKEN}@gitflic.ru/${PUBLIC_REPO}.git" "${REPO_DIR}"
cd "${REPO_DIR}"

if git ls-remote --heads origin "${BRANCH}" | grep -q "${BRANCH}"; then
    echo "[WARN] Ветка ${BRANCH} уже существует, удаляем..."
    git push origin --delete "${BRANCH}"
fi

git checkout -b "${BRANCH}"

echo "[INFO] Обновление файлов..."
rm -rf *
cp -r "${TEMP_DIR}"/* .
cp -r "${TEMP_DIR}"/.[!.]* . 2>/dev/null

find ./hercules ./addons -type d -name history -prune -exec rm -rf {} + 2>/dev/null || true
find ./hercules ./addons -type f -name "history.json" -exec rm -f {} + 2>/dev/null || true

echo "[INFO] Проверка: ui/history на месте?"
ls -la ui/history/ 2>&1 | head -5

echo "[INFO] Коммит и пуш..."
git add -A
git commit -m "Release v${VERSION}"
git push origin "${BRANCH}" --force

# ИЗМЕНЕНО: Вместо GitHub API — вывод ссылки для ручного создания PR
echo "[INFO] Создание Pull Request..."
echo "  Ветка ${BRANCH} успешно запушена в GitFlic."
echo "  Для создания PR перейдите по ссылке:"
echo "  https://gitflic.ru/project/${PUBLIC_REPO}/merge-request/create?source=${BRANCH}&target=main"

cd "${SCRIPT_DIR}"
rm -rf "${TEMP_DIR}"

echo "[SUCCESS] Готово! Релиз v${VERSION} отправлен в GitFlic"
echo ""
echo "Статистика:"
echo "  - hercules: ${HERCULES_JS_COUNT} JS (без history)"
echo "  - addons: ${ADDON_JS_COUNT} JS (без history)"
echo "  - ui: ${UI_JS_COUNT} JS (без обфускации)"
echo "  - server.js: ${SERVER_JS_COUNT}"
echo "  - check-env.js: ${CHECK_ENV_COUNT}"
echo "  - Всего: ${JS_COUNT}"