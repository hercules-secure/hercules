import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { runReachabilityAnalysis } from './reach-analyzer.js';
import { fileURLToPath } from 'url';


const execAsync = promisify(exec);

// ==================== НАСТРОЙКА ЛОГИРОВАНИЯ ====================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Максимально просто - без PROJECT_ROOT и сложных путей
const LOG_DIR = './logs/blender';
const LOG_FILE = './logs/blender/log.txt';

function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function log(message, level = 'INFO') {
    try {

        ensureLogDir();
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}\n`;
        fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
    } catch (err) {}
}

// ==================== БАЗА ДАННЫХ ЛИЦЕНЗИЙ ====================

const LICENSE_DB = {
    'MIT': { type: 'permissive', risk: 'low', commercial: true, requiresAttribution: true, color: '#10b981' },
    'Apache-2.0': { type: 'permissive', risk: 'low', commercial: true, requiresAttribution: true, color: '#10b981' },
    'BSD-2-Clause': { type: 'permissive', risk: 'low', commercial: true, requiresAttribution: true, color: '#10b981' },
    'BSD-3-Clause': { type: 'permissive', risk: 'low', commercial: true, requiresAttribution: true, color: '#10b981' },
    'ISC': { type: 'permissive', risk: 'low', commercial: true, requiresAttribution: true, color: '#10b981' },
    'Unlicense': { type: 'public-domain', risk: 'low', commercial: true, requiresAttribution: false, color: '#10b981' },
    'CC0-1.0': { type: 'public-domain', risk: 'low', commercial: true, requiresAttribution: false, color: '#10b981' },
    'GPL-2.0': { type: 'copyleft', risk: 'medium', commercial: false, requiresSourceDisclosure: true, color: '#f59e0b' },
    'GPL-3.0': { type: 'copyleft', risk: 'medium', commercial: false, requiresSourceDisclosure: true, color: '#f59e0b' },
    'AGPL-3.0': { type: 'copyleft', risk: 'high', commercial: false, requiresSourceDisclosure: true, color: '#ef4444' },
    'LGPL-2.1': { type: 'weak-copyleft', risk: 'medium', commercial: true, requiresAttribution: true, color: '#f59e0b' },
    'LGPL-3.0': { type: 'weak-copyleft', risk: 'medium', commercial: true, requiresAttribution: true, color: '#f59e0b' },
    'MPL-2.0': { type: 'weak-copyleft', risk: 'medium', commercial: true, requiresAttribution: true, color: '#f59e0b' },
    'EPL-2.0': { type: 'weak-copyleft', risk: 'medium', commercial: true, requiresAttribution: true, color: '#f59e0b' },
    'CC-BY-NC-4.0': { type: 'restricted', risk: 'high', commercial: false, requiresAttribution: true, color: '#ef4444' },
    'CC-BY-NC-SA-4.0': { type: 'restricted', risk: 'high', commercial: false, requiresAttribution: true, color: '#ef4444' },
    'UNKNOWN': { type: 'unknown', risk: 'high', commercial: null, requiresReview: true, color: '#94a3b8' }
};

const LICENSE_ALIASES = {
    'GPL-2.0': ['GPLv2', 'GNU General Public License v2.0'],
    'GPL-3.0': ['GPLv3', 'GNU General Public License v3.0'],
    'MIT': ['MIT License', 'Expat License'],
    'Apache-2.0': ['Apache License 2.0', 'Apache 2.0'],
    'BSD-3-Clause': ['BSD 3-Clause', 'BSD 3-Clause "New" or "Revised" License'],
    'ISC': ['ISC License']
};

function normalizeLicense(license) {
    if (!license) return 'UNKNOWN';
    const normalized = license.trim();
    if (LICENSE_DB[normalized]) return normalized;
    for (const [mainLicense, aliases] of Object.entries(LICENSE_ALIASES)) {
        if (aliases.includes(normalized) || normalized.includes(mainLicense)) {
            return mainLicense;
        }
    }
    for (const mainLicense of Object.keys(LICENSE_DB)) {
        if (normalized.includes(mainLicense)) return mainLicense;
    }
    return 'UNKNOWN';
}

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================

async function getPackageVulnerabilities(packageName, version, ecosystem) {
    if (!ecosystem || packageName.startsWith('webbankir/')) {
        return { count: 0, vulnerabilities: [], critical: 0, high: 0, medium: 0, low: 0 };
    }
    
    try {
        const url = 'https://api.osv.dev/v1/query';
        const body = JSON.stringify({
            package: { name: packageName, ecosystem: ecosystem },
            version: version
        });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body
        });
        
        if (!response.ok) return { count: 0, vulnerabilities: [], critical: 0, high: 0, medium: 0, low: 0 };
        
        const data = await response.json();
        const vulns = data.vulns || [];
        
        let critical = 0, high = 0, medium = 0, low = 0;
        const vulnsWithDetails = [];
        
        for (const vuln of vulns) {
            try {
                const detailsRes = await fetch(`https://api.osv.dev/v1/vulns/${vuln.id}`);
                const details = await detailsRes.json();
                
                let severity = 'unknown';
                if (details.database_specific?.severity) {
                    severity = details.database_specific.severity.toLowerCase();
                } else if (details.severity?.[0]?.score) {
                    const score = details.severity[0].score;
                    severity = score >= 7 ? 'high' : (score >= 4 ? 'medium' : 'low');
                }
                
                if (severity === 'critical') critical++;
                else if (severity === 'high') high++;
                else if (severity === 'medium') medium++;
                else if (severity === 'low') low++;
                
                vulnsWithDetails.push({
                    id: vuln.id,
                    severity: severity,
                    summary: details.summary || '',
                    published: details.published,
                    modified: details.modified
                });
            } catch (err) {
                vulnsWithDetails.push({ id: vuln.id, severity: 'unknown', summary: '' });
            }
        }
        
        return { count: vulns.length, critical, high, medium, low, vulnerabilities: vulnsWithDetails };
    } catch (error) {
        log(`Ошибка получения CVE для ${packageName}: ${error.message}`, 'WARN');
        return { count: 0, vulnerabilities: [], critical: 0, high: 0, medium: 0, low: 0 };
    }
}

async function getPackageLicense(packageName, version, ecosystem) {
    if (packageName.startsWith('webbankir/')) {
        return 'PROPRIETARY';
    }
    
    const licenseMap = {
        'express': 'MIT', 'lodash': 'MIT', 'axios': 'MIT', 'react': 'MIT', 'vue': 'MIT',
        'angular': 'MIT', 'typescript': 'Apache-2.0', 'webpack': 'MIT', 'jest': 'MIT',
        'django': 'BSD-3-Clause', 'flask': 'BSD-3-Clause', 'requests': 'Apache-2.0',
        'numpy': 'BSD-3-Clause', 'pandas': 'BSD-3-Clause', 'gin-gonic/gin': 'MIT',
        'gofiber/fiber': 'MIT', 'springframework': 'Apache-2.0', 'serde': 'MIT/Apache-2.0',
        'tokio': 'MIT', 'guzzlehttp/guzzle': 'MIT', 'nesbot/carbon': 'MIT',
        'symfony/console': 'MIT', 'symfony/dotenv': 'MIT', 'symfony/yaml': 'MIT',
        'phpunit/phpunit': 'BSD-3-Clause', 'phpstan/phpstan': 'MIT'
    };
    
    let license = 'UNKNOWN';
    const pkgKey = packageName.toLowerCase();
    for (const [key, value] of Object.entries(licenseMap)) {
        if (pkgKey.includes(key)) { license = value; break; }
    }
    return normalizeLicense(license);
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

export function detectProjectTypes(startPath, maxDepth = 3) {
    const foundTypes = new Set();
    const roots = {};
    
    const markers = [
        { type: 'go', file: 'go.mod' },
        { type: 'node', file: 'package.json' },
        { type: 'rust', file: 'Cargo.toml' },
        { type: 'java-maven', file: 'pom.xml' },
        { type: 'java-gradle', file: 'build.gradle' },
        { type: 'php', file: 'composer.json' },
        { type: 'python-pip', file: 'requirements.txt' },
        { type: 'python-poetry', file: 'pyproject.toml' },
        { type: 'python-pipenv', file: 'Pipfile' },
        { type: 'ruby', file: 'Gemfile' },
        { type: 'swift', file: 'Package.swift' }
    ];
    
    function searchDirectory(currentPath, depth) {
        if (depth > maxDepth) return;
        try {
            const items = fs.readdirSync(currentPath);
            for (const marker of markers) {
                if (marker.file.includes('*')) {
                    const matching = items.filter(f => f.endsWith(marker.file.replace('*', '')));
                    if (matching.length > 0 && !foundTypes.has(marker.type)) {
                        foundTypes.add(marker.type);
                        roots[marker.type] = currentPath;
                        log(`Обнаружен ${marker.type} проект (${marker.file}) в ${currentPath}`);
                    }
                } else if (items.includes(marker.file) && !foundTypes.has(marker.type)) {
                    foundTypes.add(marker.type);
                    roots[marker.type] = currentPath;
                    log(`Обнаружен ${marker.type} проект (${marker.file}) в ${currentPath}`);
                }
            }
            for (const item of items) {
                const fullPath = path.join(currentPath, item);
                let stat;
                try { stat = fs.statSync(fullPath); } catch { continue; }
                if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                    searchDirectory(fullPath, depth + 1);
                }
            }
        } catch (err) {}
    }
    
    searchDirectory(startPath, 0);
    return { types: Array.from(foundTypes), roots };
}

export function findFilesRecursive(dirPath, pattern, excludeDirs = ['node_modules', '.git', 'vendor', 'dist', 'build', '__pycache__', '.venv', 'test', 'tests', 'examples', '.idea', '.vscode']) {
    const results = [];
    function search(directory, depth = 0) {
        if (depth > 8) return;
        const dirName = path.basename(directory);
        if (excludeDirs.includes(dirName)) return;
        try {
            const items = fs.readdirSync(directory);
            for (const item of items) {
                const fullPath = path.join(directory, item);
                let stat;
                try { stat = fs.statSync(fullPath); } catch { continue; }
                if (stat.isDirectory()) {
                    search(fullPath, depth + 1);
                } else if (item === pattern || (pattern.includes('*') && item.endsWith(pattern.replace('*', '')))) {
                    results.push(fullPath);
                }
            }
        } catch (err) {}
    }
    search(dirPath);
    return results;
}

export function findAllManifestFiles(rootPath) {
    const manifests = {
        'package.json': [], 'go.mod': [], 'requirements.txt': [], 'Pipfile': [],
        'pyproject.toml': [], 'composer.json': [], 'composer.lock': [], 'pom.xml': [],
        'build.gradle': [], 'Cargo.toml': [], 'Gemfile': [], 'Gemfile.lock': []
    };
    for (const manifest of Object.keys(manifests)) {
        const files = findFilesRecursive(rootPath, manifest);
        manifests[manifest] = files;
        if (files.length > 0) log(`Найдено ${files.length} файлов ${manifest}`);
    }
    return manifests;
}

// ==================== АНАЛИЗАТОРЫ ПАКЕТНЫХ МЕНЕДЖЕРОВ ====================

export async function analyzeGoDependencies(goModPath, projectPath) {
    const dependencies = [];
    try {
        const content = fs.readFileSync(goModPath, 'utf-8');
        const lines = content.split('\n');
        let inRequire = false;
        let moduleName = '';
        const moduleMatch = content.match(/module\s+([^\s]+)/);
        if (moduleMatch) moduleName = moduleMatch[1];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === 'require (') { inRequire = true; continue; }
            if (trimmed === ')') { inRequire = false; continue; }
            if (inRequire || trimmed.startsWith('require')) {
                let match = trimmed.match(/require\s+([^\s]+)\s+([^\s]+)/);
                if (!match) match = trimmed.match(/^([^\s]+)\s+([^\s]+)/);
                if (match) {
                    let name = match[1];
                    let version = match[2].replace(/\/\/.*$/, '').trim();
                    if (version.includes('indirect')) version = version.replace('// indirect', '').trim();
                    if (name && !name.startsWith('google.golang.org')) {
                        dependencies.push({ name, version, manager: 'go', file: path.relative(projectPath, goModPath), module: moduleName, ecosystem: 'Go' });
                    }
                }
            }
        }
        log(`Go модуль ${moduleName}: найдено ${dependencies.length} зависимостей`);
    } catch (error) {
        log(`Ошибка анализа Go файла ${goModPath}: ${error.message}`, 'ERROR');
    }
    return dependencies;
}

export async function analyzeNodeDependencies(projectPath, packageJsonPath) {
    const dependencies = [];
    const vulnerabilities = [];
    let packageManager = 'npm';
    try {
        if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) packageManager = 'yarn';
        else if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
        
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies, ...packageJson.peerDependencies };
        
        for (const [name, version] of Object.entries(allDeps || {})) {
            let cleanVersion = version.replace(/[\^~><=*]/g, '');
            if (cleanVersion === 'latest' || cleanVersion === '*' || cleanVersion === '') cleanVersion = 'unknown';
            dependencies.push({
                name, version: cleanVersion, originalVersion: version, manager: packageManager,
                file: path.relative(projectPath, packageJsonPath),
                type: packageJson.dependencies?.[name] ? 'runtime' : 'development',
                ecosystem: 'npm'
            });
        }
        
        try {
            const auditCmd = packageManager === 'yarn' ? 'yarn audit --json' : 'npm audit --json';
            const { stdout } = await execAsync(auditCmd, { cwd: projectPath });
            const auditResult = JSON.parse(stdout);
            if (auditResult.vulnerabilities) {
                for (const [pkg, data] of Object.entries(auditResult.vulnerabilities)) {
                    vulnerabilities.push({ package: pkg, severity: data.severity, title: data.title, url: data.url, ecosystem: 'npm' });
                }
            }
        } catch (auditError) {
            if (auditError.stdout) {
                try {
                    const auditResult = JSON.parse(auditError.stdout);
                    if (auditResult.vulnerabilities) {
                        for (const [pkg, data] of Object.entries(auditResult.vulnerabilities)) {
                            vulnerabilities.push({ package: pkg, severity: data.severity, title: data.title, url: data.url, ecosystem: 'npm' });
                        }
                    }
                } catch (e) {}
            }
        }
        log(`${packageManager}: найдено ${dependencies.length} зависимостей, уязвимостей: ${vulnerabilities.length}`);
    } catch (error) {
        log(`Ошибка анализа Node.js: ${error.message}`, 'ERROR');
    }
    return { dependencies, vulnerabilities, packageManager };
}

export async function analyzePythonDependencies(projectPath) {
    const dependencies = [];
    const reqFiles = findFilesRecursive(projectPath, 'requirements.txt');
    for (const reqPath of reqFiles) {
        try {
            const content = fs.readFileSync(reqPath, 'utf-8');
            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-r') && !trimmed.startsWith('-e')) {
                    const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:[=<>]=?)?\s*([0-9a-zA-Z.\-]+)?/);
                    if (match) {
                        dependencies.push({ name: match[1], version: match[2] || 'latest', manager: 'pip', file: path.relative(projectPath, reqPath), ecosystem: 'PyPI' });
                    }
                }
            }
            log(`Python (pip): найдено ${dependencies.length} зависимостей из ${path.basename(reqPath)}`);
        } catch (error) {
            log(`Ошибка анализа ${reqPath}: ${error.message}`, 'ERROR');
        }
    }
    return dependencies;
}

export async function analyzePhpDependencies(projectPath) {
    const dependencies = new Map();
    const composerJsonPath = path.join(projectPath, 'composer.json');
    if (fs.existsSync(composerJsonPath)) {
        try {
            const composerJson = JSON.parse(fs.readFileSync(composerJsonPath, 'utf-8'));
            const allDeps = { ...composerJson.require, ...composerJson['require-dev'] };
            for (const [name, version] of Object.entries(allDeps || {})) {
                if (name === 'php' || name.startsWith('ext-')) continue;
                let cleanVersion = version.replace(/^[\^~>=<]/g, '').split('|')[0].trim().split(',').shift().trim();
                dependencies.set(name, { 
                    name, 
                    version: cleanVersion || 'latest', 
                    manager: 'composer', 
                    file: 'composer.json', 
                    type: composerJson.require?.[name] ? 'runtime' : 'development', 
                    ecosystem: 'Packagist'
                });
            }
        } catch (error) { 
            log(`Ошибка анализа composer.json: ${error.message}`, 'ERROR'); 
        }
    }
    return Array.from(dependencies.values());
}

export async function analyzeMavenDependencies(projectPath) {
    const dependencies = [];
    const pomFiles = findFilesRecursive(projectPath, 'pom.xml');
    for (const pomPath of pomFiles) {
        try {
            const content = fs.readFileSync(pomPath, 'utf-8');
            const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
            let match;
            while ((match = depRegex.exec(content)) !== null) {
                const depBlock = match[1];
                const groupId = depBlock.match(/<groupId>(.*?)<\/groupId>/);
                const artifactId = depBlock.match(/<artifactId>(.*?)<\/artifactId>/);
                const version = depBlock.match(/<version>(.*?)<\/version>/);
                if (groupId && artifactId) {
                    dependencies.push({ name: `${groupId[1]}:${artifactId[1]}`, version: version ? version[1] : 'unknown', manager: 'maven', file: path.relative(projectPath, pomPath), ecosystem: 'Maven' });
                }
            }
            log(`Maven: найдено ${dependencies.length} зависимостей`);
        } catch (error) { 
            log(`Ошибка анализа ${pomPath}: ${error.message}`, 'ERROR'); 
        }
    }
    return dependencies;
}

export async function analyzeGradleDependencies(projectPath) {
    const dependencies = [];
    const gradleFiles = findFilesRecursive(projectPath, 'build.gradle');
    const depPatterns = [/implementation\s+['"]([^'"]+)['"]/g, /api\s+['"]([^'"]+)['"]/g, /compile\s+['"]([^'"]+)['"]/g];
    for (const gradlePath of gradleFiles) {
        try {
            const content = fs.readFileSync(gradlePath, 'utf-8');
            for (const pattern of depPatterns) {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    const parts = match[1].split(':');
                    if (parts.length >= 2) {
                        dependencies.push({ name: `${parts[0]}:${parts[1]}`, version: parts[2] || 'unknown', manager: 'gradle', file: path.relative(projectPath, gradlePath), ecosystem: 'Maven' });
                    }
                }
            }
        } catch (error) { 
            log(`Ошибка анализа ${gradlePath}: ${error.message}`, 'ERROR'); 
        }
    }
    return dependencies;
}

export async function analyzeRustDependencies(projectPath) {
    const dependencies = [];
    const cargoFiles = findFilesRecursive(projectPath, 'Cargo.toml');
    for (const cargoPath of cargoFiles) {
        try {
            const content = fs.readFileSync(cargoPath, 'utf-8');
            const depSection = content.match(/\[dependencies\]([\s\S]*?)(\[|$)/);
            if (depSection) {
                const lines = depSection[1].split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('[')) {
                        const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*["']([^"']+)["']/);
                        if (match) dependencies.push({ name: match[1], version: match[2], manager: 'cargo', file: path.relative(projectPath, cargoPath), ecosystem: 'crates.io' });
                    }
                }
            }
        } catch (error) { 
            log(`Ошибка анализа ${cargoPath}: ${error.message}`, 'ERROR'); 
        }
    }
    return dependencies;
}

export async function analyzeRubyDependencies(projectPath) {
    const dependencies = [];
    const gemfilePath = path.join(projectPath, 'Gemfile');
    if (fs.existsSync(gemfilePath)) {
        try {
            const content = fs.readFileSync(gemfilePath, 'utf-8');
            const gemRegex = /gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/g;
            let match;
            while ((match = gemRegex.exec(content)) !== null) {
                dependencies.push({ name: match[1], version: match[2] || 'latest', manager: 'bundler', file: 'Gemfile', ecosystem: 'RubyGems' });
            }
        } catch (error) { 
            log(`Ошибка анализа Gemfile: ${error.message}`, 'ERROR'); 
        }
    }
    return dependencies;
}

// ==================== ОСНОВНАЯ ФУНКЦИЯ SCA ====================

export async function analyzeSCA(projectPath) {
    const results = {
        dependencies: [],
        vulnerabilities: [],
        licenseIssues: [],
        reachability: {
            total: 0,
            reachable: 0,
            notReachable: 0,
            unknown: 0,
            details: []
        },
        statistics: {
            byEcosystem: {},
            totalDependencies: 0,
            totalVulnerabilities: 0,
            totalCriticalVulnerabilities: 0,
            totalHighVulnerabilities: 0,
            totalMediumVulnerabilities: 0,
            totalLowVulnerabilities: 0,
            licenseSummary: { total: 0, permissive: 0, copyleft: 0, restricted: 0, unknown: 0, highRisk: 0 }
        }
    };
    
    log(`Начало анализа зависимостей в: ${projectPath}`);
    
    try {
        const { types } = detectProjectTypes(projectPath);
        log(`Обнаружены типы проектов: ${types.join(', ')}`);
        
        const allDeps = [];
        const allVulns = [];
        
        // Node.js
        const packageJsonFiles = findFilesRecursive(projectPath, 'package.json');
        for (const packageJsonPath of packageJsonFiles) {
            const dirPath = path.dirname(packageJsonPath);
            const nodeResult = await analyzeNodeDependencies(dirPath, packageJsonPath);
            allDeps.push(...nodeResult.dependencies);
            allVulns.push(...nodeResult.vulnerabilities);
            results.statistics.byEcosystem.npm = { count: nodeResult.dependencies.length, vulnerabilities: nodeResult.vulnerabilities.length, packageManager: nodeResult.packageManager };
        }
        
        // Go
        const goModFiles = findFilesRecursive(projectPath, 'go.mod');
        for (const goModPath of goModFiles) {
            const goDeps = await analyzeGoDependencies(goModPath, projectPath);
            allDeps.push(...goDeps);
            results.statistics.byEcosystem.go = { count: goDeps.length, files: goModFiles.length };
        }
        
        // Python
        const pythonDeps = await analyzePythonDependencies(projectPath);
        allDeps.push(...pythonDeps);
        results.statistics.byEcosystem.python = { count: pythonDeps.length };
        
        // PHP
        const phpDeps = await analyzePhpDependencies(projectPath);
        allDeps.push(...phpDeps);
        results.statistics.byEcosystem.php = { count: phpDeps.length };
        
        // Maven
        const mavenDeps = await analyzeMavenDependencies(projectPath);
        allDeps.push(...mavenDeps);
        results.statistics.byEcosystem.maven = { count: mavenDeps.length };
        
        // Gradle
        const gradleDeps = await analyzeGradleDependencies(projectPath);
        allDeps.push(...gradleDeps);
        results.statistics.byEcosystem.gradle = { count: gradleDeps.length };
        
        // Rust
        const rustDeps = await analyzeRustDependencies(projectPath);
        allDeps.push(...rustDeps);
        results.statistics.byEcosystem.rust = { count: rustDeps.length };
        
        // Ruby
        const rubyDeps = await analyzeRubyDependencies(projectPath);
        allDeps.push(...rubyDeps);
        results.statistics.byEcosystem.ruby = { count: rubyDeps.length };
        
        // Обогащаем зависимости информацией о лицензиях и CVE
        const uniqueDeps = [];
        const seen = new Set();
        
        for (const dep of allDeps) {
            const key = `${dep.ecosystem || dep.manager}:${dep.name}@${dep.version}`;
            if (!seen.has(key)) {
                seen.add(key);
                
                // Получаем лицензию
                const license = await getPackageLicense(dep.name, dep.version, dep.ecosystem);
                dep.license = license;
                dep.licenseInfo = LICENSE_DB[license] || LICENSE_DB['UNKNOWN'];
                
                // Получаем CVE
                if (!dep.name.startsWith('webbankir/')) {
                    const vulnInfo = await getPackageVulnerabilities(dep.name, dep.version, dep.ecosystem);
                    dep.vulnerabilities = vulnInfo;
                    dep.cveCount = vulnInfo.count;
                    dep.cveSummary = { critical: vulnInfo.critical, high: vulnInfo.high, medium: vulnInfo.medium, low: vulnInfo.low };
                    
                    for (const vuln of vulnInfo.vulnerabilities) {
                        allVulns.push({ package: dep.name, version: dep.version, ecosystem: dep.ecosystem, ...vuln });
                        if (vuln.severity === 'critical') results.statistics.totalCriticalVulnerabilities++;
                        else if (vuln.severity === 'high') results.statistics.totalHighVulnerabilities++;
                        else if (vuln.severity === 'medium') results.statistics.totalMediumVulnerabilities++;
                        else if (vuln.severity === 'low') results.statistics.totalLowVulnerabilities++;
                    }
                } else {
                    dep.cveCount = 0;
                    dep.cveSummary = { critical: 0, high: 0, medium: 0, low: 0 };
                }
                
                // Проверяем лицензию на риски
                if (dep.licenseInfo?.risk === 'high') {
                    results.licenseIssues.push({
                        package: dep.name,
                        version: dep.version,
                        license: dep.license,
                        risk: dep.licenseInfo.risk,
                        type: dep.licenseInfo.type,
                        recommendation: getLicenseRecommendation(dep.license)
                    });
                }
                
                uniqueDeps.push(dep);
                
                // Статистика по лицензиям
                const licenseType = dep.licenseInfo?.type || 'unknown';
                results.statistics.licenseSummary.total++;
                if (licenseType === 'permissive') results.statistics.licenseSummary.permissive++;
                else if (licenseType === 'copyleft' || licenseType === 'weak-copyleft') results.statistics.licenseSummary.copyleft++;
                else if (licenseType === 'restricted') results.statistics.licenseSummary.restricted++;
                else results.statistics.licenseSummary.unknown++;
                if (dep.licenseInfo?.risk === 'high') results.statistics.licenseSummary.highRisk++;
            }
        }
        
        results.dependencies = uniqueDeps.sort((a, b) => (b.cveCount || 0) - (a.cveCount || 0));
        results.vulnerabilities = allVulns;
        results.statistics.totalDependencies = uniqueDeps.length;
        results.statistics.totalVulnerabilities = allVulns.length;
        
        // ==================== АНАЛИЗ ДОСТИЖИМОСТИ ====================
        log('Запуск анализа достижимости...', 'INFO');
        
        // Собираем компоненты с уязвимостями для анализа
        const componentsToAnalyze = [];
        for (const dep of uniqueDeps) {
            if (dep.cveCount > 0 && dep.vulnerabilities?.count > 0) {
                componentsToAnalyze.push({
                    name: dep.name,
                    version: dep.version,
                    ecosystem: dep.ecosystem || dep.manager,
                    vulnerableFunctions: [],
                    purl: `pkg:${dep.ecosystem || dep.manager}/${dep.name}@${dep.version}`
                });
            }
        }
        
        if (componentsToAnalyze.length > 0) {
            log(`Анализ достижимости для ${componentsToAnalyze.length} компонентов...`, 'INFO');
            
            try {
                const reachResults = await runReachabilityAnalysis(projectPath, componentsToAnalyze, {
                    verbose: false
                });
                
                // Создаем мап для быстрого доступа
                const reachabilityMap = new Map();
                for (const result of reachResults) {
                    reachabilityMap.set(result.library, result);
                }
                
                // Обогащаем зависимости результатами достижимости
                let reachableCount = 0;
                let notReachableCount = 0;
                let unknownCount = 0;
                
                for (const dep of uniqueDeps) {
                    const reachResult = reachabilityMap.get(dep.name);
                    
                    if (reachResult) {
                        // Зависимость была в анализе (есть CVE)
                        dep.isReachable = reachResult.isPresent === true;
                        dep.usageFiles = reachResult.files || [];
                        dep.usageLocations = reachResult.locations || [];
                        
                        if (dep.isReachable) {
                            reachableCount++;
                        } else {
                            notReachableCount++;
                        }
                    } else {
                        // Зависимость НЕ была в анализе
                        if (dep.cveCount > 0) {
                            // Есть CVE, но анализа не было (ошибка)
                            dep.isReachable = null;
                            unknownCount++;
                        } else {
                            // НЕТ CVE - безопасно
                            dep.isReachable = false;  // Нет уязвимостей = не опасна
                            // не увеличиваем unknownCount
                        }
                    }
                }
                
                results.reachability = {
                    total: componentsToAnalyze.length,
                    reachable: reachableCount,
                    notReachable: notReachableCount,
                    unknown: unknownCount,
                    details: Array.from(reachabilityMap.values()).map(r => ({
                        library: r.library,
                        version: r.version,
                        isPresent: r.isPresent,
                        files: r.files,
                        locations: r.locations
                    }))
                };
                
                log(`Анализ достижимости завершен: достижимых ${reachableCount}, не достижимых ${notReachableCount}, неизвестно ${unknownCount}`, 'INFO');
                
            } catch (error) {
                log(`Ошибка анализа достижимости: ${error.message}`, 'ERROR');
            }
        } else {
            log('Нет компонентов с уязвимостями для анализа достижимости', 'INFO');
        }
        
        log(`========== ИТОГО ==========`);
        log(`Всего зависимостей: ${uniqueDeps.length}`);
        log(`Всего уязвимостей: ${allVulns.length}`);
        log(`Критических уязвимостей: ${results.statistics.totalCriticalVulnerabilities}`);
        log(`Высоких уязвимостей: ${results.statistics.totalHighVulnerabilities}`);
        log(`Достижимых уязвимостей: ${results.reachability.reachable}`);
        log(`Лицензий: Permissive=${results.statistics.licenseSummary.permissive}, Copyleft=${results.statistics.licenseSummary.copyleft}, Restricted=${results.statistics.licenseSummary.restricted}`);
        
    } catch (error) {
        log(`Ошибка анализа: ${error.message}`, 'ERROR');
        results.error = error.message;
    }
    
    return results;
}

function getLicenseRecommendation(license) {
    const recommendations = {
        'GPL-2.0': 'GPL требует открытия исходного кода при распространении',
        'GPL-3.0': 'GPL требует открытия исходного кода при распространении',
        'AGPL-3.0': 'AGPL требует открытия исходного кода даже при использовании через сеть',
        'MPL-2.0': 'MPL требует открытия только изменённых файлов',
        'CC-BY-NC-4.0': 'Запрещено коммерческое использование',
        'UNKNOWN': 'Не определено',
        'PROPRIETARY': 'Проприетарная лицензия, требуется проверка юристом'
    };
    return recommendations[license] || 'Лицензия совместима с коммерческим использованием';
}

export default { analyzeSCA, detectProjectTypes, findAllManifestFiles };