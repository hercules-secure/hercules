# Геркулес

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Установка и запуск


### Способ 1: Клонирование через Git

```bash
git clone https://github.com/hercules-secure/hercules.git
cd hercules

# Сделать исполняемым
chmod +x hercules.sh

# Установка зависимостей
./hercules.sh install

# Запуск сервера
./hercules.sh start
```

## Дополнительные команды
```bash

# Запуск с другим портом
PORT=3000 ./hercules.sh start

# Обновление сервера (остановка, git pull, установка зависимостей, запуск)
./hercules.sh update

# Статус сервера
./hercules.sh status

# Показать все логи (оба файла)
./hercules.sh logs

# Показать только combined.log
./hercules.sh logs-combined

# Показать только errors.log
./hercules.sh logs-errors

# Логи в реальном времени (combined.log)
./hercules.sh logs-follow

# Логи ошибок в реальном времени
./hercules.sh logs-follow-errors

# Очистить логи
./hercules.sh logs-clear

# Показать размер логов
./hercules.sh logs-size

# Перезапуск сервера
./hercules.sh restart

# Остановка сервера
./hercules.sh stop

# Очистка временных файлов
./hercules.sh clean

# Помощь
./hercules.sh help
```

## Возможности

```
Композиционный анализ

- Статистика зависимостей
- Проверка лицензий
- Анализ достижимости
- Анализ версий

Анализ исходного кода

- Поиск уязвимостей и слабостей
- Поиск секретов
- Анализ потока данных
- Taint Analysis
- Call Graph анализ
- Анализ достижимости

Фаззинг API

- Анализ безопасности API
- Автоматическая генерация тестов
- Replay атаки
- REST API (OpenAPI / Swagger)
- gRPC (HTTP/2, Protobuf)
- GraphQL
- SOAP / XML-RPC

Сканирование сайтов и веб-приложений

- Сканирование на OWASP Top 10
- Сканирование на CWE Top 25
- Поиск известных CVE
- Анализ форм и параметров URL
- Анализ заголовков безопасности (HSTS, CSP)
- Проверка SSL/TLS сертификатов
- Анализ Cookie (HttpOnly, Secure)
- SPA (React / Vue / Angular)
- Поиск скрытых директорий
- Анализ субдоменов

Моделирование угроз

- Диаграммы потоков данных
- Библиотека угроз STRIDE
- Библиотека готовых стратегий

Интеграции

- CI/CD интеграция
- Трекеры задач
- Уведомления

Форматы отчетов

- HTML
- JSON
- PDF

Поддерживаемые источники

- GitHub / GitLab
- Архив / Локальный проект
- Bitbucket / Корпоративные репозитории

```


