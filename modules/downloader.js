import fs from 'fs/promises';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { SbomGenerator } from './sca/sbom.js';

// Получаем __dirname в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

class GitHubDownloader {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || './cache';
    this.downloadDir = options.downloadDir || './downloads';
    this.logger = options.logger || console;
    this.cache = new Map();
    this.historyFile = join(this.downloadDir, 'history.json');
    this.maxCacheSize = options.maxCacheSize || 100 * 1024 * 1024;
    this.gitBinary = options.gitBinary || 'git';
    this.gitTimeout = options.gitTimeout || 300000; // 5 минут
    this.defaultBranch = options.defaultBranch || 'auto'; // 'auto', 'main', или 'master'
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
    
    // Опции для SBOM генерации
    this.generateSbom = options.generateSbom !== false; // По умолчанию true
    this.sbomOptions = options.sbomOptions || {};
  }

  async initialize() {
    await this.ensureDir(this.cacheDir);
    await this.ensureDir(this.downloadDir);
    await this.loadHistory();
    
    const hasGit = await this.checkGitAvailability();
    if (!hasGit) {
      throw new Error('Git не установлен. Установите git: https://git-scm.com/downloads');
    }
    
    this.logger.info('GitHub Downloader инициализирован (использует git clone)');
    
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
    try {
      const data = await fs.readFile(this.historyFile, 'utf8');
      this.history = JSON.parse(data);
    } catch {
      this.history = [];
    }
  }

  async saveHistory() {
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
        // Попробуем прочитать текст ошибки
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
        } catch {
          // Игнорируем ошибки чтения тела
        }
        
        if (response.status === 404) {
          throw new Error(`Ресурс не найден: ${errorText}`);
        } else if (response.status === 403) {
          // Rate limiting
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
        // Если ответ не JSON, возвращаем текст
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
    // Если указана конкретная ветка по умолчанию
    if (this.defaultBranch === 'main') return 'main';
    if (this.defaultBranch === 'master') return 'master';
    
    try {
      // Пытаемся определить ветку по умолчанию через GitHub API
      const { owner, repo } = this.extractRepoInfo(url);
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
      
      const response = await this.makeGitHubRequest(apiUrl, 5000);
      
      if (response && response.default_branch) {
        return response.default_branch;
      }
    } catch (error) {
      this.logger.debug('Не удалось определить ветку по умолчанию через API:', error.message);
    }
    
    // Fallback: пытаемся определить наиболее вероятную ветку
    return await this.guessDefaultBranch(url);
  }

  async guessDefaultBranch(url) {
    // Пробуем популярные имена веток
    const commonBranches = ['main', 'master', 'develop', 'trunk'];
    
    for (const branch of commonBranches) {
      const exists = await this.checkBranchExists(url, branch);
      if (exists) {
        return branch;
      }
    }
    
    // Если ничего не нашли, возвращаем 'main' как наиболее распространенную
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
    const startTime = Date.now();
    
    try {
      const { owner, repo } = this.extractRepoInfo(url);
      
      // Определяем ветку для клонирования
      let branch = options.branch;
      if (!branch) {
        if (options.useDefaultBranch !== false) {
          // Получаем информацию о репозитории для определения ветки по умолчанию
          const repoInfo = await this.getRepositoryInfo(url);
          branch = repoInfo.defaultBranch;
        } else {
          // Используем стратегию из настроек
          branch = this.defaultBranch === 'auto' ? 'main' : this.defaultBranch;
        }
      }
      
      const depth = options.depth || 1;
      const generateSbom = options.generateSbom !== undefined ? options.generateSbom : this.generateSbom;
      
      const cacheKey = `${owner}/${repo}/${branch}`;
      
      /*if (this.cache.has(cacheKey) && !options.force) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < (options.cacheTTL || 3600000)) {
          this.logger.info(`Используем кэшированную версию: ${cacheKey}`);
          return cached.data;
        }
      }*/
      
      const timestamp = Date.now();
      const downloadPath = join(
        this.downloadDir,
        `${owner}_${repo}_${branch}_${timestamp}`
      );
      
      await this.ensureDir(downloadPath);
      
      const repoUrl = url.includes('://') ? url : `https://github.com/${owner}/${repo}.git`;
      
      this.logger.info(`Начинаем клонирование: ${repoUrl} (branch: ${branch})`);
      
      // Выполняем git clone
      await this.gitClone(repoUrl, downloadPath, branch, depth);
      
      // Получаем информацию о репозитории
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
      
      // Получаем информацию о коммите
      const commitInfo = await this.getCommitInfo(downloadPath);
      
      // Проверяем, какая ветка была фактически клонирована
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
        directUrl: `/downloads/${basename(downloadPath)}`,
        branches: await this.getAvailableBranches(url)
      };
      
      // ГЕНЕРАЦИЯ SBOM (если включена)
      if (generateSbom) {
        try {
          const sbomResult = await this.sbomGenerator.generateSbom(downloadPath, repoInfo, result);
          result.sbom = sbomResult.sbom;
          result.sbomFilePath = sbomResult.filePath;
          result.componentsCount = sbomResult.componentsCount;
          result.dependenciesCount = sbomResult.dependenciesCount;
          result.directDepsCount = sbomResult.directDepsCount;
          result.transitiveDepsCount = sbomResult.transitiveDepsCount;
          result.sbomGenerated = true;
          result.sbomGenerationTime = sbomResult.generationTime;
          result.sbomFormat = sbomResult.format;
          
          this.logger.info(`SBOM сгенерирован успешно: ${sbomResult.componentsCount} компонентов, ${sbomResult.dependenciesCount} зависимостей`);
        } catch (sbomError) {
          this.logger.warn('Не удалось сгенерировать SBOM:', sbomError.message);
          result.sbomError = sbomError.message;
          result.sbomGenerated = false;
        }
      } else {
        this.logger.info('Генерация SBOM пропущена (отключена в настройках)');
        result.sbomGenerated = false;
      }
      
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });
      
      this.history.push({
        ...result,
        url,
        date: new Date().toISOString()
      });
      
      await this.saveHistory();
      await this.cleanupCache();
      
      this.logger.info(`Репозиторий успешно клонирован: ${owner}/${repo} (ветка: ${actualBranch})`);
      
      return result;
      
    } catch (error) {
      this.logger.error('Ошибка клонирования репозитория:', {
        message: error.message,
        url: url,
        stack: error.stack
      });
      
      if (error.message.includes('Command failed') || error.message.includes('git')) {
        if (error.message.includes('Repository not found')) {
          throw new Error('Репозиторий не найден. Проверьте URL и доступность репозитория.');
        }
        if (error.message.includes('could not read')) {
          throw new Error('Нет доступа к репозиторию. Возможно, требуется аутентификация.');
        }
        if (error.message.includes('branch') && error.message.includes('not found')) {
          const branch = options.branch || 'default';
          throw new Error(`Ветка "${branch}" не найдена в репозитории. Используйте getAvailableBranches() для получения списка доступных веток.`);
        }
        
        throw new Error(`Ошибка git clone: ${error.message}\n\nУбедитесь, что:\n1. Git установлен (https://git-scm.com/downloads)\n2. Репозиторий существует и доступен\n3. У вас есть права на чтение репозитория`);
      }
      
      if (error.code === 'ENOTFOUND') {
        throw new Error('Не удалось подключиться к GitHub. Проверьте интернет-соединение.');
      }
      
      throw new Error(`Не удалось скачать репозиторий: ${error.message}`);
    }
  }

  async gitClone(repoUrl, targetPath, branch = null, depth = 1) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    let cloneCmd = `${this.gitBinary} clone`;
    
    // Добавляем опцию ветки если указана
    if (branch) {
      cloneCmd += ` --branch ${branch}`;
    }
    
    // Опции для оптимизации
    cloneCmd += ` --depth ${depth}`;
    cloneCmd += ` --single-branch`;
    
    cloneCmd += ` ${repoUrl} ${targetPath}`;
    
    this.logger.debug(`Выполняем команду: ${cloneCmd}`);
    
    try {
      await execAsync(cloneCmd, { 
        timeout: this.gitTimeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });
    } catch (error) {
      // Если указанная ветка не найдена, пробуем клонировать без указания ветки
      if (error.message.includes('not found') && branch) {
        this.logger.warn(`Ветка ${branch} не найдена, пробуем клонировать без указания ветки`);
        
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
        `${this.gitBinary} log -1 --pretty=format:'{"hash":"%H","shortHash":"%h","author":"%an","email":"%ae","date":"%ad","message":"%s","authorDate":"%aI","commitDate":"%cI"}'`,
        `${this.gitBinary} remote -v`,
        `${this.gitBinary} branch --show-current`,
        `${this.gitBinary} tag --points-at HEAD`,
        `${this.gitBinary} status --short`
      ];
      
      const results = {
        commit: null,
        remote: null,
        currentBranch: null,
        tags: [],
        status: 'clean'
      };
      
      for (const cmd of commands) {
        try {
          const { stdout } = await execAsync(cmd, { cwd: repoPath });
          
          if (cmd.includes('log')) {
            try {
              results.commit = JSON.parse(stdout.replace(/'/g, '"'));
            } catch (parseError) {
              this.logger.warn('Ошибка парсинга информации о коммите:', parseError.message);
            }
          } else if (cmd.includes('remote')) {
            results.remote = stdout.trim().split('\n')[0];
          } else if (cmd.includes('branch')) {
            results.currentBranch = stdout.trim();
          } else if (cmd.includes('tag')) {
            const tags = stdout.trim().split('\n').filter(tag => tag.trim());
            if (tags.length > 0) {
              results.tags = tags;
            }
          } else if (cmd.includes('status')) {
            if (stdout.trim().length > 0) {
              results.status = 'dirty';
              results.uncommittedChanges = stdout.trim().split('\n').length;
            }
          }
        } catch (error) {
          this.logger.debug(`Ошибка выполнения команды ${cmd}:`, error.message);
        }
      }
      
      return results;
    } catch (error) {
      this.logger.warn('Не удалось получить информацию о коммите:', error.message);
      return {
        commit: null,
        remote: null,
        currentBranch: null,
        tags: [],
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

  // Методы для работы с SBOM генератором
  async generateSbomForExistingDownload(downloadPath) {
    try {
      // Получаем информацию о репозитории из пути
      const pathParts = basename(downloadPath).split('_');
      if (pathParts.length < 4) {
        throw new Error('Неверный формат пути загрузки');
      }
      
      const owner = pathParts[0];
      const repo = pathParts[1];
      const branch = pathParts[2];
      
      const repoInfo = {
        owner,
        repo,
        url: `https://github.com/${owner}/${repo}`,
        cloneUrl: `https://github.com/${owner}/${repo}.git`
      };
      
      const downloadResult = {
        branch,
        downloadPath,
        size: await this.getDirectorySize(downloadPath),
        files: await this.countFiles(downloadPath)
      };
      
      return await this.sbomGenerator.generateSbom(downloadPath, repoInfo, downloadResult);
    } catch (error) {
      this.logger.error('Ошибка генерации SBOM для существующей загрузки:', error);
      throw error;
    }
  }

  async generateSbomForHistoryEntry(historyId) {
    const entry = this.history.find(h => h.id === historyId);
    if (!entry) {
      throw new Error(`Запись истории с ID ${historyId} не найдена`);
    }
    
    try {
      const repoInfo = entry.info;
      const downloadResult = {
        branch: entry.actualBranch || entry.requestedBranch,
        downloadPath: entry.downloadPath,
        size: entry.size,
        files: entry.files,
        timestamp: entry.timestamp,
        commit: entry.commit
      };
      
      return await this.sbomGenerator.generateSbom(entry.downloadPath, repoInfo, downloadResult);
    } catch (error) {
      this.logger.error(`Ошибка генерации SBOM для записи истории ${historyId}:`, error);
      throw error;
    }
  }

  async getDownloadHistory() {
    return this.history;
  }

  async clearCache() {
    this.cache.clear();
    
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
      this.logger.warn('Не удалось очистить кэш на диске:', error.message);
    }
    
    this.logger.info('Кэш очищен');
  }

  async cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > 24 * 3600000) {
        this.cache.delete(key);
      }
    }
    
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
      await this.saveHistory();
    }
  }

  async cleanup() {
    await this.saveHistory();
    this.logger.info('GitHub Downloader завершил работу');
  }

  // Дополнительные методы для работы с ветками

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
          commit: tag.commit ? tag.commit.sha : null,
          zipball_url: tag.zipball_url,
          tarball_url: tag.tarball_url
        }));
      } else {
        this.logger.warn('Некорректный ответ при получении тегов');
        return [];
      }
    } catch (error) {
      this.logger.warn('Не удалось получить список тегов:', error.message);
      return [];
    }
  }

  async downloadSpecificCommit(url, commitHash, options = {}) {
    const startTime = Date.now();
    
    try {
      const { owner, repo } = this.extractRepoInfo(url);
      
      const timestamp = Date.now();
      const downloadPath = join(
        this.downloadDir,
        `${owner}_${repo}_commit_${commitHash.substring(0, 8)}_${timestamp}`
      );
      
      await this.ensureDir(downloadPath);
      
      const repoUrl = url.includes('://') ? url : `https://github.com/${owner}/${repo}.git`;
      
      this.logger.info(`Клонирование конкретного коммита: ${commitHash.substring(0, 8)}`);
      
      // Клонируем репозиторий
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Клонируем с глубиной 1 для экономии места
      await execAsync(`${this.gitBinary} clone --depth 1 ${repoUrl} ${downloadPath}`);
      
      // Переходим на конкретный коммит
      await execAsync(`${this.gitBinary} checkout ${commitHash}`, { cwd: downloadPath });
      
      const repoInfo = await this.getRepositoryInfo(url);
      const commitInfo = await this.getCommitInfo(downloadPath);
      
      const result = {
        id: `${owner}_${repo}_commit_${commitHash.substring(0, 8)}_${timestamp}`,
        owner,
        repo,
        commit: commitHash,
        downloadPath,
        repoUrl,
        size: await this.getDirectorySize(downloadPath),
        files: await this.countFiles(downloadPath),
        timestamp,
        downloadTime: Date.now() - startTime,
        info: repoInfo,
        commitInfo,
        directUrl: `/downloads/${basename(downloadPath)}`
      };
      
      this.history.push({
        ...result,
        url,
        date: new Date().toISOString()
      });
      
      await this.saveHistory();
      
      return result;
      
    } catch (error) {
      this.logger.error('Ошибка клонирования коммита:', error.message);
      throw new Error(`Не удалось скачать коммит ${commitHash}: ${error.message}`);
    }
  }

  async downloadTag(url, tagName, options = {}) {
    const startTime = Date.now();
    
    try {
      const { owner, repo } = this.extractRepoInfo(url);
      
      const timestamp = Date.now();
      const downloadPath = join(
        this.downloadDir,
        `${owner}_${repo}_tag_${tagName}_${timestamp}`
      );
      
      await this.ensureDir(downloadPath);
      
      const repoUrl = url.includes('://') ? url : `https://github.com/${owner}/${repo}.git`;
      
      this.logger.info(`Клонирование тега: ${tagName}`);
      
      // Клонируем репозиторий с конкретным тегом
      await this.gitClone(repoUrl, downloadPath, tagName, options.depth || 1);
      
      const repoInfo = await this.getRepositoryInfo(url);
      const commitInfo = await this.getCommitInfo(downloadPath);
      
      const result = {
        id: `${owner}_${repo}_tag_${tagName}_${timestamp}`,
        owner,
        repo,
        tag: tagName,
        downloadPath,
        repoUrl,
        size: await this.getDirectorySize(downloadPath),
        files: await this.countFiles(downloadPath),
        timestamp,
        downloadTime: Date.now() - startTime,
        info: repoInfo,
        commitInfo,
        directUrl: `/downloads/${basename(downloadPath)}`
      };
      
      this.history.push({
        ...result,
        url,
        date: new Date().toISOString()
      });
      
      await this.saveHistory();
      
      return result;
      
    } catch (error) {
      this.logger.error('Ошибка клонирования тега:', error.message);
      throw new Error(`Не удалось скачать тег ${tagName}: ${error.message}`);
    }
  }

  // Утилитарные методы

  async getRepoStats(url) {
    try {
      const { owner, repo } = this.extractRepoInfo(url);
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
      
      const response = await this.makeGitHubRequest(apiUrl);
      
      if (response && typeof response === 'object') {
        return {
          stars: response.stargazers_count || 0,
          forks: response.forks_count || 0,
          watchers: response.watchers_count || 0,
          openIssues: response.open_issues_count || 0,
          license: response.license ? response.license.spdx_id : null,
          createdAt: response.created_at,
          updatedAt: response.updated_at,
          pushedAt: response.pushed_at,
          size: response.size,
          defaultBranch: response.default_branch,
          archived: response.archived || false,
          disabled: response.disabled || false
        };
      } else {
        this.logger.warn('Некорректный ответ при получении статистики');
        return null;
      }
    } catch (error) {
      this.logger.warn('Не удалось получить статистику репозитория:', error.message);
      return null;
    }
  }

  async searchRepositories(query, options = {}) {
    try {
      const searchUrl = 'https://api.github.com/search/repositories?q=' + encodeURIComponent(query) + 
        '&sort=' + (options.sort || 'stars') +
        '&order=' + (options.order || 'desc') +
        '&per_page=' + (options.limit || 10) +
        '&page=' + (options.page || 1);
      
      const response = await this.makeGitHubRequest(searchUrl, 15000);
      
      if (response && typeof response === 'object') {
        return {
          totalCount: response.total_count,
          items: (response.items || []).map(item => ({
            name: item.name,
            fullName: item.full_name,
            owner: item.owner.login,
            description: item.description,
            stars: item.stargazers_count,
            forks: item.forks_count,
            language: item.language,
            defaultBranch: item.default_branch,
            url: item.html_url,
            cloneUrl: item.clone_url,
            createdAt: item.created_at,
            updatedAt: item.updated_at
          }))
        };
      } else {
        throw new Error('Некорректный ответ от GitHub API при поиске');
      }
    } catch (error) {
      this.logger.error('Ошибка поиска репозиториев:', error.message);
      throw error;
    }
  }
}

// Экспортируем класс
export { GitHubDownloader };