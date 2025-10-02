// dark_theme.js (без изменений)
'use strict';

// "Предохранитель" от повторного запуска. Если скрипт уже инициализирован, выходим.
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
            fetch(chrome.runtime.getURL('style.css'))
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
     */
    function updateButtonState() {
        if (!themeToggleButton) return;
        chrome.storage.sync.get('themeEnabled', (data) => {
            const isEnabled = !!data.themeEnabled;
            const iconUrl = isEnabled ? 'icons/sun.svg' : 'icons/moon.svg';
            themeToggleButton.style.setProperty('--t-icon-start', `url(${chrome.runtime.getURL(iconUrl)})`);
            themeToggleButton.title = isEnabled ? 'Переключить на светлую тему' : 'Переключить на темную тему';
        });
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

        button.addEventListener('click', () => {
            chrome.storage.sync.get('themeEnabled', (data) => {
                chrome.storage.sync.set({ themeEnabled: !data.themeEnabled });
            });
        });

        listItem.appendChild(button);
        themeToggleButton = button;
        updateButtonState();
        return listItem;
    }

    /**
     * Ищет место для вставки и добавляет туда кнопку.
     */
    function addButtonToHeader() {
        if (document.querySelector('.theme-toggle-container')) return; // Кнопка уже есть

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
                obs.disconnect(); // Нашли, добавили, отключились.
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // --- ОСНОВНАЯ ЛОГИКА ---

    // 1. Слушаем изменения в хранилище (самая важная часть).
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (changes.themeEnabled) {
            applyTheme(!!changes.themeEnabled.newValue);
            updateButtonState();
        }
    });

    // 2. Применяем тему при первой загрузке скрипта.
    chrome.storage.sync.get('themeEnabled', (data) => {
        if (data.themeEnabled) {
            applyTheme(true);
        }
    });

    // 3. Пытаемся добавить кнопку сразу, а если не получилось - ждем появления шапки.
    addButtonToHeader();
    waitForHeaderAndAddButton();
}