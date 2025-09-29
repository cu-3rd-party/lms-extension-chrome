const themeToggle = document.getElementById('theme-toggle');

// 1. При открытии popup, получить текущее состояние и обновить переключатель
chrome.storage.sync.get('themeEnabled', (data) => {
    themeToggle.checked = !!data.themeEnabled;
});

// 2. При клике на переключатель, сохранить новое состояние и отправить команду на страницу
themeToggle.addEventListener('change', () => {
    const isEnabled = themeToggle.checked;
    
    // Сохраняем состояние
    chrome.storage.sync.set({ themeEnabled: isEnabled });

    // Находим активную вкладку и отправляем ей сообщение
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: toggleTheme,
                args: [isEnabled]
            });
        }
    });
});

// Эта функция будет ВНЕДРЕНА и выполнена на странице
function toggleTheme(isEnabled) {
    const STYLE_ID = 'culms-dark-theme';
    const existingStyle = document.getElementById(STYLE_ID);

    if (isEnabled) {
        if (existingStyle) return; // Стиль уже применен

        fetch(chrome.runtime.getURL('style.css'))
            .then(response => response.text())
            .then(css => {
                const style = document.createElement('style');
                style.id = STYLE_ID;
                style.textContent = css;
                document.head.appendChild(style);
            });
    } else {
        if (existingStyle) {
            existingStyle.remove();
            // Вместо агрессивного удаления стилей сайта, мы просто перезагружаем страницу,
            // чтобы она вернулась в исходное состояние. Это самый надежный способ.
            window.location.reload();
        }
    }
}