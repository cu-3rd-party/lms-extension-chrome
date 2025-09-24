// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getStorage") {
        chrome.storage.local.get(request.keys, (result) => {
            if (chrome.runtime.lastError) {
                console.error("Error getting storage:", chrome.runtime.lastError);
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse(result);
            }
        });
        return true; // Indicates an asynchronous response
    } else if (request.action === "setStorage") {
        chrome.storage.local.set(request.items, () => {
            if (chrome.runtime.lastError) {
                console.error("Error setting storage:", chrome.runtime.lastError);
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true });
            }
        });
        return true; // Indicates an asynchronous response
    }
});

console.log('[CU LMS Enhancer]: Service Worker Loaded');