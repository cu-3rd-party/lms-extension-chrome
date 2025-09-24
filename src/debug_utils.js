// debug_utils.js
(function() {
    'use strict';
    
    // Создаем простую и надежную функцию
    window.cuLmsLog = function(...args) {
        console.log('[CU LMS Enhancer]:', ...args);
    };
    
    // Немедленно проверяем и создаем fallback
    if (typeof window.cuLmsLog !== 'function') {
        window.cuLmsLog = function(...args) {
            console.log('[CU LMS Enhancer]:', ...args);
        };
    }
})();
