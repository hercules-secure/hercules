import fs from 'fs/promises';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { createWriteStream } from 'fs';
import https from 'https';
import http from 'http';
import yaml from 'js-yaml';

const execAsync = promisify(exec);
const traverse = _traverse.default || _traverse;

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

class GitRepositoryHandler {
    constructor() {
        this.tempDir = path.join(os.tmpdir(), 'hercules-repos');
    }

    isValidRepositoryUrl(url) {
        if (!url) return false;
        
        const patterns = [
            /^https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\.git)?$/i,
            /^git@github\.com:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\.git)?$/i,
            /^https?:\/\/(?:[a-zA-Z0-9_-]+\.)?gitlab\.(?:com|ru|community\.ispras\.ru)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\.git)?$/i,
            /^git@[a-zA-Z0-9.-]+:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\.git)?$/i,
            /^https?:\/\/(?:www\.)?bitbucket\.org\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\.git)?$/i,
            /^https?:\/\/[a-zA-Z0-9.-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\.git)?$/i,
            /^git@[a-zA-Z0-9.-]+:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\.git)?$/i
        ];
        
        return patterns.some(pattern => pattern.test(url.trim()));
    }

    detectRepositoryType(url) {
        const urlLower = url.toLowerCase();
        if (urlLower.includes('github.com')) return 'github';
        if (urlLower.includes('gitlab.com') || urlLower.includes('gitlab.ru') || urlLower.includes('ispras.ru')) return 'gitlab';
        if (urlLower.includes('bitbucket.org')) return 'bitbucket';
        return 'generic';
    }

    async getDefaultBranch(url, type, owner, repo, host) {
        try {
            if (type === 'github') {
                const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
                const response = await this.httpsRequest(apiUrl, {
                    headers: {
                        'User-Agent': 'Hercules-SAST',
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (response.status === 200) {
                    const data = JSON.parse(await response.text());
                    return data.default_branch || 'master';
                }
            } 
            else if (type === 'gitlab') {
                const encodedPath = encodeURIComponent(`${owner}/${repo}`);
                let apiUrl;
                if (host && host.includes('ispras.ru')) {
                    apiUrl = `https://${host}/api/v4/projects/${encodedPath}`;
                } else {
                    apiUrl = `https://gitlab.com/api/v4/projects/${encodedPath}`;
                }
                
                const response = await this.httpsRequest(apiUrl, {
                    headers: { 'User-Agent': 'Hercules-SAST' }
                });
                
                if (response.status === 200) {
                    const data = JSON.parse(await response.text());
                    return data.default_branch || 'master';
                }
            }
        } catch (error) {
            alert(`Не удалось получить информацию о ветке: ${error.message}`);
        }
        return type === 'github' ? 'master' : 'main';
    }

    httpsRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            const request = protocol.get(url, { 
                headers: options.headers || {},
                timeout: 10000 
            }, (response) => {
                let data = '';
                response.on('data', (chunk) => { data += chunk; });
                response.on('end', () => {
                    resolve({
                        status: response.statusCode,
                        headers: response.headers,
                        json: async () => JSON.parse(data),
                        text: async () => data
                    });
                });
            });
            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
            request.end();
        });
    }

    async checkRepositoryExists(url) {
        const type = this.detectRepositoryType(url);
        const { host, owner, repo } = this.parseRepositoryUrl(url);
        if (!owner || !repo) return { exists: false, error: 'Не удалось распарсить URL' };

        try {
            if (type === 'github') {
                const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
                const response = await this.httpsRequest(apiUrl, {
                    headers: { 'User-Agent': 'Hercules-SAST', 'Accept': 'application/vnd.github.v3+json' }
                });
                if (response.status === 200) return { exists: true, type, owner, repo, host };
                if (response.status === 404) return { exists: false, error: `Репозиторий ${owner}/${repo} не найден на GitHub` };
                return { exists: false, error: `GitHub API вернул статус ${response.status}` };
            } 
            else if (type === 'gitlab') {
                const encodedPath = encodeURIComponent(`${owner}/${repo}`);
                let apiUrl;
                if (host && host.includes('ispras.ru')) {
                    apiUrl = `https://${host}/api/v4/projects/${encodedPath}`;
                } else {
                    apiUrl = `https://gitlab.com/api/v4/projects/${encodedPath}`;
                }
                const response = await this.httpsRequest(apiUrl, { headers: { 'User-Agent': 'Hercules-SAST' } });
                if (response.status === 200) return { exists: true, type, owner, repo, host };
                if (response.status === 404) return { exists: false, error: `Проект ${owner}/${repo} не найден на ${host || 'GitLab'}` };
                return { exists: false, error: `GitLab API вернул статус ${response.status}` };
            }
            else {
                try {
                    await execAsync(`git ls-remote ${url} HEAD`, { timeout: 10000 });
                    return { exists: true, type, owner, repo, host };
                } catch (error) {
                    return { exists: false, error: `Репозиторий недоступен: ${error.message}` };
                }
            }
        } catch (error) {
            return { exists: false, error: `Ошибка проверки: ${error.message}` };
        }
    }

    parseRepositoryUrl(url) {
        const cleanUrl = url.replace(/\.git$/, '');
        let owner = '', repo = '', host = '';
        if (cleanUrl.startsWith('http')) {
            const match = cleanUrl.match(/https?:\/\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
            if (match) { host = match[1]; owner = match[2]; repo = match[3]; }
        } else if (cleanUrl.startsWith('git@')) {
            const match = cleanUrl.match(/git@([^:]+):([^\/]+)\/([^\/]+)/);
            if (match) { host = match[1]; owner = match[2]; repo = match[3]; }
        }
        return { host, owner, repo, type: this.detectRepositoryType(url) };
    }

    async downloadRepository(url, branch = null) {
        const { exists, error, type, owner, repo, host } = await this.checkRepositoryExists(url);
        if (!exists) throw new Error(error || 'Репозиторий не найден');
        if (!branch) branch = await this.getDefaultBranch(url, type, owner, repo, host);

        const repoDir = path.join(this.tempDir, `${owner}-${repo}-${Date.now()}`);
        await fs.mkdir(repoDir, { recursive: true });

        try {
            if (type === 'github') {
                const zipUrl = `https://github.com/${owner}/${repo}/archive/${branch}.zip`;
                const zipPath = path.join(repoDir, 'repo.zip');
                await this.downloadFile(zipUrl, zipPath);
                await execAsync(`unzip -q "${zipPath}" -d "${repoDir}"`);
                const files = await fs.readdir(repoDir);
                const extractedDir = files.find(f => f.includes(repo) && f.includes(branch));
                if (extractedDir) {
                    const sourceDir = path.join(repoDir, extractedDir);
                    const targetDir = path.join(repoDir, 'source');
                    await fs.rename(sourceDir, targetDir);
                }
            }
            else if (type === 'gitlab') {
                const encodedPath = encodeURIComponent(`${owner}/${repo}`);
                let apiUrl;
                if (host && host.includes('ispras.ru')) {
                    apiUrl = `https://${host}/api/v4/projects/${encodedPath}/repository/archive.zip?sha=${branch}`;
                } else {
                    apiUrl = `https://gitlab.com/api/v4/projects/${encodedPath}/repository/archive.zip?sha=${branch}`;
                }
                const zipPath = path.join(repoDir, 'repo.zip');
                try {
                    await this.downloadFile(apiUrl, zipPath, { headers: { 'User-Agent': 'Hercules-SAST' } });
                    await execAsync(`unzip -q "${zipPath}" -d "${repoDir}"`);
                    const files = await fs.readdir(repoDir);
                    const extractedDir = files.find(f => f !== 'repo.zip' && !f.endsWith('.zip'));
                    if (extractedDir) {
                        const sourceDir = path.join(repoDir, extractedDir);
                        const targetDir = path.join(repoDir, 'source');
                        await fs.rename(sourceDir, targetDir);
                    }
                } catch (error) {
                    const branchArg = branch ? `-b ${branch}` : '';
                    await execAsync(`git clone ${branchArg} --depth 1 "${url}" "${path.join(repoDir, 'source')}"`);
                }
            }
            else {
                const branchArg = branch ? `-b ${branch}` : '';
                await execAsync(`git clone ${branchArg} --depth 1 "${url}" "${path.join(repoDir, 'source')}"`);
            }

            let sourceDir = path.join(repoDir, 'source');
            if (!await this.fileExists(sourceDir)) {
                const files = await fs.readdir(repoDir);
                for (const file of files) {
                    const fullPath = path.join(repoDir, file);
                    const stat = await fs.stat(fullPath);
                    if (stat.isDirectory() && file !== 'source' && !file.endsWith('.zip')) {
                        sourceDir = fullPath;
                        break;
                    }
                }
            }

            return {
                id: `${owner}-${repo}-${Date.now()}`,
                path: sourceDir,
                owner, repo, host, type, url, branch
            };
        } catch (error) {
            await fs.rm(repoDir, { recursive: true, force: true }).catch(() => {});
            throw new Error(`Ошибка загрузки репозитория: ${error.message}`);
        }
    }

    async downloadFile(url, outputPath, options = {}) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            const request = protocol.get(url, { 
                headers: options.headers || {},
                timeout: 30000 
            }, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                const fileStream = createWriteStream(outputPath);
                response.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve();
                });
                fileStream.on('error', (err) => {
                    fs.unlink(outputPath).catch(() => {});
                    reject(err);
                });
            });
            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Download timeout'));
            });
        });
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
            console.error('Ошибка очистки:', error);
        }
    }
}

const gitHandler = new GitRepositoryHandler();

// ========== 1. БАЗОВЫЙ КЛАСС ДВИЖКА ==========

class AnalysisEngine {
  constructor(options = {}) {
    this.rules = []; // Все правила загружаются из JSON
    this.results = [];
    this.cache = new Map();
    this.verbose = options.verbose || false;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
  }

  async loadRulesFromFile(configFile) {
    try {
      const configData = await fs.readFile(configFile, 'utf-8');
      const config = JSON.parse(configData);
      const rules = Array.isArray(config) ? config : config.rules;
      
      if (!rules || !Array.isArray(rules)) {
        throw new Error('Invalid rules format: expected array or object with "rules" array');
      }
      
      this.rules = rules.map(ruleConfig => new Rule(ruleConfig));
      
      if (this.verbose) {
        console.log(`Loaded ${this.rules.length} rules from ${configFile}`);
      }
      
      return this;
    } catch (error) {
      console.error(`Error loading rules from ${configFile}:`, error.message);
      throw error;
    }
  }

  async analyzeInfraFile(filePath, content) {
    const fileName = path.basename(filePath).toLowerCase();
    const originalFileName = path.basename(filePath);
    const lines = content.split('\n');

    // Применяем все правила из rules.json
    for (const rule of this.rules) {
      // Пропускаем правила, которые не подходят для этого типа файла
      if (rule.languages && rule.languages.length > 0) {
        const isApplicable = this.isInfraRuleApplicable(rule, originalFileName, fileName);
        if (!isApplicable) continue;
      }

      try {
        if (rule.type === 'regex') {
          const regex = new RegExp(rule.pattern, rule.flags || 'g');
          
          // Для специальных правил, требующих контекстного анализа
          if (rule.id === 'docker-root-user') {
            // Специальная обработка для проверки USER в Dockerfile
            if (originalFileName.toLowerCase() === 'dockerfile' || originalFileName.toLowerCase().startsWith('dockerfile.')) {
              let hasUser = false;
              let isRootUser = true;
              lines.forEach((line, i) => {
                const lowerL = line.trim().toLowerCase();
                if (lowerL.startsWith('user ')) {
                  hasUser = true;
                  if (!lowerL.includes('root') && !lowerL.includes('0')) {
                    isRootUser = false;
                  }
                }
              });
              if (!hasUser || isRootUser) {
                this.pushInfraIssue(rule.id, rule.severity, filePath, 'No USER specified or runs as root', 0, rule.message);
              }
            }
          }
          else if (rule.id === 'docker-healthcheck') {
            // Специальная обработка для проверки HEALTHCHECK
            if (originalFileName.toLowerCase() === 'dockerfile' || originalFileName.toLowerCase().startsWith('dockerfile.')) {
              let hasHealthcheck = false;
              lines.forEach((line, i) => {
                const lowerL = line.trim().toLowerCase();
                if (lowerL.startsWith('healthcheck')) {
                  hasHealthcheck = true;
                }
              });
              if (!hasHealthcheck) {
                this.pushInfraIssue(rule.id, rule.severity, filePath, 'No HEALTHCHECK defined', 0, rule.message);
              }
            }
          }
          else if (rule.id === 'docker-multi-stage') {
            // Специальная обработка для проверки многослойной сборки
            if (originalFileName.toLowerCase() === 'dockerfile' || originalFileName.toLowerCase().startsWith('dockerfile.')) {
              const fromLines = lines.filter(l => l.trim().toLowerCase().startsWith('from '));
              if (fromLines.length === 1) {
                this.pushInfraIssue(rule.id, rule.severity, filePath, 'Single stage build, consider multi-stage', 0, rule.message);
              }
            }
          }
          else {
            // Обычная проверка по строкам
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const lowerLine = line.toLowerCase();
              
              // Проверяем, подходит ли правило для этой строки
              let matchFound = false;
              let match;
              
              if (rule.id === 'docker-latest-tag') {
                // Специальная проверка для :latest тегов
                if (lowerLine.startsWith('from ') && lowerLine.includes(':latest')) {
                  matchFound = true;
                }
              }
              else if (rule.id === 'docker-secrets') {
                // Специальная проверка для секретов в Dockerfile
                if (lowerLine.startsWith('env ') && 
                    (lowerLine.includes('password') || lowerLine.includes('secret') || 
                     lowerLine.includes('token') || lowerLine.includes('key'))) {
                  if (!line.includes('changeme') && !line.includes('example') && !line.includes('test')) {
                    matchFound = true;
                  }
                }
              }
              else {
                // Общая проверка по regex
                regex.lastIndex = 0;
                match = regex.exec(line);
                if (match) {
                  matchFound = true;
                }
              }
              
              if (matchFound) {
                this.pushInfraIssue(rule.id, rule.severity, filePath, line, i + 1, rule.message);
              }
            }
          }
        }
        else if (rule.type === 'pattern') {
          // Простая проверка по паттерну
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(rule.pattern)) {
              this.pushInfraIssue(rule.id, rule.severity, filePath, line, i + 1, rule.message);
            }
          }
        }
      } catch (e) {
        if (this.verbose) console.log(`Rule error for ${rule.id}: ${e.message}`);
      }
    }
    
    // Специальная обработка для YAML файлов (Kubernetes)
    if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
      try {
        const docs = yaml.loadAll(content);
        for (const doc of docs) {
          if (!doc || typeof doc !== 'object') continue;
          
          const kind = doc.kind;
          const spec = doc.spec || {};
          const containers = spec?.template?.spec?.containers || spec?.containers || [];
          
          containers.forEach((c, idx) => {
            // Проверка на привилегированные контейнеры
            if (c.securityContext?.privileged === true) {
              this.pushInfraIssue('privileged-container', 'critical', filePath, 'privileged container', 0, 'Контейнер запущен с privileged: true');
            }
            // Проверка на root пользователя
            if (c.securityContext?.runAsUser === 0) {
              this.pushInfraIssue('container-root-user', 'high', filePath, 'runs as root', 0, 'Контейнер запускается с root пользователем');
            }
            // Проверка на отсутствие ресурсов
            if (!c.resources) {
              this.pushInfraIssue('missing-resources', 'medium', filePath, 'no resources limits', 0, 'Отсутствуют ограничения ресурсов');
            }
          });
          
          // Проверка на публичные сервисы
          if (kind === 'Service' && spec.type === 'LoadBalancer') {
            this.pushInfraIssue('public-service', 'high', filePath, 'public LoadBalancer', 0, 'Сервис доступен публично');
          }
        }
      } catch (e) {
        if (this.verbose) console.log('YAML parse error:', e.message);
      }
    }
  }
  
  isInfraRuleApplicable(rule, originalFileName, fileName) {
    // Проверка по языкам
    if (!rule.languages || rule.languages.length === 0) return true;
    
    // Для Dockerfile
    if (rule.languages.includes('dockerfile')) {
      if (originalFileName.toLowerCase() === 'dockerfile' || 
          originalFileName.toLowerCase().startsWith('dockerfile.') ||
          originalFileName.toLowerCase() === 'containerfile') {
        return true;
      }
    }
    
    // Для Terraform
    if (rule.languages.includes('terraform') || rule.languages.includes('hcl')) {
      if (fileName.endsWith('.tf') || fileName.endsWith('.tfvars') || fileName.endsWith('.hcl')) {
        return true;
      }
    }
    
    // Для YAML/Kubernetes
    if (rule.languages.includes('yaml')) {
      if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
        return true;
      }
    }
    
    // Для всех языков
    if (rule.languages.includes('all')) {
      return true;
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
      const { exists, error } = await gitHandler.checkRepositoryExists(url);
      if (!exists) throw new Error(error || 'Репозиторий не найден');
      
      const repoInfo = await gitHandler.downloadRepository(url, branch);
      await this.analyzeDirectory(repoInfo.path);
      await gitHandler.cleanup(repoInfo.id);
      return this.generateResults(url);
    } catch (error) {
      throw new Error(`Ошибка загрузки репозитория: ${error.message}`);
    }
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

  async analyzeDirectory(dir) {
    const files = [];
    await this.walkDirectory(dir, files);
    if (this.verbose) console.log(`Found ${files.length} files to analyze`);
    for (const file of files) {
      await this.analyzeFile(file);
    }
  }

pushInfraIssue(ruleId, severity, filePath, code, line, message) {
    // Ищем правило по ID, чтобы получить recommendation
    const rule = this.rules.find(r => r.id === ruleId);
    const recommendation = rule ? rule.recommendation : '';
    
    this.results.push({
      ruleId,
      severity,
      message: message || ruleId,
      file: getShortPath(filePath),
      fullPath: filePath,
      line,
      column: 0,
      code: String(code).trim(),
      recommendation: recommendation  // Теперь берем из правила
    });
}

  async walkDirectory(dir, files) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target' || 
            entry.name === 'build' || entry.name === 'dist' || entry.name === '.idea' || 
            entry.name === '.vscode' || entry.name === '__pycache__' || entry.name === 'venv' || 
            entry.name === 'vendor'  || entry.name === 'test' ||           // ← добавляем
            entry.name === 'tests' ||           // ← добавляем
            entry.name === 'testdata' ||        // ← добавляем
            entry.name.includes('test')) {      // ← любые папки с test в имени) {
          continue;
        }
        await this.walkDirectory(fullPath, files);
      } 
      else if (entry.isFile()) {

            if (fullPath.includes('/test/') || 
                fullPath.includes('/tests/') || 
                fullPath.includes('/testdata/') ||
                fullPath.includes('\\test\\') ||    // для Windows
                fullPath.includes('\\tests\\') ||
                fullPath.includes('\\testdata\\') || 
                entry.name.includes('.test.') || 
                entry.name.includes('.spec.') || 
                entry.name.includes('_test.') ||
                entry.name.startsWith('test_')) {
                continue;
            }

        const ext = path.extname(entry.name).toLowerCase();
        const fileName = entry.name.toLowerCase();
        const originalFileName = entry.name;
        
        // Добавляем файлы для анализа
        if (['.java', '.xml', '.properties', '.gradle', '.conf', '.config', '.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.tf', '.tfvars', '.hcl', '.yaml', '.yml'].includes(ext) ||
            fileName === 'pom.xml' || fileName === 'build.gradle' || fileName === 'settings.gradle' ||
            fileName === 'gradle.properties' || fileName === 'application.properties' || fileName === 'application.yml' ||
            fileName === '.env' || originalFileName === 'Dockerfile' || fileName === 'dockerfile' ||
            fileName.startsWith('dockerfile.') || originalFileName.startsWith('Dockerfile.') ||
            fileName === 'containerfile' || originalFileName === 'Containerfile' ||
            fileName === 'docker-compose.yml' || fileName === 'docker-compose.yaml' ||
            fileName === 'azure-pipelines.yml' || fileName === 'azure-pipelines.yaml' ||
            fileName === 'values.yaml' || fileName === 'chart.yaml') {
          files.push(fullPath);
        }
      }
    }
  }

  async analyzeFile(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (content.length > this.maxFileSize) {
        if (this.verbose) //console.log(`Skipping large file: ${fileName}`);
        return;
      }
      
      if (this.verbose) //console.log(`\nAnalyzing: ${fileName}`);
      
      // Инфраструктурные файлы
      if (fileName === 'Dockerfile' || fileName.toLowerCase() === 'dockerfile' || 
          fileName.toLowerCase().startsWith('dockerfile.') || fileName.startsWith('Dockerfile.') ||
          fileName.toLowerCase() === 'containerfile' || fileName === 'Containerfile' ||
          fileName.includes('docker-compose') || ext === '.tf' || ext === '.tfvars' || 
          ext === '.yaml' || ext === '.yml' || fileName.includes('azure-pipelines') ||
          fileName === 'values.yaml' || fileName === 'chart.yaml') {
        await this.analyzeInfraFile(filePath, content);
      }
      // Java файлы
      else if (ext === '.java') {
        await this.analyzeJavaFile(filePath, content);
      }
      // Python файлы
      else if (ext === '.py') {
        await this.analyzePythonFile(filePath, content);
      }
      // JS/TS файлы
      else if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        await this.analyzeJSFile(filePath, content);
      }
      // Go файлы
      else if (ext === '.go') {
        await this.analyzeGoFile(filePath, content);
      }
      // Конфигурационные файлы
      else {
        await this.analyzeConfigFile(filePath, content);
      }
      
    } catch (error) {
      console.error(`Error analyzing ${filePath}:`, error.message);
    }
  }

  async analyzeJavaFile(filePath, content) {
    const lines = content.split('\n');
    for (const rule of this.rules) {
      if (rule.languages && !rule.languages.includes('java')) continue;
      await this.applyRuleToLines(rule, filePath, lines);
    }
  }

  async analyzePythonFile(filePath, content) {
    const lines = content.split('\n');
    for (const rule of this.rules) {
      if (rule.languages && !rule.languages.includes('python')) continue;
      await this.applyRuleToLines(rule, filePath, lines);
    }
  }

  async analyzeJSFile(filePath, content) {
    const lines = content.split('\n');
    for (const rule of this.rules) {
      if (rule.languages && !rule.languages.includes('javascript') && !rule.languages.includes('typescript')) continue;
      await this.applyRuleToLines(rule, filePath, lines);
    }
  }

  async analyzeGoFile(filePath, content) {
    const lines = content.split('\n');
    for (const rule of this.rules) {
      if (rule.languages && !rule.languages.includes('go')) continue;
      await this.applyRuleToLines(rule, filePath, lines);
    }
  }

  async analyzeConfigFile(filePath, content) {
    const lines = content.split('\n');
    for (const rule of this.rules) {
      if (rule.languages && !rule.languages.includes('config') && !rule.languages.includes('env') && !rule.languages.includes('yaml')) continue;
      await this.applyRuleToLines(rule, filePath, lines);
    }
  }

  async applyRuleToLines(rule, filePath, lines) {
    try {
      if (rule.type === 'regex') {
        const regex = new RegExp(rule.pattern, rule.flags || 'g');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          regex.lastIndex = 0;
          const match = regex.exec(line);
          if (match) {
            this.addResult(rule, filePath, i + 1, match.index, line.trim());
          }
        }
      } else if (rule.type === 'pattern') {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes(rule.pattern)) {
            this.addResult(rule, filePath, i + 1, line.indexOf(rule.pattern), line.trim());
          }
        }
      }
    } catch (e) {
      if (this.verbose) console.log(`Error applying rule ${rule.id}: ${e.message}`);
    }
  }

  addResult(rule, filePath, line, column, code) {
    this.results.push({
      ruleId: rule.id,
      severity: rule.severity,
      message: rule.message,
      file: getShortPath(filePath),
      fullPath: filePath,
      line: line,
      column: column,
      code: code.trim(),
      recommendation: rule.recommendation
    });
  }

  generateSummary() {
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const byRule = {};
    const byFile = {};
    
    for (const result of this.results) {
      bySeverity[result.severity] = (bySeverity[result.severity] || 0) + 1;
      byRule[result.ruleId] = (byRule[result.ruleId] || 0) + 1;
      const fileName = path.basename(result.file);
      byFile[fileName] = (byFile[fileName] || 0) + 1;
    }
    
    return { total: this.results.length, bySeverity, byRule, byFile };
  }
}

// ========== 2. БАЗОВЫЙ КЛАСС ПРАВИЛ ==========

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

// ========== 3. ЭКСПОРТИРУЕМАЯ ФУНКЦИЯ ==========

export async function analyzeCode(targetPath, rulesPath = './rules.json', options = {}) {
    const verbose = options.verbose || false;
    const originalConsoleLog = console.log;
    const originalConsoleInfo = console.info;
    const originalConsoleWarn = console.warn;
    
    if (!verbose) {
        console.log = function() {};
        console.info = function() {};
        console.warn = function() {};
    }
    
    try {
        const engine = new AnalysisEngine({ verbose, ...options });
        await engine.loadRulesFromFile(rulesPath);
        const results = await engine.analyze(targetPath);
        return results;
    } finally {
        if (!verbose) {
            console.log = originalConsoleLog;
            console.info = originalConsoleInfo;
            console.warn = originalConsoleWarn;
        }
    }
}

// ========== 4. CLI ==========

async function main() {
  const args = process.argv.slice(2);
  const target = args.find(a => !a.startsWith('--')) || '.';
  const configFile = args.find(a => a.startsWith('--config='))?.split('=')[1];
  const verbose = args.includes('--verbose');
  const outputFile = args.find(a => a.startsWith('--output='))?.split('=')[1];
  const branch = args.find(a => a.startsWith('--branch='))?.split('=')[1];
  
  if (!configFile) {
    console.error('Error: --config parameter is required');
    process.exit(1);
  }
  
  try {
    const results = await analyzeCode(target, configFile, { verbose, branch });
    
    if (outputFile) {
        await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
        if (verbose) console.log(`\nResults saved to ${outputFile}`);
    } else {
        process.stdout.write(JSON.stringify(results));
    }
    
    const criticalCount = results.summary.bySeverity.critical || 0;
    const highCount = results.summary.bySeverity.high || 0;
    if (criticalCount > 0 || highCount > 0) process.exit(1);
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

export { AnalysisEngine, Rule, getShortPath, gitHandler };