import fs from 'fs/promises';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config({ quiet: true });

const execAsync = promisify(exec);
const traverse = _traverse.default || _traverse;

// ==================== НАСТРОЙКА ЛОГГЕРА ====================
const LOG_DIR = './logs/sast';

async function ensureLogDir() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (err) {}
}

await ensureLogDir();

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: path.join(LOG_DIR, 'log.txt') })
    ]
});

// Отключаем console.log в production
if (process.env.NODE_ENV === 'production') {
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.debug = () => {};
}

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

    getCodeBlock(content, lineNumber, contextLines = 2) {
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

    formatCodeBlock(block) {
        if (!block || !block.lines) return '';
        
        let output = '';
        for (const line of block.lines) {
            const prefix = line.isVulnerable ? '→ ' : '  ';
            const lineNum = String(line.number).padStart(4, ' ');
            output += `${prefix}${lineNum} | ${line.code}\n`;
        }
        return output;
    }

    // Анализ Java
    analyzeJava(content, filePath) {
        const results = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
            
            // SQL инъекции
            if (/(?:Statement|PreparedStatement)\s*=\s*.*?\.createStatement\s*\(.*?\+.*?\)/.test(line) ||
                /\.execute(?:Query|Update)\s*\(.*?\+(?:.*?)\)/.test(line)) {
                results.push({
                    type: 'sql-injection',
                    ruleId: 'sql-injection',
                    severity: 'critical',
                    message: 'Потенциальная SQL инъекция через конкатенацию строк',
                    line: i + 1,
                    code: line.trim(),
                    fullContent: content
                });
            }
            
            // Command injection
            if (/Runtime\.getRuntime\(\)\.exec\s*\(.*?\+(?:.*?)\)/.test(line) ||
                /ProcessBuilder\s*\(.*?\+(?:.*?)\)/.test(line)) {
                results.push({
                    type: 'command-injection',
                    ruleId: 'command-injection',
                    severity: 'critical',
                    message: 'Потенциальная инъекция команд',
                    line: i + 1,
                    code: line.trim(),
                    fullContent: content
                });
            }
            
            // Path traversal
            if (/new\s+File\s*\(.*?\+(?:.*?)\)/.test(line)) {
                results.push({
                    type: 'path-traversal',
                    ruleId: 'path-traversal',
                    severity: 'high',
                    message: 'Потенциальная Path Traversal уязвимость',
                    line: i + 1,
                    code: line.trim(),
                    fullContent: content
                });
            }
            
            // XXE
            if (/DocumentBuilderFactory\.newInstance\(\)/.test(line)) {
                results.push({
                    type: 'xxe',
                    ruleId: 'xxe',
                    severity: 'high',
                    message: 'XXE уязвимость - DocumentBuilderFactory без защиты',
                    line: i + 1,
                    code: line.trim(),
                    fullContent: content
                });
            }
            
            // Insecure deserialization
            if (/ObjectInputStream\s*\(/.test(line)) {
                results.push({
                    type: 'insecure-deserialization',
                    ruleId: 'insecure-deserialization',
                    severity: 'critical',
                    message: 'Небезопасная десериализация',
                    line: i + 1,
                    code: line.trim(),
                    fullContent: content
                });
            }
            
            // Hardcoded credentials
            if (/(?:password|apiKey|secret|token)\s*=\s*["'][^"']{4,}["']/i.test(line)) {
                results.push({
                    type: 'hardcoded-credentials',
                    ruleId: 'hardcoded-credentials',
                    severity: 'critical',
                    message: 'Жестко закодированные учетные данные',
                    line: i + 1,
                    code: line.trim(),
                    fullContent: content
                });
            }
        }
        return results;
    }

    // Анализ Rust
    analyzeRust(content, filePath) {
        const results = [];
        const lines = content.split('\n');
        let inDocComment = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmed = line.trim();
            
            if (trimmed.startsWith('///') || trimmed.startsWith('//!')) continue;
            if (trimmed.startsWith('/*')) { inDocComment = true; continue; }
            if (inDocComment) {
                if (trimmed.includes('*/')) inDocComment = false;
                continue;
            }
            
            const patterns = [
                { regex: /\bunsafe\s*\{/, type: 'unsafe-code', ruleId: 'rust-unsafe-code', severity: 'high', message: 'Использование unsafe блока' },
                { regex: /\bunsafe\s+fn\s+/, type: 'unsafe-function', ruleId: 'rust-unsafe-function', severity: 'high', message: 'Небезопасная функция' },
                { regex: /std::process::Command::new\s*\([^)]*::(?:var|env)/, type: 'command-injection', ruleId: 'command-injection', severity: 'critical', message: 'Потенциальная инъекция команд' },
                { regex: /let\s+(?:password|api_key|secret|token)\s*=\s*["'][^"']{8,}["']/, type: 'hardcoded-credentials', ruleId: 'hardcoded-credentials', severity: 'critical', message: 'Жестко закодированные учетные данные' },
            ];
            
            for (const { regex, type, ruleId, severity, message } of patterns) {
                if (regex.test(line)) {
                    results.push({
                        type: type,
                        ruleId: ruleId,
                        severity: severity,
                        message: message,
                        line: i + 1,
                        code: line.trim(),
                        fullContent: content
                    });
                    break;
                }
            }
        }
        return results;
    }

    // Анализ JavaScript/TypeScript
    analyzeJavaScript(content, filePath) {
        const results = [];
        
        try {
            const ast = parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript', 'decorators', 'classProperties', 'dynamicImport']
            });
            
            const lines = content.split('\n');
            
            traverse(ast, {
                CallExpression: (path) => {
                    const { node } = path;
                    const line = node.loc?.start.line;
                    const codeLine = line ? lines[line - 1]?.trim() : '';
                    
                    if (t.isIdentifier(node.callee) && node.callee.name === 'eval') {
                        results.push({
                            type: 'eval',
                            ruleId: 'eval',
                            severity: 'critical',
                            message: 'Использование eval()',
                            line: line,
                            code: codeLine,
                            fullContent: content
                        });
                    }
                    
                    if (t.isMemberExpression(node.callee)) {
                        const obj = node.callee.object;
                        const prop = node.callee.property;
                        
                        if (t.isIdentifier(obj) && t.isIdentifier(prop)) {
                            if ((obj.name === 'child_process') && (prop.name === 'exec' || prop.name === 'execSync')) {
                                results.push({
                                    type: 'command-injection',
                                    ruleId: 'command-injection',
                                    severity: 'critical',
                                    message: 'Потенциальная инъекция команд',
                                    line: line,
                                    code: codeLine,
                                    fullContent: content
                                });
                            }
                            
                            if (obj.name === 'fs' && (prop.name === 'readFile' || prop.name === 'writeFile')) {
                                results.push({
                                    type: 'path-traversal',
                                    ruleId: 'path-traversal',
                                    severity: 'high',
                                    message: 'Потенциальная Path Traversal уязвимость',
                                    line: line,
                                    code: codeLine,
                                    fullContent: content
                                });
                            }
                        }
                    }
                },
                
                StringLiteral: (path) => {
                    const { node } = path;
                    const value = node.value;
                    const line = node.loc?.start.line;
                    
                    if (value && typeof value === 'string') {
                        const sqlPatterns = /(SELECT|INSERT|UPDATE|DELETE|DROP).+?(WHERE|VALUES|SET)/i;
                        if (sqlPatterns.test(value) && !value.includes('?') && !value.includes('$1')) {
                            results.push({
                                type: 'sql-injection',
                                ruleId: 'sql-injection',
                                severity: 'critical',
                                message: 'Потенциальная SQL инъекция',
                                line: line,
                                code: `"${value.substring(0, 100)}${value.length > 100 ? '...' : ''}"`,
                                fullContent: content
                            });
                        }
                    }
                },
                
                ObjectProperty: (path) => {
                    const { node } = path;
                    const line = node.loc?.start.line;
                    
                    if (t.isIdentifier(node.key)) {
                        const key = node.key.name.toLowerCase();
                        const secretKeys = ['password', 'secret', 'token', 'apikey', 'api_key'];
                        
                        if (secretKeys.includes(key) && t.isStringLiteral(node.value)) {
                            const value = node.value.value;
                            if (value && value.length > 0 && !value.includes('process.env')) {
                                results.push({
                                    type: 'hardcoded-credentials',
                                    ruleId: 'hardcoded-credentials',
                                    severity: 'critical',
                                    message: 'Жестко закодированные учетные данные',
                                    line: line,
                                    code: `${key}: "${value.substring(0, 20)}${value.length > 20 ? '...' : ''}"`,
                                    fullContent: content
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
    
    // Анализ Python
    analyzePython(content, filePath) {
        const results = [];
        const lines = content.split('\n');
        let inMultiLineString = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            if (line.includes('"""') || line.includes("'''")) {
                inMultiLineString = !inMultiLineString;
                continue;
            }
            if (inMultiLineString) continue;
            
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            const evalMatch = line.match(/(?<![a-zA-Z0-9_])eval\s*\(/);
            const execMatch = line.match(/(?<![a-zA-Z0-9_])exec\s*\(/);
            
            if (evalMatch || execMatch) {
                results.push({
                    type: evalMatch ? 'eval' : 'exec',
                    ruleId: evalMatch ? 'eval' : 'dangerous-code-execution',
                    severity: 'critical',
                    message: evalMatch ? 'Использование eval()' : 'Использование exec()',
                    line: i + 1,
                    code: line.trim(),
                    fullContent: content
                });
            }
        }
        return results;
    }
    
    // Анализ Go
    analyzeGo(content, filePath) {
        const results = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            
            const patterns = [
                { regex: /\bexec\.Command\s*\(/, type: 'command-injection', ruleId: 'command-injection', severity: 'critical', message: 'Потенциальная инъекция команд' },
                { regex: /\bos\.Exec\s*\(/, type: 'command-injection', ruleId: 'command-injection', severity: 'critical', message: 'Потенциальная инъекция команд' },
                { regex: /http\.Get\s*\(.*os\.Args/, type: 'ssrf', ruleId: 'ssrf-vulnerability', severity: 'high', message: 'Потенциальная SSRF уязвимость' }
            ];
            
            for (const { regex, type, ruleId, severity, message } of patterns) {
                if (regex.test(line)) {
                    results.push({
                        type: type,
                        ruleId: ruleId,
                        severity: severity,
                        message: message,
                        line: i + 1,
                        code: line.trim(),
                        fullContent: content
                    });
                    break;
                }
            }
        }
        return results;
    }
    
    // Анализ C/C++
    analyzeCpp(content, filePath) {
        const results = [];
        const lines = content.split('\n');
        let inMultiLineComment = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            if (inMultiLineComment) {
                if (line.includes('*/')) {
                    inMultiLineComment = false;
                    line = line.substring(line.indexOf('*/') + 2);
                } else {
                    continue;
                }
            }
            
            const commentStart = line.indexOf('//');
            if (commentStart !== -1) line = line.substring(0, commentStart);
            
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
            
            const patterns = [
                { regex: /\bgets\s*\(/, type: 'gets', ruleId: 'cpp-gets-buffer-overflow', severity: 'critical', message: 'Опасная функция gets() может вызвать переполнение буфера' },
                { regex: /\bstrcpy\s*\(/, type: 'strcpy', ruleId: 'cpp-strcpy-unsafe', severity: 'high', message: 'Опасная функция strcpy() без проверки границ' },
                { regex: /\bstrcat\s*\(/, type: 'strcat', ruleId: 'cpp-strcat-unsafe', severity: 'high', message: 'Опасная функция strcat() без проверки границ' },
                { regex: /\bsprintf\s*\(/, type: 'sprintf', ruleId: 'cpp-sprintf-unsafe', severity: 'high', message: 'Опасная функция sprintf() без проверки границ' },
                { regex: /\bsystem\s*\(/, type: 'system', ruleId: 'cpp-system-call', severity: 'critical', message: 'Вызов системной команды' }
            ];
            
            for (const { regex, type, ruleId, severity, message } of patterns) {
                if (regex.test(line)) {
                    results.push({
                        type: type,
                        ruleId: ruleId,
                        severity: severity,
                        message: message,
                        line: i + 1,
                        code: line.trim(),
                        fullContent: content
                    });
                    break;
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
            const rules = JSON.parse(configData);
            
            if (!rules || !Array.isArray(rules)) {
                throw new Error('Invalid rules format');
            }
            
            this.rules = rules.map(ruleConfig => new Rule(ruleConfig));
            logger.info(`Loaded ${this.rules.length} rules from ${configFile}`);
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
        if (rule.languages.includes('c') && ['.c', '.h'].includes(ext)) return true;
        if (rule.languages.includes('cpp') && ['.cpp', '.hpp', '.cc', '.cxx'].includes(ext)) return true;
        
        const langMap = {
            'go': ['.go'],
            'python': ['.py'],
            'javascript': ['.js', '.jsx'],
            'typescript': ['.ts', '.tsx'],
            'php': ['.php', '.php5', '.phtml'],
            'ruby': ['.rb', '.ruby'],
            'rust': ['.rs'],
            'c': ['.c', '.h'],
            'cpp': ['.cpp', '.hpp', '.cc', '.cxx'],
            'java': ['.java']
        };
        
        for (const [lang, exts] of Object.entries(langMap)) {
            if (rule.languages.includes(lang) && exts.includes(ext)) return true;
        }
        
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
            const skipDirs = new Set(['node_modules', '.git', 'target', 'build', 'dist', '__pycache__', 'venv', 'vendor', 'tmp', 'log']);
            
            const analyzeExts = new Set([
                '.js', '.ts', '.jsx', '.tsx', '.py', '.go',
                '.php', '.php5', '.phtml', '.rb', '.ruby', '.rs',
                '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.java'
            ]);
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    if (!skipDirs.has(entry.name)) {
                        await this.walkDirectory(fullPath, files);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
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
        if (content.length > this.maxFileSize) return;
        
        // Только regex правила из rules.json — единый подход для всех языков
        await this.applyRegexRules(filePath, content);
        
    } catch (error) {
        logger.error(`Error analyzing ${filePath}: ${error.message}`);
    }
}

    getDefaultMessage(type) {
        const messages = {
            'eval': 'Обнаружено использование eval()',
            'exec': 'Обнаружено использование exec()',
            'command-injection': 'Потенциальная инъекция команд',
            'sql-injection': 'Потенциальная SQL инъекция',
            'xss': 'Потенциальная XSS уязвимость',
            'ssrf': 'Потенциальная SSRF уязвимость',
            'hardcoded-credentials': 'Обнаружены жестко закодированные учетные данные',
            'insecure-deserialization': 'Небезопасная десериализация',
            'gets': 'Опасная функция gets() может вызвать переполнение буфера',
            'strcpy': 'Опасная функция strcpy() без проверки границ',
            'sprintf': 'Опасная функция sprintf() без проверки границ',
            'system': 'Вызов системной команды с пользовательским вводом',
            'xxe': 'XXE уязвимость в XML парсере',
            'path-traversal': 'Потенциальная Path Traversal уязвимость',
            'bola-idor': 'Потенциальная BOLA/IDOR уязвимость'
        };
        return messages[type] || 'Обнаружена потенциальная уязвимость';
    }

    getRecommendation(type) {
        const recommendations = {
            'eval': 'Избегайте использования eval(). Используйте безопасные альтернативы',
            'command-injection': 'Никогда не передавайте пользовательский ввод в команды оболочки',
            'sql-injection': 'Используйте параметризованные запросы или ORM',
            'hardcoded-credentials': 'Используйте переменные окружения или менеджеры секретов',
            'gets': 'Используйте fgets() вместо gets()',
            'strcpy': 'Используйте strncpy() или strcpy_s()',
            'xxe': 'Установите FEATURE_SECURE_PROCESSING и отключите внешние entity',
            'path-traversal': 'Используйте path.resolve() и проверку на выход за пределы директории',
            'bola-idor': 'Всегда проверяйте права доступа: убедитесь, что текущий пользователь имеет доступ к запрашиваемому объекту'
        };
        return recommendations[type] || 'Проверьте код на наличие уязвимостей';
    }
    
    async applyRegexRules(filePath, content) {
        const lines = content.split('\n');
        
        for (const rule of this.rules) {
            if (!this.isRuleApplicableForFile(rule, filePath)) continue;
            
            // Главное исправление: проверяем наличие pattern, а не rule.type
            if (!rule.pattern) continue;
            
            try {
                const regex = new RegExp(rule.pattern, rule.flags || 'gi');
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    regex.lastIndex = 0;
                    const match = regex.exec(line);
                    
                    if (match) {
                        this.addResult(rule, filePath, i + 1, match.index, line.trim(), content);
                    }
                }
            } catch (e) {
                logger.warn(`Rule error ${rule.id}: ${e.message}`);
            }
        }
    }

    addResult(rule, filePath, line, column, code, fullContent = null) {
        const codeStr = String(code || '').trim();
        if (!codeStr || codeStr.length < 3) return;
        if (/^\d+$/.test(codeStr)) return;
        
        let codeBlock = null;
        
        if (fullContent && line) {
            codeBlock = this.lineAnalyzer.getCodeBlock(fullContent, line, 2);
        }
        
        this.results.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.message,
            file: getShortPath(filePath),
            fullPath: filePath,
            line: line,
            column: column,
            code: codeStr.substring(0, 500),
            codeBlock: codeBlock,
            recommendation: rule.recommendation || this.getRecommendation(rule.id)
        });
    }

    generateResults(target) {
        return {
            results: this.results.map(result => ({
                ruleId: result.ruleId,
                severity: result.severity,
                message: result.message,
                file: result.file,
                fullPath: result.fullPath,
                line: result.line,
                column: result.column,
                code: result.code,
                codeBlock: result.codeBlock || null,
                recommendation: result.recommendation
            })),
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
            const severity = result.severity?.toLowerCase() || 'info';
            bySeverity[severity] = (bySeverity[severity] || 0) + 1;
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
        this.flags = config.flags || 'gi';
        this.languages = config.languages || null;
        this.category = config.category || 'unknown';
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