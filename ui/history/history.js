/* ============================================================
   History — frontend
   ============================================================ */

(function () {
    'use strict';

    const API = '/api/history';
    const ROWS_PER_PAGE = 10;

    // ---------- STATE ----------
    let currentRecords = [];
    let currentPage = 1;

    // ---------- DOM ----------
    const $ = (id) => document.getElementById(id);
    const tbody = $('historyTableBody');
    const toastEl = $('toast');

    // ============================================================
    // TOAST
    // ============================================================
    const TOAST_ICONS = {
        success: 'fa-circle-check',
        error:   'fa-circle-exclamation',
        warning: 'fa-triangle-exclamation',
        info:    'fa-circle-info'
    };

    function toast(msg, type = 'success') {
        if (!toastEl) { console.log(type, msg); return; }
        const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

        toastEl.className = 'toast ' + type;
        toastEl.innerHTML = `<i class="fas ${icon}"></i><span>${escapeHtml(msg)}</span>`;
        toastEl.classList.add('show');

        clearTimeout(toastEl._t);
        toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 3000);
    }

    // ============================================================
    // HELPERS
    // ============================================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }

    function getShortName(sourceName, sourceType) {
        if (!sourceName) return '—';
        if (sourceType === 'archive') {
            const parts = sourceName.split(/[/\\]/);
            return parts[parts.length - 1];
        }
        const parts = sourceName.split('/');
        return parts[parts.length - 1];
    }

    function formatDuration(ms) {
        if (!ms && ms !== 0) return '—';
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    }

    // ============================================================
    // SOURCE TYPE / STATUS
    // ============================================================
    const SOURCE_TYPE_MAP = {
        repository: { label: 'Repository', class: 'source-type-repository', icon: 'fab fa-github' },
        url:        { label: 'URL',        class: 'source-type-url',        icon: 'fas fa-globe' },
        network:    { label: 'Network',    class: 'source-type-network',    icon: 'fas fa-server' },
        workflow:   { label: 'Workflow',   class: 'source-type-workflow',   icon: 'fas fa-code-branch' },
        archive:    { label: 'Archive',    class: 'source-type-archive',    icon: 'fas fa-file-archive' }
    };

    function sourceTypeInfo(type) {
        return SOURCE_TYPE_MAP[type] || {
            label: 'Unknown',
            class: 'source-type-archive',
            icon: 'fas fa-question-circle'
        };
    }

    function statusLabel(s) {
        return { success: 'Success', error: 'Error', running: 'In Progress' }[s] || 'In Progress';
    }

    // ============================================================
    // MODAL HELPERS
    // ============================================================
    function openModal(id) {
        const el = $(id);
        if (el) el.classList.add('active');
    }

    function closeModal(id) {
        const el = $(id);
        if (el) el.classList.remove('active');
    }

    function closeAllModals() {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }

    // ============================================================
    // LOAD
    // ============================================================
    async function loadHistory() {
        try {
            const response = await fetch(API);
            const data = await response.json();

            if (data.success) {
                currentRecords = data.records || [];
                currentPage = 1;
                renderTable();
                renderPagination();
            } else {
                showError('Failed to load history');
            }
        } catch (error) {
            console.error('Error loading history:', error);
            showError('Connection error');
        }
    }

    // ============================================================
    // RENDER TABLE
    // ============================================================
    function renderTable() {
        if (!currentRecords.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-history"></i>
                        <p>Scan history is empty</p>
                    </td>
                </tr>
            `;
            return;
        }

        const start = (currentPage - 1) * ROWS_PER_PAGE;
        const end = start + ROWS_PER_PAGE;
        const pageRecords = currentRecords.slice(start, end);

        tbody.innerHTML = pageRecords.map(record => {
            const shortName = record.sourceType === 'url'
                ? record.sourceName
                : getShortName(record.sourceName, record.sourceType);

            const st = sourceTypeInfo(record.sourceType);
            const status = record.status || 'running';
            const dateStr = new Date(record.endTime || record.startTime).toLocaleString();

            return `
                <tr>
                    <td><strong>${escapeHtml((record.tool || '—').toUpperCase())}</strong></td>
                    <td>
                        <span class="source-type-badge ${st.class}">
                            <i class="${st.icon}"></i> ${st.label}
                        </span>
                    </td>
                    <td class="source-name" title="${escapeHtml(record.sourceName)}">
                        ${escapeHtml(shortName)}
                    </td>
                    <td>${escapeHtml(dateStr)}</td>
                    <td>${formatDuration(record.duration)}</td>
                    <td>
                        <span class="status-badge status-${status}">
                            ${statusLabel(status)}
                        </span>
                    </td>
                    <td>
                        <div class="actions-cell">
                            <button class="action-btn report"
                                    data-tool="${escapeHtml(record.tool)}"
                                    data-report="${escapeHtml(record.reportId)}"
                                    title="View report">
                                <i class="fab fa-html5"></i>
                            </button>
                            ${record.sourceType === 'repository' || record.sourceType === 'url' ? `
                                <button class="action-btn replay"
                                        data-type="${escapeHtml(record.sourceType)}"
                                        data-tool="${escapeHtml(record.tool)}"
                                        data-url="${escapeHtml(record.sourceName)}"
                                        data-branch="${escapeHtml(record.branch || '')}"
                                        title="Replay scan">
                                    <i class="fas fa-play"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach events
        tbody.querySelectorAll('.action-btn.report').forEach(btn => {
            btn.addEventListener('click', () => {
                viewDetails(btn.dataset.tool, btn.dataset.report);
            });
        });

        tbody.querySelectorAll('.action-btn.replay').forEach(btn => {
            btn.addEventListener('click', () => {
                replayScan({
                    type: btn.dataset.type,
                    tool: btn.dataset.tool,
                    url: btn.dataset.url,
                    branch: btn.dataset.branch
                });
            });
        });
    }

    // ============================================================
    // REPLAY
    // ============================================================
    function replayScan({ type, tool, url, branch }) {
        if (!url || !tool) {
            toast('Missing scan parameters', 'error');
            return;
        }

        const target = `/?tool=${encodeURIComponent(tool)}&source=${encodeURIComponent(type)}&url=${encodeURIComponent(url)}${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`;
        window.location.href = target;
    }

    // ============================================================
    // PAGINATION
    // ============================================================
    function renderPagination() {
        const pagination = $('pagination');
        if (!pagination) return;

        const totalPages = Math.ceil(currentRecords.length / ROWS_PER_PAGE);

        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        pagination.innerHTML = html;

        pagination.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                renderTable();
                renderPagination();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    // ============================================================
    // CLEAR HISTORY (кастомная модалка)
    // ============================================================
    function clearHistory() {
        openModal('confirmModal');
    }

    async function confirmClearHistory() {
        const btn = $('confirmClearBtn');
        if (btn) btn.disabled = true;

        try {
            const response = await fetch(API, { method: 'DELETE' });
            const data = await response.json();

            if (data.success) {
                toast('History cleared', 'success');
                closeModal('confirmModal');
                loadHistory();
            } else {
                toast('Clear failed', 'error');
            }
        } catch (error) {
            toast('Clear failed', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    // ============================================================
    // DETAIL MODAL
    // ============================================================
    function viewDetails(tool, reportId) {
            if (!tool || !reportId) return;

            const url = `${window.location.origin}/api/${tool}/history/${reportId}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }

    // ============================================================
    // ERROR
    // ============================================================
    function showError(message) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${escapeHtml(message)}</p>
                </td>
            </tr>
        `;
    }

    // ============================================================
    // THEME TOGGLE
    // ============================================================
    function initThemeToggle() {
        const t = $('themeToggle');
        const root = document.documentElement;
        if (!t) return;

        t.addEventListener('click', () => {
            const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            localStorage.setItem('hercules_theme', next);
        });

        if (window.matchMedia) {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            mq.addEventListener('change', (e) => {
                if (!localStorage.getItem('hercules_theme')) {
                    root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    // ============================================================
    // EVENTS
    // ============================================================
    function initEvents() {
        $('refreshBtn')?.addEventListener('click', loadHistory);
        $('clearHistoryBtn')?.addEventListener('click', clearHistory);
        $('confirmClearBtn')?.addEventListener('click', confirmClearHistory);

        // Close buttons внутри модалок
        document.querySelectorAll('[data-close]').forEach(el => {
            el.addEventListener('click', closeAllModals);
        });

        // Клик по оверлею
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('active');
            });
        });

        // Esc
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAllModals();
        });
    }

    // ============================================================
    // INIT
    // ============================================================
    function init() {
        initThemeToggle();
        initEvents();

        if (typeof loadMenu === 'function') {
            try { loadMenu(); } catch (e) { console.warn('loadMenu failed', e); }
        }

        loadHistory();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();