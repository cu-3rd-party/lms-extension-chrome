// background.js (финальная версия)

chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
    // Условие срабатывания: URL изменился внутри нужного нам сайта
    if (details.url.startsWith("https://my.centraluniversity.ru/")) {
        handleNavigation(details.tabId, details.url);
    }
}, { url: [{ hostEquals: 'my.centraluniversity.ru' }] });

/**
 * Главный обработчик, который решает, какие скрипты внедрять.
 * @param {number} tabId - ID вкладки, куда внедрять скрипты.
 * @param {string} url - Новый URL, на который перешел пользователь.
 */
function handleNavigation(tabId, url) {
    console.log(`Navigated to ${url}, injecting scripts...`);

    // --- 1. Скрипты, которые должны работать НА ВСЕХ страницах ---
    
    // Внедряем скрипт темной темы всегда.
    // Внутри скрипта есть проверка, чтобы он не запускался повторно.
    injectScript(tabId, "dark_theme.js");


    // --- 2. Скрипты для КОНКРЕТНЫХ страниц ---

    // Скрипт для страницы с задачами
    if (url.includes("/learn/tasks")) {
        injectScript(tabId, "tasks_fix.js");
    }
    
    // Скрипт для страниц курсов (актуальных и архивных)
    if (url.includes("/learn/courses/view")) {
        injectScript(tabId, "courses_fix.js");
    }

    // Скрипты для просмотра документов и лекций
    if (url.includes("/longreads/")) {
        injectScript(tabId, "instant_doc_view_fix.js");
        injectScript(tabId, "homework_weight_fix.js");
    }
    
    // Скрипт для экспорта курсов (только на одной конкретной странице)
    if (url === "https://my.centraluniversity.ru/learn/courses/view/actual") {
        injectScript(tabId, "course_exporter.js");
    }
}

/**
 * Вспомогательная функция для внедрения скрипта с обработкой ошибок.
 * @param {number} tabId 
 * @param {string} filePath 
 */
function injectScript(tabId, filePath) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: [filePath]
    }).catch(err => console.error(`Failed to inject ${filePath}:`, err));
}