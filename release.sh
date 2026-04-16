#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Функция для преобразования в верхний регистр
to_upper() {
    echo "$1" | tr '[:lower:]' '[:upper:]'
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Конфигурация
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="$1"
MODE="$2"

if [ -z "$VERSION" ]; then
    echo -e "${YELLOW}Введите версию релиза (например: 1.0.0):${NC}"
    read -r VERSION
fi

if [ -z "$MODE" ]; then
    echo -e "${YELLOW}Выберите режим сборки (local/global):${NC}"
    echo "  1) local - исключаем main.html и указанные файлы"
    echo "  2) global - полная сборка (все файлы)"
    read -r MODE_CHOICE
    case $MODE_CHOICE in
        1) MODE="local" ;;
        2) MODE="global" ;;
        *) echo -e "${RED}Неверный выбор${NC}"; exit 1 ;;
    esac
fi

RELEASE_BRANCH="release/${VERSION}"
MODE_UPPER=$(to_upper "$MODE")

# ============================================
# 1. КОММИТИМ ВСЕ ТЕКУЩИЕ ИЗМЕНЕНИЯ
# ============================================
log_info "Сохранение текущих изменений..."
git add .
git commit -m "update release" 2>/dev/null || log_warning "Нет изменений для коммита"
log_success "Изменения сохранены"

# ============================================
# 2. ЗАПУСКАЕМ СБОРКУ
# ============================================
log_info "Запуск сборки в режиме ${MODE}..."
./build.sh "$VERSION" "$MODE"

if [ $? -ne 0 ]; then
    log_error "Ошибка сборки"
    exit 1
fi

log_success "Сборка завершена"

# ============================================
# 3. СОХРАНЯЕМ ТЕКУЩУЮ ВЕТКУ
# ============================================
CURRENT_BRANCH=$(git branch --show-current)
log_info "Текущая ветка: ${CURRENT_BRANCH}"

# ============================================
# 4. ПЕРЕКЛЮЧАЕМСЯ НА РЕЛИЗНУЮ ВЕТКУ
# ============================================
if git show-ref --verify --quiet "refs/heads/${RELEASE_BRANCH}"; then
    log_info "Переключение на существующую ветку ${RELEASE_BRANCH}"
    git checkout "${RELEASE_BRANCH}"
else
    log_info "Создание новой ветки ${RELEASE_BRANCH}"
    git checkout -b "${RELEASE_BRANCH}"
fi

# ============================================
# 5. КОПИРУЕМ ПАПКУ BUILD (БЕЗ УДАЛЕНИЯ)
# ============================================
log_info "Копирование папки build..."

# Копируем файлы из build (поверх существующих)
if [ -d "${SCRIPT_DIR}/build" ]; then
    cp -r "${SCRIPT_DIR}/build/"* . 2>/dev/null
    cp -r "${SCRIPT_DIR}/build/".[!.]* . 2>/dev/null
    log_success "Папка build скопирована"
else
    log_warning "Папка build не найдена"
fi

# ============================================
# 6. СОЗДАЕМ ФАЙЛ С ИНФОРМАЦИЕЙ О РЕЛИЗЕ
# ============================================
cat > "RELEASE_${VERSION}.md" << EOF
# Релиз ${VERSION} (${MODE})

## Дата
$(date '+%Y-%m-%d %H:%M:%S')

## Режим сборки
${MODE_UPPER}

## Описание
$([ "$MODE" = "local" ] && echo "LOCAL режим: сборка без main.html и исключенных файлов" || echo "GLOBAL режим: полная сборка со всеми файлами")
EOF

# ============================================
# 7. КОММИТИМ В РЕЛИЗНУЮ ВЕТКУ
# ============================================
log_info "Коммит в релизную ветку..."
git add .
git commit -m "Release ${VERSION} (${MODE})

Режим: ${MODE}
Версия: ${VERSION}
Дата: $(date '+%Y-%m-%d %H:%M:%S')"

# ============================================
# 8. ОТПРАВЛЯЕМ В REMOTE
# ============================================
log_info "Отправка в remote..."
git push origin "${RELEASE_BRANCH}"

if [ $? -eq 0 ]; then
    log_success "Релиз успешно отправлен в ветку ${RELEASE_BRANCH}"
else
    log_error "Ошибка отправки в remote"
    exit 1
fi

# ============================================
# 9. ВОЗВРАЩАЕМСЯ В ИСХОДНУЮ ВЕТКУ
# ============================================
git checkout "${CURRENT_BRANCH}"
log_success "Возврат в ветку ${CURRENT_BRANCH}"

# ============================================
# ФИНАЛЬНЫЙ ОТЧЕТ
# ============================================
echo ""
echo "========================================="
echo -e "${GREEN}РЕЛИЗ ЗАВЕРШЕН${NC}"
echo "========================================="
echo -e "${BLUE}Ветка:${NC} ${RELEASE_BRANCH}"
echo -e "${BLUE}Режим:${NC} ${MODE_UPPER}"
echo -e "${BLUE}Версия:${NC} ${VERSION}"
if [ -d "${SCRIPT_DIR}/build" ]; then
    echo -e "${BLUE}Размер сборки:${NC} $(du -sh "${SCRIPT_DIR}/build" 2>/dev/null | cut -f1)"
fi
echo "========================================="