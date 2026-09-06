/**
 * Main application class
 */

import { fetchArchiveFromUrl, uploadArchive, runSASTAnalysis } from './api.js';
import { showToolNotification } from './notifications.js';
import { showResultsModal, showRepositoryUnavailableMessage } from './ui.js';
import { formatFileSize, isValidRepositoryUrl, getShortPath } from './utils.js';

export class HerculesMainApp {
    constructor() {
        this.repoInput = document.getElementById('repo');
        this.startButton = document.getElementById('start-btn');
        this.urlValidation = document.getElementById('url-validation');
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.fetchRepoBtn = document.getElementById('fetch-repo-btn');
        
        this.selectedFile = null;
        this.currentArchiveId = null;
        this.isUrlLocked = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        initSASTUploader(this);
    }

    setupEventListeners() {
        if (this.repoInput) {
            this.repoInput.addEventListener('input', (e) => this.validateURL(e));
            this.repoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && this.startButton?.classList.contains('active')) {
                    this.startAnalysis();
                }
            });
        }

        if (this.fetchRepoBtn) {
            this.fetchRepoBtn.addEventListener('click', () => this.fetchRepoArchive());
        }

        if (this.startButton) {
            this.startButton.addEventListener('click', () => this.startAnalysis());
        }
    }

    async fetchRepoArchive() {
        const url = this.repoInput?.value.trim();
        
        if (!url || !isValidRepositoryUrl(url)) {
            this.showValidationMessage('Enter a valid repository link', 'invalid');
            return;
        }

        if (this.fetchRepoBtn) {
            this.fetchRepoBtn.disabled = true;
            this.fetchRepoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }

        try {
            const archiveData = await fetchArchiveFromUrl(url);
            
            this.isUrlLocked = true;
            if (this.repoInput) {
                this.repoInput.disabled = true;
                this.repoInput.style.backgroundColor = '#f3f4f6';
                this.repoInput.style.opacity = '0.7';
            }
            if (this.fetchRepoBtn) {
                this.fetchRepoBtn.disabled = true;
                this.fetchRepoBtn.style.opacity = '0.5';
            }
            
            if (this.fileName) this.fileName.textContent = archiveData.filename;
            if (this.fileSize) this.fileSize.textContent = formatFileSize(archiveData.size);
            if (this.fileInfo) this.fileInfo.classList.add('active');
            
            if (this.startButton) {
                this.startButton.disabled = false;
                this.startButton.classList.add('active');
            }
            
            this.currentArchiveId = archiveData.id;
            this.selectedFile = null;
            
            showToolNotification('Archive loaded successfully', 'success');
        } catch (error) {
            showRepositoryUnavailableMessage(url, () => {});
        } finally {
            if (this.fetchRepoBtn) {
                this.fetchRepoBtn.disabled = false;
                this.fetchRepoBtn.innerHTML = 'Download archive';
            }
        }
    }

    validateURL(e) {
        if (this.isUrlLocked) return;
        
        const url = this.repoInput?.value.trim();
        
        if (!url) {
            this.setButtonState(false);
            this.showValidationMessage('', '');
            return;
        }

        const isValid = isValidRepositoryUrl(url);
        
        if (!isValid) {
            this.setButtonState(false);
            this.showValidationMessage('Enter a valid Git repository link', 'invalid');
        } else {
            this.setButtonState(true);
            this.showValidationMessage('Link is valid', 'valid');
        }
    }

    setButtonState(enabled) {
        if (!this.startButton) return;
        
        if (enabled) {
            this.startButton.disabled = false;
            this.startButton.classList.add('active');
        } else {
            this.startButton.disabled = true;
            this.startButton.classList.remove('active');
        }
    }

    showValidationMessage(message, type) {
        if (!this.urlValidation) return;
        this.urlValidation.textContent = message;
        this.urlValidation.className = 'url-validation';
        if (type === 'valid') {
            this.urlValidation.classList.add('valid');
        } else if (type === 'invalid') {
            this.urlValidation.classList.add('invalid');
        }
    }

    findTaskElement(taskId) {
        const parts = taskId.split('.');
        const sectionIndex = parseInt(parts[0]) - 1;
        const taskIndex = parseInt(parts[1]) - 1;
        
        const sections = document.querySelectorAll('.card-section');
        if (sectionIndex >= sections.length) return null;
        
        const cards = sections[sectionIndex].querySelectorAll('.card');
        if (taskIndex >= cards.length) return null;
        
        return cards[taskIndex];
    }

    updateTaskStatus(taskId, status) {
        const statusMap = {
            'pending': 'Pending',
            'in-progress': 'In progress',
            'completed': 'Completed'
        };
        
        const taskElement = this.findTaskElement(taskId);
        if (taskElement) {
            const statusElement = taskElement.querySelector('.task-status');
            if (statusElement) {
                statusElement.textContent = statusMap[status] || status;
                statusElement.className = `task-status ${status}`;
            }
            const progressElement = taskElement.querySelector('.progress');
            if (progressElement && status !== 'in-progress') {
                if (status === 'completed') {
                    progressElement.style.width = '100%';
                } else if (status === 'pending') {
                    progressElement.style.width = '0%';
                }
            }
        }
    }

    animateProgress(taskId, targetPercent, duration, callback) {
        const taskElement = this.findTaskElement(taskId);
        if (!taskElement) {
            if (callback) callback();
            return;
        }
        
        const progressElement = taskElement.querySelector('.progress');
        if (!progressElement) {
            if (callback) callback();
            return;
        }
        
        const startTime = Date.now();
        const startWidth = parseFloat(progressElement.style.width) || 0;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentWidth = startWidth + (targetPercent - startWidth) * progress;
            progressElement.style.width = `${currentWidth}%`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (callback) callback();
            }
        };
        
        animate();
    }

    async startAnalysis() {
        if (!this.startButton?.classList.contains('active')) {
            return;
        }

        if (!this.selectedFile && !this.currentArchiveId && !this.repoInput?.value.trim()) {
            showToolNotification('Select a file or specify a repository link', 'error');
            return;
        }

        const originalText = this.startButton.textContent;
        this.startButton.textContent = 'Analysis running...';
        this.startButton.disabled = true;

        try {
            this.updateTaskStatus('1.1', 'in-progress');
            
            let archiveId = null;
            
            try {
                if (this.selectedFile) {
                    this.animateProgress('1.1', 50, 500, () => {});
                    const archiveData = await uploadArchive(this.selectedFile);
                    archiveId = archiveData.id;
                    this.currentArchiveId = archiveId;
                    this.animateProgress('1.1', 100, 500, () => {});
                } else if (this.currentArchiveId) {
                    archiveId = this.currentArchiveId;
                } else {
                    const url = this.repoInput?.value.trim();
                    if (url && isValidRepositoryUrl(url)) {
                        this.animateProgress('1.1', 50, 500, () => {});
                        const archiveData = await fetchArchiveFromUrl(url);
                        archiveId = archiveData.id;
                        this.currentArchiveId = archiveId;
                        this.animateProgress('1.1', 100, 500, () => {});
                    } else {
                        throw new Error('Select an archive or specify a repository link');
                    }
                }

                if (!archiveId) {
                    throw new Error('Failed to get archive ID');
                }

                this.updateTaskStatus('1.1', 'completed');
                this.updateTaskStatus('2.1', 'in-progress');
                this.animateProgress('2.1', 50, 1000, () => {});
                
                const sastResults = await runSASTAnalysis(archiveId);
                
                this.animateProgress('2.1', 100, 500, () => {});
                this.updateTaskStatus('2.1', 'completed');
                this.updateTaskStatus('2.2', 'completed');
                this.startButton.textContent = 'Analysis completed';
                
                showResultsModal(sastResults, () => this.fullReset());
                showToolNotification('Analysis completed successfully', 'success');

            } catch (error) {
                this.updateTaskStatus('1.1', 'pending');
                this.updateTaskStatus('2.1', 'pending');
                this.updateTaskStatus('2.2', 'pending');
                showToolNotification(error.message || 'Analysis error', 'error');
                this.resetButton(originalText);
            }

        } catch (error) {
            showToolNotification('Analysis error', 'error');
            this.resetButton(originalText);
        }
    }

    resetButton(originalText) {
        if (!this.startButton) return;
        this.startButton.textContent = originalText;
        this.startButton.disabled = false;
        this.startButton.classList.add('active');
    }

    resetAnalysis() {
        if (this.fileInfo) {
            this.fileInfo.classList.remove('active');
        }
        if (this.repoInput && !this.isUrlLocked) {
            this.repoInput.value = '';
            this.showValidationMessage('', '');
        }
        
        if (this.startButton) {
            this.startButton.disabled = true;
            this.startButton.classList.remove('active');
        }
        
        ['1.1', '2.1', '2.2'].forEach(taskId => {
            this.updateTaskStatus(taskId, 'pending');
            const taskElement = this.findTaskElement(taskId);
            if (taskElement) {
                const progressElement = taskElement.querySelector('.progress');
                if (progressElement) {
                    progressElement.style.width = '0%';
                }
            }
        });
    }

    fullReset() {
        this.selectedFile = null;
        this.currentArchiveId = null;
        this.isUrlLocked = false;
        
        if (this.repoInput) {
            this.repoInput.disabled = false;
            this.repoInput.style.backgroundColor = '';
            this.repoInput.style.opacity = '';
            this.repoInput.value = '';
        }
        if (this.fetchRepoBtn) {
            this.fetchRepoBtn.disabled = false;
            this.fetchRepoBtn.style.opacity = '';
        }
        
        this.updateTaskStatus('1.1', 'pending');
        this.updateTaskStatus('2.1', 'pending');
        this.updateTaskStatus('2.2', 'pending');
        
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            const progressEl = card.querySelector('.progress');
            if (progressEl) progressEl.style.width = '0%';
        });
        
        if (this.startButton) {
            this.startButton.textContent = 'Start analysis';
            this.startButton.disabled = true;
            this.startButton.classList.remove('active');
        }
        
        if (this.fileInfo) {
            this.fileInfo.classList.remove('active');
        }
        
        this.showValidationMessage('', '');
    }

    loadResultsFromStorage() {
        const saved = localStorage.getItem('sast-results');
        if (!saved) return null;
        try {
            return JSON.parse(saved);
        } catch (error) {
            return null;
        }
    }

    saveResultsToStorage(results) {
        try {
            localStorage.setItem('sast-results', JSON.stringify(results));
        } catch (error) {}
    }

    clearResults() {
        if (confirm('Clear saved results?')) {
            localStorage.removeItem('sast-results');
            showToolNotification('Results cleared', 'success');
        }
    }
}

window.removeFile = function() {
    const fileInfo = document.getElementById('fileInfo');
    const startBtn = document.getElementById('start-btn');
    
    if (fileInfo) fileInfo.classList.remove('active');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.classList.remove('active');
    }
    if (window.herculesApp) {
        window.herculesApp.selectedFile = null;
        window.herculesApp.currentArchiveId = null;
    }
};