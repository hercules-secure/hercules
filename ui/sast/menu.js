async function loadMenu() {
    const container = document.getElementById('toolsGrid');
    if (!container) return;
    
    container.innerHTML = '<div class="tools-loader"><i class="fas fa-spinner fa-spin"></i><br>Loading...</div>';
    
    try {
        const response = await fetch('/addons/api/extensions/installed');
        const data = await response.json();
        
        let html = '';
        
        if (data.success && data.extensions && data.extensions.length > 0) {
            const sortedExtensions = [...data.extensions].sort((a, b) => {
                const orderA = a.order ?? 999;
                const orderB = b.order ?? 999;
                return orderA - orderB;
            });
            
            sortedExtensions.forEach(addon => {
                const addonUrl = addon.url || `/addon/view/${addon.id}`;
                const isActive = window.location.pathname === addonUrl;
                
                html += `
                    <a href="${escapeHtml(addonUrl)}" style="text-decoration: none;">
                        <div class="tool-item ${isActive ? 'active' : ''}">
                            <div class="tool-icon">
                                <i class="fas ${addon.icon || 'fa-puzzle-piece'} black-icon"></i>
                            </div>
                            <div class="tool-info">
                                <span class="tool-name">${escapeHtml(addon.name)}</span>
                                <span class="tool-desc">${escapeHtml(addon.description || 'Extension')}</span>
                            </div>
                        </div>
                    </a>
                `;
            });
        } else {
            html = '<div class="tools-loader">No extensions installed</div>';
        }
        
        container.innerHTML = html;
        
    } catch (err) {
        console.error('Error:', err);
        container.innerHTML = '<div class="error-message">Failed to load</div>';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}