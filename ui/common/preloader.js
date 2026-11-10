// ===== ANALYSIS PROGRESS =====
let progressTimer = null;

function openProgress() {
  const modal = document.getElementById('progressModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeProgress() {
  const modal = document.getElementById('progressModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function resetProgress() {
  const card = document.querySelector('.progress-card');
  if (!card) return;

  card.classList.remove('is-done', 'is-error');

  document.getElementById('progressTitle').textContent = 'Security assessment';
  document.getElementById('progressTarget').textContent = '—';
  document.getElementById('progressStatus').textContent = 'Loading...';
  document.getElementById('progressCurrent').textContent = '0';
  document.getElementById('progressTotal').textContent = '0';
  document.getElementById('progressBarFill').style.width = '0%';

  // Иконка в орбе — стартовая (ракета)
  const orbIcon = document.getElementById('progressOrbIcon');
  if (orbIcon) {
    orbIcon.className = 'fas fa-rocket progress-orb-icon';
  }
}

// Обновление состояния
function setProgress({ percent, status, current, total }) {
  if (typeof percent === 'number') {
    const p = Math.max(0, Math.min(100, percent));
    document.getElementById('progressBarFill').style.width = p + '%';
  }
  if (status) document.getElementById('progressStatus').textContent = status;
  if (typeof current === 'number') document.getElementById('progressCurrent').textContent = current;
  if (typeof total === 'number') document.getElementById('progressTotal').textContent = total;
}

function setProgressDone(message = 'Analysis completed') {
  const card = document.querySelector('.progress-card');
  if (!card) return;

  card.classList.add('is-done');
  card.classList.remove('is-error');

  document.getElementById('progressTitle').textContent = 'Analysis Complete';
  document.getElementById('progressStatus').textContent = message;
  document.getElementById('progressBarFill').style.width = '100%';

  const orbIcon = document.getElementById('progressOrbIcon');
  if (orbIcon) {
    orbIcon.className = 'fas fa-check progress-orb-icon';
  }
}

function setProgressError(message = 'Analysis failed') {
  const card = document.querySelector('.progress-card');
  if (!card) return;

  card.classList.add('is-error');
  card.classList.remove('is-done');

  document.getElementById('progressTitle').textContent = 'Analysis Failed';
  document.getElementById('progressStatus').textContent = message;

  const orbIcon = document.getElementById('progressOrbIcon');
  if (orbIcon) {
    orbIcon.className = 'fas fa-xmark progress-orb-icon';
  }
}

// ===== RUN ANALYSIS =====
window.runAnalysis = async function(id) {
  const asset = allAssets.find(a => a.id === id);
  if (!asset) return;

  resetProgress();
  document.getElementById('progressTarget').textContent = asset.name || asset.git || `#${id}`;
  openProgress();

  const stages = [
    { label: 'Loading',           icon: 'fas fa-rocket',      percent: 5,  current: 1 },
    { label: 'Scanning',          icon: 'fas fa-radar',       percent: 20, current: 2 },
    { label: 'Components',        icon: 'fas fa-cubes',       percent: 40, current: 3 },
    { label: 'Code analysis',     icon: 'fas fa-code',        percent: 60, current: 4 },
    { label: 'Vulnerabilities',   icon: 'fas fa-bug',         percent: 80, current: 5 },
    { label: 'Generating report', icon: 'fas fa-file-lines',  percent: 95, current: 6 },
  ];

  const total = stages.length;
  document.getElementById('progressTotal').textContent = total;

  let i = 0;
  progressTimer = setInterval(() => {
    if (i >= stages.length) {
      clearInterval(progressTimer);
      progressTimer = null;

      setProgress({ percent: 100, current: total });
      setProgressDone('Analysis completed successfully');

      setTimeout(() => {
        closeProgress();
        showToast(`Analysis of ${asset.name} completed`);
      }, 1500);
      return;
    }

    const stage = stages[i++];
    setProgress({
      percent: stage.percent,
      status: stage.label,
      current: stage.current,
      total
    });

    // Меняем иконку в орбе под этап (классы колец остаются, они в CSS)
    const orbIcon = document.getElementById('progressOrbIcon');
    if (orbIcon) {
      orbIcon.className = `${stage.icon} progress-orb-icon`;
    }
  }, 1100);
};