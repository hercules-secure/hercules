
    (function themeToggle() {
      const t = document.getElementById('themeToggle'); const root = document.documentElement;
      function apply(v){ root.setAttribute('data-theme', v); localStorage.setItem('hercules_theme', v); }
      t.addEventListener('click', () => apply(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
    })();

 const API = '/api/donor';
let donors = [];
let meta = { source_types: [], formats: [], destinations: [], statuses: [] };

const $ = (id) => document.getElementById(id);
const tbody = $('tbody');

// ─────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────
const val   = (id) => { const el = $(id); return el ? el.value.trim() : ''; };
const sel   = (id) => { const el = $(id); return el ? el.value : ''; };
const multi = (id) => {
    const el = $(id);
    return el ? Array.from(el.selectedOptions).map(o => o.value) : [];
};

function toast(msg, isErr) {
    const t = $('toast');
    if (!t) { console.log(isErr ? 'ERR' : 'OK', msg); return; }
    t.textContent = msg;
    t.style.borderColor = isErr ? 'var(--error-border)' : 'var(--border)';
    t.style.color = isErr ? 'var(--error-text)' : 'var(--text)';
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────
// visibility: auth
// ─────────────────────────────────────────────
function updateAuthVisibility() {
    const auth   = $('fAuth')?.value || 'in';
    const method = $('fAuthMethod')?.value || 'api_key';

    const authBlock = $('authBlock');
    const apiKeyBox = $('authApiKey');
    const loginBox  = $('authLogin');

    if (!authBlock || !apiKeyBox || !loginBox) return;

    authBlock.style.display = auth === 'out' ? '' : 'none';

    if (auth === 'out') {
        apiKeyBox.style.display = method === 'api_key' ? '' : 'none';
        loginBox.style.display  = method === 'login'   ? '' : 'none';
    } else {
        if ($('fApiKey'))   $('fApiKey').value   = '';
        if ($('fLogin'))    $('fLogin').value    = '';
        if ($('fPassword')) $('fPassword').value = '';
    }
}

// ─────────────────────────────────────────────
// visibility: body (только для POST)
// ─────────────────────────────────────────────
function updateBodyVisibility() {
    const method = $('fMethod')?.value || 'GET';
    const bodyBlock = $('bodyBlock');
    if (!bodyBlock) return;

    const isPost = method === 'POST';
    bodyBlock.style.display = isPost ? '' : 'none';

    if (!isPost && $('fBody')) $('fBody').value = '';
}

// ─────────────────────────────────────────────
// meta
// ─────────────────────────────────────────────
async function loadMeta() {
    try {
        const r = await fetch(`${API}/meta/types`);
        if (!r.ok) return;
        meta = await r.json();

        fillSelect('fType',   meta.source_types);
        fillSelect('fFormat', meta.formats);
        fillSelect('fStatus', meta.statuses);
        fillSelect('fDest',   meta.destinations, true);
    } catch (e) {
        console.warn('meta load failed', e);
    }
}

function fillSelect(id, values, multiple = false) {
    const el = $(id);
    if (!el || !Array.isArray(values)) return;
    el.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join('');
    if (multiple) el.multiple = true;
}

// ─────────────────────────────────────────────
// load + render
// ─────────────────────────────────────────────
async function load() {
    try {
        const r = await fetch(API);
        if (!r.ok) throw new Error('Load error');
        donors = await r.json();
        render();
    } catch (e) {
        toast(e.message, true);
    }
}

function badgeClass(type) {
    switch (type) {
        case 'api':         return 'api';
        case 'database':    return 'db';
        case 'log':         return 'log';
        case 'file_export': return 'file';
        default:            return 'file';
    }
}

function render() {
    if (!donors.length) {
        return;
    }

    tbody.innerHTML = donors.map(d => `
        <tr>
            <td><strong>${escapeHtml(d.name)}</strong></td>
            <td>${escapeHtml(d.provider || '—')}</td>
            <td>
                <span class="badge badge-${badgeClass(d.source_type)}">
                    ${escapeHtml(d.source_type || '—')}
                </span>
            </td>
            <td>${escapeHtml(d.format || '—')}</td>
            <td>${escapeHtml((d.destinations || []).join(', ') || '—')}</td>
            <td class="actions-cell">
                <i class="fas fa-pen" title="Edit" onclick="openEdit(${d.id})"></i>
                <i class="fas fa-trash-can" title="Delete" onclick="del(${d.id})"></i>
            </td>
        </tr>
    `).join('');
}

// ─────────────────────────────────────────────
// open modals
// ─────────────────────────────────────────────
window.openAdd = function () {
    const setVal = (elId, v) => {
        const el = $(elId);
        if (el) el.value = v;
    };

    ['fName','fProvider','fEndpoint','fBody','fDescription','fContact','fOwner',
     'fApiKey','fLogin','fPassword'].forEach(id => setVal(id, ''));

    setVal('fMethod',       'GET');
    setVal('fType',         'api');
    setVal('fFormat',       'json');
    setVal('fStatus',       'active');
    setVal('fAuth',         'in');
    setVal('fAuthMethod',   'api_key');
    setVal('fApiKeyHeader', 'X-Api-Key');

    const dest = $('fDest');
    if (dest) Array.from(dest.options).forEach(o => o.selected = false);

    $('fId').value = '';

    updateBodyVisibility();
    updateAuthVisibility();
    $('modal').classList.add('active');
};

window.openEdit = function (id) {
    const d = donors.find(x => x.id === id);
    if (!d) return;

    const setVal = (elId, v) => {
        const el = $(elId);
        if (el) el.value = v;
    };

    $('modalTitle').innerHTML = '<i class="fas fa-pen"></i> Edit source';

    setVal('fName',        d.name || '');
    setVal('fProvider',    d.provider || '');
    setVal('fEndpoint',    d.endpoint || '');
    setVal('fDescription', d.description || '');
    setVal('fContact',     d.contact || '');
    setVal('fOwner',       d.owner || '');

    setVal('fMethod',      d.method || 'GET');
    setVal('fBody',        d.body || '');
    setVal('fType',        d.source_type || 'api');
    setVal('fFormat',      d.format || 'json');
    setVal('fStatus',      d.status || 'active');

    setVal('fAuth',        d.auth_type || 'in');
    setVal('fAuthMethod',  d.auth_method || 'api_key');
    setVal('fApiKeyHeader',d.api_key_header || 'X-Api-Key');
    setVal('fApiKey',      d.api_key || '');
    setVal('fLogin',       d.login || '');
    setVal('fPassword',    d.password || '');

    const dest = $('fDest');
    if (dest) {
        const selected = d.destinations || [];
        Array.from(dest.options).forEach(o => {
            o.selected = selected.includes(o.value);
        });
    }

    $('fId').value = id;

    updateBodyVisibility();
    updateAuthVisibility();
    $('modal').classList.add('active');
};

window.closeModal = function () {
    $('modal').classList.remove('active');
};

// открытие модалки удаления
window.del = function (id) {
    const d = donors.find(x => x.id === id);
    if (!d) return;

    $('deleteDonorName').textContent = `"${d.name}"`;
    $('deleteModal').dataset.id = id;
    $('deleteModal').classList.add('active');
};

// закрытие
window.closeDeleteModal = function () {
    $('deleteModal').classList.remove('active');
};

// подтверждение
document.addEventListener('DOMContentLoaded', () => {
    const btn = $('deleteConfirmBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const modal = $('deleteModal');
        const id = parseInt(modal.dataset.id);
        if (!id) return;

        btn.disabled = true;
        try {
            const r = await fetch(`${API}/${id}`, { method: 'DELETE' });
            if (!r.ok && r.status !== 204) throw new Error('Delete error');

            donors = donors.filter(x => x.id !== id);
            render();
            toast('Deleted');
            closeDeleteModal();
        } catch (e) {
            toast(e.message, true);
        } finally {
            btn.disabled = false;
        }
    });
});

// ─────────────────────────────────────────────
// save
// ─────────────────────────────────────────────
$('saveBtn').addEventListener('click', async () => {
    const id = $('fId').value;

    const name     = val('fName');
    const provider = val('fProvider');
    const endpoint = val('fEndpoint');
    const method   = sel('fMethod') || 'GET';

    if (!name)     { toast('Name is required', true); return; }
    if (!provider) { toast('Provider is required', true); return; }
    if (!endpoint) { toast('Endpoint is required', true); return; }

    // body для POST
    let body = '';
    if (method === 'POST') {
        body = val('fBody');
        if (body) {
            try { JSON.parse(body); }
            catch { toast('Request body must be valid JSON', true); return; }
        }
    }

    // auth
    const auth   = sel('fAuth') || 'in';
    const authMethod = sel('fAuthMethod') || 'api_key';

    const authData = { auth_type: auth };
    if (auth === 'out') {
        authData.auth_method = authMethod;
        if (authMethod === 'api_key') {
            const key = val('fApiKey');
            if (!key) { toast('API Key is required', true); return; }
            authData.api_key        = key;
            authData.api_key_header = val('fApiKeyHeader') || 'X-Api-Key';
        } else {
            const login    = val('fLogin');
            const password = val('fPassword');
            if (!login || !password) {
                toast('Login and password are required', true);
                return;
            }
            authData.login    = login;
            authData.password = password;
        }
    }

    const data = {
        name,
        provider,
        method,
        endpoint,
        ...(method === 'POST' && body ? { body } : {}),
        source_type:  sel('fType') || 'api',
        format:       sel('fFormat') || 'json',
        destinations: multi('fDest'),
        status:       sel('fStatus') || 'active',
        description:  val('fDescription'),
        contact:      val('fContact'),
        owner:        val('fOwner'),
        ...authData
    };

    try {
        const url        = id ? `${API}/${id}` : API;
        const httpMethod = id ? 'PUT' : 'POST';

        const r = await fetch(url, {
            method: httpMethod,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(err.error || 'Save error');
        }

        const saved = await r.json();

        if (id) {
            const i = donors.findIndex(x => x.id === parseInt(id));
            if (i !== -1) donors[i] = saved;
        } else {
            donors.push(saved);
        }

        render();
        closeModal();
        toast(id ? 'Updated' : 'Added');
    } catch (e) {
        toast(e.message, true);
    }
});

// ─────────────────────────────────────────────
// listeners
// ─────────────────────────────────────────────
$('addBtn')?.addEventListener('click', openAdd);
$('modal')?.addEventListener('click', (e) => {
    if (e.target === $('modal')) closeModal();
});
$('fAuth')?.addEventListener('change', updateAuthVisibility);
$('fAuthMethod')?.addEventListener('change', updateAuthVisibility);
$('fMethod')?.addEventListener('change', updateBodyVisibility);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('modal')?.classList.contains('active')) {
        closeModal();
    }
});

// init
loadMeta().then(load);

// ─────────────────────────────────────────────
// init
// ─────────────────────────────────────────────
$('addBtn').addEventListener('click', openAdd);
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });

// закрытие по Esc
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('modal').classList.contains('active')) closeModal();
});

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('contractUploadDrop');
    const fileInput = document.getElementById('contractFileInput');
    const dropTitle = document.getElementById('contractDropTitle');
    const dropHint = document.getElementById('contractDropHint');
    const saveBtn = document.getElementById('saveBtn');

    const MAX_SIZE = 1024 * 1024; // 1 МБ
    const ALLOWED_EXT = ['.yaml', '.yml', '.json'];

    let selectedFile = null;

    // 1. Клик по зоне загрузки открывает системное окно выбора файла
    dropZone.addEventListener('click', (e) => {
        // Защита от двойного срабатывания, если кликнули прямо по скрытому input
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });

    // 2. Обработка выбора файла через диалоговое окно
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    });

    // 3. Обработка перетаскивания (Drag & Drop)
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer?.files?.[0];
        if (file) {
            processFile(file);
        }
    });

    // 4. Валидация и обновление текста в зоне загрузки
    function processFile(file) {
        const fileName = file.name.toLowerCase();
        const isValidExt = ALLOWED_EXT.some(ext => fileName.endsWith(ext));

        if (!isValidExt) {
            setError('Неподдерживаемый формат файла', 'Нужен файл YAML, YML или JSON');
            return;
        }

        if (file.size > MAX_SIZE) {
            setError('Файл слишком большой', 'Максимальный размер — 1 МБ');
            return;
        }

        // Всё ок — сохраняем файл и активируем кнопку Save
        selectedFile = file;
        dropZone.classList.remove('error');
        dropZone.classList.add('has-file');
        dropTitle.textContent = file.name;
        dropHint.textContent = `${(file.size / 1024).toFixed(1)} КБ — нажмите, чтобы заменить`;
        if (saveBtn) saveBtn.disabled = false;
    }

    function setError(title, hint) {
        selectedFile = null;
        fileInput.value = '';
        dropZone.classList.remove('has-file');
        dropZone.classList.add('error');
        dropTitle.textContent = title;
        dropHint.textContent = hint;
        if (saveBtn) saveBtn.disabled = true;
    }

    // 5. Клик по кнопке "Сохранить"
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!selectedFile) return;

            const formData = new FormData();
            formData.append('contract', selectedFile);

            try {
                saveBtn.disabled = true;

                // Замените URL на ваш реальный эндпоинт
                const response = await fetch('/api/donors/contract', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Ошибка сервера: ${response.status}`);
                }

                // Закрываем модалку и сбрасываем состояние
                resetContractUpload();
                if (typeof closeModal === 'function') closeModal();
            } catch (err) {
                setError('Не удалось загрузить контракт', err.message);
            }
        });
    }

    // Функция сброса (можно вызывать внутри closeModal)
    window.resetContractUpload = function () {
        selectedFile = null;
        fileInput.value = '';
        dropZone.classList.remove('has-file', 'error', 'dragover');
        dropTitle.textContent = 'Нажмите или перетащите файл контракта сюда';
        dropHint.textContent = 'OpenAPI / Swagger или похожая схема (YAML, JSON) — до 1 МБ';
        if (saveBtn) saveBtn.disabled = true;
    };
});
