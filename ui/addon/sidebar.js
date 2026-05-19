(function() {
    // Ждем загрузки DOM
    document.addEventListener('DOMContentLoaded', function() {
        const collapseBtn = document.getElementById('collapseBtn');
        const toolsTitle = document.getElementById('toolsTitle');
        const box = document.getElementById('box');
        
        if (!box) return;
        
        function isMobile() {
            return window.innerWidth <= 768;
        }
        
        let isSidebarCollapsed = false;
        
        if (!isMobile()) {
            const savedState = localStorage.getItem('sidebarCollapsed');
            if (savedState === 'true') {
                isSidebarCollapsed = true;
                box.classList.add('sidebar-collapsed');
            }
        }
        
        function collapseSidebar(e) {
            if (e) e.stopPropagation();
            if (isMobile()) return;
            if (!isSidebarCollapsed) {
                isSidebarCollapsed = true;
                box.classList.add('sidebar-collapsed');
                localStorage.setItem('sidebarCollapsed', 'true');
            }
        }
        
        function expandSidebar() {
            if (isMobile()) return;
            if (isSidebarCollapsed) {
                isSidebarCollapsed = false;
                box.classList.remove('sidebar-collapsed');
                localStorage.setItem('sidebarCollapsed', 'false');
            }
        }
        
        if (collapseBtn) {
            collapseBtn.addEventListener('click', collapseSidebar);
        }
        
        if (toolsTitle) {
            toolsTitle.addEventListener('click', function() {
                if (isMobile()) return;
                if (box.classList.contains('sidebar-collapsed')) {
                    expandSidebar();
                }
            });
        }
        
        window.addEventListener('resize', function() {
            if (isMobile() && box.classList.contains('sidebar-collapsed')) {
                box.classList.remove('sidebar-collapsed');
                isSidebarCollapsed = false;
            }
        });
    });
})();