/* ============================================================
   Blender — page-level UI (theme toggle, sidebar, hotkeys)
   ============================================================ */

(function () {
    'use strict';

    const root = document.documentElement;

    // ---------- THEME ----------
    function applyTheme(theme) {
        root.setAttribute('data-theme', theme);
        localStorage.setItem('hercules_theme', theme);
    }

    function toggleTheme() {
        const current = root.getAttribute('data-theme') || 'dark';
        applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    function initTheme() {
        const btn = document.getElementById('themeToggle');
        if (btn) btn.addEventListener('click', toggleTheme);

        // follow system if user hasn't chosen
        if (window.matchMedia) {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            mq.addEventListener('change', (e) => {
                if (!localStorage.getItem('hercules_theme')) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    // ---------- INIT ----------
    function init() {
        initTheme();

        // Sidebar (загружается через common/sidebar.js, но на всякий случай)
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