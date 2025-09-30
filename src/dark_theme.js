// content.js (улучшенная версия)

const STYLE_ID = 'culms-dark-theme-style';
let themeToggleButton = null; // Глобальная ссылка на нашу кнопку

/**
 * Применяет или удаляет CSS темной темы со страницы.
 * @param {boolean} isEnabled - Включить темную тему?
 */
function applyTheme(isEnabled) {
    const existingStyle = document.getElementById(STYLE_ID);

    if (isEnabled) {
        if (existingStyle) return; // Стиль уже есть

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
        }
    }
}

/**
 * Обновляет иконку и подсказку на кнопке в зависимости от состояния темы.
 */
function updateButtonState() {
    if (!themeToggleButton) return;

    chrome.storage.sync.get('themeEnabled', (data) => {
        const isEnabled = !!data.themeEnabled;
        if (isEnabled) {
            // Тема включена, показываем иконку солнца (чтобы выключить)
            themeToggleButton.style.setProperty('--t-icon-start', `url(${chrome.runtime.getURL('icons/sun.svg')})`);
            themeToggleButton.title = 'Переключить на светлую тему';
        } else {
            // Тема выключена, показываем иконку луны (чтобы включить)
            themeToggleButton.style.setProperty('--t-icon-start', `url(${chrome.runtime.getURL('icons/moon.svg')})`);
            themeToggleButton.title = 'Переключить на темную тему';
        }
    });
}

/**
 * Создает и настраивает кнопку, копируя стили сайта.
 * @returns {HTMLLIElement} - Готовый элемент списка с кнопкой внутри.
 */
function createThemeToggleButton() {
    // 1. Создаем LI-контейнер
    const listItem = document.createElement('li');
    listItem.setAttribute('automation-id', 'header-action-theme-toggle');
    listItem.classList.add('theme-toggle-container');

    // --- ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ ---
    // Принудительно делаем наш LI-элемент flex-контейнером
    // и выравниваем его содержимое (кнопку) по центру.
    // Это самый надежный способ добиться идеального выравнивания.
    listItem.style.display = 'flex';
    listItem.style.alignItems = 'center';
    // --- КОНЕЦ ИЗМЕНЕНИЯ ---

    // 2. Создаем саму кнопку
    const button = document.createElement('button');
    button.setAttribute('tuiappearance', '');
    button.setAttribute('tuiicons', '');
    button.setAttribute('tuiiconbutton', '');
    button.type = 'button';
    button.setAttribute('data-appearance', 'tertiary-no-padding');
    button.setAttribute('data-size', 'm');
    button.classList.add('button-action');

    button.addEventListener('click', () => {
        chrome.storage.sync.get('themeEnabled', (data) => {
            chrome.storage.sync.set({ themeEnabled: !data.themeEnabled });
        });
    });

    // 3. Сразу добавляем кнопку в LI (без лишних оберток)
    listItem.appendChild(button);

    themeToggleButton = button;
    updateButtonState();

    return listItem;
}

/**
 * Ищет место для вставки и добавляет туда кнопку.
 */
function addButtonToHeader() {
    const headerActionsList = document.querySelector('ul.header__actions-list');
    const userProfileMenu = document.querySelector('cu-user-profile-menu');

    // Проверяем, что все элементы на месте и нашей кнопки еще нет
    if (headerActionsList && userProfileMenu && !document.querySelector('.theme-toggle-container')) {
        const toggleButtonElement = createThemeToggleButton();
        headerActionsList.insertBefore(toggleButtonElement, userProfileMenu.parentElement);
    }
}


// --- ОСНОВНАЯ ЛОГИКА ---

// 1. Слушаем изменения в хранилище. Это ЦЕНТРАЛЬНОЕ место для управления темой.
// Сработает и при клике на нашу кнопку, и при изменении через popup.
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.themeEnabled) {
        const isEnabled = !!changes.themeEnabled.newValue;
        applyTheme(isEnabled);
        updateButtonState();
    }
});

(() => {
// 2. Применяем тему при первой загрузке страницы, если она была включена
chrome.storage.sync.get('themeEnabled', (data) => {
    if (data.themeEnabled) {
        applyTheme(true);
    }
});

// 3. Используем MutationObserver, чтобы добавить кнопку, как только появится шапка сайта
// Это необходимо для современных сайтов (SPA), где элементы появляются динамически.
const observer = new MutationObserver(() => {
    addButtonToHeader();
});
observer.observe(document.body, { childList: true, subtree: true });

// 4. Первоначальная попытка добавить кнопку
addButtonToHeader();
})();