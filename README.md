# Геркулес

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Установка и запуск


### Способ 1: Клонирование через Git

```bash
git clone https://github.com/hercules-secure/hercules.git
cd hercules
./hercules.sh install
./hercules.sh start
```

### Способ 2: Скачивание архива
```bash
wget https://hercules-security.ru/repo/hercules.tar.gz
tar -xzvf hercules.tar.gz
cd hercules
./hercules.sh install
./hercules.sh start
```

## Дополнительные команды
```bash
# Сделать исполняемым (если нужно)
chmod +x hercules.sh

# Установка зависимостей
./hercules.sh install

# Запуск сервера
./hercules.sh start

# Запуск с другим портом
PORT=3000 ./hercules.sh start

# Статус сервера
./hercules.sh status

# Просмотр логов
./hercules.sh logs

# Логи в реальном времени
./hercules.sh logs-follow

# Перезапуск сервера
./hercules.sh restart

# Остановка сервера
./hercules.sh stop

# Очистка временных файлов
./hercules.sh clean

# Помощь
./hercules.sh help
```

# Mодули

## Источники для анализа
- `GitHub репозитории`
- `GitLab репозитории`
- `Локальные папки (распакованные архивы)`
- `Загруженные архивы (ZIP, TAR, TAR.GZ)`

## SCA (Композиционный анализ)
### Поддерживаемые экосистемы:

| Экосистема | Менеджеры | Файлы |
|------------|-----------|-------|
| `JavaScript/TypeScript` | `npm`, `yarn`, `pnpm` | `package.json`, `yarn.lock`, `pnpm-lock.yaml` |
| `Python` | `pip`, `poetry` | `requirements.txt`, `Pipfile`, `pyproject.toml` |
| `Go` | `go modules` | `go.mod` |
| `Java` | `Maven`, `Gradle` | `pom.xml`, `build.gradle` |
| `PHP` | `Composer` | `composer.json` |
| `Ruby` | `Bundler` | `Gemfile` |
| `Rust` | `Cargo` | `Cargo.toml` |
| `C/C++` | `CMake`, `Conan`, `vcpkg`, `Make`, `Meson` | `CMakeLists.txt`, `conanfile.txt`, `conanfile.py`, `vcpkg.json`, `Makefile`, `meson.build` |

### Формат отчета:
- `HTML`

### Экспорт результатов:
- `JSON (CycloneDX 1.6)`
- `HTML`
- `PDF`

## SAST (Анализ поверхности исходного кода)

### Поддерживаемые языки:
- `JavaScript/TypeScript`
- `Python`
- `Java`
- `Go`
- `PHP`
- `Ruby`
- `C#`
- `C/C++`

### Infrastructure as Code (IaC)
- `Terraform`
- `Kubernetes`
- `Docker`

### Build Systems (Анализ сборки)
- `CMakeLists.txt`
- `Makefile`

### Основные возможности:

| Категория | Что проверяет |
|-----------|----------------|
| `Обнаружение секретов` | `Пароли`, `API ключи`, `токены`, `JWT`, `приватные ключи` |
| `Инъекционные атаки` | `SQL`, `NoSQL`, `команды`, `код (eval/exec)` |
| `XSS и клиентские уязвимости` | `DOM XSS`, `prototype pollution`, `массовое присваивание` |
| `Контроль доступа` | `открытые редиректы`, `path traversal`, `SSRF` |
| `Криптография` | `слабые алгоритмы (MD5, SHA1, DES)`, `HTTP вместо HTTPS` |
| `Ошибки конфигурации` | `Debug режим`, `CORS wildcard`, `отсутствие CSRF/rate limiting` |
| `Безопасность IaC` | `Terraform`, `Kubernetes`, `Docker уязвимости` |
| `Языко-специфичные проверки` | `Python (eval, pickle)`, `Go (race conditions)` |
| `Качество кода` | `Console.log в production`, `TODO/FIXME комментарии` |

### Формат отчета:
- `HTML`

### Экспорт результатов:
- `JSON`
- `HTML`
- `PDF`

## FUZZ (Фаззинг API)
### Поддерживаемые интерфейсы:
- `ReST API`

### Поддерживаемые форматы спецификаций:
- `OpenAPI 2.0 (Swagger)`
- `OpenAPI 3.0.x`
- `OpenAPI 3.1.x`
- `JSON`
- `YAML`

### Основные возможности:

| Категория | Что проверяет |
|-----------|----------------|
| `Базовые тесты` | `Валидные запросы по OpenAPI схеме` |
| `Инъекционные тесты` | `SQL`, `XSS`, `command injection`, `path traversal` |
| `Тесты больших нагрузок` | `DoS через крупные payloads` |
| `Мутационные тесты` | `Изменение структуры данных (удаление, замена типов)` |
| `Тесты заголовков` | `IP spoofing`, `path override`, `CRLF injection`, `SSRF` |
| `Rate Limit тесты` | `Быстрые запросы`, `постепенная нагрузка` |
| `Генерация тестовых данных` | `Автоматическое создание payloads из OpenAPI схемы` |
| `Обнаружение уязвимостей` | `SQL ошибки`, `XSS отражения`, `утечки данных` |

### Формат отчета:
- `HTML`

### Экспорт результатов:

| Формат | Описание |
|--------|----------|
| `JSON` | `Структурированный отчет для автоматизации` |
| `Postman Collection` | `Импорт в Postman для ручного тестирования` |
| `cURL` | `Команда для терминала` |
| `Fetch API` | `JavaScript код для браузера` |
| `Raw HTTP` | `Сырой HTTP запрос` |