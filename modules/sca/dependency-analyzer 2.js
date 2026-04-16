import fs from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import got from 'got';

export class DependencyAnalyzer {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.npmRegistry = options.npmRegistry || 'https://registry.npmjs.org';
    this.pypiRegistry = options.pypiRegistry || 'https://pypi.org/pypi';
    this.cache = new Map();
  }

  async analyze(content, fileType = 'json') {
    try {
      let dependencies = {};
      
      switch (fileType.toLowerCase()) {
        case 'json':
          dependencies = await this.analyzePackageJson(content);
          break;
        case 'yaml':
        case 'yml':
          dependencies = await this.analyzeRequirementsYaml(content);
          break;
        case 'txt':
          dependencies = await this.analyzeRequirementsTxt(content);
          break;
        case 'toml':
          dependencies = await this.analyzePyProjectToml(content);
          break;
        default:
          throw new Error(`Неподдерживаемый тип файла: ${fileType}`);
      }
      
      return {
        fileType,
        totalDependencies: Object.keys(dependencies).length,
        dependencies,
        summary: await this.generateSummary(dependencies),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Ошибка анализа зависимостей:', error);
      throw new Error(`Не удалось проанализировать зависимости: ${error.message}`);
    }
  }

  async analyzePackageJson(content) {
    try {
      const packageJson = JSON.parse(content);
      const dependencies = {};
      
      // Анализируем dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          dependencies[name] = {
            type: 'dependencies',
            version,
            latest: await this.getLatestNpmVersion(name),
            manager: 'npm',
            category: 'runtime'
          };
        }
      }
      
      // Анализируем devDependencies
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          dependencies[name] = {
            type: 'devDependencies',
            version,
            latest: await this.getLatestNpmVersion(name),
            manager: 'npm',
            category: 'development'
          };
        }
      }
      
      // Анализируем peerDependencies
      if (packageJson.peerDependencies) {
        for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
          dependencies[name] = {
            type: 'peerDependencies',
            version,
            latest: await this.getLatestNpmVersion(name),
            manager: 'npm',
            category: 'peer'
          };
        }
      }
      
      return dependencies;
    } catch (error) {
      throw new Error(`Ошибка парсинга package.json: ${error.message}`);
    }
  }

  async analyzeRequirementsYaml(content) {
    try {
      const data = yaml.load(content);
      const dependencies = {};
      
      if (data.dependencies) {
        for (const dep of data.dependencies) {
          if (typeof dep === 'string') {
            const [name, version] = this.parsePythonDependency(dep);
            dependencies[name] = {
              type: 'dependencies',
              version: version || 'latest',
              latest: await this.getLatestPyPiVersion(name),
              manager: 'pip',
              category: 'runtime'
            };
          }
        }
      }
      
      return dependencies;
    } catch (error) {
      throw new Error(`Ошибка парсинга YAML: ${error.message}`);
    }
  }

  async analyzeRequirementsTxt(content) {
    const dependencies = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Пропускаем комментарии и пустые строки
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      const [name, version] = this.parsePythonDependency(trimmed);
      if (name) {
        dependencies[name] = {
          type: 'requirements',
          version: version || 'latest',
          latest: await this.getLatestPyPiVersion(name),
          manager: 'pip',
          category: 'runtime'
        };
      }
    }
    
    return dependencies;
  }

  async analyzePyProjectToml(content) {
    // Упрощённый парсинг TOML
    const dependencies = {};
    const lines = content.split('\n');
    let inDependencies = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('[tool.poetry.dependencies]') || 
          trimmed.startsWith('[project.dependencies]')) {
        inDependencies = true;
        continue;
      }
      
      if (inDependencies && trimmed.startsWith('[')) {
        inDependencies = false;
        continue;
      }
      
      if (inDependencies && trimmed && !trimmed.startsWith('#')) {
        const [name, version] = this.parsePythonDependency(trimmed);
        if (name) {
          dependencies[name] = {
            type: 'dependencies',
            version: version || 'latest',
            latest: await this.getLatestPyPiVersion(name),
            manager: 'pip/poetry',
            category: 'runtime'
          };
        }
      }
    }
    
    return dependencies;
  }

  parsePythonDependency(dep) {
    const patterns = [
      /^([a-zA-Z0-9_-]+)\s*([<=>!~]=?\s*[0-9.*]+)?/,
      /^([a-zA-Z0-9_-]+)==([0-9.]+)/,
      /^([a-zA-Z0-9_-]+)>=([0-9.]+)/,
      /^([a-zA-Z0-9_-]+)<=([0-9.]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = dep.match(pattern);
      if (match) {
        return [match[1], match[2] ? match[2].trim() : null];
      }
    }
    
    return [dep.split(/[<=>!~]/)[0], null];
  }

  async getLatestNpmVersion(packageName) {
    const cacheKey = `npm:${packageName}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      const response = await got(`${this.npmRegistry}/${packageName}`, {
        timeout: 5000
      });
      
      const data = JSON.parse(response.body);
      const latest = data['dist-tags']?.latest || 'unknown';
      
      this.cache.set(cacheKey, latest);
      return latest;
    } catch (error) {
      this.logger.warn(`Не удалось получить версию для ${packageName}:`, error.message);
      return 'unknown';
    }
  }

  async getLatestPyPiVersion(packageName) {
    const cacheKey = `pypi:${packageName}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      const response = await got(`${this.pypiRegistry}/${packageName}/json`, {
        timeout: 5000
      });
      
      const data = JSON.parse(response.body);
      const latest = data.info?.version || 'unknown';
      
      this.cache.set(cacheKey, latest);
      return latest;
    } catch (error) {
      this.logger.warn(`Не удалось получить версию для ${packageName}:`, error.message);
      return 'unknown';
    }
  }

  async generateSummary(dependencies) {
    const summary = {
      total: Object.keys(dependencies).length,
      byManager: {},
      byCategory: {},
      outdated: 0,
      vulnerabilities: 0
    };
    
    for (const [name, info] of Object.entries(dependencies)) {
      // По менеджерам
      summary.byManager[info.manager] = (summary.byManager[info.manager] || 0) + 1;
      
      // По категориям
      summary.byCategory[info.category] = (summary.byCategory[info.category] || 0) + 1;
      
      // Проверяем устаревшие версии
      if (info.latest !== 'unknown' && info.version !== 'latest') {
        const current = this.normalizeVersion(info.version);
        const latest = this.normalizeVersion(info.latest);
        
        if (this.compareVersions(current, latest) < 0) {
          summary.outdated++;
        }
      }
    }
    
    return summary;
  }

  normalizeVersion(version) {
    // Удаляем нечисловые символы в начале
    return version.replace(/^[^0-9]*/, '').split('-')[0];
  }

  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }

  clearCache() {
    this.cache.clear();
  }
}