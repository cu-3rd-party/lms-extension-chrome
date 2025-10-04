// dark_theme.js (кросс-браузерная версия)
'use strict';

// "Предохранитель" от повторного запуска.
if (typeof window.darkThemeInitialized === 'undefined') {
    window.darkThemeInitialized = true;

    const STYLE_ID = 'culms-dark-theme-style';
    let themeToggleButton = null;

    /**
     * Применяет или удаляет CSS темной темы со страницы.
     */
    function applyTheme(isEnabled) {
        const existingStyle = document.getElementById(STYLE_ID);
        if (isEnabled) {
            if (existingStyle) return;
            // ИЗМЕНЕНО: chrome.runtime -> browser.runtime
            fetch(browser.runtime.getURL('style.css'))
                .then(response => response.text())
                .then(css => {
                    const style = document.createElement('style');
                    style.id = STYLE_ID;
                    style.textContent = css;
                    document.head.appendChild(style);
                });
        } else {
            if (existingStyle) existingStyle.remove();
        }
    }

    /**
     * Обновляет иконку и подсказку на кнопке.
     * Переписано с использованием async/await.
     */
    async function updateButtonState() {
        if (!themeToggleButton) return;
        // ИЗМЕНЕНО: chrome.storage -> browser.storage с await
        const data = await browser.storage.sync.get('themeEnabled');
        const isEnabled = !!data.themeEnabled;
        const iconUrl = isEnabled ? 'icons/sun.svg' : 'icons/moon.svg';
        // ИЗМЕНЕНО: chrome.runtime -> browser.runtime
        themeToggleButton.style.setProperty('--t-icon-start', `url(${browser.runtime.getURL(iconUrl)})`);
        themeToggleButton.title = isEnabled ? 'Переключить на светлую тему' : 'Переключить на темную тему';
    }

    /**
     * Создает и настраивает кнопку переключения темы.
     */
    function createThemeToggleButton() {
        const listItem = document.createElement('li');
        listItem.setAttribute('automation-id', 'header-action-theme-toggle');
        listItem.classList.add('theme-toggle-container');
        listItem.style.display = 'flex';
        listItem.style.alignItems = 'center';

        const button = document.createElement('button');
        button.setAttribute('tuiappearance', '');
        button.setAttribute('tuiicons', '');
        button.setAttribute('tuiiconbutton', '');
        button.type = 'button';
        button.setAttribute('data-appearance', 'tertiary-no-padding');
        button.setAttribute('data-size', 'm');
        button.classList.add('button-action');

        // ИЗМЕНЕНО: обработчик клика переписан с async/await
        button.addEventListener('click', async () => {
            const data = await browser.storage.sync.get('themeEnabled');
            await browser.storage.sync.set({ themeEnabled: !data.themeEnabled });
        });

        listItem.appendChild(button);
        themeToggleButton = button;
        updateButtonState(); // Вызываем асинхронную функцию
        return listItem;
    }

    /**
     * Ищет место для вставки и добавляет туда кнопку.
     */
    function addButtonToHeader() {
        if (document.querySelector('.theme-toggle-container')) return;

        const headerActionsList = document.querySelector('ul.header__actions-list');
        const userProfileMenu = document.querySelector('cu-user-profile-menu');

        if (headerActionsList && userProfileMenu) {
            const toggleButtonElement = createThemeToggleButton();
            headerActionsList.insertBefore(toggleButtonElement, userProfileMenu.parentElement);
        }
    }

    /**
     * Ожидает появления элемента в DOM и затем выполняет действие.
     */
    function waitForHeaderAndAddButton() {
        const observer = new MutationObserver((mutations, obs) => {
            if (document.querySelector('ul.header__actions-list')) {
                addButtonToHeader();
                obs.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // --- ОСНОВНАЯ ЛОГИКА ---

    // 1. Слушаем изменения в хранилище.
    // ИЗМЕНЕНО: chrome.storage -> browser.storage
    browser.storage.onChanged.addListener((changes, namespace) => {
        if (changes.themeEnabled) {
            applyTheme(!!changes.themeEnabled.newValue);
            updateButtonState(); // Вызываем асинхронную функцию
        }
    });

    // 2. Применяем тему при первой загрузке скрипта.
    // ИЗМЕНЕНО: chrome.storage -> browser.storage с .then()
    browser.storage.sync.get('themeEnabled').then((data) => {
        if (data.themeEnabled) {
            applyTheme(true);
        }
    });

    // 3. Пытаемся добавить кнопку сразу, а если не получилось - ждем появления шапки.
    addButtonToHeader();
    waitForHeaderAndAddButton();
}