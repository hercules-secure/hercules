
    (function() {
        // Элементы для сворачивания меню
        const collapseBtn = document.getElementById('collapseBtn');
        const toolsTitle = document.getElementById('toolsTitle');
        const box = document.getElementById('box');
        
        // Проверка на мобильное устройство
        function isMobile() {
            return window.innerWidth <= 768;
        }
        
        let isSidebarCollapsed = false;
        
        // Загрузка состояния из localStorage
        if (!isMobile()) {
            const savedState = localStorage.getItem('sidebarCollapsedSCA');
            if (savedState === 'true') {
                isSidebarCollapsed = true;
                box.classList.add('sidebar-collapsed');
            }
        }
        
        // Функция сворачивания
        function collapseSidebar() {
            if (isMobile()) return;
            if (!isSidebarCollapsed) {
                isSidebarCollapsed = true;
                box.classList.add('sidebar-collapsed');
                localStorage.setItem('sidebarCollapsedSCA', 'true');
            }
        }
        
        // Функция разворачивания
        function expandSidebar() {
            if (isMobile()) return;
            if (isSidebarCollapsed) {
                isSidebarCollapsed = false;
                box.classList.remove('sidebar-collapsed');
                localStorage.setItem('sidebarCollapsedSCA', 'false');
            }
        }
        
        // Сворачивание по кнопке со стрелкой
        if (collapseBtn) {
            collapseBtn.addEventListener('click', collapseSidebar);
        }
        
        // Разворачивание по клику на иконку "Инструменты" (только когда меню свернуто)
        if (toolsTitle) {
            toolsTitle.addEventListener('click', function() {
                if (isMobile()) return;
                if (box.classList.contains('sidebar-collapsed')) {
                    expandSidebar();
                }
            });
        }
        
        // При изменении размера окна - если стало мобильным, разворачиваем меню
        window.addEventListener('resize', function() {
            if (isMobile()) {
                if (box.classList.contains('sidebar-collapsed')) {
                    box.classList.remove('sidebar-collapsed');
                    isSidebarCollapsed = false;
                }
            }
        });
    })();
