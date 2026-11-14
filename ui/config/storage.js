
(function () {
  const enabledCheckbox = document.getElementById('storageEnabled');
  const storageSettings = document.getElementById('storageSettings');

  if (!enabledCheckbox || !storageSettings) return;

  // 1. Показ/скрытие подсекции
  function syncStorageVisibility() {
    storageSettings.style.display = enabledCheckbox.checked ? 'block' : 'none';
  }
  syncStorageVisibility();
  enabledCheckbox.addEventListener('change', syncStorageVisibility);

  // 2. Показать/скрыть API key
  const apiKeyInput = document.getElementById('storageApiKey');
  const toggleKeyBtn = document.getElementById('storageToggleKey');
  const toggleIcon = toggleKeyBtn.querySelector('i');

  toggleKeyBtn.addEventListener('click', () => {
    const hidden = apiKeyInput.style.webkitTextSecurity === 'disc';
    apiKeyInput.style.webkitTextSecurity = hidden ? 'none' : 'disc';
    toggleIcon.className = hidden ? 'fas fa-eye-slash' : 'fas fa-eye';
  });

  // 3. Копировать API key
  const copyKeyBtn = document.getElementById('storageCopyKey');
  const copyIcon = copyKeyBtn.querySelector('i');

  copyKeyBtn.addEventListener('click', async () => {
    if (!apiKeyInput.value) return;
    try {
      await navigator.clipboard.writeText(apiKeyInput.value);
      copyIcon.className = 'fas fa-check';
      setTimeout(() => { copyIcon.className = 'fas fa-copy'; }, 1500);
    } catch {
      copyIcon.className = 'fas fa-times';
      setTimeout(() => { copyIcon.className = 'fas fa-copy'; }, 1500);
    }
  });

  // 4. Test connection (заглушка)
  const testBtn = document.getElementById('storageTestBtn');
  const originalText = testBtn.innerHTML;

  testBtn.addEventListener('click', () => {
    if (testBtn.disabled) return;
    testBtn.disabled = true;
    testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';

    setTimeout(() => {
      testBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
      setTimeout(() => {
        testBtn.disabled = false;
        testBtn.innerHTML = originalText;
      }, 2000);
    }, 1200);
  });
})();