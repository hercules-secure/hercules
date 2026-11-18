        let TRANSLATIONS = {};
        let currentLang = 'en';

        function detectLang() {

            const saved = localStorage.getItem('hercules_lang');
            if (saved && ['ru', 'en', 'it'].includes(saved)) return saved;

            const browserLang = (navigator.language || 'ru').slice(0, 2).toLowerCase();
            if (['ru', 'en', 'it'].includes(browserLang)) return browserLang;

            return 'ru'; // fallback
        }

        async function loadTranslations(lang) {
            try {
                const res = await fetch(`/locales/${lang}.json`);
                if (!res.ok) throw new Error('not found');
                TRANSLATIONS = await res.json();
                currentLang = lang;
                localStorage.setItem('hercules_lang', lang);
                applyTranslations();
            } catch (e) {
                console.warn('Failed to load translations for', lang, e);
                if (lang !== 'en') {
                    await loadTranslations('ru');
                }
            }
        }

        function t(key) {
            return TRANSLATIONS[key] || key;
        }

        function applyTranslations() {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (TRANSLATIONS[key]) el.textContent = TRANSLATIONS[key];
            });

            // Плейсхолдеры
            const usernameInput = document.getElementById('username');
            if (usernameInput && TRANSLATIONS.placeholderUsername) {
                usernameInput.placeholder = TRANSLATIONS.placeholderUsername;
            }

            // Title страницы
            if (TRANSLATIONS.title) document.title = TRANSLATIONS.title;

            // Язык html
            document.documentElement.lang = currentLang;
        }

        const initialLang = detectLang();
        loadTranslations(initialLang);
