// Функция для скачивания JSON отчета
function downloadJSONReport(result) {
    try {
        const reportData = JSON.stringify(result, null, 2);
        const blob = new Blob([reportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scout-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (typeof showToolNotification === 'function') {
            showToolNotification('JSON отчет успешно скачан', 'success');
        }
    } catch (error) {
        if (typeof showToolNotification === 'function') {
            showToolNotification('Ошибка при скачивании JSON отчета', 'error');
        }
    }
}

// Функция для скачивания HTML отчета
function downloadScoutHTMLReport(result) {
    try {
        const defaultName = `scout-report-${new Date().toISOString().split('T')[0]}`;
        let reportName = prompt('Введите имя отчета:', defaultName);
        if (reportName === null) return;
        if (reportName.trim() === '') reportName = defaultName;
        reportName = reportName.trim().replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
        
        const htmlContent = generateScoutFullHTMLReport(result);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportName}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (typeof showToolNotification === 'function') {
            showToolNotification(`HTML отчет "${reportName}.html" успешно скачан`, 'success');
        }
    } catch (error) {
        if (typeof showToolNotification === 'function') {
            showToolNotification('Ошибка при скачивании HTML отчета', 'error');
        }
    }
}



window.downloadJSONReport = downloadJSONReport;
window.downloadScoutHTMLReport = downloadScoutHTMLReport;