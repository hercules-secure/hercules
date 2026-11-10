
const unifiedModal = document.getElementById('unifiedModal');
const settingsBtn = document.getElementById('settingsBtn');
const aboutBtn = document.getElementById('aboutBtn');


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


function closeUnifiedModal() {
    unifiedModal.classList.remove('active');

}


const closeBtn = document.getElementById('unifiedClose');
const okBtn = document.getElementById('unifiedOk');

if (closeBtn) closeBtn.onclick = closeUnifiedModal;
if (okBtn) okBtn.onclick = closeUnifiedModal;


window.onclick = (event) => {
    if (event.target === unifiedModal) closeUnifiedModal();
};

