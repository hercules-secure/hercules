/**
 * API методы для SAST
 */

const TOKEN_STORAGE_KEY = 'hercules_repo_tokens';

// ============================================================
// ТОКЕНЫ
// ============================================================

function safeHost(repoUrl) {
    try {
        return new URL(/^https?:\/\//i.test(repoUrl) ? repoUrl : `https://${repoUrl}`).hostname.toLowerCase();
    } catch { return ''; }
}

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

// ============================================================
// ПЛАТФОРМА
// ============================================================

function detectPlatform(url) {
    try {
        const host = safeHost(url);
        if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
        if (host.includes('gitlab') || host.includes('gitlib')) return 'gitlab';
    } catch { /* ignore */ }
    return 'unknown';
}

// ============================================================
// ПРОВЕРКА ДОСТУПНОСТИ
// ============================================================

async function checkGitHubAccess(url) {
    const m = url.match(/(?:github\.com[\/:]|^)([^\/]+)\/([^\/\.]+)/);
    if (!m) return { accessible: false, requiresAuth: false, platform: 'github', host: 'github.com', error: 'Invalid GitHub URL' };

    const owner = m[1];
    const repo = m[2].replace(/\.git$/, '');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    try {
        const r = await fetch(apiUrl, {
            headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'Hercules-SAST' }
        });

        if (r.status === 200) {
            return { accessible: true, requiresAuth: false, platform: 'github', host: 'github.com' };
        }

        if (r.status === 401 || r.status === 403 || r.status === 404) {
            const saved = getStoredToken('github.com');
            if (saved) {
                const r2 = await fetch(apiUrl, {
                    headers: { Accept: 'application/vnd.github.v3+json', Authorization: `token ${saved}`, 'User-Agent': 'Hercules-SAST' }
                });
                if (r2.status === 200) {
                    return { accessible: true, requiresAuth: true, token: saved, platform: 'github', host: 'github.com' };
                }
                deleteStoredToken('github.com');
            }
            return { accessible: false, requiresAuth: true, platform: 'github', host: 'github.com' };
        }

        return { accessible: false, requiresAuth: false, platform: 'github', host: 'github.com', error: `HTTP ${r.status}` };
    } catch (e) {
        return { accessible: false, requiresAuth: false, platform: 'github', host: 'github.com', error: e.message, network: true };
    }
}

async function checkGitLabAccess(url) {
    const raw = url.trim().replace(/\.git$/, '');
    let u;
    try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); }
    catch { return { accessible: false, requiresAuth: false, platform: 'gitlab', host: null, error: 'Invalid GitLab URL' }; }

    const host = u.hostname.toLowerCase();
    const projectPath = u.pathname.replace(/^\//, '').replace(/\/$/, '');
    const apiUrl = `${u.protocol}//${host}/api/v4/projects/${encodeURIComponent(projectPath)}`;

    try {
        const r = await fetch(apiUrl, {
            headers: { Accept: 'application/json', 'User-Agent': 'Hercules-SAST' }
        });

        if (r.status === 200) {
            return { accessible: true, requiresAuth: false, platform: 'gitlab', host };
        }

        if (r.status === 401 || r.status === 403 || r.status === 404) {
            const saved = getStoredToken(host);
            if (saved) {
                const r2 = await fetch(apiUrl, {
                    headers: { Accept: 'application/json', 'PRIVATE-TOKEN': saved, 'User-Agent': 'Hercules-SAST' }
                });
                if (r2.status === 200) {
                    return { accessible: true, requiresAuth: true, token: saved, platform: 'gitlab', host };
                }
                deleteStoredToken(host);
            }
            return { accessible: false, requiresAuth: true, platform: 'gitlab', host };
        }

        return { accessible: false, requiresAuth: false, platform: 'gitlab', host, error: `HTTP ${r.status}` };
    } catch (e) {
        return { accessible: false, requiresAuth: false, platform: 'gitlab', host, error: e.message, network: true };
    }
}

async function checkRepositoryAccess(url) {
    const platform = detectPlatform(url);
    if (platform === 'github') return checkGitHubAccess(url);
    if (platform === 'gitlab') return checkGitLabAccess(url);
    return { accessible: false, requiresAuth: false, platform: 'unknown', host: safeHost(url), error: 'Unknown platform' };
}

// ============================================================
// МОДАЛКА — только существующая #tokenModal через window.openTokenModal
// ============================================================

function requestToken({ host, platform, errorMessage }) {
    if (typeof window.openTokenModal !== 'function') {
        return Promise.reject(new Error('openTokenModal не найден на странице'));
    }

    return new Promise((resolve) => {
        window.openTokenModal({
            host,
            platform,
            request: {
                host,
                retry: async (token) => {
                    setStoredToken(host, token);
                    resolve(token);
                }
            },
            errorMessage: errorMessage || ''
        });
    });
}

// ============================================================
// ЗАПРОС НА БЭКЕНД
// ============================================================

async function doFetch(url, branch, token) {
    const payload = { url };
    if (branch) payload.branch = branch;

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Git-Token'] = token;

    const response = await fetch('/api/sast/git', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    let data = {};
    try { data = await response.json(); } catch { /* ignore */ }

    if (!response.ok) {
        const msg = data.message || data.error || `HTTP ${response.status}`;
        const err = new Error(msg);
        err.status = response.status;
        err.payload = data;
        err.host = safeHost(url);
        if (response.status === 401 || response.status === 403) {
            err.status = 403;
            err.requiresAuth = true;
        }
        throw err;
    }

    if (data && data.success === false) {
        const msg = String(data.message || data.error || '');
        const looksLike403 =
            data.needsToken === true ||
            data.code === 403 ||
            /403|forbidden|unauthorized/i.test(msg);

        const err = new Error(msg || 'Ошибка загрузки архива');
        err.status = looksLike403 ? 403 : 500;
        err.payload = data;
        err.host = safeHost(url);
        if (looksLike403) err.requiresAuth = true;
        throw err;
    }

    return data.archive;
}

// ============================================================
// ПУБЛИЧНАЯ ФУНКЦИЯ
// ============================================================

export async function fetchArchiveFromUrl(url, branch = null) {
    const access = await checkRepositoryAccess(url);

    // Сеть/CORS — сразу на бэкенд с сохранённым токеном
    if (access.network) {
        return doFetch(url, branch, getStoredToken(access.host));
    }

    // Доступен — качаем
    if (access.accessible) {
        return doFetch(url, branch, access.token || null);
    }

    // Нужен токен — открываем существующую модалку
    if (access.requiresAuth) {
        const token = await requestToken({
            host: access.host,
            platform: access.platform
        });

        if (!token) {
            const err = new Error('Загрузка отменена: токен не предоставлен');
            err.status = 401;
            err.host = access.host;
            throw err;
        }

        try {
            return await doFetch(url, branch, token);
        } catch (e) {
            if (e.requiresAuth) {
                const retryToken = await requestToken({
                    host: access.host,
                    platform: access.platform,
                    errorMessage: 'Токен не подошёл. Проверьте права (read_repository / read_api).'
                });
                if (!retryToken) {
                    const err = new Error('Загрузка отменена: токен не предоставлен');
                    err.status = 401;
                    err.host = access.host;
                    throw err;
                }
                return doFetch(url, branch, retryToken);
            }
            throw e;
        }
    }

    // Иная ошибка
    const err = new Error(access.error || 'Репозиторий недоступен');
    err.status = 404;
    err.host = access.host;
    err.platform = access.platform;
    throw err;
}

// ============================================================
// ОСТАЛЬНОЕ — без изменений
// ============================================================

export async function uploadArchive(file) {
    const formData = new FormData();
    formData.append('archive', file);

    const response = await fetch('/api/sast/upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
            error = JSON.parse(errorText);
        } catch {
            error = { message: errorText };
        }
        throw new Error(error.message || 'Ошибка загрузки файла');
    }

    const data = await response.json();

    let archiveId = null;
    let archiveData = null;

    if (data.archive && data.archive.id) {
        archiveId = data.archive.id;
        archiveData = data.archive;
    } else if (data.id) {
        archiveId = data.id;
        archiveData = data;
    } else if (data.result && data.result.id) {
        archiveId = data.result.id;
        archiveData = data.result;
    } else {
        throw new Error('Сервер вернул некорректные данные');
    }

    if (!archiveId) {
        throw new Error('Не удалось получить ID архива из ответа сервера');
    }

    return {
        id: archiveId,
        filename: archiveData.filename || file.name,
        size: archiveData.size || file.size
    };
}

export async function runSASTAnalysis(archiveId) {
    if (!archiveId || archiveId === 'undefined' || archiveId === 'null') {
        throw new Error(`Неверный ID архива: ${archiveId}`);
    }

    const response = await fetch(`/api/sast/analyze/${archiveId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            rulesPath: null
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.results;
}

export async function getArchiveInfo(archiveId) {
    const response = await fetch(`/api/archive/${archiveId}`);

    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Ошибка получения информации');
    }

    return await response.json();
}

// token-modal.js
// Работает с существующей модалкой #tokenModal из HTML.
// Никаких своих div/стилей/текстов — только управление вашей модалкой.

(function () {
    let pendingRequest = null;

    function getStoredToken(host) {
        try {
            const all = JSON.parse(localStorage.getItem('hercules_repo_tokens') || '{}');
            return all[host] || null;
        } catch { return null; }
    }

    window.openTokenModal = function ({ host, request, errorMessage }) {
        pendingRequest = request || null;

        const modal = document.getElementById('tokenModal');
        const hostEl = document.getElementById('tokenHost');
        const input = document.getElementById('tokenInput');
        const errEl = document.getElementById('tokenError');

        if (!modal) {
            console.error('token-modal.js: #tokenModal не найден в HTML');
            return;
        }

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
    };

    window.closeTokenModal = function () {
        const modal = document.getElementById('tokenModal');
        if (modal) modal.classList.remove('show');
        pendingRequest = null;
    };

    // Кнопка «Применить и повторить»
    document.addEventListener('click', async (e) => {
        const submitBtn = e.target.closest('#tokenSubmitBtn');
        if (!submitBtn) return;

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

        const req = pendingRequest;
        window.closeTokenModal();

        if (req && typeof req.retry === 'function') {
            try {
                await req.retry(token);
            } catch (err) {
                if (err.status === 403 || err.status === 401) {
                    window.openTokenModal({
                        host: req.host,
                        request: req,
                        errorMessage: 'Токен не подошёл. Проверьте права (read_repository / read_api).'
                    });
                } else {
                    console.error('token-modal retry error:', err);
                }
            }
        }
    });

    // Показ/скрытие токена
    document.addEventListener('click', (e) => {
        const toggle = e.target.closest('#tokenToggleVisibility');
        if (!toggle) return;
        const input = document.getElementById('tokenInput');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        const icon = toggle.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        }
    });

    // Enter в поле — отправить
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target && e.target.id === 'tokenInput') {
            e.preventDefault();
            document.getElementById('tokenSubmitBtn')?.click();
        }
        if (e.key === 'Escape') {
            const modal = document.getElementById('tokenModal');
            if (modal && modal.classList.contains('show')) {
                window.closeTokenModal();
            }
        }
    });
})();