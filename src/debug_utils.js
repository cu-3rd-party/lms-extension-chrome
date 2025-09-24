const DEBUG = true;
window.debugLog = function(...args) {
    if (DEBUG) {
        console.log('[CU LMS Enhancer]:', ...args);
    }
};