
  // ===== THEME TOGGLE =====
  (function() {
    const themeToggle = document.getElementById('themeToggle');
    const root = document.documentElement;

    function applyTheme(theme) {
      root.setAttribute('data-theme', theme);
      localStorage.setItem('hercules_theme', theme);
    }

    function toggleTheme() {
      const current = root.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }
  })();

  // ===== CMDB API =====
  const API_BASE = '/api/cmdb';
  let allAssets = [];

  const tbody = document.getElementById('assetTableBody');
  const totalSpan = document.getElementById('totalCount');
  const activeSpan = document.getElementById('activeCount');
  const maintenanceSpan = document.getElementById('maintenanceCount');
  const teamCountSpan = document.getElementById('teamCount');
  const globalSearch = document.getElementById('globalSearch');
  const typeFilter = document.getElementById('typeFilter');
  const statusFilter = document.getElementById('statusFilter');
  const clearFiltersBtn = document.getElementById('clearFilters');
  const toastEl = document.getElementById('toast');

  function showToast(message, isError = false) {
    toastEl.textContent = message;
    toastEl.style.borderColor = isError ? 'var(--error-border)' : 'var(--border)';
    toastEl.style.color = isError ? 'var(--error-text)' : 'var(--text)';
    toastEl.classList.add('show');
    clearTimeout(toastEl._timeout);
    toastEl._timeout = setTimeout(() => toastEl.classList.remove('show'), 3000);
  }

  function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  // ---------- API ----------
  async function fetchAssets() {
    const response = await fetch(API_BASE);
    if (!response.ok) throw new Error('Loading error');
    return response.json();
  }

  async function deleteAsset(id) {
    const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Deletion error');
  }

  async function createAsset(data) {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Creation error');
    return response.json();
  }

  async function updateAsset(id, data) {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Update error');
    return response.json();
  }

  // ---------- FILTER ----------
  function filterAssets(assets) {
    const searchTerm = globalSearch.value.toLowerCase().trim();
    const typeVal = typeFilter.value;
    const statusVal = statusFilter.value;

    return assets.filter(asset => {
      let matchesSearch = true;
      if (searchTerm) {
        matchesSearch = (asset.team && asset.team.toLowerCase().includes(searchTerm)) ||
                        asset.name.toLowerCase().includes(searchTerm) ||
                        (asset.owner && asset.owner.toLowerCase().includes(searchTerm)) ||
                        (asset.custodian && asset.custodian.toLowerCase().includes(searchTerm)) ||
                        (asset.description && asset.description.toLowerCase().includes(searchTerm));
      }
      let matchesType = (typeVal === 'all' || asset.type === typeVal);
      let matchesStatus = (statusVal === 'all' || asset.status === statusVal);
      return matchesSearch && matchesType && matchesStatus;
    });
  }

  // ---------- RENDER ----------
  function renderTable() {
    const filtered = filterAssets(allAssets);
    const total = allAssets.length;
    const active = allAssets.filter(a => a.status === 'active').length;
    const maintenance = allAssets.filter(a => a.status === 'maintenance').length;
    const teams = new Set(allAssets.map(a => a.team).filter(Boolean));

    totalSpan.textContent = total;
    activeSpan.textContent = active;
    maintenanceSpan.textContent = maintenance;
    teamCountSpan.textContent = teams.size;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fas fa-database" style="font-size:2rem; opacity:0.3; display:block; margin-bottom:0.5rem;"></i>Nothing found</td></tr>`;
      return;
    }

    let html = '';
    filtered.forEach(asset => {
      let typeBadge = `badge-${asset.type}`;
      if (!['server','network','database','storage','application'].includes(asset.type)) typeBadge = 'badge-other';
      let statusClass = `status-${asset.status}`;
      let statusLabel = { active: 'Active', inactive: 'Inactive', maintenance: 'Maintenance' }[asset.status] || asset.status;

      html += `
        <tr>
          <td style="width:25%"><strong>${asset.team || '-'}</strong></td>
          <td><strong>${asset.name}</strong></td>
          <td>${asset.owner || '-'}</td>
          <td>${asset.custodian || '-'}</td>
          <td><span class="badge ${typeBadge}">${asset.type}</span></td>
          <td><span class="status-badge ${statusClass}"><span class="status-dot"></span> ${statusLabel}</span></td>
          <td>
            <div style="display:flex; gap:8px;">
            ${asset.git ? `<a href="${asset.git}" target="_blank" class="link-icon" title="Git"><i class="fab fa-git-alt"></i></a>` : ''}
            ${asset.docs ? `<a href="${asset.docs}" target="_blank" class="link-icon" title="Documentation"><i class="fas fa-book"></i></a>` : ''}
            ${asset.security ? `<a href="${asset.security}" target="_blank" class="link-icon" title="Security report"><i class="fas fa-shield-alt"></i></a>` : ''}
            </div>
          </td>
          <td class="actions-cell">
            <i class="fas fa-play" data-id="${asset.id}" title="Analyze" onclick="runAnalysis(${asset.id})"></i>
            <i class="fas fa-pen" data-id="${asset.id}" title="Edit" onclick="openEditModal(${asset.id})"></i>
            <i class="fas fa-trash-can" data-id="${asset.id}" title="Delete" onclick="openDeleteModal(${asset.id})"></i>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }


  window.openEditModal = function(id) {
    const asset = allAssets.find(a => a.id === id);
    if (!asset) return;
    document.getElementById('formModalTitle').innerHTML = '<i class="fas fa-pen"></i> Edit asset';
    document.getElementById('formSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Update';
    document.getElementById('formTeam').value = asset.team || '';
    document.getElementById('formName').value = asset.name;
    document.getElementById('formOwner').value = asset.owner || '';
    document.getElementById('formCustodian').value = asset.custodian || '';
    document.getElementById('formEmail').value = asset.email || '';
    document.getElementById('formType').value = asset.type;
    document.getElementById('formStatus').value = asset.status;
    document.getElementById('formDescription').value = asset.description || '';
    document.getElementById('formStack').value = asset.stack || '';
    document.getElementById('formGit').value = asset.git || '';
    document.getElementById('formDocs').value = asset.docs || '';
    // document.getElementById('formSecurity').value = asset.security || '';
    document.getElementById('formEditId').value = id;
    openModal('formModal');
  };

  // ---------- SAVE (create or update) ----------
  document.getElementById('formSubmitBtn').addEventListener('click', async function() {
    const id = document.getElementById('formEditId').value;
    const team = document.getElementById('formTeam').value.trim();
    const name = document.getElementById('formName').value.trim();
    const owner = document.getElementById('formOwner').value.trim();
    const custodian = document.getElementById('formCustodian').value.trim();
    const email = document.getElementById('formEmail').value.trim();
    const type = document.getElementById('formType').value;
    const status = document.getElementById('formStatus').value;
    const description = document.getElementById('formDescription').value.trim();
    const stack = document.getElementById('formStack').value.trim();
    const git = document.getElementById('formGit').value.trim();
    const docs = document.getElementById('formDocs').value.trim();

    if (!team) { showToast('Enter team name', true); return; }
    if (!name) { showToast('Enter asset name', true); return; }
    if (!owner) { showToast('Enter owner name', true); return; }
    if (!custodian) { showToast('Enter IT Custodian name', true); return; }
    if (!email) { showToast('Enter email', true); return; }

    const data = { team, name, owner, custodian, email, type, status, description, stack, git, docs };

    try {
      if (id) {
        await updateAsset(parseInt(id), data);
        showToast('Asset updated');
      } else {
        const newAsset = await createAsset(data);
        if (newAsset) {
          allAssets.push(newAsset);
          showToast('Asset added');
        }
      }
      closeModal('formModal');
      await loadData();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // ---------- DELETE ----------
  window.openDeleteModal = function(id) {
    const asset = allAssets.find(a => a.id === id);
    if (!asset) return;
    document.getElementById('deleteAssetName').textContent = `"${asset.name}"`;
    document.getElementById('deleteAssetId').value = id;
    openModal('deleteModal');
  };

  document.getElementById('deleteConfirmBtn').addEventListener('click', async function() {
    const id = parseInt(document.getElementById('deleteAssetId').value);
    try {
      await deleteAsset(id);
      allAssets = allAssets.filter(a => a.id !== id);
      renderTable();
      showToast('Asset deleted');
      closeModal('deleteModal');
    } catch (err) {
      showToast(err.message, true);
    }
  });


  

  // ---------- LOAD ----------
  async function loadData() {
    try {
      allAssets = await fetchAssets();
      renderTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fas fa-exclamation-triangle" style="color:var(--error-text); font-size:2rem;"></i><br>Loading error: ${err.message}</td></tr>`;
      showToast('Error loading data', true);
    }
  }

  // ---------- EVENTS ----------
  globalSearch.addEventListener('input', renderTable);
  typeFilter.addEventListener('change', renderTable);
  statusFilter.addEventListener('change', renderTable);

  clearFiltersBtn.addEventListener('click', function() {
    globalSearch.value = '';
    typeFilter.value = 'all';
    statusFilter.value = 'all';
    renderTable();
  });

  loadMenu();
  loadData();

  // ===== ADD FLOW =====
(function() {
  const stepSource = document.getElementById('addStepSource');
  const stepFile   = document.getElementById('addStepFile');
  const stepGit    = document.getElementById('addStepGit');
  const stepForm   = document.getElementById('addStepForm');

  function showStep(el) {
    [stepSource, stepFile, stepGit, stepForm].forEach(s => {
      if (s) s.style.display = 'none';
    });
    if (el) el.style.display = 'block';
  }

  // Открытие мастера
  document.getElementById('addAssetBtn').addEventListener('click', () => {
    resetAddFlow();
    showStep(stepSource);
    openModal('addModal');
  });

  // Выбор источника
  document.querySelectorAll('.source-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const src = btn.dataset.source;
      if (src === 'file') showStep(stepFile);
      else if (src === 'git') showStep(stepGit);
      else {
        setSourceBadge('manual', 'Manual entry');
        showStep(stepForm);
      }
    });
  });

  // Back
  document.querySelectorAll('#addModal [data-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      clearSourceBadge();
      showStep(stepSource);
    });
  });

  // FILE
  const drop = document.getElementById('assetUploadDrop');
  const fileInput = document.getElementById('assetFileInput');
  const fileNext = document.getElementById('assetFileNext');
  const fileError = document.getElementById('assetFileError');
  let parsedFileData = null;

  if (drop && fileInput) {
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
      }
    });

    fileInput.addEventListener('change', async () => {
      fileError.style.display = 'none';
      fileNext.disabled = true;
      parsedFileData = null;

      const file = fileInput.files[0];
      if (!file) return;

      if (file.size > 1024 * 1024) {
        fileError.textContent = 'File too large (max 1 MB)';
        fileError.style.display = 'block';
        return;
      }

      try {
        const text = await file.text();
        parsedFileData = parseAssetFile(text, file.name);
        fileNext.disabled = false;
        drop.querySelector('p').textContent = `✓ ${file.name}`;
      } catch (err) {
        fileError.textContent = err.message;
        fileError.style.display = 'block';
      }
    });

    fileNext.addEventListener('click', () => {
      if (!parsedFileData) return;
      fillAddForm(parsedFileData);
      setSourceBadge('file', 'From file');
      showStep(stepForm);
    });
  }

  // GIT
  const gitNext = document.getElementById('assetGitNext');
  const gitError = document.getElementById('assetGitError');

  if (gitNext) {
    gitNext.addEventListener('click', async () => {
      gitError.style.display = 'none';

      const url = document.getElementById('assetGitUrl').value.trim();
      const branch = document.getElementById('assetGitBranch').value.trim() || 'main';
      const manifestPath = document.getElementById('assetGitPath').value.trim();

      if (!url) {
        gitError.textContent = 'Repository URL is required';
        gitError.style.display = 'block';
        return;
      }

      gitNext.disabled = true;
      gitNext.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';

      try {
        const response = await fetch('/api/cmdb/fetch-from-git', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, branch, manifestPath })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to fetch from Git');
        }

        const data = await response.json();
        fillAddForm(data);
        setSourceBadge('git', 'From Git');
        showStep(stepForm);
      } catch (err) {
        gitError.textContent = err.message;
        gitError.style.display = 'block';
      } finally {
        gitNext.disabled = false;
        gitNext.innerHTML = '<i class="fas fa-download"></i> Fetch & continue';
      }
    });
  }

  // SUBMIT (Create)
  document.getElementById('addSubmitBtn').addEventListener('click', async () => {
    const data = collectFormData('add');

    if (!data.team) { showToast('Enter team name', true); return; }
    if (!data.name) { showToast('Enter asset name', true); return; }
    if (!data.owner) { showToast('Enter owner name', true); return; }
    if (!data.custodian) { showToast('Enter IT Custodian name', true); return; }
    if (!data.email) { showToast('Enter email', true); return; }

    try {
      const newAsset = await createAsset(data);
      if (newAsset) {
        allAssets.push(newAsset);
        showToast('Asset added');
      }
      closeModal('addModal');
      await loadData();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // HELPERS

  function collectFormData(prefix) {
    const get = (id) => document.getElementById(`${prefix}${id}`)?.value.trim() || '';
    return {
      team: get('Team'),
      name: get('Name'),
      owner: get('Owner'),
      custodian: get('Custodian'),
      email: get('Email'),
      type: document.getElementById(`${prefix}Type`)?.value || 'server',
      status: document.getElementById(`${prefix}Status`)?.value || 'active',
      description: get('Description'),
      stack: get('Stack'),
      git: get('Git'),
      docs: get('Docs'),
      security: get('Security')
    };
  }

  function fillAddForm(data) {
    const map = {
      team: 'addTeam',
      name: 'addName',
      owner: 'addOwner',
      custodian: 'addCustodian',
      email: 'addEmail',
      type: 'addType',
      status: 'addStatus',
      description: 'addDescription',
      stack: 'addStack',
      git: 'addGit',
      docs: 'addDocs'
    };
    for (const [key, id] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el && data[key] !== undefined) el.value = data[key];
    }
  }

  function parseAssetFile(text, filename) {
    const ext = filename.split('.').pop().toLowerCase();

    if (ext === 'json') {
      try { return JSON.parse(text); }
      catch { throw new Error('Invalid JSON'); }
    }

    if (ext === 'yaml' || ext === 'yml') {
      const obj = {};
      text.split('\n').forEach(line => {
        const m = line.match(/^\s*([\w-]+)\s*:\s*(.+)\s*$/);
        if (m) {
          let key = m[1].toLowerCase();
          if (key === 'mail' || key === 'e-mail' || key === 'contact') key = 'email';
          obj[key] = m[2].replace(/^["']|["']$/g, '');
        }
      });
      return obj;
    }

    if (ext === 'md') {
      return { description: text.substring(0, 2000).trim() };
    }

    throw new Error('Unsupported file type');
  }

  function setSourceBadge(source, label) {
    const badge = document.getElementById('addSourceBadge');
    if (!badge) return;
    const icons = {
      file: 'fas fa-file-arrow-up',
      git: 'fab fa-git-alt',
      manual: 'fas fa-keyboard'
    };
    badge.innerHTML = `<i class="${icons[source] || 'fas fa-pen'}"></i> ${label}`;
    badge.style.display = 'inline-flex';
  }

  function clearSourceBadge() {
    const badge = document.getElementById('addSourceBadge');
    if (badge) {
      badge.style.display = 'none';
      badge.innerHTML = '';
    }
  }

  function resetAddFlow() {
    parsedFileData = null;
    if (fileInput) fileInput.value = '';
    if (fileError) fileError.style.display = 'none';
    if (fileNext) fileNext.disabled = true;
    if (drop) drop.querySelector('p').textContent = 'Click or drag file here';
    if (gitError) gitError.style.display = 'none';
    const urlEl = document.getElementById('assetGitUrl'); if (urlEl) urlEl.value = '';
    const brEl = document.getElementById('assetGitBranch'); if (brEl) brEl.value = '';
    const pathEl = document.getElementById('assetGitPath'); if (pathEl) pathEl.value = '';
    // Очистка полей формы добавления
    ['addTeam','addName','addOwner','addCustodian','addEmail','addDescription','addStack','addGit','addDocs'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const tEl = document.getElementById('addType'); if (tEl) tEl.value = 'server';
    const sEl = document.getElementById('addStatus'); if (sEl) sEl.value = 'active';
    clearSourceBadge();
  }
})();