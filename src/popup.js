// popup.js (улучшенная версия без перезагрузки)

const themeToggle = document.getElementById('theme-toggle');

// 1. При открытии popup, получить текущее состояние и обновить переключатель
chrome.storage.sync.get('themeEnabled', (data) => {
    themeToggle.checked = !!data.themeEnabled;
});

// 2. При клике на переключатель, просто сохранить новое состояние.
// content.js на странице сам подхватит это изменение.
themeToggle.addEventListener('change', () => {
    const isEnabled = themeToggle.checked;
    chrome.storage.sync.set({ themeEnabled: isEnabled });
});