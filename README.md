# Hercules

# Установка и запуск
```
make install && make run ( or make run-background)
```
## Дополнительные команды
```
make status-server // Проверка статуса
make logs // Просмотр логов
make stop // Остановка
make restart //Перезапуск
make clean // Очистка
```
# Mодули
## SCA
### Анализатор поддерживает:
| Экосистема | Менеджеры | Файлы |
|------------|-----------|-------|
| JavaScript/TypeScript | npm, yarn, pnpm | package.json, yarn.lock, pnpm-lock.yaml |
| Python | pip, poetry | requirements.txt, Pipfile, pyproject.toml |
| Go | go modules | go.mod |
| Java | Maven, Gradle | pom.xml, build.gradle |
| PHP | Composer | composer.json |
| Ruby | Bundler | Gemfile |
| Rust | Cargo | Cargo.toml |

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

### ReST API
1. 

### WebSocket/Socket.IO

1. Malformed frames (некорректные фреймы)
2. Fragmentation attack (фрагментация)
3. Slowloris attack (медленные сообщения)
4. Message flood (флуд)
5. Large messages (большие сообщения)
6. SQL/NoSQL инъекции
7. XSS
8. Path traversal
9. Command injection
10. Prototype pollution
11. Детекция уязвимостей в реальном времени

### GraphQL

1. Автоматическая интроспекция - получает схему GraphQL
2. Генерация фазз-данных - SQLi, XSS, path traversal, protoype pollution и др.
3. Alias Attack (DoS)
4. Depth Attack (рекурсивные запросы)
5. Batch Attack (множество операций)
6. Circular Fragment Attack
7. Утечка стека
8. SQL ошибки
9. Медленные запросы (DoS)
10. Раскрытие чувствительных данных
11. Поддержка Query и Mutation

### gRPC
1. Основные возможности:
2. Автоматическая загрузка proto файлов
3. Генерация фазз-данных для всех типов protobuf
4. Поддержка unary, client stream, server stream, bidi stream
5. Детекция уязвимостей (SQLi, RCE, path traversal и др.)
6. Нагрузочное тестирование
7. Экспорт результатов в JSON/CSV

### jRPC

1. Type Confusion — подмена типов данных
2. Boundary Values — граничные значения
3. Deep Nesting — глубокая вложенность
4. Unicode Injection — Unicode символы
5. Invalid ID — некорректные ID запросов
6. Malformed Version — неверная версия JSON-RPC
7. Unknown Method — энумерация методов
8. Missing/Extra Fields — отсутствие/лишние поля
9. Batch атаки (множество операций в одном запросе)
10. Resource Exhaustion (большие payloads)
11. Метод энумерация
12. SQL Injection
13. XSS
14. Path Traversal
15. Stack Trace утечка
16. DoS через медленные запросы
17. Prototype Pollution
18. Информация о типах
19. Авто-обнаружение методов через энумерацию популярных имен
