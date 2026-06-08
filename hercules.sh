#!/bin/bash
# hercules.sh - Управление сервером Hercules

# ============================================
# Конфигурация
# ============================================
PORT=${PORT:-6565}
HOST=${HOST:-localhost}
PID_FILE="app.pid"
LOG_DIR="logs"
LOG_COMBINED="$LOG_DIR/combined.log"
LOG_ERRORS="$LOG_DIR/errors.log"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

# Определяем абсолютный путь к директории скрипта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_COMBINED_PATH="$SCRIPT_DIR/$LOG_COMBINED"
LOG_ERRORS_PATH="$SCRIPT_DIR/$LOG_ERRORS"

# ============================================
# Цвета
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# Функции
# ============================================
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
print_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

show_help() {
    echo ""
    echo "Hercules Server Manager"
    echo ""
    echo "Команды:"
    echo "  ./hercules.sh install              - Установка зависимостей"
    echo "  ./hercules.sh start                - Запуск сервера"
    echo "  ./hercules.sh stop                 - Остановка сервера"
    echo "  ./hercules.sh restart              - Перезапуск сервера"
    echo "  ./hercules.sh status               - Статус сервера"
    echo "  ./hercules.sh update               - Обновление из git + перезапуск"
    echo ""
    echo "  ./hercules.sh logs                 - Показать все логи"
    echo "  ./hercules.sh logs-combined        - Показать combined.log"
    echo "  ./hercules.sh logs-errors          - Показать errors.log"
    echo "  ./hercules.sh logs-follow          - Логи в реальном времени (combined)"
    echo "  ./hercules.sh logs-follow-errors   - Логи ошибок в реальном времени"
    echo "  ./hercules.sh logs-clear           - Очистить логи"
    echo "  ./hercules.sh logs-size            - Показать размер логов"
    echo ""
    echo "  ./hercules.sh clean                - Очистка"
    echo "  ./hercules.sh help                 - Эта справка"
    echo ""
    echo "Примеры:"
    echo "  PORT=3000 ./hercules.sh start"
    echo "  HOST=0.0.0.0 ./hercules.sh start"
    echo "  ./hercules.sh update               # обновить и перезапустить"
    echo "  ./hercules.sh logs-errors          # только ошибки"
    echo "  ./hercules.sh logs-follow-errors   # ошибки в реальном времени"
    echo ""
}

# Проверка Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js не установлен"
        echo "Установите Node.js 18+: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//')
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
    
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_error "Node.js версия должна быть 18+, у вас $NODE_VERSION"
        exit 1
    fi
    
    print_success "Node.js $(node -v)"
}

# Проверка npm
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm не установлен"
        exit 1
    fi
    print_success "npm $(npm -v)"
}

# Настройка .env
setup_env() {
    if [ ! -f "$ENV_FILE" ]; then
        print_info "Создание .env файла..."
        
        if [ -f "$ENV_EXAMPLE" ]; then
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            print_success "Создан $ENV_FILE из шаблона"
        else
            cat > "$ENV_FILE" << EOF
# Hercules Server Configuration
PORT=$PORT
HOST=$HOST
NODE_ENV=production
GITHUB_TOKEN=
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=15
MAX_FILE_SIZE=104857600
DOWNLOAD_DIR=./downloads
CACHE_DIR=./cache
LOG_DIR=./logs
STORAGE_DIR=./storage
EXTRACTED_DIR=./extracted
TEMP_DIR=./temp
VERBOSE=false
EOF
            print_success "Создан базовый $ENV_FILE"
        fi
        
        print_warning "Отредактируйте $ENV_FILE при необходимости"
    else
        print_info ".env файл уже существует"
    fi
}

# Создание директории для логов
setup_logs_dir() {
    if [ ! -d "$LOG_DIR" ]; then
        mkdir -p "$LOG_DIR"
        print_success "Создана директория $LOG_DIR"
    fi
}

# Установка зависимостей
cmd_install() {
    print_info "Проверка окружения..."
    check_node
    check_npm
    
    print_info "Настройка .env..."
    setup_env
    
    print_info "Настройка директории логов..."
    setup_logs_dir
    
    print_info "Установка зависимостей..."
    npm install
    
    print_info "Проверка уязвимостей..."
    npm audit fix --force
    
    print_success "Установка завершена"
}

# Запуск сервера (в фоне)
cmd_start() {
    check_node
    
    # Проверяем, не запущен ли уже сервер
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            print_error "Сервер уже запущен (PID: $PID)"
            exit 1
        else
            rm -f "$PID_FILE"
        fi
    fi
    
    # Создаём директорию для логов
    setup_logs_dir
    
    print_info "Запуск сервера..."
    print_info "Лог (combined): $LOG_COMBINED"
    print_info "Лог (errors): $LOG_ERRORS"
    
    export PORT=$PORT
    export HOST=$HOST
    
    # Запускаем сервер, разделяя stdout/stderr
    nohup node server.js >> "$LOG_COMBINED" 2>> "$LOG_ERRORS" &
    echo $! > "$PID_FILE"
    
    # Даём время на запуск
    sleep 3
    
    # Проверяем, запустился ли сервер
    if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        print_success "Сервер запущен (PID: $(cat $PID_FILE))"
        print_info "Порт: $PORT, Хост: $HOST"
        
        # Показываем последние строки лога
        if [ -f "$LOG_COMBINED" ] && [ -s "$LOG_COMBINED" ]; then
            echo ""
            print_info "Последние записи в combined.log:"
            echo "----------------------------------------"
            tail -10 "$LOG_COMBINED"
            echo "----------------------------------------"
        fi
    else
        print_error "Ошибка запуска сервера"
        if [ -f "$LOG_ERRORS" ] && [ -s "$LOG_ERRORS" ]; then
            echo ""
            print_info "Содержимое errors.log:"
            echo "----------------------------------------"
            cat "$LOG_ERRORS"
            echo "----------------------------------------"
        fi
        exit 1
    fi
}

# Остановка сервера
cmd_stop() {
    print_info "Остановка сервера..."
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            
            # Ждём завершения процесса
            for i in {1..10}; do
                if ! kill -0 "$PID" 2>/dev/null; then
                    break
                fi
                sleep 1
            done
            
            # Принудительно убиваем, если не завершился
            if kill -0 "$PID" 2>/dev/null; then
                print_warning "Процесс не завершился, принудительное убийство"
                kill -9 "$PID"
            fi
            
            print_success "Сервер остановлен (PID: $PID)"
            rm -f "$PID_FILE"
        else
            print_warning "Процесс не найден"
            rm -f "$PID_FILE"
        fi
    else
        PID=$(pgrep -f "node server.js" 2>/dev/null)
        if [ -n "$PID" ]; then
            kill "$PID"
            print_success "Сервер остановлен (PID: $PID)"
        else
            print_warning "Запущенный процесс не найден"
        fi
    fi
}

# Перезапуск
cmd_restart() {
    print_info "Перезапуск сервера..."
    cmd_stop
    sleep 2
    cmd_start
}


cmd_update() {
    print_info "=== ОБНОВЛЕНИЕ СЕРВЕРА ==="
    echo ""
    
    # 1. Сохраняем текущие параметры из .env файла
    print_info "Сохранение параметров запуска..."
    
    SAVED_PORT=""
    SAVED_HOST=""
    
    if [ -f "$ENV_FILE" ]; then
        SAVED_PORT=$(grep -E "^PORT=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
        SAVED_HOST=$(grep -E "^HOST=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
        
        SAVED_PORT=$(echo "$SAVED_PORT" | cut -d'#' -f1 | xargs)
        SAVED_HOST=$(echo "$SAVED_HOST" | cut -d'#' -f1 | xargs)
        
        if [ -n "$SAVED_PORT" ]; then
            print_info "Найден PORT: $SAVED_PORT"
        fi
        if [ -n "$SAVED_HOST" ]; then
            print_info "Найден HOST: $SAVED_HOST"
        fi
    fi
    
    if [ -z "$SAVED_PORT" ] && [ -n "$PORT" ]; then
        SAVED_PORT="$PORT"
    fi
    
    if [ -z "$SAVED_HOST" ] && [ -n "$HOST" ]; then
        SAVED_HOST="$HOST"
    fi
    
    SAVED_PORT="${SAVED_PORT:-6565}"
    SAVED_HOST="${SAVED_HOST:-localhost}"
    
    print_info "Будут использованы: PORT=$SAVED_PORT, HOST=$SAVED_HOST"
    
    # 2. Останавливаем сервер
    print_info "Остановка сервера..."
    cmd_stop
    sleep 2
    
    # 3. Git fetch + reset (вместо pull) - только обновления, без локальных изменений
    print_info "Выполнение git fetch..."
    
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
    
    # Скачиваем изменения
    git fetch origin "$CURRENT_BRANCH"
    
    if [ $? -ne 0 ]; then
        print_error "Ошибка git fetch"
        exit 1
    fi
    
    # Применяем изменения (сбрасываем локальные изменения)
    print_info "Применение изменений (git reset --hard)..."
    git reset --hard "origin/$CURRENT_BRANCH"
    
    if [ $? -ne 0 ]; then
        print_error "Ошибка git reset"
        exit 1
    fi
    
    print_success "Git fetch + reset выполнен успешно"
    
    # 4. Обновляем .env файл
    print_info "Восстановление параметров в .env..."
    
    if [ -f "$ENV_FILE" ]; then
        if grep -q "^PORT=" "$ENV_FILE"; then
            sed -i "s/^PORT=.*/PORT=$SAVED_PORT/" "$ENV_FILE"
        else
            echo "PORT=$SAVED_PORT" >> "$ENV_FILE"
        fi
        
        if grep -q "^HOST=" "$ENV_FILE"; then
            sed -i "s/^HOST=.*/HOST=$SAVED_HOST/" "$ENV_FILE"
        else
            echo "HOST=$SAVED_HOST" >> "$ENV_FILE"
        fi
        
        print_success ".env обновлён: PORT=$SAVED_PORT, HOST=$SAVED_HOST"
    else
        cat > "$ENV_FILE" << EOF
        # Hercules Server Configuration
        PORT=$SAVED_PORT
        HOST=$SAVED_HOST
        NODE_ENV=production
        GITHUB_TOKEN=
        RATE_LIMIT_REQUESTS=100
        RATE_LIMIT_WINDOW=15
        MAX_FILE_SIZE=104857600
        LOG_DIR=./logs
EOF
        print_success ".env создан"
    fi
    
    # 5. Обновляем зависимости
    if [ -f "package.json" ]; then
        if git diff HEAD@{1} --name-only | grep -q "package.json"; then
            print_info "Обновление зависимостей..."
            npm install --production
        else
            print_info "Зависимости не изменились"
        fi
    fi
    
    # 6. Создаём новую версию
    NEW_VERSION=$(date +%Y%m%d%H%M%S)
    echo $NEW_VERSION > ".current_version"
    print_success "Новая версия: $NEW_VERSION"
    
    # 7. Запускаем сервер
    print_info "Запуск сервера..."
    
    export PORT="$SAVED_PORT"
    export HOST="$SAVED_HOST"
    
    setup_logs_dir
    
    nohup node server.js >> "$LOG_COMBINED" 2>> "$LOG_ERRORS" &
    echo $! > "$PID_FILE"
    
    sleep 3
    
    if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        print_success "Сервер запущен (PID: $(cat $PID_FILE))"
        print_info "Порт: $PORT, Хост: $HOST"
        
        if [ -f "$LOG_COMBINED" ] && [ -s "$LOG_COMBINED" ]; then
            echo ""
            print_info "Последние записи в combined.log:"
            echo "----------------------------------------"
            tail -5 "$LOG_COMBINED"
            echo "----------------------------------------"
        fi
    else
        print_error "Ошибка запуска сервера"
        if [ -f "$LOG_ERRORS" ] && [ -s "$LOG_ERRORS" ]; then
            echo ""
            print_info "Содержимое errors.log:"
            echo "----------------------------------------"
            cat "$LOG_ERRORS"
            echo "----------------------------------------"
        fi
        exit 1
    fi
    
    print_success "=== ОБНОВЛЕНИЕ ЗАВЕРШЕНО ==="
}

# Статус
cmd_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            print_success "Сервер запущен (PID: $PID)"
            echo ""
            ps -p "$PID" -o pid,ppid,state,pcpu,pmem,etime,command | grep -v COMMAND
            echo ""
            
            # Показываем информацию о логах
            cmd_logs_size
            
            # Показываем версию если есть
            if [ -f ".current_version" ]; then
                VERSION=$(cat ".current_version")
                echo ""
                print_info "Версия: $VERSION"
            fi
        else
            print_error "Сервер не запущен (PID файл существует, но процесс не найден)"
        fi
    else
        PID=$(pgrep -f "node server.js" 2>/dev/null)
        if [ -n "$PID" ]; then
            print_warning "Сервер запущен, но без PID файла (PID: $PID)"
        else
            print_error "Сервер не запущен"
        fi
    fi
}

# Показать все логи
cmd_logs() {
    echo ""
    print_info "=== LOGS ==="
    echo ""
    cmd_logs_combined
    echo ""
    cmd_logs_errors
}

# Показать combined.log
cmd_logs_combined() {
    if [ -f "$LOG_COMBINED" ]; then
        if [ -s "$LOG_COMBINED" ]; then
            print_info "Последние 50 строк combined.log:"
            echo "----------------------------------------"
            tail -50 "$LOG_COMBINED"
            echo "----------------------------------------"
            print_info "Всего строк: $(wc -l < "$LOG_COMBINED")"
        else
            print_warning "combined.log пуст"
        fi
    else
        print_error "combined.log не найден: $LOG_COMBINED"
        print_info "Сначала запустите сервер: ./hercules.sh start"
    fi
}

# Показать errors.log
cmd_logs_errors() {
    if [ -f "$LOG_ERRORS" ]; then
        if [ -s "$LOG_ERRORS" ]; then
            print_info "Последние 50 строк errors.log:"
            echo "----------------------------------------"
            tail -50 "$LOG_ERRORS"
            echo "----------------------------------------"
            print_info "Всего строк: $(wc -l < "$LOG_ERRORS")"
        else
            print_warning "errors.log пуст (ошибок нет)"
        fi
    else
        print_error "errors.log не найден: $LOG_ERRORS"
    fi
}

# Логи в реальном времени (combined)
cmd_logs_follow() {
    if [ -f "$LOG_COMBINED" ]; then
        print_info "Логи в реальном времени (combined.log), Ctrl+C для выхода"
        echo "----------------------------------------"
        tail -f "$LOG_COMBINED"
    else
        print_error "combined.log не найден"
        print_info "Сначала запустите сервер: ./hercules.sh start"
    fi
}

# Логи ошибок в реальном времени
cmd_logs_follow_errors() {
    if [ -f "$LOG_ERRORS" ]; then
        print_info "Логи ошибок в реальном времени (errors.log), Ctrl+C для выхода"
        echo "----------------------------------------"
        tail -f "$LOG_ERRORS"
    else
        print_error "errors.log не найден"
    fi
}

# Очистить логи
cmd_logs_clear() {
    print_info "Очистка логов..."
    
    if [ -f "$LOG_COMBINED" ]; then
        > "$LOG_COMBINED"
        print_success "Очищен combined.log"
    fi
    
    if [ -f "$LOG_ERRORS" ]; then
        > "$LOG_ERRORS"
        print_success "Очищен errors.log"
    fi
    
    # Очищаем логи addons
    if [ -d "addons" ]; then
        for addon in blender sca sast fuzz; do
            if [ -f "addons/$addon/log.txt" ]; then
                > "addons/$addon/log.txt"
                print_success "Очищен addons/$addon/log.txt"
            fi
        done
    fi
    
    print_success "Логи очищены"
}

# Показать размер логов
cmd_logs_size() {
    echo ""
    print_info "Размер логов:"
    echo "----------------------------------------"
    
    if [ -f "$LOG_COMBINED" ]; then
        SIZE=$(du -h "$LOG_COMBINED" | cut -f1)
        LINES=$(wc -l < "$LOG_COMBINED")
        echo "  combined.log: $SIZE ($LINES строк)"
    else
        echo "  combined.log: не существует"
    fi
    
    if [ -f "$LOG_ERRORS" ]; then
        SIZE=$(du -h "$LOG_ERRORS" | cut -f1)
        LINES=$(wc -l < "$LOG_ERRORS")
        echo "  errors.log: $SIZE ($LINES строк)"
    else
        echo "  errors.log: не существует"
    fi
    
    # Размер логов addons
    if [ -d "addons" ]; then
        for addon in blender sca sast fuzz; do
            if [ -f "addons/$addon/log.txt" ]; then
                SIZE=$(du -h "addons/$addon/log.txt" | cut -f1)
                LINES=$(wc -l < "addons/$addon/log.txt")
                echo "  addons/$addon/log.txt: $SIZE ($LINES строк)"
            fi
        done
    fi
    echo "----------------------------------------"
}

# Очистка
cmd_clean() {
    print_info "Очистка проекта..."
    
    if [ -d "node_modules" ]; then
        rm -rf node_modules
        print_success "Удалены node_modules"
    fi
    
    if [ -f "package-lock.json" ]; then
        rm -f package-lock.json
        print_success "Удален package-lock.json"
    fi
    
    if [ -f "$PID_FILE" ]; then
        rm -f "$PID_FILE"
        print_success "Удален PID файл"
    fi
    
    if [ -d "$LOG_DIR" ]; then
        rm -rf "$LOG_DIR"
        print_success "Удалена директория логов"
    fi
    
    # Очищаем логи addons
    if [ -d "addons" ]; then
        for addon in blender sca sast fuzz; do
            if [ -f "addons/$addon/log.txt" ]; then
                rm -f "addons/$addon/log.txt"
                print_success "Удален addons/$addon/log.txt"
            fi
        done
    fi
    
    print_success "Очистка завершена"
}

# ============================================
# Главный обработчик команд
# ============================================
case "$1" in
    install)
        cmd_install
        ;;
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    update)
        cmd_update
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs
        ;;
    logs-combined)
        cmd_logs_combined
        ;;
    logs-errors)
        cmd_logs_errors
        ;;
    logs-follow)
        cmd_logs_follow
        ;;
    logs-follow-errors)
        cmd_logs_follow_errors
        ;;
    logs-clear)
        cmd_logs_clear
        ;;
    logs-size)
        cmd_logs_size
        ;;
    clean)
        cmd_clean
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -z "$1" ]; then
            show_help
        else
            print_error "Неизвестная команда: $1"
            show_help
        fi
        exit 1
        ;;
esac