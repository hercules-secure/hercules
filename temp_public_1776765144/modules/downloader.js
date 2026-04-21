import fs from 'fs/promises';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { SbomGenerator } from './sca/sbom.js';

// Получаем __dirname в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

class GitHubDownloader {
  constructor(options = {}) {
    // Папки создаём только если они переданы
    this.cacheDir = options.cacheDir || null;
    this.downloadDir = options.downloadDir || null;
    this.logger = options.logger || console;
    this.cache = new Map();
    this.historyFile = this.downloadDir ? join(this.downloadDir, 'history.json') : null;
    this.maxCacheSize = options.maxCacheSize || 100 * 1024 * 1024;
    this.gitBinary = options.gitBinary || 'git';
    this.gitTimeout = options.gitTimeout || 300000; // 5 минут
    this.defaultBranch = options.defaultBranch || 'auto';
    this.githubToken = options.githubToken || null;
    
    // Инициализируем SBOM генератор
    this.sbomGenerator = new SbomGenerator({
      logger: this.logger,
      sbomFormat: options.sbomFormat || 'cyclonedx',
      sbomVersion: options.sbomVersion || '1.6',
      includeTransitiveDeps: options.includeTransitiveDeps !== false,
      dependencyDepth: options.dependencyDepth || 3,
      toolName: options.toolName || 'Hercules-SCA',
      toolVersion: options.toolVersion || '1.0.0'
    });
    
    this.generateSbom = options.generateSbom !== false;
    this.sbomOptions = options.sbomOptions || {};
  }

  async initialize() {
    // Создаём папки только если они указаны
    if (this.cacheDir) {
      await this.ensureDir(this.cacheDir);
    }
    if (this.downloadDir) {
      await this.ensureDir(this.downloadDir);
    }
    
    if (this.historyFile) {
      await this.loadHistory();
    }
    
    const hasGit = await this.checkGitAvailability();
    if (!hasGit) {
      throw new Error('Git не установлен. Установите git: https://git-scm.com/downloads');
    }
    
    this.logger.info('GitHub Downloader инициализирован');
    
    if (this.generateSbom) {
      this.logger.info('SBOM генерация включена');
    }
  }

  async checkGitAvailability() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync(`${this.gitBinary} --version`);
      return true;
    } catch (error) {
      this.logger.error('Git не найден:', error.message);
      return false;
    }
  }

  async ensureDir(path) {
    try {
      await fs.mkdir(path, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  async loadHistory() {
    if (!this.historyFile) return;
    
    try {
      const data = await fs.readFile(this.historyFile, 'utf8');
      this.history = JSON.parse(data);
    } catch {
      this.history = [];
    }
  }

  async saveHistory() {
    if (!this.historyFile) return;
    
    await fs.writeFile(
      this.historyFile,
      JSON.stringify(this.history, null, 2)
    );
  }

  extractRepoInfo(url) {
    url = url.trim().replace(/\.git$/, '').split('#')[0].split('?')[0];
    
    const patterns = [
      /github\.com[/:]([^/]+)\/([^/?#]+)/,
      /github\.com[:/]([^/]+)\/([^/]+)/,
      /^([^/]+)\/([^/]+)$/,
      /api\.github\.com\/repos\/([^/]+)\/([^/]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const [, owner, repoWithExt] = match;
        const repo = repoWithExt.replace(/\.git$/, '').split(/[?#]/)[0];
        return { owner, repo };
      }
    }

    throw new Error('Неверный формат GitHub URL');
  }

  async makeGitHubRequest(url, timeout = 10000) {
    const { default: fetch } = await import('node-fetch');
    
    const headers = {
      'User-Agent': 'Hercules-SCA',
      'Accept': 'application/vnd.github.v3+json',
    };
    
    if (this.githubToken) {
      headers['Authorization'] = `token ${this.githubToken}`;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorText = `HTTP ${response.status}`;
        try {
          const errorBody = await response.text();
          if (errorBody) {
            try {
              const errorJson = JSON.parse(errorBody);
              errorText = errorJson.message || errorText;
            } catch {
              errorText = errorBody.substring(0, 200);
            }
          }
        } catch {}
        
        if (response.status === 404) {
          throw new Error(`Ресурс не найден: ${errorText}`);
        } else if (response.status === 403) {
          const reset = response.headers.get('x-ratelimit-reset');
          if (reset) {
            const resetDate = new Date(parseInt(reset) * 1000);
            throw new Error(`Превышен лимит запросов. Сброс в ${resetDate.toLocaleTimeString()}`);
          }
          throw new Error(`Доступ запрещен: ${errorText}`);
        } else if (response.status === 401) {
          throw new Error(`Требуется аутентификация: ${errorText}`);
        } else {
          throw new Error(`GitHub API ошибка ${response.status}: ${errorText}`);
        }
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Ожидался JSON, получен: ${contentType}`);
      }
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Таймаут запроса к GitHub API (${timeout}ms)`);
      } else if (error.code === 'ENOTFOUND') {
        throw new Error('Не удалось подключиться к GitHub. Проверьте интернет-соединение.');
      } else {
        throw error;
      }
    }
  }

  async getRepositoryInfo(url) {
    try {
      const { owner, repo } = this.extractRepoInfo(url);
      
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
      
      const response = await this.makeGitHubRequest(apiUrl);
      
      if (response && typeof response === 'object') {
        return {
          owner,
          repo,
          description: response.description || '',
          stars: response.stargazers_count || 0,
          forks: response.forks_count || 0,
          language: response.language || 'Неизвестно',
          createdAt: response.created_at || new Date().toISOString(),
          updatedAt: response.updated_at || new Date().toISOString(),
          defaultBranch: response.default_branch || await this.detectDefaultBranch(url),
          size: response.size || 0,
          url: response.html_url || `https://github.com/${owner}/${repo}`,
          cloneUrl: response.clone_url || `https://github.com/${owner}/${repo}.git`,
          apiUrl: apiUrl
        };
      } else {
        throw new Error('Некорректный ответ от GitHub API');
      }
    } catch (error) {
      this.logger.warn('Не удалось получить информацию о репозитории через API:', error.message);
      
      const { owner, repo } = this.extractRepoInfo(url);
      const defaultBranch = await this.detectDefaultBranch(url);
      
      return {
        owner,
        repo,
        description: '',
        stars: 0,
        forks: 0,
        language: 'Неизвестно',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        defaultBranch: defaultBranch,
        size: 0,
        url: `https://github.com/${owner}/${repo}`,
        cloneUrl: `https://github.com/${owner}/${repo}.git`,
        apiUrl: `https://api.github.com/repos/${owner}/${repo}`
      };
    }
  }

  async detectDefaultBranch(url) {
    if (this.defaultBranch === 'main') return 'main';
    if (this.defaultBranch === 'master') return 'master';
    
    try {
      const { owner, repo } = this.extractRepoInfo(url);
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
      
      const response = await this.makeGitHubRequest(apiUrl, 5000);
      
      if (response && response.default_branch) {
        return response.default_branch;
      }
    } catch (error) {
      this.logger.debug('Не удалось определить ветку по умолчанию через API:', error.message);
    }
    
    return await this.guessDefaultBranch(url);
  }

  async guessDefaultBranch(url) {
    const commonBranches = ['main', 'master', 'develop', 'trunk'];
    
    for (const branch of commonBranches) {
      const exists = await this.checkBranchExists(url, branch);
      if (exists) {
        return branch;
      }
    }
    
    return 'main';
  }

  async checkBranchExists(url, branch) {
    try {
      const { owner, repo } = this.extractRepoInfo(url);
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/branches/${branch}`;
      
      await this.makeGitHubRequest(apiUrl, 3000);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getAvailableBranches(url) {
    try {
      const { owner, repo } = this.extractRepoInfo(url);
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/branches`;
      
      const response = await this.makeGitHubRequest(apiUrl);
      
      if (Array.isArray(response)) {
        return response.map(branch => ({
          name: branch.name,
          protected: branch.protected || false,
          commit: branch.commit ? branch.commit.sha : null
        }));
      } else {
        this.logger.warn('Некорректный ответ при получении веток');
        return [];
      }
    } catch (error) {
      this.logger.warn('Не удалось получить список веток:', error.message);
      return [];
    }
  }

  async downloadRepository(url, options = {}) {
    if (!this.downloadDir) {
      throw new Error('downloadDir не указан. Скачивание репозиториев отключено.');
    }
    
    const startTime = Date.now();
    
    try {
      const { owner, repo } = this.extractRepoInfo(url);
      
      let branch = options.branch;
      if (!branch) {
        if (options.useDefaultBranch !== false) {
          const repoInfo = await this.getRepositoryInfo(url);
          branch = repoInfo.defaultBranch;
        } else {
          branch = this.defaultBranch === 'auto' ? 'main' : this.defaultBranch;
        }
      }
      
      const depth = options.depth || 1;
      const generateSbom = options.generateSbom !== undefined ? options.generateSbom : this.generateSbom;
      
      const timestamp = Date.now();
      const downloadPath = join(
        this.downloadDir,
        `${owner}_${repo}_${branch}_${timestamp}`
      );
      
      await this.ensureDir(downloadPath);
      
      const repoUrl = url.includes('://') ? url : `https://github.com/${owner}/${repo}.git`;
      
      this.logger.info(`Начинаем клонирование: ${repoUrl} (branch: ${branch})`);
      
      await this.gitClone(repoUrl, downloadPath, branch, depth);
      
      let repoInfo;
      try {
        repoInfo = await this.getRepositoryInfo(url);
      } catch (error) {
        repoInfo = {
          owner,
          repo,
          description: '',
          stars: 0,
          forks: 0,
          language: 'Не указан',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          defaultBranch: branch,
          size: 0,
          url: `https://github.com/${owner}/${repo}`,
          cloneUrl: `https://github.com/${owner}/${repo}.git`,
          apiUrl: `https://api.github.com/repos/${owner}/${repo}`
        };
      }
      
      const commitInfo = await this.getCommitInfo(downloadPath);
      const actualBranch = commitInfo.currentBranch || branch;
      
      const result = {
        id: `${owner}_${repo}_${timestamp}`,
        owner,
        repo,
        requestedBranch: branch,
        actualBranch: actualBranch,
        downloadPath,
        repoUrl,
        size: await this.getDirectorySize(downloadPath),
        files: await this.countFiles(downloadPath),
        timestamp,
        downloadTime: Date.now() - startTime,
        info: repoInfo,
        commit: commitInfo,
        directUrl: this.downloadDir ? `/downloads/${basename(downloadPath)}` : null,
        branches: await this.getAvailableBranches(url)
      };
      
      if (generateSbom) {
        try {
          const sbomResult = await this.sbomGenerator.generateSbom(downloadPath, repoInfo, result);
          result.sbom = sbomResult.sbom;
          result.sbomFilePath = sbomResult.filePath;
          result.componentsCount = sbomResult.componentsCount;
          result.dependenciesCount = sbomResult.dependenciesCount;
          result.sbomGenerated = true;
          result.sbomGenerationTime = sbomResult.generationTime;
          
          this.logger.info(`SBOM сгенерирован: ${sbomResult.componentsCount} компонентов`);
        } catch (sbomError) {
          this.logger.warn('Не удалось сгенерировать SBOM:', sbomError.message);
          result.sbomError = sbomError.message;
          result.sbomGenerated = false;
        }
      } else {
        result.sbomGenerated = false;
      }
      
      this.history.push({
        ...result,
        url,
        date: new Date().toISOString()
      });
      
      await this.saveHistory();
      
      this.logger.info(`Репозиторий клонирован: ${owner}/${repo} (ветка: ${actualBranch})`);
      
      return result;
      
    } catch (error) {
      this.logger.error('Ошибка клонирования:', error.message);
      throw new Error(`Не удалось скачать репозиторий: ${error.message}`);
    }
  }

  async gitClone(repoUrl, targetPath, branch = null, depth = 1) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    let cloneCmd = `${this.gitBinary} clone`;
    
    if (branch) {
      cloneCmd += ` --branch ${branch}`;
    }
    
    cloneCmd += ` --depth ${depth}`;
    cloneCmd += ` --single-branch`;
    cloneCmd += ` ${repoUrl} ${targetPath}`;
    
    this.logger.debug(`Выполняем: ${cloneCmd}`);
    
    try {
      await execAsync(cloneCmd, { 
        timeout: this.gitTimeout,
        maxBuffer: 1024 * 1024 * 10
      });
    } catch (error) {
      if (error.message.includes('not found') && branch) {
        this.logger.warn(`Ветка ${branch} не найдена, клонируем без указания ветки`);
        
        let fallbackCmd = `${this.gitBinary} clone`;
        fallbackCmd += ` --depth ${depth}`;
        fallbackCmd += ` ${repoUrl} ${targetPath}`;
        
        await execAsync(fallbackCmd, { 
          timeout: this.gitTimeout,
          maxBuffer: 1024 * 1024 * 10
        });
      } else {
        throw error;
      }
    }
  }

  async getCommitInfo(repoPath) {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const commands = [
        `${this.gitBinary} log -1 --pretty=format:'{"hash":"%H","shortHash":"%h","author":"%an","email":"%ae","date":"%ad","message":"%s"}'`,
        `${this.gitBinary} branch --show-current`,
        `${this.gitBinary} status --short`
      ];
      
      const results = {
        commit: null,
        currentBranch: null,
        status: 'clean'
      };
      
      for (const cmd of commands) {
        try {
          const { stdout } = await execAsync(cmd, { cwd: repoPath });
          
          if (cmd.includes('log')) {
            try {
              results.commit = JSON.parse(stdout.replace(/'/g, '"'));
            } catch (parseError) {}
          } else if (cmd.includes('branch')) {
            results.currentBranch = stdout.trim();
          } else if (cmd.includes('status')) {
            if (stdout.trim().length > 0) {
              results.status = 'dirty';
            }
          }
        } catch (error) {}
      }
      
      return results;
    } catch (error) {
      return {
        commit: null,
        currentBranch: null,
        status: 'unknown'
      };
    }
  }

  async getDirectorySize(path) {
    try {
      let totalSize = 0;
      
      const calculateSize = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          if (entry.isDirectory() && entry.name === '.git') {
            continue;
          }
          
          if (entry.isDirectory()) {
            await calculateSize(fullPath);
          } else {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          }
        }
      };
      
      await calculateSize(path);
      return totalSize;
    } catch {
      return 0;
    }
  }

  async countFiles(path) {
    try {
      let count = 0;
      
      const countFilesRecursive = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          if (entry.isDirectory() && entry.name === '.git') {
            continue;
          }
          
          if (entry.isDirectory()) {
            await countFilesRecursive(fullPath);
          } else {
            count++;
          }
        }
      };
      
      await countFilesRecursive(path);
      return count;
    } catch {
      return 0;
    }
  }

  async getDownloadHistory() {
    return this.history || [];
  }

  async clearCache() {
    this.cache.clear();
    
    if (this.downloadDir) {
      try {
        const files = await fs.readdir(this.downloadDir);
        for (const file of files) {
          const filePath = join(this.downloadDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isDirectory() && file !== 'history.json') {
            await fs.rm(filePath, { recursive: true, force: true });
          }
        }
      } catch (error) {
        this.logger.warn('Не удалось очистить кэш:', error.message);
      }
    }
    
    this.logger.info('Кэш очищен');
  }

  async cleanup() {
    await this.saveHistory();
    this.logger.info('GitHub Downloader завершил работу');
  }

  async getBranches(url) {
    return await this.getAvailableBranches(url);
  }

  async getTags(url) {
    try {
      const { owner, repo } = this.extractRepoInfo(url);
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/tags`;
      
      const response = await this.makeGitHubRequest(apiUrl);
      
      if (Array.isArray(response)) {
        return response.map(tag => ({
          name: tag.name,
          commit: tag.commit ? tag.commit.sha : null
        }));
      } else {
        return [];
      }
    } catch (error) {
      this.logger.warn('Не удалось получить теги:', error.message);
      return [];
    }
  }
}

export { GitHubDownloader };