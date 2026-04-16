#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Конфигурация
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"

# ============================================
# НАСТРОЙКА ИСКЛЮЧЕНИЙ
# ============================================
# Файлы для исключения (можно добавлять любые)
EXCLUDE_FILES=(
    "main.html"
    "admin.html"
    "dashboard.html"
    ".env"
    ".env.local"
    "config.local.js"
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
    ".nyc_output"
)

# Расширения файлов для исключения
EXCLUDE_EXTENSIONS=(
    ".log"
    ".tmp"
    ".swp"
    ".DS_Store"
)

# ============================================

# Функция для преобразования в верхний регистр
to_upper() {
    echo "$1" | tr '[:lower:]' '[:upper:]'
}

# Получаем версию
VERSION=""
MODE=""

if [ -n "$1" ] && [ "$1" != "local" ] && [ "$1" != "global" ]; then
    VERSION="$1"
    MODE="$2"
elif [ -f "${SCRIPT_DIR}/version.json" ]; then
    VERSION=$(grep -o '"version":"[^"]*"' "${SCRIPT_DIR}/version.json" | cut -d'"' -f4)
    MODE="$1"
else
    MODE="$1"
fi

if [ -z "$VERSION" ]; then
    echo -e "${YELLOW}Введите версию релиза (например: 1.0.0):${NC}"
    read -r VERSION
fi

if [ -z "$MODE" ]; then
    echo -e "${YELLOW}Выберите режим сборки:${NC}"
    echo "  1) local - исключаем main.html и указанные файлы"
    echo "  2) global - полная сборка (все файлы)"
    read -r MODE_CHOICE
    case $MODE_CHOICE in
        1) MODE="local" ;;
        2) MODE="global" ;;
        *) echo -e "${RED}Неверный выбор${NC}"; exit 1 ;;
    esac
fi

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Очистка build директории
clean_build() {
    log_info "Очистка директории build..."
    rm -rf "${BUILD_DIR}"
    mkdir -p "${BUILD_DIR}"
}

# Проверка, нужно ли исключить файл или папку
should_exclude() {
    local item="$1"
    local basename_item=$(basename "$item")
    
    # Проверяем исключенные файлы
    for exclude in "${EXCLUDE_FILES[@]}"; do
        if [ "$basename_item" = "$exclude" ]; then
            return 0
        fi
    done
    
    # Проверяем исключенные папки
    for exclude in "${EXCLUDE_DIRS[@]}"; do
        if [ "$basename_item" = "$exclude" ]; then
            return 0
        fi
    done
    
    # Проверяем расширения
    for ext in "${EXCLUDE_EXTENSIONS[@]}"; do
        if [[ "$basename_item" == *"$ext" ]]; then
            return 0
        fi
    done
    
    return 1
}

# Копирование файлов с учетом исключений
copy_with_excludes() {
    local src="$1"
    local dst="$2"
    
    mkdir -p "$dst"
    
    for item in "$src"/*; do
        [ -e "$item" ] || continue
        
        local basename_item=$(basename "$item")
        
        if [ "$basename_item" = "." ] || [ "$basename_item" = ".." ]; then
            continue
        fi
        
        if should_exclude "$basename_item"; then
            log_warning "Исключено: $basename_item"
            continue
        fi
        
        local target="$dst/$basename_item"
        
        if [ -d "$item" ]; then
            copy_with_excludes "$item" "$target"
        else
            cp "$item" "$target"
        fi
    done
    
    # Копируем скрытые файлы
    for item in "$src"/.[!.]*; do
        [ -e "$item" ] || continue
        
        local basename_item=$(basename "$item")
        
        if should_exclude "$basename_item"; then
            continue
        fi
        
        local target="$dst/$basename_item"
        
        if [ -d "$item" ]; then
            copy_with_excludes "$item" "$target"
        else
            cp "$item" "$target"
        fi
    done
}

# Режим LOCAL (исключаем main.html и другие)
build_local() {
    log_info "Сборка в режиме LOCAL (исключаем указанные файлы)..."
    
    copy_with_excludes "${SCRIPT_DIR}" "${BUILD_DIR}"
    
    log_success "Сборка LOCAL завершена"
    
    # Создаем файл с описанием сборки
    cat > "${BUILD_DIR}/BUILD_INFO.txt" << EOF
===========================================
СБОРКА ГЕРКУЛЕС
===========================================
Режим: LOCAL
Версия: ${VERSION}
Дата: $(date '+%Y-%m-%d %H:%M:%S')
===========================================
Исключенные файлы:
$(printf '  - %s\n' "${EXCLUDE_FILES[@]}")
Исключенные папки:
$(printf '  - %s\n' "${EXCLUDE_DIRS[@]}")
Исключенные расширения:
$(printf '  - %s\n' "${EXCLUDE_EXTENSIONS[@]}")
===========================================
Эта сборка НЕ содержит main.html и другие исключенные файлы.
===========================================
EOF
}

# Режим GLOBAL (все файлы, включая main.html)
build_global() {
    log_info "Сборка в режиме GLOBAL (полная копия)..."
    
    for item in "$SCRIPT_DIR"/*; do
        [ -e "$item" ] || continue
        
        local basename_item=$(basename "$item")
        
        # Исключаем только build директорию и git
        if [ "$basename_item" = "build" ] || [ "$basename_item" = ".git" ]; then
            continue
        fi
        
        local target="$BUILD_DIR/$basename_item"
        
        if [ -d "$item" ]; then
            cp -r "$item" "$target"
        else
            cp "$item" "$target"
        fi
    done
    
    # Копируем скрытые файлы
    for item in "$SCRIPT_DIR"/.[!.]*; do
        [ -e "$item" ] || continue
        
        local basename_item=$(basename "$item")
        
        if [ "$basename_item" = ".git" ]; then
            continue
        fi
        
        local target="$BUILD_DIR/$basename_item"
        
        if [ -d "$item" ]; then
            cp -r "$item" "$target"
        else
            cp "$item" "$target"
        fi
    done
    
    log_success "Сборка GLOBAL завершена"
    
    cat > "${BUILD_DIR}/BUILD_INFO.txt" << EOF
===========================================
СБОРКА ГЕРКУЛЕС
===========================================
Режим: GLOBAL (полная)
Версия: ${VERSION}
Дата: $(date '+%Y-%m-%d %H:%M:%S')
===========================================
Включены все файлы (включая main.html)
===========================================
EOF
}

# Показать структуру сборки
show_build_structure() {
    echo ""
    echo -e "${BLUE}Структура сборки:${NC}"
    cd "${BUILD_DIR}" || return
    find . -maxdepth 3 -type f 2>/dev/null | head -20 | sed 's/^\./  /'
    local file_count=$(find . -type f 2>/dev/null | wc -l)
    if [ "$file_count" -gt 20 ]; then
        echo "  ... и еще $((file_count - 20)) файлов"
    fi
    echo ""
    echo -e "${BLUE}Всего файлов в сборке:${NC} $file_count"
    cd "${SCRIPT_DIR}" || exit
}

# Отчет
print_report() {
    local mode_upper=$(to_upper "$MODE")
    
    echo ""
    echo "========================================="
    echo -e "${GREEN}СБОРКА ЗАВЕРШЕНА${NC}"
    echo "========================================="
    echo -e "${BLUE}Режим:${NC} ${mode_upper}"
    echo -e "${BLUE}Версия:${NC} ${VERSION}"
    echo -e "${BLUE}Директория сборки:${NC} ${BUILD_DIR}"
    echo -e "${BLUE}Размер сборки:${NC} $(du -sh "${BUILD_DIR}" 2>/dev/null | cut -f1)"
    echo ""
    echo -e "${BLUE}Исключенные файлы (только LOCAL):${NC}"
    for exclude in "${EXCLUDE_FILES[@]}"; do
        echo "  - ${exclude}"
    done
    echo ""
    show_build_structure
    echo "========================================="
}

# Основная функция
main() {
    local mode_upper=$(to_upper "$MODE")
    
    echo ""
    echo "========================================="
    echo -e "${BLUE}ГЕРКУЛЕС - СБОРКА РЕЛИЗА${NC}"
    echo "========================================="
    echo -e "Режим: ${YELLOW}${mode_upper}${NC}"
    echo -e "Версия: ${YELLOW}${VERSION}${NC}"
    echo "========================================="
    
    clean_build
    
    case $MODE in
        local)
            build_local
            ;;
        global)
            build_global
            ;;
        *)
            log_error "Неизвестный режим: ${MODE}"
            exit 1
            ;;
    esac
    
    print_report
}

main "$@"