# Makefile для Hercules Personal Platform
# Команды: make install, make run, make run-background, make stop, make restart, make logs, make clean, make help

# Переменные
NODE := node
NPM := npm
PORT ?= 6565
HOST ?= localhost
ENV_FILE := .env
ENV_EXAMPLE := .env.example

# Цвета для вывода
GREEN := \033[0;32m
RED := \033[0;31m
YELLOW := \033[0;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# ============================================
# Основные команды
# ============================================

.PHONY: help install check-env setup-env run run-background run-daemon stop restart logs logs-follow status-server clean audit-fix

help:
	@echo "$(BLUE)Hercules Personal Platform - Makefile$(NC)"
	@echo ""
	@echo "$(GREEN)Доступные команды:$(NC)"
	@echo "  $(YELLOW)make install$(NC)         - Установка зависимостей, настройка окружения и аудит"
	@echo "  $(YELLOW)make run$(NC)             - Запуск сервера (в foreground)"
	@echo "  $(YELLOW)make run-background$(NC)  - Запуск сервера в фоновом режиме"
	@echo "  $(YELLOW)make stop$(NC)            - Остановка сервера"
	@echo "  $(YELLOW)make restart$(NC)         - Перезапуск сервера"
	@echo "  $(YELLOW)make logs$(NC)            - Просмотр последних логов"
	@echo "  $(YELLOW)make logs-follow$(NC)     - Просмотр логов в реальном времени"
	@echo "  $(YELLOW)make status-server$(NC)   - Проверка статуса сервера"
	@echo "  $(YELLOW)make clean$(NC)           - Очистка временных файлов и зависимостей"
	@echo "  $(YELLOW)make audit$(NC)           - Проверка уязвимостей"
	@echo "  $(YELLOW)make help$(NC)            - Показать эту справку"
	@echo ""
	@echo "$(GREEN)Примеры:$(NC)"
	@echo "  PORT=3000 HOST=0.0.0.0 make run    - Запуск на порту 3000"
	@echo "  make install                       - Первая установка проекта"
	@echo "  make run-background                - Запуск в фоне"
	@echo "  make stop                          - Остановить фоновый процесс"

# ============================================
# Установка
# ============================================

install: check-node check-npm setup-env install-deps audit-fix run-background
	@echo "$(GREEN)✅ Установка завершена!$(NC)"
	@echo "$(YELLOW)Для запуска выполните: make run$(NC)"

check-node:
	@echo "$(BLUE)🔍 Проверка Node.js...$(NC)"
	@command -v $(NODE) >/dev/null 2>&1 || { \
		echo "$(RED)❌ Node.js не установлен. Пожалуйста, установите Node.js (версия 18+)$(NC)"; \
		exit 1; \
	}
	@NODE_VERSION=$$($(NODE) -v | sed 's/v//'); \
	MAJOR_VERSION=$$(echo $$NODE_VERSION | cut -d. -f1); \
	if [ $$MAJOR_VERSION -lt 18 ]; then \
		echo "$(RED)❌ Node.js версия должна быть 18 или выше. Установлена: $$NODE_VERSION$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✅ Node.js версия: $$($(NODE) -v)$(NC)"

check-npm:
	@echo "$(BLUE)🔍 Проверка npm...$(NC)"
	@command -v $(NPM) >/dev/null 2>&1 || { \
		echo "$(RED)npm не установлен$(NC)"; \
		exit 1; \
	}
	@echo "$(GREEN)npm версия: $$($(NPM) -v)$(NC)"

setup-env:
	@echo "$(BLUE)🔧 Настройка .env файла...$(NC)"
	@if [ ! -f $(ENV_FILE) ]; then \
		if [ -f $(ENV_EXAMPLE) ]; then \
			cp $(ENV_EXAMPLE) $(ENV_FILE); \
			echo "$(GREEN)Создан $(ENV_FILE) из шаблона$(NC)"; \
		else \
			echo "$(YELLOW)Шаблон .env.example не найден, создаю базовый .env$(NC)"; \
			echo "# Hercules Personal Platform" > $(ENV_FILE); \
			echo "PORT=$(PORT)" >> $(ENV_FILE); \
			echo "HOST=$(HOST)" >> $(ENV_FILE); \
			echo "NODE_ENV=production" >> $(ENV_FILE); \
			echo "GITHUB_TOKEN=" >> $(ENV_FILE); \
			echo "RATE_LIMIT_REQUESTS=100" >> $(ENV_FILE); \
			echo "RATE_LIMIT_WINDOW=15" >> $(ENV_FILE); \
			echo "MAX_FILE_SIZE=104857600" >> $(ENV_FILE); \
			echo "DOWNLOAD_DIR=./downloads" >> $(ENV_FILE); \
			echo "CACHE_DIR=./cache" >> $(ENV_FILE); \
			echo "LOG_DIR=./logs" >> $(ENV_FILE); \
			echo "STORAGE_DIR=./storage" >> $(ENV_FILE); \
			echo "EXTRACTED_DIR=./extracted" >> $(ENV_FILE); \
			echo "TEMP_DIR=./temp" >> $(ENV_FILE); \
			echo "VERBOSE=false" >> $(ENV_FILE); \
			echo "$(GREEN)Создан базовый $(ENV_FILE)$(NC)"; \
		fi; \
		echo "$(YELLOW)Проверьте и отредактируйте $(ENV_FILE) при необходимости$(NC)"; \
	else \
		echo "$(GREEN).env файл уже существует$(NC)"; \
	fi

install-deps:
	@echo "$(BLUE)Установка зависимостей...$(NC)"
	@$(NPM) install
	@echo "$(GREEN)Зависимости установлены$(NC)"

audit-fix:
	@echo "$(BLUE)🔍 Проверка и исправление уязвимостей...$(NC)"
	@echo "$(YELLOW)📋 Проверка уязвимостей...$(NC)"; \
	$(NPM) audit --json > audit-report.json 2>/dev/null || true; \
	if [ -f audit-report.json ] && [ -s audit-report.json ]; then \
		AUDIT_SIZE=$$(wc -c < audit-report.json | tr -d ' '); \
		if [ $$AUDIT_SIZE -gt 100 ]; then \
			echo "$(YELLOW)Найдены уязвимости. Исправление...$(NC)"; \
			$(NPM) audit fix || true; \
			echo "$(GREEN)Уязвимости исправлены (где возможно)$(NC)"; \
			echo "$(YELLOW)Оставшиеся критические уязвимости:$(NC)"; \
			$(NPM) audit --parseable 2>/dev/null | grep -E "high|critical" || echo "$(GREEN)  ✅ Нет критических уязвимостей$(NC)"; \
		else \
			echo "$(GREEN)Уязвимостей не найдено$(NC)"; \
		fi; \
	else \
		echo "$(GREEN)Уязвимостей не найдено$(NC)"; \
	fi; \
	rm -f audit-report.json
	@echo "$(GREEN)Аудит зависимостей завершен$(NC)"

# ============================================
# Запуск
# ============================================

run: check-env
	@echo "$(BLUE)Запуск сервера...$(NC)"
	@$(NODE) server.js

run-background: check-env
	@echo "$(BLUE)Запуск сервера в фоновом режиме...$(NC)"
	@nohup $(NODE) server.js > app.log 2>&1 & echo $$! > app.pid
	@echo "$(GREEN)Сервер запущен в фоне. PID: $$(cat app.pid)$(NC)"
	@echo "$(GREEN)Логи пишутся в app.log$(NC)"
	@echo "$(YELLOW)Для остановки выполните: make stop$(NC)"
	@echo "$(YELLOW)Для просмотра логов: make logs$(NC)"

stop:
	@echo "$(BLUE)Остановка сервера...$(NC)"
	@if [ -f app.pid ]; then \
		PID=$$(cat app.pid); \
		if kill -0 $$PID 2>/dev/null; then \
			kill $$PID; \
			echo "$(GREEN)Сервер с PID $$PID остановлен$(NC)"; \
			rm -f app.pid; \
		else \
			echo "$(YELLOW)Процесс с PID $$PID не найден$(NC)"; \
			rm -f app.pid; \
		fi \
	else \
		PID=$$(ps aux | grep "node server.js" | grep -v grep | awk '{print $$2}'); \
		if [ -n "$$PID" ]; then \
			kill $$PID; \
			echo "$(GREEN)Сервер с PID $$PID остановлен$(NC)"; \
		else \
			echo "$(YELLOW)Запущенный процесс не найден$(NC)"; \
		fi \
	fi

restart: stop run-background
	@echo "$(GREEN)Сервер перезапущен$(NC)"

logs:
	@echo "$(BLUE)Последние 50 строк логов:$(NC)"
	@tail -50 app.log

logs-follow:
	@echo "$(BLUE)Логи в реальном времени (Ctrl+C для выхода):$(NC)"
	@tail -f app.log

status-server:
	@echo "$(BLUE)Статус сервера:$(NC)"
	@if [ -f app.pid ]; then \
		PID=$$(cat app.pid); \
		if kill -0 $$PID 2>/dev/null; then \
			echo "$(GREEN)Сервер запущен (PID: $$PID)$(NC)"; \
			ps -p $$PID -o pid,ppid,state,pcpu,pmem,etime,command | grep -v COMMAND; \
		else \
			echo "$(RED)Сервер не запущен (PID файл существует, но процесс не найден)$(NC)"; \
		fi \
	else \
		PID=$$(ps aux | grep "node server.js" | grep -v grep | awk '{print $$2}'); \
		if [ -n "$$PID" ]; then \
			echo "$(GREEN)Сервер запущен (PID: $$PID, но без PID файла)$(NC)"; \
		else \
			echo "$(RED)Сервер не запущен$(NC)"; \
		fi \
	fi

# ============================================
# Очистка
# ============================================

clean:
	@echo "$(BLUE)🧹 Очистка проекта...$(NC)"
	@echo "$(YELLOW)Удаление node_modules...$(NC)"
	@rm -rf node_modules
	@echo "$(YELLOW)Удаление lock файлов...$(NC)"
	@rm -f package-lock.json
	@echo "$(YELLOW)Удаление временных файлов...$(NC)"
	@rm -rf temp
	@rm -rf storage
	@rm -rf extracted
	@rm -rf downloads
	@rm -rf cache
	@rm -rf logs
	@echo "$(YELLOW)Удаление логов...$(NC)"
	@rm -f app.log
	@rm -f app.pid
	@echo "$(YELLOW)Удаление отчета аудита...$(NC)"
	@rm -f audit-report.json
	@echo "$(GREEN)Очистка завершена$(NC)"

clean-all: clean
	@echo "$(BLUE)🗑️ Полная очистка (включая .env)...$(NC)"
	@rm -f $(ENV_FILE)
	@echo "$(GREEN)Полная очистка завершена$(NC)"

# ============================================
# Аудит
# ============================================

audit:
	@echo "$(BLUE)🔍 Проверка уязвимостей...$(NC)"
	@$(NPM) audit

audit-fix-only:
	@echo "$(BLUE)🔧 Исправление уязвимостей...$(NC)"
	@$(NPM) audit fix

# ============================================
# Утилиты
# ============================================

status:
	@echo "$(BLUE)📊 Статус проекта:$(NC)"
	@echo "  Node.js: $$($(NODE) -v)"
	@echo "  npm: $$($(NPM) -v)"
	@if [ -f $(ENV_FILE) ]; then \
		echo "$(GREEN).env файл: присутствует$(NC)"; \
		echo "Порт: $$(grep "^PORT=" $(ENV_FILE) | cut -d '=' -f2)"; \
		echo "Хост: $$(grep "^HOST=" $(ENV_FILE) | cut -d '=' -f2)"; \
	else \
		echo "  $(RED).env файл: отсутствует$(NC)"; \
	fi
	@if [ -d node_modules ]; then \
		echo "  $(GREEN)✅ Зависимости: установлены$(NC)"; \
	else \
		echo "  $(RED)Зависимости: не установлены$(NC)"; \
	fi
	@if [ -f package-lock.json ]; then \
		echo "  $(GREEN)package-lock.json: существует$(NC)"; \
	else \
		echo "  $(YELLOW)package-lock.json: отсутствует$(NC)"; \
	fi

# ============================================
# Создание .env.example
# ============================================

create-env-example:
	@echo "$(BLUE)Создание .env.example...$(NC)"
	@echo "# Hercules Personal Platform" > $(ENV_EXAMPLE)
	@echo "# ============================================" >> $(ENV_EXAMPLE)
	@echo "# Настройки сервера" >> $(ENV_EXAMPLE)
	@echo "PORT=6565" >> $(ENV_EXAMPLE)
	@echo "HOST=localhost" >> $(ENV_EXAMPLE)
	@echo "NODE_ENV=production" >> $(ENV_EXAMPLE)
	@echo "" >> $(ENV_EXAMPLE)
	@echo "# GitHub токен (опционально)" >> $(ENV_EXAMPLE)
	@echo "GITHUB_TOKEN=" >> $(ENV_EXAMPLE)
	@echo "" >> $(ENV_EXAMPLE)
	@echo "# Rate limiting" >> $(ENV_EXAMPLE)
	@echo "RATE_LIMIT_REQUESTS=100" >> $(ENV_EXAMPLE)
	@echo "RATE_LIMIT_WINDOW=15" >> $(ENV_EXAMPLE)
	@echo "" >> $(ENV_EXAMPLE)
	@echo "# Файловая система" >> $(ENV_EXAMPLE)
	@echo "MAX_FILE_SIZE=104857600" >> $(ENV_EXAMPLE)
	@echo "DOWNLOAD_DIR=./downloads" >> $(ENV_EXAMPLE)
	@echo "CACHE_DIR=./cache" >> $(ENV_EXAMPLE)
	@echo "LOG_DIR=./logs" >> $(ENV_EXAMPLE)
	@echo "STORAGE_DIR=./storage" >> $(ENV_EXAMPLE)
	@echo "EXTRACTED_DIR=./extracted" >> $(ENV_EXAMPLE)
	@echo "TEMP_DIR=./temp" >> $(ENV_EXAMPLE)
	@echo "" >> $(ENV_EXAMPLE)
	@echo "# API настройки" >> $(ENV_EXAMPLE)
	@echo "MAX_CONCURRENT_DOWNLOADS=5" >> $(ENV_EXAMPLE)
	@echo "MAX_REPOSITORY_SIZE=52428800" >> $(ENV_EXAMPLE)
	@echo "CACHE_TTL=3600000" >> $(ENV_EXAMPLE)
	@echo "" >> $(ENV_EXAMPLE)
	@echo "# Логи" >> $(ENV_EXAMPLE)
	@echo "VERBOSE=false" >> $(ENV_EXAMPLE)
	@echo "$(GREEN)Создан $(ENV_EXAMPLE)$(NC)"