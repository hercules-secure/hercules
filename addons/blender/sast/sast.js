// analyzers/sast-analyzer.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import { SAST_RULES } from './rules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const traverse = _traverse.default || _traverse;

// ==================== КОНФИГУРАЦИЯ ====================
const LOG_DIR = './logs/blender';
const LOG_FILE = './logs/blender/log.txt';
const MAX_DEPTH = 100;              // Максимальная глубина вложенности
const MAX_FILES = 100000;           // Максимальное количество файлов
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_SYMLINK_DEPTH = 10;       // Максимальная глубина симлинков
const MAX_PATH_LENGTH = 260;        // Максимальная длина пути (Windows)

function writeLog(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] [SAST] ${message}\n`;
    
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
        fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
    } catch (e) {}
}

function findLineNumberInJSON(content, keyName) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const regex = new RegExp(`["']${keyName}["']\\s*:`);
        if (regex.test(line)) {
            return i + 1;
        }
    }
    return 0;
}

// ==================== ПОЛУЧЕНИЕ БЛОКА КОДА С КОНТЕКСТОМ ====================
function getCodeBlock(content, lineNumber, contextLines = 2) {
    if (!content || !lineNumber) return null;
    
    const lines = content.split('\n');
    const startLine = Math.max(0, lineNumber - contextLines - 1);
    const endLine = Math.min(lines.length, lineNumber + contextLines);
    
    const result = {
        vulnerableLine: lineNumber,
        lines: []
    };
    
    for (let i = startLine; i < endLine; i++) {
        result.lines.push({
            number: i + 1,
            code: lines[i] || '',
            isVulnerable: (i + 1) === lineNumber
        });
    }
    
    return result;
}

// ==================== ПРОВЕРКА НА ИСКЛЮЧАЕМЫЕ ФАЙЛЫ ====================
function isExcludedFile(filePath, fileName) {
    const excludePatterns = [
        /test/i, /mock/i, /spec/i, /fixture/i, /stub/i,
        /__tests__/i, /__mocks__/i, /\.test\./i, /\.spec\./i, /\.mock\./i,
        /\/tests\//i, /\/test\//i, /\/__tests__\//i, /\/mocks\//i, /\/__mocks__\//i,
        /\/fixtures\//i, /\/stubs\//i
    ];
    
    const excludeExactNames = [
        'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
        'composer.lock', 'composer.json', 'Gemfile.lock', 'Cargo.lock', 'go.sum',
        'poetry.lock', 'requirements.txt', 'Pipfile', 'Pipfile.lock'
    ];
    
    const lowerFilePath = filePath.toLowerCase();
    const lowerFileName = fileName.toLowerCase();
    
    if (excludeExactNames.includes(lowerFileName)) return true;
    
    for (const pattern of excludePatterns) {
        if (pattern.test(lowerFilePath)) return true;
    }
    
    return false;
}

// ==================== ПРОВЕРКА НА ЛОЖНЫЕ СРАБАТЫВАНИЯ ====================
function isFalsePositive(ruleId, codeLine, content, matchIndex) {
    const lineStart = content.lastIndexOf('\n', matchIndex) + 1;
    let line = content.substring(lineStart, content.indexOf('\n', matchIndex));
    if (line === '') line = codeLine;
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('#')) {
        return true;
    }
    
    if (trimmedLine.startsWith('/**') || trimmedLine.startsWith('/*')) {
        return true;
    }
    
    if (ruleId === 'ldap-wildcard-search') {
        if (/\*\s*\w+/.test(line) && !/(?:ldap|search|filter)/i.test(line)) return true;
        if (/\d+\s*\*\s*\d+/.test(line)) return true;
        if (/type\s+\w+\s+\*\w+/.test(line)) return true;
        if (/^\*\w+/.test(trimmedLine)) return true;
    }
    
    if (ruleId === 'ldap-injection' || ruleId === 'ldap-unsanitized-filter') {
        if (!/(?:ldap|search|filter|bind|LdapContext|DirectorySearcher)/i.test(line)) return true;
    }
    
    if (ruleId === 'sql-injection') {
        if (!/(?:SELECT|INSERT|UPDATE|DELETE|WHERE|query|execute)/i.test(line)) return true;
    }
    
    if (ruleId === 'command-injection') {
        if (!/(?:exec|system|popen|spawn|child_process)/i.test(line)) return true;
    }
    
    return false;
}

// ==================== УЛУЧШЕННЫЙ ОБХОД ФАЙЛОВ С ЗАЩИТОЙ ====================

function getAllFiles(dirPath, options = {}) {
    const {
        arrayOfFiles = [],
        visitedPaths = new Set(),
        depth = 0,
        maxDepth = MAX_DEPTH,
        maxFiles = MAX_FILES,
        followSymlinks = false,
        symlinkDepth = 0
    } = options;
    
    // Защита от переполнения стека
    if (depth > maxDepth) {
        writeLog(`Превышена максимальная глубина ${maxDepth} для ${dirPath}`, 'WARN');
        return arrayOfFiles;
    }
    
    // Защита от слишком большого количества файлов
    if (arrayOfFiles.length >= maxFiles) {
        writeLog(`Достигнут лимит файлов ${maxFiles}, остановка обхода`, 'WARN');
        return arrayOfFiles;
    }
    
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            // Защита от слишком длинных путей (Windows)
            if (fullPath.length > MAX_PATH_LENGTH) {
                writeLog(`Путь слишком длинный: ${fullPath.substring(0, 100)}...`, 'WARN');
                continue;
            }
            
            try {
                let isDirectory = entry.isDirectory();
                let realPath = fullPath;
                let currentSymlinkDepth = symlinkDepth;
                
                // Обработка симлинков
                if (entry.isSymbolicLink()) {
                    if (!followSymlinks) {
                        writeLog(`Пропуск симлинка: ${fullPath} (followSymlinks=false)`, 'DEBUG');
                        continue;
                    }
                    
                    try {
                        realPath = fs.realpathSync(fullPath);
                        
                        if (visitedPaths.has(realPath)) {
                            writeLog(`Обнаружен цикл симлинков: ${fullPath} -> ${realPath}`, 'WARN');
                            continue;
                        }
                        
                        currentSymlinkDepth++;
                        if (currentSymlinkDepth > MAX_SYMLINK_DEPTH) {
                            writeLog(`Превышена глубина симлинков для ${fullPath}`, 'WARN');
                            continue;
                        }
                        
                        const realStat = fs.statSync(realPath);
                        isDirectory = realStat.isDirectory();
                        visitedPaths.add(realPath);
                    } catch (err) {
                        writeLog(`Ошибка разрешения симлинка ${fullPath}: ${err.message}`, 'WARN');
                        continue;
                    }
                }
                
                if (isDirectory) {
                    const excludeDirs = [
                        'node_modules', '.git', 'dist', 'build', '.venv',
                        '__pycache__', '.idea', '.vscode', 'logs', 'coverage',
                        'vendor', 'target', 'out', 'bin', 'obj', 'tmp', '.cache'
                    ];
                    
                    if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                        const normalizedPath = path.resolve(realPath);
                        
                        if (!visitedPaths.has(normalizedPath)) {
                            visitedPaths.add(normalizedPath);
                            
                            getAllFiles(realPath, {
                                arrayOfFiles,
                                visitedPaths,
                                depth: depth + 1,
                                maxDepth,
                                maxFiles,
                                followSymlinks,
                                symlinkDepth: currentSymlinkDepth
                            });
                        }
                    }
                } else {
                    const ext = path.extname(entry.name).toLowerCase();
                    const allowedExts = [
                        '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
                        '.py', '.go', '.java', '.php',
                        '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',
                        '.yaml', '.yml', '.json', '.env', '.tf', '.tfvars'
                    ];
                    
                    if (allowedExts.includes(ext)) {
                        try {
                            const stat = fs.statSync(fullPath);
                            if (stat.size > MAX_FILE_SIZE) {
                                writeLog(`Файл слишком большой: ${entry.name} (${stat.size} bytes)`, 'DEBUG');
                                continue;
                            }
                        } catch (statErr) {}
                        
                        if (!isExcludedFile(fullPath, entry.name)) {
                            const normalizedFullPath = path.resolve(realPath);
                            const alreadyExists = arrayOfFiles.some(existing =>
                                path.resolve(existing) === normalizedFullPath
                            );
                            
                            if (!alreadyExists && arrayOfFiles.length < maxFiles) {
                                arrayOfFiles.push(realPath);
                            }
                        }
                    }
                }
            } catch (entryError) {
                writeLog(`Ошибка обработки ${fullPath}: ${entryError.message}`, 'WARN');
            }
        }
    } catch (readdirError) {
        writeLog(`Ошибка чтения директории ${dirPath}: ${readdirError.message}`, 'WARN');
    }
    
    return arrayOfFiles;
}

// ==================== АСИНХРОННАЯ ВЕРСИЯ ДЛЯ ГЛУБОКОЙ ВЛОЖЕННОСТИ ====================

async function getAllFilesAsync(dirPath, options = {}) {
    const {
        maxDepth = MAX_DEPTH,
        maxFiles = MAX_FILES,
        followSymlinks = false
    } = options;
    
    const results = [];
    const visited = new Set();
    
    async function walk(currentPath, depth = 0, symlinkDepth = 0) {
        if (depth > maxDepth) {
            writeLog(`Превышена максимальная глубина ${maxDepth} для ${currentPath}`, 'WARN');
            return;
        }
        
        if (results.length >= maxFiles) {
            writeLog(`Достигнут лимит файлов ${maxFiles}`, 'WARN');
            return;
        }
        
        if (currentPath.length > MAX_PATH_LENGTH) {
            writeLog(`Путь слишком длинный: ${currentPath.substring(0, 100)}...`, 'WARN');
            return;
        }
        
        try {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
            
            const dirs = [];
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                
                try {
                    let isDirectory = entry.isDirectory();
                    let realPath = fullPath;
                    let currentSymlinkDepth = symlinkDepth;
                    
                    if (entry.isSymbolicLink()) {
                        if (!followSymlinks) continue;
                        
                        try {
                            realPath = await fs.promises.realpath(fullPath);
                            
                            if (visited.has(realPath)) {
                                writeLog(`Обнаружен цикл симлинков: ${fullPath}`, 'WARN');
                                continue;
                            }
                            
                            currentSymlinkDepth++;
                            if (currentSymlinkDepth > MAX_SYMLINK_DEPTH) {
                                writeLog(`Превышена глубина симлинков для ${fullPath}`, 'WARN');
                                continue;
                            }
                            
                            const realStat = await fs.promises.stat(realPath);
                            isDirectory = realStat.isDirectory();
                            visited.add(realPath);
                        } catch (err) {
                            writeLog(`Ошибка разрешения симлинка ${fullPath}: ${err.message}`, 'WARN');
                            continue;
                        }
                    }
                    
                    if (isDirectory) {
                        const excludeDirs = [
                            'node_modules', '.git', 'dist', 'build', '.venv',
                            '__pycache__', '.idea', '.vscode', 'logs', 'coverage',
                            'vendor', 'target', 'out', 'bin', 'obj', 'tmp', '.cache'
                        ];
                        
                        if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                            const normalizedPath = path.resolve(realPath);
                            if (!visited.has(normalizedPath)) {
                                visited.add(normalizedPath);
                                dirs.push({ path: realPath, depth: depth + 1, symlinkDepth: currentSymlinkDepth });
                            }
                        }
                    } else {
                        const ext = path.extname(entry.name).toLowerCase();
                        const allowedExts = [
                            '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
                            '.py', '.go', '.java', '.php',
                            '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',
                            '.yaml', '.yml', '.json', '.env', '.tf', '.tfvars'
                        ];
                        
                        if (allowedExts.includes(ext)) {
                            const stat = await fs.promises.stat(fullPath);
                            if (stat.size <= MAX_FILE_SIZE && !isExcludedFile(fullPath, entry.name)) {
                                results.push(realPath);
                            }
                        }
                    }
                } catch (entryError) {
                    writeLog(`Ошибка обработки ${fullPath}: ${entryError.message}`, 'WARN');
                }
            }
            
            // Обрабатываем директории с ограничением параллельности
            const BATCH_SIZE = 50;
            for (let i = 0; i < dirs.length; i += BATCH_SIZE) {
                const batch = dirs.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(dir => walk(dir.path, dir.depth, dir.symlinkDepth)));
            }
            
        } catch (err) {
            writeLog(`Ошибка обхода ${currentPath}: ${err.message}`, 'WARN');
        }
    }
    
    await walk(dirPath);
    return results;
}

// ==================== АНАЛИЗ JSON ФАЙЛОВ ====================
function analyzeJSONContent(content, filePath) {
    const issues = [];
    
    try {
        const data = JSON.parse(content);
        const secretKeys = ['password', 'secret', 'token', 'api_key', 'apikey', 'private_key', 'access_key', 'secret_key'];
        
        function traverseObj(obj, path = '') {
            if (!obj || typeof obj !== 'object') return;
            
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (secretKeys.some(sk => key.toLowerCase().includes(sk))) {
                    if (typeof value === 'string' && value.length > 0 && !value.includes('ENV')) {
                        const lineNumber = findLineNumberInJSON(content, key);
                        const codeBlock = getCodeBlock(content, lineNumber, 5);
                        
                        issues.push({
                            file: filePath,
                            line: lineNumber,
                            severity: 'CRITICAL',
                            ruleId: 'hardcoded-credentials-json',
                            category: 'credentials',
                            message: `Hardcoded credential found: ${currentPath}`,
                            snippet: `${key}: "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`,
                            codeBlock: codeBlock,
                            recommendation: 'Use environment variables or secret manager'
                        });
                    }
                }
                
                if (typeof value === 'object' && value !== null) {
                    traverseObj(value, currentPath);
                }
            }
        }
        
        traverseObj(data);
        
    } catch (e) {
        writeLog(`Invalid JSON in ${filePath}: ${e.message}`, 'WARN');
    }
    
    return issues;
}

// ==================== AST АНАЛИЗ ====================
function analyzeJavaScriptAST(content, filePath) {
    const issues = [];
    
    try {
        const ast = parse(content, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript', 'decorators', 'classProperties', 'dynamicImport']
        });
        
        traverse(ast, {
            CallExpression: (path) => {
                const { node } = path;
                const line = node.loc?.start.line || 0;
                
                if (t.isIdentifier(node.callee) && node.callee.name === 'eval') {
                    issues.push({
                        file: filePath,
                        line: line,
                        severity: 'CRITICAL',
                        ruleId: 'dangerous-code-execution',
                        category: 'owasp',
                        message: 'Использование eval() может привести к инъекциям кода',
                        snippet: getSnippetFromNode(node, content),
                        codeBlock: getCodeBlock(content, line),
                        recommendation: 'Избегайте eval(), используйте безопасные альтернативы'
                    });
                }
                
                if (t.isMemberExpression(node.callee)) {
                    const obj = node.callee.object;
                    const prop = node.callee.property;
                    
                    if (t.isIdentifier(obj) && t.isIdentifier(prop)) {
                        if ((obj.name === 'child_process' || obj.name === 'require') && 
                            (prop.name === 'exec' || prop.name === 'execSync')) {
                            const args = node.arguments;
                            if (args[0] && !isStaticString(args[0])) {
                                issues.push({
                                    file: filePath,
                                    line: line,
                                    severity: 'CRITICAL',
                                    ruleId: 'command-injection',
                                    category: 'injection',
                                    message: 'Потенциальная инъекция команд',
                                    snippet: getSnippetFromNode(node, content),
                                    codeBlock: getCodeBlock(content, line),
                                    recommendation: 'Избегайте выполнения команд с пользовательским вводом'
                                });
                            }
                        }
                        
                        if (obj.name === 'fs' && (prop.name === 'readFile' || prop.name === 'writeFile' || prop.name === 'readFileSync')) {
                            const args = node.arguments;
                            if (args[0] && !isStaticString(args[0])) {
                                issues.push({
                                    file: filePath,
                                    line: line,
                                    severity: 'HIGH',
                                    ruleId: 'path-traversal',
                                    category: 'owasp',
                                    message: 'Потенциальный обход пути (Path Traversal)',
                                    snippet: getSnippetFromNode(node, content),
                                    codeBlock: getCodeBlock(content, line),
                                    recommendation: 'Валидируйте пути, используйте path.resolve()'
                                });
                            }
                        }
                        
                        if ((obj.name === 'axios' || obj.name === 'fetch') && 
                            (prop.name === 'get' || prop.name === 'post' || prop.name === 'request')) {
                            const args = node.arguments;
                            if (args[0] && !isStaticString(args[0])) {
                                issues.push({
                                    file: filePath,
                                    line: line,
                                    severity: 'CRITICAL',
                                    ruleId: 'ssrf-vulnerability',
                                    category: 'ssrf',
                                    message: 'SSRF: запрос к пользовательскому URL',
                                    snippet: getSnippetFromNode(node, content),
                                    codeBlock: getCodeBlock(content, line),
                                    recommendation: 'Валидируйте URL по белому списку доменов'
                                });
                            }
                        }
                    }
                }
            },
            
            StringLiteral: (path) => {
                const { node } = path;
                const value = node.value;
                const line = node.loc?.start.line || 0;
                
                if (value && typeof value === 'string') {
                    const sqlPattern = /(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER).+?(WHERE|VALUES|SET)/i;
                    if (sqlPattern.test(value) && !value.includes('?') && !value.includes('$1')) {
                        issues.push({
                            file: filePath,
                            line: line,
                            severity: 'CRITICAL',
                            ruleId: 'sql-injection',
                            category: 'injection',
                            message: 'Потенциальная SQL инъекция',
                            snippet: `"${value.substring(0, 100)}${value.length > 100 ? '...' : ''}"`,
                            codeBlock: getCodeBlock(content, line),
                            recommendation: 'Используйте параметризованные запросы или ORM'
                        });
                    }
                }
            },
            
            ObjectProperty: (path) => {
                const { node } = path;
                const line = node.loc?.start.line || 0;
                
                if (t.isIdentifier(node.key)) {
                    const key = node.key.name.toLowerCase();
                    const secretKeys = ['password', 'secret', 'token', 'apikey', 'api_key', 'privatekey'];
                    
                    if (secretKeys.includes(key) && t.isStringLiteral(node.value)) {
                        const value = node.value.value;
                        if (value && value.length > 0 && !value.includes('process.env')) {
                            issues.push({
                                file: filePath,
                                line: line,
                                severity: 'CRITICAL',
                                ruleId: 'hardcoded-credentials',
                                category: 'credentials',
                                message: `Обнаружены жестко закодированные учетные данные: ${key}`,
                                snippet: `${key}: "${value.substring(0, 20)}${value.length > 20 ? '...' : ''}"`,
                                codeBlock: getCodeBlock(content, line),
                                recommendation: 'Используйте переменные окружения или менеджер секретов'
                            });
                        }
                    }
                }
            },
            
            AssignmentExpression: (path) => {
                const { node } = path;
                const line = node.loc?.start.line || 0;
                
                if (t.isMemberExpression(node.left) && 
                    t.isIdentifier(node.left.property) && 
                    node.left.property.name === 'innerHTML') {
                    issues.push({
                        file: filePath,
                        line: line,
                        severity: 'HIGH',
                        ruleId: 'xss-vulnerability',
                        category: 'owasp',
                        message: 'Использование innerHTML может привести к XSS',
                        snippet: getSnippetFromNode(node, content),
                        codeBlock: getCodeBlock(content, line),
                        recommendation: 'Используйте textContent или DOMPurify'
                    });
                }
            },
            
            CallExpression: (path) => {
                const { node } = path;
                const line = node.loc?.start.line || 0;
                
                if (t.isMemberExpression(node.callee) &&
                    t.isIdentifier(node.callee.object) && node.callee.object.name === 'console' &&
                    t.isIdentifier(node.callee.property)) {
                    
                    const method = node.callee.property.name;
                    if (method === 'log' || method === 'info' || method === 'debug' || method === 'warn') {
                        issues.push({
                            file: filePath,
                            line: line,
                            severity: 'MEDIUM',
                            ruleId: 'log-sensitive-data',
                            category: 'config',
                            message: `Обнаружен console.${method} - может логировать чувствительные данные`,
                            snippet: getSnippetFromNode(node, content),
                            codeBlock: getCodeBlock(content, line),
                            recommendation: 'Удалите или замените на логирование через logger'
                        });
                    }
                }
            }
        });
        
    } catch (parseError) {
        writeLog(`AST parsing failed for ${filePath}: ${parseError.message}`, 'WARN');
    }
    
    return issues;
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function isRuleApplicable(rule, ext, fileName) {
    if (!rule.languages || rule.languages.length === 0) return true;
    if (rule.languages.includes('all')) return true;
    
    const langMap = {
        '.js': ['javascript', 'js'], '.jsx': ['javascript', 'jsx'],
        '.ts': ['typescript', 'ts'], '.tsx': ['typescript', 'tsx'],
        '.mjs': ['javascript'], '.cjs': ['javascript'],
        '.py': ['python'], '.go': ['go'], '.java': ['java'],
        '.php': ['php'], '.c': ['c'], '.h': ['c'],
        '.cpp': ['cpp', 'c++'], '.hpp': ['cpp'], '.cc': ['cpp'], '.cxx': ['cpp'],
        '.yaml': ['yaml'], '.yml': ['yaml'], '.tf': ['terraform'],
        '.tfvars': ['terraform'], '.env': ['env'], '.json': ['json']
    };
    
    const fileLangs = langMap[ext] || [];
    for (const fileLang of fileLangs) {
        if (rule.languages.includes(fileLang)) return true;
    }
    
    if (rule.languages.includes('dockerfile')) {
        if (fileName === 'dockerfile' || fileName.startsWith('dockerfile.')) return true;
    }
    
    return false;
}

function isStaticString(node) {
    return t.isStringLiteral(node) || (t.isTemplateLiteral(node) && node.expressions.length === 0);
}

function getSnippetFromNode(node, content) {
    if (node.loc) {
        const lines = content.split('\n');
        const line = lines[node.loc.start.line - 1];
        return line?.trim() || '';
    }
    return '';
}

function getLineNumber(content, position) {
    const lines = content.substring(0, position).split('\n');
    return lines.length;
}

// ==================== ФУНКЦИЯ ДЕДУПЛИКАЦИИ ====================
function removeDuplicates(issues) {
    const seen = new Map();
    
    return issues.filter(issue => {
        let normalizedFile = issue.file;
        
        const pathParts = normalizedFile.split(/[\\/]/);
        if (pathParts.length > 1 && pathParts[0] === pathParts[1]) {
            normalizedFile = pathParts.slice(1).join('/');
        }
        
        normalizedFile = normalizedFile.replace(/^loan-master[\\/]/, '');
        normalizedFile = normalizedFile.replace(/^src[\\/]/, '');
        normalizedFile = normalizedFile.replace(/^\.\//, '');
        normalizedFile = normalizedFile.split('\\').join('/');
        
        const key = `${normalizedFile}|${issue.line}|${issue.ruleId}`;
        
        if (seen.has(key)) {
            writeLog(`Дубликат удален: ${key}`, 'DEBUG');
            return false;
        }
        
        seen.set(key, true);
        issue.file = normalizedFile;
        
        return true;
    });
}

// ==================== ОСНОВНАЯ ФУНКЦИЯ ====================
export async function analyzeSAST(projectPath, options = {}) {
    const issues = [];
    
    writeLog(`Запуск анализа проекта: ${projectPath}`, 'INFO');
    writeLog(`Загружено правил: ${SAST_RULES.rules.length}`, 'INFO');
    
    try {
        if (!fs.existsSync(projectPath)) {
            writeLog(`Путь не существует: ${projectPath}`, 'ERROR');
            return { issues: [], statistics: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } };
        }
        
        const normalizedProjectPath = path.resolve(projectPath);
        
        // Используем асинхронный обход для глубокой вложенности
        const useAsync = options.useAsync !== false;
        let files;
        
        if (useAsync) {
            files = await getAllFilesAsync(normalizedProjectPath, {
                maxDepth: options.maxDepth || MAX_DEPTH,
                maxFiles: options.maxFiles || MAX_FILES,
                followSymlinks: options.followSymlinks || false
            });
        } else {
            files = getAllFiles(normalizedProjectPath, {
                maxDepth: options.maxDepth || MAX_DEPTH,
                maxFiles: options.maxFiles || MAX_FILES,
                followSymlinks: options.followSymlinks || false
            });
        }
        
        writeLog(`Найдено файлов для анализа (после фильтрации): ${files.length}`, 'INFO');
        
        let processedFiles = 0;
        
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            const fileName = path.basename(file).toLowerCase();
            
            try {
                const content = fs.readFileSync(file, 'utf-8');
                
                let relativePath = path.relative(normalizedProjectPath, file);
                
                const pathParts = relativePath.split(path.sep);
                if (pathParts.length > 1 && pathParts[0] === pathParts[1]) {
                    relativePath = pathParts.slice(1).join(path.sep);
                }
                
                relativePath = relativePath.replace(/^loan-master[\\/]/, '');
                relativePath = relativePath.replace(/^src[\\/]/, '');
                relativePath = relativePath.split('\\').join('/');
                
                // AST анализ для JavaScript/TypeScript
                if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
                    const astIssues = analyzeJavaScriptAST(content, relativePath);
                    issues.push(...astIssues);
                }
                
                // JSON анализ
                if (ext === '.json') {
                    const jsonIssues = analyzeJSONContent(content, relativePath);
                    issues.push(...jsonIssues);
                }
                
                // Regex анализ
                for (const rule of SAST_RULES.rules) {
                    if (!isRuleApplicable(rule, ext, fileName)) continue;
                    
                    try {
                        const regex = new RegExp(rule.pattern, rule.flags || 'gi');
                        let match;
                        
                        while ((match = regex.exec(content)) !== null) {
                            if (isFalsePositive(rule.id, match[0], content, match.index)) {
                                continue;
                            }
                            
                            const lineNumber = getLineNumber(content, match.index);
                            
                            issues.push({
                                file: relativePath,
                                line: lineNumber,
                                severity: rule.severity,
                                ruleId: rule.id,
                                category: rule.category,
                                message: rule.message,
                                snippet: match[0].substring(0, 200),
                                codeBlock: getCodeBlock(content, lineNumber),
                                recommendation: rule.recommendation
                            });
                        }
                    } catch (regexError) {
                        writeLog(`Ошибка в правиле ${rule.id}: ${regexError.message}`, 'WARN');
                    }
                }
                
                processedFiles++;
                if (processedFiles % 50 === 0) {
                    writeLog(`Обработано файлов: ${processedFiles}/${files.length}`, 'INFO');
                }
                
            } catch (fileError) {
                writeLog(`Ошибка обработки файла ${file}: ${fileError.message}`, 'WARN');
            }
        }
        
        const uniqueIssues = removeDuplicates(issues);
        
        const statistics = {
            total: uniqueIssues.length,
            critical: uniqueIssues.filter(i => i.severity === 'CRITICAL').length,
            high: uniqueIssues.filter(i => i.severity === 'HIGH').length,
            medium: uniqueIssues.filter(i => i.severity === 'MEDIUM').length,
            low: uniqueIssues.filter(i => i.severity === 'LOW').length,
            info: uniqueIssues.filter(i => i.severity === 'INFO').length
        };
        
        writeLog(`Анализ завершен. Найдено проблем: ${uniqueIssues.length} (CRITICAL: ${statistics.critical})`, 'INFO');
        
        return { issues: uniqueIssues, statistics };
        
    } catch (error) {
        writeLog(`Ошибка анализа: ${error.message}`, 'ERROR');
        return { issues: [], statistics: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } };
    }
}

export default { analyzeSAST };