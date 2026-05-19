// ======================
        // МОДАЛЬНОЕ ОКНО ДЛЯ ЗАГРУЗКИ РАСШИРЕНИЯ
        // ======================
        
        const modal = document.getElementById('addonModal');
        const addBtn = document.getElementById('addExtensionBtn');
        const modalClose = document.getElementById('modalClose');
        const cancelBtn = document.getElementById('cancelBtn');
        const submitBtn = document.getElementById('submitBtn');
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const uploadStatus = document.getElementById('uploadStatus');
        
        let selectedFile = null;
        
        // Открыть модальное окно
        addBtn.onclick = () => {
            modal.style.display = 'block';
            resetModal();
        };
        
        // Закрыть модальное окно
        function closeModal() {
            modal.style.display = 'none';
            resetModal();
        }
        
        modalClose.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        
        window.onclick = (event) => {
            if (event.target === modal) closeModal();
        };
        
        // Сброс модального окна
        function resetModal() {
            selectedFile = null;
            fileInput.value = '';
            fileInfo.classList.remove('show');
            uploadStatus.classList.remove('show', 'success', 'error', 'loading');
            submitBtn.disabled = true;
        }
        
        // Клик по области загрузки
        uploadArea.onclick = () => fileInput.click();
        
        // Drag and drop
        uploadArea.ondragover = (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        };
        
        uploadArea.ondragleave = () => {
            uploadArea.classList.remove('drag-over');
        };
        
        uploadArea.ondrop = (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0]);
            }
        };
        
        // Выбор файла через input
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        };
        
        // Обработка выбранного файла
        function handleFile(file) {
            const allowedTypes = ['.zip', '.tar', '.gz', '.tgz'];
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            const isTarGz = file.name.endsWith('.tar.gz');
            
            if (!allowedTypes.includes(ext) && !isTarGz) {
                showStatus('Поддерживаются только ZIP, TAR, TAR.GZ архивы', 'error');
                return;
            }
            
            if (file.size > 50 * 1024 * 1024) {
                showStatus('Файл слишком большой. Максимум 50МБ', 'error');
                return;
            }
            
            selectedFile = file;
            fileName.textContent = file.name;
            fileInfo.classList.add('show');
            submitBtn.disabled = false;
            uploadStatus.classList.remove('show');
        }
        
        function showStatus(message, type) {
            uploadStatus.textContent = message;
            uploadStatus.className = 'upload-status show ' + type;
        }
        
        // Отправка на проверку
        submitBtn.onclick = async () => {
            if (!selectedFile) return;
            
            submitBtn.disabled = true;
            showStatus('Проверка архива...', 'loading');
            
            const formData = new FormData();
            formData.append('archive', selectedFile);
            
            try {
                const response = await fetch('/addons/api/extensions/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showStatus('Архив успешно загружен и проверен!', 'success');
                    
                    setTimeout(() => {
                        closeModal();
                        showConfirmationDialog(result);
                    }, 1500);
                } else {
                    showStatus(result.message || 'Ошибка при проверке архива', 'error');
                    submitBtn.disabled = false;
                }
            } catch (error) {
                showStatus('Ошибка соединения с сервером', 'error');
                submitBtn.disabled = false;
            }
        };
        
        function showConfirmationDialog(result) {
            const manifest = result.manifest;
            const confirmModal = document.createElement('div');
            confirmModal.className = 'modal';
            confirmModal.style.display = 'block';
            confirmModal.innerHTML = `
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-check-circle"></i> Подтверждение установки</h3>
                        <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <p><strong>ID:</strong> ${manifest.id}</p>
                        <p><strong>Название:</strong> ${manifest.name}</p>
                        <p><strong>Версия:</strong> ${manifest.version}</p>
                        <p><strong>Описание:</strong> ${manifest.description || '—'}</p>
                        <p><strong>Автор:</strong> ${manifest.author || '—'}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
                        <button class="btn btn-primary" id="confirmInstallBtn">Установить</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmModal);
            
            const confirmInstallBtn = confirmModal.querySelector('#confirmInstallBtn');
            confirmInstallBtn.onclick = async () => {
                confirmModal.remove();
                //await installExtension(manifest);
            };
        }
        
        /*async function installExtension(manifest) {
            const statusModal = document.createElement('div');
            statusModal.className = 'modal';
            statusModal.style.display = 'block';
            statusModal.innerHTML = `
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <div class="modal-body">
                        <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #007bff;"></i>
                        <p style="margin-top: 16px;">Установка расширения ${manifest.name}...<br>Пожалуйста, подождите</p>
                    </div>
                </div>
            `;
            document.body.appendChild(statusModal);
            
            try {
                const response = await fetch('/addons/api/extensions/install', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ extensionId: manifest.id })
                });
                
                const result = await response.json();
                statusModal.remove();
                
                if (result.success) {
                    alert(`Расширение ${manifest.name} успешно установлено!\n\nТребуется перезапуск сервера.`);
                    location.reload();
                } else {
                    alert(`Ошибка установки: ${result.message}`);
                }
            } catch (error) {
                statusModal.remove();
                alert('Ошибка соединения с сервером');
            }
        }*/