import https from 'https';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { LicenseAnalyzer } from './license-analyzer.js';

// Загружаем переменные окружения из .env файла
dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== БАЗОВЫЙ КЛАСС ====================

class BaseSBOMAnalyzer {
    constructor(repoUrl, options = {}) {
        this.repoUrl = repoUrl;
        this.outputFile = options.outputFile || './sbom.json';
        this.reportFile = options.reportFile || './sca-report.json';
        this.osvBase = 'https://api.osv.dev/v1';
        this.componentMap = new Map();
        this.vulnerabilities = [];
        this.dependencyGraph = new Map();
        this.tempDir = null;
        this.options = options;
        
        this.maxDepth = options.maxDepth || 5;
        this.excludeDirs = options.excludeDirs || [
            'node_modules', '.git', 'dist', 'build', 'target', 
            'vendor', '__pycache__', '.venv', 'test', 'tests',
            'examples', 'docs', 'website', 'assets', 'images',
            'coverage', '.github', '.gitlab', '.idea', '.vscode'
        ];
        
        this.scanMetadata = {
            startTime: new Date().toISOString(),
            packagesByManager: {},
            licenseIssues: [],
            outdatedComponents: []
        };
        
        this.cache = new Map();
        this.fileContentsCache = new Map();
    }

    // Абстрактные методы
    async getRepositoryContents(path = '') { throw new Error('Must be implemented'); }
    async getFileContent(fileInfo) { throw new Error('Must be implemented'); }
    async makeRequest(hostname, path, method, body, headers) { throw new Error('Must be implemented'); }

    generateBomRef(name, version) {
        const safeName = (name && typeof name === 'string') ? name : 'unknown';
        const safeVersion = (version && typeof version === 'string') ? version : 'latest';
        
        const cleanName = safeName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const cleanVersion = safeVersion.replace(/[^a-zA-Z0-9\.\-]/g, '-');
        return `pkg:${cleanName}@${cleanVersion}`;
    }

    addComponent(component) {
        if (!component || !component.name) {
            return null;
        }
        
        const safeName = String(component.name);
        const safeVersion = component.version ? String(component.version) : 'latest';
        
        const key = `${safeName}@${safeVersion}`;
        
        if (!this.componentMap.has(key)) {
            this.componentMap.set(key, {
                ...component,
                name: safeName,
                version: safeVersion,
                "bom-ref": component["bom-ref"] || this.generateBomRef(safeName, safeVersion)
            });
        }
        return this.componentMap.get(key);
    }

    addDependency(from, to) {
        if (!from || !to) return;
        
        if (!this.dependencyGraph.has(from)) {
            this.dependencyGraph.set(from, new Set());
        }
        this.dependencyGraph.get(from).add(to);
    }

    shouldExcludeDir(dirPath) {
        if (!dirPath) return false;
        const parts = dirPath.split(/[/\\]/);
        return parts.some(part => this.excludeDirs.includes(part));
    }

    clearCache() {
        this.cache.clear();
        this.fileContentsCache.clear();
    }
    
    getOrCreateRootComponent() {
        if (this._rootComponent) {
            return this._rootComponent;
        }
        
        const repoName = this.repoInfo && this.repoInfo.repo 
            ? this.repoInfo.repo 
            : (this.repoInfo && this.repoInfo.projectPath 
                ? this.repoInfo.projectPath.split('/').pop() 
                : 'unknown');
        
        const rootComponent = {
            type: 'application',
            name: repoName,
            version: '1.0.0',
            purl: `pkg:generic/${this._slugify(repoName)}@1.0.0`,
            properties: [
                { name: 'src:type', value: 'root' },
                { name: 'src:repository', value: this.repoUrl || 'unknown' },
                { name: 'src:scanStartTime', value: this.scanMetadata.startTime }
            ]
        };
        
        this._rootComponent = this.addComponent(rootComponent);
        return this._rootComponent;
    }

    getLicenseUrl(licenseId) {
        const urls = {
            'MIT': 'https://opensource.org/licenses/MIT',
            'Apache-2.0': 'https://www.apache.org/licenses/LICENSE-2.0',
            'GPL-2.0': 'https://www.gnu.org/licenses/gpl-2.0.html',
            'GPL-3.0': 'https://www.gnu.org/licenses/gpl-3.0.html',
            'AGPL-3.0': 'https://www.gnu.org/licenses/agpl-3.0.html',
            'BSD-2-Clause': 'https://opensource.org/licenses/BSD-2-Clause',
            'BSD-3-Clause': 'https://opensource.org/licenses/BSD-3-Clause',
            'ISC': 'https://opensource.org/licenses/ISC',
            'LGPL-2.1': 'https://www.gnu.org/licenses/lgpl-2.1.html',
            'LGPL-3.0': 'https://www.gnu.org/licenses/lgpl-3.0.html',
            'MPL-2.0': 'https://www.mozilla.org/en-US/MPL/2.0/',
            'Unlicense': 'https://unlicense.org/',
            'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/'
        };
        return urls[licenseId] || '';
    }

    async getCachedContents(path) {
        const cacheKey = `contents:${path}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const contents = await this.getRepositoryContents(path);
        this.cache.set(cacheKey, contents);
        return contents;
    }

    async cleanupTempDir() {
        if (this.tempDir) {
            try {
                await fs.rm(this.tempDir, { recursive: true, force: true });
                this.tempDir = null;
            } catch (error) {
                console.warn(`⚠️ Не удалось удалить временную директорию ${this.tempDir}:`, error.message);
            }
        }
    }
    
    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    _slugify(str) {
        if (!str) return 'unknown';
        return str.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    async _collectAllVersionVariables() {
        const versionVars = new Map();
        const allFiles = await this.getAllFilesRecursive('');
        const cmakeFiles = allFiles.filter(f => 
            f && f.name && (
                f.name === 'CMakeLists.txt' ||
                f.name.endsWith('.cmake') || 
                f.name.endsWith('.cmake.in')
            )
        );
        
        for (const file of cmakeFiles) {
            try {
                const content = await this.getFileContent(file);
                if (!content) continue;
                
                const setRegex = /set\s*\(\s*([A-Za-z0-9_]+_VERSION_REQ)\s+([0-9\.]+)/gi;
                let match;
                while ((match = setRegex.exec(content)) !== null) {
                    versionVars.set(match[1], match[2]);
                }
                
                const versionRegex = /set\s*\(\s*([A-Za-z0-9_]+_VERSION)\s+([0-9\.]+)/gi;
                while ((match = versionRegex.exec(content)) !== null) {
                    if (!versionVars.has(match[1])) {
                        versionVars.set(match[1], match[2]);
                    }
                }
            } catch (err) {}
        }
        
        return versionVars;
    }

    async getAllFilesRecursive(dirPath = '', depth = 0, collected = null) {
        if (!collected) {
            collected = [];
        }

        if (depth > this.maxDepth) {
            return collected;
        }

        if (this.shouldExcludeDir(dirPath)) {
            return collected;
        }
        
        try {
            const contents = await this.getCachedContents(dirPath);
            
            for (const item of contents) {
                if (item.type === 'blob' || item.type === 'file') {
                    collected.push(item);
                } else if (item.type === 'tree' || item.type === 'dir') {
                    await new Promise(resolve => setTimeout(resolve, 5));
                    await this.getAllFilesRecursive(item.path, depth + 1, collected);
                }
            }
        } catch (error) {
            // Игнорируем ошибки
        }
        
        return collected;
    }

    async findFiles(filename, startPath = '', maxDepth = 3) {
        const results = [];
        const originalMaxDepth = this.maxDepth;
        this.maxDepth = maxDepth;
        
        try {
            const allFiles = await this.getAllFilesRecursive(startPath);
            results.push(...allFiles.filter(f => f && f.name === filename));
        } finally {
            this.maxDepth = originalMaxDepth;
        }
        
        return results;
    }

    async detectPackageManagers() {
        const packageManagers = new Set();
        
        try {
            const rootContents = await this.getCachedContents('');
            for (const item of rootContents) {
                this._checkFileForManager(item, packageManagers);
            }
        } catch (error) {
            // Игнорируем
        }

        if (packageManagers.size === 0) {
            const commonPaths = ['app', 'src', 'lib', 'server', 'client', 'backend', 'frontend', 'packages'];
            
            for (const commonPath of commonPaths) {
                try {
                    const contents = await this.getCachedContents(commonPath);
                    for (const item of contents) {
                        this._checkFileForManager(item, packageManagers);
                    }
                    if (packageManagers.size > 0) break;
                } catch (error) {
                    // Директория не существует
                }
            }
        }

        if (packageManagers.size === 0) {
            const managerFiles = [
                'package.json', 'go.mod', 'pom.xml', 
                'requirements.txt', 'requirements-dev.txt', 'requirements-test.txt',
                'Cargo.toml', 'Gemfile', 'composer.json', 'build.gradle',
                'build.gradle.kts', 'pyproject.toml', 'Pipfile', 'poetry.lock',
                'yarn.lock', 'pnpm-lock.yaml','requirements-dev-minimal.txt',
                'CMakeLists.txt', 'conanfile.txt', 'conanfile.py', 
                'vcpkg.json', 'meson.build', 'Makefile', 'GNUmakefile', '*.cmake',
                '*.cmake.in'
            ];
                        
            const originalMaxDepth = this.maxDepth;
            this.maxDepth = 4;
            
            try {
                const allFiles = await this.getAllFilesRecursive('');
                for (const file of allFiles) {
                    if (file && file.name && managerFiles.includes(file.name)) {
                        this._checkFileForManager(file, packageManagers);
                        if (packageManagers.size >= 3) break;
                    }
                }
            } finally {
                this.maxDepth = originalMaxDepth;
            }
        }
        
        for (const manager of packageManagers) {
            this.scanMetadata.packagesByManager[manager] = { count: 0 };
        }
        
        return Array.from(packageManagers);
    }

    _checkFileForManager(item, packageManagers) {
        if (!item || !item.name) return;
        
        const name = item.name.toLowerCase();
        
        if (name === 'package.json') packageManagers.add('npm');
        else if (name === 'yarn.lock') packageManagers.add('yarn');
        else if (name === 'pnpm-lock.yaml') packageManagers.add('pnpm');
        else if (name === 'go.mod') packageManagers.add('go');
        else if (name === 'pom.xml') packageManagers.add('maven');
        else if (name === 'requirements.txt' || 
                 name === 'requirements-dev.txt' || 
                 name === 'requirements-test.txt' ||
                 name === 'requirements-dev-minimal.txt' ||
                 name === 'dev-requirements.txt') packageManagers.add('pip');
        else if (name === 'cargo.toml') packageManagers.add('cargo');
        else if (name === 'gemfile') packageManagers.add('gem');
        else if (name === 'composer.json') packageManagers.add('composer');
        else if (name === 'build.gradle' || name === 'build.gradle.kts') packageManagers.add('gradle');
        else if (name === 'pyproject.toml' || name === 'poetry.lock' || name === 'pipfile') packageManagers.add('pip');
        else if (name === 'cmakelists.txt') packageManagers.add('cmake');
        else if (name === 'conanfile.txt' || name === 'conanfile.py') packageManagers.add('conan');
        else if (name === 'vcpkg.json') packageManagers.add('vcpkg');
        else if (name === 'meson.build') packageManagers.add('meson');
        else if (name === 'makefile' || name === 'gnumakefile' || name === 'makefile.am') packageManagers.add('make');
    }

    // ==================== АНАЛИЗАТОРЫ ПАКЕТНЫХ МЕНЕДЖЕРОВ ====================
    
    async analyzeYarn() {
        try {
            const yarnLockFiles = await this.findFiles('yarn.lock', '', 3);
            
            if (yarnLockFiles.length === 0) {
                return [];
            }

            for (const yarnLockFile of yarnLockFiles) {
                try {
                    const content = await this.getFileContent(yarnLockFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(yarnLockFile.path);
                    const isRoot = packagePath === '.' || packagePath === '';
                    
                    const repoName = this.repoInfo && this.repoInfo.repo ? this.repoInfo.repo : 'unknown';
                    const componentName = isRoot ? repoName : `${repoName}:${packagePath}`;
                    
                    const rootComponent = {
                        type: 'application',
                        name: componentName,
                        version: '1.0.0',
                        purl: `pkg:npm/${componentName}@1.0.0`,
                        properties: [
                            { name: 'src:type', value: isRoot ? 'root' : 'package' },
                            { name: 'src:manager', value: 'yarn' },
                            { name: 'src:path', value: packagePath }
                        ]
                    };
                    
                    const addedRoot = this.addComponent(rootComponent);
                    if (!addedRoot) continue;
                    
                    const lines = content.split('\n');
                    let currentPackage = null;
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        
                        const pkgMatch = trimmed.match(/^"([^@"]+)@([^"]+)":$/);
                        if (pkgMatch) {
                            currentPackage = {
                                name: pkgMatch[1],
                                version: pkgMatch[2]
                            };
                            continue;
                        }
                        
                        if (currentPackage && trimmed.startsWith('version')) {
                            const versionMatch = trimmed.match(/version\s+"([^"]+)"/);
                            if (versionMatch) {
                                currentPackage.version = versionMatch[1];
                            }
                        }
                        
                        if (currentPackage && trimmed.startsWith('resolved')) {
                            const resolvedMatch = trimmed.match(/resolved\s+"([^"]+)"/);
                            if (resolvedMatch) {
                                const component = {
                                    type: 'library',
                                    name: currentPackage.name,
                                    version: currentPackage.version,
                                    purl: `pkg:npm/${currentPackage.name}@${currentPackage.version}`,
                                    license: 'NOASSERTION',
                                    properties: [
                                        { name: 'src:manager', value: 'yarn' },
                                        { name: 'src:path', value: packagePath },
                                        { name: 'src:resolved', value: resolvedMatch[1] }
                                    ]
                                };
                                
                                const added = this.addComponent(component);
                                if (added && addedRoot && addedRoot["bom-ref"]) {
                                    this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                    
                                    if (this.scanMetadata.packagesByManager['yarn']) {
                                        this.scanMetadata.packagesByManager['yarn'].count++;
                                    }
                                }
                                currentPackage = null;
                            }
                        }
                    }
                    
                    const packageJsonPath = path.join(packagePath, 'package.json');
                    try {
                        const pkgContent = await this.getFileContent({ path: packageJsonPath, name: 'package.json' });
                        if (pkgContent) {
                            const packageJson = JSON.parse(pkgContent);
                            
                            const processDeps = (deps, scope) => {
                                if (!deps) return;
                                
                                for (const [name, version] of Object.entries(deps)) {
                                    if (!name) continue;
                                    
                                    let cleanVersion = 'latest';
                                    if (version) {
                                        cleanVersion = String(version).replace(/^[\^~]/, '').split(' ')[0];
                                    }
                                    
                                    const component = {
                                        type: 'library',
                                        name: String(name),
                                        version: cleanVersion,
                                        purl: `pkg:npm/${String(name)}@${cleanVersion}`,
                                        license: packageJson.license || 'NOASSERTION',
                                        properties: [
                                            { name: 'src:scope', value: scope || 'runtime' },
                                            { name: 'src:manager', value: 'yarn' },
                                            { name: 'src:path', value: packagePath }
                                        ]
                                    };
                                    
                                    const added = this.addComponent(component);
                                    if (added && addedRoot && addedRoot["bom-ref"]) {
                                        this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                        
                                        if (this.scanMetadata.packagesByManager['yarn']) {
                                            this.scanMetadata.packagesByManager['yarn'].count++;
                                        }
                                    }
                                }
                            };
                            
                            processDeps(packageJson.dependencies, 'runtime');
                            processDeps(packageJson.devDependencies, 'development');
                        }
                    } catch (err) {}
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    async analyzePnpm() {
        try {
            const pnpmLockFiles = await this.findFiles('pnpm-lock.yaml', '', 3);
            
            if (pnpmLockFiles.length === 0) {
                return [];
            }

            for (const pnpmLockFile of pnpmLockFiles) {
                try {
                    const content = await this.getFileContent(pnpmLockFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(pnpmLockFile.path);
                    const isRoot = packagePath === '.' || packagePath === '';
                    
                    const repoName = this.repoInfo && this.repoInfo.repo ? this.repoInfo.repo : 'unknown';
                    const componentName = isRoot ? repoName : `${repoName}:${packagePath}`;
                    
                    const rootComponent = {
                        type: 'application',
                        name: componentName,
                        version: '1.0.0',
                        purl: `pkg:npm/${componentName}@1.0.0`,
                        properties: [
                            { name: 'src:type', value: isRoot ? 'root' : 'package' },
                            { name: 'src:manager', value: 'pnpm' },
                            { name: 'src:path', value: packagePath }
                        ]
                    };
                    
                    const addedRoot = this.addComponent(rootComponent);
                    if (!addedRoot) continue;
                    
                    const lines = content.split('\n');
                    let currentPackage = null;
                    let inPackages = false;
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        
                        if (trimmed === 'packages:') {
                            inPackages = true;
                            continue;
                        }
                        
                        if (inPackages && trimmed.match(/^[a-f0-9]+:$/)) {
                            currentPackage = {};
                            continue;
                        }
                        
                        if (currentPackage && trimmed.startsWith('name:')) {
                            const nameMatch = trimmed.match(/name:\s+(.+)/);
                            if (nameMatch) {
                                currentPackage.name = nameMatch[1].replace(/['"]/g, '');
                            }
                        }
                        
                        if (currentPackage && trimmed.startsWith('version:')) {
                            const versionMatch = trimmed.match(/version:\s+(.+)/);
                            if (versionMatch) {
                                currentPackage.version = versionMatch[1].replace(/['"]/g, '');
                            }
                        }
                        
                        if (currentPackage && trimmed === '' && currentPackage.name && currentPackage.version) {
                            const component = {
                                type: 'library',
                                name: currentPackage.name,
                                version: currentPackage.version,
                                purl: `pkg:npm/${currentPackage.name}@${currentPackage.version}`,
                                license: 'NOASSERTION',
                                properties: [
                                    { name: 'src:manager', value: 'pnpm' },
                                    { name: 'src:path', value: packagePath }
                                ]
                            };
                            
                            const added = this.addComponent(component);
                            if (added && addedRoot && addedRoot["bom-ref"]) {
                                this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                
                                if (this.scanMetadata.packagesByManager['pnpm']) {
                                    this.scanMetadata.packagesByManager['pnpm'].count++;
                                }
                            }
                            currentPackage = null;
                        }
                    }
                    
                    const packageJsonPath = path.join(packagePath, 'package.json');
                    try {
                        const pkgContent = await this.getFileContent({ path: packageJsonPath, name: 'package.json' });
                        if (pkgContent) {
                            const packageJson = JSON.parse(pkgContent);
                            
                            const processDeps = (deps, scope) => {
                                if (!deps) return;
                                
                                for (const [name, version] of Object.entries(deps)) {
                                    if (!name) continue;
                                    
                                    let cleanVersion = 'latest';
                                    if (version) {
                                        cleanVersion = String(version).replace(/^[\^~]/, '').split(' ')[0];
                                    }
                                    
                                    const component = {
                                        type: 'library',
                                        name: String(name),
                                        version: cleanVersion,
                                        purl: `pkg:npm/${String(name)}@${cleanVersion}`,
                                        license: packageJson.license || 'NOASSERTION',
                                        properties: [
                                            { name: 'src:scope', value: scope || 'runtime' },
                                            { name: 'src:manager', value: 'pnpm' },
                                            { name: 'src:path', value: packagePath }
                                        ]
                                    };
                                    
                                    const added = this.addComponent(component);
                                    if (added && addedRoot && addedRoot["bom-ref"]) {
                                        this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                        
                                        if (this.scanMetadata.packagesByManager['pnpm']) {
                                            this.scanMetadata.packagesByManager['pnpm'].count++;
                                        }
                                    }
                                }
                            };
                            
                            processDeps(packageJson.dependencies, 'runtime');
                            processDeps(packageJson.devDependencies, 'development');
                        }
                    } catch (err) {}
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    async analyzeNPM() {
        try {
            const packageJsonFiles = await this.findFiles('package.json', '', 4);
            
            if (packageJsonFiles.length === 0) {
                return [];
            }

            for (const packageJsonFile of packageJsonFiles) {
                try {
                    const content = await this.getFileContent(packageJsonFile);
                    if (!content) continue;
                    
                    const packageJson = JSON.parse(content);
                    
                    const packagePath = path.dirname(packageJsonFile.path);
                    const isRoot = packagePath === '.' || packagePath === '';
                    
                    const repoName = this.repoInfo && this.repoInfo.repo ? this.repoInfo.repo : 'unknown';
                    const componentName = isRoot ? repoName : `${repoName}:${packagePath}`;
                    const packageVersion = packageJson.version ? String(packageJson.version) : '1.0.0';
                    
                    const rootComponent = {
                        type: 'application',
                        name: componentName,
                        version: packageVersion,
                        purl: `pkg:npm/${componentName}@${packageVersion}`,
                        properties: [
                            { name: 'src:type', value: isRoot ? 'root' : 'package' },
                            { name: 'src:manager', value: 'npm' },
                            { name: 'src:path', value: packagePath }
                        ]
                    };
                    
                    const addedRoot = this.addComponent(rootComponent);
                    if (!addedRoot) continue;
                    
                    const processDeps = (deps, scope) => {
                        if (!deps) return;
                        
                        for (const [name, version] of Object.entries(deps)) {
                            if (!name) continue;
                            
                            let cleanVersion = 'latest';
                            if (version) {
                                cleanVersion = String(version).replace(/^[\^~]/, '').split(' ')[0];
                            }
                            
                            const component = {
                                type: 'library',
                                name: String(name),
                                version: cleanVersion,
                                purl: `pkg:npm/${String(name)}@${cleanVersion}`,
                                license: packageJson.license || 'NOASSERTION',
                                properties: [
                                    { name: 'src:scope', value: scope || 'runtime' },
                                    { name: 'src:manager', value: 'npm' },
                                    { name: 'src:package-path', value: packagePath }
                                ]
                            };

                            const added = this.addComponent(component);
                            if (added && addedRoot && addedRoot["bom-ref"]) {
                                this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                
                                if (this.scanMetadata.packagesByManager['npm']) {
                                    this.scanMetadata.packagesByManager['npm'].count++;
                                }
                            }
                        }
                    };

                    processDeps(packageJson.dependencies, 'runtime');
                    processDeps(packageJson.devDependencies, 'development');
                    
                } catch (err) {}
            }
            
        } catch (error) {}
        return [];
    }

    async analyzePip() {
        try {
            const requirementPatterns = [
                'requirements.txt', 'requirements-dev.txt', 'requirements-test.txt',
                'requirements-docs.txt', 'requirements-prod.txt', 'dev-requirements.txt',
                'test-requirements.txt', 'requirements-local.txt', 'requirements-dev-minimal.txt'
            ];
            
            let allReqFiles = [];
            
            for (const pattern of requirementPatterns) {
                const files = await this.findFiles(pattern, '', 3);
                allReqFiles.push(...files);
            }
            
            if (allReqFiles.length === 0) {
                const pipfileFiles = await this.findFiles('Pipfile', '', 3);
                const pyprojectFiles = await this.findFiles('pyproject.toml', '', 3);
                allReqFiles.push(...pipfileFiles, ...pyprojectFiles);
            }
            
            if (allReqFiles.length === 0) return [];

            for (const file of allReqFiles) {
                try {
                    const content = await this.getFileContent(file);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(file.path);
                    const repoName = this.repoInfo && this.repoInfo.repo ? this.repoInfo.repo : 'unknown';
                    
                    let fileType = 'runtime';
                    const fileName = file.name.toLowerCase();
                    if (fileName.includes('dev') || fileName.includes('development')) {
                        fileType = 'development';
                    } else if (fileName.includes('test')) {
                        fileType = 'test';
                    } else if (fileName.includes('doc')) {
                        fileType = 'documentation';
                    } else if (fileName.includes('prod')) {
                        fileType = 'production';
                    }
                    
                    const rootComponent = {
                        type: 'application',
                        name: `${repoName}:${packagePath}`,
                        version: '1.0.0',
                        purl: `pkg:pypi/${repoName}`,
                        properties: [
                            { name: 'src:type', value: 'package' },
                            { name: 'src:manager', value: 'pip' },
                            { name: 'src:path', value: packagePath },
                            { name: 'src:file', value: file.name },
                            { name: 'src:fileType', value: fileType }
                        ]
                    };
                    
                    const addedRoot = this.addComponent(rootComponent);
                    if (!addedRoot) continue;
                    
                    const lines = content.split('\n');
                    let depCount = 0;
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith('#')) continue;
                        
                        const match = trimmed.match(/^([a-zA-Z0-9_\-\.]+)(?:[=<>!~]=|@|>|<|~=)\s*(.+)$/) ||
                                    trimmed.match(/^([a-zA-Z0-9_\-\.]+)==(.+)$/) ||
                                    trimmed.match(/^([a-zA-Z0-9_\-\.]+)$/);
                        
                        if (match) {
                            const name = match[1];
                            let version = match[2] || 'latest';
                            
                            const commentIndex = version.indexOf('#');
                            if (commentIndex !== -1) {
                                version = version.substring(0, commentIndex).trim();
                            }
                            
                            if (!name) continue;
                            
                            const component = {
                                type: 'library',
                                name: String(name),
                                version: String(version).replace(/['"]/g, ''),
                                purl: `pkg:pypi/${String(name).toLowerCase()}@${String(version).replace(/['"]/g, '')}`,
                                license: 'NOASSERTION',
                                properties: [
                                    { name: 'src:manager', value: 'pip' },
                                    { name: 'src:file', value: file.name },
                                    { name: 'src:fileType', value: fileType },
                                    { name: 'src:path', value: packagePath }
                                ]
                            };

                            const added = this.addComponent(component);
                            if (added && addedRoot && addedRoot["bom-ref"]) {
                                this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                depCount++;
                            }
                        }
                    }
                    
                    if (this.scanMetadata.packagesByManager['pip']) {
                        this.scanMetadata.packagesByManager['pip'].count += depCount;
                    }
                    
                } catch (err) {
                    console.warn(`⚠️ Ошибка парсинга ${file.name}:`, err.message);
                }
            }
        } catch (error) {
            console.warn('Ошибка анализа pip:', error.message);
        }
        return [];
    }

    async analyzeGo() {
        try {
            const goModFiles = await this.findFiles('go.mod', '', 3);
            
            if (goModFiles.length === 0) return [];

            for (const goModFile of goModFiles) {
                try {
                    const content = await this.getFileContent(goModFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(goModFile.path);
                    
                    const moduleMatch = content.match(/module\s+([^\s]+)/);
                    const moduleName = moduleMatch ? moduleMatch[1] : `unknown:${packagePath}`;
                    
                    const rootComponent = {
                        type: 'application',
                        name: String(moduleName),
                        version: '1.0.0',
                        purl: `pkg:golang/${String(moduleName)}`,
                        properties: [
                            { name: 'src:type', value: 'package' },
                            { name: 'src:manager', value: 'go' },
                            { name: 'src:path', value: packagePath }
                        ]
                    };
                    
                    const addedRoot = this.addComponent(rootComponent);
                    if (!addedRoot) continue;
                    
                    const lines = content.split('\n');
                    let inRequire = false;
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        
                        if (trimmed.startsWith('require (')) {
                            inRequire = true;
                            continue;
                        } else if (trimmed === ')') {
                            inRequire = false;
                            continue;
                        }
                        
                        if (inRequire || trimmed.startsWith('require')) {
                            const requireMatch = trimmed.match(/require\s+([^\s]+)\s+([^\s]+)/) || 
                                               trimmed.match(/^([^\s]+)\s+([^\s]+)/);
                            
                            if (requireMatch) {
                                const name = requireMatch[1];
                                const version = requireMatch[2].replace(/\/\/.*$/, '').trim();
                                
                                if (!name) continue;
                                
                                const component = {
                                    type: 'library',
                                    name: String(name),
                                    version: String(version),
                                    purl: `pkg:golang/${String(name)}@${String(version)}`,
                                    license: 'NOASSERTION',
                                    properties: [
                                        { name: 'src:manager', value: 'go' },
                                        { name: 'src:path', value: packagePath }
                                    ]
                                };

                                const added = this.addComponent(component);
                                if (added && addedRoot && addedRoot["bom-ref"]) {
                                    this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                    
                                    if (this.scanMetadata.packagesByManager['go']) {
                                        this.scanMetadata.packagesByManager['go'].count++;
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    async analyzeMaven() {
        try {
            const pomFiles = await this.findFiles('pom.xml', '', 3);
            
            if (pomFiles.length === 0) return [];

            for (const pomFile of pomFiles) {
                try {
                    const content = await this.getFileContent(pomFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(pomFile.path);
                    
                    const groupIdMatch = content.match(/<groupId>(.*?)<\/groupId>/);
                    const artifactIdMatch = content.match(/<artifactId>(.*?)<\/artifactId>/);
                    const versionMatch = content.match(/<version>(.*?)<\/version>/);
                    
                    const groupId = groupIdMatch ? groupIdMatch[1] : 'unknown';
                    const artifactId = artifactIdMatch ? artifactIdMatch[1] : `unknown:${packagePath}`;
                    const version = versionMatch ? versionMatch[1] : '1.0.0';
                    
                    const rootComponent = {
                        type: 'application',
                        name: `${groupId}:${artifactId}`,
                        version: version,
                        purl: `pkg:maven/${groupId}/${artifactId}@${version}`,
                        properties: [
                            { name: 'src:type', value: 'package' },
                            { name: 'src:manager', value: 'maven' },
                            { name: 'src:path', value: packagePath }
                        ]
                    };
                    
                    const addedRoot = this.addComponent(rootComponent);
                    if (!addedRoot) continue;
                    
                    const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
                    const depMatches = content.matchAll(depRegex);
                    
                    for (const match of depMatches) {
                        const depBlock = match[1];
                        const depGroupId = depBlock.match(/<groupId>(.*?)<\/groupId>/);
                        const depArtifactId = depBlock.match(/<artifactId>(.*?)<\/artifactId>/);
                        const depVersion = depBlock.match(/<version>(.*?)<\/version>/);
                        const depScope = depBlock.match(/<scope>(.*?)<\/scope>/);
                        
                        if (depGroupId && depArtifactId) {
                            const name = `${depGroupId[1]}:${depArtifactId[1]}`;
                            const versionValue = depVersion ? depVersion[1] : 'unknown';
                            
                            const component = {
                                type: 'library',
                                name: name,
                                version: versionValue,
                                purl: `pkg:maven/${depGroupId[1]}/${depArtifactId[1]}@${versionValue}`,
                                license: 'NOASSERTION',
                                properties: [
                                    { name: 'src:manager', value: 'maven' },
                                    { name: 'src:scope', value: depScope ? depScope[1] : 'runtime' },
                                    { name: 'src:path', value: packagePath }
                                ]
                            };

                            const added = this.addComponent(component);
                            if (added && addedRoot && addedRoot["bom-ref"]) {
                                this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                
                                if (this.scanMetadata.packagesByManager['maven']) {
                                    this.scanMetadata.packagesByManager['maven'].count++;
                                }
                            }
                        }
                    }
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    async analyzeGradle() {
        try {
            const gradleFiles = await this.findFiles('build.gradle', '', 3);
            const gradleKtsFiles = await this.findFiles('build.gradle.kts', '', 3);
            const allGradleFiles = [...gradleFiles, ...gradleKtsFiles];
            
            if (allGradleFiles.length === 0) return [];

            for (const gradleFile of allGradleFiles) {
                try {
                    const content = await this.getFileContent(gradleFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(gradleFile.path);
                    const repoName = this.repoInfo && this.repoInfo.repo ? this.repoInfo.repo : 'unknown';
                    
                    const rootComponent = {
                        type: 'application',
                        name: `${repoName}:${packagePath}`,
                        version: '1.0.0',
                        purl: `pkg:gradle/${repoName}`,
                        properties: [
                            { name: 'src:type', value: 'package' },
                            { name: 'src:manager', value: 'gradle' },
                            { name: 'src:path', value: packagePath }
                        ]
                    };
                    
                    const addedRoot = this.addComponent(rootComponent);
                    if (!addedRoot) continue;
                    
                    const depRegex = /(implementation|api|compileOnly|runtimeOnly)\s+['"]([^:]+):([^:]+):([^'"]+)['"]/g;
                    const depMatches = content.matchAll(depRegex);
                    
                    for (const match of depMatches) {
                        const scope = match[1];
                        const group = match[2];
                        const name = match[3];
                        const version = match[4];
                        
                        const component = {
                            type: 'library',
                            name: `${group}:${name}`,
                            version: version,
                            purl: `pkg:maven/${group}/${name}@${version}`,
                            license: 'NOASSERTION',
                            properties: [
                                { name: 'src:manager', value: 'gradle' },
                                { name: 'src:scope', value: scope },
                                { name: 'src:path', value: packagePath }
                            ]
                        };

                        const added = this.addComponent(component);
                        if (added && addedRoot && addedRoot["bom-ref"]) {
                            this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                            
                            if (this.scanMetadata.packagesByManager['gradle']) {
                                this.scanMetadata.packagesByManager['gradle'].count++;
                            }
                        }
                    }
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    async analyzeComposer() {
        try {
            const composerFiles = await this.findFiles('composer.json', '', 3);
            
            if (composerFiles.length === 0) return [];

            for (const composerFile of composerFiles) {
                try {
                    const content = await this.getFileContent(composerFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(composerFile.path);
                    const composer = JSON.parse(content);
                    
                    const repoName = this.repoInfo && this.repoInfo.repo ? this.repoInfo.repo : 'unknown';
                    
                    const rootComponent = {
                        type: 'application',
                        name: composer.name || `${repoName}:${packagePath}`,
                        version: composer.version || '1.0.0',
                        purl: `pkg:composer/${composer.name || repoName}`,
                        properties: [
                            { name: 'src:type', value: 'package' },
                            { name: 'src:manager', value: 'composer' },
                            { name: 'src:path', value: packagePath }
                        ]
                    };
                    
                    const addedRoot = this.addComponent(rootComponent);
                    if (!addedRoot) continue;
                    
                    const processDeps = (deps, scope) => {
                        if (!deps) return;
                        
                        for (const [name, version] of Object.entries(deps)) {
                            if (!name) continue;
                            
                            const cleanVersion = version ? String(version).replace(/^[\^~]/, '') : 'latest';
                            
                            const component = {
                                type: 'library',
                                name: String(name),
                                version: cleanVersion,
                                purl: `pkg:composer/${String(name)}@${cleanVersion}`,
                                license: 'NOASSERTION',
                                properties: [
                                    { name: 'src:manager', value: 'composer' },
                                    { name: 'src:scope', value: scope || 'runtime' },
                                    { name: 'src:path', value: packagePath }
                                ]
                            };

                            const added = this.addComponent(component);
                            if (added && addedRoot && addedRoot["bom-ref"]) {
                                this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                
                                if (this.scanMetadata.packagesByManager['composer']) {
                                    this.scanMetadata.packagesByManager['composer'].count++;
                                }
                            }
                        }
                    };

                    processDeps(composer.require, 'runtime');
                    processDeps(composer['require-dev'], 'development');
                    
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    async analyzeGem() {
        try {
            const gemFiles = await this.findFiles('Gemfile', '', 3);
            
            if (gemFiles.length === 0) return [];

            for (const gemFile of gemFiles) {
                try {
                    const content = await this.getFileContent(gemFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(gemFile.path);
                    const repoName = this.repoInfo && this.repoInfo.repo ? this.repoInfo.repo : 'unknown';
                    
                    const rootComponent = {
                        type: 'application',
                        name: `${repoName}:${packagePath}`,
                        version: '1.0.0',
                        purl: `pkg:gem/${repoName}`,
                        properties: [
                            { name: 'src:type', value: 'package' },
                            { name: 'src:manager', value: 'gem' },
                            { name: 'src:path', value: packagePath }
                        ]
                    };
                    
                    const addedRoot = this.addComponent(rootComponent);
                    if (!addedRoot) continue;
                    
                    const gemRegex = /gem\s+['"]([^'"]+)['"],\s*['"]([^'"]+)['"]/g;
                    const gemMatches = content.matchAll(gemRegex);
                    
                    for (const match of gemMatches) {
                        const name = match[1];
                        const version = match[2];
                        
                        if (!name) continue;
                        
                        const component = {
                            type: 'library',
                            name: String(name),
                            version: String(version),
                            purl: `pkg:gem/${String(name)}@${String(version)}`,
                            license: 'NOASSERTION',
                            properties: [
                                { name: 'src:manager', value: 'gem' },
                                { name: 'src:path', value: packagePath }
                            ]
                        };

                        const added = this.addComponent(component);
                        if (added && addedRoot && addedRoot["bom-ref"]) {
                            this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                            
                            if (this.scanMetadata.packagesByManager['gem']) {
                                this.scanMetadata.packagesByManager['gem'].count++;
                            }
                        }
                    }
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    async analyzeCargo() {
        try {
            const cargoFiles = await this.findFiles('Cargo.toml', '', 3);
            
            if (cargoFiles.length === 0) return [];

            for (const cargoFile of cargoFiles) {
                try {
                    const content = await this.getFileContent(cargoFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(cargoFile.path);
                    const repoName = this.repoInfo && this.repoInfo.repo ? this.repoInfo.repo : 'unknown';
                    
                    const rootComponent = {
                        type: 'application',
                        name: `${repoName}:${packagePath}`,
                        version: '1.0.0',
                        purl: `pkg:cargo/${repoName}`,
                        properties: [
                            { name: 'src:type', value: 'package' },
                            { name: 'src:manager', value: 'cargo' },
                            { name: 'src:path', value: packagePath }
                        ]
                    };
                    
                    const addedRoot = this.addComponent(rootComponent);
                    if (!addedRoot) continue;
                    
                    const depSection = content.match(/\[dependencies\]([\s\S]*?)(\[|$)/);
                    
                    if (depSection) {
                        const lines = depSection[1].split('\n');
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (trimmed && !trimmed.startsWith('#')) {
                                const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*['"]([^'"]+)['"]/);
                                if (match) {
                                    const name = match[1];
                                    const version = match[2];
                                    
                                    if (!name) continue;
                                    
                                    const component = {
                                        type: 'library',
                                        name: String(name),
                                        version: String(version),
                                        purl: `pkg:cargo/${String(name)}@${String(version)}`,
                                        license: 'NOASSERTION',
                                        properties: [
                                            { name: 'src:manager', value: 'cargo' },
                                            { name: 'src:path', value: packagePath }
                                        ]
                                    };

                                    const added = this.addComponent(component);
                                    if (added && addedRoot && addedRoot["bom-ref"]) {
                                        this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                        
                                        if (this.scanMetadata.packagesByManager['cargo']) {
                                            this.scanMetadata.packagesByManager['cargo'].count++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    // ==================== C/C++ АНАЛИЗАТОРЫ ====================

    async analyzeCMake() {
    try {
        const allCMakeFiles = await this.getAllCMakeFiles();
        if (allCMakeFiles.length === 0) return [];
        
        const addedRoot = this.getOrCreateRootComponent();
        if (!addedRoot) return [];
        
        const cmakeTree = await this.buildCMakeTree(allCMakeFiles);
        const addedComponents = new Set();
        
        for (const [file, depth] of cmakeTree) {
            const content = await this.getFileContent(file);
            if (!content) continue;
            
            const dirPath = path.dirname(file.path);
            const relativeDepth = depth;
            const componentType = relativeDepth === 0 ? 'application' : 'library';
            const targetsInFile = this.extractTargetsFromCMake(content);
            
            for (const target of targetsInFile) {
                const deps = this.extractDependenciesForTarget(content, target);
                
                // ← ПРОВЕРКА: пропускаем внутренние и тестовые цели
                if (this.isInternalTarget(target)) continue;
                if (this.isTestTarget(target, dirPath)) continue;
                
                const normalizedTargetName = this.normalizeTargetName(target);
                if (!normalizedTargetName) continue;
                
                const targetComponent = {
                    type: componentType,
                    name: normalizedTargetName,
                    version: 'unknown',
                    purl: `pkg:generic/${normalizedTargetName}@unknown`,
                    properties: [
                        { name: 'src:manager', value: 'cmake' },
                        { name: 'src:type', value: 'target' },
                        { name: 'src:path', value: dirPath },
                        { name: 'src:depth', value: String(relativeDepth) }
                    ]
                };
                
                const addedTarget = this.addComponent(targetComponent);
                if (addedTarget && addedRoot["bom-ref"]) {
                    this.addDependency(addedRoot["bom-ref"], addedTarget["bom-ref"]);
                }
                
                const processedDepsForTarget = new Set();
                
                for (const dep of deps) {
                    if (processedDepsForTarget.has(dep)) continue;
                    processedDepsForTarget.add(dep);
                    
                    if (this.shouldSkipDependency(dep, dirPath)) continue;
                    if (this.isInternalTarget(dep)) continue;
                    
                    const normalizedName = this.normalizeLibraryName(dep);
                    if (!normalizedName) continue;
                    
                    const key = `cmake:${normalizedName}`;
                    
                    if (addedComponents.has(key)) {
                        const existing = Array.from(this.componentMap.values())
                            .find(c => c.name === normalizedName);
                        if (existing && addedTarget["bom-ref"]) {
                            this.addDependency(addedTarget["bom-ref"], existing["bom-ref"]);
                        }
                        continue;
                    }
                    
                    addedComponents.add(key);
                    
                    const component = {
                        type: 'library',
                        name: normalizedName,
                        version: 'unknown',
                        purl: `pkg:generic/${normalizedName}@unknown`,
                        properties: [
                            { name: 'src:manager', value: 'cmake' },
                            { name: 'src:type', value: 'dependency' },
                            { name: 'src:target', value: target },
                            { name: 'src:path', value: dirPath }
                        ]
                    };
                    
                    const addedDep = this.addComponent(component);
                    if (addedDep && addedTarget["bom-ref"]) {
                        this.addDependency(addedTarget["bom-ref"], addedDep["bom-ref"]);
                        if (!this.scanMetadata.packagesByManager['cmake']) {
                            this.scanMetadata.packagesByManager['cmake'] = { count: 0 };
                        }
                        this.scanMetadata.packagesByManager['cmake'].count++;
                    }
                }
            }
        }
    } catch (error) {}
    return [];
}

// ========== НОВЫЕ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

async getAllCMakeFiles() {
    const allFiles = await this.getAllFilesRecursive('');
    const cmakeFiles = [];
    
    for (const file of allFiles) {
        if (!file || !file.name) continue;
        const name = file.name.toLowerCase();
        if (name === 'cmakelists.txt' || name.endsWith('.cmake') || name.endsWith('.cmake.in')) {
            cmakeFiles.push(file);
        }
    }
    
    return cmakeFiles;
}

async buildCMakeTree(cmakeFiles) {
    const tree = new Map();
    
    // Сортируем по глубине (корневые CMakeLists.txt имеют приоритет)
    for (const file of cmakeFiles) {
        const dirPath = path.dirname(file.path);
        const depth = dirPath.split('/').filter(p => p && p !== '.').length;
        tree.set(file, depth);
    }
    
    return Array.from(tree.entries()).sort((a, b) => a[1] - b[1]);
}

async collectAllTargets(cmakeFiles) {
    const targets = new Set();
    
    for (const file of cmakeFiles) {
        const content = await this.getFileContent(file);
        if (!content) continue;
        
        // Ищем add_executable, add_library, add_custom_target
        const targetRegex = /add_(?:executable|library|custom_target)\s*\(\s*([^\s)]+)/gi;
        let match;
        while ((match = targetRegex.exec(content)) !== null) {
            targets.add(match[1]);
        }
    }
    
    return targets;
}

extractTargetsFromCMake(content) {
    const targets = [];
    const targetRegex = /add_(?:executable|library|custom_target)\s*\(\s*([^\s)]+)/gi;
    let match;
    while ((match = targetRegex.exec(content)) !== null) {
        targets.push(match[1]);
    }
    return targets;
}

extractDependenciesForTarget(content, target) {
    const dependencies = [];
    
    // Ищем target_link_libraries для конкретного target
    const linkRegex = new RegExp(`target_link_libraries\\s*\\(\\s*${target}\\s+([^)]+)\\)`, 'gi');
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
        const libsLine = match[1];
        const libs = libsLine.match(/[^\s"']+|"[^"]*"|'[^']*'/g) || [];
        for (const lib of libs) {
            const cleanLib = lib.replace(/^["']|["']$/g, '');
            dependencies.push(cleanLib);
        }
    }
    
    // Также ищем PUBLIC/PRIVATE/INTERFACE варианты
    const privateRegex = new RegExp(`target_link_libraries\\s*\\(\\s*${target}\\s+(?:PUBLIC|PRIVATE|INTERFACE)\\s+([^)]+)\\)`, 'gi');
    while ((match = privateRegex.exec(content)) !== null) {
        const libsLine = match[1];
        const libs = libsLine.match(/[^\s"']+|"[^"]*"|'[^']*'/g) || [];
        for (const lib of libs) {
            const cleanLib = lib.replace(/^["']|["']$/g, '');
            dependencies.push(cleanLib);
        }
    }
    
    return dependencies;
}

isTestTarget(target, path) {
    const testPatterns = ['test', 'tests', 'unittest', 'gtest', 'benchmark', 'example'];
    const targetLower = target.toLowerCase();
    const pathLower = path.toLowerCase();
    
    if (testPatterns.some(p => targetLower.includes(p))) return true;
    if (testPatterns.some(p => pathLower.includes(p))) return true;
    return false;
}

isInternalTarget(name) {
    const internalPrefixes = ['dm_', 'ds_', 'ttln_', 'reservemem_', 'fd_', 'emr_', 'spdk_', 'rte_'];
    const internalNames = ['core', 'cache', 'extent', 'gens', 'sync', 'repl', 'rest', 'transport'];
    
    const nameLower = name.toLowerCase();
    if (internalNames.includes(nameLower)) return true;
    if (internalPrefixes.some(p => nameLower.startsWith(p))) return true;
    return false;
}

shouldSkipDependency(lib, path) {
    const skipNames = ['remove', 'reverse', 'dependency', 'requires', 'old', 'new', 'haha',
                      'testing', 'archive', 'lib', 'pfm', 'qat', 'verbs', 'ibverbs', 'rdmacm',
                      'netlink', 'unwind', 'threads', 'dl', 'm', 'rt', 'pthread', 'c', 'stdc++'];
    
    const cleanLib = lib.replace(/^\$\{[^}]+\}/g, '').replace(/@[^@]+@/g, '').toLowerCase();
    
    if (skipNames.includes(cleanLib)) return true;
    if (cleanLib.match(/^[0-9]/)) return true; // Числовые зависимости
    if (cleanLib.length < 2) return true;
    
    // Пропускаем CMake переменные
    if (cleanLib.match(/^\$\{/) || cleanLib.match(/^cmake_/)) return true;
    
    return false;
}

normalizeLibraryName(name) {
    let clean = name.replace(/\$\{[^}]+\}/g, '');
    clean = clean.replace(/@[^@]+@/g, '');
    clean = clean.replace(/^::/, '');
    clean = clean.replace(/::.*$/, '');
    clean = clean.replace(/\.(so|a|dylib|dll)(\..+)?$/, '');
    clean = clean.replace(/^lib/, '');
    clean = clean.replace(/[^a-zA-Z0-9_\-]/g, '');
    clean = clean.toLowerCase();
    
    // ========== ФИЛЬТРАЦИЯ МУСОРА ==========
    
    // Мусорные слова (исключаем полностью)
    const garbageWords = [
        'private', 'public', 'interface', 'target', 'core', 'rest', 'transport',
        'old', 'new', 'remove', 'reverse', 'dependency', 'requires', 'todo', 'haha',
        'testing', 'archive', 'lib', 'bench', 'test', 'example', 'worker', 'rpm',
        'boolenable', 'ifboolenable', 'boollttng', 'booltraid', 'usdm', 'pfm', 'qat',
        'uppernamelib', 'namecurlib', 'namenamewe', 'opensslopenssl', 'dependency-graph-worker'
    ];
    
    if (garbageWords.includes(clean)) {
        return null; // возвращаем null для мусора
    }
    
    // Проверка на мусорные суффиксы
    if (clean.match(/_(bench|test|example|worker|rpm)$/)) {
        return null;
    }
    
    // Проверка на мусорные префиксы (CMake флаги)
    if (clean.startsWith('bool') || clean.startsWith('ifbool')) {
        return null;
    }
    
    // Внутренние модули проекта (исключаем)
    const internalPrefixes = ['dm_', 'ds_', 'ttln_', 'reservemem_', 'fd_', 'emr_', 'spdk_', 'rte_'];
    for (const prefix of internalPrefixes) {
        if (clean.startsWith(prefix)) {
            return null;
        }
    }
    
    // Если имя состоит только из цифр или слишком короткое
    if (clean.length < 2 || clean.match(/^[0-9]+$/)) {
        return null;
    }
    
    return clean;
}

normalizeTargetName(name) {
    // Для целей оставляем оригинальное имя, но убираем спецсимволы
    return name.replace(/[^a-zA-Z0-9_\-]/g, '').toLowerCase();
}

    async analyzeConan() {
        try {
            const conanFiles = await this.findFiles('conanfile.txt', '', 3);
            const conanPyFiles = await this.findFiles('conanfile.py', '', 3);
            const allConanFiles = [...conanFiles, ...conanPyFiles];
            
            if (allConanFiles.length === 0) return [];
            
            if (!this.scanMetadata.packagesByManager['conan']) {
                this.scanMetadata.packagesByManager['conan'] = { count: 0 };
            }
            
            const addedRoot = this.getOrCreateRootComponent();
            if (!addedRoot) return [];
            
            for (const conanFile of allConanFiles) {
                try {
                    const content = await this.getFileContent(conanFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(conanFile.path);
                    const safePath = packagePath ? packagePath.replace(/\\/g, '/') : '';
                    
                    const lines = content.split('\n');
                    let inRequires = false;
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        
                        if (trimmed.startsWith('[requires]')) {
                            inRequires = true;
                            continue;
                        }
                        
                        if (trimmed.startsWith('[') && trimmed !== '[requires]') {
                            inRequires = false;
                            continue;
                        }
                        
                        if (inRequires && trimmed && !trimmed.startsWith('#')) {
                            const match = trimmed.match(/^([a-zA-Z0-9_\-\.]+)\/([0-9\.]+)/);
                            if (match) {
                                const name = match[1];
                                const version = match[2];
                                
                                const component = {
                                    type: 'library',
                                    name: name,
                                    version: version,
                                    purl: `pkg:conan/${name}@${version}`,
                                    properties: [
                                        { name: 'src:manager', value: 'conan' },
                                        { name: 'src:path', value: safePath }
                                    ]
                                };
                                
                                const added = this.addComponent(component);
                                if (added && addedRoot["bom-ref"]) {
                                    this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                    this.scanMetadata.packagesByManager['conan'].count++;
                                }
                            }
                        }
                    }
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    async analyzeVcpkg() {
        try {
            const vcpkgFiles = await this.findFiles('vcpkg.json', '', 3);
            
            if (vcpkgFiles.length === 0) return [];
            
            if (!this.scanMetadata.packagesByManager['vcpkg']) {
                this.scanMetadata.packagesByManager['vcpkg'] = { count: 0 };
            }
            
            const addedRoot = this.getOrCreateRootComponent();
            if (!addedRoot) return [];
            
            for (const vcpkgFile of vcpkgFiles) {
                try {
                    const content = await this.getFileContent(vcpkgFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(vcpkgFile.path);
                    const safePath = packagePath ? packagePath.replace(/\\/g, '/') : '';
                    const vcpkgJson = JSON.parse(content);
                    const dependencies = vcpkgJson.dependencies || [];
                    
                    for (const dep of dependencies) {
                        const name = typeof dep === 'string' ? dep : dep.name;
                        const version = dep.version || 'latest';
                        
                        const component = {
                            type: 'library',
                            name: name.toLowerCase(),
                            version: version,
                            purl: `pkg:generic/${name.toLowerCase()}@${version}`,
                            properties: [
                                { name: 'src:manager', value: 'vcpkg' },
                                { name: 'src:path', value: safePath }
                            ]
                        };
                        
                        const added = this.addComponent(component);
                        if (added && addedRoot["bom-ref"]) {
                            this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                            this.scanMetadata.packagesByManager['vcpkg'].count++;
                        }
                    }
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    async analyzeMake() {
        try {
            const makeFiles = await this.findFiles('Makefile', '', 3);
            const makefileAmFiles = await this.findFiles('Makefile.am', '', 3);
            const gnuMakefiles = await this.findFiles('GNUmakefile', '', 3);
            const allMakeFiles = [...makeFiles, ...makefileAmFiles, ...gnuMakefiles];
            
            if (allMakeFiles.length === 0) return [];
            
            if (!this.scanMetadata.packagesByManager['make']) {
                this.scanMetadata.packagesByManager['make'] = { count: 0 };
            }
            
            const addedRoot = this.getOrCreateRootComponent();
            if (!addedRoot) return [];
            
            for (const makeFile of allMakeFiles) {
                try {
                    const content = await this.getFileContent(makeFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(makeFile.path);
                    const safePath = packagePath ? packagePath.replace(/\\/g, '/') : '';
                    
                    const libsRegex = /(?:LIBS|LDLIBS|LOADLIBES)\s*[+:]=?\s*(.+?)(?=\n|$)/gi;
                    let match;
                    
                    while ((match = libsRegex.exec(content)) !== null) {
                        const libs = match[1];
                        const libMatches = libs.match(/-l([a-zA-Z0-9_\-\.]+)/g);
                        
                        if (libMatches) {
                            for (const libMatch of libMatches) {
                                const name = libMatch.replace(/^-l/, '');
                                const component = {
                                    type: 'library',
                                    name: name.toLowerCase(),
                                    version: 'latest',
                                    purl: `pkg:generic/${name.toLowerCase()}@latest`,
                                    properties: [
                                        { name: 'src:manager', value: 'make' },
                                        { name: 'src:type', value: 'link_library' },
                                        { name: 'src:path', value: safePath }
                                    ]
                                };
                                
                                const added = this.addComponent(component);
                                if (added && addedRoot["bom-ref"]) {
                                    this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                                    this.scanMetadata.packagesByManager['make'].count++;
                                }
                            }
                        }
                    }
                    
                    const pkgConfigRegex = /pkg-config\s+--libs\s+([a-zA-Z0-9_\-]+)/gi;
                    while ((match = pkgConfigRegex.exec(content)) !== null) {
                        const name = match[1];
                        const component = {
                            type: 'library',
                            name: name.toLowerCase(),
                            version: 'latest',
                            purl: `pkg:generic/${name.toLowerCase()}@latest`,
                            properties: [
                                { name: 'src:manager', value: 'make' },
                                { name: 'src:type', value: 'pkg-config' },
                                { name: 'src:path', value: safePath }
                            ]
                        };
                        
                        const added = this.addComponent(component);
                        if (added && addedRoot["bom-ref"]) {
                            this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                            this.scanMetadata.packagesByManager['make'].count++;
                        }
                    }
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    async analyzeMeson() {
        try {
            const mesonFiles = await this.findFiles('meson.build', '', 3);
            
            if (mesonFiles.length === 0) return [];
            
            if (!this.scanMetadata.packagesByManager['meson']) {
                this.scanMetadata.packagesByManager['meson'] = { count: 0 };
            }
            
            const addedRoot = this.getOrCreateRootComponent();
            if (!addedRoot) return [];
            
            for (const mesonFile of mesonFiles) {
                try {
                    const content = await this.getFileContent(mesonFile);
                    if (!content) continue;
                    
                    const packagePath = path.dirname(mesonFile.path);
                    const safePath = packagePath ? packagePath.replace(/\\/g, '/') : '';
                    
                    const depRegex = /dependency\s*\(\s*['"]([^'"]+)['"]/gi;
                    let match;
                    const foundDeps = new Set();
                    
                    while ((match = depRegex.exec(content)) !== null) {
                        const depName = match[1];
                        if (!depName || foundDeps.has(depName)) continue;
                        foundDeps.add(depName);
                        
                        let version = 'latest';
                        const versionMatch = content.match(new RegExp(`${depName}.*version\\s*:\\s*['"]([^'"]+)['"]`, 'i'));
                        if (versionMatch) version = versionMatch[1];
                        
                        const component = {
                            type: 'library',
                            name: depName.toLowerCase(),
                            version: version,
                            purl: `pkg:generic/${depName.toLowerCase()}@${version}`,
                            properties: [
                                { name: 'src:manager', value: 'meson' },
                                { name: 'src:type', value: 'dependency' },
                                { name: 'src:path', value: safePath }
                            ]
                        };
                        
                        const added = this.addComponent(component);
                        if (added && addedRoot["bom-ref"]) {
                            this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                            this.scanMetadata.packagesByManager['meson'].count++;
                        }
                    }
                    
                    const findLibRegex = /find_library\s*\(\s*['"]([^'"]+)['"]/gi;
                    while ((match = findLibRegex.exec(content)) !== null) {
                        const libName = match[1];
                        
                        const component = {
                            type: 'library',
                            name: libName.toLowerCase(),
                            version: 'latest',
                            purl: `pkg:generic/${libName.toLowerCase()}@latest`,
                            properties: [
                                { name: 'src:manager', value: 'meson' },
                                { name: 'src:type', value: 'find_library' },
                                { name: 'src:path', value: safePath }
                            ]
                        };
                        
                        const added = this.addComponent(component);
                        if (added && addedRoot["bom-ref"]) {
                            this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                            this.scanMetadata.packagesByManager['meson'].count++;
                        }
                    }
                } catch (err) {}
            }
        } catch (error) {}
        return [];
    }

    async analyzeCppDeps() {
        const results = [];
        
        const hasCMake = (await this.findFiles('CMakeLists.txt', '', 1)).length > 0;
        const hasConan = (await this.findFiles('conanfile.txt', '', 1)).length > 0 || 
                         (await this.findFiles('conanfile.py', '', 1)).length > 0;
        const hasVcpkg = (await this.findFiles('vcpkg.json', '', 1)).length > 0;
        const hasMake = (await this.findFiles('Makefile', '', 1)).length > 0;
        const hasMeson = (await this.findFiles('meson.build', '', 1)).length > 0;
        
        if (hasCMake) results.push(...await this.analyzeCMake());
        if (hasConan) results.push(...await this.analyzeConan());
        if (hasVcpkg) results.push(...await this.analyzeVcpkg());
        if (hasMake) results.push(...await this.analyzeMake());
        if (hasMeson) results.push(...await this.analyzeMeson());
        
        return results;
    }

    // ==================== BUILD-TIME ЗАВИСИМОСТИ ====================

    async analyzeBuildDependencies() {
        const buildDeps = [];
        const addedRoot = this.getOrCreateRootComponent();
        if (!addedRoot) return buildDeps;
        
        let hasCMakeLists = false;
        let hasMakefile = false;
        let hasConanfile = false;
        let hasVcpkgJson = false;
        let hasMesonBuild = false;
        let hasConfigureAc = false;
        
        const allFiles = await this.getAllFilesRecursive('');
        
        for (const file of allFiles) {
            const fileName = file.name.toLowerCase();
            if (fileName === 'cmakelists.txt') hasCMakeLists = true;
            if (fileName === 'makefile' || fileName === 'gnumakefile') hasMakefile = true;
            if (fileName === 'conanfile.txt' || fileName === 'conanfile.py') hasConanfile = true;
            if (fileName === 'vcpkg.json') hasVcpkgJson = true;
            if (fileName === 'meson.build') hasMesonBuild = true;
            if (fileName === 'configure.ac' || fileName === 'configure.in') hasConfigureAc = true;
        }
        
        let cmakeVersion = 'unknown';
        let conanVersion = 'unknown';
        
        for (const file of allFiles) {
            const content = await this.getFileContent(file);
            if (!content) continue;
            
            if (file.name === 'CMakeLists.txt') {
                const versionMatch = content.match(/cmake_minimum_required\s*\(\s*VERSION\s+([0-9\.]+)/i);
                if (versionMatch) cmakeVersion = versionMatch[1];
            }
            
            if (file.name === 'conanfile.txt') {
                const versionMatch = content.match(/\[requires\][\s\S]*?conan\/([0-9\.]+)/i);
                if (versionMatch) conanVersion = versionMatch[1];
            }
        }
        
        const buildTools = [];
        
        if (hasCMakeLists) {
            buildTools.push({
                name: 'cmake',
                version: cmakeVersion,
                type: 'build_system',
                scope: 'build',
                purl: `pkg:generic/cmake@${cmakeVersion}`,
                properties: [
                    { name: 'build:tool', value: 'cmake' },
                    { name: 'build:purpose', value: 'build_system' }
                ]
            });
        }
        
        if (hasMakefile) {
            buildTools.push({
                name: 'make',
                version: 'unknown',
                type: 'build_system',
                scope: 'build',
                purl: 'pkg:generic/make@unknown',
                properties: [
                    { name: 'build:tool', value: 'make' },
                    { name: 'build:purpose', value: 'build_system' }
                ]
            });
        }
        
        if (hasConanfile) {
            buildTools.push({
                name: 'conan',
                version: conanVersion,
                type: 'package_manager',
                scope: 'build',
                purl: `pkg:generic/conan@${conanVersion}`,
                properties: [
                    { name: 'build:tool', value: 'conan' },
                    { name: 'build:purpose', value: 'package_manager' }
                ]
            });
        }
        
        if (hasVcpkgJson) {
            buildTools.push({
                name: 'vcpkg',
                version: 'unknown',
                type: 'package_manager',
                scope: 'build',
                purl: 'pkg:generic/vcpkg@unknown',
                properties: [
                    { name: 'build:tool', value: 'vcpkg' },
                    { name: 'build:purpose', value: 'package_manager' }
                ]
            });
        }
        
        if (hasMesonBuild) {
            buildTools.push({
                name: 'meson',
                version: 'unknown',
                type: 'build_system',
                scope: 'build',
                purl: 'pkg:generic/meson@unknown',
                properties: [
                    { name: 'build:tool', value: 'meson' },
                    { name: 'build:purpose', value: 'build_system' }
                ]
            });
        }
        
        if (hasConfigureAc) {
            buildTools.push({
                name: 'autotools',
                version: 'unknown',
                type: 'build_system',
                scope: 'build',
                purl: 'pkg:generic/autotools@unknown',
                properties: [
                    { name: 'build:tool', value: 'autoconf' },
                    { name: 'build:tool2', value: 'automake' },
                    { name: 'build:purpose', value: 'build_system' }
                ]
            });
        }
        
        for (const tool of buildTools) {
            const added = this.addComponent(tool);
            if (added && addedRoot["bom-ref"]) {
                this.addDependency(addedRoot["bom-ref"], added["bom-ref"]);
                if (!this.scanMetadata.packagesByManager['build-tools']) {
                    this.scanMetadata.packagesByManager['build-tools'] = { count: 0 };
                }
                this.scanMetadata.packagesByManager['build-tools'].count++;
            }
        }
        
        return buildTools;
    }

    // ==================== УЯЗВИМОСТИ ====================

    async checkVulnerabilitiesOSV() {
        const vulnerabilities = [];
        const components = Array.from(this.componentMap.values()).filter(c => 
            c && !c.properties?.some(p => p.name === 'src:type' && p.value === 'root')
        );
        
        const componentsByEcosystem = {};
        
        for (const component of components) {
            if (!component || !component.purl) continue;
            
            let ecosystem = 'npm';
            if (component.purl.includes('pkg:pypi')) ecosystem = 'PyPI';
            else if (component.purl.includes('pkg:maven')) ecosystem = 'Maven';
            else if (component.purl.includes('pkg:golang')) ecosystem = 'Go';
            else if (component.purl.includes('pkg:cargo')) ecosystem = 'crates.io';
            else if (component.purl.includes('pkg:gem')) ecosystem = 'RubyGems';
            else if (component.purl.includes('pkg:composer')) ecosystem = 'Packagist';
            else if (component.purl.includes('pkg:nuget')) ecosystem = 'NuGet';
            
            if (!componentsByEcosystem[ecosystem]) {
                componentsByEcosystem[ecosystem] = [];
            }
            
            componentsByEcosystem[ecosystem].push({
                package: {
                    name: component.name || 'unknown',
                    version: component.version || 'latest',
                    ecosystem: ecosystem
                },
                component: component
            });
        }
        
        for (const [ecosystem, pkgs] of Object.entries(componentsByEcosystem)) {
            for (let i = 0; i < pkgs.length; i += 100) {
                const batch = pkgs.slice(i, i + 100);
                
                const query = {
                    queries: batch.map(p => ({
                        package: {
                            name: p.package.name,
                            ecosystem: ecosystem
                        },
                        version: p.package.version
                    }))
                };
                
                try {
                    const response = await this.makeRequest('api.osv.dev', '/v1/querybatch', 'POST', JSON.stringify(query),{ 'Content-Type': 'application/json' });

                    if (response && response.results) {
                        for (let j = 0; j < response.results.length; j++) {
                            const result = response.results[j];
                            const pkgInfo = batch[j];
                            if (result && result.vulns && result.vulns.length > 0 && pkgInfo && pkgInfo.component) {
                                for (const vuln of result.vulns) {
                                    let details = await this.getDetails(vuln.id)
                                    vulnerabilities.push({
                                        bomRef: pkgInfo.component.purl,
                                        vulnerability: {
                                            id: vuln.id,
                                            componentName: pkgInfo.component.name,
                                            componentVersion: pkgInfo.component.version,
                                            source: {
                                                name: "OSV",
                                                url: `https://osv.dev/vulnerability/${vuln.id}`
                                            },
                                            description: details.summary,
                                            published: vuln.published,
                                            updated: vuln.modified,
                                            severity: details.severity,
                                            affects: [
                                                {
                                                    ref: pkgInfo.component["bom-ref"],
                                                    versions: [pkgInfo.package.version]
                                                }
                                            ]
                                        }
                                    });
                                }
                            }
                        }
                    }
                } catch (error) {}
            }
        }
        
        return vulnerabilities;
    }

    async getDetails(vulnId) {
        let vuln = await this.makeRequest('api.osv.dev', `/v1/vulns/${encodeURIComponent(vulnId)}`, 'GET')
        return {
            severity: vuln.database_specific?.severity || 'UNKNOWN',
            summary: vuln.summary || ''
        }
    }

    getSeverityScore(severity) {
        const scores = {
            'CRITICAL': 9.5,
            'HIGH': 7.5,
            'MODERATE': 5.0,
            'LOW': 2.5,
            'UNKNOWN': 0.0
        };
        return scores[severity] || 0.0;
    }

    getComponentNameByRef(ref, components) {
        const component = components.find(c => c["bom-ref"] === ref);
        return component ? component.name : 'unknown';
    }

    getComponentVersionByRef(ref, components) {
        const component = components.find(c => c["bom-ref"] === ref);
        return component ? component.version : 'unknown';
    }

    calculateRiskLevel(stats) {
        if (stats.critical > 0) return 'CRITICAL';
        if (stats.high > 0) return 'HIGH';
        if (stats.medium > 0) return 'MEDIUM';
        if (stats.low > 0) return 'LOW';
        return 'NONE';
    }

    generateCycloneDXRecommendations(vulnerabilityStats, vulnerabilities) {
        const recommendations = [];
        
        if (vulnerabilityStats.critical > 0) {
            recommendations.push(`Critical: Immediately update ${vulnerabilityStats.critical} components with critical vulnerabilities`);
        }
        
        if (vulnerabilityStats.high > 0) {
            recommendations.push(`High: Schedule updates for ${vulnerabilityStats.high} components with high severity vulnerabilities in the next sprint`);
        }
        
        if (vulnerabilityStats.medium > 0) {
            recommendations.push(`Medium: Plan updates for ${vulnerabilityStats.medium} components with medium severity vulnerabilities in upcoming releases`);
        }
        
        if (vulnerabilityStats.low > 0) {
            recommendations.push(`Low: Monitor ${vulnerabilityStats.low} components with low severity vulnerabilities`);
        }
        
        if (vulnerabilities.length > 0) {
            recommendations.push(`Total: ${vulnerabilities.length} vulnerabilities found across ${new Set(vulnerabilities.map(v => v.bomRef)).size} components`);
        } else {
            recommendations.push('No vulnerabilities found - dependency hygiene is good');
        }
        
        return recommendations;
    }

    buildDependencyGraph() {
        const dependencies = [];
        
        for (const [from, toSet] of this.dependencyGraph.entries()) {
            if (from) {
                dependencies.push({
                    ref: from,
                    dependsOn: Array.from(toSet).filter(ref => ref)
                });
            }
        }
        
        return dependencies;
    }

    // ==================== ГЕНЕРАЦИЯ SBOM ====================

    async generateSBOM() {
        try {
            const rootComponent = this.getOrCreateRootComponent();
            const packageManagers = await this.detectPackageManagers();
            
            const analyzers = {
                'npm': this.analyzeNPM.bind(this),
                'yarn': this.analyzeYarn.bind(this),
                'pnpm': this.analyzePnpm.bind(this),
                'pip': this.analyzePip.bind(this),
                'go': this.analyzeGo.bind(this),
                'maven': this.analyzeMaven.bind(this),
                'gradle': this.analyzeGradle.bind(this),
                'composer': this.analyzeComposer.bind(this),
                'gem': this.analyzeGem.bind(this),
                'cargo': this.analyzeCargo.bind(this),
                'cmake': this.analyzeCMake.bind(this),
                'conan': this.analyzeConan.bind(this),
                'vcpkg': this.analyzeVcpkg.bind(this),
                'meson': this.analyzeMeson.bind(this),
                'make': this.analyzeMake.bind(this)
            };
            
            for (const manager of packageManagers) {
                if (analyzers[manager]) {
                    await analyzers[manager]();
                }
            }
            
            // Анализ C/C++ зависимостей
            await this.analyzeCppDeps();
            
            // Анализ build-time зависимостей
            await this.analyzeBuildDependencies();
            
            const allComponents = Array.from(this.componentMap.values()).filter(c => c);
            const rootBomRef = rootComponent["bom-ref"];
            const libraries = allComponents.filter(c => c["bom-ref"] !== rootBomRef);
            
            const rootComponents = allComponents.filter(c => 
                c && c.properties?.some(p => p.name === 'src:type' && (p.value === 'root' || p.value === 'package'))
            );
            
            const dependencies = this.buildDependencyGraph();
            const vulnerabilities = await this.checkVulnerabilitiesOSV();
            
            const licenseAnalyzer = new LicenseAnalyzer(this.options?.licensePolicies);
            const licenseAnalysis = licenseAnalyzer.analyzeComponents(
                allComponents, 
                this.options?.projectType || 'open_source'
            );
            
            const vulnerabilityStats = {
                total: vulnerabilities.length,
                critical: vulnerabilities.filter(v => v.vulnerability?.severity === 'CRITICAL').length,
                high: vulnerabilities.filter(v => v.vulnerability?.severity === 'HIGH').length,
                medium: vulnerabilities.filter(v => v.vulnerability?.severity === 'MODERATE').length,
                low: vulnerabilities.filter(v => v.vulnerability?.severity === 'LOW').length,
                unknown: vulnerabilities.filter(v => v.vulnerability?.severity === 'UNKNOWN').length
            };
            
            const sbom = {
                $schema: "http://cyclonedx.org/schema/bom-1.6.schema.json",
                bomFormat: "CycloneDX",
                specVersion: "1.6",
                version: 1,
                serialNumber: `urn:uuid:${this.generateUUID()}`,
                metadata: {
                    timestamp: new Date().toISOString(),
                    tools: [
                        {
                            vendor: "Hercules Security",
                            name: "SCA Module",
                            version: "1.0.0",
                            properties: [
                                { name: "scanner:type", value: "SCA" },
                                { name: "scanner:capabilities", value: "vulnerability-scanning, dependency-analysis, license-scanning" }
                            ]
                        }
                    ],
                    component: rootComponent,
                    properties: []
                },
                components: [],
                dependencies: dependencies || [],
                annotations: []
            };
            
            // Добавляем компоненты с лицензиями
            sbom.components = libraries.map(c => {
                const licenseInfo = licenseAnalysis.components.find(
                    comp => comp.name === c.name && comp.version === c.version
                );
                
                const component = {
                    type: c.type || "library",
                    name: c.name || "unknown",
                    version: c.version || "latest",
                    "bom-ref": c["bom-ref"] || this.generateBomRef(c.name, c.version),
                    purl: c.purl || "",
                    properties: (c.properties || []).map(p => ({
                        name: p.name,
                        value: p.value
                    }))
                };
                
                if (licenseInfo && licenseInfo.normalizedLicense !== 'NOASSERTION') {
                    component.licenses = [{
                        license: {
                            id: licenseInfo.normalizedLicense !== 'NOASSERTION' ? licenseInfo.normalizedLicense : undefined,
                            name: licenseInfo.license,
                            url: this.getLicenseUrl(licenseInfo.normalizedLicense)
                        }
                    }];
                    
                    if (!component.properties) component.properties = [];
                    component.properties.push(
                        { name: "license:risk", value: licenseInfo.risk || "UNKNOWN" },
                        { name: "license:commercial", value: String(licenseInfo.commercial !== false) },
                        { name: "license:attribution", value: String(licenseInfo.requiresAttribution || false) },
                        { name: "license:disclosure", value: String(licenseInfo.requiresSourceDisclosure || false) }
                    );
                    
                    if (licenseInfo.violations && licenseInfo.violations.length > 0) {
                        component.properties.push({
                            name: "license:violation",
                            value: licenseInfo.violations.join(", ")
                        });
                    }
                } else if (licenseInfo && licenseInfo.normalizedLicense === 'NOASSERTION') {
                    component.licenses = [{
                        license: {
                            name: "Unknown license"
                        }
                    }];
                    if (!component.properties) component.properties = [];
                    component.properties.push({
                        name: "license:warning",
                        value: "License not specified - requires legal review"
                    });
                }
                
                return component;
            });
            
            // Добавляем метаданные лицензий
            sbom.metadata.properties.push(
                { name: 'license:total', value: String(licenseAnalysis.summary.total) },
                { name: 'license:violations', value: String(licenseAnalysis.violations.length) },
                { name: 'license:critical', value: String(licenseAnalysis.summary.critical) },
                { name: 'license:high', value: String(licenseAnalysis.summary.high) },
                { name: 'license:medium', value: String(licenseAnalysis.summary.medium) },
                { name: 'license:low', value: String(licenseAnalysis.summary.low) },
                { name: 'license:recommendations', value: licenseAnalysis.recommendations.join('; ') }
            );
            
            for (const rec of licenseAnalysis.recommendations) {
                sbom.annotations.push({
                    "bom-ref": `license-rec-${Date.now()}-${Math.random()}`,
                    subjects: [],
                    text: `[LICENSE] ${rec}`,
                    timestamp: new Date().toISOString()
                });
            }
            
            const criticalViolations = licenseAnalysis.violations.filter(v => v.severity === 'CRITICAL');
            for (const violation of criticalViolations) {
                sbom.annotations.push({
                    "bom-ref": `license-critical-${Date.now()}-${Math.random()}`,
                    subjects: [],
                    text: `[LICENSE] ${violation.severity}: ${violation.message} (${violation.component} ${violation.version})`,
                    timestamp: new Date().toISOString()
                });
            }
            
            const metadataProps = [
                { name: "scan:summary:totalComponents", value: String(allComponents.length) },
                { name: "scan:summary:totalLibraries", value: String(libraries.length) },
                { name: "scan:summary:totalRootComponents", value: String(rootComponents.length) },
                { name: "scan:summary:totalDependencies", value: String(dependencies.length) },
                { name: "scan:summary:totalVulnerabilities", value: String(vulnerabilityStats.total) },
                { name: "scan:summary:vulnerabilities:critical", value: String(vulnerabilityStats.critical) },
                { name: "scan:summary:vulnerabilities:high", value: String(vulnerabilityStats.high) },
                { name: "scan:summary:vulnerabilities:medium", value: String(vulnerabilityStats.medium) },
                { name: "scan:summary:vulnerabilities:low", value: String(vulnerabilityStats.low) },
                { name: "scan:summary:vulnerabilities:unknown", value: String(vulnerabilityStats.unknown) }
            ];
            
            for (const [manager, data] of Object.entries(this.scanMetadata.packagesByManager)) {
                metadataProps.push({
                    name: `scan:packages:${manager}`,
                    value: String(data.count || 0)
                });
            }
            
            const riskLevel = this.calculateRiskLevel(vulnerabilityStats);
            metadataProps.push({ name: "scan:risk:level", value: riskLevel });
            
            sbom.metadata.properties.push(...metadataProps);
            
            if (vulnerabilities && vulnerabilities.length > 0) {
                sbom.vulnerabilities = vulnerabilities.map(v => ({
                    "bom-ref": v.bomRef,
                    component: {
                        name: v.vulnerability.componentName,
                        version: v.vulnerability.componentVersion
                    },
                    id: v.vulnerability.id,
                    description: v.vulnerability.description,
                    severity: v.vulnerability.severity,
                    source: {
                        name: v.vulnerability.source.name,
                        url: v.vulnerability.source.url
                    },
                    published: v.vulnerability.published,
                    updated: v.vulnerability.updated,
                    analysis: { state: "in_triage", detail: '' },
                    affects: [{
                        ref: v.bomRef,
                        versions: [{ version: v.vulnerability.affects?.[0]?.versions?.[0] || "unknown" }]
                    }],
                    ratings: [{
                        source: { name: v.vulnerability.source.name, url: v.vulnerability.source.url },
                        score: this.getSeverityScore(v.vulnerability.severity),
                        severity: v.vulnerability.severity || "UNKNOWN",
                        method: "CVSSv3"
                    }]
                }));
            }
            
            const recommendations = this.generateCycloneDXRecommendations(vulnerabilityStats, vulnerabilities);
            if (recommendations && recommendations.length > 0) {
                const subjects = vulnerabilities?.map(v => v?.bomRef).filter(Boolean) || [];
                recommendations.forEach((rec, index) => {
                    sbom.annotations.push({
                        "bom-ref": `vuln-rec-${index + 1}`,
                        subjects: subjects,
                        text: `[VULNERABILITY] ${rec}`,
                        timestamp: new Date().toISOString()
                    });
                });
            }
            
            return sbom;
            
        } catch (error) {
            console.error('Ошибка генерации SBOM:', error);
            throw error;
        }
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

// ==================== ЛОКАЛЬНЫЙ АНАЛИЗАТОР ====================

class LocalSBOMAnalyzer extends BaseSBOMAnalyzer {
    constructor(localPath, options = {}) {
        const cleanPath = localPath.replace('file://', '');
        super(cleanPath, options);
        this.localPath = cleanPath;
        this.repoInfo = {
            owner: 'local',
            repo: path.basename(cleanPath),
            baseUrl: 'file'
        };
        this.tempDir = cleanPath;
    }

    async makeRequest(hostname, path, method = 'GET', body = null, headers = {}) {
        const url = `https://${hostname}${path}`;
        try {
            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: body
            });
            return await response.json();
        } catch (error) {
            return {};
        }
    }

    async getRepositoryContents(relativePath = '') {
        const targetPath = path.join(this.localPath, relativePath);
        const results = [];
        
        try {
            const entries = await fs.readdir(targetPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const entryPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
                const fullPath = path.join(targetPath, entry.name);
                
                if (entry.isDirectory()) {
                    results.push({
                        name: entry.name,
                        path: entryPath,
                        type: 'tree'
                    });
                } else {
                    const stats = await fs.stat(fullPath);
                    results.push({
                        name: entry.name,
                        path: entryPath,
                        type: 'blob',
                        size: stats.size
                    });
                }
            }
        } catch (error) {}
        
        return results;
    }

    async getFileContent(fileInfo) {
        if (!fileInfo || !fileInfo.path) {
            return null;
        }
        
        const cacheKey = `file:${fileInfo.path}`;
        if (this.fileContentsCache.has(cacheKey)) {
            return this.fileContentsCache.get(cacheKey);
        }
        
        try {
            const fullPath = path.join(this.localPath, fileInfo.path);
            const content = await fs.readFile(fullPath, 'utf-8');
            this.fileContentsCache.set(cacheKey, content);
            return content;
        } catch (error) {
            return null;
        }
    }

    async getDefaultBranch() {
        return 'local';
    }

    async getAllFilesRecursive(dirPath = '', depth = 0, collected = null) {
        if (!collected) {
            collected = [];
        }

        if (depth > this.maxDepth) {
            return collected;
        }

        if (this.shouldExcludeDir(dirPath)) {
            return collected;
        }
        
        try {
            const fullPath = path.join(this.localPath, dirPath);
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const entryPath = dirPath ? path.join(dirPath, entry.name) : entry.name;
                
                if (entry.isDirectory()) {
                    await this.getAllFilesRecursive(entryPath, depth + 1, collected);
                } else {
                    const stats = await fs.stat(path.join(fullPath, entry.name));
                    collected.push({
                        name: entry.name,
                        path: entryPath,
                        type: 'blob',
                        size: stats.size
                    });
                }
            }
        } catch (error) {}
        
        return collected;
    }
}

// ==================== GITHUB АНАЛИЗАТОР ====================

class GitHubSBOMAnalyzer extends BaseSBOMAnalyzer {
    constructor(repoUrl, options = {}) {
        super(repoUrl, options);
        this.githubToken = options.githubToken || process.env.GITHUB_TOKEN;
        this.repoInfo = GitHubSBOMAnalyzer.parseGitHubUrl(repoUrl);
        this.apiBase = 'https://api.github.com';
        
        if (!this.githubToken) {
            console.warn('GITHUB_TOKEN не найден. Анализ будет медленным из-за ограничений API.');
        }
    }

    static parseGitHubUrl(url) {
        const trimmedUrl = url.trim().replace(/\.git$/, '');
        let match;
        
        match = trimmedUrl.match(/https?:\/\/(www\.)?github\.com[:\/]([^\/]+)\/([^\/\.]+)/);
        if (match) {
            return {
                owner: match[2],
                repo: match[3],
                baseUrl: 'https://github.com'
            };
        }
        
        match = trimmedUrl.match(/github\.com[:\/]([^\/]+)\/([^\/\.]+)/);
        if (match) {
            return {
                owner: match[1],
                repo: match[2],
                baseUrl: 'https://github.com'
            };
        }
        
        match = trimmedUrl.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
        if (match) {
            return {
                owner: match[1],
                repo: match[2],
                baseUrl: 'https://github.com'
            };
        }
        
        throw new Error('Неверный формат URL GitHub репозитория');
    }

    async makeRequest(hostname, path, method = 'GET', body = null, headers = {}) {
        const options = {
            hostname: hostname,
            path: path,
            method: method,
            headers: {
                'User-Agent': 'Hercules-SCA-Analyzer/1.0',
                'Accept': 'application/vnd.github.v3+json',
                ...headers
            }
        };

        if (this.githubToken) {
            options.headers['Authorization'] = `token ${this.githubToken}`;
        }

        if (body) {
            options.headers['Content-Type'] = 'application/json';
        }

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    const rateLimit = {
                        limit: res.headers['x-ratelimit-limit'],
                        remaining: res.headers['x-ratelimit-remaining'],
                        reset: res.headers['x-ratelimit-reset']
                    };

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            if (!data.trim()) {
                                resolve({});
                                return;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                resolve(parsed);
                            } catch (e) {
                                resolve(data);
                            }
                        } catch (e) {
                            reject(new Error(`Ошибка парсинга ответа: ${e.message}`));
                        }
                    } else if (res.statusCode === 403) {
                        if (rateLimit.remaining === '0') {
                            const resetTime = new Date(rateLimit.reset * 1000);
                            reject(new Error(`Превышен лимит запросов к GitHub API. Сброс в ${resetTime.toLocaleString()}`));
                        } else {
                            let errorMsg = `Доступ запрещен (403)`;
                            try {
                                const errorData = JSON.parse(data);
                                errorMsg = errorData.message || errorMsg;
                            } catch (e) {}
                            reject(new Error(`GitHub API: ${errorMsg}. Проверьте токен и права доступа.`));
                        }
                    } else if (res.statusCode === 404) {
                        reject(new Error(`Ресурс не найден: ${path}`));
                    } else if (res.statusCode === 401) {
                        reject(new Error(`Неавторизован (401). Проверьте GITHUB_TOKEN`));
                    } else {
                        let errorMsg = `HTTP ${res.statusCode}: ${res.statusMessage}`;
                        try {
                            if (data.trim()) {
                                const errorData = JSON.parse(data);
                                errorMsg = errorData.message || errorMsg;
                            }
                        } catch (e) {}
                        reject(new Error(errorMsg));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`Сетевая ошибка: ${error.message}`));
            });
            
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Таймаут запроса (30 секунд)'));
            });
            
            if (body) {
                req.write(body);
            }
            req.end();
        });
    }

    async getRepositoryContents(path = '') {
        try {
            const encodedPath = path ? `/${encodeURIComponent(path)}` : '';
            const contentsPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/contents${encodedPath}`;
            const contents = await this.makeRequest('api.github.com', contentsPath);
            
            if (!Array.isArray(contents)) {
                return contents ? [contents] : [];
            }
            return contents;
        } catch (error) {
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                return [];
            }
            throw error;
        }
    }

    async getFileContent(fileInfo) {
        if (!fileInfo || fileInfo.type !== 'file' || !fileInfo.download_url) {
            return null;
        }
        
        const cacheKey = `file:${fileInfo.download_url}`;
        if (this.fileContentsCache.has(cacheKey)) {
            return this.fileContentsCache.get(cacheKey);
        }
        
        return new Promise((resolve, reject) => {
            const options = {};
            if (this.githubToken) {
                options.headers = { 'Authorization': `token ${this.githubToken}` };
            }
            
            https.get(fileInfo.download_url, options, (res) => {
                if (res.statusCode !== 200) {
                    resolve(null);
                    return;
                }
                
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    this.fileContentsCache.set(cacheKey, data);
                    resolve(data);
                });
            }).on('error', () => {
                resolve(null);
            });
        });
    }

    async getDefaultBranch() {
        try {
            const repoInfo = await this.makeRequest('api.github.com', `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}`);
            return repoInfo.default_branch || 'main';
        } catch (error) {
            return 'main';
        }
    }
}

// ==================== GITLAB АНАЛИЗАТОР ====================

class GitLabSBOMAnalyzer extends BaseSBOMAnalyzer {
    constructor(repoUrl, options = {}) {
        super(repoUrl, options);
        this.gitlabToken = options.gitlabToken || process.env.GITLAB_TOKEN;
        this.repoInfo = GitLabSBOMAnalyzer.parseGitLabUrl(repoUrl);
        this.defaultBranch = null;
        
        if (!this.gitlabToken) {
            console.warn('GITLAB_TOKEN не найден. Анализ будет медленным из-за ограничений API.');
        }
    }

    static parseGitLabUrl(url) {
        const trimmedUrl = url.trim().replace(/\.git$/, '');
        
        let match = trimmedUrl.match(/^(https?:\/\/[^\/]+)\/(.+)$/);
        if (match) {
            return {
                baseUrl: match[1],
                projectPath: match[2],
                fullPath: match[2]
            };
        }
        
        match = trimmedUrl.match(/^([^\/]+)\/(.+)$/);
        if (match) {
            return {
                baseUrl: `https://${match[1]}`,
                projectPath: match[2],
                fullPath: match[2]
            };
        }
        
        throw new Error('Неверный формат URL GitLab репозитория');
    }

    getProjectId() {
        return encodeURIComponent(this.repoInfo.projectPath);
    }

    async makeGitLabRequest(endpoint, method = 'GET', body = null) {
        const baseUrl = this.repoInfo.baseUrl || 'https://gitlab.com';
        const apiUrl = `${baseUrl}/api/v4${endpoint}`;
        
        const options = {
            method: method,
            headers: {
                'User-Agent': 'Hercules-SCA-Analyzer/1.0',
                'Accept': 'application/json',
                ...(this.gitlabToken && { 'PRIVATE-TOKEN': this.gitlabToken })
            }
        };

        if (body) {
            options.headers['Content-Type'] = 'application/json';
        }

        return new Promise((resolve, reject) => {
            const urlObj = new URL(apiUrl);
            const protocol = urlObj.protocol === 'https:' ? https : http;
            
            const reqOptions = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: options.headers
            };
            
            const req = protocol.request(reqOptions, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            resolve(data);
                        }
                    } else if (res.statusCode === 403) {
                        reject(new Error(`Доступ запрещен (403). Проверьте токен GitLab.`));
                    } else if (res.statusCode === 404) {
                        reject(new Error(`Ресурс не найден: ${endpoint}`));
                    } else {
                        let errorMsg = `GitLab API HTTP ${res.statusCode}`;
                        try {
                            if (data) {
                                const errorData = JSON.parse(data);
                                errorMsg = errorData.message || errorMsg;
                            }
                        } catch (e) {}
                        reject(new Error(errorMsg));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`Сетевая ошибка: ${error.message}`));
            });
            
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Таймаут запроса к GitLab API'));
            });
            
            if (body) {
                req.write(body);
            }
            req.end();
        });
    }

    async makeRequest(hostname, path, method = 'GET', body = null, headers = {}) {
        return this.makeGitLabRequest(path, method, body);
    }

    async getDefaultBranch() {
        try {
            const projectId = this.getProjectId();
            const project = await this.makeGitLabRequest(`/projects/${projectId}`);
            return project.default_branch || 'main';
        } catch (error) {
            return 'main';
        }
    }

    async getRepositoryContents(path = '') {
        try {
            if (!this.defaultBranch) {
                this.defaultBranch = await this.getDefaultBranch();
            }
            
            const projectId = this.getProjectId();
            let endpoint = `/projects/${projectId}/repository/tree?ref=${this.defaultBranch}&per_page=100`;
            
            if (path) {
                endpoint += `&path=${encodeURIComponent(path)}`;
            }
            
            const contents = await this.makeGitLabRequest(endpoint);
            
            if (!contents || !Array.isArray(contents)) {
                return [];
            }
            
            return contents.map(item => ({
                name: item.name,
                path: item.path,
                type: item.type,
                download_url: item.type === 'blob' ? 
                    `${this.repoInfo.baseUrl}/${this.repoInfo.projectPath}/-/raw/${this.defaultBranch}/${item.path}` : 
                    null
            }));
        } catch (error) {
            if (error.message.includes('404') || error.message.includes('не найден')) {
                return [];
            }
            return [];
        }
    }

    async getFileContent(fileInfo) {
        if (!fileInfo || fileInfo.type !== 'blob' || !fileInfo.download_url) {
            return null;
        }
        
        const cacheKey = `file:${fileInfo.download_url}`;
        if (this.fileContentsCache.has(cacheKey)) {
            return this.fileContentsCache.get(cacheKey);
        }
        
        return new Promise((resolve) => {
            const options = {};
            if (this.gitlabToken) {
                options.headers = { 'PRIVATE-TOKEN': this.gitlabToken };
            }
            
            https.get(fileInfo.download_url, options, (res) => {
                if (res.statusCode !== 200) {
                    resolve(null);
                    return;
                }
                
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    this.fileContentsCache.set(cacheKey, data);
                    resolve(data);
                });
            }).on('error', () => {
                resolve(null);
            }).setTimeout(10000, function() {
                this.destroy();
                resolve(null);
            });
        });
    }
}

// ==================== ФАБРИЧНАЯ ФУНКЦИЯ ====================

function createAnalyzer(repoUrl, options = {}) {
    if (!repoUrl) {
        throw new Error('URL репозитория не указан');
    }

    const urlLower = repoUrl.toLowerCase();
    
    if (repoUrl.startsWith('file://') || repoUrl.startsWith('/') || repoUrl.match(/^[A-Za-z]:\\/)) {
        return new LocalSBOMAnalyzer(repoUrl, options);
    }
    
    if (urlLower.includes('github.com')) {
        return new GitHubSBOMAnalyzer(repoUrl, options);
    }
    
    if (urlLower.includes('gitlab.com')) {
        return new GitLabSBOMAnalyzer(repoUrl, options);
    }
    
    if (repoUrl.match(/https?:\/\/[^\/]+\/[^\/]+\/[^\/]+/)) {
        return new GitLabSBOMAnalyzer(repoUrl, options);
    }
    
    if (repoUrl.match(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/)) {
        if (process.env.GITLAB_TOKEN && !process.env.GITHUB_TOKEN) {
            return new GitLabSBOMAnalyzer(repoUrl, options);
        }
        return new GitHubSBOMAnalyzer(repoUrl, options);
    }
    
    throw new Error('Не удалось определить тип репозитория');
}

// ==================== ФУНКЦИИ ЗАПУСКА ====================

export async function analyzeRepository(repoUrl, outputName = null, options = {}) {
    let analyzer = null;
    
    try {
        analyzer = createAnalyzer(repoUrl, options);
        const sbom = await analyzer.generateSBOM();
        return sbom;
    } catch (error) {
        console.error('\nОшибка анализа:', error.message);
        throw error;
    } finally {
        if (analyzer && analyzer.cleanupTempDir) {
            await analyzer.cleanupTempDir();
        }
    }
}

export { GitHubSBOMAnalyzer, GitLabSBOMAnalyzer, LocalSBOMAnalyzer, createAnalyzer };