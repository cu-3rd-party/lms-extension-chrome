// background.js (УНИВЕРСАЛЬНАЯ И ОТЛАДОЧНАЯ ВЕРСИЯ)

/*
 * ВАЖНО: Блок try/catch для совместимости Chrome и Firefox.
 */
try {
    importScripts('browser-polyfill.js');
} catch (e) {
    console.log("Running in Firefox or a non-MV3 environment.");
}

// --- ОТЛАДКА: Регистрируем оба слушателя событий ---

// 1. Слушатель для "мягкой" навигации (когда URL меняется без перезагрузки)
browser.webNavigation.onHistoryStateUpdated.addListener(details => {
    console.log('[BG_LOG] Событие: onHistoryStateUpdated. URL:', details.url);
    if (details.frameId === 0) { // Убеждаемся, что это основная страница, а не iframe
        handleNavigation(details.tabId, details.url);
    }
});

// 2. Слушатель для ПОЛНОЙ загрузки страницы (когда нажали F5 или перешли по ссылке)
browser.webNavigation.onCompleted.addListener(details => {
    console.log('[BG_LOG] Событие: onCompleted. URL:', details.url);
    if (details.frameId === 0) {
        handleNavigation(details.tabId, details.url);
    }
});


/**
 * ЕДИНЫЙ обработчик, который вызывается обоими слушателями.
 * @param {number} tabId
 * @param {string} url
 */
function handleNavigation(tabId, url) {
    // Проверяем, что URL действительно тот, который нам нужен
    if (!url || !url.startsWith("https://my.centraluniversity.ru/")) {
        console.log(`[BG_LOG] Игнорируем URL: ${url}`);
        return;
    }

    console.log(`[BG_LOG] Обрабатываем навигацию на ${url}`);

    // --- Внедрение скриптов с полифиллом (для тех, что используют browser.* API) ---
    browser.scripting.executeScript({
        target: { tabId: tabId },
        files: ["browser-polyfill.js", "dark_theme.js", "emoji_swap.js"]
    }).catch(err => console.error(`[BG_LOG] Ошибка внедрения dark_theme.js:`, err));

    if (url.includes("/learn/courses/view")) {
        browser.scripting.executeScript({
            target: { tabId: tabId },
            files: ["browser-polyfill.js", "courses_fix.js"]
        }).catch(err => console.error(`[BG_LOG] Ошибка внедрения courses_fix.js:`, err));
    }

    // --- Внедрение скриптов БЕЗ полифилла (которые не используют browser.* API) ---
    if (url.includes("/learn/tasks")) {
        injectSimpleScript(tabId, "tasks_fix.js");
    }

    // ВОТ НАШ СКРИПТ!
    if (url.includes("/longreads/")) {
        console.log('[BG_LOG] УСЛОВИЕ ДЛЯ /longreads/ СРАБОТАЛО. Внедряем homework_weight_fix.js...');
        injectSimpleScript(tabId, "homework_weight_fix.js");
        injectSimpleScript(tabId, "instant_doc_view_fix.js"); // И второй скрипт для этой страницы
    }
}

/**
 * Вспомогательная функция для внедрения простых скриптов без зависимостей.
 */
function injectSimpleScript(tabId, filePath) {
    browser.scripting.executeScript({
        target: { tabId: tabId },
        files: [filePath]
    }).catch(err => console.error(`[BG_LOG] Ошибка внедрения ${filePath}:`, err));
}