#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"

# Файлы для исключения
EXCLUDE_FILES=(
    "main.html"
    "admin.html"
    ".env"
    ".env.local"
    "config.local.js"
    "release.sh"
    "build.sh"
)

# Папки для исключения
EXCLUDE_DIRS=(
    "node_modules"
    ".git"
    "build"
    "release"
    ".vscode"
    ".github"
    ".idea"
    "logs"
    "tmp"
    "temp"
    "coverage"
    "cache"
    "downloads"
    "extracted"
    "storage"
    "uploads"
    "temp"
)

# Версия и режим
VERSION="$1"
MODE="$2"

if [ -z "$VERSION" ]; then
    echo -e "${YELLOW}Введите версию:${NC}"
    read -r VERSION
fi

if [ -z "$MODE" ]; then
    echo -e "${YELLOW}Режим (local/global):${NC}"
    echo "  1) local - без main.html"
    echo "  2) global - полная сборка"
    read -r MODE_CHOICE
    case $MODE_CHOICE in
        1) MODE="local" ;;
        2) MODE="global" ;;
        *) echo -e "${RED}Неверный выбор${NC}"; exit 1 ;;
    esac
fi

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# Очистка build
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
log_info "Создана папка build"

# Копирование файлов
log_info "Копирование файлов..."

for item in "${SCRIPT_DIR}"/*; do
    name=$(basename "$item")
    
    # Проверяем исключения
    skip=0
    for exclude in "${EXCLUDE_FILES[@]}"; do
        [ "$name" = "$exclude" ] && skip=1
    done
    for exclude in "${EXCLUDE_DIRS[@]}"; do
        [ "$name" = "$exclude" ] && skip=1
    done
    
    [ $skip -eq 1 ] && continue
    
    if [ -d "$item" ]; then
        cp -r "$item" "${BUILD_DIR}/"
    else
        cp "$item" "${BUILD_DIR}/"
    fi
done

# Копируем скрытые файлы
for item in "${SCRIPT_DIR}"/.[!.]*; do
    [ ! -e "$item" ] && continue
    name=$(basename "$item")
    
    skip=0
    for exclude in "${EXCLUDE_DIRS[@]}"; do
        [ "$name" = "$exclude" ] && skip=1
    done
    
    [ $skip -eq 1 ] && continue
    cp -r "$item" "${BUILD_DIR}/"
done

# Если режим LOCAL - удаляем main.html
if [ "$MODE" = "local" ]; then
    rm -f "${BUILD_DIR}/main.html"
    rm -f "${BUILD_DIR}/public/html/main.html" 2>/dev/null
    log_info "Режим LOCAL: main.html удален"
fi

log_success "Сборка завершена! Файлы в папке build/"
ls -la "${BUILD_DIR}" | head -10