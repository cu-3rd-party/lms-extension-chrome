{
    "manifest_version": 3,
    "name": "CU LMS Enhancer",
    "version": "1.0",
    "description": "Неофициальная доработка CU LMS, возвращает утерянные функции, добавляет темную тему, отображение весов заданий",
    "permissions": [
        "storage",
        "scripting",
        "webNavigation"
    ],
    "host_permissions": [
        "https://my.centraluniversity.ru/*"
    ],

    "background": {
        "scripts": ["browser-polyfill.js", "background.js"]
    },

    "action": {
        "default_popup": "popup.html"
    },
    "web_accessible_resources": [
        {
            "resources": [
                "browser-polyfill.js",
                "icons/*.svg",
                "icons/*.png",
                "tasks_fix.js",
                "courses_fix.js",
                "debug_utils.js",
                "instant_doc_view_fix.js",
                "style.css",
                "dark_theme.js",
                "icons/sun.svg",
                "icons/moon.svg"
            ],
            "matches": [
                "https://my.centraluniversity.ru/*"
            ]
        }
    ],
    "icons": {
        "128": "icon128.png"
    },
    "browser_specific_settings": {
        "gecko": {
            "id": "lms-enhancer@your-domain.com"
        }
    }
}