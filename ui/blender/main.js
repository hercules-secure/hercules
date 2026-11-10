import { 
    formatBytes, 
    delay, 
    escapeHtml, 
    loadJSZip, 
    createZipArchive,
    generateSummaryHTML,
    generateDependenciesHTML,
    generateCodeHTML,
    generateHTMLReport
} from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    let selectedArchive = null;
    let selectedFolder = null;
    let selectedFolderFiles = [];
    let currentSource = 'git';
    let currentTaskId = null;
    let currentReport = null;
    let progressInterval = null;
    let currentOverallProgress = 0;

    const repoInput = document.getElementById('repo');
    const startBtn = document.getElementById('start-btn');
    const branchInput = document.getElementById('branchName');
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const archiveStartBtn = document.getElementById('archive-start-btn');
    const archiveFileInfo = document.getElementById('archiveFileInfo');
    const localFolderInput = document.getElementById('localFolderInput');
    const localUploadArea = document.getElementById('localUploadArea');
    const localStartBtn = document.getElementById('local-start-btn');
    const localFolderInfo = document.getElementById('localFolderInfo');
    const overallProgress = document.getElementById('overallProgress');
    const overallPercent = document.getElementById('overallPercent');

    const API_BASE_URL = '/api/blender';

    // ============================================================
    // TOKEN STORAGE (по домену, как в SCA)
    // ============================================================

    const TOKEN_STORAGE_KEY = 'hercules_repo_tokens';
    let pendingAnalysisRequest = null;

    function getStoredToken(host) {
        try {
            const all = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || '{}');
            return all[host] || null;
        } catch { return null; }
    }

    function setStoredToken(host, token) {
        try {
            const all = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || '{}');
            if (token) all[host] = token;
            else delete all[host];
            localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(all));
        } catch { /* ignore */ }
    }

    function deleteStoredToken(host) {
        setStoredToken(host, null);
    }

    function safeHost(repoUrl) {
        try {
            return new URL(/^https?:\/\//i.test(repoUrl) ? repoUrl : `https://${repoUrl}`).hostname.toLowerCase();
        } catch { return ''; }
    }

    // ============================================================
    // TOKEN MODAL
    // ============================================================

    function openTokenModal({ host, request, errorMessage }) {
        pendingAnalysisRequest = request || null;

        const modal = document.getElementById('tokenModal');
        const hostEl = document.getElementById('tokenHost');
        const input = document.getElementById('tokenInput');
        const errEl = document.getElementById('tokenError');

        if (hostEl) hostEl.textContent = host || 'репозиторий';
        if (input) {
            input.value = getStoredToken(host) || '';
            input.type = 'password';
        }
        if (errEl) {
            if (errorMessage) {
                errEl.hidden = false;
                errEl.textContent = errorMessage;
            } else {
                errEl.hidden = true;
                errEl.textContent = '';
            }
        }

        modal.classList.add('show');
        setTimeout(() => input && input.focus(), 50);
    }

    window.closeTokenModal = function () {
        const modal = document.getElementById('tokenModal');
        if (modal) modal.classList.remove('show');
        pendingAnalysisRequest = null;
    };

    const tokenToggle = document.getElementById('tokenToggleVisibility');
    const tokenInput = document.getElementById('tokenInput');
    const tokenSubmit = document.getElementById('tokenSubmitBtn');

    if (tokenToggle && tokenInput) {
        tokenToggle.addEventListener('click', () => {
            tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
            const icon = tokenToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    }

    if (tokenSubmit) {
        tokenSubmit.addEventListener('click', async () => {
            const input = document.getElementById('tokenInput');
            const errEl = document.getElementById('tokenError');

            const token = (input?.value || '').trim();
            if (!token) {
                if (errEl) {
                    errEl.hidden = false;
                    errEl.textContent = 'Введите токен.';
                }
                return;
            }

            const req = pendingAnalysisRequest;
            window.closeTokenModal();

            if (req && typeof req.retry === 'function') {
                try {
                    await req.retry(token);
                } catch (e) {
                    if (e.status === 403) {
                        openTokenModal({
                            host: req.host,
                            request: req,
                            errorMessage: 'Токен не подошёл (403). Проверьте scope read_repository.'
                        });
                    } else {
                        stopProgressEmulation();
                        showAlert(`Error: ${e.message}`, 'error');
                        activateButton(startBtn);
                    }
                }
            }
        });
    }

    if (tokenInput) {
        tokenInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('tokenSubmitBtn')?.click();
            }
        });
    }

    // ============================================================
    // ACCESS CHECKER (как в SCA)
    // ============================================================

    function detectPlatform(url) {
        try {
            const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
            if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
            if (host.includes('gitlab') || host.includes('gitlib')) return 'gitlab';
        } catch { /* ignore */ }
        return 'unknown';
    }

    async function checkGitLabAccess(url) {
        const raw = url.trim().replace(/\.git$/, '');
        let u;
        try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); }
        catch { return { accessible: false, requiresAuth: false, error: 'Invalid GitLab URL' }; }

        const host = u.hostname.toLowerCase();
        const projectPath = u.pathname.replace(/^\//, '').replace(/\/$/, '');
        const baseUrl = `${u.protocol}//${host}`;
        const apiUrl = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectPath)}`;

        try {
            const r = await fetch(apiUrl, {
                headers: { 'Accept': 'application/json', 'User-Agent': 'Hercules-SAST' }
            });

            if (r.status === 200) {
                const data = await r.json().catch(() => ({}));
                return { accessible: true, requiresAuth: false, isPrivate: data.visibility === 'private', platform: 'gitlab', baseUrl, host, projectPath };
            }

            if (r.status === 401 || r.status === 403 || r.status === 404) {
                const saved = getStoredToken(host);
                if (saved) {
                    const r2 = await fetch(apiUrl, {
                        headers: { 'Accept': 'application/json', 'PRIVATE-TOKEN': saved, 'User-Agent': 'Hercules-SAST' }
                    });
                    if (r2.status === 200) {
                        const data = await r2.json().catch(() => ({}));
                        return { accessible: true, requiresAuth: true, token: saved, isPrivate: data.visibility === 'private', platform: 'gitlab', baseUrl, host, projectPath };
                    }
                    deleteStoredToken(host);
                }
                return { accessible: false, requiresAuth: true, platform: 'gitlab', baseUrl, host, projectPath };
            }

            return { accessible: false, requiresAuth: false, error: `HTTP ${r.status}`, platform: 'gitlab', baseUrl, host, projectPath };
        } catch (e) {
            return { accessible: false, requiresAuth: false, error: e.message, platform: 'gitlab', baseUrl, host, projectPath, network: true };
        }
    }

    async function checkGitHubAccess(url) {
        const m = url.match(/(?:github\.com[\/:]|^)([^\/]+)\/([^\/\.]+)/);
        if (!m) return { accessible: false, requiresAuth: false, error: 'Invalid GitHub URL' };

        const owner = m[1];
        const repo = m[2].replace('.git', '');
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

        try {
            const r = await fetch(apiUrl, {
                headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Hercules-SAST' }
            });

            if (r.status === 200) {
                const data = await r.json().catch(() => ({}));
                return { accessible: true, requiresAuth: false, isPrivate: data.private === true, platform: 'github', host: 'github.com' };
            }

            if (r.status === 401 || r.status === 403 || r.status === 404) {
                const saved = getStoredToken('github.com');
                if (saved) {
                    const r2 = await fetch(apiUrl, {
                        headers: { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `token ${saved}`, 'User-Agent': 'Hercules-SAST' }
                    });
                    if (r2.status === 200) {
                        const data = await r2.json().catch(() => ({}));
                        return { accessible: true, requiresAuth: true, token: saved, isPrivate: data.private === true, platform: 'github', host: 'github.com' };
                    }
                    deleteStoredToken('github.com');
                }
                return { accessible: false, requiresAuth: true, platform: 'github', host: 'github.com' };
            }

            return { accessible: false, requiresAuth: false, error: `HTTP ${r.status}`, platform: 'github', host: 'github.com' };
        } catch (e) {
            return { accessible: false, requiresAuth: false, error: e.message, platform: 'github', host: 'github.com', network: true };
        }
    }

    async function checkRepositoryAccess(url) {
        const platform = detectPlatform(url);
        if (platform === 'github') return checkGitHubAccess(url);
        if (platform === 'gitlab') return checkGitLabAccess(url);
        return { accessible: false, requiresAuth: false, error: 'Unknown platform' };
    }

    // ============================================================
    // ФИЛЬТР ПУТЕЙ ДЛЯ ЛОКАЛЬНОГО ПРОЕКТА
    // ============================================================

    const BLOCKED_SEGMENTS = [
        'node_modules',
        '.git', '.svn', '.hg',
        '.DS_Store', 'Thumbs.db',
        '__pycache__', '.pytest_cache', '.mypy_cache',
        '.idea', '.vscode',
        '.next', '.nuxt', '.cache', '.parcel-cache', '.turbo',
        'dist', 'build', 'out', 'coverage',
        'vendor', 'target', 'obj', 'bin',
        '.venv', 'venv', 'env',
        'bower_components',
        '.env'
    ];
    const BLOCKED_PREFIXES = ['.env'];
    const BLOCKED_EXTENSIONS = ['.log', '.tmp', '.swp', '.swo', '.pid', '.lock'];

    function isBlockedFilePath(file) {
        const rel = file.webkitRelativePath || file.name;
        if (!rel) return true;

        const parts = rel.split('/');
        const inner = parts.slice(1);

        for (const p of inner) {
            if (BLOCKED_SEGMENTS.includes(p)) return true;
            if (BLOCKED_PREFIXES.some(prefix => p.startsWith(prefix))) return true;
        }

        const nameParts = file.name.split('.');
        if (nameParts.length > 1) {
            const ext = '.' + nameParts.pop().toLowerCase();
            if (BLOCKED_EXTENSIONS.includes(ext)) return true;
        }

        return false;
    }

    // ============================================================
    // THERMOMETER FUNCTIONS
    // ============================================================

    function updateOverallProgress(percent) {
        const overallProgressEl = document.getElementById('overallProgress');
        const overallPercentEl = document.getElementById('overallPercent');
        if (overallProgressEl) overallProgressEl.style.width = `${percent}%`;
        if (overallPercentEl) overallPercentEl.textContent = `${Math.round(percent)}%`;
        currentOverallProgress = percent;
    }

    function updateStepStatus(step, status) {
        const dot = document.getElementById(`markDot${step}`);
        const label = document.getElementById(`markLabel${step}`);

        if (dot) {
            dot.classList.remove('completed', 'active');
            if (status === 'completed') dot.classList.add('completed');
            else if (status === 'active') dot.classList.add('active');
        }

        if (label) {
            label.classList.remove('completed', 'active');
            if (status === 'completed') label.classList.add('completed');
            else if (status === 'active') label.classList.add('active');
        }
    }

    function updateStepProgress(step, percent) {
        const dot = document.getElementById(`markDot${step}`);
        if (dot && percent !== undefined) {
            dot.setAttribute('data-progress', `${Math.round(percent)}%`);
        }
    }

    function resetAllProgress() {
        stopProgressEmulation();
        updateOverallProgress(0);
        for (let i = 1; i <= 7; i++) {
            updateStepStatus(i, 'pending');
            updateStepProgress(i, 0);
        }
        currentOverallProgress = 0;
        currentTaskId = null;
    }

    function startProgressEmulation() {
        stopProgressEmulation();

        let currentStep = 1;
        let currentStepProgress = 0;

        updateStepStatus(1, 'active');

        progressInterval = setInterval(() => {
            if (currentStep > 7) {
                updateOverallProgress(100);
                stopProgressEmulation();
                return;
            }

            currentStepProgress += Math.random() * 15 + 5;

            if (currentStepProgress >= 100) {
                updateStepStatus(currentStep, 'completed');
                updateStepProgress(currentStep, 100);
                currentStep++;
                currentStepProgress = 0;
                if (currentStep <= 7) updateStepStatus(currentStep, 'active');
            } else {
                updateStepProgress(currentStep, currentStepProgress);
            }

            const completedSteps = currentStep - 1;
            const overallProgressValue = ((completedSteps * 100) + currentStepProgress) / 7;
            updateOverallProgress(overallProgressValue);

        }, 800);
    }

    function stopProgressEmulation() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    function completeProgress() {
        stopProgressEmulation();
        for (let i = 1; i <= 7; i++) {
            updateStepStatus(i, 'completed');
            updateStepProgress(i, 100);
        }
        updateOverallProgress(100);
    }

    // ============================================================
    // API FUNCTIONS
    // ============================================================

    async function callAPI(endpoint, method = 'GET', data = null) {
        const url = `${API_BASE_URL}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json'
        };

        const options = { 
            method: method, 
            headers: headers 
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    }

    async function analyzeGitRepo(url, branch, token = null) {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) headers['X-Git-Token'] = token;

        const response = await fetch(`${API_BASE_URL}/git`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ url, branch })
        });

        let payload = {};
        try { payload = await response.json(); } catch { /* ignore */ }

        if (!response.ok) {
            const err = new Error(payload.error || `HTTP ${response.status}`);
            err.status = response.status;
            err.payload = payload;
            err.host = safeHost(url);
            throw err;
        }

        if (payload && payload.success === false) {
            const msg = String(payload.error || '');
            const looksLike403 =
                payload.needsToken === true ||
                payload.code === 403 ||
                /403|forbidden|unauthorized/i.test(msg);

            const err = new Error(msg || 'Analysis failed');
            err.status = looksLike403 ? 403 : 500;
            err.payload = payload;
            err.host = safeHost(url);
            throw err;
        }

        return payload;
    }

    async function getAnalysisResult(taskId) {
        return callAPI(`/result/${taskId}`, 'GET');
    }

    async function uploadArchive(blob, fileName) {
        const formData = new FormData();
        formData.append('file', blob, fileName);

        const response = await fetch(`${API_BASE_URL}/analyze/archive/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Archive upload error');
        }

        return await response.json();
    }

    // ============================================================
    // BUTTON MANAGEMENT
    // ============================================================

    function activateButton(button) {
        if (button) {
            button.disabled = false;
            button.classList.add('active');
        }
    }

    function deactivateButton(button) {
        if (button) {
            button.disabled = true;
            button.classList.remove('active');
        }
    }

    // ============================================================
    // UI FUNCTIONS
    // ============================================================

    function showAlert(message, type) {
        const alertDiv = document.getElementById('alertMessage');
        if (alertDiv) {
            alertDiv.className = `alert-message ${type}`;
            alertDiv.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'info' ? 'fa-info-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
            setTimeout(() => {
                if (alertDiv.className === `alert-message ${type}`) hideAlert();
            }, 5000);
        }
    }

    function hideAlert() {
        const alertDiv = document.getElementById('alertMessage');
        if (alertDiv) alertDiv.className = 'alert-message';
    }

    function showArchiveProgress(percent, message) {
        const alertDiv = document.getElementById('alertMessage');
        if (alertDiv) {
            alertDiv.className = 'alert-message info';
            alertDiv.innerHTML = `<i class="fas fa-spinner fa-pulse"></i> ${message} (${percent}%)`;
        }
    }

    function pollTaskStatus(taskId, onComplete) {
        const maxAttempts = 120;
        let attempts = 0;

        const poll = setInterval(async () => {
            attempts++;

            try {
                const result = await getAnalysisResult(taskId);

                if (result.status === 'completed' || (result.sca && result.sast)) {
                    clearInterval(poll);
                    completeProgress();

                    showAlert('Analysis completed successfully!', 'success');
                    if (onComplete) onComplete(result);
                } else if (result.status === 'error') {
                    clearInterval(poll);
                    stopProgressEmulation();
                    showAlert(`Error: ${result.error}`, 'error');
                }

                if (attempts >= maxAttempts) {
                    clearInterval(poll);
                    stopProgressEmulation();
                    showAlert('Analysis timeout exceeded', 'error');
                }
            } catch (error) {
                // Continue polling
            }
        }, 5000);
    }

    // ============================================================
    // REPORT FUNCTIONS
    // ============================================================

    function transformReport(report) {
        let sastIssues = [];
        let sastStatistics = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

        if (report.sast) {
            if (report.sast.issues && Array.isArray(report.sast.issues)) {
                sastIssues = report.sast.issues;
                if (report.sast.statistics) {
                    sastStatistics = report.sast.statistics;
                } else {
                    sastStatistics = {
                        total: sastIssues.length,
                        critical: sastIssues.filter(i => i.severity === 'CRITICAL' || i.severity === 'critical').length,
                        high: sastIssues.filter(i => i.severity === 'HIGH' || i.severity === 'high').length,
                        medium: sastIssues.filter(i => i.severity === 'MEDIUM' || i.severity === 'medium').length,
                        low: sastIssues.filter(i => i.severity === 'LOW' || i.severity === 'low').length
                    };
                }
            }
        }

        let scaDependencies = [];
        let scaVulnerabilities = [];
        let scaStatistics = { totalDependencies: 0, totalVulnerabilities: 0 };
        let reachabilityStats = { reachable: 0, notReachable: 0, unknown: 0 };

        if (report.sca) {
            if (report.sca.dependencies && Array.isArray(report.sca.dependencies)) {
                scaDependencies = report.sca.dependencies;

                for (const dep of scaDependencies) {
                    if (dep.vulnerabilities && dep.vulnerabilities.count > 0 && dep.vulnerabilities.vulnerabilities) {
                        for (const vuln of dep.vulnerabilities.vulnerabilities) {
                            scaVulnerabilities.push({
                                package: dep.name,
                                version: dep.version,
                                ...vuln,
                                reachable: dep.isReachable || null,
                                usageFiles: dep.usageFiles || [],
                                usageLocations: dep.usageLocations || []
                            });
                        }
                    }
                    if (dep.isReachable === true) reachabilityStats.reachable++;
                    else if (dep.isReachable === false) reachabilityStats.notReachable++;
                    else if (dep.cveCount > 0) reachabilityStats.unknown++;
                }
            }

            if (report.sca.statistics) {
                scaStatistics = report.sca.statistics;
            } else {
                scaStatistics.totalDependencies = scaDependencies.length;
                scaStatistics.totalVulnerabilities = scaVulnerabilities.length;
            }
        }

        return {
            success: report.success,
            source: report.source,
            branch: report.branch,
            analyzedAt: report.analyzedAt,
            taskId: report.taskId,
            sca: {
                dependencies: scaDependencies,
                vulnerabilities: scaVulnerabilities,
                statistics: scaStatistics,
                reachability: reachabilityStats
            },
            sast: {
                issues: sastIssues,
                statistics: sastStatistics
            },
            structure: { files: report.fileCount || 0, directories: 0 },
            dependencies: { packages: scaDependencies },
            codeAnalysis: {
                filesProcessed: sastStatistics.total || 0,
                totalLines: 0,
                issues: sastIssues
            }
        };
    }

    function displayReport(report) {
        const transformed = transformReport(report);
        currentReport = transformed;

        const modal = document.getElementById('resultModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            renderResultTab('summary');
        } else {
            console.error('Modal element not found!');
        }
    }

    function renderResultTab(tabName) {
        const content = document.getElementById('resultContent');
        if (!content || !currentReport) return;

        const tabs = document.querySelectorAll('.result-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            const tabText = tab.textContent.toLowerCase();
            if (tabName === 'summary' && (tabText.includes('overview') || tabText.includes('summary'))) tab.classList.add('active');
            else if (tabName === 'dependencies' && (tabText.includes('dependencies') || tabText.includes('sca'))) tab.classList.add('active');
            else if (tabName === 'code' && (tabText.includes('code') || tabText.includes('sast'))) tab.classList.add('active');
        });

        try {
            switch(tabName) {
                case 'summary':
                    content.innerHTML = generateSummaryHTML(currentReport);
                    break;
                case 'dependencies':
                    content.innerHTML = generateDependenciesHTML(currentReport);
                    setTimeout(() => attachExpandHandlers(), 100);
                    break;
                case 'code':
                    content.innerHTML = generateCodeHTML(currentReport);
                    break;
                default:
                    content.innerHTML = generateSummaryHTML(currentReport);
            }
        } catch (error) {
            console.error('Error rendering tab:', error);
            content.innerHTML = `<div style="padding:20px;color:red;">Error: ${error.message}</div>`;
        }
    }

    function attachExpandHandlers() {
        const rows = document.querySelectorAll('.dep-row, .vuln-row');
        rows.forEach(row => {
            row.removeEventListener('click', handleRowClick);
            row.addEventListener('click', handleRowClick);
        });
    }

    function handleRowClick(e) {
        if (e.target.tagName === 'A') return;
        const detailsRow = this.nextElementSibling;
        const expandIcon = this.querySelector('.expand-icon');
        if (detailsRow && (detailsRow.classList.contains('dep-details-row') || detailsRow.classList.contains('details-row'))) {
            const isVisible = detailsRow.style.display === 'table-row';
            detailsRow.style.display = isVisible ? 'none' : 'table-row';
            if (expandIcon) {
                expandIcon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(90deg)';
            }
        }
    }

    // ============================================================
    // MAIN ANALYSIS (как в SCA: проверка → токен → анализ)
    // ============================================================

    async function startGitAnalysis() {
        if (!repoInput) return;
        const repo = repoInput.value.trim();
        const branch = branchInput?.value.trim() || null;

        if (!repo) {
            showAlert('Please enter a repository URL', 'error');
            return;
        }

        deactivateButton(startBtn);
        resetAllProgress();
        showAlert('Checking repository access...', 'info');

        const access = await checkRepositoryAccess(repo);

        // 1. Доступно (с сохранённым токеном или без)
        if (access.accessible) {
            startProgressEmulation();
            runBlenderAnalysis(repo, branch, access.token || null, access.host);
            return;
        }

        // 2. Нужен токен — показываем модалку
        if (access.requiresAuth) {
            openTokenModal({
                host: access.host,
                request: {
                    host: access.host,
                    retry: async (token) => {
                        setStoredToken(access.host, token);

                        const recheck = access.platform === 'github'
                            ? await checkGitHubAccess(repo)
                            : await checkGitLabAccess(repo);

                        if (!recheck.accessible) {
                            const err = new Error('Token rejected');
                            err.status = 403;
                            err.host = access.host;
                            throw err;
                        }

                        startProgressEmulation();
                        await runBlenderAnalysis(repo, branch, token, access.host);
                    }
                },
                errorMessage: 'Репозиторий защищён. Введите токен доступа.'
            });
            return;
        }

        // 3. CORS/сеть — пусть решает сервер
        if (access.network) {
            startProgressEmulation();
            runBlenderAnalysis(repo, branch, getStoredToken(access.host) || null, access.host);
            return;
        }

        showAlert(`Access error: ${access.error || 'unknown'}`, 'error');
        activateButton(startBtn);
    }

    async function runBlenderAnalysis(repo, branch, token, host) {
        try {
            const result = await analyzeGitRepo(repo, branch, token);
            handleGitAnalysisResult(result);
        } catch (error) {
            stopProgressEmulation();

            if (error.status === 403) {
                openTokenModal({
                    host: host || safeHost(repo),
                    request: {
                        host: host || safeHost(repo),
                        retry: async (newToken) => {
                            setStoredToken(host || safeHost(repo), newToken);
                            startProgressEmulation();
                            await runBlenderAnalysis(repo, branch, newToken, host);
                        }
                    },
                    errorMessage: token
                        ? 'Токен не подошёл (403). Проверьте scope read_repository.'
                        : 'Сервер вернул 403: репозиторий защищён. Введите токен доступа.'
                });
                return;
            }

            showAlert(`Error: ${error.message}`, 'error');
            activateButton(startBtn);
        }
    }

    function handleGitAnalysisResult(result) {
        if (result.success) {
            completeProgress();
            showAlert(`Analysis completed (ID: ${result.taskId})`, 'success');
            displayReport(result);
            activateButton(startBtn);
        } else {
            stopProgressEmulation();
            showAlert(`Error: ${result.error || 'Unknown error'}`, 'error');
            activateButton(startBtn);
        }
    }

    async function startArchiveAnalysis() {
        if (!selectedArchive) {
            showAlert('Please select an archive', 'error');
            return;
        }

        deactivateButton(archiveStartBtn);
        resetAllProgress();
        showAlert(`Uploading archive ${selectedArchive.name} for analysis...`, 'info');

        try {
            const result = await uploadArchive(selectedArchive, selectedArchive.name);

            if (result.success) {
                startProgressEmulation();
                showAlert(`Archive analysis started (ID: ${result.taskId})`, 'success');
                pollTaskStatus(result.taskId, (finalResult) => {
                    if (finalResult) displayReport(finalResult);
                    activateButton(archiveStartBtn);
                });
            } else {
                stopProgressEmulation();
                showAlert(`Error: ${result.error}`, 'error');
                activateButton(archiveStartBtn);
            }
        } catch (error) {
            stopProgressEmulation();
            showAlert(`Archive upload error: ${error.message}`, 'error');
            activateButton(archiveStartBtn);
        }
    }

    async function startLocalAnalysis() {
        if (!selectedFolderFiles.length) {
            showAlert('Please select a project folder', 'error');
            return;
        }

        deactivateButton(localStartBtn);
        resetAllProgress();
        showAlert(`Preparing archive from ${selectedFolder} folder...`, 'info');

        try {
            if (!window.JSZip) await loadJSZip();

            showArchiveProgress(0, 'Preparing files');

            const validFiles = [];
            let processedCount = 0, skippedCount = 0;

            for (const file of selectedFolderFiles) {
                processedCount++;
                const percent = Math.round((processedCount / selectedFolderFiles.length) * 50);
                showArchiveProgress(percent, `Checking files (${processedCount}/${selectedFolderFiles.length})...`);

                try {
                    await file.slice(0, 1).arrayBuffer();
                    validFiles.push(file);
                } catch { skippedCount++; }
            }

            if (validFiles.length === 0) throw new Error('No accessible files for archiving');
            if (skippedCount > 0) showAlert(`Skipped ${skippedCount} inaccessible files`, 'warning');

            showArchiveProgress(50, `Creating archive (${validFiles.length} files)...`);
            const zipBlob = await createZipArchive(validFiles, selectedFolder);
            showArchiveProgress(100, 'Archive created');

            const zipSizeMB = zipBlob.size / (1024 * 1024);
            showAlert(`Uploading archive ${selectedFolder}.zip (${zipSizeMB.toFixed(1)} MB) to server...`, 'info');

            const result = await uploadArchive(zipBlob, `${selectedFolder}.zip`);

            if (result.success) {
                startProgressEmulation();
                showAlert(`Local project analysis started (ID: ${result.taskId})`, 'success');
                pollTaskStatus(result.taskId, (finalResult) => {
                    if (finalResult) displayReport(finalResult);
                    activateButton(localStartBtn);
                });
            } else {
                stopProgressEmulation();
                showAlert(`Error: ${result.error}`, 'error');
                activateButton(localStartBtn);
            }
        } catch (error) {
            stopProgressEmulation();
            showAlert(`Error: ${error.message}`, 'error');
            activateButton(localStartBtn);
        }
    }

    // ============================================================
    // UI FUNCTIONS
    // ============================================================

    window.switchSource = function(source) {
        currentSource = source;

        document.querySelectorAll('.source-btn').forEach(btn => btn.classList.remove('active'));
        if (window.event && window.event.target) window.event.target.classList.add('active');

        document.querySelectorAll('.source-content').forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(`${source}-source`);
        if (targetContent) targetContent.classList.add('active');

        hideAlert();
        resetAllProgress();
    };

    function validateGitUrl(url) {
        if (!url) return false;
        if (url.endsWith('.git')) return true;
        try {
            const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
            return host === 'github.com' || host.includes('gitlab') || host.includes('gitlib') || host.includes('bitbucket');
        } catch { return false; }
    }

    function updateGitButton() {
        if (startBtn && repoInput) {
            const isValid = validateGitUrl(repoInput.value);
            if (isValid) activateButton(startBtn);
            else deactivateButton(startBtn);
        }
    }

    window.clearArchive = function() {
        selectedArchive = null;
        if (fileInput) fileInput.value = '';
        if (archiveFileInfo) archiveFileInfo.classList.remove('active');
        deactivateButton(archiveStartBtn);
    };

    window.clearFolder = function() {
        selectedFolder = null;
        selectedFolderFiles = [];
        if (localFolderInput) localFolderInput.value = '';
        if (localFolderInfo) localFolderInfo.classList.remove('active');
        deactivateButton(localStartBtn);
    };

    // ============================================================
    // MODAL CLOSE
    // ============================================================

    window.closeResultModal = function() {
        const modal = document.getElementById('resultModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
            resetAllProgress();

            switch(currentSource) {
                case 'git': deactivateButton(startBtn); break;
                case 'archive': deactivateButton(archiveStartBtn); break;
                case 'local': deactivateButton(localStartBtn); break;
                default: deactivateButton(startBtn);
            }
        }
        currentReport = null;
    };

    window.showResultTab = function(tabName) {
        renderResultTab(tabName);
    };

    window.downloadJSON = function() {
        if (!currentReport) return;
        const jsonStr = JSON.stringify(currentReport, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis_report_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showAlert('JSON report downloaded', 'success');
    };

    window.downloadHTML = function() {
        if (!currentReport) return;
        const htmlContent = generateHTMLReport(currentReport);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis_report_${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        showAlert('HTML report downloaded', 'success');
    };

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    if (fileInput && archiveStartBtn && archiveFileInfo) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                selectedArchive = e.target.files[0];
                archiveFileInfo.innerHTML = `
                    <div class="file-details">
                        <i class="fas fa-file-archive"></i>
                        <span class="file-name">${escapeHtml(selectedArchive.name)}</span>
                        <span class="file-size">(${formatBytes(selectedArchive.size)})</span>
                        <i class="fas fa-times remove-file" onclick="clearArchive()"></i>
                    </div>
                `;
                archiveFileInfo.classList.add('active');
                activateButton(archiveStartBtn);
            }
        });
    }

    if (localFolderInput && localStartBtn && localFolderInfo) {
        localFolderInput.addEventListener('change', (e) => {
            if (!e.target.files || e.target.files.length === 0) return;

            const allFiles = Array.from(e.target.files);
            const firstFilePath = allFiles[0].webkitRelativePath || allFiles[0].name;
            const folderName = firstFilePath.split('/')[0];

            const kept = [];
            let skipped = 0;
            for (const f of allFiles) {
                if (isBlockedFilePath(f)) { skipped++; continue; }
                kept.push(f);
            }

            let validFiles = 0, totalSize = 0;
            for (const file of kept) {
                if (file.size >= 0) { validFiles++; totalSize += file.size; }
            }

            if (validFiles === 0) {
                showAlert(
                    skipped > 0
                        ? `All ${skipped} files were filtered out (node_modules/.git/dist/.env/...)`
                        : 'Empty folder or no accessible files selected',
                    'error'
                );
                clearFolder();
                return;
            }

            selectedFolderFiles = kept;
            selectedFolder = folderName;

            const skippedLabel = skipped > 0 ? `, ${skipped} skipped` : '';
            localFolderInfo.innerHTML = `
                <div class="file-details">
                    <i class="fas fa-folder-open"></i>
                    <span class="file-name">${escapeHtml(selectedFolder)}</span>
                    <span class="file-size">(${validFiles} files${skippedLabel}, ${formatBytes(totalSize)})</span>
                    <i class="fas fa-times remove-file" onclick="clearFolder()"></i>
                </div>
            `;
            localFolderInfo.classList.add('active');
            activateButton(localStartBtn);

            if (skipped > 0) {
                showAlert(
                    `Excluded ${skipped} files/folders (node_modules, .git, dist, .env, etc.)`,
                    'info'
                );
            }
        });
    }

    if (uploadArea && fileInput) {
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
        uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('dragover'); });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && (files[0].name.match(/\.(zip|tar|gz|tgz|7z)$/i))) {
                fileInput.files = files;
                fileInput.dispatchEvent(new Event('change'));
            } else {
                showAlert('Please select an archive (ZIP, TAR, GZ, 7Z)', 'error');
            }
        });
        uploadArea.addEventListener('click', () => fileInput.click());
    }

    if (localUploadArea && localFolderInput) {
        localUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); localUploadArea.classList.add('dragover'); });
        localUploadArea.addEventListener('dragleave', () => { localUploadArea.classList.remove('dragover'); });

        localUploadArea.addEventListener('drop', async (e) => {
            e.preventDefault();
            localUploadArea.classList.remove('dragover');

            const items = e.dataTransfer.items;
            if (!items || items.length === 0) {
                localFolderInput.click();
                return;
            }

            const entry = items[0].webkitGetAsEntry && items[0].webkitGetAsEntry();
            if (!entry || !entry.isDirectory) {
                showAlert('Please drop a folder, not a file', 'error');
                return;
            }

            try {
                showAlert('Reading folder contents...', 'info');
                const collected = await readDirectoryEntry(entry);
                const allFiles = collected.files;

                const kept = [];
                let skipped = 0;
                for (const f of allFiles) {
                    if (isBlockedFilePath(f)) { skipped++; continue; }
                    kept.push(f);
                }

                if (kept.length === 0) {
                    showAlert('Folder is empty or all files were filtered out', 'error');
                    return;
                }

                selectedFolderFiles = kept;
                selectedFolder = entry.name;

                let totalSize = 0;
                for (const f of kept) totalSize += f.size;

                const skippedLabel = skipped > 0 ? `, ${skipped} skipped` : '';
                localFolderInfo.innerHTML = `
                    <div class="file-details">
                        <i class="fas fa-folder-open"></i>
                        <span class="file-name">${escapeHtml(selectedFolder)}</span>
                        <span class="file-size">(${kept.length} files${skippedLabel}, ${formatBytes(totalSize)})</span>
                        <i class="fas fa-times remove-file" onclick="clearFolder()"></i>
                    </div>
                `;
                localFolderInfo.classList.add('active');
                activateButton(localStartBtn);

                if (skipped > 0) {
                    showAlert(`Excluded ${skipped} files/folders (node_modules, .git, dist, .env, etc.)`, 'info');
                } else {
                    showAlert(`Folder loaded: ${kept.length} files`, 'success');
                }
            } catch (err) {
                console.error('Folder drop error:', err);
                showAlert('Failed to read folder: ' + err.message, 'error');
            }
        });

        localUploadArea.addEventListener('click', () => localFolderInput.click());
    }

    async function readDirectoryEntry(dirEntry, path = '') {
        const result = { files: [] };
        const basePath = path || dirEntry.name;

        const reader = dirEntry.createReader();

        function readEntries() {
            return new Promise((resolve, reject) => {
                reader.readEntries(resolve, reject);
            });
        }

        let entries;
        do {
            entries = await readEntries();
            for (const entry of entries) {
                const relPath = `${basePath}/${entry.name}`;

                if (entry.isFile) {
                    const file = await new Promise((resolve, reject) => {
                        entry.file(resolve, reject);
                    });
                    try {
                        Object.defineProperty(file, 'webkitRelativePath', {
                            value: relPath,
                            writable: false,
                            configurable: true
                        });
                    } catch (e) {
                        // некоторые браузеры не дают определить — оставляем как есть
                    }
                    result.files.push(file);
                } else if (entry.isDirectory) {
                    const sub = await readDirectoryEntry(entry, relPath);
                    result.files.push(...sub.files);
                }
            }
        } while (entries.length > 0);

        return result;
    }

    if (startBtn) startBtn.addEventListener('click', startGitAnalysis);
    if (archiveStartBtn) archiveStartBtn.addEventListener('click', startArchiveAnalysis);
    if (localStartBtn) localStartBtn.addEventListener('click', startLocalAnalysis);
    if (repoInput) repoInput.addEventListener('input', updateGitButton);

    window.updateOverallProgress = updateOverallProgress;
    window.updateStepStatus = updateStepStatus;
    window.updateStepProgress = updateStepProgress;
    window.resetAllProgress = resetAllProgress;
    window.startProgressEmulation = startProgressEmulation;
    window.stopProgressEmulation = stopProgressEmulation;

    updateGitButton();
    resetAllProgress();
});