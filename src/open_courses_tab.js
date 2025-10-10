'use strict';

if (!window.customSidebarObserverInitialized) {
    window.customSidebarObserverInitialized = true;
    console.log('[CU Enhancer] Initializing sidebar script v38 (Stable URL - No Rewrite)...');

    // --- КОНФИГУРАЦИЯ И КОНСТАНТЫ ---
    const TAB_ID = 'my-custom-courses-tab';
    const TAB_TEXT = 'Открытая система курсов';
    const SOURCE_ELEMENT_SELECTOR = 'a[href="/learn/tasks"]';

    const TARGET_URL = 'https://my.centraluniversity.ru/learn/courses/view/actual';
    const DISPLAY_URL = 'https://my.centraluniversity.ru/learn/courses/view/open-system';

    const API_HOST = 'http://127.0.0.1:8000';
    const SESSION_STORAGE_KEY_COURSE_TARGET = 'customCourseTarget';

    let isCustomTabActive = false;

    // --- CSS-ИНЖЕКТОР ---
    const injectCss = () => {
        if (document.getElementById('cu-enhancer-styles')) return;
        const style = document.createElement('style');
        style.id = 'cu-enhancer-styles';
        style.textContent = `
            .custom-courses-active > li { display: none !important; }
            .custom-courses-active > li[data-dynamic-course="true"] { display: block !important; }
            .custom-expand-container {
                display: grid;
                grid-template-rows: 0fr;
                transition: grid-template-rows 0.3s ease-in-out;
            }
            .custom-expand-container > div {
                overflow: hidden;
            }
            .custom-expand-container.is-open {
                grid-template-rows: 1fr;
            }
        `;
        document.head.appendChild(style);
    };

    // --- ФУНКЦИИ ДЛЯ ПОДМЕНЫ ДЕТАЛЕЙ КУРСА ---
    
    const handleCustomCourseClick = (event) => {
        event.preventDefault();
        const targetElement = event.currentTarget;
        const customCourseId = targetElement.dataset.customCourseId;
        const templateCourseId = targetElement.dataset.templateCourseId;
        if (!templateCourseId) return;
        sessionStorage.setItem(SESSION_STORAGE_KEY_COURSE_TARGET, JSON.stringify({ id: customCourseId }));
        window.location.href = `https://my.centraluniversity.ru/learn/courses/view/actual/${templateCourseId}`;
    };

    // === КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: ИСПОЛЬЗУЕМ BLOB ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ ===

    // Вспомогательная функция для конвертации Base64 в Blob
    const base64ToBlob = (base64, contentType = '') => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: contentType });
    };

    const handleLongreadClick = async (event, courseId, themeId, longreadId) => {
        event.preventDefault();
        const linkElement = event.currentTarget.querySelector('.longread-title');
        if (!linkElement) return;

        const originalText = linkElement.textContent;

        try {
            linkElement.textContent = 'Загрузка...';
            event.currentTarget.style.pointerEvents = 'none';

            const url = `${API_HOST}/api/course/${courseId}/theme/${themeId}/longread/${longreadId}/`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            
            const data = await response.json();
            
            // 1. Конвертируем Base64 в Blob
            const pdfBlob = base64ToBlob(data.contents, 'application/pdf');
            
            // 2. Создаем короткую и быструю Object URL
            const blobUrl = URL.createObjectURL(pdfBlob);
            
            // 3. Открываем эту быструю ссылку в новой вкладке
            window.open(blobUrl, '_blank');

        } catch (error) {
            console.error('[CU Enhancer] Failed to fetch or open PDF:', error);
            alert(`Не удалось загрузить материал: ${error.message}`);
        } finally {
            linkElement.textContent = originalText;
            event.currentTarget.style.pointerEvents = 'auto';
        }
    };

    const applyCourseDetailModifications = async () => {
        const courseDataRaw = sessionStorage.getItem(SESSION_STORAGE_KEY_COURSE_TARGET);
        if (!courseDataRaw) return;

        const courseData = JSON.parse(courseDataRaw);
        sessionStorage.removeItem(SESSION_STORAGE_KEY_COURSE_TARGET);

        try {
            console.log(`[CU Enhancer] Modifying course page for course ID: ${courseData.id}`);

            const response = await fetch(`${API_HOST}/api/course/${courseData.id}/`);
            if (!response.ok) throw new Error('Failed to fetch themes');
            const longreadsData = await response.json();
            const themesMap = longreadsData.reduce((acc, longread) => {
                (acc[longread.theme_id] = acc[longread.theme_id] || []).push(longread);
                return acc;
            }, {});

            const accordion = await waitForElement('tui-accordion.themes-accordion');
            
            const initialTheme = await waitForElement('tui-accordion-item', accordion);
            const headerButton = initialTheme.querySelector('button.t-header');
            if (headerButton && !headerButton.classList.contains('t-header_open')) headerButton.click();
            const materialItemProto = await waitForElement('li.longreads-list-item', initialTheme);
            const templateTheme = initialTheme.cloneNode(true);
            const templateMaterialItem = materialItemProto.cloneNode(true);
            if (headerButton && headerButton.classList.contains('t-header_open')) headerButton.click();

            const hideOriginalsObserver = new MutationObserver(() => {
                accordion.querySelectorAll('tui-accordion-item:not([data-custom-theme="true"])').forEach(el => {
                    if (el.style.display !== 'none') el.style.display = 'none';
                });
            });
            hideOriginalsObserver.observe(accordion, { childList: true });
            accordion.querySelectorAll('tui-accordion-item:not([data-custom-theme="true"])').forEach(el => el.style.display = 'none');
            
            const customThemeIds = Object.keys(themesMap);
            for (const themeId of customThemeIds) {
                const longreadsInTheme = themesMap[themeId];
                const newTheme = templateTheme.cloneNode(true);
                newTheme.dataset.customTheme = 'true';
                newTheme.style.display = '';

                const titleEl = newTheme.querySelector('h2.themes-accordion-item__item-title');
                if (titleEl) titleEl.textContent = `Theme ${themeId}`;

                const contentList = newTheme.querySelector('ul.longreads-list');
                if (contentList) {
                    contentList.innerHTML = '';
                    longreadsInTheme.forEach(longread => {
                        const newMaterial = templateMaterialItem.cloneNode(true);
                        const materialLink = newMaterial.querySelector('a');
                        const materialTitle = newMaterial.querySelector('h3.longread-title');
                        if (materialTitle && materialLink) {
                            materialTitle.textContent = `Longread ${longread.longread_id}`;
                            materialLink.href = `#`;
                            materialLink.addEventListener('click', (event) => {
                                handleLongreadClick(event, courseData.id, themeId, longread.longread_id);
                            });
                        }
                        contentList.appendChild(newMaterial);
                    });
                }
                
                const expandEl = newTheme.querySelector('tui-expand');
                const contentWrapper = newTheme.querySelector('.t-content');
                if (expandEl && contentWrapper) {
                    const simpleContainer = document.createElement('div');
                    simpleContainer.className = 'custom-expand-container';
                    const innerDiv = document.createElement('div');
                    innerDiv.appendChild(contentWrapper);
                    simpleContainer.appendChild(innerDiv);
                    expandEl.parentNode.replaceChild(simpleContainer, expandEl);
                }
                
                accordion.appendChild(newTheme);
            }
            
            accordion.addEventListener('click', (event) => {
                if (event.target.closest('a')) return;
                const button = event.target.closest('button.t-header');
                const parentTheme = button?.closest('[data-custom-theme="true"]');
                if (!parentTheme) return;

                const expandContainer = parentTheme.querySelector('.custom-expand-container');
                const chevron = parentTheme.querySelector('tui-icon[tuichevron]');
                if (button && expandContainer && chevron) {
                    button.classList.toggle('t-header_open');
                    chevron.classList.toggle('_chevron-rotated');
                    expandContainer.classList.toggle('is-open');
                }
            });

            const pageTitle = await waitForElement('h1.page-title');
            if (pageTitle) pageTitle.textContent = `Course ${courseData.id}`;
            console.log('[CU Enhancer] Course page modified. PDFs now open via performant Blob URLs.');

        } catch (error) {
            console.error('[CU Enhancer] Error modifying course detail page:', error);
        }
    };
    
    // ... (остальной код без изменений) ...

    const applyModifications = async () => {
        const courseList = await waitForElement('ul.course-list');
        if (!courseList || courseList.dataset.modified === 'true') return;

        const breadcrumbsContainer = document.querySelector('tui-breadcrumbs');
        if (breadcrumbsContainer) {
            const mainLink = breadcrumbsContainer.querySelector('a[href="/learn/"]');
            if (mainLink) mainLink.textContent = 'CU 3rd party ';
            const coursesLink = breadcrumbsContainer.querySelector('a[href="/learn/courses/view/actual"]');
            if (coursesLink) coursesLink.textContent = 'Открытая система курсов';
        }
        const pageTitle = document.querySelector('h1.page-title');
        if (pageTitle && !pageTitle.dataset.originalTitle) {
            pageTitle.dataset.originalTitle = pageTitle.textContent;
            pageTitle.textContent = 'Открытая система курсов';
        }

        courseList.classList.add('custom-courses-active');

        const originalReadmeItem = courseList.querySelector('li');
        let templateCourseId = null;

        if (originalReadmeItem) {
            const readmeLink = originalReadmeItem.querySelector('a');
            if (readmeLink && readmeLink.href) {
                const match = readmeLink.href.match(/\/(\d+)$/);
                if (match) templateCourseId = match[1];
            }

            const clonedReadme = originalReadmeItem.cloneNode(true);
            clonedReadme.dataset.dynamicCourse = 'true';
            const titleElement = clonedReadme.querySelector('h2.course-card__title');
            if (titleElement) {
                if (!titleElement.dataset.originalTitle) titleElement.dataset.originalTitle = titleElement.textContent;
                titleElement.textContent = 'README';
            }
            courseList.appendChild(clonedReadme);
        }

        try {
            const response = await fetch(`${API_HOST}/api/courses/`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const coursesData = await response.json();
            const uniqueCourses = coursesData.filter((c, i, a) => i === a.findIndex(f => f.course_id === c.course_id));

            uniqueCourses.forEach(course => {
                if (!originalReadmeItem) return;
                const newItem = originalReadmeItem.cloneNode(true);
                newItem.dataset.dynamicCourse = 'true';
                const titleElement = newItem.querySelector('h2.course-card__title');
                if (titleElement) titleElement.textContent = `Course ${course.course_id}`;

                const linkElement = newItem.querySelector('a');
                if (linkElement) {
                    linkElement.dataset.customCourseId = course.course_id;
                    linkElement.dataset.templateCourseId = templateCourseId;
                    linkElement.addEventListener('click', handleCustomCourseClick);
                }
                courseList.appendChild(newItem);
            });

        } catch (error) {
            console.error('[CU Enhancer] Error fetching courses:', error);
            const templateItem = courseList.querySelector('li');
            if (!templateItem) return;
            const errorItem = templateItem.cloneNode(true);
            errorItem.dataset.dynamicCourse = 'true';
            const title = errorItem.querySelector('h2.course-card__title');
            if (title) title.textContent = 'Ошибка загрузки курсов. Сервер не доступен.';
            courseList.appendChild(errorItem);
        }

        courseList.dataset.modified = 'true';
    };

    const revertModifications = async () => {
        const courseList = document.querySelector('ul.course-list');
        if (!courseList || !courseList.dataset.modified) return;

        const breadcrumbsContainer = document.querySelector('tui-breadcrumbs');
        if (breadcrumbsContainer) {
            const mainLink = breadcrumbsContainer.querySelector('a[href="/learn/"]');
            if (mainLink) mainLink.textContent = 'Обучение';
            const coursesLink = breadcrumbsContainer.querySelector('a[href="/learn/courses/view/actual"]');
            if (coursesLink) coursesLink.textContent = 'Актуальные курсы';
        }
        const pageTitle = document.querySelector('h1.page-title');
        if (pageTitle && pageTitle.dataset.originalTitle) {
            pageTitle.textContent = pageTitle.dataset.originalTitle;
            delete pageTitle.dataset.originalTitle;
        }

        courseList.classList.remove('custom-courses-active');
        courseList.querySelectorAll('[data-dynamic-course="true"]').forEach(el => el.remove());

        delete courseList.dataset.modified;
    };

    const ensureCustomTabExists = () => {
        if (document.getElementById(TAB_ID)) return;
        const sourceAnchor = document.querySelector(SOURCE_ELEMENT_SELECTOR);
        if (!sourceAnchor) return;
        const sourceListItem = sourceAnchor.closest('li.nav-list__item');
        if (!sourceListItem) return;
        const clonedListItem = sourceListItem.cloneNode(true);
        clonedListItem.id = TAB_ID;
        const link = clonedListItem.querySelector('a');
        if (!link) return;
        link.href = TARGET_URL;
        link.setAttribute('aria-label', TAB_TEXT);
        link.classList.remove('cu-navtab__main-element_active');
        
        try {
            const iconUrl = browser.runtime.getURL('icons/course_system.svg');
            link.style.setProperty('--t-icon-start', `url(${iconUrl})`);
        } catch (e) {
            try {
                const iconUrl = chrome.runtime.getURL('icons/course_system.svg');
                link.style.setProperty('--t-icon-start', `url(${iconUrl})`);
            } catch (e2) {
                 console.error('[CU Enhancer] Could not set icon URL.', e2);
            }
        }
        
        const textSpan = clonedListItem.querySelector('.cu-navtab__main-element-text');
        if (textSpan) textSpan.textContent = TAB_TEXT;
        const chevron = clonedListItem.querySelector('.cu-navtab__chevron');
        if (chevron) chevron.remove();
        link.addEventListener('click', (event) => {
            event.preventDefault();
            sessionStorage.setItem('shouldModifyPage', 'true');
            if (window.location.href.startsWith(TARGET_URL) && !document.querySelector('[data-modified="true"]')) {
                window.location.reload();
            } else {
                window.location.href = TARGET_URL;
            }
        });
        sourceListItem.insertAdjacentElement('afterend', clonedListItem);
    };

    const setActiveTabHighlight = () => {
        const customTabLink = document.querySelector(`#${TAB_ID} a`);
        if (customTabLink) {
            customTabLink.classList.toggle('cu-navtab__main-element_active', isCustomTabActive);
        }
    };

    const addOriginalCourseLinkListener = () => {
        const originalLinks = document.querySelectorAll(`a[href="${TARGET_URL}"]`);
        originalLinks.forEach(link => {
            if (link.closest(`#${TAB_ID}`)) return;
            if (link.dataset.revertListenerAttached) return;

            link.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                sessionStorage.removeItem('shouldModifyPage');
                window.location.href = link.href;
            }, true);

            link.dataset.revertListenerAttached = 'true';
        });
    };

    const main = async () => {
        if (/\/learn\/courses\/view\/actual\/\d+/.test(window.location.href) && sessionStorage.getItem(SESSION_STORAGE_KEY_COURSE_TARGET)) {
            injectCss();
            await applyCourseDetailModifications();
            return;
        }

        injectCss();
        const shouldModify = sessionStorage.getItem('shouldModifyPage') === 'true';

        if (window.location.href.startsWith(DISPLAY_URL) || (shouldModify && window.location.href.startsWith(TARGET_URL))) {
            isCustomTabActive = true;
            await applyModifications();
            if (shouldModify) {
                history.replaceState(null, '', DISPLAY_URL); 
                sessionStorage.removeItem('shouldModifyPage');
            }
        } else {
            isCustomTabActive = false;
            if (document.querySelector('[data-modified="true"]')) {
                await revertModifications();
            }
        }

        const sidebarContainer = await waitForElement('.static-content');
        if (sidebarContainer) {
            const observer = new MutationObserver(() => {
                ensureCustomTabExists();
                setActiveTabHighlight();
                addOriginalCourseLinkListener();
            });
            observer.observe(sidebarContainer, { childList: true, subtree: true });
        }

        ensureCustomTabExists();
        setActiveTabHighlight();
        addOriginalCourseLinkListener();
    };

    function waitForElement(selector, parent = document.body) {
        return new Promise(resolve => {
            const el = parent.querySelector(selector);
            if (el) return resolve(el);
            const observer = new MutationObserver(() => {
                const el = parent.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    main();
}