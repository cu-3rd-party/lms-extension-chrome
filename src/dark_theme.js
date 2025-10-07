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


    // --- НОВЫЙ БЛОК: Логика для Shadow DOM ---
    
    const SHADOW_STYLE_ID_NEW = 'culms-shadow-theme-fix'; // Уникальный ID для стилей в Shadow DOM
    
    // CSS-код для виджета. Он будет внедряться напрямую.
    const shadowDomCssText = `
        :host, :root {
            --informer-tui-base-01: rgb(32, 33, 36) !important;
            --informer-tui-base-02: rgb(40, 41, 44) !important;
            --informer-tui-base-03: rgb(55, 56, 60) !important;
            --informer-tui-elevation-01: rgb(32, 33, 36) !important;
            --informer-tui-background-base: rgb(32, 33, 36) !important;
            --informer-tui-const-white: rgb(32, 33, 36) !important;
            
            --informer-tui-text-01: rgb(255, 255, 255) !important;
            --informer-tui-text-02: #BDC1C6 !important;
            --informer-tui-text-03: #BDC1C6 !important;
            --informer-tui-text-primary: rgb(255, 255, 255) !important;
            --informer-tui-text-secondary: #BDC1C6 !important;
            --informer-tui-text-tertiary: #BDC1C6 !important;
            
            --informer-tui-primary: #4285F4 !important;
            --informer-tui-primary-text: #ffffff !important;
            --informer-tui-secondary: rgb(40, 41, 44) !important;
            --informer-tui-secondary-hover: rgb(55, 56, 60) !important;
            --informer-tui-link: #8ab4f8 !important;
        }
        .tui-island, .onbording-popup { background-color: rgb(40, 41, 44) !important; }
        .side-buttons button .t-wrapper { background: rgb(50, 51, 54) !important; }
        svg path[fill="currentColor"] { fill: #E8EAED !important; }
        button[appearance="whiteblock"] { background-color: rgb(40, 41, 44) !important; border-bottom-color: rgb(55, 56, 60) !important; }
        button[appearance="whiteblock"]:hover { background-color: rgb(55, 56, 60) !important; }
        
        .data-list button[appearance="whiteblock"] div.t-wrapper {
            background-color: rgb(40, 41, 44) !important;
            border: none !important; /* Сбрасываем все рамки */
            box-shadow: none !important; /* Убираем тени */
            border-bottom: 1px solid rgb(55, 56, 60) !important; /* Добавляем свой нижний разделитель */
        }

        /* Стиль при наведении курсора */
        .data-list button[appearance="whiteblock"]:hover div.t-wrapper {
            background-color: rgb(55, 56, 60) !important;
            border-bottom-color: rgb(85, 86, 90) !important;
        }

        /* Цвет текста внутри кнопки */
        .data-list button[appearance="whiteblock"] .title__text {
            color: #E8EAED !important;
        }

        /* Цвет иконки "копировать ссылку" */
        .data-list button[appearance="whiteblock"] informer-copy-category-link-button svg path {
            fill: #BDC1C6 !important;
        }
        `;

    /**
     * Функция, которая находит все виджеты и применяет/удаляет стили в их Shadow DOM.
     */
    function toggleShadowDomTheme(isEnabled) {
        const hosts = document.querySelectorAll('informer-widget-element, informer-case-list-element');
        hosts.forEach(host => {
            if (host.shadowRoot) {
                const existingStyle = host.shadowRoot.getElementById(SHADOW_STYLE_ID_NEW);
                if (isEnabled && !existingStyle) {
                    const style = document.createElement('style');
                    style.id = SHADOW_STYLE_ID_NEW;
                    style.textContent = shadowDomCssText;
                    host.shadowRoot.appendChild(style);
                } else if (!isEnabled && existingStyle) {
                    existingStyle.remove();
                }
            }
        });
    }

    // Наблюдатель за появлением новых виджетов на странице.
    const shadowDomObserver = new MutationObserver(async () => {
        const data = await browser.storage.sync.get('themeEnabled');
        if (data.themeEnabled) {
            toggleShadowDomTheme(true);
        }
    });

    // Запускаем наблюдателя.
    shadowDomObserver.observe(document.body, { childList: true, subtree: true });
    
    // Синхронизируем состояние Shadow DOM с основной темой при изменении в хранилище.
    browser.storage.onChanged.addListener((changes, namespace) => {
        if (changes.themeEnabled) {
            toggleShadowDomTheme(!!changes.themeEnabled.newValue);
        }
    });

    // И первоначальная проверка при загрузке.
    browser.storage.sync.get('themeEnabled').then((data) => {
        if (data.themeEnabled) {
            toggleShadowDomTheme(true);
        }
    });
}