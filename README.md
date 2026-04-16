# hercules

## Установка
```
# Первая установка
make install

# Запуск в фоне
make run-background

# Проверка статуса
make status-server

# Просмотр логов
make logs

# Остановка
make stop

# Перезапуск
make restart

# Очистка
make clean
```
## SCA
### Анализатор поддерживает:

| Экосистема | Менеджеры | Файлы |
|------------|-----------|-------|
| JavaScript/TypeScript | npm, yarn, pnpm	| package.json, yarn.lock, pnpm-lock.yaml |
| Python	| pip, poetry	| requirements.txt, Pipfile, pyproject.toml |
| Go	| go modules| go.mod |
| Java	| Maven, Gradle	| pom.xml, build.gradle |
| PHP	| Composer	| composer.json |
| Ruby	| Bundler	| Gemfile |
| Rust	| Cargo	| Cargo.toml |

### Источники для анализа
GitHub репозитории
GitLab репозитории

✅ Локальные папки (распакованные архивы)

✅ Загруженные архивы (ZIP, TAR, TAR.GZ)

📊 Формат вывода
✅ CycloneDX 1.6 SBOM

✅ Уязвимости через OSV API

✅ Статистика по критичности

✅ Рекомендации по исправлению
## SAST
## FUZZ
### Common
| Тест	| Описание	| Severity|
|-------|-----------|---------|
| Cache Poisoning	| Отравление кэша через заголовки | HIGH |
| Cache Deception	| Кэширование приватного контента | HIGH |
| Session Fixation	| Фиксация сессии до логина	| HIGH |
| CSRF	| Подделка межсайтовых запросов	HIGH |
| SSRF	| Подделка серверных запросов | CRITICAL |
| XXE	| XML External Entity атаки | CRITICAL |
| Open Redirect	| Открытые редиректы | MEDIUM |
| Subdomain Takeover | Захват поддоменов | CRITICAL |
| CORS Misconfiguration	| Небезопасные CORS настройки | HIGH |

### ReST API
```
```
### WebSocket/Socket.IO
```
Основные возможности модуля:

Поддержка WebSocket и Socket.IO

Специфичные для WebSocket атаки:

Malformed frames (некорректные фреймы)

Fragmentation attack (фрагментация)

Slowloris attack (медленные сообщения)

Message flood (флуд)

Large messages (большие сообщения)

Универсальные инъекции:

SQL/NoSQL инъекции

XSS

Path traversal

Command injection

Prototype pollution

Детекция уязвимостей в реальном времени
```
### GraphQL
```
Основные возможности:

Автоматическая интроспекция - получает схему GraphQL

Генерация фазз-данных - SQLi, XSS, path traversal, protoype pollution и др.

Специфичные атаки:

Alias Attack (DoS)

Depth Attack (рекурсивные запросы)

Batch Attack (множество операций)

Circular Fragment Attack

Детектор уязвимостей:

Утечка стека

SQL ошибки

Медленные запросы (DoS)

Раскрытие чувствительных данных

Поддержка Query и Mutation
```
### gRPC
```
Основные возможности:

Автоматическая загрузка proto файлов

Генерация фазз-данных для всех типов protobuf

Поддержка unary, client stream, server stream, bidi stream

Детекция уязвимостей (SQLi, RCE, path traversal и др.)

Нагрузочное тестирование

Экспорт результатов в JSON/CSV
```
### jRPC
```
Основные возможности модуля:

Стратегии мутации :

Type Confusion — подмена типов данных

Boundary Values — граничные значения

Deep Nesting — глубокая вложенность

Unicode Injection — Unicode символы

Invalid ID — некорректные ID запросов

Malformed Version — неверная версия JSON-RPC

Unknown Method — энумерация методов

Missing/Extra Fields — отсутствие/лишние поля

Специфичные для JSON-RPC атаки :

Batch атаки (множество операций в одном запросе)

Resource Exhaustion (большие payloads)

Метод энумерация

Детекция уязвимостей:

SQL Injection

XSS

Path Traversal

Stack Trace утечка

DoS через медленные запросы

Prototype Pollution

Информация о типах

Авто-обнаружение методов через энумерацию популярных имен
```