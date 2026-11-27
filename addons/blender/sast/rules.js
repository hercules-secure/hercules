export const SAST_RULES = {
  name: "Hercules Security Rules",
  version: "4.6.0",
  description: "Precise security rules with minimal false positives (updated: C# / ASP.NET Core coverage)",
  categories: {
    credentials: "Credentials and Secrets",
    injection: "Injections (SQL, Command, LDAP, NoSQL)",
    crypto: "Cryptography and Encryption",
    ssrf: "SSRF and Network Security",
    iac: "Infrastructure as Code (Kubernetes, Terraform, Docker, GitHub Actions)",
    config: "Configuration and Logging",
    "rate-limit": "Rate Limiting and DoS Protection",
    memory: "Memory Safety (C/C++)",
    owasp: "OWASP Top 10",
    ldap: "LDAP Security",
    "rest-api": "REST API Security",
    "grpc-api": "gRPC API Security",
    "graphql-api": "GraphQL API Security",
    authorization: "Authorization and Access Control",
    "file-system": "File System and Paths",
    "error-handling": "Error Handling",
    "api-security": "API Security",
    container: "Containers and Images",
    python: "Python Specific",
    go: "Go Specific",
    java: "Java Specific",
    rust: "Rust Specific",
    csharp: "C# / ASP.NET Core Specific", // [C#]
    nginx: "Nginx Configuration",
    apache: "Apache Configuration"
  },
  rules: [
    // ==================== CREDENTIALS ====================
    {
      id: "hardcoded-credentials",
      category: "credentials",
      message: "Hardcoded credentials detected",
      severity: "CRITICAL",
      pattern: "(?:password|pass|pwd|secret|api[_-]?key|token|access[_-]?token|refresh[_-]?token|privateKey|secretKey|apiSecret|signingKey|encryptionKey|hmacSecret)\\s*[=:]\\s*['\"`](?![^'\"`]*\\$\\{[^}]+\\})(?![^'\"`]*process\\.env)(?![^'\"`]*placeholder)(?![^'\"`]*example)(?![^'\"`]*test)(?![^'\"`]*\\{\\{)(?![^'\"`]*\\bpassword\\b)[^'\"`\\s]{8,}['\"`]",
      flags: "gi",
      negative_pattern: "(?:locale.*\\.json|\\.?i18n|translation|l10n|localization|locale-|assets/locale|localization\\.constants|LOCALIZATION)",
      recommendation: "Use environment variables or a secret manager",
      languages: ["javascript", "typescript", "python", "java", "php", "ruby", "go", "csharp", "rust"]
    },
    {
      id: "hardcoded-db-connection",
      category: "credentials",
      message: "Database connection string contains a password",
      severity: "CRITICAL",
      pattern: "(?:mongodb|postgresql|mysql|redis|mongodb\\+srv):\\/\\/[^\\s'\"]+:[^\\s'\"]+@",
      flags: "gi",
      recommendation: "Use environment variables for DATABASE_URL",
      languages: ["all"]
    },
    {
      id: "hardcoded-aws-credentials",
      category: "credentials",
      message: "AWS access keys are hardcoded",
      severity: "CRITICAL",
      pattern: "(?:AKIA|ASIA)[0-9A-Z]{16}",
      flags: "gi",
      recommendation: "Use IAM roles or AWS Secrets Manager",
      languages: ["all"]
    },
    {
      id: "hardcoded-jwt-secret",
      category: "credentials",
      message: "JWT secret is hardcoded",
      severity: "CRITICAL",
      pattern: "(?:jwtSecret|JWT_SECRET|jwt-secret|JWT_SECRET_KEY|jwtPrivateKey|JWT_PRIVATE_KEY)\\s*[=:]\\s*['\"`][^'\"`]{8,}['\"`]",
      flags: "gi",
      negative_pattern: "(?:process\\.env|\\$\\{|\\{\\{|changeme|placeholder|example)",
      recommendation: "Use environment variables for JWT secret",
      languages: ["javascript", "typescript", "python", "java", "go", "csharp"]
    },
    {
      id: "jwt-token-exposure",
      category: "credentials",
      message: "JWT token found in code",
      severity: "HIGH",
      pattern: "eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+",
      flags: "gi",
      recommendation: "Use environment variables for JWT tokens",
      languages: ["all"]
    },
    {
      id: "hardcoded-credentials-json-fp",
      category: "credentials",
      message: "[IGNORE] String with 'password' in localization files",
      severity: "INFO",
      pattern: "\"(?:Password|password|enterPassword|CurrentPassword|NewPassword|ConfirmPassword)\":\\s*\"[^\"]*\"",
      flags: "gi",
      negative_pattern: "(?:.*\\.(?:ts|js|py|java|go|rs|rb|php)$)",
      recommendation: "This is a false positive - ignore for localization files",
      languages: ["json", "all"]
    },
    // ==================== API KEYS ====================
    {
      id: "api-key-in-url",
      category: "credentials",
      message: "API key passed in URL (query parameter)",
      severity: "CRITICAL",
      pattern: "[?&](?:api_key|apikey|api-key|token|access_token|auth_token)\\s*=\\s*[A-Za-z0-9_-]{8,}",
      flags: "gi",
      recommendation: "Pass API keys in headers (Authorization: Bearer)",
      languages: ["all"]
    },
    {
      id: "env-file-contains-secrets",
      category: "credentials",
      message: ".env file contains sensitive data",
      severity: "CRITICAL",
      pattern: "^(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY|SECRET_KEY|DB_PASSWORD|REDIS_PASSWORD|JWT_SECRET|ENCRYPTION_KEY|OAUTH_CLIENT_SECRET|STRIPE_SECRET_KEY)\\s*=\\s*['\"]?(?!\\$\\{|changeme|placeholder|example)[^'\"\\s\\n]+['\"]?",
      flags: "gim",
      recommendation: "Use a secret manager, do not store .env in the repository",
      languages: ["env"]
    },
    // [C#] web.config / app.config connection strings with password
    {
      id: "csharp-config-connection-string-password",
      category: "credentials",
      message: "Connection string with password in web.config/app.config",
      severity: "CRITICAL",
      pattern: "<add\\s+name=\"[^\"]*(?:connection|conn)[^\"]*\"\\s+connectionString=\"[^\"]*(?:Password|Pwd)\\s*=\\s*[^;\"]+",
      flags: "gi",
      recommendation: "Use Windows DPAPI, Azure Key Vault or user secrets",
      languages: ["csharp", "xml", "config"]
    },

    // ==================== INJECTION ====================
    {
      id: "command-injection",
      category: "injection",
      message: "Potential command injection via string concatenation",
      severity: "CRITICAL",
      // [C#] Добавлены Process.Start, ProcessStartInfo
      pattern: "(?:exec|system|popen|Runtime\\.exec|subprocess\\.call|os\\.system|std::process::Command|Process\\.Start)\\s*\\([^)]*\\+(?:req|request|params|input|data|user|cmd|command|model|Model|Request)",
      flags: "gi",
      recommendation: "Use an argument array instead of string concatenation",
      languages: ["javascript", "typescript", "python", "java", "php", "go", "rust", "ruby", "csharp"],
      negative_pattern: "(?:\\/api\\/|\\/v\\d+\\/|https?:\\/\\/|backend\\/src\\/data\\/.*\\.ts$)"
    },
    {
      id: "sql-injection",
      category: "injection",
      message: "Potential SQL injection via string concatenation",
      severity: "CRITICAL",
      pattern: "(?:execute|query|exec|raw|executeQuery|createQuery|prepare|SqlCommand|OleDbCommand|MySqlCommand|NpgsqlCommand|OracleCommand|db\\.|pool\\.|connection\\.|conn\\.)\\s*\\(\\s*['\"`]\\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\\b(?!.*\\b(?:logToFile|logger|console|toast|notify|writeLog)\\b)[^'\"`]*['\"`]\\s*\\+\\s*(?:req\\.|params\\.|query\\.|body\\.|input|data|user|cmd|model|Model|Request)",
      flags: "gi",
      recommendation: "Use parameterized queries",
      languages: ["javascript", "typescript", "python", "java", "php", "go", "ruby", "csharp", "rust"],
      negative_pattern: "(?:\\/api\\/|\\/v\\d+\\/|https?:\\/\\/|\\/\\w+\\/\\$\\{\\w+\\.\\w+\\}|subnet\\.id|userId|accountId|documentId|\\?|&|=|%20|\\$\\{.*?\\.id\\}|\\/\\$\\{[^}]+\\}|\\.(?:json|xml|html|css|js|png|jpg|jpeg|gif|svg|ico)$|backend\\/src\\/data\\/.*\\.ts$|\\.(?:spec|test|mock)\\.[jt]s$|\\bSqlParameter\\b|\\bParameters\\.Add)"
    },
    {
      id: "sql-injection-template",
      category: "injection",
      message: "Potential SQL injection in template string",
      severity: "CRITICAL",
      pattern: "(?:query|execute|exec|raw|executeQuery|createQuery|prepare|SqlCommand|OleDbCommand|MySqlCommand|NpgsqlCommand|OracleCommand|db\\.|pool\\.|connection\\.|conn\\.)\\s*\\(\\s*`[^`]*?\\b(?:SELECT\\b[^`]*?\\bFROM\\b|INSERT\\s+INTO\\b|UPDATE\\s+\\w+\\s+SET\\b|DELETE\\s+FROM\\b|DROP\\s+TABLE\\b|CREATE\\s+TABLE\\b|ALTER\\s+TABLE\\b)[^`]*?\\$\\{[^}]+\\}[^`]*?`",
      flags: "gi",
      recommendation: "Use parameterized queries, avoid interpolation in SQL",
      languages: ["javascript", "typescript"],
      negative_pattern: "(?:\\/api\\/|\\/v\\d+\\/|https?:\\/\\/|\\/\\w+\\/\\$\\{\\w+\\.\\w+\\}|subnet\\.id|userId|accountId|documentId|\\?|&|=|%20|\\/\\$\\{[^}]+\\}|\\.(?:json|xml|html|css|js|png|jpg|jpeg|gif|svg|ico)$|backend\\/src\\/data\\/.*\\.ts$|\\.(?:model|service|controller|routes)\\.[jt]s$|\\.(?:spec|test|mock)\\.[jt]s$)"
    },
    // [C#] Интерполяция в SQL — $"SELECT ... {userInput}"
    {
      id: "csharp-sql-injection-interpolation",
      category: "injection",
      message: "SQL injection via string interpolation ($\"...\")",
      severity: "CRITICAL",
      pattern: "\\$@?\"[^\"]*(?:SELECT\\s+.*?\\s+FROM|INSERT\\s+INTO|UPDATE\\s+\\w+\\s+SET|DELETE\\s+FROM|DROP\\s+TABLE)[^\"]*\\{[^}]+\\}[^\"]*\"",
      flags: "gi",
      recommendation: "Use SqlParameter / parameterized queries",
      languages: ["csharp"],
      negative_pattern: "(?:\\bSqlParameter\\b|\\bParameters\\.Add\\b|\\b@\\w+)"
    },
    {
        id: "sql-injection-orm",
        category: "injection",
        message: "Potential SQL injection via ORM methods",
        severity: "HIGH",
        pattern: "(?:TypeORM|Sequelize|Mongoose|Knex)\\s*\\.(?:query|raw|execute)\\s*\\(\\s*`[^`]*?\\$\\{[^}]+\\}[^`]*?`",
        flags: "gi",
        recommendation: "Use parameterized queries with placeholders",
        languages: ["javascript", "typescript"],
        negative_pattern: "(?:\\?|\\$1|\\:\\w+|@\\w+|\\/api\\/|\\/v\\d+\\/|https?:\\/\\/|backend\\/src\\/data\\/.*\\.ts$|\\.(?:spec|test|mock)\\.[jt]s$)"
      },
    {
      id: "nosql-injection",
      category: "injection",
      message: "Potential NoSQL injection",
      severity: "CRITICAL",
      pattern: "(?:\\$where|\\$regex|\\$ne|\\$gt|\\$lt|\\$in|\\$nin|\\$or)\\s*:[^}]*(?:req\\.|params\\.|query\\.|body\\.|input)",
      flags: "gi",
      recommendation: "Sanitize input data, use parameterization",
      languages: ["javascript", "typescript", "python", "java", "go", "csharp"] // [C#]
    },
    {
      id: "ldap-injection",
      category: "ldap",
      message: "Potential LDAP injection",
      severity: "CRITICAL",
      pattern: "(?:ldap_search|ldap_bind|LdapContext|DirectorySearcher|SearchRequest)\\s*\\([^)]*\\+(?:req|request|params|input|username|password|filter|dn)(?!.*(?:escapeLdapFilter|sanitizeLdap|LdapEncoder))",
      flags: "gi",
      recommendation: "Use LDAP special character escaping",
      languages: ["php", "java", "python", "csharp", "javascript", "typescript"]
    },
    {
      id: "xss",
      category: "injection",
      message: "Potential XSS vulnerability via innerHTML",
      severity: "HIGH",
      pattern: "(?:innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML)\\s*=\\s*(?:req\\.|params\\.|query\\.|body\\.|input|data|user)",
      flags: "gi",
      recommendation: "Use textContent or DOMPurify",
      languages: ["javascript", "typescript"],
      negative_pattern: "innerHTML\\s*=\\s*['\"`]\\s*['\"`]"
    },
    {
      id: "xxe",
      category: "injection",
      message: "XXE (XML External Entity) vulnerability",
      severity: "CRITICAL",
      // [C#] Добавлены LoadXml / XmlReader.Create
      pattern: "(?:XMLReader|SAXReader|DocumentBuilder|XmlDocument|SimpleXML|DOMDocument).*?(?:parse|load|LoadXml)\\s*\\([^)]*(?!.*(?:disable|Feature|PROHIBIT_DTD|DtdProcessing\\.Prohibit|DtdProcessing\\.Ignore|XmlResolver\\s*=\\s*null))",
      flags: "gi",
      recommendation: "Disable external entities in XML parser",
      languages: ["java", "python", "php", "csharp", "javascript", "typescript"]
    },

    // ==================== ReDOS BY LANGUAGE ====================
    {
      id: "regex-dos-js",
      category: "injection",
      message: "Potential ReDoS vulnerability in regular expression",
      severity: "MEDIUM",
      pattern: "(?:new\\s+RegExp\\s*\\(\\s*['\"`][^'\"`]*?(?:\\([a-zA-Z_][a-zA-Z0-9_]*\\+\\)\\s*\\+|\\[\\^[^\\]]*\\]\\s*\\+\\s*\\*|\\w+\\+\\s*\\w+\\+\\s*\\w+)[^'\"`]*?['\"`]\\s*\\)|/(?!\\^)[^/]*?(?:\\([a-zA-Z_][a-zA-Z0-9_]*\\+\\)\\s*\\+|[+*]\\s*[+*]|\\[[^\\]]*\\]\\s*[+*]\\s*[+*])[^/]*/[gimuy]*)",
      flags: "gi",
      negative_pattern: "(?:base64|[A-Za-z0-9+/]{20,}={0,2}|data:image/|blob:|%[0-9A-Fa-f]{2}|import\\s+['\"`]|from\\s+['\"`]|templateUrl|styleUrls|\\.(?:spec|test|mock)\\.[jt]s$|\\/\\/|\\/\\*|\\*\\/|^\\s*#)",
      recommendation: "Use atomic groups (?>...), limit input length",
      languages: ["javascript", "typescript"]
    },
    {
      id: "regex-dos-go",
      category: "injection",
      message: "Potential ReDoS vulnerability in regular expression",
      severity: "MEDIUM",
      pattern: "regexp\\.(?:MustCompile|Compile)\\s*\\(\\s*`[^`]*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\(\\w+\\+\\)\\s*\\*|\\(\\w+\\*\\)\\s*\\+|\\[\\^[^\\]]*\\]\\s*\\+\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^`]*?`\\s*\\)",
      flags: "gi",
      negative_pattern: "(?:strings\\.|fmt\\.|strconv\\.|bytes\\.|encoding/|json\\.|yaml\\.|regexp\\.QuoteMeta|path\\.|filepath\\.|^\\s*//|^\\s*#|\\/\\/|\\/\\*|\\*\\/)",
      recommendation: "Use atomic groups (?>...) or rewrite the regular expression",
      languages: ["go"]
    },
    {
      id: "regex-dos-python",
      category: "injection",
      message: "Potential ReDoS vulnerability in regular expression",
      severity: "MEDIUM",
      pattern: "re\\.(?:compile|search|match|findall|finditer|sub|split)\\s*\\(\\s*r?['\"`][^'\"`]*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^'\"`]*?['\"`]",
      flags: "gi",
      negative_pattern: "re\\.escape|^\\s*#|\\/\\/|\\/\\*|\\*\\/",
      recommendation: "Use the 'regex' module with atomic group support",
      languages: ["python"]
    },
    {
      id: "regex-dos-java",
      category: "injection",
      message: "Potential ReDoS vulnerability in regular expression",
      severity: "MEDIUM",
      pattern: "Pattern\\.(?:compile|matches)\\s*\\(\\s*[\"'][^\"']*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^\"']*?[\"']",
      flags: "gi",
      negative_pattern: "^\\s*\\/\\/|^\\s*\\/\\*|\\*\\/",
      recommendation: "Use (?>...) atomic groups, enable RE2 mode",
      languages: ["java"]
    },
    {
      id: "regex-dos-php",
      category: "injection",
      message: "Potential ReDoS vulnerability in regular expression",
      severity: "MEDIUM",
      pattern: "(?:preg_match|preg_match_all|preg_replace|preg_filter|preg_split)\\s*\\(\\s*['\"`][^'\"`]*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w*\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^'\"`]*?['\"`]",
      flags: "gi",
      negative_pattern: "^\\s*\\/\\/|^\\s*#|\\/\\/|\\/\\*|\\*\\/",
      recommendation: "Use the 'S' modifier for analysis",
      languages: ["php"]
    },
    {
      id: "regex-dos-ruby",
      category: "injection",
      message: "Potential ReDoS vulnerability in regular expression",
      severity: "MEDIUM",
      pattern: "(?:Regexp\\.new|%r\\{)\\s*[\"'`{][^\"'`}]*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^\"'`}]*?[\"'`}]",
      flags: "gi",
      negative_pattern: "^\\s*#|\\/\\/|\\/\\*|\\*\\/",
      recommendation: "Use Oniguruma with atomic groups",
      languages: ["ruby"]
    },
    {
      id: "regex-dos-csharp",
      category: "injection",
      message: "Potential ReDoS vulnerability in regular expression",
      severity: "MEDIUM",
      pattern: "(?:Regex\\.(?:Match|Matches|Replace|Split|IsMatch)\\s*\\([^,]*,\\s*[\"'][^\"']*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^\"']*?[\"'])",
      flags: "gi",
      negative_pattern: "^\\s*\\/\\/|^\\s*\\/\\*|\\*\\/|RegexOptions\\.NonBacktracking",
      recommendation: "Set a timeout (Regex.MatchTimeout) or use RegexOptions.NonBacktracking",
      languages: ["csharp"]
    },
    {
      id: "regex-dos-rust",
      category: "injection",
      message: "Potential ReDoS vulnerability in regular expression",
      severity: "MEDIUM",
      pattern: "(?:Regex::new|regex::Regex::new)\\s*\\(\\s*[\"'][^\"']*?(?:\\(\\w+\\+\\)\\s*\\+|\\(\\w+\\*\\)\\s*\\*|\\w+\\+\\s*\\w+\\+|[+*?]\\s*[+*?]|\\(\\w+\\|\\w+\\)\\s*[+*])[^\"']*?[\"']",
      flags: "gi",
      negative_pattern: "^\\s*\\/\\/|^\\s*\\/\\*|\\*\\/",
      recommendation: "The regex library is already protected, but avoid exponential patterns",
      languages: ["rust"]
    },

    // ==================== CRYPTO ====================
    {
      id: "weak-cryptography",
      category: "crypto",
      message: "Weak cryptographic algorithm",
      severity: "HIGH",
      pattern: "\\b(?:MD5|SHA-?1|DES|RC4|RSA1024)\\s*\\(",
      flags: "gi",
      recommendation: "Use modern algorithms: SHA-256, AES-256-GCM, bcrypt, Argon2",
      languages: ["all"],
      negative_pattern: "\\/\\/.*MD5|\\*.*MD5"
    },
    {
      id: "jwt-none-algorithm",
      category: "crypto",
      message: "JWT with 'none' algorithm - critical vulnerability",
      severity: "CRITICAL",
      pattern: "\"alg\"\\s*:\\s*\"none\"",
      flags: "gi",
      recommendation: "Disable the 'none' algorithm, always verify JWT signature",
      languages: ["all"]
    },
    {
      id: "jwt-weak-algorithm",
      category: "crypto",
      message: "JWT with weak signing algorithm (HS256 for critical data)",
      severity: "HIGH",
      pattern: "\"alg\"\\s*:\\s*\"HS256\"",
      flags: "gi",
      recommendation: "Use asymmetric algorithms (RS256, ES256) for critical data",
      languages: ["all"]
    },
    // [C#] MD5.Create / SHA1.Create / DES.Create / RC2 / TripleDES
    {
      id: "csharp-weak-crypto",
      category: "crypto",
      message: "Weak cryptographic algorithm in C#",
      severity: "HIGH",
      pattern: "(?:MD5|SHA1|DES|RC2|TripleDES)\\.Create\\s*\\(|new\\s+(?:MD5CryptoServiceProvider|SHA1CryptoServiceProvider|DESCryptoServiceProvider|RC2CryptoServiceProvider|TripleDESCryptoServiceProvider)\\s*\\(",
      flags: "gi",
      recommendation: "Use SHA256/SHA512, AES-GCM; for passwords use Rfc2898DeriveBytes or Argon2",
      languages: ["csharp"]
    },

    // ==================== SSRF ====================
    {
      id: "ssrf-vulnerability",
      category: "ssrf",
      message: "SSRF: request to user-controlled URL",
      severity: "CRITICAL",
      // [C#] HttpClient.GetAsync/PostAsync, WebRequest.Create, WebClient
      pattern: "(?:axios\\.(?:get|post|put|delete|request)|fetch|http\\.get|https\\.get|requests\\.get|urllib\\.request|HttpClient|reqwest::(?:get|post|put|delete|request)|_?httpClient\\.(?:Get|Post|Put|Delete|Send)Async|WebRequest\\.Create|WebClient\\.(?:DownloadString|DownloadData|UploadString))\\s*\\(\\s*(?:req\\.query\\.\\w+|req\\.body\\.\\w+|req\\.params\\.\\w+|url|target|uri|endpoint|Request\\.Query|model\\.\\w+|input)\\s*\\)",
      flags: "gi",
      recommendation: "Validate URL against a whitelist of trusted domains",
      languages: ["javascript", "typescript", "python", "java", "go", "csharp", "rust"],
      negative_pattern: "localization\\.ts|assets\\/locale|\\/locale\\/|\\.(?:spec|test|mock)\\.[jt]s$"
    },

    // ==================== AUTHORIZATION ====================
    {
      id: "bola-idor",
      category: "authorization",
      message: "BOLA/IDOR: direct ID substitution without access control checks",
      severity: "CRITICAL",
      // [C#] [FromRoute], [FromQuery], [FromBody]
      pattern: "(?:@PathVariable|@PathParam|req\\.params\\.|req\\.query\\.|:id|:userId|:accountId|:documentId|\\[FromRoute\\]|\\[FromQuery\\]|\\[FromBody\\])\\s*(?:[\\w]+)?\\s*.*?(?:repository|service|_?repository|_?service)\\.(?:Find|FindAsync|Get|GetAsync|Delete|Update|Save|FirstOrDefault|SingleOrDefault|Remove)",
      flags: "gi",
      negative_pattern: "(?:@PreAuthorize|@AuthenticationPrincipal|checkAccess|canAccess|hasAccess|isOwner|verifyAccess|@CurrentUser|authMiddleware|isAuthenticated|\\[Authorize\\]|User\\.Identity|User\\.Claims|_?currentUser|\\.(?:spec|test|mock)\\.[jt]s$)",
      recommendation: "Add check that the current user has access to the resource",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp", "ruby"]
    },
    {
      id: "mass-assignment",
      category: "authorization",
      message: "Mass assignment - possible privilege escalation",
      severity: "HIGH",
      pattern: "(?:Model\\.(?:create|update|insert|upsert)|\\w+\\.(?:save|update|patch|assignAttributes)\\s*\\(\\s*req\\.body|req\\.body\\s*(?:=|:)\\s*\\w+|Object\\.assign\\([^,]+,\\s*req\\.(?:body|query)|c\\.(?:Bind|ShouldBind|BindJSON)\\(&\\w+\\)|fields\\s*=\\s*['\"]__all__['\"])",
      flags: "gi",
      recommendation: "Use DTO with an explicit list of allowed fields",
      languages: ["javascript", "typescript", "python", "java", "php", "go", "csharp", "ruby"]
    },
    // [C#] [Bind(...)] с Include/ModelBinder на EF-сущности
    {
      id: "csharp-overposting",
      category: "authorization",
      message: "Over-posting / mass assignment via [Bind] or missing DTO",
      severity: "HIGH",
      pattern: "\\[Bind\\(Include\\s*=\\s*\"[^\"]*(?:IsAdmin|Role|Password|Balance|OwnerId|UserId)[^\"]*\"\\)\\]",
      flags: "gi",
      recommendation: "Use a dedicated ViewModel/DTO instead of binding EF entity",
      languages: ["csharp"]
    },

    // ==================== REST API ====================
    {
      id: "rest-missing-auth",
      category: "rest-api",
      message: "REST endpoint without authentication check (check for global middleware)",
      severity: "CRITICAL",
      // [C#] [HttpPost]/[HttpGet]/[HttpPut]/[HttpDelete]/[HttpPatch]/[Route]
      pattern: "(?:@(?:PostMapping|GetMapping|PutMapping|DeleteMapping|PatchMapping)|router\\.(?:get|post|put|delete|patch|all)|app\\.(?:get|post|put|delete|patch|all)|Route::(?:get|post|put|delete|patch)|\\[Http(?:Post|Get|Put|Delete|Patch)\\])",
      flags: "gi",
      negative_pattern: "(?:@PreAuthorize|@RolesAllowed|@Secured|@AuthenticationPrincipal|@Auth|middleware\\(['\"]auth|verifyToken|checkAuth|isAuthenticated|requireAuth|authMiddleware|app\\.use.*auth|\\[Authorize\\]|\\[Authorize\\(|AddAuthentication|UseAuthentication|\\.(?:spec|test|mock)\\.[jt]s$)",
      recommendation: "Add authentication middleware or check global app.use()",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp", "ruby"]
    },
    {
      id: "rest-missing-role-check",
      category: "rest-api",
      message: "Modifying endpoint without role check",
      severity: "HIGH",
      pattern: "(?:@(?:PostMapping|PutMapping|DeleteMapping|PatchMapping)|router\\.(?:post|put|delete|patch)|app\\.(?:post|put|delete|patch)|\\[Http(?:Post|Put|Delete|Patch)\\])",
      flags: "gi",
      negative_pattern: "(?:@RolesAllowed|@PreAuthorize.*hasRole|@PreAuthorize.*hasAuthority|checkRole|isAdmin|requireAdmin|hasRole|isAuthenticated|verifyToken|authMiddleware|roleMiddleware|RBAC|permission|\\[Authorize\\(Roles|\\[Authorize\\(Policy|User\\.IsInRole|RequireRole|\\[Authorize\\]|\\.(?:spec|test|mock)\\.[jt]s$)",
      recommendation: "Restrict access by roles",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp"]
    },
    {
      id: "rest-missing-validation",
      category: "rest-api",
      message: "Missing input validation",
      severity: "MEDIUM",
      pattern: "(?:@(?:PostMapping|PutMapping|PatchMapping)|router\\.(?:post|put|patch)|app\\.(?:post|put|patch)|\\[Http(?:Post|Put|Patch)\\])",
      flags: "gi",
      negative_pattern: "(?:@Valid|@Validate|validation|sanitize|@NotNull|@NotBlank|@Size|@Pattern|bodyParser|\\[Required\\]|\\[FromBody\\].*\\[Required\\]|ModelState\\.IsValid|\\[ApiController\\]|FluentValidation|\\.(?:spec|test|mock)\\.[jt]s$)",
      recommendation: "Add input validation",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp"]
    },

    // ==================== RATE LIMIT ====================
    {
      id: "rate-limit-missing",
      category: "rate-limit",
      message: "Endpoint without rate limiting",
      severity: "MEDIUM",
      pattern: "(?:@(?:PostMapping|GetMapping|RequestMapping)|router\\.(?:post|get)|app\\.(?:post|get)|\\[Http(?:Post|Get)\\])",
      flags: "gi",
      negative_pattern: "(?:@RateLimit|rateLimiter|limiter|throttle|maxRequests|rate_limit|express-rate-limit|helmet|\\[EnableRateLimiting\\]|AddRateLimiter|UseRateLimiter|RateLimiter|\\.(?:spec|test|mock)\\.[jt]s$)",
      recommendation: "Implement rate limiting",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp"]
    },
    {
      id: "auth-endpoint-no-rate-limit",
      category: "rate-limit",
      message: "Authentication endpoint without rate limiting - vulnerable to brute force",
      severity: "CRITICAL",
      pattern: "(?:login|signin|auth|token|verify|authenticate|reset-password|change-password|Login|SignIn|Authenticate)\\s*(?:@(?:PostMapping|GetMapping)|router\\.(?:post|get)|app\\.(?:post|get)|\\[Http(?:Post|Get)\\])",
      flags: "gi",
      negative_pattern: "(?:rateLimit|throttle|maxAttempts|max_attempts|Lock|@RateLimit|express-rate-limit|\\[EnableRateLimiting\\]|UseRateLimiter|lockout|\\[Authorize\\]|\\.(?:spec|test|mock)\\.[jt]s$)",
      recommendation: "Set limit: 3-5 attempts per 5 minutes",
      languages: ["java", "javascript", "typescript", "python", "php", "go", "csharp"]
    },

    // ==================== OWASP ====================
    {
      id: "insecure-deserialization",
      category: "owasp",
      message: "Insecure deserialization",
      severity: "CRITICAL",
      pattern: "(?:pickle\\.loads|yaml\\.load\\(|unserialize|ObjectInputStream|readObject|XmlSerializer|BinaryFormatter|serde_json::from_str|serde_json::from_reader|bincode::deserialize)\\s*\\([^)]*(?!.*safe)",
      flags: "gi",
      recommendation: "Use JSON with schema validation",
      languages: ["python", "java", "php", "ruby", "csharp", "go", "rust"]
    },
    {
      id: "path-traversal",
      category: "owasp",
      message: "Potential path traversal",
      severity: "HIGH",
      pattern: "(?:fs\\.(?:readFile|writeFile|readdir|unlink|createReadStream|createWriteStream)|std::fs::(?:read|write|read_to_string|metadata)|std::fs::File::open)\\s*\\([^)]*\\.\\./",
      flags: "gi",
      recommendation: "Validate paths, use path.resolve",
      languages: ["javascript", "typescript", "python", "java", "php", "go", "rust", "csharp"]
    },
    {
      id: "eval",
      category: "owasp",
      message: "Use of eval - dangerous dynamic compilation",
      severity: "CRITICAL",
      pattern: "\\b(?:eval|Function)\\s*\\([^)]*(?:req|request|params|body|query|input|user)",
      flags: "gi",
      negative_pattern: "(?:function\\s*\\(\\s*err\\s*,\\s*req\\s*,\\s*res\\s*,\\s*next\\s*\\)|app\\.use\\s*\\(\\s*function|new\\s+Function\\s*\\(\\s*['\"`]\\s*['\"`]\\s*\\)|\\bFunction\\s*\\(\\s*['\"`]\\s*['\"`]\\s*\\)|\\.(?:spec|test|mock)\\.[jt]s$)",
      recommendation: "Avoid eval, use safe alternatives",
      languages: ["javascript", "typescript", "python"]
    },
    {
      id: "race-condition-toctou",
      category: "owasp",
      message: "TOCTOU vulnerability (Time of Check Time of Use)",
      severity: "HIGH",
      pattern: "if\\s*\\(fs\\.existsSync\\([^)]+\\)\\)\\s*\\{[^}]{0,100}fs\\.(?:readFile|writeFile|unlink|rename|chmod)",
      flags: "gi",
      recommendation: "Use atomic operations",
      languages: ["javascript", "typescript", "python", "go", "java", "csharp", "rust"]
    },
    {
      id: "http-request-smuggling",
      category: "owasp",
      message: "Potential HTTP Request Smuggling vulnerability",
      severity: "CRITICAL",
      pattern: "Content-Length:\\s*\\d+\\s*Transfer-Encoding:\\s*chunked",
      flags: "gi",
      recommendation: "Process only one header: Content-Length or Transfer-Encoding",
      languages: ["all"]
    },

    // ==================== CONFIG ====================
    {
      id: "log-sensitive-data",
      category: "config",
      message: "Logging sensitive data",
      severity: "HIGH",
      // [C#] Console.WriteLine, _logger.LogXxx
      pattern: "(?:console\\.log|logger\\.(?:info|debug|warn|error|log)|System\\.out\\.println|logging\\.info|println!|eprintln!|Console\\.Write(?:Line)?|_?logger\\.Log(?:Trace|Debug|Information|Warning|Error|Critical)|ILogger(?:<[^>]+>)?\\.Log(?:Trace|Debug|Information|Warning|Error|Critical))\\s*\\([^)]*(?:password|token|secret|api_key|apiKey|authorization|cookie|credit_card)",
      flags: "gi",
      recommendation: "Never log sensitive data",
      languages: ["javascript", "typescript", "python", "java", "go", "csharp", "php", "ruby", "rust"],
      negative_pattern: "console\\.log\\s*\\(\\s*['\"`]\\s*['\"`]\\s*\\)"
    },
    {
      id: "debug-mode-production",
      category: "config",
      message: "Debug mode enabled",
      severity: "HIGH",
      pattern: "(?:DEBUG|NODE_ENV|APP_DEBUG|DJANGO_DEBUG|FLASK_DEBUG|ASPNETCORE_ENVIRONMENT)\\s*=\\s*(?:True|true|1|'development'|'dev'|Development)",
      flags: "gi",
      recommendation: "Disable debug mode in production environment",
      languages: ["all"]
    },
    {
      id: "cors-wildcard",
      category: "config",
      message: "CORS with '*' allows access from any domain",
      severity: "MEDIUM",
      // [C#] AllowAnyOrigin()
      pattern: "(?:Access-Control-Allow-Origin|@CrossOrigin|cors\\(\\{|AllowAnyOrigin\\(\\)).{0,50}(?:\\*|origin:\\s*\\*)",
      flags: "gi",
      recommendation: "Restrict CORS to a whitelist of trusted domains",
      languages: ["javascript", "typescript", "java", "go", "csharp"]
    },
    {
      id: "config-env-exposure",
      category: "config",
      message: ".env file in repository",
      severity: "CRITICAL",
      pattern: "\\.env$",
      flags: "gi",
      recommendation: "Add .env to .gitignore",
      languages: ["all"]
    },
    {
      id: "cors-credentials-wildcard",
      category: "config",
      message: "CORS with '*' and credentials: true - insecure",
      severity: "CRITICAL",
      pattern: "Access-Control-Allow-Credentials:\\s*true[\\s\\S]*Access-Control-Allow-Origin:\\s*\\*|origin:\\s*\\*[\\s\\S]*credentials:\\s*true|AllowAnyOrigin\\(\\)[\\s\\S]{0,300}?AllowCredentials\\(\\)|AllowCredentials\\(\\)[\\s\\S]{0,300}?AllowAnyOrigin\\(\\)",
      flags: "gi",
      recommendation: "Specify specific domains in Access-Control-Allow-Origin",
      languages: ["javascript", "typescript", "csharp"]
    },

    // ==================== C/C++ ====================
    {
      id: "cpp-gets",
      category: "memory",
      message: "Dangerous gets function",
      severity: "CRITICAL",
      pattern: "\\bgets\\s*\\(",
      flags: "gi",
      recommendation: "Use fgets instead of gets",
      languages: ["c", "cpp"]
    },
    {
      id: "cpp-strcpy",
      category: "memory",
      message: "Dangerous strcpy function without bounds checking",
      severity: "HIGH",
      pattern: "\\bstrcpy\\s*\\(",
      flags: "gi",
      recommendation: "Use strncpy or strcpy_s",
      languages: ["c", "cpp"]
    },
    {
      id: "cpp-printf-injection",
      category: "injection",
      message: "printf format string with user input",
      severity: "HIGH",
      pattern: "\\bprintf\\s*\\([^,)]*\\+(?:req|request|params|input|data)",
      flags: "gi",
      recommendation: "Use printf with format string '%s', user_input",
      languages: ["c", "cpp"]
    },
    {
      id: "cpp-system",
      category: "injection",
      message: "system call with user input",
      severity: "CRITICAL",
      pattern: "\\bsystem\\s*\\([^)]*\\+",
      flags: "gi",
      recommendation: "Avoid system, use execve",
      languages: ["c", "cpp"]
    },
    {
      id: "cpp-use-after-free",
      category: "memory",
      message: "Potential use after free",
      severity: "CRITICAL",
      pattern: "delete\\s+\\w+;\\s*.*?\\b\\w+\\s*->",
      flags: "gi",
      recommendation: "Null pointers after delete",
      languages: ["c", "cpp"]
    },

    // ==================== GRPC API ====================
    {
      id: "grpc-insecure-connection",
      category: "grpc-api",
      message: "gRPC connection without TLS/SSL",
      severity: "CRITICAL",
      pattern: "(?:grpc\\.(?:connect|newClient|createChannel|createInsecure|newInsecure)|\\bInsecureChannel\\b)\\s*\\([^)]*?\\b(?:insecure|no_ssl|without_tls)\\b",
      flags: "gi",
      recommendation: "Use TLS/SSL for gRPC connections",
      languages: ["javascript", "typescript", "python", "go", "java", "csharp"]
    },
    {
      id: "grpc-missing-auth",
      category: "grpc-api",
      message: "gRPC method without authentication",
      severity: "CRITICAL",
      pattern: "rpc\\s+\\w+\\s*\\([^)]*\\)\\s*returns\\s*\\([^)]*\\)\\s*(?![\\s\\S]*option\\s*\\(google\\.api\\.http\\)\\s*=\\s*\\{[^}]*security)",
      flags: "gi",
      recommendation: "Add authentication to gRPC methods",
      languages: ["proto", "protobuf"]
    },
    {
      id: "grpc-missing-rate-limit",
      category: "grpc-api",
      message: "gRPC method without rate limiting",
      severity: "HIGH",
      pattern: "rpc\\s+\\w+\\s*\\([^)]*\\)\\s*returns\\s*\\([^)]*\\)",
      flags: "gi",
      recommendation: "Add rate limiting for gRPC methods",
      languages: ["proto", "protobuf"]
    },

    // ==================== GRAPHQL API ====================
    {
      id: "graphql-introspection-production",
      category: "graphql-api",
      message: "GraphQL introspection enabled in production",
      severity: "HIGH",
      pattern: "(?:graphql|express-graphql|apollo-server)\\s*\\(\\s*\\{[^}]*?graphiql:\\s*true[^}]*?\\}",
      flags: "gi",
      recommendation: "Disable GraphQL introspection in production",
      languages: ["javascript", "typescript", "python", "go", "java", "csharp"]
    },
    {
      id: "graphql-depth-limit-missing",
      category: "graphql-api",
      message: "Missing GraphQL query depth limit",
      severity: "HIGH",
      pattern: "graphql(?:-express|-server|\\/graphql)\\s*\\([^)]*\\{[^}]*?\\}",
      flags: "gi",
      negative_pattern: "depthLimit|maxDepth|queryDepth|GraphQLDepthLimit|depth-limit",
      recommendation: "Set query depth limit (maxDepth: 5-10)",
      languages: ["javascript", "typescript", "python", "go", "java", "csharp"]
    },
    {
      id: "graphql-query-complexity-missing",
      category: "graphql-api",
      message: "Missing GraphQL query complexity limit",
      severity: "HIGH",
      pattern: "graphql(?:-express|-server|\\/graphql)\\s*\\([^)]*\\{[^}]*?\\}",
      flags: "gi",
      negative_pattern: "complexity|maxComplexity|queryComplexity|GraphQLQueryComplexity",
      recommendation: "Set query complexity limit (maxComplexity: 100-500)",
      languages: ["javascript", "typescript", "python", "go", "java", "csharp"]
    },
    {
      id: "graphql-auth-missing",
      category: "graphql-api",
      message: "GraphQL mutation without authentication check",
      severity: "CRITICAL",
      pattern: "type\\s+Mutation\\s*\\{[^}]*\\}",
      flags: "gi",
      negative_pattern: "@auth|requireAuth|authenticated|authorization|\\[Authorize\\]",
      recommendation: "Add authentication to mutations",
      languages: ["javascript", "typescript", "python", "go", "java", "csharp"]
    },

    // ==================== PYTHON SPECIFIC ====================
    {
      id: "python-pickle-deserialization",
      category: "python",
      message: "Insecure pickle deserialization",
      severity: "CRITICAL",
      pattern: "pickle\\.loads\\s*\\([^)]*(?:req|request|params|data|input)",
      flags: "gi",
      recommendation: "Use JSON instead of pickle",
      languages: ["python"]
    },
    {
      id: "python-yaml-load",
      category: "python",
      message: "yaml.load without safe_load - dangerous deserialization",
      severity: "CRITICAL",
      pattern: "yaml\\.load\\s*\\([^)]*(?!.*safe)",
      flags: "gi",
      recommendation: "Use yaml.safe_load()",
      languages: ["python"]
    },
    {
      id: "python-jinja2-template-injection",
      category: "python",
      message: "Potential Jinja2 template injection",
      severity: "CRITICAL",
      pattern: "render_template\\s*\\([^)]*(?:request|params|data|input)",
      flags: "gi",
      recommendation: "Sanitize input data, use safe filters",
      languages: ["python"]
    },
    {
      id: "python-exec-injection",
      category: "python",
      message: "Use of exec with user input",
      severity: "CRITICAL",
      pattern: "\\bexec\\s*\\([^)]*(?:request|params|data|input)",
      flags: "gi",
      recommendation: "Avoid exec, use safe alternatives",
      languages: ["python"]
    },

    // ==================== GO SPECIFIC ====================
    {
      id: "go-ioutil-readfile",
      category: "go",
      message: "ioutil.ReadFile with user path - risk of path traversal",
      severity: "HIGH",
      pattern: "ioutil\\.ReadFile\\s*\\([^)]*\\+(?:req|request|params)",
      flags: "gi",
      recommendation: "Use filepath.Join and validate the path",
      languages: ["go"]
    },
    {
      id: "go-exec-command-injection",
      category: "go",
      message: "exec.Command with user input - risk of injection",
      severity: "CRITICAL",
      pattern: "exec\\.Command\\s*\\([^)]*\\+(?:req|request|params)",
      flags: "gi",
      recommendation: "Use exec.Command with arguments separately",
      languages: ["go"]
    },
    {
      id: "go-template-injection",
      category: "go",
      message: "Potential template injection",
      severity: "HIGH",
      pattern: "template\\.(?:Execute|ExecuteTemplate)\\s*\\([^)]*(?:req|request|params)",
      flags: "gi",
      recommendation: "Sanitize input or use html/template",
      languages: ["go"]
    },

    // ==================== JAVA SPECIFIC ====================
    {
      id: "java-jndi-injection",
      category: "java",
      message: "Potential JNDI injection (Log4Shell)",
      severity: "CRITICAL",
      pattern: "(?:InitialContext|Context)\\.lookup\\s*\\([^)]*(?:req|request|params|data)",
      flags: "gi",
      recommendation: "Use allowlist for JNDI URLs, update Log4j",
      languages: ["java"]
    },
    {
      id: "java-deserialization",
      category: "java",
      message: "Insecure Java object deserialization",
      severity: "CRITICAL",
      pattern: "(?:ObjectInputStream|readObject)\\s*\\([^)]*(?:req|request|data)",
      flags: "gi",
      recommendation: "Use JSON instead of deserialization",
      languages: ["java"]
    },
    {
      id: "java-sql-injection",
      category: "java",
      message: "SQL injection via string concatenation",
      severity: "CRITICAL",
      pattern: "(?:Statement|PreparedStatement|createStatement)\\s*\\([^)]*\\+\\s*(?:req|request|params)",
      flags: "gi",
      recommendation: "Use PreparedStatement with parameters",
      languages: ["java"]
    },

    // ==================== RUST SPECIFIC ====================
    {
      id: "rust-unwrap-dangerous",
      category: "rust",
      message: "Use of .unwrap() on Result/Option without checking",
      severity: "MEDIUM",
      pattern: "\\.unwrap\\(\\)",
      flags: "gi",
      recommendation: "Use ? or match instead of unwrap",
      languages: ["rust"]
    },
    {
      id: "rust-unwrap-expected",
      category: "rust",
      message: "Use of .unwrap() on Request/Response data",
      severity: "HIGH",
      pattern: "(?:req|request|data|input|body)\\.unwrap\\(\\)",
      flags: "gi",
      recommendation: "Use error handling with ?",
      languages: ["rust"]
    },
    {
      id: "rust-unsafe-block",
      category: "rust",
      message: "Use of unsafe block",
      severity: "LOW",
      pattern: "unsafe\\s*\\{",
      flags: "gi",
      recommendation: "Avoid unsafe, use safe alternatives",
      languages: ["rust"]
    },

    // ==================== C# / ASP.NET CORE SPECIFIC ====================
    {
      id: "csharp-process-start-shell",
      category: "csharp",
      message: "Process.Start with UseShellExecute=true or concatenated arguments — command injection",
      severity: "CRITICAL",
      pattern: "(?:UseShellExecute\\s*=\\s*true[\\s\\S]{0,300}?Arguments\\s*=|Process\\.Start\\s*\\([^)]*\\+\\s*(?:cmd|command|input|user|model|Model|Request))",
      flags: "gi",
      recommendation: "Use ProcessStartInfo { UseShellExecute = false, ArgumentList = { ... } }",
      languages: ["csharp"],
      negative_pattern: "ArgumentList\\.Add|ArgumentList\\s*="
    },
    {
      id: "csharp-binaryformatter",
      category: "csharp",
      message: "BinaryFormatter / LosFormatter deserialization — RCE risk",
      severity: "CRITICAL",
      pattern: "new\\s+(?:BinaryFormatter|LosFormatter|ObjectStateFormatter|NetDataContractSerializer|SoapFormatter)\\s*\\(",
      flags: "gi",
      recommendation: "Use System.Text.Json or DataContractSerializer with known types",
      languages: ["csharp"]
    },
    {
      id: "csharp-jwt-validation-disabled",
      category: "csharp",
      message: "JWT signature validation disabled",
      severity: "CRITICAL",
      pattern: "ValidateIssuerSigningKey\\s*=\\s*false|RequireSignedTokens\\s*=\\s*false|ValidateSignature\\s*=\\s*false|ValidateAudience\\s*=\\s*false|ValidateIssuer\\s*=\\s*false",
      flags: "gi",
      recommendation: "Never disable signature/issuer/audience validation in production",
      languages: ["csharp"]
    },
    {
      id: "csharp-jwt-signing-credentials-null",
      category: "csharp",
      message: "JWT issued with signingCredentials: null — unsigned token",
      severity: "CRITICAL",
      pattern: "new\\s+JwtSecurityToken\\s*\\([^)]*signingCredentials\\s*:\\s*null",
      flags: "gi",
      recommendation: "Always provide SigningCredentials",
      languages: ["csharp"]
    },
    {
      id: "csharp-html-raw",
      category: "csharp",
      message: "Razor @Html.Raw with user input — XSS risk",
      severity: "HIGH",
      pattern: "@Html\\.Raw\\s*\\([^)]*(?:Model|Request|ViewBag|ViewData|input|user)",
      flags: "gi",
      recommendation: "Use @Html.Encode or Razor's @model (auto-encoding)",
      languages: ["csharp", "cshtml", "razor"]
    },
    {
      id: "csharp-allow-anonymous-sensitive",
      category: "csharp",
      message: "[AllowAnonymous] on modifying endpoint",
      severity: "HIGH",
      pattern: "\\[AllowAnonymous\\][\\s\\S]{0,200}?\\[Http(?:Post|Put|Delete|Patch)\\]",
      flags: "gi",
      recommendation: "Remove [AllowAnonymous] or add explicit authorization",
      languages: ["csharp"]
    },
    {
      id: "csharp-xxe-xmldocument",
      category: "csharp",
      message: "XmlDocument.LoadXml without XmlResolver=null — XXE",
      severity: "CRITICAL",
      pattern: "XmlDocument[\\s\\S]{0,300}?\\.LoadXml\\s*\\((?![\\s\\S]{0,300}?XmlResolver\\s*=\\s*null)",
      flags: "gi",
      recommendation: "Set doc.XmlResolver = null before LoadXml",
      languages: ["csharp"],
      negative_pattern: "XmlResolver\\s*=\\s*null"
    },
    {
      id: "csharp-xxe-xmlreader",
      category: "csharp",
      message: "XmlReader.Create without DtdProcessing=Prohibit — XXE",
      severity: "CRITICAL",
      pattern: "XmlReader\\.Create\\s*\\((?![\\s\\S]{0,300}?DtdProcessing\\s*=\\s*DtdProcessing\\.(?:Prohibit|Ignore))",
      flags: "gi",
      recommendation: "Use XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit }",
      languages: ["csharp"]
    },
    {
      id: "csharp-path-combine-user-input",
      category: "csharp",
      message: "Path.Combine with user-controlled segment — path traversal",
      severity: "HIGH",
      pattern: "Path\\.Combine\\s*\\([^)]*(?:Request\\.|Request\\[|model\\.|input|user|fileName|filename)",
      flags: "gi",
      recommendation: "Validate against a known base directory, use Path.GetFullPath + StartsWith check",
      languages: ["csharp"]
    },
    {
      id: "csharp-file-read-user-input",
      category: "csharp",
      message: "File.Read* with user-controlled path",
      severity: "HIGH",
      pattern: "File\\.(?:ReadAllText|ReadAllBytes|ReadAllLines|OpenRead|OpenText|Open)\\s*\\([^)]*(?:Request\\.|Request\\[|model\\.|input|user|fileName|filename)",
      flags: "gi",
      recommendation: "Validate path, use Path.GetFullPath + allowlist base directory",
      languages: ["csharp"]
    },
    {
      id: "csharp-deserialization-json-types",
      category: "csharp",
      message: "JsonSerializer with TypeNameHandling.All / Auto — unsafe polymorphic deserialization",
      severity: "CRITICAL",
      pattern: "TypeNameHandling\\s*=\\s*TypeNameHandling\\.(?:All|Auto|Objects|Arrays)",
      flags: "gi",
      recommendation: "Use TypeNameHandling.None (default) or a safe SerializationBinder",
      languages: ["csharp"]
    },
    {
      id: "csharp-rfc2898-low-iterations",
      category: "csharp",
      message: "Rfc2898DeriveBytes with too few iterations",
      severity: "HIGH",
      pattern: "new\\s+Rfc2898DeriveBytes\\s*\\([^)]*,\\s*(?:[1-9]\\d{0,3}|10000)\\s*\\)",
      flags: "gi",
      recommendation: "Use >= 100000 iterations (OWASP 2023 recommendation)",
      languages: ["csharp"]
    },
    {
      id: "csharp-random-for-security",
      category: "csharp",
      message: "System.Random used for security-sensitive value (token/nonce/salt)",
      severity: "HIGH",
      pattern: "new\\s+Random\\s*\\([^)]*\\)[\\s\\S]{0,200}?(?:token|nonce|salt|password|session|csrf|apiKey)",
      flags: "gi",
      recommendation: "Use RandomNumberGenerator.GetBytes / RandomNumberGenerator.GetInt32",
      languages: ["csharp"]
    },
    {
      id: "csharp-insecure-cookie",
      category: "csharp",
      message: "Cookie without HttpOnly / Secure / SameSite",
      severity: "MEDIUM",
      pattern: "new\\s+CookieOptions\\s*\\{(?![\\s\\S]{0,300}?HttpOnly\\s*=\\s*true)(?![\\s\\S]{0,300}?Secure\\s*=\\s*true)",
      flags: "gi",
      recommendation: "Set HttpOnly = true, Secure = true, SameSite = SameSiteMode.Strict",
      languages: ["csharp"]
    },
    {
      id: "csharp-ssl-validation-disabled",
      category: "csharp",
      message: "TLS certificate validation disabled",
      severity: "CRITICAL",
      pattern: "ServerCertificateCustomValidationCallback\\s*=\\s*\\(?[^)]*=>\\s*true|ServicePointManager\\.ServerCertificateValidationCallback\\s*=\\s*\\(?[^)]*=>\\s*true|RemoteCertificateValidationCallback",
      flags: "gi",
      recommendation: "Never bypass certificate validation in production",
      languages: ["csharp"]
    },
    {
      id: "csharp-html-raw-frombody",
      category: "csharp",
      message: "Razor view renders raw HTML from [FromBody] / request",
      severity: "HIGH",
      pattern: "(?:HtmlString|MvcHtmlString)\\s*\\(\\s*(?:Request|Model\\.|ViewBag\\.|ViewData\\[)",
      flags: "gi",
      recommendation: "Sanitize with HtmlSanitizer / Ganss.Xss before rendering raw",
      languages: ["csharp", "cshtml", "razor"]
    },
    {
      id: "csharp-ef-raw-sql-interpolation",
      category: "csharp",
      message: "EF Core FromSqlRaw/ExecuteSqlRaw with interpolation — SQL injection",
      severity: "CRITICAL",
      pattern: "(?:FromSqlRaw|ExecuteSqlRaw|ExecuteSqlRawAsync|FromSqlInterpolated)\\s*\\(\\s*\\$?\"[^\"]*(?:SELECT|INSERT|UPDATE|DELETE)[^\"]*\\{[^}]+\\}",
      flags: "gi",
      recommendation: "Use FromSqlInterpolated with FormattableString or FromSqlRaw with parameters",
      languages: ["csharp"]
    },
    {
      id: "csharp-ef-raw-concat",
      category: "csharp",
      message: "EF Core FromSqlRaw with string concatenation — SQL injection",
      severity: "CRITICAL",
      pattern: "(?:FromSqlRaw|ExecuteSqlRaw|ExecuteSqlRawAsync)\\s*\\(\\s*\"[^\"]*(?:SELECT|INSERT|UPDATE|DELETE)[^\"]*\"\\s*\\+",
      flags: "gi",
      recommendation: "Use parameterized FromSqlRaw(sql, params)",
      languages: ["csharp"]
    },
    {
      id: "csharp-anti-forgery-disabled",
      category: "csharp",
      message: "CSRF protection disabled (IgnoreAntiforgeryToken)",
      severity: "HIGH",
      pattern: "\\[IgnoreAntiforgeryToken\\]|AutoValidateAntiforgeryTokenAttribute\\s*\\(\\s*false",
      flags: "gi",
      recommendation: "Keep antiforgery validation for state-changing endpoints",
      languages: ["csharp"]
    },
    {
      id: "csharp-request-validation-disabled",
      category: "csharp",
      message: "Request validation disabled — XSS risk",
      severity: "HIGH",
      pattern: "ValidateInput\\s*\\(\\s*false\\s*\\)|\\[ValidateInput\\s*\\(\\s*false\\s*\\)\\]|RequestValidationMode\\s*=\\s*\"?2\\.0\"?",
      flags: "gi",
      recommendation: "Do not disable request validation; encode output properly",
      languages: ["csharp", "config"]
    },
    {
      id: "csharp-aspnet-custom-errors-off",
      category: "csharp",
      message: "ASP.NET customErrors off / detailed errors in production",
      severity: "MEDIUM",
      pattern: "<customErrors\\s+mode=\"Off\"|<compilation\\s+[^>]*debug=\"true\"|AddDeveloperExceptionPage\\s*\\(",
      flags: "gi",
      recommendation: "Use mode=\"On\" / mode=\"RemoteOnly\" in production",
      languages: ["csharp", "config", "xml"]
    },

    // ==================== IAC: DOCKER ====================
    {
      id: "docker-latest-tag",
      category: "iac",
      message: "Use of 'latest' tag in Docker image",
      severity: "MEDIUM",
      pattern: "^FROM\\s+[a-zA-Z0-9/._-]+:latest\\s*$",
      flags: "gim",
      recommendation: "Use fixed image versions",
      languages: ["dockerfile"]
    },
    {
      id: "docker-root-user",
      category: "iac",
      message: "Container runs as root (missing USER instruction)",
      severity: "HIGH",
      pattern: "^(?!.*USER\\s+\\w+).*FROM",
      flags: "gim",
      recommendation: "Create a non-privileged user: USER appuser",
      languages: ["dockerfile"]
    },
    {
      id: "docker-privileged-ports",
      category: "iac",
      message: "Application listens on privileged ports (below 1024)",
      severity: "MEDIUM",
      pattern: "^EXPOSE\\s+[0-9]{1,3}\\b",
      flags: "gim",
      recommendation: "Use ports above 1024 (8080, 3000)",
      languages: ["dockerfile"]
    },
    {
      id: "docker-secrets-in-build",
      category: "iac",
      message: "Secrets passed as build arguments",
      severity: "CRITICAL",
      pattern: "ARG\\s+(PASSWORD|SECRET|KEY|TOKEN|API_KEY|PRIVATE_KEY)",
      flags: "gi",
      recommendation: "Use Docker secrets or build secrets (--secret)",
      languages: ["dockerfile"]
    },
    {
      id: "docker-missing-healthcheck",
      category: "iac",
      message: "Missing HEALTHCHECK instruction",
      severity: "MEDIUM",
      pattern: "^(?!.*HEALTHCHECK).*FROM",
      flags: "gim",
      recommendation: "Add HEALTHCHECK for monitoring",
      languages: ["dockerfile"]
    },
    {
      id: "docker-copy-chown",
      category: "iac",
      message: "COPY with chown for root user",
      severity: "HIGH",
      pattern: "COPY\\s+--chown=root:\\w+",
      flags: "gi",
      recommendation: "Use --chown=appuser:appgroup",
      languages: ["dockerfile"]
    },

    // ==================== IAC: KUBERNETES ====================
    {
      id: "k8s-privileged-container",
      category: "iac",
      message: "Container runs in privileged mode",
      severity: "CRITICAL",
      pattern: "privileged:\\s*true",
      flags: "gim",
      recommendation: "Never use privileged: true",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-hostpid-enabled",
      category: "iac",
      message: "Pod has access to host processes (hostPID: true)",
      severity: "HIGH",
      pattern: "^\\s*hostPID:\\s*true\\s*$",
      flags: "gim",
      recommendation: "Set hostPID: false",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-hostnetwork-enabled",
      category: "iac",
      message: "Pod uses host network (hostNetwork: true)",
      severity: "HIGH",
      pattern: "^\\s*hostNetwork:\\s*true\\s*$",
      flags: "gim",
      recommendation: "Avoid hostNetwork, use ClusterIP",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-hostipc-enabled",
      category: "iac",
      message: "Pod has access to host IPC (hostIPC: true)",
      severity: "MEDIUM",
      pattern: "^\\s*hostIPC:\\s*true\\s*$",
      flags: "gim",
      recommendation: "Set hostIPC: false",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-latest-image-tag",
      category: "iac",
      message: "Use of ':latest' tag for image",
      severity: "HIGH",
      pattern: "image:\\s*[^\\s]+:latest",
      flags: "gim",
      recommendation: "Use fixed version tag",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-missing-resources-limits",
      category: "iac",
      message: "Missing resources.limits for container",
      severity: "HIGH",
      pattern: "(?:^|\\n)\\s*-\\s*name:\\s*\\w+[\\s\\S]*?(?=\\n\\s*-\\s*name:|\\n\\s*\\w+:|\\Z)(?![\\s\\S]*?limits:)",
      flags: "gi",
      recommendation: "Always set resources.limits",
      languages: ["yaml", "kubernetes", "helm"],
      negative_pattern: "kind:\\s*(?:Namespace|ConfigMap|Secret|ServiceAccount|Service|Ingress|PersistentVolume|PersistentVolumeClaim|StorageClass|ClusterRole|ClusterRoleBinding|Role|RoleBinding|NetworkPolicy|PodDisruptionBudget|HorizontalPodAutoscaler|PodSecurityPolicy)"
    },
    {
      id: "k8s-run-as-non-root-missing",
      category: "iac",
      message: "Missing runAsNonRoot: true in securityContext",
      severity: "HIGH",
      pattern: "securityContext:\\s*\\n(?![\\s\\S]*?runAsNonRoot:\\s*true)",
      flags: "gim",
      recommendation: "Set securityContext.runAsNonRoot: true",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-run-as-non-root-false",
      category: "iac",
      message: "runAsNonRoot set to false",
      severity: "CRITICAL",
      pattern: "runAsNonRoot:\\s*false",
      flags: "gim",
      recommendation: "Set runAsNonRoot: true",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-readonly-root-filesystem-missing",
      category: "iac",
      message: "Missing readOnlyRootFilesystem: true",
      severity: "MEDIUM",
      pattern: "securityContext:\\s*\\n(?![\\s\\S]*?readOnlyRootFilesystem:\\s*true)",
      flags: "gim",
      recommendation: "Set readOnlyRootFilesystem: true",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-hostpath-volume",
      category: "iac",
      message: "Use of hostPath volume - access to node filesystem",
      severity: "HIGH",
      pattern: "hostPath:\\s*\\n\\s*path:\\s*",
      flags: "gim",
      recommendation: "Avoid hostPath, use persistentVolumeClaim",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-run-as-user-zero",
      category: "iac",
      message: "Container runs as root (runAsUser: 0)",
      severity: "CRITICAL",
      pattern: "runAsUser:\\s*0",
      flags: "gim",
      recommendation: "Run application as non-root user (runAsUser: 1000+)",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-allow-privilege-escalation",
      category: "iac",
      message: "Privilege escalation allowed",
      severity: "HIGH",
      pattern: "allowPrivilegeEscalation:\\s*true",
      flags: "gim",
      recommendation: "Set allowPrivilegeEscalation: false",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "k8s-default-service-account",
      category: "iac",
      message: "Use of default service account",
      severity: "MEDIUM",
      pattern: "serviceAccountName:\\s*default",
      flags: "gim",
      recommendation: "Create a dedicated service account",
      languages: ["yaml", "kubernetes", "helm"]
    },

    // ==================== IAC: TERRAFORM (AWS) ====================
    {
      id: "tf-secrets-in-variables",
      category: "iac",
      message: "Secrets hardcoded in variable",
      severity: "CRITICAL",
      pattern: "^\\s*variable\\s+\"(?:password|db_password|api_key|secret_key|token|private_key)\"\\s*\\{[^}]*default\\s*=\\s*\"(?!(?:\\$\\{|\\{\\{|changeme|placeholder|example))[^\"]+\"",
      flags: "gim",
      recommendation: "Use environment variables: TF_VAR_*",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-s3-public-acl",
      category: "iac",
      message: "S3 bucket with public ACL",
      severity: "HIGH",
      pattern: "^\\s*acl\\s*=\\s*\"public-read(?:-write)?\"",
      flags: "gim",
      recommendation: "Use acl = 'private'",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-s3-encryption-check",
      category: "iac",
      message: "S3 bucket without encryption",
      severity: "HIGH",
      pattern: "resource\\s+\"aws_s3_bucket\"\\s+\\w+\\s*\\{(?![\\s\\S]*?server_side_encryption_configuration)",
      flags: "gim",
      recommendation: "Add server_side_encryption_configuration",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-s3-versioning-check",
      category: "iac",
      message: "S3 bucket without versioning",
      severity: "MEDIUM",
      pattern: "resource\\s+\"aws_s3_bucket\"\\s+\\w+\\s*\\{(?![\\s\\S]*?versioning\\s*\\{[\\s\\S]*?enabled\\s*=\\s*true)",
      flags: "gim",
      recommendation: "Add versioning { enabled = true }",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-security-group-public-ingress",
      category: "iac",
      message: "Security group with public access (0.0.0.0/0 or ::/0)",
      severity: "HIGH",
      pattern: "cidr_blocks\\s*=\\s*\\[\"(?:0\\.0\\.0\\.0/0|::/0)\"\\]|ipv6_cidr_blocks\\s*=\\s*\\[\"::/0\"\\]",
      flags: "gim",
      recommendation: "Restrict access to specific IPs",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-security-group-public-ssh",
      category: "iac",
      message: "Security group with public access to SSH (port 22)",
      severity: "CRITICAL",
      pattern: "from_port\\s*=\\s*22[\\s\\S]*?cidr_blocks\\s*=\\s*\\[\"0\\.0\\.0\\.0/0\"\\]|cidr_blocks\\s*=\\s*\\[\"0\\.0\\.0\\.0/0\"\\][\\s\\S]*?from_port\\s*=\\s*22",
      flags: "gim",
      recommendation: "Restrict SSH access to trusted IPs",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-iam-wildcard-action",
      category: "iac",
      message: "IAM policy with action '*' (all actions)",
      severity: "CRITICAL",
      pattern: "\"Action\":\\s*\\[\"\\*\"\\]|\"Action\":\\s*\"\\*\"",
      flags: "gim",
      recommendation: "Restrict specific actions",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-iam-wildcard-resource",
      category: "iac",
      message: "IAM policy with resource '*' (all resources)",
      severity: "HIGH",
      pattern: "\"Resource\":\\s*\\[\"\\*\"\\]|\"Resource\":\\s*\"\\*\"",
      flags: "gim",
      recommendation: "Restrict specific resources",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-rds-publicly-accessible",
      category: "iac",
      message: "RDS instance publicly accessible",
      severity: "CRITICAL",
      pattern: "^\\s*publicly_accessible\\s*=\\s*true",
      flags: "gim",
      recommendation: "RDS should be in a private subnet",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-ec2-public-ip",
      category: "iac",
      message: "EC2 instance with public IP",
      severity: "HIGH",
      pattern: "^\\s*associate_public_ip_address\\s*=\\s*true",
      flags: "gim",
      recommendation: "Use private IP and NAT Gateway",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-iam-access-key",
      category: "iac",
      message: "Creating IAM access key (needs rotation)",
      severity: "MEDIUM",
      pattern: "^\\s*resource\\s+\"aws_iam_access_key\"",
      flags: "gim",
      recommendation: "Set up automatic key rotation",
      languages: ["hcl", "terraform"]
    },
    {
      id: "tf-admin-policy-attachment",
      category: "iac",
      message: "Administrator policy attachment",
      severity: "CRITICAL",
      pattern: "policy_arn\\s*=\\s*\"arn:aws:iam::aws:policy/AdministratorAccess\"",
      flags: "gim",
      recommendation: "Use least privilege policies",
      languages: ["hcl", "terraform"]
    },

    // ==================== IAC: GITHUB ACTIONS ====================
    {
      id: "github-actions-aws-key-hardcoded",
      category: "iac",
      message: "AWS Access Key hardcoded in GitHub Actions",
      severity: "CRITICAL",
      pattern: "AWS_ACCESS_KEY_ID\\s*=\\s*[\"']AKIA[0-9A-Z]{16}[\"']",
      flags: "gim",
      recommendation: "Use GitHub Secrets: \${{ secrets.AWS_ACCESS_KEY_ID }}",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-aws-secret-hardcoded",
      category: "iac",
      message: "AWS Secret Access Key hardcoded",
      severity: "CRITICAL",
      pattern: "AWS_SECRET_ACCESS_KEY\\s*=\\s*[\"'][A-Za-z0-9/+=]{40}[\"']",
      flags: "gim",
      recommendation: "Use GitHub Secrets",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-token-hardcoded",
      category: "iac",
      message: "GitHub token hardcoded",
      severity: "CRITICAL",
      pattern: "(?:GITHUB_TOKEN|GH_TOKEN|TOKEN)\\s*=\\s*[\"'](ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|ghu_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|ghr_[A-Za-z0-9]{36})[\"']",
      flags: "gim",
      recommendation: "Use \${{ secrets.GITHUB_TOKEN }}",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-missing-permissions",
      category: "iac",
      message: "Missing permissions block for workflow",
      severity: "HIGH",
      pattern: "name:\\s*[\\s\\S]*?on:\\s*[\\s\\S]*?jobs:\\s*(?!(?:[\\s\\S]*?permissions:))",
      flags: "gim",
      recommendation: "Add permissions: contents: read",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-checkout-persist-credentials",
      category: "iac",
      message: "actions/checkout with persist-credentials not specified (defaults to true)",
      severity: "MEDIUM",
      pattern: "uses:\\s*actions/checkout@v\\d+(?![\\s\\S]*?persist-credentials:\\s*false)",
      flags: "gim",
      recommendation: "Set persist-credentials: false",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-run-with-user-input",
      category: "iac",
      message: "run command uses user input - risk of injection",
      severity: "HIGH",
      pattern: "run:\\s*[^\\n]*\\$\\{\\{[\\s]*github\\.event\\.(?:issue|pull_request|comment)[^}]*\\}\\}",
      flags: "gim",
      recommendation: "Escape user input",
      languages: ["yaml", "github-actions"]
    },
    {
      id: "github-actions-self-hosted-runner",
      category: "iac",
      message: "Use of self-hosted runner without isolation",
      severity: "HIGH",
      pattern: "runs-on:\\s*self-hosted",
      flags: "gim",
      recommendation: "Use ephemeral runners",
      languages: ["yaml", "github-actions"]
    },

    // ==================== IAC: HELM VALUES ====================
    {
      id: "helm-secrets-in-values",
      category: "iac",
      message: "Secrets hardcoded in values.yaml",
      severity: "CRITICAL",
      pattern: "^(?!\\s*#)(?:password|pass|pwd|secret|api_key|apiKey|token|access_token|privateKey|secretKey|client_secret)\\s*:\\s*['\"]?(?!\\{\\{|\\$\\{|changeme|placeholder|example|test\\d+|''|\"\"|\\.Values\\.|\\.[a-zA-Z_][a-zA-Z0-9_]*\\.)([^'\"\\s\\n]{4,})['\"]?",
      flags: "gim",
      recommendation: "Use Kubernetes Secrets or SealedSecrets",
      languages: ["yaml", "helm"]
    },
    {
      id: "helm-latest-tag",
      category: "iac",
      message: "Use of ':latest' tag for image",
      severity: "MEDIUM",
      pattern: "^(?!\\s*#)(?:tag|version)\\s*:\\s*['\"]?latest['\"]?|image:\\s*['\"]?[^'\"\\s]+:latest['\"]?",
      flags: "gim",
      recommendation: "Use fixed version",
      languages: ["yaml", "helm"]
    },
    {
      id: "helm-missing-resources",
      category: "iac",
      message: "Missing resources.requests and resources.limits",
      severity: "HIGH",
      pattern: "containers:\\s*\\n(?:[ \\t]+-\\s*\\n)?(?:(?![ \\t]+resources:)[^\\n]*\\n)*?(?=\\n[ \\t]*-|\\n[ \\t]*\\w)",
      flags: "gim",
      recommendation: "Always set resources",
      languages: ["yaml", "helm"]
    },
    {
      id: "helm-privileged-container",
      category: "iac",
      message: "Container in privileged mode",
      severity: "CRITICAL",
      pattern: "^(?!\\s*#)privileged:\\s*true\\s*$",
      flags: "gim",
      recommendation: "Never use privileged: true",
      languages: ["yaml", "helm"]
    },
    {
      id: "helm-hostpath-volume",
      category: "iac",
      message: "Use of hostPath volume",
      severity: "HIGH",
      pattern: "^(?!\\s*#)hostPath:\\s*\\n\\s*path:\\s*",
      flags: "gim",
      recommendation: "Avoid hostPath, use PVC",
      languages: ["yaml", "helm"]
    },

    // ==================== NGINX CONFIGURATION ====================
    {
      id: "nginx-ssl-protocols-missing",
      category: "nginx",
      message: "Missing ssl_protocols directive - using outdated protocols by default",
      severity: "HIGH",
      pattern: "^\\s*server\\s*\\{[^}]*listen\\s+443[^}]*\\}(?![\\s\\S]*ssl_protocols\\s+)",
      flags: "gim",
      recommendation: "Add: ssl_protocols TLSv1.2 TLSv1.3;",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-ssl-insecure-version",
      category: "nginx",
      message: "Use of insecure SSL/TLS version",
      severity: "HIGH",
      pattern: "ssl_protocols\\s+(?:SSLv[23]|TLSv1\\b)",
      flags: "gi",
      recommendation: "Use: ssl_protocols TLSv1.2 TLSv1.3;",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-ssl-ciphers-weak",
      category: "nginx",
      message: "Use of weak SSL ciphers",
      severity: "HIGH",
      pattern: "ssl_ciphers\\s+['\"](?:[^'\"]*?(?:MD5|RC4|DES|NULL|EXPORT)[^'\"]*?)['\"]",
      flags: "gi",
      recommendation: "Use modern ciphers: ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-proxy-pass-dynamic-host",
      category: "nginx",
      message: "Dynamic proxy_pass (using variables for host) - SSRF risk",
      severity: "HIGH",
      pattern: "proxy_pass\\s+\\$[a-zA-Z_][a-zA-Z0-9_]*\\s*;",
      flags: "gi",
      recommendation: "Use hardcoded upstream or map for validation",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-header-injection",
      category: "nginx",
      message: "Using variable in add_header - HTTP Response Splitting risk",
      severity: "HIGH",
      pattern: "add_header\\s+\\S+\\s+\\$[a-zA-Z_][a-zA-Z0-9_]*\\s*;",
      flags: "gi",
      recommendation: "Restrict allowed characters via map",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-missing-http-header-security",
      category: "nginx",
      message: "Missing security headers",
      severity: "MEDIUM",
      pattern: "^\\s*server\\s*\\{[^}]*\\}(?![\\s\\S]*add_header\\s+X-Frame-Options)(?![\\s\\S]*add_header\\s+X-Content-Type-Options)(?![\\s\\S]*add_header\\s+Referrer-Policy)",
      flags: "gim",
      recommendation: "Add: add_header X-Frame-Options DENY; add_header X-Content-Type-Options nosniff; add_header Referrer-Policy strict-origin-when-cross-origin;",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-host-used",
      category: "nginx",
      message: "Using $http_host or $host in proxy - SSRF risk",
      severity: "HIGH",
      pattern: "proxy_(?:pass|set_header)\\s+[^;]*\\$(?:http_)?host[^;]*;",
      flags: "gi",
      recommendation: "Use a list of allowed domains via map",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-insecure-redirect",
      category: "nginx",
      message: "Insecure redirect using variables",
      severity: "MEDIUM",
      pattern: "rewrite\\s+[^;]*\\$http_host[^;]*\\s+permanent;",
      flags: "gi",
      negative_pattern: "(?:^\\s*#|\\$scheme://|\\$host\\s*\\$request_uri|\\/api\\/|\\/v\\d+\\/|https?:\\/\\/)",
      recommendation: "Use explicit domain or map for validation",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-missing-rate-limit",
      category: "nginx",
      message: "Missing rate limiting (limit_req)",
      severity: "MEDIUM",
      pattern: "^\\s*server\\s*\\{[^}]*\\}(?![\\s\\S]*limit_req\\s+)",
      flags: "gim",
      recommendation: "Add limit_req zone=... for DDoS protection",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-autoindex-on",
      category: "nginx",
      message: "autoindex enabled - risk of directory listing",
      severity: "HIGH",
      pattern: "autoindex\\s+on\\s*;",
      flags: "gi",
      recommendation: "Disable: autoindex off;",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-server-tokens-on",
      category: "nginx",
      message: "server_tokens enabled - exposes Nginx version",
      severity: "LOW",
      pattern: "server_tokens\\s+on\\s*;",
      flags: "gi",
      recommendation: "Disable: server_tokens off;",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-client-max-body-size-missing",
      category: "nginx",
      message: "Missing client_max_body_size - DoS risk",
      severity: "MEDIUM",
      pattern: "^\\s*http\\s*\\{[^}]*\\}(?![\\s\\S]*client_max_body_size\\s+)",
      flags: "gim",
      recommendation: "Set: client_max_body_size 10M;",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-limit-req-missing",
      category: "nginx",
      message: "Missing limit_req_zone - no brute force protection",
      severity: "HIGH",
      pattern: "^\\s*http\\s*\\{[^}]*\\}(?![\\s\\S]*limit_req_zone\\s+)",
      flags: "gim",
      recommendation: "Add: limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-allow-missing-auth",
      category: "nginx",
      message: "Admin endpoint without access restriction",
      severity: "CRITICAL",
      pattern: "location\\s+/(?:admin|administrator|cp|manager|dashboard)/\\s*\\{[^}]*\\}(?![\\s\\S]*allow\\s+[0-9])",
      flags: "gim",
      recommendation: "Restrict access: allow 192.168.0.0/16; deny all;",
      languages: ["conf", "nginx", "vhost"]
    },
    {
      id: "nginx-gzip-on",
      category: "nginx",
      message: "gzip enabled without type checking - BREACH attack risk",
      severity: "LOW",
      pattern: "gzip\\s+on\\s*;",
      flags: "gi",
      recommendation: "Restrict gzip_types to safe types",
      languages: ["conf", "nginx", "vhost"]
    },

    // ==================== APACHE CONFIGURATION ====================
    {
      id: "apache-options-indexes",
      category: "apache",
      message: "Options Indexes enabled - exposes directory structure",
      severity: "HIGH",
      pattern: "Options\\s+.*Indexes",
      flags: "gi",
      recommendation: "Remove Indexes: Options -Indexes",
      languages: ["conf", "apache", "htaccess"]
    },
    {
      id: "apache-allow-override-all",
      category: "apache",
      message: "AllowOverride All allows .htaccess modification - security bypass risk",
      severity: "HIGH",
      pattern: "AllowOverride\\s+All",
      flags: "gi",
      recommendation: "Restrict: AllowOverride None or AllowOverride AuthConfig",
      languages: ["conf", "apache", "htaccess"]
    },
    {
      id: "apache-follow-symlinks",
      category: "apache",
      message: "Options FollowSymLinks enabled - directory traversal risk",
      severity: "MEDIUM",
      pattern: "Options\\s+.*FollowSymLinks",
      flags: "gi",
      recommendation: "Use SymLinksIfOwnerMatch instead of FollowSymLinks",
      languages: ["conf", "apache", "htaccess"]
    },
    {
      id: "apache-server-signature-on",
      category: "apache",
      message: "ServerSignature enabled - exposes server version",
      severity: "LOW",
      pattern: "ServerSignature\\s+On",
      flags: "gi",
      recommendation: "Disable: ServerSignature Off",
      languages: ["conf", "apache"]
    },
    {
      id: "apache-server-tokens-full",
      category: "apache",
      message: "ServerTokens Full - exposes Apache version and modules",
      severity: "LOW",
      pattern: "ServerTokens\\s+Full",
      flags: "gi",
      recommendation: "Set: ServerTokens Prod",
      languages: ["conf", "apache"]
    },
    {
      id: "apache-trace-enable",
      category: "apache",
      message: "TraceEnable enabled - XST attack risk",
      severity: "MEDIUM",
      pattern: "TraceEnable\\s+On",
      flags: "gi",
      recommendation: "Disable: TraceEnable Off",
      languages: ["conf", "apache"]
    },
    {
      id: "apache-cgi-enabled",
      category: "apache",
      message: "CGI scripts allowed in unsafe directories",
      severity: "HIGH",
      pattern: "Options\\s+.*ExecCGI",
      flags: "gi",
      recommendation: "Restrict CGI to necessary directories only",
      languages: ["conf", "apache", "htaccess"]
    },
    {
      id: "apache-insecure-include",
      category: "apache",
      message: "PHP include_path with user input - LFI risk",
      severity: "CRITICAL",
      pattern: "php_value\\s+include_path\\s+[^;]*\\$\\{",
      flags: "gi",
      recommendation: "Use absolute paths",
      languages: ["conf", "apache", "htaccess"]
    },
    {
      id: "apache-dav-on",
      category: "apache",
      message: "WebDAV enabled - risk of file exposure and modification",
      severity: "HIGH",
      pattern: "DAV\\s+On",
      flags: "gi",
      recommendation: "Disable WebDAV if not required",
      languages: ["conf", "apache"]
    },
    {
      id: "apache-http-only",
      category: "apache",
      message: "HTTP-only access - data interception risk",
      severity: "HIGH",
      pattern: "^\\s*<VirtualHost\\s+[^>]*:80\\s*>(?![\\s\\S]*Redirect\\s+permanent\\s+/\\s+https://)",
      flags: "gim",
      recommendation: "Configure HTTP→HTTPS redirect",
      languages: ["conf", "apache"]
    },
    {
      id: "apache-missing-security-headers",
      category: "apache",
      message: "Missing security headers in Apache",
      severity: "MEDIUM",
      pattern: "^\\s*<VirtualHost[^>]*>(?![\\s\\S]*Header\\s+set\\s+X-Frame-Options)",
      flags: "gim",
      recommendation: "Add: Header set X-Frame-Options DENY; Header set X-Content-Type-Options nosniff;",
      languages: ["conf", "apache"]
    },
    {
      id: "apache-mod-status",
      category: "apache",
      message: "mod_status enabled - exposes server information",
      severity: "MEDIUM",
      pattern: "^(?:#.*\\n)*\\s*LoadModule\\s+status_module\\s+modules/mod_status\\.so(?:\\s*\\n(?:#.*\\n|\\s*\\n)*\\s*<Location\\s+/server-status>)?",
      flags: "gim",
      recommendation: "Restrict access to /server-status",
      languages: ["conf", "apache"]
    },
    {
      id: "apache-mod-info",
      category: "apache",
      message: "mod_info enabled - exposes server configuration",
      severity: "MEDIUM",
      pattern: "LoadModule\\s+info_module\\s+modules/mod_info\\.so",
      flags: "gi",
      recommendation: "Disable mod_info in production",
      languages: ["conf", "apache"]
    },
    {
      id: "apache-missing-rewrite-security",
      category: "apache",
      message: "mod_rewrite may be used for security bypass",
      severity: "MEDIUM",
      pattern: "RewriteRule\\s+[^;]*\\$\\{",
      flags: "gi",
      recommendation: "Validate all RewriteRule",
      languages: ["conf", "apache", "htaccess"]
    },

    // ==================== FILE SYSTEM ====================
    {
      id: "file-upload-unrestricted",
      category: "file-system",
      message: "Unrestricted file upload - DoS and RCE risk",
      severity: "HIGH",
      pattern: "(?:multer|busboy|formidable|multer\\.diskStorage|multer\\.memoryStorage)\\s*\\(\\s*\\{[^}]*?\\}(?![\\s\\S]*?fileFilter)",
      flags: "gi",
      recommendation: "Restrict file types and size",
      languages: ["javascript", "typescript"]
    },
    {
      id: "symlink-attack",
      category: "file-system",
      message: "Symbolic link may lead to directory traversal",
      severity: "HIGH",
      pattern: "fs\\.(?:symlink|lstat)\\s*\\([^)]*(?:req|params)",
      flags: "gi",
      recommendation: "Use fs.realpath to resolve symlinks",
      languages: ["javascript", "typescript", "python", "go"]
    },

    // ==================== ERROR HANDLING ====================
    {
      id: "error-exposure",
      category: "error-handling",
      message: "Throwing user-facing errors may expose system details",
      severity: "MEDIUM",
      pattern: "throw\\s+(?:new\\s+)?Error\\s*\\(\\s*(?:req|params|body)",
      flags: "gi",
      recommendation: "Use generic error messages for users",
      languages: ["javascript", "typescript", "python", "java", "go", "csharp"]
    },
    {
      id: "unhandled-promise-rejection",
      category: "error-handling",
      message: "Promise without error handling",
      severity: "HIGH",
      pattern: "\\.then\\([^)]*\\)(?!\\s*\\.catch)",
      flags: "gi",
      recommendation: "Add .catch() error handler",
      languages: ["javascript", "typescript"]
    },

    // ==================== CONTAINER ====================
    {
      id: "container-readonly-root",
      category: "container",
      message: "Root filesystem is writable",
      severity: "HIGH",
      pattern: "readOnlyRootFilesystem:\\s*false",
      flags: "gim",
      recommendation: "Set readOnlyRootFilesystem: true",
      languages: ["yaml", "kubernetes", "helm"]
    },
    {
      id: "container-run-as-user",
      category: "container",
      message: "Container runs as root",
      severity: "CRITICAL",
      pattern: "runAsUser:\\s*0",
      flags: "gim",
      recommendation: "Run as non-privileged user",
      languages: ["yaml", "kubernetes", "helm"]
    }
  ]
};

// ==================== HELPER FUNCTIONS ====================

export function getRulesByCategory(category) {
  if (!category) return SAST_RULES.rules;
  return SAST_RULES.rules.filter(rule => rule.category === category);
}

export function getRulesBySeverity(severity) {
  if (!severity) return SAST_RULES.rules;
  return SAST_RULES.rules.filter(rule => rule.severity === severity.toUpperCase());
}

// [C#] Нормализация регистра: 'C#' → 'csharp', 'c#' → 'csharp'
function normalizeLang(l) {
  const v = String(l).toLowerCase().trim();
  return v === 'c#' ? 'csharp' : v;
}

export function getRulesByLanguage(language) {
  if (!language) return SAST_RULES.rules;
  const lang = normalizeLang(language);
  return SAST_RULES.rules.filter(rule => {
    if (!rule.languages) return true;
    if (rule.languages.includes('all')) return true;
    return rule.languages.some(l => normalizeLang(l) === lang);
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

export function getKnownFalsePositives() {
  return [
    "hardcoded-credentials-json-fp",
    "eval",
    "nginx-insecure-redirect"
  ];
}

export default SAST_RULES;