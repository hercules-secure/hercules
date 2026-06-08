// Объединённое модальное окно
const unifiedModal = document.getElementById('unifiedModal');
const settingsBtn = document.getElementById('settingsBtn');


// Закрывающие элементы
const closeBtn = document.getElementById('unifiedClose');
const okBtn = document.getElementById('unifiedOk');

if (closeBtn) closeBtn.onclick = closeUnifiedModal;
if (okBtn) okBtn.onclick = closeUnifiedModal;

// Клик вне модального окна для закрытия
window.onclick = (event) => {
    if (event.target === unifiedModal) closeUnifiedModal();
};

