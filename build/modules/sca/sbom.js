import fs from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

class SbomGenerator {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.sbomFormat = 'CycloneDX';
    this.sbomVersion = '1.6';
    this.includeTransitiveDeps = options.includeTransitiveDeps !== false;
    this.toolName = options.toolName || 'Hercules-SBOM-Generator';
    this.toolVersion = options.toolVersion || '2.1.0';
    this.maxDepth = options.maxDepth || 10;
  }

  async generateSbom(downloadPath, repoInfo, downloadResult) {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Генерация CycloneDX SBOM для проекта: ${downloadPath}`);
      
      // 1. Собираем информацию о проекте (сканируем все поддиректории)
      const projectInfo = await this.scanProjectInfo(downloadPath);
      
      // 2. Создаем SBOM в формате CycloneDX 1.6
      const sbom = this.createCycloneDxSbom(repoInfo, projectInfo, downloadResult);
      
      // 3. Сохраняем файл
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sbomPath = join(downloadPath, `sbom-cyclonedx-${timestamp}.json`);
      await fs.writeFile(sbomPath, JSON.stringify(sbom, null, 2), 'utf8');
      
      const generationTime = Date.now() - startTime;
      this.logger.info(`SBOM сохранен: ${sbomPath}`);
      this.logger.info(`Время генерации: ${generationTime}ms`);
      
      return {
        sbom,
        filePath: sbomPath,
        componentsCount: sbom.components ? sbom.components.length : 0,
        dependenciesCount: projectInfo.allDependencies ? projectInfo.allDependencies.length : 0,
        generationTime,
        format: this.sbomFormat,
        version: this.sbomVersion
      };
      
    } catch (error) {
      this.logger.error('Ошибка генерации SBOM:', error);
      throw error;
    }
  }

  async scanProjectInfo(directory) {
    const info = {
      packageManagers: new Set(),
      directDependencies: [],
      files: [],
      packageFiles: [],
      languages: new Set(),
      license: null,
      projectType: 'application',
      metadata: {},
      rootPath: directory
    };
    
    try {
      // Сканируем файлы проекта (включая поддиректории)
      await this.scanDirectory(directory, directory, info, 0);
      
      // Определяем тип проекта по найденным файлам
      this.determineProjectType(info);
      
      // Анализируем зависимости из всех найденных файлов пакетов
      await this.analyzeAllDependencies(info);
      
      // Если найдены package.json в поддиректориях, добавляем их как подкомпоненты
      this.processSubprojects(info);
      
    } catch (error) {
      this.logger.warn('Ошибка сканирования проекта:', error.message);
    }
    
    return info;
  }

  async scanDirectory(currentDir, baseDir, info, depth) {
    if (depth > this.maxDepth) {
      return;
    }
    
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relativePath = fullPath.replace(baseDir, '').replace(/^[\\/]/, '');
        
        if (entry.isDirectory()) {
          // Пропускаем системные и временные директории
          if (this.shouldSkipDirectory(entry.name)) {
            continue;
          }
          await this.scanDirectory(fullPath, baseDir, info, depth + 1);
        } else {
          // Анализируем файлы
          await this.analyzeFile(entry, fullPath, relativePath, baseDir, info);
        }
      }
    } catch (error) {
      // Игнорируем ошибки доступа к каталогам
    }
  }

  shouldSkipDirectory(dirName) {
    const skipDirs = [
      'node_modules', '.git', '.idea', '.vscode', '.github',
      'vendor', '__pycache__', '.pytest_cache', '.mypy_cache',
      'target', 'build', 'dist', '.gradle', '.mvn',
      'coverage', '.nyc_output', 'tmp', 'temp', '.next',
      '.nuxt', '.output', 'out', '.svelte-kit', '.astro',
      'bin', 'obj', '.vs', '.history', '.cache',
      'logs', '.terraform', '.serverless', '.elasticbeanstalk'
    ];
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  async analyzeFile(entry, fullPath, relativePath, baseDir, info) {
    const fileInfo = {
      path: relativePath,
      name: entry.name,
      size: (await fs.stat(fullPath)).size,
      fullPath: fullPath
    };
    
    info.files.push(fileInfo);
    
    // Определяем язык по расширению файла
    this.detectLanguage(entry.name, info);
    
    // Проверяем файлы менеджеров пакетов
    if (this.isPackageManagerFile(entry.name)) {
      const packageInfo = await this.detectPackageManager(entry.name, fullPath, relativePath);
      if (packageInfo) {
        info.packageFiles.push(packageInfo);
        info.packageManagers.add(packageInfo.managerInfo);
      }
    }
    
    // Проверяем лицензию
    if (this.isLicenseFile(entry.name)) {
      info.license = await this.parseLicenseFile(fullPath);
    }
  }

  isPackageManagerFile(filename) {
    const packageFiles = [
      'package.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'package-lock.json',
      'requirements.txt',
      'pyproject.toml',
      'Pipfile',
      'Pipfile.lock',
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
      'go.mod',
      'go.sum',
      'Cargo.toml',
      'Cargo.lock',
      'Gemfile',
      'Gemfile.lock',
      'composer.json',
      'composer.lock',
      'pubspec.yaml',
      'pubspec.lock',
      'Podfile',
      'Podfile.lock',
      'mix.exs',
      'mix.lock',
      '*.csproj',
      '*.vbproj',
      '*.fsproj',
      '*.vcxproj',
      'project.json',
      '*.nuspec',
      '*.sln'
    ];
    
    return packageFiles.some(pattern => {
      if (pattern.startsWith('*')) {
        return filename.endsWith(pattern.substring(1));
      }
      return filename === pattern;
    });
  }

  async detectPackageManager(filename, filepath, relativePath) {
    const packageManagers = {
      'package.json': { manager: 'npm', ecosystem: 'npm', type: 'manifest' },
      'yarn.lock': { manager: 'yarn', ecosystem: 'npm', type: 'lock' },
      'pnpm-lock.yaml': { manager: 'pnpm', ecosystem: 'npm', type: 'lock' },
      'package-lock.json': { manager: 'npm', ecosystem: 'npm', type: 'lock' },
      'requirements.txt': { manager: 'pip', ecosystem: 'pypi', type: 'manifest' },
      'pyproject.toml': { manager: 'poetry', ecosystem: 'pypi', type: 'manifest' },
      'Pipfile': { manager: 'pipenv', ecosystem: 'pypi', type: 'manifest' },
      'Pipfile.lock': { manager: 'pipenv', ecosystem: 'pypi', type: 'lock' },
      'pom.xml': { manager: 'maven', ecosystem: 'maven', type: 'manifest' },
      'build.gradle': { manager: 'gradle', ecosystem: 'maven', type: 'manifest' },
      'build.gradle.kts': { manager: 'gradle', ecosystem: 'maven', type: 'manifest' },
      'go.mod': { manager: 'go', ecosystem: 'golang', type: 'manifest' },
      'go.sum': { manager: 'go', ecosystem: 'golang', type: 'lock' },
      'Cargo.toml': { manager: 'cargo', ecosystem: 'cargo', type: 'manifest' },
      'Cargo.lock': { manager: 'cargo', ecosystem: 'cargo', type: 'lock' },
      'Gemfile': { manager: 'rubygems', ecosystem: 'gem', type: 'manifest' },
      'Gemfile.lock': { manager: 'rubygems', ecosystem: 'gem', type: 'lock' },
      'composer.json': { manager: 'composer', ecosystem: 'composer', type: 'manifest' },
      'composer.lock': { manager: 'composer', ecosystem: 'composer', type: 'lock' },
      'pubspec.yaml': { manager: 'pub', ecosystem: 'pub', type: 'manifest' },
      'pubspec.lock': { manager: 'pub', ecosystem: 'pub', type: 'lock' },
      'Podfile': { manager: 'cocoapods', ecosystem: 'cocoapods', type: 'manifest' },
      'Podfile.lock': { manager: 'cocoapods', ecosystem: 'cocoapods', type: 'lock' },
      'mix.exs': { manager: 'hex', ecosystem: 'hex', type: 'manifest' },
      'mix.lock': { manager: 'hex', ecosystem: 'hex', type: 'lock' }
    };
    
    for (const [pattern, managerInfo] of Object.entries(packageManagers)) {
      if (pattern.startsWith('*')) {
        const suffix = pattern.substring(1);
        if (filename.endsWith(suffix)) {
          return {
            path: relativePath,
            fullPath: filepath,
            filename: filename,
            managerInfo: managerInfo,
            directory: filepath.substring(0, filepath.lastIndexOf('/'))
          };
        }
      } else if (filename === pattern) {
        return {
          path: relativePath,
          fullPath: filepath,
          filename: filename,
          managerInfo: managerInfo,
          directory: filepath.substring(0, filepath.lastIndexOf('/'))
        };
      }
    }
    
    return null;
  }

  detectLanguage(filename, info) {
    const languageMap = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.kt': 'Kotlin',
      '.kts': 'Kotlin',
      '.scala': 'Scala',
      '.c': 'C',
      '.cpp': 'C++',
      '.cc': 'C++',
      '.cxx': 'C++',
      '.cs': 'C#',
      '.go': 'Go',
      '.rs': 'Rust',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.dart': 'Dart',
      '.hs': 'Haskell',
      '.lua': 'Lua',
      '.pl': 'Perl',
      '.pm': 'Perl',
      '.r': 'R',
      '.sh': 'Shell',
      '.bash': 'Shell',
      '.zsh': 'Shell',
      '.ps1': 'PowerShell',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'CSS',
      '.sass': 'CSS',
      '.xml': 'XML',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.toml': 'TOML'
    };
    
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    if (languageMap[ext]) {
      info.languages.add(languageMap[ext]);
    }
  }

  determineProjectType(info) {
    const languages = Array.from(info.languages);
    const managers = Array.from(info.packageManagers);
    
    if (managers.length > 0) {
      const primaryManager = Array.from(managers)[0];
      info.primaryEcosystem = primaryManager.ecosystem;
      info.primaryPackageManager = primaryManager.manager;
    }
    
    // Если есть package.json в корне, считаем это основным проектом
    const rootPackageFile = info.packageFiles.find(p => p.path === 'package.json' || p.path === './package.json');
    if (rootPackageFile) {
      info.projectType = 'application';
      info.primaryLanguage = 'JavaScript';
      return;
    }
    
    // Определяем по языкам
    if (languages.includes('JavaScript') || languages.includes('TypeScript')) {
      info.projectType = 'application';
      info.primaryLanguage = 'JavaScript';
    } else if (languages.includes('Java') || languages.includes('Kotlin') || languages.includes('Scala')) {
      info.projectType = 'application';
      info.primaryLanguage = 'Java';
    } else if (languages.includes('Python')) {
      info.projectType = 'application';
      info.primaryLanguage = 'Python';
    } else if (languages.includes('C#')) {
      info.projectType = 'application';
      info.primaryLanguage = 'C#';
    } else if (languages.includes('Go')) {
      info.projectType = 'application';
      info.primaryLanguage = 'Go';
    } else if (languages.includes('Rust')) {
      info.projectType = 'application';
      info.primaryLanguage = 'Rust';
    } else if (languages.includes('Ruby')) {
      info.projectType = 'application';
      info.primaryLanguage = 'Ruby';
    } else if (languages.includes('PHP')) {
      info.projectType = 'application';
      info.primaryLanguage = 'PHP';
    } else if (languages.includes('Swift')) {
      info.projectType = 'application';
      info.primaryLanguage = 'Swift';
    } else {
      info.projectType = 'application';
      info.primaryLanguage = languages[0] || 'Unknown';
    }
  }

  async analyzeAllDependencies(info) {
    try {
      this.logger.info(`Анализ зависимостей из ${info.packageFiles.length} файлов пакетов...`);
      
      // Сбрасываем массив зависимостей
      info.directDependencies = [];
      
      // Анализируем зависимости из каждого найденного файла пакета
      for (const packageFile of info.packageFiles) {
        try {
          await this.analyzeDependenciesFromPackageFile(packageFile, info);
        } catch (error) {
          this.logger.warn(`Ошибка анализа файла ${packageFile.path}:`, error.message);
        }
      }
      
      // Удаляем дубликаты зависимостей
      this.deduplicateDependencies(info);
      
      this.logger.info(`Найдено уникальных зависимостей: ${info.directDependencies.length}`);
      
    } catch (error) {
      this.logger.warn('Ошибка анализа зависимостей:', error.message);
    }
  }

  async analyzeDependenciesFromPackageFile(packageFile, info) {
    const analyzer = {
      'npm': this.analyzeNpmDependencies.bind(this),
      'yarn': this.analyzeNpmDependencies.bind(this),
      'pnpm': this.analyzeNpmDependencies.bind(this),
      'pip': this.analyzePipDependencies.bind(this),
      'poetry': this.analyzePoetryDependencies.bind(this),
      'pipenv': this.analyzePipenvDependencies.bind(this),
      'maven': this.analyzeMavenDependencies.bind(this),
      'gradle': this.analyzeGradleDependencies.bind(this),
      'nuget': this.analyzeNugetDependencies.bind(this),
      'go': this.analyzeGoDependencies.bind(this),
      'cargo': this.analyzeCargoDependencies.bind(this),
      'rubygems': this.analyzeRubyDependencies.bind(this),
      'composer': this.analyzeComposerDependencies.bind(this),
      'pub': this.analyzePubDependencies.bind(this),
      'cocoapods': this.analyzeCocoapodsDependencies.bind(this),
      'hex': this.analyzeHexDependencies.bind(this)
    };
    
    if (analyzer[packageFile.managerInfo.manager]) {
      await analyzer[packageFile.managerInfo.manager](packageFile, info);
    }
  }

  async analyzeNpmDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      const packageJson = JSON.parse(content);
      
      // Добавляем информацию о самом пакете в metadata
      if (packageFile.path === 'package.json' || packageFile.path === './package.json') {
        info.metadata.packageJson = {
          name: packageJson.name,
          version: packageJson.version,
          description: packageJson.description,
          author: packageJson.author,
          repository: packageJson.repository,
          homepage: packageJson.homepage
        };
        
        if (packageJson.license && !info.license) {
          info.license = this.normalizeLicense(packageJson.license);
        }
      }
      
      // Runtime dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          info.directDependencies.push({
            group: null,
            name,
            version: this.normalizeVersion(version),
            type: 'library',
            purl: `pkg:npm/${name}@${this.normalizeVersion(version)}`,
            scope: 'required',
            ecosystem: 'npm',
            source: packageFile.path
          });
        }
      }
      
      // Dev dependencies
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          info.directDependencies.push({
            group: null,
            name,
            version: this.normalizeVersion(version),
            type: 'library',
            purl: `pkg:npm/${name}@${this.normalizeVersion(version)}`,
            scope: 'optional',
            ecosystem: 'npm',
            source: packageFile.path
          });
        }
      }
      
      // Peer dependencies
      if (packageJson.peerDependencies) {
        for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
          info.directDependencies.push({
            group: null,
            name,
            version: this.normalizeVersion(version),
            type: 'library',
            purl: `pkg:npm/${name}@${this.normalizeVersion(version)}`,
            scope: 'excluded',
            ecosystem: 'npm',
            source: packageFile.path
          });
        }
      }
      
      // Optional dependencies
      if (packageJson.optionalDependencies) {
        for (const [name, version] of Object.entries(packageJson.optionalDependencies)) {
          info.directDependencies.push({
            group: null,
            name,
            version: this.normalizeVersion(version),
            type: 'library',
            purl: `pkg:npm/${name}@${this.normalizeVersion(version)}`,
            scope: 'optional',
            ecosystem: 'npm',
            source: packageFile.path
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа npm файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzePipDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
          // Убираем комментарии в конце строки
          const cleanLine = trimmed.split('#')[0].trim();
          const match = cleanLine.match(/^([a-zA-Z0-9_-]+)(?:([>=<!~]+)([0-9.a-zA-Z_-]+))?/);
          if (match) {
            const name = match[1];
            const version = match[3] || '*';
            
            info.directDependencies.push({
              group: null,
              name,
              version: this.normalizeVersion(version),
              type: 'library',
              purl: `pkg:pypi/${name}@${this.normalizeVersion(version)}`,
              scope: 'required',
              ecosystem: 'pypi',
              source: packageFile.path
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа pip файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzePoetryDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      const lines = content.split('\n');
      let inDeps = false;
      let inDevDeps = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed === '[tool.poetry.dependencies]') {
          inDeps = true;
          inDevDeps = false;
          continue;
        } else if (trimmed === '[tool.poetry.dev-dependencies]') {
          inDeps = false;
          inDevDeps = true;
          continue;
        } else if (trimmed.startsWith('[') && !trimmed.includes('poetry')) {
          inDeps = false;
          inDevDeps = false;
          continue;
        }
        
        if ((inDeps || inDevDeps) && trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]+)"|'([^']+)'|{([^}]+)})/);
          if (match) {
            const name = match[1];
            let version = match[2] || match[3] || '*';
            
            // Обработка сложных зависимостей вида {version = "^1.0", optional = true}
            if (match[4]) {
              const versionMatch = match[4].match(/version\s*=\s*"([^"]+)"/);
              if (versionMatch) {
                version = versionMatch[1];
              }
            }
            
            info.directDependencies.push({
              group: null,
              name,
              version: this.normalizeVersion(version),
              type: 'library',
              purl: `pkg:pypi/${name}@${this.normalizeVersion(version)}`,
              scope: inDevDeps ? 'optional' : 'required',
              ecosystem: 'pypi',
              source: packageFile.path
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа Poetry файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzePipenvDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      const pipfile = JSON.parse(content);
      
      if (pipfile.default) {
        for (const [name, version] of Object.entries(pipfile.default)) {
          info.directDependencies.push({
            group: null,
            name,
            version: this.normalizeVersion(typeof version === 'string' ? version : version.version),
            type: 'library',
            purl: `pkg:pypi/${name}@${this.normalizeVersion(typeof version === 'string' ? version : version.version)}`,
            scope: 'required',
            ecosystem: 'pypi',
            source: packageFile.path
          });
        }
      }
      
      if (pipfile.develop) {
        for (const [name, version] of Object.entries(pipfile.develop)) {
          info.directDependencies.push({
            group: null,
            name,
            version: this.normalizeVersion(typeof version === 'string' ? version : version.version),
            type: 'library',
            purl: `pkg:pypi/${name}@${this.normalizeVersion(typeof version === 'string' ? version : version.version)}`,
            scope: 'optional',
            ecosystem: 'pypi',
            source: packageFile.path
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа Pipenv файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzeMavenDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      
      // Добавляем информацию о самом проекте Maven
      if (packageFile.filename === 'pom.xml') {
        const nameMatch = content.match(/<name>([^<]+)<\/name>/);
        const versionMatch = content.match(/<version>([^<]+)<\/version>/);
        const descriptionMatch = content.match(/<description>([^<]+)<\/description>/);
        
        if (!info.metadata.pomXml) {
          info.metadata.pomXml = {
            name: nameMatch ? nameMatch[1] : null,
            version: versionMatch ? versionMatch[1] : null,
            description: descriptionMatch ? descriptionMatch[1] : null
          };
        }
      }
      
      // Улучшенный парсинг зависимостей Maven
      const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
      let match;
      
      while ((match = depRegex.exec(content)) !== null) {
        const depContent = match[1];
        const groupMatch = depContent.match(/<groupId>([^<]+)<\/groupId>/);
        const artifactMatch = depContent.match(/<artifactId>([^<]+)<\/artifactId>/);
        const versionMatch = depContent.match(/<version>([^<]+)<\/version>/);
        const scopeMatch = depContent.match(/<scope>([^<]+)<\/scope>/);
        
        if (groupMatch && artifactMatch) {
          info.directDependencies.push({
            group: groupMatch[1],
            name: artifactMatch[1],
            version: versionMatch ? this.normalizeVersion(versionMatch[1]) : 'LATEST',
            type: 'library',
            purl: `pkg:maven/${groupMatch[1]}/${artifactMatch[1]}${versionMatch ? `@${this.normalizeVersion(versionMatch[1])}` : ''}`,
            scope: scopeMatch ? scopeMatch[1].toLowerCase() : 'required',
            ecosystem: 'maven',
            source: packageFile.path
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа Maven файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzeGradleDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      
      // Поиск зависимостей в Gradle
      const depRegex = /(implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly|annotationProcessor|kapt)\s+['"]([^:'"]+):([^:'"]+):([^:'"]+)['"]/g;
      let match;
      
      while ((match = depRegex.exec(content)) !== null) {
        const scope = this.mapGradleScope(match[1]);
        
        info.directDependencies.push({
          group: match[2],
          name: match[3],
          version: this.normalizeVersion(match[4]),
          type: 'library',
          purl: `pkg:maven/${match[2]}/${match[3]}@${this.normalizeVersion(match[4])}`,
          scope: scope,
          ecosystem: 'maven',
          source: packageFile.path
        });
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа Gradle файла ${packageFile.path}: ${error.message}`);
    }
  }

  mapGradleScope(gradleScope) {
    const scopeMap = {
      'implementation': 'required',
      'api': 'required',
      'compileOnly': 'excluded',
      'runtimeOnly': 'required',
      'testImplementation': 'optional',
      'testRuntimeOnly': 'optional',
      'annotationProcessor': 'required',
      'kapt': 'required'
    };
    return scopeMap[gradleScope] || 'required';
  }

  async analyzeNugetDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      
      // Поиск PackageReference
      const depRegex = /<PackageReference\s+Include="([^"]+)"(?:\s+Version="([^"]+)")?\s*\/>/g;
      let match;
      
      while ((match = depRegex.exec(content)) !== null) {
        info.directDependencies.push({
          group: null,
          name: match[1],
          version: match[2] ? this.normalizeVersion(match[2]) : '*',
          type: 'library',
          purl: `pkg:nuget/${match[1]}${match[2] ? `@${this.normalizeVersion(match[2])}` : ''}`,
          scope: 'required',
          ecosystem: 'nuget',
          source: packageFile.path
        });
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа NuGet файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzeGoDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      const lines = content.split('\n');
      let inRequire = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed === 'require (') {
          inRequire = true;
          continue;
        } else if (trimmed === ')') {
          inRequire = false;
          continue;
        }
        
        if (inRequire || trimmed.startsWith('require ')) {
          const lineContent = inRequire ? trimmed : trimmed.substring(8);
          if (lineContent && !lineContent.startsWith('//')) {
            const parts = lineContent.split(/\s+/);
            if (parts.length >= 2) {
              info.directDependencies.push({
                group: null,
                name: parts[0],
                version: this.normalizeVersion(parts[1]),
                type: 'library',
                purl: `pkg:golang/${parts[0]}@${this.normalizeVersion(parts[1])}`,
                scope: 'required',
                ecosystem: 'golang',
                source: packageFile.path
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа Go файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzeCargoDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      const lines = content.split('\n');
      let inDeps = false;
      let inDevDeps = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed === '[dependencies]') {
          inDeps = true;
          inDevDeps = false;
          continue;
        } else if (trimmed === '[dev-dependencies]') {
          inDeps = false;
          inDevDeps = true;
          continue;
        } else if (trimmed.startsWith('[') && trimmed !== '[dependencies]' && trimmed !== '[dev-dependencies]') {
          inDeps = false;
          inDevDeps = false;
          continue;
        }
        
        if ((inDeps || inDevDeps) && trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split('=');
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const versionMatch = parts[1].trim().match(/"([^"]+)"/);
            const version = versionMatch ? this.normalizeVersion(versionMatch[1]) : '*';
            
            info.directDependencies.push({
              group: null,
              name,
              version,
              type: 'library',
              purl: `pkg:cargo/${name}@${version}`,
              scope: inDevDeps ? 'optional' : 'required',
              ecosystem: 'cargo',
              source: packageFile.path
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа Cargo файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzeRubyDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('gem')) {
          const match = trimmed.match(/gem\s+['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?/);
          if (match) {
            info.directDependencies.push({
              group: null,
              name: match[1],
              version: match[2] ? this.normalizeVersion(match[2]) : '>= 0',
              type: 'library',
              purl: `pkg:gem/${match[1]}${match[2] ? `@${this.normalizeVersion(match[2])}` : ''}`,
              scope: 'required',
              ecosystem: 'gem',
              source: packageFile.path
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа Ruby файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzeComposerDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      const composerJson = JSON.parse(content);
      
      if (composerJson.require) {
        for (const [name, version] of Object.entries(composerJson.require)) {
          if (!name.startsWith('php') && !name.startsWith('ext-')) {
            info.directDependencies.push({
              group: null,
              name,
              version: this.normalizeVersion(version.toString()),
              type: 'library',
              purl: `pkg:composer/${name}@${this.normalizeVersion(version.toString())}`,
              scope: 'required',
              ecosystem: 'composer',
              source: packageFile.path
            });
          }
        }
      }
      
      if (composerJson['require-dev']) {
        for (const [name, version] of Object.entries(composerJson['require-dev'])) {
          info.directDependencies.push({
            group: null,
            name,
            version: this.normalizeVersion(version.toString()),
            type: 'library',
            purl: `pkg:composer/${name}@${this.normalizeVersion(version.toString())}`,
            scope: 'optional',
            ecosystem: 'composer',
            source: packageFile.path
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа Composer файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzePubDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      const lines = content.split('\n');
      let inDeps = false;
      let inDevDeps = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed === 'dependencies:') {
          inDeps = true;
          inDevDeps = false;
          continue;
        } else if (trimmed === 'dev_dependencies:') {
          inDeps = false;
          inDevDeps = true;
          continue;
        } else if (trimmed.startsWith(' ') || trimmed.startsWith('\t')) {
          // Это зависимость
          if (inDeps || inDevDeps) {
            const match = trimmed.match(/^\s*([a-zA-Z0-9_-]+):\s*(.+)$/);
            if (match) {
              const name = match[1];
              const versionSpec = match[2].trim();
              const versionMatch = versionSpec.match(/["']([^"']+)["']/);
              const version = versionMatch ? versionMatch[1] : '*';
              
              info.directDependencies.push({
                group: null,
                name,
                version: this.normalizeVersion(version),
                type: 'library',
                purl: `pkg:pub/${name}@${this.normalizeVersion(version)}`,
                scope: inDevDeps ? 'optional' : 'required',
                ecosystem: 'pub',
                source: packageFile.path
              });
            }
          }
        } else {
          inDeps = false;
          inDevDeps = false;
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа Pub файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzeCocoapodsDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('pod')) {
          const match = trimmed.match(/pod\s+['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?/);
          if (match) {
            info.directDependencies.push({
              group: null,
              name: match[1],
              version: match[2] ? this.normalizeVersion(match[2]) : '*',
              type: 'library',
              purl: `pkg:cocoapods/${match[1]}${match[2] ? `@${this.normalizeVersion(match[2])}` : ''}`,
              scope: 'required',
              ecosystem: 'cocoapods',
              source: packageFile.path
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа CocoaPods файла ${packageFile.path}: ${error.message}`);
    }
  }

  async analyzeHexDependencies(packageFile, info) {
    try {
      const content = await fs.readFile(packageFile.fullPath, 'utf8');
      const lines = content.split('\n');
      let inDeps = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('defp deps do')) {
          inDeps = true;
          continue;
        } else if (trimmed.startsWith('end') && inDeps) {
          inDeps = false;
          continue;
        }
        
        if (inDeps) {
          const match = trimmed.match(/{:([^,]+),\s*["']([^"']+)["']/);
          if (match) {
            info.directDependencies.push({
              group: null,
              name: match[1],
              version: this.normalizeVersion(match[2]),
              type: 'library',
              purl: `pkg:hex/${match[1]}@${this.normalizeVersion(match[2])}`,
              scope: 'required',
              ecosystem: 'hex',
              source: packageFile.path
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Ошибка анализа Hex файла ${packageFile.path}: ${error.message}`);
    }
  }

  deduplicateDependencies(info) {
    const uniqueDeps = new Map();
    
    for (const dep of info.directDependencies) {
      // Создаем уникальный ключ: экосистема + имя + версия
      const key = `${dep.ecosystem}:${dep.group || ''}:${dep.name}@${dep.version}`;
      
      if (!uniqueDeps.has(key)) {
        uniqueDeps.set(key, dep);
      } else {
        // Если уже есть такая зависимость, проверяем scope
        const existing = uniqueDeps.get(key);
        // Обновляем source, чтобы включить все источники
        if (!existing.sources) {
          existing.sources = [existing.source];
          delete existing.source;
        }
        if (!existing.sources.includes(dep.source)) {
          existing.sources.push(dep.source);
        }
      }
    }
    
    info.directDependencies = Array.from(uniqueDeps.values());
    info.allDependencies = info.directDependencies;
  }

  processSubprojects(info) {
    // Находим все package.json файлы в поддиректориях (не в корне)
    const subprojects = info.packageFiles.filter(p => 
      p.filename === 'package.json' && 
      p.path !== 'package.json' && 
      p.path !== './package.json'
    );
    
    if (subprojects.length > 0) {
      info.subprojects = subprojects.map(p => ({
        path: p.path,
        directory: p.directory,
        relativePath: p.path.replace('/package.json', '')
      }));
      
      this.logger.info(`Найдено подпроектов: ${info.subprojects.length}`);
    }
  }

  normalizeVersion(version) {
    if (!version || version === '*') return '*';
    
    // Убираем префиксы версий и лишние пробелы
    return version
      .replace(/^[~^=<>!]+\s*/, '')
      .replace(/\s+$/, '')
      .trim();
  }

  normalizeLicense(license) {
    if (typeof license === 'string') {
      // Пытаемся определить SPDX ID
      const licenseLower = license.toLowerCase();
      if (licenseLower.includes('mit')) return 'MIT';
      if (licenseLower.includes('apache') && licenseLower.includes('2.0')) return 'Apache-2.0';
      if (licenseLower.includes('gpl-3.0')) return 'GPL-3.0-only';
      if (licenseLower.includes('gpl-2.0')) return 'GPL-2.0-only';
      if (licenseLower.includes('bsd-3-clause')) return 'BSD-3-Clause';
      if (licenseLower.includes('bsd-2-clause')) return 'BSD-2-Clause';
      if (licenseLower.includes('isc')) return 'ISC';
      if (licenseLower.includes('unlicense')) return 'Unlicense';
      return license;
    } else if (license && typeof license === 'object') {
      return license.type || 'LicenseRef-Unknown';
    }
    return 'LicenseRef-Unknown';
  }

  async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  createCycloneDxSbom(repoInfo, projectInfo, downloadResult) {
    // Определяем версию проекта
    let projectVersion = '0.0.0';
    if (projectInfo.metadata.packageJson?.version) {
      projectVersion = projectInfo.metadata.packageJson.version;
    } else if (projectInfo.metadata.pomXml?.version) {
      projectVersion = projectInfo.metadata.pomXml.version;
    } else if (downloadResult.branch) {
      projectVersion = downloadResult.branch;
    }
    
    // Определяем имя проекта
    let projectName = `${repoInfo.owner}/${repoInfo.repo}`;
    if (projectInfo.metadata.packageJson?.name) {
      projectName = projectInfo.metadata.packageJson.name;
    } else if (projectInfo.metadata.pomXml?.name) {
      projectName = projectInfo.metadata.pomXml.name;
    }
    
    // Создаем PURL для основного компонента
    const bomRef = `pkg:generic/${projectName}@${projectVersion}`;
    
    // Создаем основной компонент (сам проект)
    const mainComponent = {
      "bom-ref": bomRef,
      "type": projectInfo.projectType,
      "name": projectName,
      "version": projectVersion,
      "description": repoInfo.description || projectInfo.metadata.packageJson?.description || projectInfo.metadata.pomXml?.description || "",
      "purl": bomRef,
      "properties": this.generateComponentProperties(repoInfo, projectInfo, downloadResult)
    };
    
    // Добавляем лицензию если есть
    if (projectInfo.license) {
      mainComponent.licenses = [{
        "license": {
          "id": projectInfo.license
        }
      }];
    }
    
    // Добавляем информацию о языках
    const languages = Array.from(projectInfo.languages);
    if (languages.length > 0) {
      mainComponent.properties.push({
        "name": "hercules:languages",
        "value": languages.join(',')
      });
    }
    
    // Создаем компоненты для зависимостей
    const components = this.generateDependencyComponents(projectInfo);
    
    // Добавляем подпроекты как компоненты
    if (projectInfo.subprojects && projectInfo.subprojects.length > 0) {
      for (const subproject of projectInfo.subprojects) {
        components.push({
          "bom-ref": `pkg:generic/${projectName}/${subproject.relativePath}@${projectVersion}`,
          "type": projectInfo.projectType,
          "name": `${projectName}/${subproject.relativePath}`,
          "version": projectVersion,
          "purl": `pkg:generic/${projectName}/${subproject.relativePath}@${projectVersion}`,
          "properties": [
            {
              "name": "hercules:subproject",
              "value": "true"
            },
            {
              "name": "hercules:path",
              "value": subproject.relativePath
            }
          ]
        });
      }
    }
    
    // Генерируем граф зависимостей
    const dependencies = this.generateDependencyGraph(bomRef, components, projectInfo);
    
    // Собираем финальный SBOM
    const sbom = {
      "$schema": "http://cyclonedx.org/schema/bom-1.6.schema.json",
      "bomFormat": "CycloneDX",
      "specVersion": "1.6",
      "serialNumber": `urn:uuid:${crypto.randomUUID()}`,
      "version": 1,
      "metadata": {
        "timestamp": new Date().toISOString(),
        "tools": [
          {
            "vendor": "Hercules",
            "name": this.toolName,
            "version": this.toolVersion
          }
        ],
        "component": mainComponent
      },
      "components": components.length > 0 ? components : undefined,
      "dependencies": dependencies
    };
    
    return sbom;
  }

  generateComponentProperties(repoInfo, projectInfo, downloadResult) {
    const properties = [
      {
        "name": "hercules:repository",
        "value": `${repoInfo.owner}/${repoInfo.repo}`
      },
      {
        "name": "hercules:branch",
        "value": downloadResult.branch || "main"
      },
      {
        "name": "hercules:primaryLanguage",
        "value": projectInfo.primaryLanguage || "Unknown"
      },
      {
        "name": "hercules:ecosystem",
        "value": projectInfo.primaryEcosystem || "unknown"
      },
      {
        "name": "hercules:packageManager",
        "value": projectInfo.primaryPackageManager || "unknown"
      },
      {
        "name": "hercules:packageFiles",
        "value": projectInfo.packageFiles.length.toString()
      }
    ];
    
    if (downloadResult.commit?.hash) {
      properties.push({
        "name": "hercules:commitHash",
        "value": downloadResult.commit.hash.substring(0, 12)
      });
    }
    
    // Добавляем URL репозитория если есть
    if (repoInfo.url) {
      properties.push({
        "name": "hercules:repositoryUrl",
        "value": repoInfo.url
      });
    }
    
    return properties;
  }

  generateDependencyComponents(projectInfo) {
    const components = [];
    
    for (const dep of projectInfo.allDependencies) {
      const component = {
        "bom-ref": dep.purl || this.generatePurl(dep),
        "type": "library",
        "name": dep.name,
        "version": dep.version || "unknown",
        "purl": dep.purl || this.generatePurl(dep)
      };
      
      // Добавляем группу для Maven/Gradle компонентов
      if (dep.group) {
        component.group = dep.group;
      }
      
      // Добавляем scope согласно CycloneDX спецификации
      if (dep.scope && dep.scope !== 'required') {
        component.scope = dep.scope;
      }
      
      // Добавляем свойства для отслеживания типа зависимости
      component.properties = [
        {
          "name": "dependency:ecosystem",
          "value": dep.ecosystem || "unknown"
        },
        {
          "name": "dependency:type",
          "value": "direct"
        }
      ];
      
      // Добавляем информацию об источниках (из каких файлов пакетов найдена зависимость)
      if (dep.sources && dep.sources.length > 0) {
        component.properties.push({
          "name": "hercules:sources",
          "value": dep.sources.join(',')
        });
      } else if (dep.source) {
        component.properties.push({
          "name": "hercules:source",
          "value": dep.source
        });
      }
      
      components.push(component);
    }
    
    return components;
  }

  generatePurl(dep) {
    if (dep.purl) return dep.purl;
    
    // Генерация PURL согласно спецификации CycloneDX
    const version = dep.version || 'unknown';
    
    switch (dep.ecosystem) {
      case 'maven':
        return `pkg:maven/${dep.group}/${dep.name}@${version}`;
      case 'npm':
        return `pkg:npm/${dep.name}@${version}`;
      case 'pypi':
        return `pkg:pypi/${dep.name}@${version}`;
      case 'nuget':
        return `pkg:nuget/${dep.name}@${version}`;
      case 'golang':
        return `pkg:golang/${dep.name}@${version}`;
      case 'cargo':
        return `pkg:cargo/${dep.name}@${version}`;
      case 'gem':
        return `pkg:gem/${dep.name}@${version}`;
      case 'composer':
        return `pkg:composer/${dep.name}@${version}`;
      case 'pub':
        return `pkg:pub/${dep.name}@${version}`;
      case 'cocoapods':
        return `pkg:cocoapods/${dep.name}@${version}`;
      case 'hex':
        return `pkg:hex/${dep.name}@${version}`;
      default:
        return `pkg:generic/${dep.name}@${version}`;
    }
  }

  generateDependencyGraph(mainBomRef, components, projectInfo) {
    const dependencies = [];
    
    if (components.length === 0) {
      return dependencies;
    }
    
    // Собираем зависимости только для библиотек (не для подпроектов)
    const libraryComponents = components.filter(comp => 
      !comp.properties?.some(p => p.name === 'hercules:subproject' && p.value === 'true')
    );
    
    // Главный компонент зависит от всех своих библиотечных зависимостей
    const mainComponentDeps = libraryComponents.map(comp => comp["bom-ref"]);
    
    dependencies.push({
      "ref": mainBomRef,
      "dependsOn": mainComponentDeps
    });
    
    // Каждая библиотечная зависимость не имеет своих зависимостей (упрощенный граф)
    for (const component of libraryComponents) {
      dependencies.push({
        "ref": component["bom-ref"],
        "dependsOn": []
      });
    }
    
    // Добавляем зависимости для подпроектов (они зависят от тех же библиотек, что и основной проект)
    const subprojects = components.filter(comp => 
      comp.properties?.some(p => p.name === 'hercules:subproject' && p.value === 'true')
    );
    
    for (const subproject of subprojects) {
      dependencies.push({
        "ref": subproject["bom-ref"],
        "dependsOn": mainComponentDeps
      });
    }
    
    return dependencies;
  }

  isLicenseFile(filename) {
    const licenseFiles = [
      'LICENSE',
      'LICENSE.txt',
      'LICENSE.md',
      'LICENSE.rst',
      'LICENSE-MIT',
      'LICENSE-APACHE',
      'LICENCE',
      'LICENCE.txt',
      'LICENCE.md',
      'COPYING',
      'COPYING.txt',
      'COPYING.md',
      'COPYRIGHT',
      'COPYRIGHT.txt'
    ];
    
    const filenameUpper = filename.toUpperCase();
    return licenseFiles.includes(filenameUpper) || 
           filenameUpper.startsWith('LICENSE') ||
           filenameUpper.startsWith('LICENCE') ||
           filenameUpper.startsWith('COPYING');
  }

  async parseLicenseFile(filepath) {
    try {
      const content = await fs.readFile(filepath, 'utf8');
      const upperContent = content.toUpperCase();
      
      // Определение типа лицензии для SPDX ID
      if (upperContent.includes('MIT LICENSE') || upperContent.includes('MIT ') || 
          upperContent.includes('PERMISSIVE')) {
        return 'MIT';
      } else if (upperContent.includes('APACHE LICENSE') || upperContent.includes('APACHE 2.0')) {
        return 'Apache-2.0';
      } else if (upperContent.includes('GNU GENERAL PUBLIC LICENSE')) {
        if (upperContent.includes('VERSION 3') || upperContent.includes('V3')) {
          return 'GPL-3.0-only';
        } else if (upperContent.includes('VERSION 2') || upperContent.includes('V2')) {
          return 'GPL-2.0-only';
        }
        return 'GPL';
      } else if (upperContent.includes('BSD LICENSE') || upperContent.includes('BSD ')) {
        if (upperContent.includes('3-CLAUSE') || upperContent.includes('3 CLAUSE')) {
          return 'BSD-3-Clause';
        } else if (upperContent.includes('2-CLAUSE') || upperContent.includes('2 CLAUSE')) {
          return 'BSD-2-Clause';
        }
        return 'BSD';
      } else if (upperContent.includes('ISC LICENSE') || upperContent.includes('ISC ')) {
        return 'ISC';
      } else if (upperContent.includes('UNLICENSE')) {
        return 'Unlicense';
      } else if (upperContent.includes('MOZILLA PUBLIC LICENSE')) {
        if (upperContent.includes('2.0')) {
          return 'MPL-2.0';
        }
        return 'MPL';
      } else if (upperContent.includes('CREATIVE COMMONS')) {
        return 'CC0-1.0';
      }
      
      return 'LicenseRef-Unknown';
    } catch {
      return 'LicenseRef-Unknown';
    }
  }

  async generateSbomForMultipleProjects(projects) {
    const results = [];
    
    for (const project of projects) {
      try {
        const result = await this.generateSbom(
          project.downloadPath,
          project.repoInfo,
          project.downloadResult
        );
        results.push({
          project: `${project.repoInfo.owner}/${project.repoInfo.repo}`,
          success: true,
          ...result
        });
      } catch (error) {
        this.logger.error(`Ошибка генерации SBOM для ${project.repoInfo.owner}/${project.repoInfo.repo}:`, error.message);
        results.push({
          project: `${project.repoInfo.owner}/${project.repoInfo.repo}`,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

// Экспортируем класс
export { SbomGenerator };