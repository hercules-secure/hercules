#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Файлы для исключения из копирования
EXCLUDE_FILES=(
    "main.html"
    "admin.html"
    ".env"
    ".env.local"
    "config.local.js"
    "release.sh"
    "build.sh"
    ".gitignore"
    "api.html"
    "auth.html"
    "samm.html"
    "learn.html"
    "designer.html"
    "burp.json"
    "config-rules.json"
    "go-rules.json"
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

# Копирование файлов (без удаления существующих)
log_info "Копирование файлов для коммита..."

FILES_COPIED=()

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
        # Для папок - копируем рекурсивно с заменой
        cp -rf "$item" "${SCRIPT_DIR}/"
        log_info "Обновлена папка: $name"
        FILES_COPIED+=("$name/")
    else
        # Для файлов - копируем с заменой
        cp -f "$item" "${SCRIPT_DIR}/"
        log_info "Обновлен файл: $name"
        FILES_COPIED+=("$name")
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
    cp -rf "$item" "${SCRIPT_DIR}/"
    log_info "Обновлен скрытый файл: $name"
    FILES_COPIED+=("$name")
done

# Если режим LOCAL - удаляем main.html (если он есть)
if [ "$MODE" = "local" ]; then
    rm -f "${SCRIPT_DIR}/main.html"
    rm -f "${SCRIPT_DIR}/public/html/main.html" 2>/dev/null
    log_info "Режим LOCAL: main.html удален"
fi

# Добавляем измененные файлы в git
log_info "Добавление файлов в git..."

# Добавляем все скопированные файлы
for file in "${FILES_COPIED[@]}"; do
    if [ -e "$file" ]; then
        git add "$file" 2>/dev/null
    fi
done

# Также добавляем все новые файлы (которые могли появиться)
git add . 2>/dev/null

# Показываем что будет закоммичено
echo ""
echo -e "${BLUE}Изменения для коммита:${NC}"
git status --short

# Создаем коммит
COMMIT_MSG="Export v${VERSION} (${MODE} mode) - $(date +'%Y-%m-%d %H:%M:%S')"
echo ""
echo -e "${YELLOW}Создать коммит? (y/N):${NC}"
read -r COMMIT_CHOICE

if [[ "$COMMIT_CHOICE" =~ ^[Yy]$ ]]; then
    git commit -m "$COMMIT_MSG"
    
    if [ $? -eq 0 ]; then
        log_success "Коммит создан: ${COMMIT_MSG}"
        
        # Спрашиваем про пуш
        echo -e "${YELLOW}Отправить изменения в remote? (y/N):${NC}"
        read -r PUSH_CHOICE
        if [[ "$PUSH_CHOICE" =~ ^[Yy]$ ]]; then
            CURRENT_BRANCH=$(git branch --show-current)
            git push origin "$CURRENT_BRANCH"
            log_success "Изменения отправлены в remote"
        fi
    else
        echo -e "${YELLOW}Нет изменений для коммита${NC}"
    fi
else
    log_info "Коммит отменен"
fi

log_success "Готово!"