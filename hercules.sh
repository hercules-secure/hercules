#!/bin/bash
# hercules.sh - Управление сервером Hercules

# ============================================
# Конфигурация
# ============================================
PORT=${PORT:-6565}
HOST=${HOST:-localhost}
PID_FILE="app.pid"
LOG_FILE="app.log"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

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
    echo "  ./hercules.sh install         - Установка зависимостей"
    echo "  ./hercules.sh start           - Запуск сервера"
    echo "  ./hercules.sh stop            - Остановка сервера"
    echo "  ./hercules.sh restart         - Перезапуск сервера"
    echo "  ./hercules.sh status          - Статус сервера"
    echo "  ./hercules.sh logs            - Показать логи"
    echo "  ./hercules.sh logs-follow     - Логи в реальном времени"
    echo "  ./hercules.sh clean           - Очистка"
    echo "  ./hercules.sh help            - Эта справка"
    echo ""
    echo "Примеры:"
    echo "  PORT=3000 ./hercules.sh start"
    echo "  HOST=0.0.0.0 ./hercules.sh start"
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

# Установка зависимостей
cmd_install() {
    print_info "Проверка окружения..."
    check_node
    check_npm
    
    print_info "Настройка .env..."
    setup_env
    
    print_info "Установка зависимостей..."
    npm install
    
    print_info "Проверка уязвимостей..."
    npm audit fix --force
    
    print_success "Установка завершена"
}

# Запуск сервера (в фоне)
cmd_start() {
    check_node
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            print_error "Сервер уже запущен (PID: $PID)"
            exit 1
        else
            rm -f "$PID_FILE"
        fi
    fi
    
    print_info "Запуск сервера..."
    
    export PORT=$PORT
    export HOST=$HOST
    
    nohup node server.js > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    
    sleep 2
    
    if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        print_success "Сервер запущен (PID: $(cat $PID_FILE))"
        print_info "Порт: $PORT, Хост: $HOST"
        print_info "Логи: $LOG_FILE"
    else
        print_error "Ошибка запуска сервера"
        cat "$LOG_FILE"
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
    cmd_stop
    sleep 2
    cmd_start
}

# Статус
cmd_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            print_success "Сервер запущен (PID: $PID)"
            ps -p "$PID" -o pid,ppid,state,pcpu,pmem,etime,command | grep -v COMMAND
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

# Показать логи
cmd_logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -50 "$LOG_FILE"
    else
        print_error "Лог файл не найден"
    fi
}

# Логи в реальном времени
cmd_logs_follow() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        print_error "Лог файл не найден"
    fi
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
    
    if [ -f "$LOG_FILE" ]; then
        rm -f "$LOG_FILE"
        print_success "Удалены логи"
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
    status)
        cmd_status
        ;;
    logs)
        cmd_logs
        ;;
    logs-follow)
        cmd_logs_follow
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