// ===== UI CONFIRM / PROMPT =====

(function (global) {
    'use strict';

    // Локальный $ — не зависит от других файлов
    const $ = global.$ || ((id) => document.getElementById(id));

    // Делаем $ доступным для других скриптов страницы
    if (!global.$) global.$ = $;

    function uiConfirm({
        title = 'Are you sure?',
        text = 'This action cannot be undone.',
        okText = 'Confirm',
        cancelText = 'Cancel',
        danger = true
    } = {}) {
        return new Promise((resolve) => {
            const modal = $('uiConfirm');
            if (!modal) return resolve(confirm(`${title}\n\n${text}`));

            const titleEl = $('uiConfirmTitle');
            const textEl = $('uiConfirmText');
            const okBtn = $('uiConfirmOk');
            const cancelBtn = $('uiConfirmCancel');

            titleEl.textContent = title;
            textEl.textContent = text;
            okBtn.textContent = okText;
            cancelBtn.textContent = cancelText;
            okBtn.classList.toggle('btn-danger', danger);
            okBtn.classList.toggle('btn-primary', !danger);

            modal.classList.add('active');

            function cleanup() {
                modal.classList.remove('active');
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                modal.removeEventListener('click', onOverlay);
                document.removeEventListener('keydown', onKey);
            }

            function onOk()     { cleanup(); resolve(true); }
            function onCancel() { cleanup(); resolve(false); }
            function onOverlay(e) { if (e.target === modal) onCancel(); }
            function onKey(e) {
                if (e.key === 'Escape') onCancel();
                if (e.key === 'Enter')  onOk();
            }

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
            modal.addEventListener('click', onOverlay);
            document.addEventListener('keydown', onKey);

            setTimeout(() => okBtn.focus(), 50);
        });
    }

    function uiPrompt({
        title = 'Enter value',
        text = '',
        placeholder = '',
        defaultValue = '',
        okText = 'OK',
        cancelText = 'Cancel'
    } = {}) {
        return new Promise((resolve) => {
            const modal = $('uiPrompt');
            if (!modal) return resolve(prompt(title, defaultValue));

            const titleEl = $('uiPromptTitle');
            const textEl = $('uiPromptText');
            const inputEl = $('uiPromptInput');
            const okBtn = $('uiPromptOk');
            const cancelBtn = $('uiPromptCancel');

            titleEl.textContent = title;
            if (text) {
                textEl.textContent = text;
                textEl.style.display = 'block';
            } else {
                textEl.style.display = 'none';
            }
            inputEl.placeholder = placeholder;
            inputEl.value = defaultValue;
            okBtn.textContent = okText;
            cancelBtn.textContent = cancelText;

            modal.classList.add('active');

            function cleanup() {
                modal.classList.remove('active');
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                modal.removeEventListener('click', onOverlay);
                inputEl.removeEventListener('keydown', onKey);
            }

            function onOk() {
                const value = inputEl.value.trim();
                cleanup();
                resolve(value || null);
            }
            function onCancel() { cleanup(); resolve(null); }
            function onOverlay(e) { if (e.target === modal) onCancel(); }
            function onKey(e) {
                if (e.key === 'Escape') onCancel();
                if (e.key === 'Enter')  onOk();
            }

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
            modal.addEventListener('click', onOverlay);
            inputEl.addEventListener('keydown', onKey);

            setTimeout(() => { inputEl.focus(); inputEl.select(); }, 50);
        });
    }

    // Экспортируем в глобал — чтобы вызывать из notes.js, cmdb.js и т.д.
    global.uiConfirm = uiConfirm;
    global.uiPrompt  = uiPrompt;

})(window);