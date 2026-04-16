# Hercules
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
| Экосистема	Менеджеры	Файлы
JavaScript/TypeScript	npm, yarn, pnpm	package.json, yarn.lock, pnpm-lock.yaml
Python	pip, poetry	requirements.txt, Pipfile, pyproject.toml
Go	go modules	go.mod
Java	Maven, Gradle	pom.xml, build.gradle
PHP	Composer	composer.json
Ruby	Bundler	Gemfile
Rust	Cargo	Cargo.toml

### Источники для анализа
1. GitHub репозитории
2. GitLab репозитории
3. Локальные папки (распакованные архивы)
4. Загруженные архивы (ZIP, TAR, TAR.GZ)

### Формат вывода
1. CycloneDX 1.6 SBOM
2. Уязвимости через OSV API
3. Статистика по критичности
4. Рекомендации по исправлению

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
## SAMM
## Learn
## API
### Auth
1. Пользователь → Frontend: клик "Войти через Google"
2. Frontend → Auth Service: GET /auth/google
3. Auth Service → Google: redirect на страницу входа
4. Пользователь → Google: вводит учетные данные
5. Google → Auth Service: callback с кодом
6. Auth Service → Google: обмен кода на токены
7. Auth Service: создает пользователя в MongoDB
8. Auth Service: генерирует JWT (24h)
9. Auth Service: сохраняет JWT в Redis
10. Auth Service → Frontend: redirect с токеном
11. Frontend: сохраняет токен в localStorage/HttpOnly cookie
12. Frontend → API Service: запросы с Bearer токеном
13. API Service: проверяет токен в Redis
14. API Service: логирует запрос в MongoDB
15. API Service → Frontend: ответ с данными
