import { runSASTAnalysis } from '../sast/api.js'


function getAuthHeaders() {
    const token = localStorage.getItem('licenseToken');
    if (token) {
            return { 'Authorization': `Bearer ${token}` };
     }
    return {};
}

const headers = {
      'Content-Type': 'application/json',
       ...getAuthHeaders()
};

window.historyReplay = async function(id) {
    const btnHistoryReplay = document.getElementById(id); 
    if (!btnHistoryReplay) {
        console.error('Кнопка не найдена:', id);
        return;
    }
    
    const type = btnHistoryReplay.getAttribute('data-type');
    const source = btnHistoryReplay.getAttribute('data-url');
    const tool = btnHistoryReplay.getAttribute('data-tool');
    
    const icon = btnHistoryReplay.querySelector('i');
    if (icon) {
        icon.className = 'fas fa-spinner fa-pulse';
    }
    btnHistoryReplay.disabled = true;
    
    try {
        let response;
        let result;
    
  
        // Определяем тип источника и соответствующий эндпоинт
        switch(type) {
            case 'archive':
                response = await fetch(`/api/${tool}/archive/${source}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                break;
                
            case 'repository':
                console.log(source)
                response = await fetch(`/api/${tool}/git`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ url: source })
                });

                console.log(response)
                break;
                
            case 'url':
                // Только для Скаута
                response = await fetch(`/api/${tool}`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ url: source })
                });
                break;
                
            default:
                console.error('Неизвестный тип источника:', type);
                throw new Error(`Неизвестный тип источника: ${type}`);
        }
        
        result = await response.json();
        
        switch(tool) {
            case "sast": 
                const report = await runSASTAnalysis(result.archive.id);
                //viewDetails(tool, report.metadata.archiveId);
                //loadHistory();
                break;
                
            case "scout":
                // Для Скаута: запускаем анализ URL
                if (result.success && result.taskId) {
                    addEvent(`Повторный запуск анализа для ${source}`, 'info');
                    
                    // Ожидаем завершения
                    const finalResult = await waitForScoutResult(result.taskId);
                    
                    if (finalResult.success) {
                        addEvent(`Анализ завершен. Critical: ${finalResult.summary?.critical || 0}, High: ${finalResult.summary?.high || 0}`, 'success');
                        viewDetails(tool, finalResult);
                    } else {
                        addEvent(`Ошибка: ${finalResult.error}`, 'error');
                    }
                } else {
                    console.error('Ошибка запуска анализа Скаута:', result.error);
                    addEvent(`Ошибка запуска: ${result.error}`, 'error');
                }
                //loadHistory();
                break;
                
            // case "sca":
            //     viewDetails(tool, result);
            //     loadHistory();
            //     break;
                
            // case "blender":
            //     viewDetails(tool, result);
            //     loadHistory();
            //     break;
        }
        
        async function waitForScoutResult(taskId, maxAttempts = 60, interval = 2000) {
            for (let i = 0; i < maxAttempts; i++) {
                const statusRes = await fetch(`/api/scout/status/${taskId}`, { headers: headers });
                const status = await statusRes.json();
                
                if (status.completed) {
                    const resultRes = await fetch(`/api/scout/status/${taskId}`, { headers: headers } );
                    return await resultRes.json();
                }
                
                await new Promise(resolve => setTimeout(resolve, interval));
            }
            throw new Error('Превышено время ожидания анализа Скаута');
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

// Вспомогательная функция для добавления событий (если нужна)
function addEvent(message, type = 'info') {
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;
    
    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU');
    const eventDiv = document.createElement('div');
    eventDiv.className = `event-item ${type}`;
    eventDiv.innerHTML = `<span class="event-time">[${time}]</span> ${message}`;
    eventsList.appendChild(eventDiv);
    eventDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}