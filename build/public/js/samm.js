(function() {
    const sammData = [
        {
            id: 'governance',
            title: 'Управление (Governance)',
            icon: 'fa-landmark',
            practices: [
                {
                    id: 'sm',
                    name: 'Стратегия и метрики',
                    desc: 'Цели, KPI, стратегия безопасности',
                    levels: [
                        { level: 1, opts: ['Стратегия отсутствует', 'Частично формализована', 'Утверждена и связана с бизнесом'] },
                        { level: 2, opts: ['Метрики не собираются', 'Базовые метрики собираются', 'Регулярный анализ метрик'] },
                        { level: 3, opts: ['Нет влияния на стратегию', 'Эпизодическое влияние', 'Корректировка стратегии по метрикам'] }
                    ]
                },
                {
                    id: 'cp',
                    name: 'Политика и комплаенс',
                    desc: 'Требования, политики, аудит',
                    levels: [
                        { level: 1, opts: ['Политики отсутствуют', 'Политики существуют', 'Политики утверждены'] },
                        { level: 2, opts: ['Аудит не проводится', 'Эпизодический аудит', 'Регулярный аудит'] },
                        { level: 3, opts: ['Нет автоматизации', 'Частичная автоматизация', 'Полная автоматизация'] }
                    ]
                },
                {
                    id: 'tm',
                    name: 'Обучение и культура',
                    desc: 'Навыки и осведомленность',
                    levels: [
                        { level: 1, opts: ['Обучение не проводится', 'Разовые мероприятия', 'Системное обучение'] },
                        { level: 2, opts: ['Нет регулярных тренингов', 'Нерегулярные тренинги', 'OWASP Top 10 / CWE top 25'] },
                        { level: 3, opts: ['Не оценивается', 'Оценка знаний', 'Влияние на KPI'] }
                    ]
                }
            ]
        },
        {
            id: 'design',
            title: 'Проектирование (Design)',
            icon: 'fa-pen-ruler',
            practices: [
                {
                    id: 'ta',
                    name: 'Оценка угроз',
                    desc: 'Моделирование угроз',
                    levels: [
                        { level: 1, opts: ['Не проводится', 'Мозговой штурм', 'Систематическая оценка'] },
                        { level: 2, opts: ['Нет методологии', 'Частичное использование STRIDE', 'Полный STRIDE с DFD'] },
                        { level: 3, opts: ['Ручной процесс', 'Частичная автоматизация', 'Автоматизация в CI/CD'] }
                    ]
                },
                {
                    id: 'sr',
                    name: 'Требования',
                    desc: 'Требования безопасности',
                    levels: [
                        { level: 1, opts: ['Не определены', 'Базовый чек-лист', 'В user stories'] },
                        { level: 2, opts: ['Нет проверки', 'Ручная проверка', 'Автоматизированная'] },
                        { level: 3, opts: ['Не валидируются', 'Частичная валидация', 'Полная автоматическая'] }
                    ]
                },
                {
                    id: 'sa',
                    name: 'Архитектура',
                    desc: 'Безопасные решения',
                    levels: [
                        { level: 1, opts: ['Не документируется', 'Отдельные шаблоны', 'Регулярное ревью'] },
                        { level: 2, opts: ['Нет реестра', 'Реестр устарел', 'Актуальный реестр'] },
                        { level: 3, opts: ['DFD отсутствуют', 'DFD есть', 'Автопроверка'] }
                    ]
                }
            ]
        },
        {
            id: 'development',
            title: 'Разработка (Development)',
            icon: 'fa-code',
            practices: [
                {
                    id: 'spp',
                    name: 'Безопасные практики',
                    desc: 'Безопасное кодирование',
                    levels: [
                        { level: 1, opts: ['Нет стандартов', 'Рекомендации', 'Стандарт кодирования'] },
                        { level: 2, opts: ['Не используются', 'Эпизодически', 'Системное использование'] },
                        { level: 3, opts: ['Нет шаблонов', 'Отдельные шаблоны', 'Библиотека шаблонов'] }
                    ]
                },
                {
                    id: 'scm',
                    name: 'Управление конфигурацией',
                    desc: 'Репозитории и секреты',
                    levels: [
                        { level: 1, opts: ['Не защищены', 'Базовая защита', 'Полная защита'] },
                        { level: 2, opts: ['Секреты в коде', 'Частичное управление', 'Secrets manager'] },
                        { level: 3, opts: ['Нет сканирования', 'Сканирование в CI', 'Pre-commit хуки'] }
                    ]
                },
                {
                    id: 'dependencies',
                    name: 'Зависимости',
                    desc: 'Сторонние компоненты',
                    levels: [
                        { level: 1, opts: ['Учет не ведется', 'Ручной учет', 'Автоматический SBOM'] },
                        { level: 2, opts: ['SCA не используется', 'Эпизодическое SCA', 'SCA в CI/CD'] },
                        { level: 3, opts: ['Не блокируется', 'Уведомления', 'Блокировка сборки'] }
                    ]
                }
            ]
        },
        {
            id: 'verification',
            title: 'Проверка (Verification)',
            icon: 'fa-check-double',
            practices: [
                {
                    id: 'dast',
                    name: 'DAST',
                    desc: 'Анализ запущенного приложения',
                    levels: [
                        { level: 1, opts: ['Не проводится', 'Ручное сканирование', 'Регулярное'] },
                        { level: 2, opts: ['Нет интеграции', 'Частичная интеграция', 'В CI/CD'] },
                        { level: 3, opts: ['Не анализируется', 'Ручной анализ', 'Автозадачи'] }
                    ]
                },
                {
                    id: 'sast',
                    name: 'SAST',
                    desc: 'Анализ исходного кода',
                    levels: [
                        { level: 1, opts: ['Не используется', 'Линтеры', 'SAST инструменты'] },
                        { level: 2, opts: ['Ручной запуск', 'По требованию', 'Автоматически'] },
                        { level: 3, opts: ['Стандартные правила', 'Частично кастомные', 'Полная кастомизация'] }
                    ]
                },
                {
                    id: 'ptr',
                    name: 'Пентесты',
                    desc: 'Тестирование на проникновение',
                    levels: [
                        { level: 1, opts: ['Не проводятся', 'Ad-hoc', 'Регулярные'] },
                        { level: 2, opts: ['Черный ящик', 'Белый ящик', 'Серый ящик'] },
                        { level: 3, opts: ['Не интегрированы', 'Ручное добавление', 'Автоинтеграция'] }
                    ]
                }
            ]
        },
        {
            id: 'operations',
            title: 'Эксплуатация (Operations)',
            icon: 'fa-gears',
            practices: [
                {
                    id: 'im',
                    name: 'Инциденты',
                    desc: 'Реагирование',
                    levels: [
                        { level: 1, opts: ['Нет процедуры', 'Неформальная', 'Документирована'] },
                        { level: 2, opts: ['Нет учений', 'Эпизодические', 'Регулярные'] },
                        { level: 3, opts: ['Ручные', 'Частично автоматические', 'Автоматические'] }
                    ]
                },
                {
                    id: 'em',
                    name: 'Окружение',
                    desc: 'Конфигурации',
                    levels: [
                        { level: 1, opts: ['Не изолированы', 'Базовая изоляция', 'Полная изоляция'] },
                        { level: 2, opts: ['Ручное управление', 'Частичный IaC', 'Полный IaC'] },
                        { level: 3, opts: ['Нет сканирования', 'Эпизодическое', 'CIS Benchmarks'] }
                    ]
                },
                {
                    id: 'odm',
                    name: 'Дефекты',
                    desc: 'Управление багами',
                    levels: [
                        { level: 1, opts: ['Не регистрируются', 'В Excel', 'В трекере'] },
                        { level: 2, opts: ['SLA нет', 'Неформальные SLA', 'Формальные SLA'] },
                        { level: 3, opts: ['Нет интеграции', 'Ручное создание', 'Автосоздание'] }
                    ]
                }
            ]
        }
    ];

    // ========== РАСЧЕТ УРОВНЯ ЗРЕЛОСТИ ==========
    function getMaturityLevel(percentage) {
        if (percentage < 20) return { level: 0, name: 'Отсутствует', color: '#6c757d' };
        if (percentage < 40) return { level: 1, name: 'Начальный', color: '#fd7e14' };
        if (percentage < 60) return { level: 2, name: 'Определенный', color: '#ffc107' };
        if (percentage < 80) return { level: 3, name: 'Управляемый', color: '#28a745' };
        if (percentage < 95) return { level: 4, name: 'Количественный', color: '#20c997' };
        return { level: 5, name: 'Оптимизируемый', color: '#17a2b8' };
    }

    function calculateOverallMaturity(scores) {
        const avgScore = scores.total;
        return getMaturityLevel(avgScore);
    }

    // ========== РАБОТА С LOCALSTORAGE ==========
    const STORAGE_KEY = 'rbpo-assessment-results';

    // Сохранение результатов в localStorage
    function saveResultsToStorage() {
        const results = {};
        
        document.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
            results[radio.name] = radio.value;
        });
        
        // Сохраняем также значения полей проекта, команды и ответственного
        const projectName = document.getElementById('pdfProjectName')?.value;
        const teamName = document.getElementById('pdfTeamName')?.value;
        const respondent = document.getElementById('pdfRespondent')?.value;
        
        if (projectName || teamName || respondent) {
            results.metadata = {
                project: projectName,
                team: teamName,
                respondent: respondent
            };
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
        //console.log('Results saved to localStorage');
        
        // Проверяем, все ли вопросы отвечены
        checkAllQuestionsAnswered();
    }

    // Загрузка результатов из localStorage
    function loadResultsFromStorage() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        
        try {
            const results = JSON.parse(saved);
            
            // Восстанавливаем выбранные радио-кнопки
            Object.entries(results).forEach(([name, value]) => {
                if (name === 'metadata') return;
                
                const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.closest('.radio-item')?.classList.add('selected');
                }
            });
            
            // Восстанавливаем поля метаданных
            if (results.metadata) {
                const projectInput = document.getElementById('pdfProjectName');
                const teamInput = document.getElementById('pdfTeamName');
                const respondentInput = document.getElementById('pdfRespondent');
                
                if (projectInput && results.metadata.project) projectInput.value = results.metadata.project;
                if (teamInput && results.metadata.team) teamInput.value = results.metadata.team;
                if (respondentInput && results.metadata.respondent) respondentInput.value = results.metadata.respondent;
            }
            
            // Обновляем отображение процентов
            updateAllScores();
            
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }

    // Очистка сохраненных результатов
    function clearSavedResults() {
        if (confirm('Очистить все сохраненные результаты?')) {
            localStorage.removeItem(STORAGE_KEY);
            
            // Сбрасываем все радио-кнопки
            document.querySelectorAll('input[type="radio"]').forEach(radio => {
                radio.checked = false;
                radio.closest('.radio-item')?.classList.remove('selected');
            });
            
            // Очищаем поля ввода
            const projectInput = document.getElementById('pdfProjectName');
            const teamInput = document.getElementById('pdfTeamName');
            const respondentInput = document.getElementById('pdfRespondent');
            
            if (projectInput) projectInput.value = '';
            if (teamInput) teamInput.value = '';
            if (respondentInput) respondentInput.value = '';
            
            updateAllScores();
            showNotification('✅ Результаты очищены', 'success');
        }
    }

    // ========== МОДАЛЬНОЕ ОКНО ==========
    function createModal() {
        // Создаем оверлей
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'rbpo-modal-overlay';
        modalOverlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            justify-content: center;
            align-items: flex-start;
            padding-top: 100px;
        `;

        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.id = 'rbpo-modal';
        modal.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 16px;
            max-width: 600px;
            width: 90%;
            margin: 0 auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: modalSlideDown 0.4s ease;
            position: relative;
        `;

        modal.innerHTML = `
            <button id="closeModalBtn" style="
                position: absolute;
                top: 15px;
                right: 15px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 5px;
                line-height: 1;
            ">×</button>
            
            <div style="text-align: center; margin-bottom: 25px;">
                <h2 style="margin: 15px 0 5px; color: #1a202c;">Поздравляем!</h2>
                <p style="color: #666; font-size: 16px;">Вы ответили на все вопросы</p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="margin: 0 0 15px; color: #333; font-size: 18px;">Сохранить результаты оценки</h3>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #4a5568; font-weight: 500;">Проект</label>
                    <input type="text" id="modalProjectName" placeholder="Название проекта" 
                           style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #4a5568; font-weight: 500;">Команда</label>
                    <input type="text" id="modalTeamName" placeholder="Название команды" 
                           style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; color: #4a5568; font-weight: 500;">Ответственный</label>
                    <input type="text" id="modalRespondent" placeholder="ФИО ответственного" 
                           style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                </div>
            </div>
            
            <div style="display: flex; gap: 10px;font-family: Ubuntu">
                <button id="modalSavePdfBtn" 
                        style="font-family: Ubuntu; flex: 2; padding: 14px; background: #000; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                     Сохранить отчет
                </button>
                <button id="modalLaterBtn" 
                        style="font-family: Ubuntu;flex: 1; padding: 14px; background: #fff; color: #666; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 16px; font-weight: 500; cursor: pointer;">
                    Позже
                </button>
            </div>
            
            <div style="margin-top: 15px; font-size: 13px; color: #94a3b8; text-align: center;">
                Все ответы автоматически сохраняются
            </div>
        `;

        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);

        // Добавляем обработчики
        document.getElementById('closeModalBtn').addEventListener('click', hideModal);
        document.getElementById('modalLaterBtn').addEventListener('click', hideModal);
        document.getElementById('modalSavePdfBtn').addEventListener('click', () => {
            // Сохраняем значения из модального окна в localStorage
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            saved.metadata = {
                project: document.getElementById('modalProjectName').value,
                team: document.getElementById('modalTeamName').value,
                respondent: document.getElementById('modalRespondent').value
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
            
            // Генерируем PDF из данных localStorage
            generatePDFFromStorage();
        });

        // Закрытие по клику на оверлей
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                hideModal();
            }
        });

        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalOverlay.style.display === 'flex') {
                hideModal();
            }
        });
    }

    function showModal() {
        const modalOverlay = document.getElementById('rbpo-modal-overlay');
        if (modalOverlay) {
            // Загружаем сохраненные значения если есть
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (saved.metadata) {
                document.getElementById('modalProjectName').value = saved.metadata.project || '';
                document.getElementById('modalTeamName').value = saved.metadata.team || '';
                document.getElementById('modalRespondent').value = saved.metadata.respondent || '';
            }
            modalOverlay.style.display = 'flex';
        }
    }

    function hideModal() {
        const modalOverlay = document.getElementById('rbpo-modal-overlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    }

    // ========== ГЕНЕРАЦИЯ PDF ИЗ STORAGE ==========

    function generatePDFFromStorage() {
    
        showNotification('⏳ Генерация PDF...', 'info');

    // Получаем данные из localStorage
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const metadata = saved.metadata || {};
    
    const projectName = metadata.project || 'Не указан';
    const teamName = metadata.team || 'Не указана';
    const respondent = metadata.respondent || 'Не указан';
    const currentDate = new Date().toLocaleDateString('ru-RU');
    const currentTime = new Date().toLocaleTimeString('ru-RU');

    // Вычисляем проценты из сохраненных данных
    const bfScores = { 
        governance: { sum: 0, count: 0 },
        design: { sum: 0, count: 0 },
        development: { sum: 0, count: 0 },
        verification: { sum: 0, count: 0 },
        operations: { sum: 0, count: 0 }
    };

    const answers = [];

    sammData.forEach(bf => {
        bf.practices.forEach(practice => {
            const practiceAnswers = [];
            let practiceTotal = 0;
            let practiceCount = 0;

            for (let level = 1; level <= 3; level++) {
                const radioName = `${bf.id}.${practice.id}.lvl${level}`;
                const value = saved[radioName];
                
                if (value !== undefined) {
                    const levelOpts = practice.levels[level-1].opts;
                    let selectedText = 'Выбрано';
                    
                    // Находим текст выбранного варианта
                    if (value === '0') {
                        selectedText = levelOpts[0];
                    } else if (value === '0.5') {
                        selectedText = levelOpts[1];
                    } else if (value === '1') {
                        selectedText = levelOpts[2];
                    }
                    
                    const status = value === '0' ? 'Нет' : value === '0.5' ? 'Частично' : 'Да';
                    practiceAnswers.push(`Уровень ${level}: ${selectedText} (${status})`);
                    
                    practiceTotal += parseFloat(value) * 100;
                    practiceCount++;
                }
            }

            if (practiceAnswers.length > 0) {
                const practiceScore = Math.round(practiceTotal / practiceCount);
                answers.push({
                    practice: practice.name,
                    score: practiceScore + '%',
                    levels: practiceAnswers
                });

                if (bfScores[bf.id]) {
                    bfScores[bf.id].sum += practiceScore;
                    bfScores[bf.id].count++;
                }
            }
        });
    });

    // Вычисляем проценты по областям
    const gov = bfScores.governance.count ? Math.round(bfScores.governance.sum / bfScores.governance.count) : 0;
    const des = bfScores.design.count ? Math.round(bfScores.design.sum / bfScores.design.count) : 0;
    const dev = bfScores.development.count ? Math.round(bfScores.development.sum / bfScores.development.count) : 0;
    const ver = bfScores.verification.count ? Math.round(bfScores.verification.sum / bfScores.verification.count) : 0;
    const ops = bfScores.operations.count ? Math.round(bfScores.operations.sum / bfScores.operations.count) : 0;

    const total = Math.round((gov + des + dev + ver + ops) / 5);
    const maturityLevel = getMaturityLevel(total);

    // Создаем HTML контент для PDF
    const content = `
        <div style="font-family: Ubuntu; max-width: 800px; margin: 0 auto; padding: 30px;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #000; padding-bottom: 20px;">
                <h1 style="color: #333; margin: 0; font-size: 28px;">Оценка зрелости РБПО</h1>
            </div>
            
            <div style="background: white; border: 1px solid black; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 15px; color: #333; font-size: 18px;">Информация об оценке</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; font-weight: bold; width: 150px;">Проект:</td>
                        <td style="padding: 8px;">${projectName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-weight: bold;">Команда:</td>
                        <td style="padding: 8px;">${teamName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-weight: bold;">Ответственный:</td>
                        <td style="padding: 8px;">${respondent}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-weight: bold;">Дата:</td>
                        <td style="padding: 8px;">${currentDate} ${currentTime}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-weight: bold;">Уровень зрелости:</td>
                        <td style="padding: 8px;"><strong>Уровень ${maturityLevel.level}</strong> (${maturityLevel.name})</td>
                    </tr>
                </table>
            </div>

            <!-- Шкала уровней -->
            <div style="margin-bottom: 30px;font-family: Ubuntu">
                <h3 style="color: black; font-size: 18px; margin-bottom: 15px;">Шкала уровней зрелости</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                    <div style="background: #6c757d; color: white; padding: 8px; border-radius: 6px; text-align: center; font-size: 13px;">0: Отсутствует</div>
                    <div style="background: #fd7e14; color: white; padding: 8px; border-radius: 6px; text-align: center; font-size: 13px;">1: Начальный</div>
                    <div style="background: #ffc107; color: white; padding: 8px; border-radius: 6px; text-align: center; font-size: 13px;">2: Определенный</div>
                    <div style="background: #28a745; color: white; padding: 8px; border-radius: 6px; text-align: center; font-size: 13px;">3: Управляемый</div>
                    <div style="background: #20c997; color: white; padding: 8px; border-radius: 6px; text-align: center; font-size: 13px;">4: Количественный</div>
                    <div style="background: #17a2b8; color: white; padding: 8px; border-radius: 6px; text-align: center; font-size: 13px;">5: Оптимизируемый</div>
                </div>
            </div>
            <div style="margin-bottom: 30px;font-family: Ubuntu">
                <h3 style="color: #333; font-size: 18px; margin-bottom: 15px;">Результаты по областям</h3>
                <table style="width: 100%; border-collapse: collapse; background: white; border:1px solid black; border-radius:10px">
                    <tr>
                        <th style="padding: 12px; text-align: left;">Область</th>
                        <th style="padding: 12px; text-align: right;">Результат</th>
                        <th style="padding: 12px; text-align: center;">Уровень</th>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">Управление</td>
                        <td style="padding: 10px; text-align: right; font-weight: bold;">${gov}%</td>
                        <td style="padding: 10px; text-align: center;">${getMaturityLevel(gov).name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">Проектирование</td>
                        <td style="padding: 10px; text-align: right; font-weight: bold;">${des}%</td>
                        <td style="padding: 10px; text-align: center;">${getMaturityLevel(des).name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">Разработка</td>
                        <td style="padding: 10px; text-align: right; font-weight: bold;">${dev}%</td>
                        <td style="padding: 10px; text-align: center;">${getMaturityLevel(dev).name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">Проверка</td>
                        <td style="padding: 10px; text-align: right; font-weight: bold;">${ver}%</td>
                        <td style="padding: 10px; text-align: center;">${getMaturityLevel(ver).name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">Эксплуатация</td>
                        <td style="padding: 10px; text-align: right; font-weight: bold;">${ops}%</td>
                        <td style="padding: 10px; text-align: center;">${getMaturityLevel(ops).name}</td>
                    </tr>
                </table>
            </div>

            <div style="margin-bottom: 30px;font-family: Ubuntu">
                <h3 style="color: #333; font-size: 18px; margin-bottom: 15px;">Детальные ответы</h3>
                ${answers.map((a, i) => `
                    <div style="margin-bottom: 20px; padding: 15px; border-radius: 8px;border:1px solid black">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="margin: 0; font-size: 16px; color: #333;">${i+1}. ${a.practice}</h4>
                            <span style="background: #000; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold;">${a.score}</span>
                        </div>
                        <ul style="margin: 0; padding-left: 20px;">
                            ${a.levels.map(l => `<li style="margin-bottom: 5px; color: #555;">${l}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>

            <!-- Подвал -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; font-size: 12px; color: #666; text-align: center;">
                <p>Сгенерировано с помощью Геркулес | Инструменты оценки безопасности</p>
                <p>© ${new Date().getFullYear()} Геркулес. Все права защищены.</p>
            </div>
        </div>
    `;


    const element = document.createElement('div');
    element.innerHTML = content;
    document.body.appendChild(element);

    if (typeof html2pdf === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => {
            html2pdf().from(element).set({
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: `rbpo-${projectName}-${currentDate.replace(/\./g, '-')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            }).save().then(() => {
                document.body.removeChild(element);
                showNotification('✅ PDF успешно сохранен!', 'success');
                hideModal();
            });
        };
        document.head.appendChild(script);
    } else {
        html2pdf().from(element).set({
            margin: [0.5, 0.5, 0.5, 0.5],
            filename: `rbpo-${projectName}-${currentDate.replace(/\./g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).save().then(() => {
            document.body.removeChild(element);
            showNotification('PDF успешно сохранен!', 'success');
            hideModal();
        });
    }

    localStorage.setItem('rbpo-assessment-results', '')
}

    function checkAllQuestionsAnswered() {
        const totalQuestions = 15; 
        let answeredCount = 0;
        
        sammData.forEach(bf => {
            bf.practices.forEach(practice => {
                let practiceAnswered = true;
                for (let level = 1; level <= 3; level++) {
                    const radioName = `${bf.id}.${practice.id}.lvl${level}`;
                    const checked = document.querySelector(`input[name="${radioName}"]:checked`);
                    if (!checked) {
                        practiceAnswered = false;
                        break;
                    }
                }
                if (practiceAnswered) answeredCount++;
            });
        });
        
        // Если все вопросы отвечены, показываем модальное окно
        if (answeredCount === totalQuestions) {
            showModal();
        }
        
        return answeredCount === totalQuestions;
    }

    function renderSAMMGrid() {
        const grid = document.getElementById('sammGrid');
        if (!grid) return;

        let html = '';
        
        sammData.forEach((bf, bfIndex) => {
            html += `
                <div class="bf-card">
                    <div class="bf-header collapsed" onclick="toggleCollapse(this)">
                        <i class="fas ${bf.icon}"></i>
                        <h2>${bf.title}</h2>
                        <i class="fas fa-chevron-down collapse-icon"></i>
                    </div>
                    <div class="practices-container collapsed" id="collapse-${bfIndex}">
            `;
            
            bf.practices.forEach(practice => {
                html += `
                    <div class="practice-card" data-practice="${bf.id}.${practice.id}">
                        <div class="practice-header">
                            <h3>${practice.name}</h3>
                            <p class="practice-desc">${practice.desc}</p>
                            <div class="practice-score-badge" id="score-${bf.id}.${practice.id}">0%</div>
                        </div>
                        <div class="levels-container">
                `;
                
                practice.levels.forEach((levelData, levelIdx) => {
                    const level = levelIdx + 1;
                    html += `
                        <div class="level-block">
                            <div class="level-title">Уровень ${level}</div>
                            <div class="radio-group">
                    `;
                    
                    levelData.opts.forEach((optText, optIdx) => {
                        const value = optIdx === 0 ? 0 : optIdx === 1 ? 0.5 : 1;
                        const radioName = `${bf.id}.${practice.id}.lvl${level}`;
                        const radioId = `${bf.id}.${practice.id}.lvl${level}.opt${optIdx}`;
                        
                        html += `
                            <div class="radio-item">
                                <input type="radio" 
                                       name="${radioName}" 
                                       id="${radioId}"
                                       value="${value}"
                                       data-practice="${bf.id}.${practice.id}" 
                                       data-level="${level}">
                                <label for="${radioId}">${optText}</label>
                            </div>
                        `;
                    });
                    
                    html += `
                            </div>
                            <div class="level-progress" id="progress-${bf.id}.${practice.id}.lvl${level}">—</div>
                        </div>
                    `;
                });
                
                html += `</div></div>`;
            });
            
            html += `</div></div>`;
        });
        
        grid.innerHTML = html;

        // Обработчики радио-кнопок
        document.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const name = this.name;
                document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
                    r.closest('.radio-item')?.classList.remove('selected');
                });
                if (this.checked) {
                    this.closest('.radio-item')?.classList.add('selected');
                }
                updateAllScores();
                saveResultsToStorage();
            });
        });

        // Загружаем сохраненные результаты после рендера
        setTimeout(loadResultsFromStorage, 100);
    }

    // Функция сворачивания
    window.toggleCollapse = function(header) {
        header.classList.toggle('collapsed');
        const container = header.nextElementSibling;
        if (container && container.classList.contains('practices-container')) {
            container.classList.toggle('collapsed');
        }
    };

    function updateAllScores() {
        const bfScores = { 
            governance: { sum: 0, count: 0 },
            design: { sum: 0, count: 0 },
            development: { sum: 0, count: 0 },
            verification: { sum: 0, count: 0 },
            operations: { sum: 0, count: 0 }
        };

        document.querySelectorAll('.practice-card').forEach(card => {
            const dataPractice = card.dataset.practice;
            if (!dataPractice) return;
            
            const [bfId, practiceId] = dataPractice.split('.');
            const levelValues = {};
            
            card.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
                const level = radio.dataset.level;
                levelValues[level] = parseFloat(radio.value);
            });
            
            let total = 0, count = 0;
            
            for (let l = 1; l <= 3; l++) {
                const progEl = document.getElementById(`progress-${bfId}.${practiceId}.lvl${l}`);
                if (progEl) {
                    const val = levelValues[l];
                    if (val !== undefined) {
                        const percent = val * 100;
                        progEl.textContent = percent === 0 ? 'Нет (0%)' : percent === 50 ? 'Частично (50%)' : 'Да (100%)';
                        total += percent;
                        count++;
                    } else {
                        progEl.textContent = 'Не выбрано';
                    }
                }
            }
            
            const practiceScore = count > 0 ? Math.round(total / count) : 0;
            
            const badge = document.getElementById(`score-${bfId}.${practiceId}`);
            if (badge) badge.textContent = practiceScore + '%';
            
            if (bfScores[bfId]) {
                bfScores[bfId].sum += practiceScore;
                bfScores[bfId].count++;
            }
        });

        const gov = bfScores.governance.count ? Math.round(bfScores.governance.sum / bfScores.governance.count) : 0;
        const des = bfScores.design.count ? Math.round(bfScores.design.sum / bfScores.design.count) : 0;
        const dev = bfScores.development.count ? Math.round(bfScores.development.sum / bfScores.development.count) : 0;
        const ver = bfScores.verification.count ? Math.round(bfScores.verification.sum / bfScores.verification.count) : 0;
        const ops = bfScores.operations.count ? Math.round(bfScores.operations.sum / bfScores.operations.count) : 0;

        const total = Math.round((gov + des + dev + ver + ops) / 5);
        const maturityLevel = getMaturityLevel(total);

        const scorePercentage = document.getElementById('scorePercentage');
        const scoreGovernance = document.getElementById('scoreGovernance');
        const scoreDesign = document.getElementById('scoreDesign');
        const scoreDevelopment = document.getElementById('scoreDevelopment');
        const scoreVerification = document.getElementById('scoreVerification');
        const scoreOperations = document.getElementById('scoreOperations');
        const maturityLevelElement = document.getElementById('maturityLevel');
        const maturityNameElement = document.getElementById('maturityName');
        
        if (scorePercentage) scorePercentage.textContent = total;
        if (scoreGovernance) scoreGovernance.textContent = gov + '%';
        if (scoreDesign) scoreDesign.textContent = des + '%';
        if (scoreDevelopment) scoreDevelopment.textContent = dev + '%';
        if (scoreVerification) scoreVerification.textContent = ver + '%';
        if (scoreOperations) scoreOperations.textContent = ops + '%';
        
        // Обновляем отображение уровня зрелости
        if (maturityLevelElement) {
            maturityLevelElement.textContent = `Уровень ${maturityLevel.level}`;
            maturityLevelElement.style.color = maturityLevel.color;
        }
        if (maturityNameElement) {
            maturityNameElement.textContent = maturityLevel.name;
            maturityNameElement.style.color = maturityLevel.color;
        }

        const circle = document.querySelector('.progress-circle');
        if (circle) {
            const circumference = 2 * Math.PI * 70;
            const offset = circumference - (total / 100) * circumference;
            circle.style.strokeDasharray = `${circumference} ${circumference}`;
            circle.style.strokeDashoffset = offset;
        }
    }

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10001;
            font-family: Ubuntu;
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Добавляем стили для анимаций
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes modalSlideDown {
            from { transform: translateY(-100px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        #closeModalBtn:hover { color: #000; background: #f0f0f0; border-radius: 50%; }
        #modalSavePdfBtn:hover { background: #333 !important; }
        #modalLaterBtn:hover { background: #f8fafc !important; border-color: #cbd5e1 !important; }
    `;
    document.head.appendChild(style);

    // Добавляем элементы для отображения уровня зрелости
    function addMaturityElements() {
        const scoreContainer = document.querySelector('.score-container');
        if (!scoreContainer) return;

        const maturityDiv = document.createElement('div');
        maturityDiv.style.cssText = `
            text-align: center;
            margin-top: 10px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 8px;
        `;
        maturityDiv.innerHTML = `
            <div style="font-size: 14px; color: #666;">Уровень зрелости</div>
            <div style="display: flex; justify-content: center; gap: 10px; align-items: baseline;">
                <span id="maturityLevel" style="font-size: 18px; font-weight: bold;">Уровень 0</span>
                <span id="maturityName" style="font-size: 16px; color: #666;">Отсутствует</span>
            </div>
        `;

        scoreContainer.appendChild(maturityDiv);
    }

    // Инициализация
    document.addEventListener('DOMContentLoaded', () => {
        // Создаем скрытые поля для хранения данных (для совместимости)
        const hiddenInputs = document.createElement('div');
        hiddenInputs.style.display = 'none';
        hiddenInputs.innerHTML = `
            <input type="text" id="pdfProjectName">
            <input type="text" id="pdfTeamName">
            <input type="text" id="pdfRespondent">
        `;
        document.body.appendChild(hiddenInputs);
        
        renderSAMMGrid();
        createModal();
        addMaturityElements();
        
        // Проверяем, может уже все отвечено из localStorage
        setTimeout(() => {
            loadResultsFromStorage();
            checkAllQuestionsAnswered();
        }, 200);
    });
})();