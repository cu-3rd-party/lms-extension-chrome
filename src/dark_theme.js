// Этот код заменяет содержимое вашего текущего content.js

function applyCustomStyles() {
    // 1. Поиск и удаление ВСЕХ <link> элементов, которые загружают CSS
    // Мы оставим это, так как оно может убрать большую часть оригинальных стилей
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        link.remove();
    });

    // 2. Создание и внедрение тега <style> с вашими CSS-правилами
    fetch(chrome.runtime.getURL('style.css'))
        .then(response => response.text())
        .then(cssText => {
            const styleTag = document.createElement('style');
            styleTag.textContent = cssText;
            document.head.appendChild(styleTag);
            console.log("Injected custom CSS directly via <style> tag.");
        })
        .catch(err => console.error("Could not load custom style.css:", err));
}

// Запускаем функцию
applyCustomStyles();

// Оставляем MutationObserver, чтобы перехватывать стили, загружаемые позже
const observer = new MutationObserver((mutationsList, observer) => {
    mutationsList.forEach(mutation => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                // Удаляем любые новые <link rel="stylesheet">
                if (node.tagName === 'LINK' && node.rel === 'stylesheet') {
                    console.log("Removing dynamically added stylesheet:", node.href);
                    node.remove();
                }
                // Удаляем любые новые <style> теги (очень агрессивный шаг,
                // но может быть необходим для борьбы с Angular)
                if (node.tagName === 'STYLE') {
                     // Убедимся, что не удаляем наш собственный тег
                    if (!node.textContent.includes('--sidebar-layout-content-background-color')) {
                        console.log("Removing dynamically added <style> tag.");
                        node.remove();
                    }
                }
            });
        }
    });
});

// Начинаем наблюдение за изменениями в <head>
observer.observe(document.head, { childList: true, subtree: true });