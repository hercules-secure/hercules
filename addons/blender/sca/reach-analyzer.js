import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ==================== ЛОГГЕР ====================
const LOG_DIR = path.join(process.cwd(), 'logs', 'sca');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

async function log(message, level = 'INFO') {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message}\n`;
        await fs.appendFile(LOG_FILE, logLine);
    } catch (err) {
        // Игнорируем ошибки логгера
    }
}

// ==================== БАЗОВЫЙ КЛАСС ====================
class BaseReachabilityAnalyzer {
    constructor(repoPath, component, options = {}) {
        this.repoPath = repoPath;
        this.component = component;
        this.vulnerableFunctions = component.vulnerableFunctions || [];
        this.vulnerableClasses = component.vulnerableClasses || [];
        this.vulnerablePackages = component.vulnerablePackages || [];
        this.verbose = options.verbose || false;
        this.results = [];
    }

    async analyze() {
        throw new Error('Must be implemented');
    }

    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getCodeContext(content, lineNumber, contextLines = 3) {
        const lines = content.split('\n');
        const start = Math.max(0, lineNumber - contextLines - 1);
        const end = Math.min(lines.length, lineNumber + contextLines);
        
        const context = [];
        for (let i = start; i < end; i++) {
            context.push({
                number: i + 1,
                code: lines[i] || '',
                isVulnerable: (i + 1) === lineNumber
            });
        }
        return context;
    }

    async findRealSourceDir(startPath) {
        try {
            const entries = await fs.readdir(startPath, { withFileTypes: true });
            
            const hasPackageJson = entries.some(e => e.isFile() && e.name === 'package.json');
            if (hasPackageJson) return startPath;
            
            const hasGoMod = entries.some(e => e.isFile() && e.name === 'go.mod');
            if (hasGoMod) return startPath;
            
            const hasPomXml = entries.some(e => e.isFile() && e.name === 'pom.xml');
            if (hasPomXml) return startPath;
            
            const subDirs = entries.filter(e => 
                e.isDirectory() && 
                !['node_modules', '.git', 'dist', 'build', '__pycache__', 'venv', '.venv', 'env', 'coverage', 'vendor', 'target'].includes(e.name)
            );
            
            for (const subDir of subDirs) {
                const subPath = path.join(startPath, subDir.name);
                const found = await this.findRealSourceDir(subPath);
                if (found) return found;
            }
            
            return null;
        } catch (err) {
            return null;
        }
    }

    async findFilesRecursive(dir, extensions, searchPath) {
        const files = [];
        
        const walk = async (currentDir) => {
            if (!currentDir.startsWith(searchPath)) return;
            
            try {
                const entries = await fs.readdir(currentDir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(currentDir, entry.name);
                    if (entry.isDirectory()) {
                        const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', 'venv', '.venv', 'env', 'vendor', 'target', 'out'];
                        if (!excludeDirs.includes(entry.name)) {
                            await walk(fullPath);
                        }
                    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
                        files.push(fullPath);
                    }
                }
            } catch (err) {}
        };
        
        await walk(searchPath);
        return files;
    }

    /**
     * Проверка, используется ли конкретная уязвимая функция
     */
    checkVulnerableFunctionUsage(content, filePath) {
        const usages = [];
        const lines = content.split('\n');
        
        for (const vulnFunc of this.vulnerableFunctions) {
            // Паттерны вызова функции
            const patterns = [
                `${vulnFunc}\\s*\\(`,
                `\\.${vulnFunc}\\s*\\(`,
                `${vulnFunc}\\s*:`,
                `=${vulnFunc}\\s*\\(`,
                `\\[${vulnFunc}\\]`,
                `<${vulnFunc}>`
            ];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                for (const pattern of patterns) {
                    const regex = new RegExp(pattern, 'i');
                    if (regex.test(line)) {
                        usages.push({
                            file: filePath,
                            line: i + 1,
                            code: line.trim(),
                            function: vulnFunc,
                            type: 'direct_call'
                        });
                        break;
                    }
                }
            }
        }
        
        return usages;
    }

    /**
     * Проверка, используется ли уязвимый класс
     */
    checkVulnerableClassUsage(content, filePath) {
        const usages = [];
        const lines = content.split('\n');
        
        for (const vulnClass of this.vulnerableClasses) {
            const patterns = [
                `new\\s+${vulnClass}\\s*\\(`,
                `class\\s+${vulnClass}`,
                `extends\\s+${vulnClass}`,
                `implements\\s+${vulnClass}`,
                `:${vulnClass}`,
                `<${vulnClass}>`,
                `\\[${vulnClass}\\]`
            ];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                for (const pattern of patterns) {
                    const regex = new RegExp(pattern, 'i');
                    if (regex.test(line)) {
                        usages.push({
                            file: filePath,
                            line: i + 1,
                            code: line.trim(),
                            class: vulnClass,
                            type: 'class_usage'
                        });
                        break;
                    }
                }
            }
        }
        
        return usages;
    }
}

// ==================== JAVA/MAVEN (УЛУЧШЕННЫЙ) ====================
class JavaReachabilityAnalyzer extends BaseReachabilityAnalyzer {
    async analyze() {
        await log(`[maven] Анализ достижимости для ${this.component.name}`);
        
        let searchPath = this.repoPath;
        const realSourceDir = await this.findRealSourceDir(this.repoPath);
        if (realSourceDir) searchPath = realSourceDir;
        
        const javaFiles = await this.findFilesRecursive(searchPath, ['.java'], searchPath);
        
        if (javaFiles.length === 0) {
            return this.createResult(false, []);
        }
        
        const packageName = this.component.name;
        const packageParts = packageName.split(':');
        const groupId = packageParts[0];
        const artifactId = packageParts[1] || packageName;
        
        // Генерируем возможные импорты для поиска
        const possibleImports = this.generatePossibleImports(groupId, artifactId);
        
        const usages = [];
        let hasImport = false;
        
        for (const file of javaFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const relativePath = path.relative(searchPath, file);
                
                // Проверяем импорты
                const imports = this.findImports(content, possibleImports);
                if (imports.length > 0) {
                    hasImport = true;
                    for (const imp of imports) {
                        usages.push({
                            file: relativePath,
                            line: imp.line,
                            code: imp.code,
                            type: 'import',
                            importedClass: imp.className
                        });
                    }
                }
                
                // Проверяем использование уязвимых функций/классов
                const funcUsages = this.checkVulnerableFunctionUsage(content, relativePath);
                const classUsages = this.checkVulnerableClassUsage(content, relativePath);
                
                usages.push(...funcUsages, ...classUsages);
                
            } catch (err) {}
        }
        
        // Дополнительно проверяем pom.xml
        const pomXmlPath = path.join(searchPath, 'pom.xml');
        let isInPom = false;
        try {
            const pomContent = await fs.readFile(pomXmlPath, 'utf-8');
            const depRegex = new RegExp(`<groupId>${this.escapeRegex(groupId)}</groupId>\\s*<artifactId>${this.escapeRegex(artifactId)}</artifactId>`, 'i');
            isInPom = depRegex.test(pomContent);
        } catch (err) {}
        
        const uniqueLocations = [...new Map(usages.map(u => [u.file + ':' + u.line, u])).values()];
        
        return this.createResult(hasImport || usages.length > 0, uniqueLocations, isInPom);
    }
    
    generatePossibleImports(groupId, artifactId) {
        const imports = [];
        
        // Маппинг groupId/artifactId к базовым пакетам
        const knownMappings = {
            'org.apache.logging.log4j': ['org.apache.logging.log4j'],
            'org.postgresql': ['org.postgresql'],
            'org.yaml': ['org.yaml.snakeyaml', 'org.yaml'],
            'org.bouncycastle': ['org.bouncycastle'],
            'com.fasterxml.jackson.core': ['com.fasterxml.jackson.core', 'com.fasterxml.jackson.databind'],
            'commons-collections': ['org.apache.commons.collections', 'org.apache.commons.collections4'],
            'com.google.guava': ['com.google.common'],
            'org.apache.commons': ['org.apache.commons'],
            'com.h2database': ['org.h2']
        };
        
        for (const [key, values] of Object.entries(knownMappings)) {
            if (groupId.includes(key) || artifactId.includes(key)) {
                imports.push(...values);
            }
        }
        
        // Добавляем из artifactId
        imports.push(artifactId.replace(/-/g, '.'));
        
        return [...new Set(imports)];
    }
    
    findImports(content, possibleImports) {
        const imports = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('import ')) {
                for (const imp of possibleImports) {
                    if (line.includes(imp)) {
                        imports.push({
                            line: i + 1,
                            code: line.trim(),
                            className: imp
                        });
                        break;
                    }
                }
            }
        }
        
        return imports;
    }
    
    createResult(isPresent, locations, isInPom = false) {
        return {
            ecosystem: 'maven',
            library: this.component.name,
            version: this.component.version,
            isPresent: isPresent,
            hasDirectDependency: isInPom,
            vulnerableFunctionsUsed: locations.filter(l => l.function).map(l => l.function),
            vulnerableClassesUsed: locations.filter(l => l.class).map(l => l.class),
            files: [...new Set(locations.map(l => l.file))],
            locations: locations,
            confidence: this.calculateConfidence(isPresent, isInPom, locations)
        };
    }
    
    calculateConfidence(isPresent, isInPom, locations) {
        if (isPresent) return 'HIGH';
        if (isInPom && locations.length > 0) return 'MEDIUM';
        if (isInPom) return 'LOW';
        return 'NONE';
    }
}

// ==================== GO (УЛУЧШЕННЫЙ) ====================
class GoReachabilityAnalyzer extends BaseReachabilityAnalyzer {
    async analyze() {
        await log(`[go] Анализ достижимости для ${this.component.name}`);
        
        let searchPath = this.repoPath;
        const realSourceDir = await this.findRealSourceDir(this.repoPath);
        if (realSourceDir) searchPath = realSourceDir;
        
        const goFiles = await this.findFilesRecursive(searchPath, ['.go'], searchPath);
        
        if (goFiles.length === 0) {
            return this.createResult(false, []);
        }
        
        const importPath = this.component.name;
        const lastPart = importPath.split('/').pop();
        
        const usages = [];
        let hasImport = false;
        
        for (const file of goFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const relativePath = path.relative(searchPath, file);
                const lines = content.split('\n');
                
                // Проверяем импорты
                const imports = this.findGoImports(content, lines, importPath, lastPart);
                if (imports.length > 0) {
                    hasImport = true;
                    for (const imp of imports) {
                        usages.push({
                            file: relativePath,
                            line: imp.line,
                            code: imp.code,
                            type: 'import',
                            importedPackage: imp.package
                        });
                    }
                }
                
                // Проверяем использование уязвимых функций
                const funcUsages = this.checkVulnerableFunctionUsage(content, relativePath);
                usages.push(...funcUsages);
                
                // Проверяем использование уязвимых пакетов
                const packageUsages = this.checkVulnerablePackageUsage(content, relativePath, lastPart);
                usages.push(...packageUsages);
                
            } catch (err) {}
        }
        
        // Проверяем go.mod
        const goModPath = path.join(searchPath, 'go.mod');
        let isInGoMod = false;
        try {
            const goModContent = await fs.readFile(goModPath, 'utf-8');
            const requireRegex = new RegExp(`${this.escapeRegex(importPath)}\\s+v\\d+\\.\\d+\\.\\d+`);
            isInGoMod = requireRegex.test(goModContent);
        } catch (err) {}
        
        const uniqueLocations = [...new Map(usages.map(u => [u.file + ':' + u.line, u])).values()];
        
        return this.createResult(hasImport || usages.length > 0, uniqueLocations, isInGoMod);
    }
    
    findGoImports(content, lines, importPath, lastPart) {
        const imports = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
            
            // import "path"
            if (trimmed === `import "${importPath}"`) {
                imports.push({ line: i + 1, code: trimmed, package: importPath });
                continue;
            }
            
            // import alias "path"
            const aliasMatch = trimmed.match(/^import\s+(\w+)\s+"([^"]+)"/);
            if (aliasMatch && aliasMatch[2] === importPath) {
                imports.push({ line: i + 1, code: trimmed, package: importPath, alias: aliasMatch[1] });
                continue;
            }
            
            // import ( блок )
            if (trimmed === 'import (' || line.includes('import (')) {
                let j = i + 1;
                while (j < lines.length && !lines[j].trim().startsWith(')')) {
                    const importLine = lines[j].trim();
                    if (importLine && !importLine.startsWith('//')) {
                        const blockMatch = importLine.match(/^(?:(\w+)\s+)?"([^"]+)"/);
                        if (blockMatch && blockMatch[2] === importPath) {
                            imports.push({ 
                                line: j + 1, 
                                code: importLine, 
                                package: importPath,
                                alias: blockMatch[1]
                            });
                            break;
                        }
                        if (importLine.includes(lastPart) && importLine.includes(importPath.split('/')[0])) {
                            const fullMatch = importLine.match(/"([^"]+)"/);
                            if (fullMatch && fullMatch[1] === importPath) {
                                imports.push({ line: j + 1, code: importLine, package: importPath });
                                break;
                            }
                        }
                    }
                    j++;
                }
            }
        }
        
        return imports;
    }
    
    checkVulnerablePackageUsage(content, filePath, lastPart) {
        const usages = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            for (const vulnPkg of this.vulnerablePackages) {
                const patterns = [
                    new RegExp(`${this.escapeRegex(vulnPkg)}\\.\\w+\\s*\\(`, 'i'),
                    new RegExp(`${this.escapeRegex(lastPart)}\\.${this.escapeRegex(vulnPkg)}\\s*\\(`, 'i')
                ];
                
                for (const pattern of patterns) {
                    if (pattern.test(line)) {
                        usages.push({
                            file: filePath,
                            line: i + 1,
                            code: line.trim(),
                            package: vulnPkg,
                            type: 'package_usage'
                        });
                        break;
                    }
                }
            }
        }
        
        return usages;
    }
    
    createResult(isPresent, locations, isInGoMod = false) {
        return {
            ecosystem: 'go',
            library: this.component.name,
            version: this.component.version,
            isPresent: isPresent,
            hasDirectDependency: isInGoMod,
            vulnerableFunctionsUsed: locations.filter(l => l.function).map(l => l.function),
            vulnerablePackagesUsed: locations.filter(l => l.package).map(l => l.package),
            files: [...new Set(locations.map(l => l.file))],
            locations: locations,
            confidence: this.calculateConfidence(isPresent, isInGoMod, locations)
        };
    }
    
    calculateConfidence(isPresent, isInGoMod, locations) {
        if (isPresent) return 'HIGH';
        if (isInGoMod && locations.some(l => l.type === 'package_usage')) return 'MEDIUM';
        if (isInGoMod) return 'LOW';
        return 'NONE';
    }
}

// ==================== NPM (УЛУЧШЕННЫЙ) ====================
class NpmReachabilityAnalyzer extends BaseReachabilityAnalyzer {
    async analyze() {
        await log(`[npm] Анализ достижимости для ${this.component.name}`);
        
        let searchPath = this.repoPath;
        const realSourceDir = await this.findRealSourceDir(this.repoPath);
        if (realSourceDir) searchPath = realSourceDir;
        
        const jsFiles = await this.findFilesRecursive(searchPath, ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'], searchPath);
        
        if (jsFiles.length === 0) {
            return this.createResult(false, []);
        }
        
        const packageName = this.component.name;
        const usages = [];
        let hasImport = false;
        
        for (const file of jsFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const relativePath = path.relative(searchPath, file);
                
                // Проверяем импорты
                const imports = this.findNpmImports(content, packageName);
                if (imports.length > 0) {
                    hasImport = true;
                    for (const imp of imports) {
                        usages.push({
                            file: relativePath,
                            line: imp.line,
                            code: imp.code,
                            type: 'import',
                            importedName: imp.name
                        });
                    }
                }
                
                // Проверяем использование уязвимых функций
                const funcUsages = this.checkVulnerableFunctionUsage(content, relativePath);
                usages.push(...funcUsages);
                
            } catch (err) {}
        }
        
        // Проверяем package.json
        const packageJsonPath = path.join(searchPath, 'package.json');
        let isInPackageJson = false;
        try {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            isInPackageJson = !!(packageJson.dependencies?.[packageName] || 
                                  packageJson.devDependencies?.[packageName] ||
                                  packageJson.peerDependencies?.[packageName]);
        } catch (err) {}
        
        const uniqueLocations = [...new Map(usages.map(u => [u.file + ':' + u.line, u])).values()];
        
        return this.createResult(hasImport || usages.length > 0, uniqueLocations, isInPackageJson);
    }
    
    findNpmImports(content, packageName) {
        const imports = [];
        const lines = content.split('\n');
        
        // Экранируем спецсимволы в имени пакета
        const escapedName = this.escapeRegex(packageName);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            const patterns = [
                new RegExp(`from\\s+['"\`]${escapedName}['"\`]`),
                new RegExp(`require\\s*\\(\\s*['"\`]${escapedName}['"\`]\\s*\\)`),
                new RegExp(`import\\s*\\(\\s*['"\`]${escapedName}['"\`]\\s*\\)`),
                new RegExp(`import\\s+['"\`]${escapedName}['"\`]`),
                new RegExp(`import\\s+\\{[^}]*\\}\\s+from\\s+['"\`]${escapedName}['"\`]`),
                new RegExp(`import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"\`]${escapedName}['"\`]`)
            ];
            
            for (const pattern of patterns) {
                if (pattern.test(line)) {
                    imports.push({ line: i + 1, code: line.trim(), name: packageName });
                    break;
                }
            }
        }
        
        return imports;
    }
    
    createResult(isPresent, locations, isInPackageJson = false) {
        return {
            ecosystem: 'npm',
            library: this.component.name,
            version: this.component.version,
            isPresent: isPresent,
            hasDirectDependency: isInPackageJson,
            vulnerableFunctionsUsed: locations.filter(l => l.function).map(l => l.function),
            files: [...new Set(locations.map(l => l.file))],
            locations: locations,
            confidence: this.calculateConfidence(isPresent, isInPackageJson, locations)
        };
    }
    
    calculateConfidence(isPresent, isInPackageJson, locations) {
        if (isPresent) return 'HIGH';
        if (isInPackageJson && locations.length > 0) return 'MEDIUM';
        if (isInPackageJson) return 'LOW';
        return 'NONE';
    }
}

// ==================== ФАБРИКА АНАЛИЗАТОРОВ ====================
class ReachabilityFactory {
    static create(repoPath, component, options = {}) {
        const ecosystem = component.ecosystem || this.detectEcosystem(component);
        
        switch (ecosystem) {
            case 'npm':
            case 'yarn':
            case 'pnpm':
            case 'javascript':
            case 'typescript':
                return new NpmReachabilityAnalyzer(repoPath, component, options);
            case 'go':
            case 'golang':
                return new GoReachabilityAnalyzer(repoPath, component, options);
            case 'maven':
            case 'java':
                return new JavaReachabilityAnalyzer(repoPath, component, options);
            // Можно добавить другие экосистемы по аналогии
            default:
                return null;
        }
    }
    
    static detectEcosystem(component) {
        if (component.ecosystem) {
            const eco = component.ecosystem.toLowerCase();
            if (['npm', 'yarn', 'pnpm', 'javascript', 'typescript'].includes(eco)) return 'npm';
            if (['go', 'golang'].includes(eco)) return 'go';
            if (['maven', 'java'].includes(eco)) return 'maven';
            return eco;
        }
        
        const purl = component.purl || '';
        if (purl.includes('pkg:npm')) return 'npm';
        if (purl.includes('pkg:golang')) return 'go';
        if (purl.includes('pkg:maven')) return 'maven';
        
        return 'unknown';
    }
}

// ==================== ОСНОВНАЯ ФУНКЦИЯ ====================
export async function runReachabilityAnalysis(repoPath, componentsToAnalyze, options = {}) {
    const results = [];
    
    for (const component of componentsToAnalyze) {
        const analyzer = ReachabilityFactory.create(repoPath, component, options);
        
        if (analyzer) {
            try {
                const result = await analyzer.analyze();
                results.push(result);
            } catch (err) {
                await log(`Ошибка анализа ${component.name}: ${err.message}`, 'ERROR');
                results.push({
                    ecosystem: 'unknown',
                    library: component.name,
                    version: component.version,
                    isPresent: false,
                    hasDirectDependency: false,
                    vulnerableFunctionsUsed: [],
                    files: [],
                    locations: [],
                    confidence: 'NONE',
                    error: err.message
                });
            }
        } else {
            results.push({
                ecosystem: 'unknown',
                library: component.name,
                version: component.version,
                isPresent: false,
                hasDirectDependency: false,
                vulnerableFunctionsUsed: [],
                files: [],
                locations: [],
                confidence: 'NONE',
                error: 'No analyzer available'
            });
        }
    }
    
    return results;
}

export { ReachabilityFactory };