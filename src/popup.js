// popup.js (кросс-браузерная версия)

const themeToggle = document.getElementById('theme-toggle');

// 1. При открытии popup, получить текущее состояние и обновить переключатель
// Используем browser.storage, который возвращает Promise, понятный полифиллу
browser.storage.sync.get('themeEnabled').then((data) => {
    // !!data.themeEnabled превратит undefined или false в false, а true в true
    themeToggle.checked = !!data.themeEnabled;
});

// 2. При клике на переключатель, сохранить новое состояние.
// Content script на странице сам подхватит это изменение через storage.onChanged
themeToggle.addEventListener('change', () => {
    const isEnabled = themeToggle.checked;
    browser.storage.sync.set({ themeEnabled: isEnabled });
});