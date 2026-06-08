import { runSASTAnalysis } from '../sast/api.js'

window.historyReplay = async function(id) {
    const btnHistoryReplay = document.getElementById(id); 
    if (!btnHistoryReplay) {
        console.error('Кнопка не найдена:', id);
        return;
    }
    
    const url = btnHistoryReplay.getAttribute('data-url');
    const branch = btnHistoryReplay.getAttribute('data-branch');
    const tool = btnHistoryReplay.getAttribute('data-tool');
    
    const icon = btnHistoryReplay.querySelector('i');
    if (icon) {
        icon.className = 'fas fa-spinner fa-pulse';
    }
    btnHistoryReplay.disabled = true;
    
    try {
        const response = await fetch('/api/' + tool + '/git', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        const result = await response.json();
        
        /* я реально заебался писать такие структуру у меня уже пальцы стерлись и глаз дергается когда я это вижу -- aleksey kovalenko */
        
        switch(tool) {
            case "sast": 
                const report = await runSASTAnalysis(result.archive.id);

                viewDetails(tool, report.metadata.archiveId);
                loadHistory()
                break;    
        }
        
        if (response.ok) {
            icon.className = 'fas fa-check';
            setTimeout(() => {
                icon.className = 'fas fa-play';
            }, 2000);
        } else {
            icon.className = 'fas fa-times';
            setTimeout(() => {
                icon.className = 'fas fa-play';
            }, 2000);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        icon.className = 'fas fa-exclamation-triangle';
        setTimeout(() => {
            icon.className = 'fas fa-play';
        }, 2000);
    } finally {
        btnHistoryReplay.disabled = false;
    }
}