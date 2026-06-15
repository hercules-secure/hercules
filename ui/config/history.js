// Показываем/скрываем дополнительные настройки хранения
const historyToggle = document.getElementById('historyEnabled');
const historyStorageRow = document.getElementById('historyStorageRow');

if (historyToggle) {
    const updateHistoryOptions = () => {
        if (historyStorageRow) {
            historyStorageRow.style.display = historyToggle.checked ? 'flex' : 'none';
        }
    };
    
    historyToggle.addEventListener('change', updateHistoryOptions);
    updateHistoryOptions();
}