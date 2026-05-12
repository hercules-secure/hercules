import fs from 'fs/promises';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { createWriteStream } from 'fs';
import https from 'https';
import http from 'http';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config({ quiet: true });

const execAsync = promisify(exec);
const traverse = _traverse.default || _traverse;

// ==================== НАСТРОЙКА ЛОГГЕРА (только файл) ====================
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/sast/log.txt' })
    ]
});

// Отключаем console.log полностью
console.log = () => {};
console.info = () => {};
console.warn = () => {};
console.error = () => {};
console.debug = () => {};

function getShortPath(fullPath) {
    if (!fullPath) return 'unknown';
    const normalizedPath = fullPath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    const importantFolders = ['src', 'lib', 'app', 'components', 'utils', 'services', 'pages', 'views', 'frontend', 'backend', 'api', 'core', 'modules'];
    
    let startIndex = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
        if (importantFolders.includes(parts[i])) {
            startIndex = i;
            break;
        }
    }
    
    if (startIndex > 0) {
        return parts.slice(startIndex).join('/');
    }
    
    const maxParts = Math.min(parts.length, 4);
    return parts.slice(-maxParts).join('/');
}

// ==================== БАЗОВЫЙ АНАЛИЗАТОР СТРОК ====================
class LineAnalyzer {
    constructor(engine) {
        this.engine = engine;
    }
    
    // Анализ JavaScript/TypeScript через AST
    analyzeJavaScript(content, filePath) {
        const results = [];
        
        try {
            const ast = parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript', 'decorators', 'classProperties', 'dynamicImport']
            });
            
            traverse(ast, {
                CallExpression: (path) => {
                    const { node } = path;
                    
                    if (t.isIdentifier(node.callee) && node.callee.name === 'eval') {
                        results.push({
                            type: 'eval',
                            line: node.loc?.start.line,
                            code: content.split('\n')[node.loc?.start.line - 1]?.trim()
                        });
                    }
                    
                    if (t.isMemberExpression(node.callee)) {
                        const obj = node.callee.object;
                        const prop = node.callee.property;
                        
                        if (t.isIdentifier(obj) && t.isIdentifier(prop)) {
                            if ((obj.name === 'child_process' || obj.name === 'require') && 
                                (prop.name === 'exec' || prop.name === 'execSync')) {
                                results.push({
                                    type: 'command-injection',
                                    line: node.loc?.start.line,
                                    code: content.split('\n')[node.loc?.start.line - 1]?.trim()
                                });
                            }
                            
                            if (obj.name === 'fs' && (prop.name === 'readFile' || prop.name === 'writeFile')) {
                                const args = node.arguments;
                                if (args[0] && t.isIdentifier(args[0])) {
                                    results.push({
                                        type: 'path-traversal',
                                        line: node.loc?.start.line,
                                        code: content.split('\n')[node.loc?.start.line - 1]?.trim()
                                    });
                                }
                            }
                            
                            if ((obj.name === 'axios' || obj.name === 'fetch') && 
                                (prop.name === 'get' || prop.name === 'post' || prop.name === 'request')) {
                                const args = node.arguments;
                                if (args[0] && (t.isIdentifier(args[0]) || t.isTemplateLiteral(args[0]))) {
                                    results.push({
                                        type: 'ssrf',
                                        line: node.loc?.start.line,
                                        code: content.split('\n')[node.loc?.start.line - 1]?.trim()
                                    });
                                }
                            }
                        }
                    }
                    
                    if (t.isIdentifier(node.callee) && node.callee.name === 'require') {
                        const args = node.arguments;
                        if (args[0] && (t.isIdentifier(args[0]) || t.isTemplateLiteral(args[0]))) {
                            results.push({
                                type: 'dynamic-require',
                                line: node.loc?.start.line,
                                code: content.split('\n')[node.loc?.start.line - 1]?.trim()
                            });
                        }
                    }
                },
                
                StringLiteral: (path) => {
                    const { node } = path;
                    const value = node.value;
                    
                    if (value && typeof value === 'string') {
                        const sqlPatterns = /(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER).+?(WHERE|VALUES|SET)/i;
                        if (sqlPatterns.test(value) && !value.includes('?') && !value.includes('$1')) {
                            results.push({
                                type: 'sql-injection',
                                line: node.loc?.start.line,
                                code: `"${value.substring(0, 100)}${value.length > 100 ? '...' : ''}"`
                            });
                        }
                    }
                },
                
                ObjectExpression: (path) => {
                    const { node } = path;
                    const parent = path.parent;
                    
                    if (t.isCallExpression(parent) && 
                        t.isMemberExpression(parent.callee) && 
                        t.isIdentifier(parent.callee.object) &&
                        parent.callee.object.name === 'Object' &&
                        t.isIdentifier(parent.callee.property) &&
                        parent.callee.property.name === 'assign') {
                        
                        const args = parent.arguments;
                        args.forEach(arg => {
                            if (t.isIdentifier(arg) && (arg.name === 'req' || arg.name === 'request')) {
                                results.push({
                                    type: 'mass-assignment',
                                    line: node.loc?.start.line,
                                    code: content.split('\n')[node.loc?.start.line - 1]?.trim()
                                });
                            }
                        });
                    }
                },
                
                ObjectProperty: (path) => {
                    const { node } = path;
                    if (t.isIdentifier(node.key)) {
                        const key = node.key.name.toLowerCase();
                        const secretKeys = ['password', 'secret', 'token', 'apikey', 'api_key', 'privatekey'];
                        
                        if (secretKeys.includes(key) && t.isStringLiteral(node.value)) {
                            const value = node.value.value;
                            if (value && value.length > 0 && !value.includes('process.env')) {
                                results.push({
                                    type: 'hardcoded-secret',
                                    line: node.loc?.start.line,
                                    code: `${key}: "${value.substring(0, 20)}${value.length > 20 ? '...' : ''}"`
                                });
                            }
                        }
                    }
                }
            });
            
        } catch (parseError) {
            logger.warn(`AST parsing failed for ${filePath}: ${parseError.message}`);
            return null;
        }
        
        return results;
    }
    
    // Анализ Python через строки (без AST, но с умной фильтрацией)
    analyzePython(content, filePath) {
        const results = [];
        const lines = content.split('\n');
        let inMultiLineString = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Пропускаем многострочные строки
            if (line.includes('"""') || line.includes("'''")) {
                inMultiLineString = !inMultiLineString;
                continue;
            }
            if (inMultiLineString) continue;
            
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            // Ищем eval( или exec( как отдельные слова
            // Используем более точную регулярку
            const evalMatch = line.match(/(?<![a-zA-Z0-9_])eval\s*\(/);
            const execMatch = line.match(/(?<![a-zA-Z0-9_])exec\s*\(/);
            
            if (evalMatch || execMatch) {
                // Проверка на false positive через контекст
                if (!this.isPythonFalsePositive(line)) {
                    results.push({
                        type: evalMatch ? 'eval' : 'exec',
                        line: i + 1,
                        code: line.trim()
                    });
                }
            }
        }
        
        return results;
    }
    
    isPythonFalsePositive(line) {
        // Проверяем контекст: если eval/exec внутри кавычек - это false positive
        const beforeEval = line.split(/eval\s*\(/)[0];
        const beforeExec = line.split(/exec\s*\(/)[0];
        
        // Проверяем количество кавычек перед вызовом
        const quotesBeforeEval = (beforeEval.match(/['"]/g) || []).length;
        const quotesBeforeExec = (beforeExec.match(/['"]/g) || []).length;
        
        // Нечетное количество кавычек означает, что мы внутри строки
        if (quotesBeforeEval % 2 === 1 || quotesBeforeExec % 2 === 1) {
            return true;
        }
        
        // Другие false positive паттерны
        const fpPatterns = [
            /re\.compile/,
            /subprocess\./,
            /#.*eval/,
            /#.*exec/,
            /ast\.literal_eval/,
            /json\.loads/
        ];
        
        return fpPatterns.some(pattern => pattern.test(line));
    }
    
    // Анализ Go через строки
    analyzeGo(content, filePath) {
        const results = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            if (!trimmed || trimmed.startsWith('//')) continue;
            
            // Поиск опасных паттернов
            const patterns = [
                { regex: /\bexec\.Command\s*\(/, type: 'command-injection', rule: 'command-injection' },
                { regex: /\bos\.Exec\s*\(/, type: 'command-injection', rule: 'command-injection' },
                { regex: /\bsyscall\./, type: 'dangerous-syscall', rule: 'go-dangerous-syscall' },
                { regex: /ioutil\.ReadFile.*os\.Args/, type: 'path-traversal', rule: 'path-traversal' },
                { regex: /ioutil\.WriteFile.*os\.Args/, type: 'path-traversal', rule: 'path-traversal' },
                { regex: /http\.Get\s*\(.*os\.Args/, type: 'ssrf', rule: 'ssrf-vulnerability' },
                { regex: /http\.Post\s*\(.*os\.Args/, type: 'ssrf', rule: 'ssrf-vulnerability' }
            ];
            
            for (const { regex, type, rule } of patterns) {
                if (regex.test(line)) {
                    results.push({ type, rule, line: i + 1, code: line.trim() });
                    break;
                }
            }
        }
        
        return results;
    }
    
    // Анализ C/C++ через строки
analyzeCpp(content, filePath) {
    const results = [];
    const lines = content.split('\n');
    let inMultiLineComment = false;
    
    // Определяем язык по расширению файла
    const ext = path.extname(filePath).toLowerCase();
    const isCFile = ['.c', '.h'].includes(ext);
    const isCppFile = ['.cpp', '.hpp', '.cc', '.cxx', '.c++', '.h++', '.hh'].includes(ext);
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Обработка многострочных комментариев
        if (inMultiLineComment) {
            if (line.includes('*/')) {
                inMultiLineComment = false;
                line = line.substring(line.indexOf('*/') + 2);
            } else {
                continue;
            }
        }
        
        // Удаляем однострочные комментарии
        const commentStart = line.indexOf('//');
        if (commentStart !== -1) {
            line = line.substring(0, commentStart);
        }
        
        // Удаляем многострочные комментарии
        const multiLineStart = line.indexOf('/*');
        if (multiLineStart !== -1) {
            if (line.includes('*/', multiLineStart + 2)) {
                const endPos = line.indexOf('*/', multiLineStart + 2);
                line = line.substring(0, multiLineStart) + line.substring(endPos + 2);
            } else {
                inMultiLineComment = true;
                line = line.substring(0, multiLineStart);
            }
        }
        
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Общие опасные паттерны для C и C++
        const commonPatterns = [
            { regex: /\bgets\s*\(/, type: 'gets', rule: 'cpp-gets-buffer-overflow', languages: ['c', 'cpp'] },
            { regex: /\bstrcpy\s*\(/, type: 'strcpy', rule: 'cpp-strcpy-unsafe', languages: ['c', 'cpp'] },
            { regex: /\bstrcat\s*\(/, type: 'strcat', rule: 'cpp-strcat-unsafe', languages: ['c', 'cpp'] },
            { regex: /\bsprintf\s*\(/, type: 'sprintf', rule: 'cpp-sprintf-unsafe', languages: ['c', 'cpp'] },
            { regex: /\bvsprintf\s*\(/, type: 'vsprintf', rule: 'cpp-vsprintf-unsafe', languages: ['c', 'cpp'] },
            { regex: /\bscanf\s*\(/, type: 'scanf', rule: 'cpp-scanf-unsafe', languages: ['c', 'cpp'] },
            { regex: /\bprintf\s*\([^"]/, type: 'printf-format', rule: 'cpp-printf-user-input', languages: ['c', 'cpp'] },
            { regex: /\bsystem\s*\(/, type: 'system', rule: 'cpp-system-call', languages: ['c', 'cpp'] },
            { regex: /\bpopen\s*\(/, type: 'popen', rule: 'cpp-popen', languages: ['c', 'cpp'] }
        ];
        
        // Паттерны ТОЛЬКО для C++ (не для C)
        const cppOnlyPatterns = [
            { regex: /\bnew\s+(?![\]])/, type: 'new', rule: 'cpp-new-without-delete', languages: ['cpp'] },
            { regex: /\bdelete\s+/, type: 'delete', rule: 'cpp-delete', languages: ['cpp'] },
            { regex: /\bnew\s*\[/, type: 'new-array', rule: 'cpp-new-array', languages: ['cpp'] },
            { regex: /\bdelete\s*\[/, type: 'delete-array', rule: 'cpp-delete-array', languages: ['cpp'] }
        ];
        
        // Проверяем общие паттерны
        for (const { regex, type, rule, languages } of commonPatterns) {
            if (regex.test(line)) {
                results.push({ type, rule, line: i + 1, code: line.trim() });
                break;
            }
        }
        
        // Проверяем C++ только для C++ файлов
        if (isCppFile) {
            for (const { regex, type, rule, languages } of cppOnlyPatterns) {
                if (regex.test(line)) {
                    results.push({ type, rule, line: i + 1, code: line.trim() });
                    break;
                }
            }
        }
    }
    
    return results;
}
}

// ==================== GIT ХЕНДЛЕР ====================
class GitRepositoryHandler {
    constructor() {
        this.tempDir = path.join(os.tmpdir(), 'hercules-repos');
    }

    isValidRepositoryUrl(url) {
        if (!url) return false;
        const patterns = [
            /^https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\.git)?$/i,
            /^git@github\.com:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\.git)?$/i,
            /^https?:\/\/(?:www\.)?gitlab\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\.git)?$/i,
        ];
        return patterns.some(pattern => pattern.test(url.trim()));
    }

    detectRepositoryType(url) {
        const urlLower = url.toLowerCase();
        if (urlLower.includes('github.com')) return 'github';
        if (urlLower.includes('gitlab.com')) return 'gitlab';
        return 'generic';
    }

    parseRepositoryUrl(url) {
        const cleanUrl = url.replace(/\.git$/, '');
        let owner = '', repo = '';
        if (cleanUrl.startsWith('http')) {
            const match = cleanUrl.match(/https?:\/\/(?:www\.)?(?:github\.com|gitlab\.com)\/([^\/]+)\/([^\/]+)/);
            if (match) { owner = match[1]; repo = match[2]; }
        } else if (cleanUrl.startsWith('git@')) {
            const match = cleanUrl.match(/git@(?:github\.com|gitlab\.com):([^\/]+)\/([^\/]+)/);
            if (match) { owner = match[1]; repo = match[2]; }
        }
        return { owner, repo, type: this.detectRepositoryType(url) };
    }

    async getDefaultBranch(url, type, owner, repo) {
        try {
            if (type === 'github') {
                const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
                const response = await fetch(apiUrl, {
                    headers: { 'User-Agent': 'Hercules-SAST', 'Accept': 'application/vnd.github.v3+json' }
                });
                if (response.ok) {
                    const data = await response.json();
                    return data.default_branch || 'main';
                }
            } else if (type === 'gitlab') {
                const encodedPath = encodeURIComponent(`${owner}/${repo}`);
                const apiUrl = `https://gitlab.com/api/v4/projects/${encodedPath}`;
                const response = await fetch(apiUrl, {
                    headers: { 'User-Agent': 'Hercules-SAST' }
                });
                if (response.ok) {
                    const data = await response.json();
                    return data.default_branch || 'main';
                }
            }
        } catch (error) {
            logger.warn(`Failed to get branch info: ${error.message}`);
        }
        return 'main';
    }

    async checkRepositoryExists(url) {
        const type = this.detectRepositoryType(url);
        const { owner, repo } = this.parseRepositoryUrl(url);
        if (!owner || !repo) return { exists: false, error: 'Failed to parse URL' };

        try {
            if (type === 'github') {
                const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
                const response = await fetch(apiUrl, {
                    headers: { 'User-Agent': 'Hercules-SAST', 'Accept': 'application/vnd.github.v3+json' }
                });
                if (response.status === 200) return { exists: true, type, owner, repo };
                if (response.status === 404) return { exists: false, error: `Repository ${owner}/${repo} not found` };
            } else if (type === 'gitlab') {
                const encodedPath = encodeURIComponent(`${owner}/${repo}`);
                const apiUrl = `https://gitlab.com/api/v4/projects/${encodedPath}`;
                const response = await fetch(apiUrl, { headers: { 'User-Agent': 'Hercules-SAST' } });
                if (response.status === 200) return { exists: true, type, owner, repo };
                if (response.status === 404) return { exists: false, error: `Project ${owner}/${repo} not found` };
            }
            return { exists: false, error: 'Repository check failed' };
        } catch (error) {
            return { exists: false, error: error.message };
        }
    }

    async downloadRepository(url, branch = null) {
        const { exists, error, type, owner, repo } = await this.checkRepositoryExists(url);
        if (!exists) throw new Error(error || 'Repository not found');
        
        if (!branch) branch = await this.getDefaultBranch(url, type, owner, repo);
        
        const repoDir = path.join(this.tempDir, `${owner}-${repo}-${Date.now()}`);
        await fs.mkdir(repoDir, { recursive: true });

        try {
            const branchArg = branch ? `-b ${branch}` : '';
            await execAsync(`git clone ${branchArg} --depth 1 "${url}" "${path.join(repoDir, 'source')}"`);
            
            const sourceDir = path.join(repoDir, 'source');
            if (!await this.fileExists(sourceDir)) {
                throw new Error('Failed to clone repository');
            }

            return {
                id: `${owner}-${repo}-${Date.now()}`,
                path: sourceDir,
                owner, repo, type, url, branch
            };
        } catch (error) {
            await fs.rm(repoDir, { recursive: true, force: true }).catch(() => {});
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    async fileExists(filePath) {
        try { await fs.access(filePath); return true; } catch { return false; }
    }

    async cleanup(repoId) {
        try {
            const dirs = await fs.readdir(this.tempDir);
            for (const dir of dirs) {
                if (dir.includes(repoId)) {
                    await fs.rm(path.join(this.tempDir, dir), { recursive: true, force: true });
                }
            }
        } catch (error) {
            logger.error('Cleanup error', { error: error.message });
        }
    }
}

const gitHandler = new GitRepositoryHandler();

// ==================== ОСНОВНОЙ ДВИЖОК ====================
class AnalysisEngine {
    constructor(options = {}) {
        this.rules = [];
        this.results = [];
        this.lineAnalyzer = new LineAnalyzer(this);
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024;
    }

    async loadRulesFromFile(configFile) {
        try {
            const configData = await fs.readFile(configFile, 'utf-8');
            const config = JSON.parse(configData);
            const rules = Array.isArray(config) ? config : config.rules;
            
            if (!rules || !Array.isArray(rules)) {
                throw new Error('Invalid rules format');
            }
            
            this.rules = rules.map(ruleConfig => new Rule(ruleConfig));
            return this;
        } catch (error) {
            logger.error(`Error loading rules: ${error.message}`);
            throw error;
        }
    }

isRuleApplicableForFile(rule, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();
    
    if (!rule.languages || rule.languages.length === 0) return true;
    if (rule.languages.includes('all')) return true;
    
    // Разделяем C и C++
    if (rule.languages.includes('c') && ['.c', '.h'].includes(ext)) return true;
    if (rule.languages.includes('cpp') && ['.cpp', '.hpp', '.cc', '.cxx', '.c++', '.h++', '.hh'].includes(ext)) return true;
    
    const langMap = {
        'go': ['.go'],
        'python': ['.py'],
        'javascript': ['.js', '.jsx'],
        'typescript': ['.ts', '.tsx'],
        'java': ['.java'],
        'yaml': ['.yaml', '.yml'],
        'php': ['.php', '.php5', '.phtml']
    };
    
    for (const [lang, exts] of Object.entries(langMap)) {
        if (rule.languages.includes(lang) && exts.includes(ext)) return true;
    }
    
    if (rule.languages.includes('dockerfile') && (fileName === 'dockerfile' || fileName.startsWith('dockerfile.'))) return true;
    if (rule.languages.includes('terraform') && (ext === '.tf' || ext === '.tfvars')) return true;
    
    return false;
}
    async analyze(target) {
        this.results = [];
        
        if (gitHandler.isValidRepositoryUrl(target)) {
            return await this.analyzeRepository(target);
        }
        
        const stats = await fs.stat(target);
        if (stats.isDirectory()) {
            await this.analyzeDirectory(target);
        } else {
            await this.analyzeFile(target);
        }
        
        return this.generateResults(target);
    }

    async analyzeRepository(url, branch = null) {
        try {
            const repoInfo = await gitHandler.downloadRepository(url, branch);
            await this.analyzeDirectory(repoInfo.path);
            await gitHandler.cleanup(repoInfo.id);
            return this.generateResults(url);
        } catch (error) {
            throw new Error(`Repository analysis failed: ${error.message}`);
        }
    }

    async analyzeDirectory(dir) {
        const files = [];
        await this.walkDirectory(dir, files);
        
        for (const file of files) {
            await this.analyzeFile(file);
        }
    }

    async walkDirectory(dir, files) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const skipDirs = new Set(['node_modules', '.git', 'target', 'build', 'dist', '__pycache__', 'venv']);
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    if (!skipDirs.has(entry.name)) {
                        await this.walkDirectory(fullPath, files);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    const analyzeExts = new Set([
                        '.js', '.ts', '.jsx', '.tsx', 
                        '.py', '.go', '.java', '.php', 
                        '.yaml', '.yml', '.tf',
                        '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx'
                    ]);
                    
                    if (analyzeExts.has(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            logger.warn(`Error walking ${dir}: ${error.message}`);
        }
    }

    async analyzeFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            if (content.length > this.maxFileSize) {
                return;
            }
            
            const ext = path.extname(filePath).toLowerCase();
            let astResults = null;
            
            // Выбор анализатора в зависимости от типа файла
            if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
                astResults = this.lineAnalyzer.analyzeJavaScript(content, filePath);
            } else if (ext === '.py') {
                astResults = this.lineAnalyzer.analyzePython(content, filePath);
            } else if (ext === '.go') {
                astResults = this.lineAnalyzer.analyzeGo(content, filePath);
            } else if (['.c', '.h', '.cpp', '.hpp', '.cc', '.cxx'].includes(ext)) {
                astResults = this.lineAnalyzer.analyzeCpp(content, filePath);
            }
            
            // Добавляем результаты AST анализа
            if (astResults && astResults.length > 0) {
                for (const astResult of astResults) {
                    const rule = this.findMatchingRule(astResult.rule || astResult.type);
                    if (rule) {
                        this.addResult(rule, filePath, astResult.line, 0, astResult.code);
                    }
                }
            }
            
            // Применяем regex правила
            await this.applyRegexRules(filePath, content);
            
        } catch (error) {
            logger.error(`Error analyzing ${filePath}: ${error.message}`);
        }
    }
    
    findMatchingRule(typeOrRuleId) {
        // Прямое сопоставление с ruleId
        const rule = this.rules.find(r => r.id === typeOrRuleId);
        if (rule) return rule;
        
        // Маппинг типов на ruleId
        const typeToRuleId = {
            'eval': 'python-eval',
            'exec': 'python-eval',
            'command-injection': 'command-injection',
            'dangerous-syscall': 'go-dangerous-syscall',
            'path-traversal': 'path-traversal',
            'ssrf': 'ssrf-vulnerability',
            'sql-injection': 'sql-injection',
            'mass-assignment': 'mass-assignment',
            'hardcoded-secret': 'hardcoded-credentials',
            'dynamic-require': 'insecure-require',
            'gets': 'cpp-gets-buffer-overflow',
            'strcpy': 'cpp-strcpy-unsafe',
            'sprintf': 'cpp-sprintf-unsafe',
            'printf-format': 'cpp-printf-user-input',
            'system': 'cpp-system-call',
            'new': 'cpp-new-without-delete'
        };
        
        const ruleId = typeToRuleId[typeOrRuleId];
        return this.rules.find(r => r.id === ruleId);
    }
    
    async applyRegexRules(filePath, content) {
        const lines = content.split('\n');
        
        for (const rule of this.rules) {
            if (!this.isRuleApplicableForFile(rule, filePath)) continue;
            
            try {
                if (rule.type === 'regex') {
                    const regex = new RegExp(rule.pattern, rule.flags || 'g');
                    
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        regex.lastIndex = 0;
                        const match = regex.exec(line);
                        
                        if (match) {
                            if (this.isFalsePositive(rule.id, line)) continue;
                            this.addResult(rule, filePath, i + 1, match.index, line.trim());
                        }
                    }
                }
            } catch (e) {
                logger.warn(`Rule error ${rule.id}: ${e.message}`);
            }
        }
    }
    
    isFalsePositive(ruleId, line) {
        const fpPatterns = {
            'http-instead-https': [
                /console\.log/i, /console\.info/i, /console\.debug/i,
                /example\.com/, /test\.com/, /localhost/
            ],
            'hardcoded-credentials': [
                /password:\s*['"]{2}/, /token:\s*['"]{2}/
            ],
            'python-eval': [
                /re\.compile/, /subprocess\./, /ast\.literal_eval/, /json\.loads/
            ]
        };
        
        const patterns = fpPatterns[ruleId];
        if (patterns) {
            return patterns.some(pattern => pattern.test(line));
        }
        return false;
    }

    addResult(rule, filePath, line, column, code) {
        const codeStr = String(code || '').trim();
        
        if (!codeStr || codeStr.length < 3) return;
        if (/^\d+$/.test(codeStr)) return;
        
        this.results.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.message,
            file: getShortPath(filePath),
            fullPath: filePath,
            line: line,
            column: column,
            code: codeStr.substring(0, 500),
            recommendation: rule.recommendation
        });
    }

    generateResults(target) {
        return {
            results: this.results,
            summary: this.generateSummary(),
            metadata: {
                scanTime: new Date().toISOString(),
                target: target,
                rulesCount: this.rules.length
            }
        };
    }

    generateSummary() {
        const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        const byRule = {};
        
        for (const result of this.results) {
            bySeverity[result.severity] = (bySeverity[result.severity] || 0) + 1;
            byRule[result.ruleId] = (byRule[result.ruleId] || 0) + 1;
        }
        
        return { total: this.results.length, bySeverity, byRule };
    }
}

class Rule {
    constructor(config) {
        this.id = config.id;
        this.message = config.message;
        this.severity = config.severity || 'medium';
        this.recommendation = config.recommendation || '';
        this.pattern = config.pattern;
        this.type = config.type || 'pattern';
        this.flags = config.flags || 'g';
        this.languages = config.languages || null;
    }
}

// ==================== ЭКСПОРТЫ ====================
export async function analyzeCode(targetPath, rulesPath = './rules.json', options = {}) {
    try {
        const engine = new AnalysisEngine(options);
        await engine.loadRulesFromFile(rulesPath);
        const results = await engine.analyze(targetPath);
        return results;
    } catch (error) {
        logger.error('Fatal error:', { error: error.message });
        throw error;
    }
}

export { AnalysisEngine, Rule, getShortPath, gitHandler };