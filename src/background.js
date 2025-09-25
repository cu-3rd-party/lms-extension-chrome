// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getStorage") {
        chrome.storage.local.get(request.keys, (result) => {
            if (chrome.runtime.lastError) {
                console.log("Error getting storage:", chrome.runtime.lastError);
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse(result);
            }
        });
        return true; // Indicates an asynchronous response
    } else if (request.action === "setStorage") {
        chrome.storage.local.set(request.items, () => {
            if (chrome.runtime.lastError) {
                console.log("Error setting storage:", chrome.runtime.lastError);
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true });
            }
        });
        return true; // Indicates an asynchronous response
    }
});
// background.js

// background.js

// background.js

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "openNewTab" && request.url) {
        chrome.tabs.create({ url: request.url });
        // Для открытия вкладки нет необходимости в sendResponse, если не нужна специфическая обратная связь.
    }
    // Логика для "downloadFile" удалена, так как она больше не используется content.js
});
console.log('[CU LMS Enhancer]: Service Worker Loaded');