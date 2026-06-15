export const SAST_RULES = {
  name: "Hercules Security Rules",
  version: "4.2.0",
  description: "Точные правила безопасности с минимальным количеством ложных срабатываний",
  categories: {
    credentials: "Учетные данные и секреты",
    injection: "Инъекции (SQL, Command, LDAP, NoSQL)",
    crypto: "Криптография и шифрование",
    ssrf: "SSRF и безопасность сети",
    iac: "Infrastructure as Code (Kubernetes, Terraform, Docker, GitHub Actions)",
    config: "Конфигурация и логирование",
    "rate-limit": "Rate Limiting и DoS защита",
    memory: "Безопасность памяти (C/C++)",
    owasp: "OWASP Top 10",
    ldap: "LDAP безопасность",
    "rest-api": "REST API безопасность",
    "grpc-api": "gRPC API безопасность",
    "rpc-api": "RPC API безопасность",
    "graphql-api": "GraphQL API безопасность",
    authorization: "Авторизация и контроль доступа"
  },
  rules: [
    // ==================== CREDENTIALS ====================
    {
      id: "hardcoded-credentials",
      category: "credentials",
      message: "Обнаружены жестко закодированные учетные данные",
      severity: "CRITICAL",
      pattern: "(?:password|pass|pwd|secret|api[_-]?key|token|access[_-]?token|refresh[_-]?token|privateKey|secretKey|apiSecret|signingKey|encryptionKey|hmacSecret)\\s*[=:]\\s*['\"`](?![^'\"`]*\\$\\{[^}]+\\})(?![^'\"`]*process\\.env)(?![^'\"`]*placeholder)(?![^'\"`]*example)(?![^'\"`]*test)(?![^'\"`]*\\{\\{)[^'\"`\\s]{8,}['\"`]",
      flags: "gi",
      recommendation: "Используйте переменные окружения или менеджер секретов",
      languages: ["javascript", "typescript", "python", "java", "php", "ruby", "go", "csharp", "rust"]
    },
    {
      id: "hardcoded-db-connection",
      category: "credentials",
      message: "Строка подключения к БД содержит пароль",
      severity: "CRITICAL",
      pattern: "(?:mongodb|postgresql|mysql|redis|mongodb\\+srv):\\/\\/[^\\s'\"]+:[^\\s'\"]+@",
      flags: "gi",
      recommendation: "Используйте переменные окружения для DATABASE_URL",
      languages: ["all"]
    },
    {
      id: "hardcoded-aws-credentials",
      category: "credentials",
      message: "AWS ключи доступа захардкожены",
      severity: "CRITICAL",
      pattern: "(?:AKIA|ASIA)[0-9A-Z]{16}",
      flags: "gi",
      recommendation: "Используйте IAM роли или AWS Secrets Manager",
      languages: ["all"]
    },
    {
      id: "jwt-token-exposure",
      category: "credentials",
      message: "Обнаружен JWT токен в коде",
      severity: "HIGH",
      pattern: "eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+",
      flags: "gi",
      recommendation: "Используйте переменные окружения для JWT токенов",
      languages: ["all"]
    },

    // ==================== INJECTION ====================
    {
      id: "command-injection",
      category: "injection",
      message: "Потенциальная инъекция команд через конкатенацию строк",
      severity: "CRITICAL",
      pattern: "(?:exec|system|popen|Runtime\\.exec|subprocess\\.call|os\\.system|std::process::Command)\\s*\\([^)]*\\+(?:req|request|params|input|data|user)",
      flags: "gi",
      recommendation: "Используйте массив аргументов вместо конкатенации строк",
      languages: ["javascript", "typescript", "python", "java", "php", "go", "rust", "ruby", "csharp"]
    },
    {
      id: "sql-injection",
      category: "injection",
      message: "Потенциальная SQL инъекция через конкатенацию строк",
      severity: "CRITICAL",
      pattern: "(?:execute|query|exec|raw|executeQuery|createQuery)\\s*\\(\\s*['\"`](?:SELECT|INSERT|UPDATE|DELETE).*?['\"`]\\s*\\+\\s*(?:req\\.|params\\.|query\\.|body\\.|input|data|user)",
      flags: "gi",
      recommendation: "Используйте параметризованные запросы",
      languages: ["javascript", "typescript", "python", "java", "php", "go", "ruby", "csharp", "rust"]
    },
    {
      id: "nosql-injection",
      category: "injection",
      message: "Потенциальная NoSQL инъекция",
      severity: "CRITICAL",
      pattern: "(?:\\$where|\\$regex|\\$ne|\\$gt|\\$lt|\\$in|\\$nin|\\$or)\\s*:[^}]*(?:req\\.|params\\.|query\\.|body\\.|input)",
      flags: "gi",
      recommendation: "Санируйте входные данные, используйте параметризацию",
      languages: ["javascript", "typescript", "python", "java", "go"]
    },
    {
      id: "ldap-injection",
      category: "ldap",
      message: "Потенциальная LDAP инъекция",
      severity: "CRITICAL",
      pattern: "(?:ldap_search|ldap_bind|LdapContext|DirectorySearcher|SearchRequest)\\s*\\([^)]*\\+(?:req|request|params|input|username|password|filter|dn)(?!.*(?:escapeLdapFilter|sanitizeLdap|LdapEncoder))",
      flags: "gi",
      recommendation: "Используйте экранирование LDAP специальных символов",
      languages: ["php", "java", "python", "csharp", "javascript", "typescript"]
    },
    {
      id: "xss",
      category: "injection",
      message: "Потенциальная XSS уязвимость через innerHTML",
      severity: "HIGH",
      pattern: "(?:innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML)\\s*=\\s*(?:req\\.|params\\.|query\\.|body\\.|input|data|user)",
      flags: "gi",
      recommendation: "Используйте textContent или DOMPurify",
      languages: ["javascript", "typescript"]
    },
    {
      id: "xxe",
      category: "injection",
      message: "XXE (XML External Entity) уязвимость",
      severity: "CRITICAL",
      pattern: "(?:XMLReader|SAXReader|DocumentBuilder|XmlDocument|SimpleXML|DOMDocument).*?(?:parse|load)\\s*\\([^)]*(?!.*(?:disable|Feature|PROHIBIT_DTD))",
      flags: "gi",
      recommendation: "Отключите внешние сущности в XML парсере",
      languages: ["java", "python", "php", "csharp", "javascript", "typescript"]
    },

    // ==================== ReDOS ПО ЯЗЫКАМ ====================
    {
      id: "regex-dos-js",
      category: "injection",
      message: "Потенциальная ReDoS уязвимость в регулярном выражении",
      severity: "MEDIUM",
      pattern: "(?:new\\s+RegExp\\s*\\(\\s*['\"`][^'\"`]*?(?:\\([a-zA-Z_][a-zA-Z0-9_]*\\+\\)\\s*\\+|\\[\\^[^\\]]*\\]\\s*\\+\\s*\\*|\\w+\\+\\s*\\w+\\+\\s*\\w+)[^'\"`]*?['\"`]\\s*\\)|/(?!\\^)[^/]*?(?:\\([a-zA-Z_][a-zA-Z0-9_]*\\+\\)\\s*\\+|[+*]\\s*[+*]|\\[[^\\]]*\\]\\s*[+*]\\s*[+*])[^/]*/[gimuy]*)",
      flags: "gi",
      recommendation: "Используйте атомарные группы (?>...), ограничьте длину ввода",
      languages: ["javascript", "typescript"],
      negative_pattern: "(?:base64|[A-Za-z0-9+/]{20,}={0,2}|data:image/|blob:|%[0-9A-Fa-f]{2})"
    },
    {
      id: "regex-dos-go",
      category: "injection",
      message: "Потенциальная ReDoS уязвимость в регулярном выражении",
      severity: "MEDIUM",
      pattern: "regexp\\.(?:MustCompile|Compile)\\s*\\(\\s*`[^`]*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\(\\w+\\+\\)\\s*\\*|\\(\\w+\\*\\)\\s*\\+|\\[\\^[^\\]]*\\]\\s*\\+\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^`]*?`\\s*\\)",
      flags: "gi",
      recommendation: "Используйте атомарные группы (?>...) или перепишите регулярное выражение",
      languages: ["go"],
      negative_pattern: "(?:strings\\.|fmt\\.|strconv\\.|bytes\\.|encoding/|json\\.|yaml\\.|regexp\\.QuoteMeta|path\\.|filepath\\.)"
    },
    {
      id: "regex-dos-python",
      category: "injection",
      message: "Потенциальная ReDoS уязвимость в регулярном выражении",
      severity: "MEDIUM",
      pattern: "re\\.(?:compile|search|match|findall|finditer|sub|split)\\s*\\(\\s*r?['\"`][^'\"`]*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^'\"`]*?['\"`]",
      flags: "gi",
      recommendation: "Используйте модуль 'regex' с поддержкой атомарных групп",
      languages: ["python"],
      negative_pattern: "re\\.escape"
    },
    {
      id: "regex-dos-java",
      category: "injection",
      message: "Потенциальная ReDoS уязвимость в регулярном выражении",
      severity: "MEDIUM",
      pattern: "Pattern\\.(?:compile|matches)\\s*\\(\\s*[\"'][^\"']*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^\"']*?[\"']",
      flags: "gi",
      recommendation: "Используйте (?>...) атомарные группы, включите режим RE2",
      languages: ["java"]
    },
    {
      id: "regex-dos-php",
      category: "injection",
      message: "Потенциальная ReDoS уязвимость в регулярном выражении",
      severity: "MEDIUM",
      pattern: "(?:preg_match|preg_match_all|preg_replace|preg_filter|preg_split)\\s*\\(\\s*['\"`][^'\"`]*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^'\"`]*?['\"`]",
      flags: "gi",
      recommendation: "Используйте 'S' модификатор для анализа",
      languages: ["php"]
    },
    {
      id: "regex-dos-ruby",
      category: "injection",
      message: "Потенциальная ReDoS уязвимость в регулярном выражении",
      severity: "MEDIUM",
      pattern: "(?:Regexp\\.new|%r\\{)\\s*[\"'`{][^\"'`}]*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^\"'`}]*?[\"'`}]",
      flags: "gi",
      recommendation: "Используйте Oniguruma с атомарными группами",
      languages: ["ruby"]
    },
    {
      id: "regex-dos-csharp",
      category: "injection",
      message: "Потенциальная ReDoS уязвимость в регулярном выражении",
      severity: "MEDIUM",
      pattern: "(?:Regex\\.(?:Match|Matches|Replace|Split|IsMatch)\\s*\\([^,]*,\\s*[\"'][^\"']*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^\"']*?[\"'])",
      flags: "gi",
      recommendation: "Установите таймаут (Regex.MatchTimeout)",
      languages: ["csharp"]
    },
    {
      id: "regex-dos-rust",
      category: "injection",
      message: "Потенциальная ReDoS уязвимость в регулярном выражении",
      severity: "MEDIUM",
      pattern: "(?:Regex::new|regex::Regex::new)\\s*\\(\\s*[\"'][^\"']*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^\"']*?[\"']",
      flags: "gi",
      recommendation: "Библиотека regex уже защищена, но избегайте экспоненциальных паттернов",
      languages: ["rust"]
    },

    // ==================== CRYPTO ====================
    {
      id: "weak-cryptography",
      category: "crypto",
      message: "Слабый криптографический алгоритм",
      severity: "HIGH",
      pattern: "\\b(?:MD5|SHA-?1|DES|RC4|RSA1024)\\s*\\(",
      flags: "gi",
      recommendation: "Используйте современные алгоритмы: SHA-256, AES-256-GCM, bcrypt, Argon2",
      languages: ["all"]
    },
    {
      id: "jwt-none-algorithm",
      category: "crypto",
      message: "JWT с алгоритмом none - критическая уязвимость",
      severity: "CRITICAL",
      pattern: "\"alg\"\\s*:\\s*\"none\"",
      flags: "gi",
      recommendation: "Запретите алгоритм none, всегда проверяйте подпись JWT",
      languages: ["all"]
    },

    // ==================== SSRF ====================
    {
      id: "ssrf-vulnerability",
      category: "ssrf",
      message: "SSRF: запрос к пользовательскому URL",
      severity: "CRITICAL",
      pattern: "(?:axios\\.(?:get|post|put|delete|request)|fetch|http\\.get|https\\.get|requests\\.get|urllib\\.request|HttpClient|reqwest::(?:get|post|put|delete|request))\\s*\\(\\s*(?:req\\.query\\.\\w+|req\\.body\\.\\w+|req\\.params\\.\\w+|url|target|uri|endpoint)\\s*\\)",
      flags: "gi",
      recommendation: "Валидируйте URL по белому списку доверенных доменов",
      languages: ["javascript", "typescript", "python", "java", "go", "csharp", "rust"]
    },

    // ==================== AUTHORIZATION ====================
    {
      id: "bola-idor",
      category: "authorization",
      message: "BOLA/IDOR: прямая подстановка ID без проверки прав доступа",
      severity: "CRITICAL",
      pattern: "(?:@PathVariable|@PathParam|req\\.params\\.|req\\.query\\.|:id|:userId|:accountId|:documentId)\\s*(?:[\\w]+)\\s*.*?(?:repository|service)\\.(?:find|get|delete|update|save|findById|getById|deleteById)",
      flags: "gi",
      negative_pattern: "(?:@PreAuthorize|@AuthenticationPrincipal|checkAccess|canAccess|hasAccess|isOwner|verifyAccess|@CurrentUser)",
      recommendation: "Добавьте проверку, что текущий пользователь имеет доступ к ресурсу",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp", "ruby"]
    },
    {
      id: "mass-assignment",
      category: "authorization",
      message: "Массовое присваивание - возможна эскалация привилегий",
      severity: "HIGH",
      pattern: "(?:Model\\.(?:create|update|insert|upsert)|\\w+\\.(?:save|update|patch|assignAttributes)\\s*\\(\\s*req\\.body|req\\.body\\s*(?:=|:)\\s*\\w+|Object\\.assign\\([^,]+,\\s*req\\.(?:body|query)|c\\.(?:Bind|ShouldBind|BindJSON)\\(&\\w+\\)|fields\\s*=\\s*['\"]__all__['\"])",
      flags: "gi",
      recommendation: "Используйте DTO с явным списком разрешенных полей",
      languages: ["javascript", "typescript", "python", "java", "php", "go", "csharp", "ruby"]
    },

    // ==================== REST API ====================
    {
      id: "rest-missing-auth",
      category: "rest-api",
      message: "REST эндпоинт без проверки аутентификации",
      severity: "CRITICAL",
      pattern: "(?:@(?:PostMapping|GetMapping|PutMapping|DeleteMapping|PatchMapping)|router\\.(?:get|post|put|delete|patch|all)|app\\.(?:get|post|put|delete|patch|all)|Route::(?:get|post|put|delete|patch))",
      flags: "gi",
      negative_pattern: "(?:@PreAuthorize|@RolesAllowed|@Secured|@AuthenticationPrincipal|@Auth|middleware\\(['\"]auth|verifyToken|checkAuth|isAuthenticated|requireAuth)",
      recommendation: "Добавьте middleware аутентификации",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp", "ruby"]
    },
    {
      id: "rest-missing-role-check",
      category: "rest-api",
      message: "Модифицирующий эндпоинт без проверки ролей",
      severity: "HIGH",
      pattern: "(?:@(?:PostMapping|PutMapping|DeleteMapping|PatchMapping)|router\\.(?:post|put|delete|patch)|app\\.(?:post|put|delete|patch))",
      flags: "gi",
      negative_pattern: "(?:@RolesAllowed|@PreAuthorize.*hasRole|@PreAuthorize.*hasAuthority|checkRole|isAdmin|requireAdmin|hasRole)",
      recommendation: "Ограничьте доступ по ролям",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp"]
    },
    {
      id: "rest-missing-validation",
      category: "rest-api",
      message: "Отсутствует валидация входных данных",
      severity: "MEDIUM",
      pattern: "(?:@(?:PostMapping|PutMapping|PatchMapping)|router\\.(?:post|put|patch)|app\\.(?:post|put|patch))",
      flags: "gi",
      negative_pattern: "(?:@Valid|@Validate|validation|sanitize|@NotNull|@NotBlank|@Size|@Pattern)",
      recommendation: "Добавьте валидацию входных данных",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp"]
    },

    // ==================== RATE LIMIT ====================
    {
      id: "rate-limit-missing",
      category: "rate-limit",
      message: "Эндпоинт без ограничения частоты запросов",
      severity: "MEDIUM",
      pattern: "(?:@(?:PostMapping|GetMapping|RequestMapping)|router\\.(?:post|get)|app\\.(?:post|get))",
      flags: "gi",
      negative_pattern: "(?:@RateLimit|rateLimiter|limiter|throttle|maxRequests|rate_limit)",
      recommendation: "Внедрите ограничение частоты запросов",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp"]
    },
    {
      id: "auth-endpoint-no-rate-limit",
      category: "rate-limit",
      message: "Эндпоинт аутентификации без rate limiting - уязвим для брутфорса",
      severity: "CRITICAL",
      pattern: "(?:login|signin|auth|token|verify|authenticate|reset-password|change-password)\\s*(?:@(?:PostMapping|GetMapping)|router\\.(?:post|get)|app\\.(?:post|get))",
      flags: "gi",
      negative_pattern: "(?:rateLimit|throttle|maxAttempts|max_attempts|Lock|@RateLimit)",
      recommendation: "Установите лимит: 3-5 попыток за 5 минут",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp"]
    },

    // ==================== OWASP ====================
    {
      id: "insecure-deserialization",
      category: "owasp",
      message: "Небезопасная десериализация",
      severity: "CRITICAL",
      pattern: "(?:pickle\\.loads|yaml\\.load\\(|unserialize|ObjectInputStream|readObject|XmlSerializer|BinaryFormatter|serde_json::from_str|serde_json::from_reader|bincode::deserialize)\\s*\\([^)]*(?!.*safe)",
      flags: "gi",
      recommendation: "Используйте JSON с валидацией схемы",
      languages: ["python", "java", "php", "ruby", "csharp", "go", "rust"]
    },
    {
      id: "path-traversal",
      category: "owasp",
      message: "Потенциальный обход пути (Path Traversal)",
      severity: "HIGH",
      pattern: "(?:fs\\.(?:readFile|writeFile|readdir|unlink|createReadStream|createWriteStream)|std::fs::(?:read|write|read_to_string|metadata)|std::fs::File::open)\\s*\\([^)]*\\.\\./",
      flags: "gi",
      recommendation: "Валидируйте пути, используйте path.resolve",
      languages: ["javascript", "typescript", "python", "java", "php", "go", "rust", "csharp"]
    },
    {
      id: "eval",
      category: "owasp",
      message: "Использование eval - опасная динамическая компиляция",
      severity: "CRITICAL",
      pattern: "\\b(?:eval|Function)\\s*\\([^)]*(?:req|request|params|body|query|input|user)",
      flags: "gi",
      recommendation: "Избегайте eval, используйте безопасные альтернативы",
      languages: ["javascript", "typescript", "python"]
    },
    {
      id: "race-condition-toctou",
      category: "owasp",
      message: "TOCTOU уязвимость (Time of Check Time of Use)",
      severity: "HIGH",
      pattern: "if\\s*\\(fs\\.existsSync\\([^)]+\\)\\)\\s*\\{[^}]{0,100}fs\\.(?:readFile|writeFile|unlink|rename|chmod)",
      flags: "gi",
      recommendation: "Используйте атомарные операции",
      languages: ["javascript", "typescript", "python", "go", "java", "csharp", "rust"]
    },

    // ==================== CONFIG ====================
    {
      id: "log-sensitive-data",
      category: "config",
      message: "Логирование чувствительных данных",
      severity: "HIGH",
      pattern: "(?:console\\.log|logger\\.(?:info|debug|warn|error|log)|System\\.out\\.println|logging\\.info|println!|eprintln!)\\s*\\([^)]*(?:password|token|secret|api_key|authorization|cookie|credit_card)",
      flags: "gi",
      recommendation: "Никогда не логируйте чувствительные данные",
      languages: ["javascript", "typescript", "python", "java", "go", "csharp", "php", "ruby", "rust"]
    },
    {
      id: "debug-mode-production",
      category: "config",
      message: "Режим отладки включен",
      severity: "HIGH",
      pattern: "(?:DEBUG|NODE_ENV|APP_DEBUG|DJANGO_DEBUG|FLASK_DEBUG|ASPNETCORE_ENVIRONMENT)\\s*=\\s*(?:True|true|1|'development'|'dev'|Development)",
      flags: "gi",
      recommendation: "Отключите режим отладки в production окружении",
      languages: ["all"]
    },
    {
      id: "cors-wildcard",
      category: "config",
      message: "CORS с '*' разрешает доступ любому домену",
      severity: "MEDIUM",
      pattern: "(?:Access-Control-Allow-Origin|@CrossOrigin|cors\\(\\{).{0,50}(?:\\*|origin:\\s*\\*)",
      flags: "gi",
      recommendation: "Ограничьте CORS белым списком доверенных доменов",
      languages: ["javascript", "typescript", "java", "go", "csharp"]
    },
    {
      id: "config-env-exposure",
      category: "config",
      message: "Файл .env в репозитории",
      severity: "CRITICAL",
      pattern: "\\.env$",
      flags: "gi",
      recommendation: "Добавьте .env в .gitignore",
      languages: ["all"]
    },

    // ==================== C/C++ ====================
    {
      id: "cpp-gets",
      category: "memory",
      message: "Опасная функция gets",
      severity: "CRITICAL",
      pattern: "\\bgets\\s*\\(",
      flags: "gi",
      recommendation: "Используйте fgets вместо gets",
      languages: ["c", "cpp"]
    },
    {
      id: "cpp-strcpy",
      category: "memory",
      message: "Опасная функция strcpy без проверки границ",
      severity: "HIGH",
      pattern: "\\bstrcpy\\s*\\(",
      flags: "gi",
      recommendation: "Используйте strncpy или strcpy_s",
      languages: ["c", "cpp"]
    },
    {
      id: "cpp-printf-injection",
      category: "injection",
      message: "Форматная строка printf с пользовательским вводом",
      severity: "HIGH",
      pattern: "\\bprintf\\s*\\([^,)]*\\+(?:req|request|params|input|data)",
      flags: "gi",
      recommendation: "Используйте printf с форматной строкой '%s', user_input",
      languages: ["c", "cpp"]
    },
    {
      id: "cpp-system",
      category: "injection",
      message: "Вызов system с пользовательским вводом",
      severity: "CRITICAL",
      pattern: "\\bsystem\\s*\\([^)]*\\+",
      flags: "gi",
      recommendation: "Избегайте system, используйте execve",
      languages: ["c", "cpp"]
    },

    // ==================== IAC: DOCKER ====================
    {
      id: "docker-latest-tag",
      category: "iac",
      message: "Использование тега 'latest' в Docker образе",
      severity: "MEDIUM",
      pattern: "^FROM\\s+[a-zA-Z0-9/._-]+:latest\\s*$",
      flags: "gim",
      recommendation: "Используйте фиксированные версии образов",
      languages: ["dockerfile"]
    },
    {
      id: "docker-root-user",
      category: "iac",
      message: "Контейнер запускается от root (отсутствует USER инструкция)",
      severity: "HIGH",
      pattern: "^(?!.*USER\\s+\\w+).*FROM",
      flags: "gim",
      recommendation: "Создайте непривилегированного пользователя: USER appuser",
      languages: ["dockerfile"]
    },
    {
      id: "docker-privileged-ports",
      category: "iac",
      message: "Приложение слушает привилегированные порты (ниже 1024)",
      severity: "MEDIUM",
      pattern: "^EXPOSE\\s+[0-9]{1,3}\\b",
      flags: "gim",
      recommendation: "Используйте порты выше 1024 (8080, 3000)",
      languages: ["dockerfile"]
    },
    {
      id: "docker-secrets-in-build",
      category: "iac",
      message: "Секреты передаются в build аргументах",
      severity: "CRITICAL",
      pattern: "ARG\\s+(PASSWORD|SECRET|KEY|TOKEN|API_KEY|PRIVATE_KEY)",
      flags: "gi",
      recommendation: "Используйте Docker secrets или build secrets (--secret)",
      languages: ["dockerfile"]
    },

    // ==================== IAC: KUBERNETES ====================
    {
      id: "k8s-privileged-container",
      category: "iac",
      message: "Контейнер запускается в привилегированном режиме",
      severity: "CRITICAL",
      pattern: "privileged:\\s*true",
      flags: "gim",
      recommendation: "Никогда не используйте privileged: true",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-hostpid-enabled",
      category: "iac",
      message: "Pod имеет доступ к процессам хоста (hostPID: true)",
      severity: "HIGH",
      pattern: "^\\s*hostPID:\\s*true\\s*$",
      flags: "gim",
      recommendation: "Установите hostPID: false",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-hostnetwork-enabled",
      category: "iac",
      message: "Pod использует сеть хоста (hostNetwork: true)",
      severity: "HIGH",
      pattern: "^\\s*hostNetwork:\\s*true\\s*$",
      flags: "gim",
      recommendation: "Избегайте hostNetwork, используйте ClusterIP",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-hostipc-enabled",
      category: "iac",
      message: "Pod имеет доступ к IPC хоста (hostIPC: true)",
      severity: "MEDIUM",
      pattern: "^\\s*hostIPC:\\s*true\\s*$",
      flags: "gim",
      recommendation: "Установите hostIPC: false",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-latest-image-tag",
      category: "iac",
      message: "Использование тега ':latest' для образа",
      severity: "HIGH",
      pattern: "image:\\s*[^\\s]+:latest",
      flags: "gim",
      recommendation: "Используйте фиксированный тег версии",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-missing-resources-limits",
      category: "iac",
      message: "Отсутствуют resources.limits для контейнера",
      severity: "HIGH",
      pattern: "containers:\\s*\\n(?:[\\s\\S]*?)(?=^\\s*-\\s*name:)(?![\\s\\S]*?limits:)",
      flags: "gim",
      recommendation: "Всегда устанавливайте resources.limits",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-run-as-non-root-missing",
      category: "iac",
      message: "Отсутствует runAsNonRoot: true в securityContext",
      severity: "HIGH",
      pattern: "securityContext:\\s*\\n(?![\\s\\S]*?runAsNonRoot:\\s*true)",
      flags: "gim",
      recommendation: "Установите securityContext.runAsNonRoot: true",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-run-as-non-root-false",
      category: "iac",
      message: "runAsNonRoot установлен в false",
      severity: "CRITICAL",
      pattern: "runAsNonRoot:\\s*false",
      flags: "gim",
      recommendation: "Установите runAsNonRoot: true",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-readonly-root-filesystem-missing",
      category: "iac",
      message: "Отсутствует readOnlyRootFilesystem: true",
      severity: "MEDIUM",
      pattern: "securityContext:\\s*\\n(?![\\s\\S]*?readOnlyRootFilesystem:\\s*true)",
      flags: "gim",
      recommendation: "Установите readOnlyRootFilesystem: true",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-hostpath-volume",
      category: "iac",
      message: "Использование hostPath volume - доступ к ФС узла",
      severity: "HIGH",
      pattern: "hostPath:\\s*\\n\\s*path:\\s*",
      flags: "gim",
      recommendation: "Избегайте hostPath, используйте persistentVolumeClaim",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-run-as-user-zero",
      category: "iac",
      message: "Контейнер запускается от root (runAsUser: 0)",
      severity: "CRITICAL",
      pattern: "runAsUser:\\s*0",
      flags: "gim",
      recommendation: "Запускайте приложение от не-root пользователя (runAsUser: 1000+)",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-allow-privilege-escalation",
      category: "iac",
      message: "Разрешена эскалация привилегий",
      severity: "HIGH",
      pattern: "allowPrivilegeEscalation:\\s*true",
      flags: "gim",
      recommendation: "Установите allowPrivilegeEscalation: false",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-default-service-account",
      category: "iac",
      message: "Использование default service account",
      severity: "MEDIUM",
      pattern: "serviceAccountName:\\s*default",
      flags: "gim",
      recommendation: "Создайте отдельный service account",
      languages: ["yaml", "kubernetes", "helm"]
    },

    // ==================== IAC: TERRAFORM (AWS) ====================
    {
      id: "tf-secrets-in-variables",
      category: "iac",
      message: "Секреты захардкожены в переменной",
      severity: "CRITICAL",
      pattern: "^\\s*variable\\s+\"(?:password|db_password|api_key|secret_key|token|private_key)\"\\s*\\{[^}]*default\\s*=\\s*\"(?!(?:\\$\\{|\\{\\{|changeme|placeholder|example))[^\"]+\"",
      flags: "gim",
      recommendation: "Используйте переменные окружения: TF_VAR_*",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-s3-public-acl",
      category: "iac",
      message: "S3 бакет с публичным ACL",
      severity: "HIGH",
      pattern: "^\\s*acl\\s*=\\s*\"public-read(?:-write)?\"",
      flags: "gim",
      recommendation: "Используйте acl = 'private'",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-s3-encryption-check",
      category: "iac",
      message: "S3 бакет без шифрования",
      severity: "HIGH",
      pattern: "resource\\s+\"aws_s3_bucket\"\\s+\\w+\\s*\\{(?![\\s\\S]*?server_side_encryption_configuration)",
      flags: "gim",
      recommendation: "Добавьте server_side_encryption_configuration",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-s3-versioning-check",
      category: "iac",
      message: "S3 бакет без версионирования",
      severity: "MEDIUM",
      pattern: "resource\\s+\"aws_s3_bucket\"\\s+\\w+\\s*\\{(?![\\s\\S]*?versioning\\s*\\{[\\s\\S]*?enabled\\s*=\\s*true)",
      flags: "gim",
      recommendation: "Добавьте versioning { enabled = true }",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-security-group-public-ingress",
      category: "iac",
      message: "Security group с публичным доступом (0.0.0.0/0)",
      severity: "HIGH",
      pattern: "cidr_blocks\\s*=\\s*\\[\"0\\.0\\.0\\.0/0\"\\]",
      flags: "gim",
      recommendation: "Ограничьте доступ конкретными IP",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-security-group-public-ssh",
      category: "iac",
      message: "Security group с публичным доступом к SSH (порт 22)",
      severity: "CRITICAL",
      pattern: "from_port\\s*=\\s*22[\\s\\S]*?cidr_blocks\\s*=\\s*\\[\"0\\.0\\.0\\.0/0\"\\]|cidr_blocks\\s*=\\s*\\[\"0\\.0\\.0\\.0/0\"\\][\\s\\S]*?from_port\\s*=\\s*22",
      flags: "gim",
      recommendation: "Ограничьте SSH доступ доверенными IP",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-iam-wildcard-action",
      category: "iac",
      message: "IAM policy с действием '*' (все действия)",
      severity: "CRITICAL",
      pattern: "\"Action\":\\s*\\[\"\\*\"\\]|\"Action\":\\s*\"\\*\"",
      flags: "gim",
      recommendation: "Ограничьте конкретные действия",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-iam-wildcard-resource",
      category: "iac",
      message: "IAM policy с ресурсом '*' (все ресурсы)",
      severity: "HIGH",
      pattern: "\"Resource\":\\s*\\[\"\\*\"\\]|\"Resource\":\\s*\"\\*\"",
      flags: "gim",
      recommendation: "Ограничьте конкретные ресурсы",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-rds-publicly-accessible",
      category: "iac",
      message: "RDS инстанс публично доступен",
      severity: "CRITICAL",
      pattern: "^\\s*publicly_accessible\\s*=\\s*true",
      flags: "gim",
      recommendation: "RDS должен быть в приватной подсети",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-ec2-public-ip",
      category: "iac",
      message: "EC2 инстанс с публичным IP",
      severity: "HIGH",
      pattern: "^\\s*associate_public_ip_address\\s*=\\s*true",
      flags: "gim",
      recommendation: "Используйте private IP и NAT Gateway",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-iam-access-key",
      category: "iac",
      message: "Создание IAM access key (нужна ротация)",
      severity: "MEDIUM",
      pattern: "^\\s*resource\\s+\"aws_iam_access_key\"",
      flags: "gim",
      recommendation: "Настройте автоматическую ротацию ключей",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-admin-policy-attachment",
      category: "iac",
      message: "Привязка политики администратора",
      severity: "CRITICAL",
      pattern: "policy_arn\\s*=\\s*\"arn:aws:iam::aws:policy/AdministratorAccess\"",
      flags: "gim",
      recommendation: "Используйте политики с минимальными правами",
      languages: ["hcl", "terraform"]
    },

    // ==================== IAC: GITHUB ACTIONS ====================
    {
      id: "github-actions-aws-key-hardcoded",
      category: "iac",
      message: "AWS Access Key захардкожен в GitHub Actions",
      severity: "CRITICAL",
      pattern: "AWS_ACCESS_KEY_ID\\s*=\\s*[\"']AKIA[0-9A-Z]{16}[\"']",
      flags: "gim",
      recommendation: "Используйте GitHub Secrets: \${{ secrets.AWS_ACCESS_KEY_ID }}",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-aws-secret-hardcoded",
      category: "iac",
      message: "AWS Secret Access Key захардкожен",
      severity: "CRITICAL",
      pattern: "AWS_SECRET_ACCESS_KEY\\s*=\\s*[\"'][A-Za-z0-9/+=]{40}[\"']",
      flags: "gim",
      recommendation: "Используйте GitHub Secrets",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-token-hardcoded",
      category: "iac",
      message: "GitHub токен захардкожен",
      severity: "CRITICAL",
      pattern: "(?:GITHUB_TOKEN|GH_TOKEN|TOKEN)\\s*=\\s*[\"'](ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|ghu_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|ghr_[A-Za-z0-9]{36})[\"']",
      flags: "gim",
      recommendation: "Используйте \${{ secrets.GITHUB_TOKEN }}",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-missing-permissions",
      category: "iac",
      message: "Отсутствует блок permissions для workflow",
      severity: "HIGH",
      pattern: "name:\\s*[\\s\\S]*?on:\\s*[\\s\\S]*?jobs:\\s*(?!(?:[\\s\\S]*?permissions:))",
      flags: "gim",
      recommendation: "Добавьте permissions: contents: read",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-checkout-persist-credentials",
      category: "iac",
      message: "actions/checkout с persist-credentials не указан (по умолчанию true)",
      severity: "MEDIUM",
      pattern: "uses:\\s*actions/checkout@v\\d+(?![\\s\\S]*?persist-credentials:\\s*false)",
      flags: "gim",
      recommendation: "Установите persist-credentials: false",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-run-with-user-input",
      category: "iac",
      message: "run команда использует пользовательский ввод - риск инъекции",
      severity: "HIGH",
      pattern: "run:\\s*[^\\n]*\\$\\{\\{[\\s]*github\\.event\\.(?:issue|pull_request|comment)[^}]*\\}\\}",
      flags: "gim",
      recommendation: "Экранируйте пользовательский ввод",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-self-hosted-runner",
      category: "iac",
      message: "Использование self-hosted runner без изоляции",
      severity: "HIGH",
      pattern: "runs-on:\\s*self-hosted",
      flags: "gim",
      recommendation: "Используйте эфемерные runners",
      languages: ["yaml", "github-actions"]
    },

    // ==================== IAC: HELM VALUES ====================
    {
      id: "helm-secrets-in-values",
      category: "iac",
      message: "Хардкод секретов в values.yaml",
      severity: "CRITICAL",
      pattern: "^(?!\\s*#)(?:password|pass|pwd|secret|api_key|apiKey|token|access_token|privateKey|secretKey|client_secret)\\s*:\\s*['\"]?(?!\\{\\{|\\$\\{|changeme|placeholder|example|test\\d+|''|\"\")([^'\"\\s\\n]{4,})['\"]?",
      flags: "gim",
      recommendation: "Используйте Kubernetes Secrets или SealedSecrets",
      languages: ["yaml", "helm"]
    },
    {
      id: "helm-latest-tag",
      category: "iac",
      message: "Использование тега ':latest' для образа",
      severity: "MEDIUM",
      pattern: "^(?!\\s*#)(?:tag|version)\\s*:\\s*['\"]?latest['\"]?|image:\\s*['\"]?[^'\"\\s]+:latest['\"]?",
      flags: "gim",
      recommendation: "Используйте фиксированную версию",
      languages: ["yaml", "helm"]
    },
    {
      id: "helm-missing-resources",
      category: "iac",
      message: "Отсутствуют resources.requests и resources.limits",
      severity: "HIGH",
      pattern: "containers:\\s*\\n(?:[ \\t]+-\\s*\\n)?(?:(?![ \\t]+resources:)[^\\n]*\\n)*?(?=\\n[ \\t]*-|\\n[ \\t]*\\w)",
      flags: "gim",
      recommendation: "Всегда устанавливайте resources",
      languages: ["yaml", "helm"]
    },
    {
      id: "helm-privileged-container",
      category: "iac",
      message: "Контейнер в привилегированном режиме",
      severity: "CRITICAL",
      pattern: "^(?!\\s*#)privileged:\\s*true\\s*$",
      flags: "gim",
      recommendation: "Никогда не используйте privileged: true",
      languages: ["yaml", "helm"]
    },
    {
      id: "helm-hostpath-volume",
      category: "iac",
      message: "Использование hostPath volume",
      severity: "HIGH",
      pattern: "^(?!\\s*#)hostPath:\\s*\\n\\s*path:\\s*",
      flags: "gim",
      recommendation: "Избегайте hostPath, используйте PVC",
      languages: ["yaml", "helm"]
    }
  ]
};

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

export function getRulesByCategory(category) {
  if (!category) return SAST_RULES.rules;
  return SAST_RULES.rules.filter(rule => rule.category === category);
}

export function getRulesBySeverity(severity) {
  if (!severity) return SAST_RULES.rules;
  return SAST_RULES.rules.filter(rule => rule.severity === severity.toUpperCase());
}

export function getRulesByLanguage(language) {
  if (!language) return SAST_RULES.rules;
  const lang = language.toLowerCase();
  return SAST_RULES.rules.filter(rule => {
    if (!rule.languages) return true;
    if (rule.languages.includes('all')) return true;
    return rule.languages.some(l => l.toLowerCase() === lang);
  });
}

export function getRulesStats() {
  const stats = {
    total: SAST_RULES.rules.length,
    byCategory: {},
    bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 }
  };
  
  for (const rule of SAST_RULES.rules) {
    stats.byCategory[rule.category] = (stats.byCategory[rule.category] || 0) + 1;
    if (stats.bySeverity[rule.severity] !== undefined) {
      stats.bySeverity[rule.severity]++;
    }
  }
  
  return stats;
}

export default SAST_RULES;