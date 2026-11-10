#!/bin/bash
# hercules.sh - Hercules server manager

# ============================================
# Configuration
# ============================================
PORT=${PORT:-6565}
HOST=${HOST:-localhost}
PID_FILE="app.pid"
LOG_DIR="logs"
LOG_COMBINED="$LOG_DIR/combined.log"
LOG_ERRORS="$LOG_DIR/errors.log"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

# Resolve absolute path to the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_COMBINED_PATH="$SCRIPT_DIR/$LOG_COMBINED"
LOG_ERRORS_PATH="$SCRIPT_DIR/$LOG_ERRORS"

# ============================================
# Colors
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# Functions
# ============================================
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
print_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

show_help() {
    echo ""
    echo "Hercules Server Manager"
    echo ""
    echo "Commands:"
    echo "  ./hercules.sh install              - Install dependencies"
    echo "  ./hercules.sh start                - Start the server"
    echo "  ./hercules.sh stop                 - Stop the server"
    echo "  ./hercules.sh restart              - Restart the server"
    echo "  ./hercules.sh status               - Show server status"
    echo "  ./hercules.sh update               - Update from git and restart"
    echo ""
    echo "  ./hercules.sh logs                 - Show all logs"
    echo "  ./hercules.sh logs-combined        - Show combined.log"
    echo "  ./hercules.sh logs-errors          - Show errors.log"
    echo "  ./hercules.sh logs-follow          - Follow combined log in real time"
    echo "  ./hercules.sh logs-follow-errors   - Follow error log in real time"
    echo "  ./hercules.sh logs-clear           - Clear logs"
    echo "  ./hercules.sh logs-size            - Show log sizes"
    echo ""
    echo "  ./hercules.sh clean                - Clean up"
    echo "  ./hercules.sh help                 - Show this help"
    echo ""
    echo "Examples:"
    echo "  PORT=3000 ./hercules.sh start"
    echo "  HOST=0.0.0.0 ./hercules.sh start"
    echo "  ./hercules.sh update               # update and restart"
    echo "  ./hercules.sh logs-errors          # errors only"
    echo "  ./hercules.sh logs-follow-errors   # errors in real time"
    echo ""
}

# Check Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        echo "Install Node.js 18+: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//')
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
    
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_error "Node.js version must be 18+, you have $NODE_VERSION"
        exit 1
    fi
    
    print_success "Node.js $(node -v)"
}

# Check npm
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm $(npm -v)"
}

# Set up .env
setup_env() {
    if [ ! -f "$ENV_FILE" ]; then
        print_info "Creating .env file..."
        
        if [ -f "$ENV_EXAMPLE" ]; then
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            print_success "Created $ENV_FILE from template"
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
            print_success "Created basic $ENV_FILE"
        fi
        
        print_warning "Edit $ENV_FILE if needed"
    else
        print_info ".env file already exists"
    fi
}

# Create log directory
setup_logs_dir() {
    if [ ! -d "$LOG_DIR" ]; then
        mkdir -p "$LOG_DIR"
        print_success "Created directory $LOG_DIR"
    fi
}

# Install dependencies
cmd_install() {
    print_info "Checking environment..."
    check_node
    check_npm
    
    print_info "Setting up .env..."
    setup_env
    
    print_info "Setting up log directory..."
    setup_logs_dir
    
    print_info "Installing dependencies..."
    npm install
    
    print_info "Checking for vulnerabilities..."
    npm audit fix --force
    
    print_success "Installation complete"
}

# Start the server (in background)
cmd_start() {
    check_node
    
    # Check if the server is already running
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            print_error "Server is already running (PID: $PID)"
            exit 1
        else
            rm -f "$PID_FILE"
        fi
    fi
    
    # Create log directory
    setup_logs_dir
    
    print_info "Starting server..."
    print_info "Log (combined): $LOG_COMBINED"
    print_info "Log (errors): $LOG_ERRORS"
    
    export PORT=$PORT
    export HOST=$HOST
    
    # Start the server, splitting stdout/stderr
    nohup node server.js >> "$LOG_COMBINED" 2>> "$LOG_ERRORS" &
    echo $! > "$PID_FILE"
    
    # Give it time to start
    sleep 3
    
    # Check if the server started
    if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        print_success "Server started (PID: $(cat $PID_FILE))"
        print_info "Port: $PORT, Host: $HOST"
        
        # Show the last log lines
        if [ -f "$LOG_COMBINED" ] && [ -s "$LOG_COMBINED" ]; then
            echo ""
            print_info "Latest entries in combined.log:"
            echo "----------------------------------------"
            tail -10 "$LOG_COMBINED"
            echo "----------------------------------------"
        fi
    else
        print_error "Failed to start server"
        if [ -f "$LOG_ERRORS" ] && [ -s "$LOG_ERRORS" ]; then
            echo ""
            print_info "Contents of errors.log:"
            echo "----------------------------------------"
            cat "$LOG_ERRORS"
            echo "----------------------------------------"
        fi
        exit 1
    fi
}

# Stop the server
cmd_stop() {
    print_info "Stopping server..."
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            
            # Wait for the process to exit
            for i in {1..10}; do
                if ! kill -0 "$PID" 2>/dev/null; then
                    break
                fi
                sleep 1
            done
            
            # Force kill if it did not exit
            if kill -0 "$PID" 2>/dev/null; then
                print_warning "Process did not exit, forcing kill"
                kill -9 "$PID"
            fi
            
            print_success "Server stopped (PID: $PID)"
            rm -f "$PID_FILE"
        else
            print_warning "Process not found"
            rm -f "$PID_FILE"
        fi
    else
        PID=$(pgrep -f "node server.js" 2>/dev/null)
        if [ -n "$PID" ]; then
            kill "$PID"
            print_success "Server stopped (PID: $PID)"
        else
            print_warning "No running process found"
        fi
    fi
}

# Restart
cmd_restart() {
    print_info "Restarting server..."
    cmd_stop
    sleep 2
    cmd_start
}


cmd_update() {
    print_info "=== SERVER UPDATE ==="
    echo ""
    
    # 1. Save current settings from .env
    print_info "Saving startup parameters..."
    
    SAVED_PORT=""
    SAVED_HOST=""
    
    if [ -f "$ENV_FILE" ]; then
        SAVED_PORT=$(grep -E "^PORT=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
        SAVED_HOST=$(grep -E "^HOST=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
        
        SAVED_PORT=$(echo "$SAVED_PORT" | cut -d'#' -f1 | xargs)
        SAVED_HOST=$(echo "$SAVED_HOST" | cut -d'#' -f1 | xargs)
        
        if [ -n "$SAVED_PORT" ]; then
            print_info "Found PORT: $SAVED_PORT"
        fi
        if [ -n "$SAVED_HOST" ]; then
            print_info "Found HOST: $SAVED_HOST"
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
    
    print_info "Using: PORT=$SAVED_PORT, HOST=$SAVED_HOST"
    
    # 1.5 Save config.json (if it exists)
    print_info "Saving config.json..."
    
    CONFIG_FILE="config.json"
    TEMP_CONFIG="/tmp/hercules_config_backup.json"
    
    if [ -f "$CONFIG_FILE" ]; then
        cp "$CONFIG_FILE" "$TEMP_CONFIG"
        print_success "config.json saved to a temporary file"
    else
        print_warning "config.json not found, will be created if needed"
    fi
    
    # 2. Stop the server
    print_info "Stopping server..."
    cmd_stop
    sleep 2
    
    # 3. Save current branch
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
    print_info "Current branch: $CURRENT_BRANCH"
    
    # 4. Save local changes in a temporary backup (important files only)
    print_info "Saving local configuration changes..."
    
    # Create a temporary backup directory
    BACKUP_DIR="/tmp/hercules_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Save important configuration files
    IMPORTANT_FILES=(
        "config.json"
        ".env"
        "hercules/config.json"
        "hercules/license.json"
        "hercules/public.pem"
    )
    
    for file in "${IMPORTANT_FILES[@]}"; do
        if [ -f "$file" ]; then
            mkdir -p "$BACKUP_DIR/$(dirname "$file")"
            cp "$file" "$BACKUP_DIR/$file"
            print_info "Saved: $file"
        fi
    done
    
    # 5. Git fetch + reset while preserving important files
    print_info "Running git fetch..."
    
    git fetch origin "$CURRENT_BRANCH"
    
    if [ $? -ne 0 ]; then
        print_error "git fetch failed"
        exit 1
    fi
    
    # Temporarily move important files before reset
    print_info "Temporarily moving configuration files..."
    
    for file in "${IMPORTANT_FILES[@]}"; do
        if [ -f "$file" ]; then
            mv "$file" "$BACKUP_DIR/${file}.moved" 2>/dev/null || true
        fi
    done
    
    # Run reset (important files are now out of the way)
    print_info "Applying changes (git reset --hard)..."
    git reset --hard "origin/$CURRENT_BRANCH"
    
    if [ $? -ne 0 ]; then
        print_error "git reset failed"
        exit 1
    fi
    
    # Restore important files
    print_info "Restoring configuration files..."
    
    for file in "${IMPORTANT_FILES[@]}"; do
        MOVED_FILE="$BACKUP_DIR/${file}.moved"
        if [ -f "$MOVED_FILE" ]; then
            mkdir -p "$(dirname "$file")"
            mv "$MOVED_FILE" "$file"
            print_info "Restored: $file"
        elif [ -f "$BACKUP_DIR/$file" ]; then
            mkdir -p "$(dirname "$file")"
            cp "$BACKUP_DIR/$file" "$file"
            print_info "Restored from backup: $file"
        fi
    done
    
    print_success "Git fetch + reset completed, configuration preserved"
    
    # 6. Update .env with saved parameters
    print_info "Restoring parameters in .env..."
    
    if [ -f "$ENV_FILE" ]; then
        # Check and update PORT
        if grep -q "^PORT=" "$ENV_FILE"; then
            sed -i "s/^PORT=.*/PORT=$SAVED_PORT/" "$ENV_FILE"
        else
            echo "PORT=$SAVED_PORT" >> "$ENV_FILE"
        fi
        
        # Check and update HOST
        if grep -q "^HOST=" "$ENV_FILE"; then
            sed -i "s/^HOST=.*/HOST=$SAVED_HOST/" "$ENV_FILE"
        else
            echo "HOST=$SAVED_HOST" >> "$ENV_FILE"
        fi
        
        print_success ".env updated: PORT=$SAVED_PORT, HOST=$SAVED_HOST"
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
        print_success ".env created"
    fi
    
    # 7. Update dependencies (only if package.json changed)
    if [ -f "package.json" ]; then
        if git diff HEAD@{1} --name-only 2>/dev/null | grep -q "package.json"; then
            print_info "Updating dependencies..."
            npm install --production
        else
            print_info "Dependencies unchanged, skipping npm install"
        fi
    fi
    
    # 8. Create a new version marker
    NEW_VERSION=$(date +%Y%m%d%H%M%S)
    echo $NEW_VERSION > ".current_version"
    print_success "New version: $NEW_VERSION"
    
    # 9. Clean up temporary files
    print_info "Cleaning up temporary files..."
    rm -rf "$BACKUP_DIR" 2>/dev/null || true
    rm -f "$TEMP_CONFIG" 2>/dev/null || true
    
    # 10. Start the server
    print_info "Starting server..."
    
    export PORT="$SAVED_PORT"
    export HOST="$SAVED_HOST"
    
    setup_logs_dir
    
    nohup node server.js >> "$LOG_COMBINED" 2>> "$LOG_ERRORS" &
    echo $! > "$PID_FILE"
    
    sleep 3
    
    if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        print_success "Server started (PID: $(cat $PID_FILE))"
        print_info "Port: $PORT, Host: $HOST"
        
        if [ -f "$LOG_COMBINED" ] && [ -s "$LOG_COMBINED" ]; then
            echo ""
            print_info "Latest entries in combined.log:"
            echo "----------------------------------------"
            tail -5 "$LOG_COMBINED"
            echo "----------------------------------------"
        fi
    else
        print_error "Failed to start server"
        if [ -f "$LOG_ERRORS" ] && [ -s "$LOG_ERRORS" ]; then
            echo ""
            print_info "Contents of errors.log:"
            echo "----------------------------------------"
            cat "$LOG_ERRORS"
            echo "----------------------------------------"
        fi
        exit 1
    fi
    
    print_success "=== UPDATE COMPLETE ==="
}

# Status
cmd_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            print_success "Server is running (PID: $PID)"
            echo ""
            ps -p "$PID" -o pid,ppid,state,pcpu,pmem,etime,command | grep -v COMMAND
            echo ""
            
            # Show log information
            cmd_logs_size
            
            # Show version if available
            if [ -f ".current_version" ]; then
                VERSION=$(cat ".current_version")
                echo ""
                print_info "Version: $VERSION"
            fi
        else
            print_error "Server is not running (PID file exists, but process not found)"
        fi
    else
        PID=$(pgrep -f "node server.js" 2>/dev/null)
        if [ -n "$PID" ]; then
            print_warning "Server is running, but without a PID file (PID: $PID)"
        else
            print_error "Server is not running"
        fi
    fi
}

# Show all logs
cmd_logs() {
    echo ""
    print_info "=== LOGS ==="
    echo ""
    cmd_logs_combined
    echo ""
    cmd_logs_errors
}

# Show combined.log
cmd_logs_combined() {
    if [ -f "$LOG_COMBINED" ]; then
        if [ -s "$LOG_COMBINED" ]; then
            print_info "Last 50 lines of combined.log:"
            echo "----------------------------------------"
            tail -50 "$LOG_COMBINED"
            echo "----------------------------------------"
            print_info "Total lines: $(wc -l < "$LOG_COMBINED")"
        else
            print_warning "combined.log is empty"
        fi
    else
        print_error "combined.log not found: $LOG_COMBINED"
        print_info "Start the server first: ./hercules.sh start"
    fi
}

# Show errors.log
cmd_logs_errors() {
    if [ -f "$LOG_ERRORS" ]; then
        if [ -s "$LOG_ERRORS" ]; then
            print_info "Last 50 lines of errors.log:"
            echo "----------------------------------------"
            tail -50 "$LOG_ERRORS"
            echo "----------------------------------------"
            print_info "Total lines: $(wc -l < "$LOG_ERRORS")"
        else
            print_warning "errors.log is empty (no errors)"
        fi
    else
        print_error "errors.log not found: $LOG_ERRORS"
    fi
}

# Follow logs in real time (combined)
cmd_logs_follow() {
    if [ -f "$LOG_COMBINED" ]; then
        print_info "Following logs in real time (combined.log), Ctrl+C to exit"
        echo "----------------------------------------"
        tail -f "$LOG_COMBINED"
    else
        print_error "combined.log not found"
        print_info "Start the server first: ./hercules.sh start"
    fi
}

# Follow error logs in real time
cmd_logs_follow_errors() {
    if [ -f "$LOG_ERRORS" ]; then
        print_info "Following error logs in real time (errors.log), Ctrl+C to exit"
        echo "----------------------------------------"
        tail -f "$LOG_ERRORS"
    else
        print_error "errors.log not found"
    fi
}

# Clear logs
cmd_logs_clear() {
    print_info "Clearing logs..."
    
    if [ -f "$LOG_COMBINED" ]; then
        > "$LOG_COMBINED"
        print_success "Cleared combined.log"
    fi
    
    if [ -f "$LOG_ERRORS" ]; then
        > "$LOG_ERRORS"
        print_success "Cleared errors.log"
    fi
    
    # Clear addon logs
    if [ -d "addons" ]; then
        for addon in blender sca sast fuzz; do
            if [ -f "addons/$addon/log.txt" ]; then
                > "addons/$addon/log.txt"
                print_success "Cleared addons/$addon/log.txt"
            fi
        done
    fi
    
    print_success "Logs cleared"
}

# Show log sizes
cmd_logs_size() {
    echo ""
    print_info "Log sizes:"
    echo "----------------------------------------"
    
    if [ -f "$LOG_COMBINED" ]; then
        SIZE=$(du -h "$LOG_COMBINED" | cut -f1)
        LINES=$(wc -l < "$LOG_COMBINED")
        echo "  combined.log: $SIZE ($LINES lines)"
    else
        echo "  combined.log: does not exist"
    fi
    
    if [ -f "$LOG_ERRORS" ]; then
        SIZE=$(du -h "$LOG_ERRORS" | cut -f1)
        LINES=$(wc -l < "$LOG_ERRORS")
        echo "  errors.log: $SIZE ($LINES lines)"
    else
        echo "  errors.log: does not exist"
    fi
    
    # Addon log sizes
    if [ -d "addons" ]; then
        for addon in blender sca sast fuzz; do
            if [ -f "addons/$addon/log.txt" ]; then
                SIZE=$(du -h "addons/$addon/log.txt" | cut -f1)
                LINES=$(wc -l < "addons/$addon/log.txt")
                echo "  addons/$addon/log.txt: $SIZE ($LINES lines)"
            fi
        done
    fi
    echo "----------------------------------------"
}

# Clean up
cmd_clean() {
    print_info "Cleaning up the project..."
    
    if [ -d "node_modules" ]; then
        rm -rf node_modules
        print_success "Removed node_modules"
    fi
    
    if [ -f "package-lock.json" ]; then
        rm -f package-lock.json
        print_success "Removed package-lock.json"
    fi
    
    if [ -f "$PID_FILE" ]; then
        rm -f "$PID_FILE"
        print_success "Removed PID file"
    fi
    
    if [ -d "$LOG_DIR" ]; then
        rm -rf "$LOG_DIR"
        print_success "Removed log directory"
    fi
    
    # Clear addon logs
    if [ -d "addons" ]; then
        for addon in blender sca sast fuzz; do
            if [ -f "addons/$addon/log.txt" ]; then
                rm -f "addons/$addon/log.txt"
                print_success "Removed addons/$addon/log.txt"
            fi
        done
    fi
    
    print_success "Cleanup complete"
}

# ============================================
# Main command handler
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
            print_error "Unknown command: $1"
            show_help
        fi
        exit 1
        ;;
esac