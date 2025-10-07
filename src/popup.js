// popup.js (кросс-браузерная версия)

const themeToggle = document.getElementById('theme-toggle');
const oledToggle = document.getElementById('oled-toggle');

// 1. При открытии popup, получить текущее состояние и обновить переключатель
// Используем browser.storage, который возвращает Promise, понятный полифиллу
browser.storage.sync.get(['themeEnabled', 'oledEnabled']).then((data) => {
    themeToggle.checked = !!data.themeEnabled;
    oledToggle.checked = !!data.oledEnabled;
    oledToggle.disabled = !themeToggle.checked;
});

// 2. При клике на переключатель, сохранить новое состояние.
// Content script на странице сам подхватит это изменение через storage.onChanged
themeToggle.addEventListener('change', () => {
    const isEnabled = themeToggle.checked;
    browser.storage.sync.set({ themeEnabled: isEnabled });
    oledToggle.disabled = !isEnabled;
});

// 3. OLED toggle controls variant of dark
oledToggle.addEventListener('change', () => {
    const isOled = oledToggle.checked;
    browser.storage.sync.set({ oledEnabled: isOled });
});