'use strict';

if (!window.customSidebarObserverInitialized) {
    window.customSidebarObserverInitialized = true;
    console.log('[CU Enhancer] Initializing sidebar tab script v17 (Self-Healing State)...');

    const TAB_ID = 'my-custom-courses-tab';
    const TAB_TEXT = 'Коммунизм';
    const SOURCE_ELEMENT_SELECTOR = 'a[href="/learn/tasks"]';

    // Переменная для хранения состояния нашей кнопки
    let isCustomTabActive = false;

    const ensureCustomTabExists = () => {
        const navList = document.querySelector('ul.nav-list');
        if (!navList) return; 
        
        let customTab = document.getElementById(TAB_ID);

        // --- Блок 1: Создание кнопки, если ее нет ---
        if (!customTab) {
            const sourceAnchor = document.querySelector(SOURCE_ELEMENT_SELECTOR);
            if (!sourceAnchor) return;
            const sourceListItem = sourceAnchor.closest('li.nav-list__item');
            if (!sourceListItem) return;

            const clonedListItem = sourceListItem.cloneNode(true);
            clonedListItem.id = TAB_ID;
            customTab = clonedListItem; // Присваиваем созданный элемент

            const navTab = clonedListItem.querySelector('cu-navtab');
            if (navTab) {
                while (navTab.nextSibling) {
                    navTab.nextSibling.remove();
                }
            }

            const link = clonedListItem.querySelector('a');
            if (link) {
                link.href = '#'; 
                link.setAttribute('aria-label', TAB_TEXT);
                link.classList.remove('cu-navtab__main-element_active');

                const iconUrl = browser.runtime.getURL('icons/ussr_icon.svg');
                link.style.setProperty('--t-icon-start', `url(${iconUrl})`);

                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    isCustomTabActive = true; // Запоминаем состояние
                    document.querySelectorAll('.nav-list a.cu-navtab__main-element').forEach(navLink => {
                        navLink.classList.remove('cu-navtab__main-element_active');
                    });
                    link.classList.add('cu-navtab__main-element_active');
                });
            }

            const textSpan = clonedListItem.querySelector('.cu-navtab__main-element-text');
            if (textSpan) {
                textSpan.textContent = TAB_TEXT;
            }
            
            const chevron = clonedListItem.querySelector('.cu-navtab__chevron');
            if (chevron) {
                chevron.remove();
            }

            sourceListItem.insertAdjacentElement('afterend', clonedListItem);
        }

        // --- Блок 2: "Самовосстановление" состояния подсветки ---
        // Этот код выполняется КАЖДЫЙ РАЗ при изменении в меню.
        const customTabLink = customTab.querySelector('a');
        if (customTabLink) {
            if (isCustomTabActive) {
                // Если наше состояние "активно", принудительно добавляем класс
                customTabLink.classList.add('cu-navtab__main-element_active');
            } else {
                // Если нет - принудительно убираем
                customTabLink.classList.remove('cu-navtab__main-element_active');
            }
        }
    };

    const main = async () => {
        // Глобальный обработчик для СБРОСА состояния при клике вне нашей кнопки
        document.body.addEventListener('click', (event) => {
            const isClickInsideCustomTab = event.target.closest(`#${TAB_ID}`);
            if (!isClickInsideCustomTab) {
                isCustomTabActive = false; // Сбрасываем флаг
                // Нам не нужно вручную убирать класс, 
                // MutationObserver сделает это при следующем обновлении DOM.
            }
        }, true);

        // Основной наблюдатель, который запускает нашу функцию "самовосстановления"
        const sidebarContainer = await waitForElement('.static-content');
        if (!sidebarContainer) return;

        const observer = new MutationObserver(() => { ensureCustomTabExists(); });
        observer.observe(sidebarContainer, { childList: true, subtree: true });
        
        ensureCustomTabExists();
    };

    function waitForElement(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) return resolve(document.querySelector(selector));
            const observer = new MutationObserver(() => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    main();
}