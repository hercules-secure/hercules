// Объединённое модальное окно
const unifiedModal = document.getElementById('unifiedModal');
const settingsBtn = document.getElementById('settingsBtn');
const aboutBtn = document.getElementById('aboutBtn');

// Открыть окно (показывает единое окно)
if (settingsBtn) {
    settingsBtn.onclick = () => {
        unifiedModal.classList.add('active');
    };
}

if (aboutBtn) {
    aboutBtn.onclick = () => {
        unifiedModal.classList.add('active');
    };
}

// Закрытие модального окна
function closeUnifiedModal() {
    unifiedModal.classList.remove('active');

}

// Закрывающие элементы
const closeBtn = document.getElementById('unifiedClose');
const okBtn = document.getElementById('unifiedOk');

if (closeBtn) closeBtn.onclick = closeUnifiedModal;
if (okBtn) okBtn.onclick = closeUnifiedModal;

// Клик вне модального окна для закрытия
window.onclick = (event) => {
    if (event.target === unifiedModal) closeUnifiedModal();
};

