/* ============================================================
   Notes — frontend
   ============================================================ */

(function () {
    'use strict';

    // ---------- CONFIG ----------
    const API = '/api/notes';

    // ---------- STATE ----------
    let items = [];
    let currentId = null;
    let currentFilter = 'all';   // all | task | note
    let newKind = 'note';         // note | task

    // ---------- DOM ----------
    const $ = (id) => document.getElementById(id);
    const listEl = $('notesList');
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
    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function statusLabel(s) {
        return {
            todo: 'To do',
            in_progress: 'In progress',
            done: 'Done',
            cancelled: 'Cancelled'
        }[s] || s;
    }

    // ============================================================
    // LOAD
    // ============================================================
    async function load() {
        try {
            const r = await fetch(API);
            if (!r.ok) throw new Error('Load error');
            items = await r.json();
            renderList();

            if (items.length && currentId === null) selectItem(items[0].id);
            else if (currentId !== null && !items.find(x => x.id === currentId)) {
                currentId = null;
                $('editorActive').style.display = 'none';
                $('editorEmpty').style.display = 'flex';
            } else if (currentId !== null) {
                selectItem(currentId);
            }
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    // ============================================================
    // FILTER
    // ============================================================
    function filtered() {
        if (currentFilter === 'all') return items;
        return items.filter(i => (i.kind || 'note') === currentFilter);
    }

    // ============================================================
    // RENDER LIST
    // ============================================================
    function renderList() {
        const list = filtered();

        if (!list.length) {
            listEl.innerHTML = `
                <div class="notes-empty">
                    <i class="fas fa-note-sticky" style="font-size:1.5rem;opacity:.3;display:block;margin-bottom:8px;"></i>
                    No ${currentFilter === 'all' ? 'items' : currentFilter + 's'} yet
                </div>`;
            return;
        }

        listEl.innerHTML = list.map(i => {
            const kind = i.kind || 'note';
            const isTask = kind === 'task';
            const done = isTask && i.status === 'done';

            const badges = [];
            badges.push(`<span class="note-item-badge type-${kind}">${kind}</span>`);

            if (isTask) {
                if (i.status) badges.push(`<span class="note-item-badge status-${i.status}">${statusLabel(i.status)}</span>`);
                if (i.priority) badges.push(`<span class="note-item-badge prio-${i.priority}">${i.priority}</span>`);
                if (i.due) badges.push(`<span class="note-item-meta-icon"><i class="fas fa-calendar-day"></i> ${escapeHtml(i.due)}</span>`);
                if (i.assignee) badges.push(`<span class="note-item-meta-icon"><i class="fas fa-user"></i> ${escapeHtml(i.assignee)}</span>`);
            } else {
                const date = new Date(i.updated_at || i.created_at).toLocaleDateString();
                badges.push(`<span class="note-item-meta-icon"><i class="far fa-clock"></i> ${date}</span>`);
            }

            return `
                <div class="note-item ${i.id === currentId ? 'active' : ''} ${done ? 'done' : ''}" data-id="${i.id}">
                    ${isTask ? `<div class="note-item-check ${done ? 'checked' : ''}" data-check="${i.id}"></div>` : ''}
                    <div class="note-item-content">
                        <span class="note-item-title">${escapeHtml(i.title || 'Untitled')}</span>
                        <div class="note-item-meta">${badges.join('')}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Клик по item → select
        listEl.querySelectorAll('.note-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('[data-check]')) return;
                selectItem(parseInt(el.dataset.id));
            });
        });

        // Клик по чекбоксу → toggle done
        listEl.querySelectorAll('[data-check]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleDone(parseInt(el.dataset.check));
            });
        });
    }

    // ============================================================
    // SELECT
    // ============================================================
    function selectItem(id) {
        const item = items.find(x => x.id === id);
        if (!item) return;

        currentId = id;
        const kind = item.kind || 'note';

        $('editorEmpty').style.display = 'none';
        $('editorActive').style.display = 'flex';

        $('editorKind').textContent = kind === 'task' ? 'Task' : 'Note';
        $('noteTitle').value = item.title || '';
        $('noteBody').value = item.body || '';

        if (kind === 'task') {
            $('taskFields').style.display = 'flex';
            $('taskStatus').value = item.status || 'todo';
            $('taskPriority').value = item.priority || 'medium';
            $('taskAssignee').value = item.assignee || '';
            $('taskDue').value = item.due || '';

            const badge = $('editorStatusBadge');
            badge.style.display = 'inline-block';
            badge.className = `editor-status-badge status-${item.status || 'todo'}`;
            badge.textContent = statusLabel(item.status || 'todo');
        } else {
            $('taskFields').style.display = 'none';
            $('editorStatusBadge').style.display = 'none';
        }

        renderList();
    }

    // ============================================================
    // TOGGLE DONE
    // ============================================================
    async function toggleDone(id) {
        const item = items.find(x => x.id === id);
        if (!item || (item.kind || 'note') !== 'task') return;

        const prev = item.status;
        item.status = item.status === 'done' ? 'todo' : 'done';
        item.updated_at = new Date().toISOString();

        renderList();
        if (currentId === id) selectItem(id);

        try {
            await fetch(`${API}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: item.status })
            });
        } catch (e) {
            toast(e.message, 'error');
            item.status = prev;
            renderList();
            if (currentId === id) selectItem(id);
        }
    }

    // ============================================================
    // CREATE
    // ============================================================
    async function createItem() {
        const kind = newKind;
        const payload = {
            kind,
            title: kind === 'task' ? 'New task' : 'New note',
            body: ''
        };

        if (kind === 'task') {
            payload.status = 'todo';
            payload.priority = 'medium';
            payload.assignee = '';
            payload.due = '';
        }

        try {
            const r = await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error('Create error');

            const item = await r.json();
            items.push(item);
            currentId = item.id;
            renderList();
            selectItem(item.id);

            $('noteTitle').focus();
            $('noteTitle').select();

            toast(kind === 'task' ? 'Task created' : 'Note created', 'success');
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    // ============================================================
    // SAVE
    // ============================================================
    async function saveItem() {
        if (currentId === null) return;
        const item = items.find(x => x.id === currentId);
        if (!item) return;

        const payload = {
            title: $('noteTitle').value.trim() || 'Untitled',
            body: $('noteBody').value
        };

        if ((item.kind || 'note') === 'task') {
            payload.status = $('taskStatus').value;
            payload.priority = $('taskPriority').value;
            payload.assignee = $('taskAssignee').value.trim();
            payload.due = $('taskDue').value;
        }

        try {
            const r = await fetch(`${API}/${currentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error('Save error');

            const saved = await r.json();
            const i = items.findIndex(x => x.id === currentId);
            if (i !== -1) items[i] = saved;

            renderList();
            selectItem(saved.id);
            toast('Saved', 'success');
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    // ============================================================
    // DELETE
    // ============================================================
    async function deleteItem() {
        if (currentId === null) return;

        const ok = await uiConfirm({
            title: 'Delete this item?',
            text: 'The note or task will be permanently removed.',
            okText: 'Delete',
            danger: true
        });
        if (!ok) return;

        try {
            const r = await fetch(`${API}/${currentId}`, { method: 'DELETE' });
            if (!r.ok && r.status !== 204) throw new Error('Delete error');

            items = items.filter(x => x.id !== currentId);
            currentId = null;
            $('editorActive').style.display = 'none';
            $('editorEmpty').style.display = 'flex';
            renderList();

            if (filtered().length) selectItem(filtered()[0].id);
            toast('Deleted', 'success');
        } catch (e) {
            toast(e.message, 'error');
        }
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
    }

    // ============================================================
    // EVENTS
    // ============================================================
    function initEvents() {
        $('newBtn')?.addEventListener('click', createItem);
        $('saveBtn')?.addEventListener('click', saveItem);
        $('deleteBtn')?.addEventListener('click', deleteItem);

        // Segmented: note / task
        $('kindToggle')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.segment');
            if (!btn) return;
            $('kindToggle').querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            newKind = btn.dataset.kind;
        });

        // Tabs: all / task / note
        document.querySelectorAll('.notes-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.notes-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentFilter = tab.dataset.filter;
                renderList();
            });
        });

        // Ctrl+S / Cmd+S — save
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveItem();
            }
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

        load();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();