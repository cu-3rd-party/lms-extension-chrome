// Файл: content.js
// Этот скрипт ЗАПУСКАЕТСЯ КАЖДЫЙ РАЗ при загрузке страницы.
// Его задача: проверить, должна ли тема быть включена, и если да - применить её.

const STYLE_ID = 'culms-dark-theme';

function applyTheme() {
    // Проверяем, не был ли стиль уже добавлен, и готов ли <head>
    if (document.getElementById(STYLE_ID) || !document.head) {
        return;
    }

    fetch(chrome.runtime.getURL('style.css'))
        .then(response => response.text())
        .then(css => {
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = css;
            document.head.appendChild(style);
        })
        .catch(err => console.error("CULMS Dark Theme: Could not load style.css", err));
}

// Главная логика: проверяем сохраненное состояние
function initializeTheme() {
    chrome.storage.sync.get('themeEnabled', (data) => {
        if (data.themeEnabled) {
            applyTheme();
        }
    });
}

// Ждем, пока основная структура страницы будет готова, чтобы избежать "состояния гонки"
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTheme);
} else {
    // Если DOM уже готов, запускаем сразу
    initializeTheme();
}