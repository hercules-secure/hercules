/* ============================================================
   Home — Dashboard
   ============================================================ */

(function () {
    'use strict';

    // ============================================================
    // CONFIG
    // ============================================================
    const API = {
        summary: '/api/home/summary',
        activity: '/api/home/activity',
        history: '/api/history',
        collaboration: '/api/collaboration',
        cmdb: '/api/cmdb',
        donors: '/api/donor',
        notes: '/api/notes'
    };

    // ============================================================
    // STATE
    // ============================================================
    let state = {
        scans: [],
        chats: [],
        assets: [],
        donors: [],
        notes: [],
        totals: {
            scansTotal: 0,
            scansToday: 0,
            vulnTotal: 0,
            vulnBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
            assetsTotal: 0,
            donorsTotal: 0,
            notesTotal: 0,
            chatsTotal: 0,
            unread: 0
        },
        activities: []
    };

    // ============================================================
    // DOM
    // ============================================================
    const $ = (id) => document.getElementById(id);

    // ============================================================
    // TOAST
    // ============================================================
    const TOAST_ICONS = {
        success: 'fa-circle-check',
        error: 'fa-circle-exclamation',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };

    function toast(msg, type = 'success') {
        const el = $('toast');
        if (!el) { console.log(type, msg); return; }
        const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

        el.className = 'toast ' + type;
        el.innerHTML = `<i class="fas ${icon}"></i><span>${escapeHtml(msg)}</span>`;
        el.classList.add('show');

        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), 3000);
    }

    // ============================================================
    // HELPERS
    // ============================================================
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[m]));
    }

    function escapeAttr(s) {
        return escapeHtml(s).replace(/\n/g, ' ');
    }

    function pluralize(n, forms) {
        const n10 = n % 10, n100 = n % 100;
        if (n10 === 1 && n100 !== 11) return forms[0];
        if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
        return forms[2];
    }

    function timeAgo(iso) {
        if (!iso) return '';
        const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return new Date(iso).toLocaleDateString();
    }

    // ============================================================
    // SAFE FETCH
    // ============================================================
    async function safeFetch(url) {
        try {
            const r = await fetch(url);
            if (!r.ok) return null;
            return await r.json();
        } catch { return null; }
    }

    // ============================================================
    // LOAD
    // ============================================================
    async function loadAll() {
        const summary = await safeFetch(API.summary);

        if (summary?.success) {
            state.scans = summary.scans?.recent || [];
            state.totals = {
                scansTotal: summary.scans?.total || 0,
                scansToday: summary.scans?.today || 0,
                vulnTotal: summary.vulnerabilities?.total || 0,
                vulnBySeverity: summary.vulnerabilities?.bySeverity || { critical: 0, high: 0, medium: 0, low: 0 },
                assetsTotal: summary.assets?.total || 0,
                donorsTotal: summary.donors?.total || 0,
                notesTotal: summary.notes?.total || 0,
                chatsTotal: summary.collaboration?.chats || 0,
                unread: summary.collaboration?.unread || 0
            };

            const activityRes = await safeFetch(`${API.activity}?limit=20`);
            state.activities = activityRes?.activities || [];

            const [assets, chats, notesList] = await Promise.all([
                safeFetch(API.cmdb).then(r => Array.isArray(r) ? r : []),
                safeFetch(API.collaboration).then(r => Array.isArray(r) ? r : []),
                safeFetch(API.notes).then(r => Array.isArray(r) ? r : [])
            ]);
            state.assets = assets;
            state.chats = chats;
            state.donors = [];
            state.notes = notesList;
            return;
        }

        const [scans, chats, assets, donors, notes] = await Promise.all([
            safeFetch(API.history).then(r => r?.records || []),
            safeFetch(API.collaboration).then(r => Array.isArray(r) ? r : []),
            safeFetch(API.cmdb).then(r => Array.isArray(r) ? r : []),
            safeFetch(API.donors).then(r => Array.isArray(r) ? r : []),
            safeFetch(API.notes).then(r => Array.isArray(r) ? r : [])
        ]);

        state.scans = scans;
        state.chats = chats;
        state.assets = assets;
        state.donors = donors;
        state.notes = notes;

        const today = new Date().toDateString();
        const scansToday = scans.filter(s => {
            const d = new Date(s.endTime || s.startTime);
            return d.toDateString() === today;
        }).length;

        let vulnTotal = 0;
        const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
        scans.slice(0, 20).forEach(s => {
            if (s.summary) {
                vulnTotal += Number(s.summary.total) || 0;
                bySev.critical += Number(s.summary.critical) || 0;
                bySev.high += Number(s.summary.high) || 0;
                bySev.medium += Number(s.summary.medium) || 0;
                bySev.low += Number(s.summary.low) || 0;
            } else if (typeof s.vulnerabilities === 'number') {
                vulnTotal += s.vulnerabilities;
            }
        });

        state.totals = {
            scansTotal: scans.length,
            scansToday,
            vulnTotal,
            vulnBySeverity: bySev,
            assetsTotal: assets.length,
            donorsTotal: donors.length,
            notesTotal: notes.length,
            chatsTotal: chats.length,
            unread: chats.reduce((sum, c) => sum + (c.unread || 0), 0)
        };

        state.activities = null;
    }

    // ============================================================
    // ACTIVITY TIMELINE
    // ============================================================
    function buildActivitiesFromState() {
        if (state.activities) return state.activities;

        const acts = [];

        state.scans.slice(0, 10).forEach(s => {
            acts.push({
                kind: 'scan',
                title: `Scan ${(s.tool || '').toUpperCase()}`,
                desc: s.sourceName || 'No source',
                time: s.endTime || s.startTime,
                link: '/history'
            });
        });

        state.assets.slice(0, 10).forEach(a => {
            acts.push({
                kind: 'asset',
                title: 'Asset added',
                desc: a.name || 'Unnamed',
                time: a.created_at,
                link: '/cmdb'
            });
        });

        state.donors.slice(0, 10).forEach(d => {
            acts.push({
                kind: 'donor',
                title: 'Data donor registered',
                desc: d.name || 'Unnamed',
                time: d.created_at,
                link: '/donor'
            });
        });

        state.notes.slice(0, 10).forEach(n => {
            acts.push({
                kind: 'note',
                title: n.kind === 'task' ? 'Task updated' : 'Note updated',
                desc: n.title || 'Untitled',
                time: n.updated_at || n.created_at,
                link: '/notes'
            });
        });

        acts.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
        return acts.slice(0, 20);
    }

    const ACTIVITY_ICONS = {
        scan: 'fa-shield-halved',
        asset: 'fa-server',
        donor: 'fa-database',
        note: 'fa-note-sticky'
    };

    function renderActivities() {
        const listEl = $('activityList');
        const countEl = $('activityCount');
        if (!listEl) return;

        const acts = buildActivitiesFromState();

        if (countEl) countEl.textContent = acts.length ? `${acts.length} events` : '';

        if (!acts.length) {
            listEl.innerHTML = `
                <div class="empty-row">
                    <i class="fas fa-wave-square"></i>
                    No activity yet
                </div>
            `;
            return;
        }

        listEl.innerHTML = acts.map(a => {
            const icon = ACTIVITY_ICONS[a.kind] || 'fa-circle-dot';
            return `
                <a class="activity-item kind-${a.kind}" href="${escapeAttr(a.link || '#')}">
                    <div class="activity-icon"><i class="fas ${icon}"></i></div>
                    <div class="activity-body">
                        <div class="activity-title">${escapeHtml(a.title || '')}</div>
                        <div class="activity-desc">${escapeHtml(a.desc || '')}</div>
                    </div>
                    <div class="activity-time">${escapeHtml(timeAgo(a.time))}</div>
                </a>
            `;
        }).join('');
    }

    // ============================================================
    // RECENT SCANS
    // ============================================================
    function renderRecentTasks() {
    const listEl = $('tasksList');
    if (!listEl) return;

    const notes = state.notes || [];

    const tasks = notes
        .filter(n => n.kind === 'task')
        .sort((a, b) => {
            const ta = new Date(a.updated_at || a.created_at || 0).getTime();
            const tb = new Date(b.updated_at || b.created_at || 0).getTime();
            return tb - ta;
        })
        .slice(0, 5);

    if (!tasks.length) {
        listEl.innerHTML = `
            <div class="empty-row">
                <i class="fas fa-note-sticky"></i>
                No tasks yet
            </div>
        `;
        return;
    }

    listEl.innerHTML = tasks.map(t => {
        const status   = (t.status   || 'todo').toLowerCase();
        const priority = (t.priority || 'medium').toLowerCase();
        const title    = t.title || 'Untitled';
        const assignee = t.assignee || '';
        const short    = title.length > 50 ? title.slice(0, 50) + '…' : title;
        const when     = timeAgo(t.updated_at || t.created_at);

        const priorityIcon = {
            low:    'fa-arrow-down',
            medium: 'fa-minus',
            high:   'fa-arrow-up',
            critical: 'fa-fire'
        }[priority] || 'fa-minus';

        return `
            <div class="scan-row" onclick="window.location.href='/notes'">
                <div class="scan-tool">${escapeHtml(status.toUpperCase())}</div>
                <div class="scan-source" title="${escapeAttr(title)}">${escapeHtml(short)}</div>
                <div class="task-meta">
                    <span class="task-badge priority-${priority}" title="Priority: ${escapeAttr(priority)}">
                        <i class="fas ${priorityIcon}"></i> ${escapeHtml(priority)}
                    </span>
                    <span class="task-badge assignee" title="Assignee: ${escapeAttr(assignee || 'Unassigned')}">
                        <i class="fas fa-user"></i> ${escapeHtml(assignee || '—')}
                    </span>
                    <span class="task-time">${escapeHtml(when)}</span>
                </div>
            </div>
        `;
    }).join('');
}

    // ============================================================
    // CMDB ALERTS
    // ============================================================
    function buildCmdbAlerts() {
        const assets = state.assets || [];
        const alerts = [];

        const maintenance = assets.filter(a => a.status === 'maintenance').length;
        if (maintenance > 0) {
            alerts.push({
                sev: 'warning',
                icon: 'fa-tools',
                title: 'Assets under maintenance',
                desc: 'Require review before returning to production',
                count: maintenance,
                link: '/cmdb'
            });
        }

        const inactive = assets.filter(a => a.status === 'inactive').length;
        if (inactive > 0) {
            alerts.push({
                sev: 'info',
                icon: 'fa-circle-pause',
                title: 'Inactive assets',
                desc: 'Marked as inactive in the inventory',
                count: inactive,
                link: '/cmdb'
            });
        }

        const noOwner = assets.filter(a => !a.owner).length;
        if (noOwner > 0) {
            alerts.push({
                sev: 'critical',
                icon: 'fa-user-slash',
                title: 'Assets without owner',
                desc: 'No responsible person assigned',
                count: noOwner,
                link: '/cmdb'
            });
        }

        const noGit = assets.filter(a => !a.git && a.type === 'application').length;
        if (noGit > 0) {
            alerts.push({
                sev: 'warning',
                icon: 'fa-code-branch',
                title: 'Applications without Git',
                desc: 'No repository linked',
                count: noGit,
                link: '/cmdb'
            });
        }

        const noReport = assets.filter(a => !a.security).length;
        if (noReport > 0) {
            alerts.push({
                sev: 'warning',
                icon: 'fa-shield-halved',
                title: 'Assets without security report',
                desc: 'No recent security assessment',
                count: noReport,
                link: '/cmdb'
            });
        }

        const nameCount = {};
        assets.forEach(a => { if (a.name) nameCount[a.name] = (nameCount[a.name] || 0) + 1; });
        const dupes = Object.values(nameCount).filter(n => n > 1).length;
        if (dupes > 0) {
            alerts.push({
                sev: 'info',
                icon: 'fa-clone',
                title: 'Duplicate asset names',
                desc: 'Same name used more than once',
                count: dupes,
                link: '/cmdb'
            });
        }

        if (!alerts.length && assets.length > 0) {
            alerts.push({
                sev: 'ok',
                icon: 'fa-circle-check',
                title: 'All assets healthy',
                desc: 'No issues detected in inventory',
                count: assets.length,
                link: '/cmdb'
            });
        }

        if (!assets.length) {
            alerts.push({
                sev: 'info',
                icon: 'fa-server',
                title: 'No assets yet',
                desc: 'Add your first asset to CMDB',
                count: 0,
                link: '/cmdb'
            });
        }

        return alerts;
    }

    function renderCmdbAlerts() {
        const el = $('cmdbAlerts');
        if (!el) return;

        const alerts = buildCmdbAlerts();

        if (!alerts.length) {
            el.innerHTML = `<div class="empty-row"><i class="fas fa-server"></i> Nothing to show</div>`;
            return;
        }

        el.innerHTML = alerts.map(a => `
            <a class="alert-row sev-${a.sev}" href="${escapeAttr(a.link)}">
                <div class="alert-icon"><i class="fas ${a.icon}"></i></div>
                <div class="alert-body">
                    <div class="alert-title">${escapeHtml(a.title)}</div>
                    <div class="alert-desc">${escapeHtml(a.desc)}</div>
                </div>
                <div class="alert-count">${a.count}</div>
            </a>
        `).join('');
    }

    // ============================================================
    // COLLABORATION INBOX
    // ============================================================
    function buildCollabInbox() {
        const chats = state.chats || [];

        const sorted = [...chats].sort((a, b) => {
            const unreadA = (a.unread || 0) > 0 ? 1 : 0;
            const unreadB = (b.unread || 0) > 0 ? 1 : 0;
            if (unreadA !== unreadB) return unreadB - unreadA;

            const lastA = lastMsgTime(a);
            const lastB = lastMsgTime(b);
            return lastB - lastA;
        });

        return sorted.slice(0, 8);
    }

    function lastMsgTime(chat) {
        const msgs = chat.messages || [];
        if (!msgs.length) return 0;
        const last = msgs[msgs.length - 1];
        return new Date(last.created_at || 0).getTime();
    }

    function renderCollabInbox() {
        const el = $('collabInbox');
        const badge = $('collabUnreadBadge');
        if (!el) return;

        const chats = state.chats || [];

        if (badge) {
            const unreadTotal = state.totals?.unread || chats.reduce((s, c) => s + (c.unread || 0), 0);
            badge.textContent = unreadTotal > 0 ? `${unreadTotal} unread` : 'All read';
            badge.className = 'dashboard-card-hint' + (unreadTotal > 0 ? ' has-unread' : '');
        }

        if (!chats.length) {
            el.innerHTML = `<div class="empty-row"><i class="fas fa-comments"></i> No chats yet</div>`;
            return;
        }

        const visible = buildCollabInbox();
        const unreadTotal = chats.reduce((s, c) => s + (c.unread || 0), 0);
        const totalMsgs = chats.reduce((s, c) => s + ((c.messages || []).length), 0);

        const itemsHtml = visible.map(c => {
            const msgs = c.messages || [];
            const last = msgs[msgs.length - 1];
            const preview = last
                ? `${last.author || 'unknown'}: ${String(last.text || '').slice(0, 50)}`
                : 'No messages yet';

            const unread = c.unread || 0;
            const isUnread = unread > 0;
            const visibility = c.visibility || 'private';
            const visIcon = visibility === 'public' ? 'fa-globe' : 'fa-lock';

            const initial = String(c.name || '#').replace(/^#/, '').slice(0, 2).toUpperCase() || '#';
            const timeStr = last ? timeAgo(last.created_at) : '';

            return `
                <a class="chat-preview ${isUnread ? 'unread' : ''}" href="/collaboration">
                    <div class="chat-preview-avatar">
                        ${escapeHtml(initial)}
                        <span class="visibility-dot"><i class="fas ${visIcon}"></i></span>
                    </div>
                    <div class="chat-preview-body">
                        <div class="chat-preview-name">${escapeHtml(c.name || 'Untitled')}</div>
                        <div class="chat-preview-msg">${escapeHtml(preview)}</div>
                    </div>
                    <div class="chat-preview-meta">
                        ${timeStr ? `<span class="chat-preview-time">${escapeHtml(timeStr)}</span>` : ''}
                        ${isUnread ? `<span class="chat-preview-badge">${unread}</span>` : ''}
                    </div>
                </a>
            `;
        }).join('');

        el.innerHTML = `
            ${itemsHtml}
            <div class="collab-summary">
                <span class="collab-summary-chip">
                    <i class="fas fa-comments"></i>
                    <strong>${chats.length}</strong> chats
                </span>
                <span class="collab-summary-chip">
                    <i class="fas fa-envelope"></i>
                    <strong>${totalMsgs}</strong> messages
                </span>
                ${unreadTotal > 0 ? `
                    <span class="collab-summary-chip">
                        <i class="fas fa-circle"></i>
                        <strong>${unreadTotal}</strong> unread
                    </span>
                ` : `
                    <span class="collab-summary-chip">
                        <i class="fas fa-check"></i>
                        all read
                    </span>
                `}
            </div>
        `;
    }

    // ============================================================
    // SVG CHARTS
    // ============================================================
    const SEVERITY_COLORS = {
        critical: '#dc2626',
        high: '#f97316',
        medium: '#eab308',
        low: '#22c55e'
    };

    function renderScansChart(days = 7) {
        const svg = $('chartScans');
        if (!svg) return;

        const now = new Date();
        const buckets = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            buckets.push({
                date: d,
                label: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                count: 0
            });
        }

        (state.scans || []).forEach(s => {
            const t = s.endTime || s.startTime;
            if (!t) return;
            const sd = new Date(t).toDateString();
            const bucket = buckets.find(b => b.date.toDateString() === sd);
            if (bucket) bucket.count++;
        });

        const hint = $('scansPerDayHint');
        if (hint) {
            const total = buckets.reduce((s, b) => s + b.count, 0);
            hint.textContent = `${total} in last ${days}d`;
        }

        const W = 600, H = 200;
        const padL = 32, padR = 16, padT = 16, padB = 32;
        const innerW = W - padL - padR;
        const innerH = H - padT - padB;

        const max = Math.max(1, ...buckets.map(b => b.count));
        const niceMax = Math.ceil(max / 5) * 5 || 5;

        const xAt = i => padL + (buckets.length === 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW);
        const yAt = v => padT + innerH - (v / niceMax) * innerH;

        let grid = '';
        for (let i = 0; i <= 4; i++) {
            const y = padT + (innerH / 4) * i;
            const value = Math.round(niceMax - (niceMax / 4) * i);
            grid += `<line class="chart-grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" />`;
            grid += `<text class="chart-axis-text" x="${padL - 6}" y="${y + 3}" text-anchor="end">${value}</text>`;
        }

        let xLabels = '';
        const step = buckets.length > 7 ? Math.ceil(buckets.length / 7) : 1;
        buckets.forEach((b, i) => {
            if (i % step !== 0 && i !== buckets.length - 1) return;
            xLabels += `<text class="chart-axis-text" x="${xAt(i)}" y="${H - 10}" text-anchor="middle">${b.label}</text>`;
        });

        const points = buckets.map((b, i) => `${xAt(i)},${yAt(b.count)}`).join(' ');
        const areaPoints = `${padL},${padT + innerH} ${points} ${W - padR},${padT + innerH}`;

        let dots = '';
        buckets.forEach((b, i) => {
            dots += `
                <circle class="chart-point" cx="${xAt(i)}" cy="${yAt(b.count)}" r="4">
                    <title>${b.label}: ${b.count} scans</title>
                </circle>
            `;
        });

        svg.innerHTML = `
            <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
                </linearGradient>
            </defs>
            ${grid}
            ${xLabels}
            <polygon class="chart-area" points="${areaPoints}"/>
            <polyline class="chart-line" points="${points}"/>
            ${dots}
        `;
    }

    function renderSeverityChart() {
        const svg = $('chartSeverity');
        const legend = $('severityLegend');
        if (!svg) return;

        const data = state.totals?.vulnBySeverity || { critical: 0, high: 0, medium: 0, low: 0 };
        const total = Object.values(data).reduce((s, v) => s + (Number(v) || 0), 0);

        const cx = 100, cy = 100, r = 70, sw = 22;
        const C = 2 * Math.PI * r;

        let segments = '';
        let offset = 0;
        const order = ['critical', 'high', 'medium', 'low'];

        if (total === 0) {
            segments = `
                <circle cx="${cx}" cy="${cy}" r="${r}"
                        fill="none" stroke="var(--border)" stroke-width="${sw}" opacity="0.4"/>
            `;
        } else {
            order.forEach(sev => {
                const value = Number(data[sev]) || 0;
                if (value === 0) return;
                const frac = value / total;
                const len = frac * C;
                const color = SEVERITY_COLORS[sev];

                segments += `
                    <circle class="donut-segment"
                            cx="${cx}" cy="${cy}" r="${r}"
                            stroke="${color}"
                            stroke-dasharray="${len} ${C - len}"
                            stroke-dashoffset="${-offset}"
                            transform="rotate(-90 ${cx} ${cy})"
                            style="color:${color}">
                        <title>${sev}: ${value}</title>
                    </circle>
                `;
                offset += len;
            });
        }

        svg.innerHTML = `
            ${segments}
            <text class="donut-center-value" x="${cx}" y="${cy - 6}">${total}</text>
            <text class="donut-center-label" x="${cx}" y="${cy + 16}">TOTAL</text>
        `;

        if (legend) {
            legend.innerHTML = order.map(sev => {
                const value = Number(data[sev]) || 0;
                return `
                    <li class="donut-legend-item" data-sev="${sev}">
                        <span class="donut-legend-dot"
                              style="background:${SEVERITY_COLORS[sev]}; color:${SEVERITY_COLORS[sev]};"></span>
                        <span class="donut-legend-label">${sev}</span>
                        <span class="donut-legend-value">${value}</span>
                    </li>
                `;
            }).join('');
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
    // RENDER ALL
    // ============================================================
    function renderAll() {
        renderScansChart(7);
        renderSeverityChart();
        renderActivities();
        renderRecentTasks();
        renderCmdbAlerts();
        renderCollabInbox();
    }

    // ============================================================
    // REFRESH
    // ============================================================
    async function refresh() {
        const btn = $('refreshBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        }

        try {
            await loadAll();
            renderAll();
            toast('Dashboard refreshed', 'success');
        } catch (e) {
            toast('Refresh failed', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            }
        }
    }

    // ============================================================
    // INIT
    // ============================================================
    async function init() {
        initThemeToggle();

        renderScansChart(7);
        renderSeverityChart();

        await loadAll();
        renderAll();

        $('refreshBtn')?.addEventListener('click', refresh);

        setInterval(async () => {
            await loadAll();
            renderAll();
        }, 60000);

        if (typeof loadMenu === 'function') {
            try { loadMenu(); } catch (e) { console.warn('loadMenu failed', e); }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();