// rules-modal.js

const RULES_MODAL_ID = 'rules-modal';

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_COLORS = {
  CRITICAL: { bg: '#fee2e2', fg: '#991b1b', border: '#fecaca' },
  HIGH:     { bg: '#ffedd5', fg: '#9a3412', border: '#fed7aa' },
  MEDIUM:   { bg: '#fef3c7', fg: '#92400e', border: '#fde68a' },
  LOW:      { bg: '#dcfce7', fg: '#166534', border: '#bbf7d0' },
  INFO:     { bg: '#dbeafe', fg: '#1e40af', border: '#bfdbfe' },
};

export async function openRulesModal() {
  // 1. если модалка уже открыта — не дублируем
  if (document.getElementById(RULES_MODAL_ID)) return;

  // 2. создаём контейнер и показываем спиннер
  const modal = document.createElement('div');
  modal.id = RULES_MODAL_ID;
  modal.className = 'rules-modal-overlay';
  modal.innerHTML = `
    <div class="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-modal-title">
      <div class="rules-modal-header">
        <h2 id="rules-modal-title">${t('sast.rules.title')}</h2>
        <button class="rules-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="rules-modal-body">
        <div class="rules-loading">${t('sast.rules.loading')}</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  injectStyles();

  const close = () => modal.remove();
  modal.querySelector('.rules-modal-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onEsc);
    }
  });

  // 3. грузим данные
  const body = modal.querySelector('.rules-modal-body');
  let data;
  try {
    const r = await fetch('/api/sast/rules', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    data = await r.json();
    if (!data.success) throw new Error(data.message || 'Server returned success=false');
  } catch (err) {
    body.innerHTML = `<div class="rules-error">Failed to load rules: ${escapeHtml(err.message)}</div>`;
    return;
  }

  // 4. рендерим UI
  const rules = data.rules || [];
  const categories = data.categories || {};

  body.innerHTML = `
    <div class="rules-toolbar">
      <input type="search" class="rules-search" placeholder="${t('sast.rules.search.placeholder')}">
      <select class="rules-filter-category">
        <option value="">${t('sast.rules.filter.category.all')}</option>
        ${Object.entries(categories)
          .map(([k, v]) => `<option value="${escapeHtml(k)}">${escapeHtml(v)}</option>`)
          .join('')}
      </select>
      <select class="rules-filter-severity">
        <option value="">${t('sast.rules.filter.severity.all')}</option>
        ${SEVERITY_ORDER.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <span class="rules-count">${rules.length} rules</span>
    </div>
    <div class="rules-list"></div>
  `;

  const listEl = body.querySelector('.rules-list');
  const searchEl = body.querySelector('.rules-search');
  const catEl = body.querySelector('.rules-filter-category');
  const sevEl = body.querySelector('.rules-filter-severity');
  const countEl = body.querySelector('.rules-count');

  const render = () => {
    const q = searchEl.value.trim().toLowerCase();
    const cat = catEl.value;
    const sev = sevEl.value;

    const filtered = rules.filter(r => {
      if (cat && r.category !== cat) return false;
      if (sev && r.severity !== sev) return false;
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q) ||
        r.pattern.toLowerCase().includes(q) ||
        (r.recommendation || '').toLowerCase().includes(q)
      );
    });

    countEl.textContent = `${filtered.length} / ${rules.length} rules`;

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="rules-empty">${t('sast.rules.empty')}</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(renderRule).join('');
  };

  searchEl.addEventListener('input', render);
  catEl.addEventListener('change', render);
  sevEl.addEventListener('change', render);

  render();
}

// ─────────────────────────────────────────────────────────────
// Рендер одного правила
// ─────────────────────────────────────────────────────────────
function renderRule(rule) {
  const s = SEVERITY_COLORS[rule.severity] || SEVERITY_COLORS.INFO;
  const languages = (rule.languages || []).join(', ') || '—';
  const negative = rule.negative_pattern
    ? `<div class="rules-field"><span class="rules-field-label">${t('sast.rules.field.negative_pattern')}</span>
         <pre>${escapeHtml(rule.negative_pattern)}</pre></div>`
    : '';

  return `
    <details class="rules-item">
      <summary>
        <span class="rules-sev" style="background:${s.bg};color:${s.fg};border-color:${s.border}">
          ${rule.severity}
        </span>
        <code class="rules-id">${escapeHtml(rule.id)}</code>
        <span class="rules-cat">${escapeHtml(rule.category)}</span>
        <span class="rules-msg">${escapeHtml(rule.message)}</span>
      </summary>
      <div class="rules-detail">
        <div class="rules-field"><span class="rules-field-label">${t('sast.rules.field.pattern')}</span>
          <pre>${escapeHtml(rule.pattern)}</pre></div>
        ${negative}
        <div class="rules-field"><span class="rules-field-label">flags</span>
          <code>${escapeHtml(rule.flags || '—')}</code></div>
        <div class="rules-field"><span class="rules-field-label">${t('sast.rules.field.recommendation')}</span>
          <div>${escapeHtml(rule.recommendation || '—')}</div></div>
        <div class="rules-field"><span class="rules-field-label">${t('sast.rules.field.languages')}</span>
          <div>${escapeHtml(languages)}</div></div>
      </div>
    </details>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────
// Стили (инжектятся один раз)
// ─────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('rules-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'rules-modal-styles';
  style.textContent = `
    .rules-modal-overlay {
      position: fixed; inset: 0; background: rgba(17, 24, 39, .55);
      display: flex; align-items: center; justify-content: center;
      z-index: 10000; padding: 24px;
      font-family: 'Fira Sans', system-ui, sans-serif;
    }
    .rules-modal {
      background: #fff; color: #1f2937;
      width: min(1100px, 100%); max-height: 90vh;
      border-radius: 14px; display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,.35); overflow: hidden;
    }
    .rules-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(135deg, #111827, #1f2937); color: #fff;
    }
    .rules-modal-header h2 {
      margin: 0; font-family: 'Fira Code', monospace; font-size: 1.05rem;
    }
    .rules-modal-close {
      background: transparent; border: 0; color: #e5e7eb;
      font-size: 1.6rem; line-height: 1; cursor: pointer; padding: 0 6px;
    }
    .rules-modal-close:hover { color: #fff; }
    .rules-modal-body {
      padding: 16px 20px; overflow: auto; flex: 1;
    }
    .rules-toolbar {
      display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px;
      align-items: center;
    }
    .rules-toolbar input, .rules-toolbar select {
      font-family: inherit; font-size: .85rem;
      padding: 7px 10px; border: 1px solid #e5e7eb; border-radius: 8px;
      background: #f9fafb; color: #1f2937;
    }
    .rules-toolbar input[type=search] { flex: 1 1 240px; }
    .rules-count {
      margin-left: auto; font-family: 'Fira Code', monospace;
      font-size: .72rem; color: #6b7280;
    }
    .rules-list { display: flex; flex-direction: column; gap: 8px; }
    .rules-item {
      border: 1px solid #e5e7eb; border-radius: 10px; background: #fff;
      overflow: hidden;
    }
    .rules-item[open] { box-shadow: 0 2px 10px rgba(0,0,0,.06); }
    .rules-item summary {
      list-style: none; cursor: pointer; padding: 10px 14px;
      display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    }
    .rules-item summary::-webkit-details-marker { display: none; }
    .rules-sev {
      font-family: 'Fira Code', monospace; font-size: .66rem; font-weight: 700;
      padding: 3px 8px; border-radius: 40px; border: 1px solid transparent;
      letter-spacing: .03em;
    }
    .rules-id {
      font-family: 'Fira Code', monospace; font-size: .75rem; color: #2563eb;
      background: #f3f4f6; padding: 2px 6px; border-radius: 5px;
    }
    .rules-cat {
      font-family: 'Fira Code', monospace; font-size: .68rem; color: #6b7280;
    }
    .rules-msg { flex: 1 1 100%; color: #374151; font-size: .85rem; }
    .rules-detail {
      padding: 10px 14px 14px; border-top: 1px solid #f3f4f6;
      display: flex; flex-direction: column; gap: 10px;
    }
    .rules-field { display: flex; flex-direction: column; gap: 4px; }
    .rules-field-label {
      font-family: 'Fira Code', monospace; font-size: .66rem;
      color: #6b7280; text-transform: uppercase; letter-spacing: .05em;
    }
    .rules-field pre {
      margin: 0; background: #111827; color: #e5e7eb;
      padding: 10px 12px; border-radius: 8px; overflow-x: auto;
      font-size: .74rem; font-family: 'Fira Code', monospace;
      white-space: pre-wrap; word-break: break-all;
    }
    .rules-loading, .rules-error, .rules-empty {
      padding: 40px; text-align: center; color: #6b7280;
      font-family: 'Fira Code', monospace; font-size: .85rem;
    }
    .rules-error { color: #b91c1c; }
  `;
  document.head.appendChild(style);
}