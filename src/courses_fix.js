// courses_fix.js

// Используйте везде в файле

(async function() {
    'use strict';
    
    window.cuLmsLog('Course Archiver: Extension loaded');
    
    const API_BASE_URL = 'https://my.centraluniversity.ru/api/micro-lms';
    const COURSE_ACTIVE_URL_PART = '/learn/courses/view/actual';
    const COURSE_ARCHIVED_URL_PART = '/learn/courses/view/archived';
    const TASKS_URL_PART = '/learn/tasks/'; // Добавили часть URL для задач

    const ARCHIVE_ICON_URL = chrome.runtime.getURL('icons/archive.png'); 
    const UNARCHIVE_ICON_URL = chrome.runtime.getURL('icons/unarchive.png'); 
    
    let renderIntervalId = null; 
    let pageObserver = null; 
    let urlObserver = null;
    let currentObservedPath = '';

    // Инициализация при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100); 
    }
    
    // Главная функция инициализации и отслеживания изменений URL
    function init() {
        window.cuLmsLog('Course Archiver: Initializing...');
        currentObservedPath = window.location.pathname; 
        handlePageLoad(); // Вызываем обработчик для текущего URL

        // Запускаем наблюдатель за изменением URL, если еще не запущен
        if (!urlObserver) {
            let lastPathname = window.location.pathname;
            urlObserver = new MutationObserver(() => {
                if (window.location.pathname !== lastPathname) {
                    window.cuLmsLog('Course Archiver: URL changed. Re-initializing.');
                    lastPathname = window.location.pathname;
                    currentObservedPath = lastPathname;
                    handlePageLoad(); // Перезапускаем обработку при смене URL
                }
            });
            urlObserver.observe(document.querySelector('head'), { childList: true, subtree: true });
            urlObserver.observe(document.body, { childList: true, subtree: true }); 
        }
    }

    // Обработчик для определения, какой функционал нужно запустить
    async function handlePageLoad() {
        const currentPath = window.location.pathname;
        
        // Очищаем предыдущие интервалы и наблюдатели перед новой инициализацией
        if (renderIntervalId) {
            clearInterval(renderIntervalId);
            renderIntervalId = null;
        }
        if (pageObserver) {
            pageObserver.disconnect();
            pageObserver = null;
        }

        if (currentPath.startsWith(COURSE_ACTIVE_URL_PART) || currentPath.startsWith(COURSE_ARCHIVED_URL_PART)) {
            window.cuLmsLog('Course Archiver: On courses page. Starting course processing.');
            initializeCourseArchiver();
        } else if (currentPath.startsWith(TASKS_URL_PART)) {
            window.cuLmsLog('Course Archiver: On tasks page. Injecting tasks_fix.js');
            // Инжектируем tasks_fix.js если мы на странице задач
            await injectScript('tasks_fix.js');
            // Очищаем все, что относится к курсам, если мы перешли на задачи
        } else {
            window.cuLmsLog('Course Archiver: Not on a known functional page. Cleaning up timers and observers.');
        }
    }

    // Инициализация функционала архиватора на страницах курсов
    async function initializeCourseArchiver() {
        try {
            // Ожидаем появления основного контейнера курсов
            await waitForElement('ul.course-list', 10000); 
            
            await renderCoursesBasedOnState();
            
            // Устанавливаем наблюдателя за изменениями в списке курсов
            pageObserver = observePageChanges('ul.course-list li', renderCoursesBasedOnState);
            // Устанавливаем интервал для периодического обновления состояния
            renderIntervalId = setInterval(renderCoursesBasedOnState, 15000);
        } catch (error) {
            window.cuLmsLog('Course Archiver: Failed to initialize on courses page:', error);
            // В случае ошибки, также очищаем, чтобы не висели старые ссылки
            if (renderIntervalId) clearInterval(renderIntervalId);
            if (pageObserver) pageObserver.disconnect();
        }
    }

    // Получение всех курсов (активных и архивных) с API
    async function fetchAllCoursesData() {
        try {
            const activeResponse = await fetch(`${API_BASE_URL}/courses/student?limit=10000&state=published`);
            const archivedResponse = await fetch(`${API_BASE_URL}/courses/student?limit=10000&state=archived`);

            if (!activeResponse.ok) throw new Error(`HTTP error! status: ${activeResponse.status} for published courses`);
            if (!archivedResponse.ok) throw new Error(`HTTP error! status: ${archivedResponse.status} for archived courses`);

            const activeCourses = (await activeResponse.json()).items;
            const archivedCourses = (await archivedResponse.json()).items;
            
            const allCoursesMap = new Map();
            activeCourses.forEach(course => allCoursesMap.set(course.id, course));
            archivedCourses.forEach(course => allCoursesMap.set(course.id, course));

            const allCourses = Array.from(allCoursesMap.values());
            window.cuLmsLog(`Course Archiver: Fetched ${allCourses.length} total courses from API.`);
            return allCourses;
        } catch (error) {
            window.cuLmsLog(`Course Archiver: Failed to fetch all courses:`, error);
            return [];
        }
    }

    // Получение ID локально заархивированных курсов из хранилища расширения
    async function getArchivedCoursesFromStorage() {
        return new Promise((resolve) => {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                window.cuLmsLog('Course Archiver: chrome.runtime.sendMessage not available, returning empty set.');
                return resolve(new Set());
            }
            chrome.runtime.sendMessage({ action: "getStorage", keys: ['archivedCourseIds'] }, (response) => {
                if (chrome.runtime.lastError || response.error) {
                    window.cuLmsLog('Course Archiver: Error getting archivedCourseIds from storage:', chrome.runtime.lastError || response.error);
                    resolve(new Set());
                } else {
                    resolve(new Set(response.archivedCourseIds || []));
                }
            });
        });
    }

    // Сохранение ID локально заархивированных курсов в хранилище расширения
    async function setArchivedCoursesInStorage(archivedCourseIds) {
        return new Promise((resolve) => {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                window.cuLmsLog('Course Archiver: chrome.runtime.sendMessage not available, cannot save.');
                return resolve();
            }
            chrome.runtime.sendMessage({ action: "setStorage", items: { archivedCourseIds: Array.from(archivedCourseIds) } }, (response) => {
                if (chrome.runtime.lastError || response.error) {
                    window.cuLmsLog('Course Archiver: Error saving archivedCourseIds to storage:', chrome.runtime.lastError || response.error);
                } else {
                    window.cuLmsLog('Course Archiver: Saved archivedCourseIds to storage:', Array.from(archivedCourseIds));
                }
                resolve();
            });
        });
    }

    // Главная функция рендеринга и управления видимостью курсов
    async function renderCoursesBasedOnState() {
        const courseListContainer = await waitForElement('ul.course-list', 5000);
        if (!courseListContainer) {
            window.cuLmsLog('Course Archiver: Course list container not found during render.');
            return;
        }

        const currentPath = window.location.pathname;
        const isOnArchivedPage = currentPath.startsWith(COURSE_ARCHIVED_URL_PART);
        const isOnActivePage = currentPath.startsWith(COURSE_ACTIVE_URL_PART);

        if (!isOnActivePage && !isOnArchivedPage) {
            window.cuLmsLog('Course Archiver: Not on an active or archived courses page during render, skipping.');
            return;
        }

        const storedArchivedCourseIds = await getArchivedCoursesFromStorage();
        const allApiCourses = await fetchAllCoursesData(); 
        
        // Мапа для отслеживания всех курсов и их состояний (API + локальные)
        const coursesToEvaluate = new Map(); 
        allApiCourses.forEach(course => {
            coursesToEvaluate.set(course.id, {
                data: course,
                isLocallyArchived: storedArchivedCourseIds.has(course.id),
                isApiArchived: course.isArchived 
            });
        });

        // 1. Проходимся по существующим на странице элементам <li>
        Array.from(courseListContainer.querySelectorAll('li')).forEach(li => {
            const courseId = getCourseIdFromLi(li);
            if (!courseId) {
                // Если не удалось извлечь ID, и это наш элемент, удаляем его
                if (li.classList.contains('extension-created-card')) {
                    li.remove();
                }
                return;
            }

            const courseInfo = coursesToEvaluate.get(courseId);
            let shouldShow = false;

            if (courseInfo) {
                // Определяем, должен ли курс отображаться на текущей странице
                if (isOnActivePage) {
                    shouldShow = !courseInfo.isApiArchived && !courseInfo.isLocallyArchived;
                } else if (isOnArchivedPage) {
                    shouldShow = courseInfo.isApiArchived || courseInfo.isLocallyArchived;
                }
            } else {
                // Если курса нет в API (возможно, удален) или он не загружен, он не должен отображаться,
                // за исключением случая, когда это наш элемент, который может быть добавлен или удален ниже.
                shouldShow = false; 
            }

            if (shouldShow) {
                // Если элемент должен быть показан
                li.style.display = ''; 
                updateCourseCard(li, courseId, storedArchivedCourseIds.has(courseId));
                coursesToEvaluate.delete(courseId); // Удаляем из мапы, т.к. уже обработан
            } else {
                // Если элемент не должен быть показан
                if (li.classList.contains('extension-created-card')) {
                    li.remove(); // Удаляем наши динамически созданные элементы
                } else {
                    li.style.display = 'none'; // Скрываем оригинальные элементы TUI
                }
            }
        });

        // 2. Добавляем те курсы, которые должны отображаться, но еще не присутствуют в DOM
        for (const [courseId, courseInfo] of coursesToEvaluate.entries()) {
            const { data, isLocallyArchived, isApiArchived } = courseInfo;
            
            let shouldShow = false;
            if (isOnActivePage) {
                shouldShow = !isApiArchived && !isLocallyArchived;
            } else if (isOnArchivedPage) {
                shouldShow = isApiArchived || isLocallyArchived;
            }

            if (shouldShow) {
                // Создаем новую карточку, если ее еще нет в DOM
                let courseLi = courseListContainer.querySelector(`li[data-course-id="${courseId}"]`);
                if (!courseLi) {
                    courseLi = createCourseCardElement(data);
                    courseListContainer.appendChild(courseLi);
                }
                updateCourseCard(courseLi, courseId, isLocallyArchived);
                courseLi.style.display = ''; // Убедимся, что она видима
            }
        }
        
        window.cuLmsLog('Course Archiver: Finished rendering courses.');
    }

    // Функция для извлечения ID курса из DOM-элемента <li>
    function getCourseIdFromLi(li) {
        let courseId = li.getAttribute('data-course-id');
        if (courseId) return parseInt(courseId);

        const courseLink = li.querySelector('a[href*="/learn/courses/view/"]');
        if (courseLink) {
            const hrefMatch = courseLink.href.match(/\/view\/(?:actual|archived)\/(\d+)/);
            if (hrefMatch) {
                return parseInt(hrefMatch[1]);
            }
        }
        return null;
    }

    // Функция для создания DOM-элемента карточки курса (с клонированием для сохранения стилей)
    function createCourseCardElement(courseData) {
        // Найти существующий шаблон карточки (первый оригинальный элемент li)
        const templateLi = document.querySelector('ul.course-list li:not(.extension-created-card)');
        
        let newLi;
        if (templateLi) {
            newLi = templateLi.cloneNode(true);
            newLi.classList.add('extension-created-card');
            newLi.setAttribute('data-course-id', courseData.id);

            // Обновить ссылку и заголовок
            const link = newLi.querySelector('a[href*="/learn/courses/view/"]');
            if (link) {
                link.href = `/learn/courses/view/actual/${courseData.id}`;
                const title = link.querySelector('.course-card__title');
                if (title) {
                    title.textContent = escapeHtml(courseData.name);
                }
            }
            
            // Удалить оригинальные элементы, которые будут добавлены расширением или не нужны
            newLi.querySelectorAll('.archive-button-container').forEach(el => el.remove());
            // Возможно, также стоит удалить оригинальные элементы статуса, если они неактуальны
            // newLi.querySelectorAll('.course-card__status-bar').forEach(el => el.remove());

            // Добавить свой контейнер для кнопки архива
            const cuIsland = newLi.querySelector('cu-island');
            const paragraphSection = cuIsland ? cuIsland.querySelector('section.tui-island__paragraph') : null;
            if (paragraphSection) {
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'archive-button-container';
                buttonContainer.style.marginTop = '10px';
                buttonContainer.style.textAlign = 'right';
                paragraphSection.appendChild(buttonContainer);
            }
        } else {
            // Fallback к вашей текущей реализации, если нет шаблона для клонирования
            window.cuLmsLog('Course Archiver: No template LI found for cloning. Creating basic card.');
            newLi = document.createElement('li');
            newLi.className = 'course-list__item extension-created-card';
            newLi.setAttribute('data-course-id', courseData.id);
            newLi.innerHTML = `
                <cu-island class="cu-island _size_m tui-island _rounded">
                    <section class="tui-island__paragraph">
                        <a class="course-card__link tui-link" href="/learn/courses/view/actual/${courseData.id}">
                            <h3 class="course-card__title">${escapeHtml(courseData.name)}</h3>
                        </a>
                        <div class="archive-button-container" style="margin-top: 10px; text-align: right;"></div>
                    </section>
                    <div class="tui-island__figure">
                        <!-- Здесь могут быть другие важные элементы для стилизации (изображения, статусы) -->
                    </div>
                </cu-island>
            `;
        }

        return newLi;
    }

    // Функция для обновления кнопки архивации/разархивации на карточке курса
    function updateCourseCard(li, courseId, isLocallyArchived) {
        let buttonContainer = li.querySelector('.archive-button-container');
        if (!buttonContainer) {
            // Если контейнера нет (например, для новой динамически созданной карточки), создаем его
            buttonContainer = document.createElement('div');
            buttonContainer.className = 'archive-button-container';
            buttonContainer.style.marginTop = '10px';
            buttonContainer.style.textAlign = 'right';

            const cuIsland = li.querySelector('cu-island');
            const paragraphSection = cuIsland ? cuIsland.querySelector('section.tui-island__paragraph') : null;
            if (paragraphSection) {
                paragraphSection.appendChild(buttonContainer);
            } else if (cuIsland) {
                // Если нет paragraphSection, добавляем в cuIsland
                cuIsland.appendChild(buttonContainer);
            } else {
                // В крайнем случае, добавляем в сам li
                li.appendChild(buttonContainer);
            }
        }

        let archiveButton = buttonContainer.querySelector('button');
        let iconElement = archiveButton ? archiveButton.querySelector('img') : null;

        if (!archiveButton) {
            archiveButton = document.createElement('button');
            archiveButton.style.cssText = `
                background: none;
                border: none;
                padding: 0;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-left: 10px;
            `;
            
            iconElement = document.createElement('img');
            iconElement.style.width = '24px'; 
            iconElement.style.height = '24px';
            archiveButton.appendChild(iconElement);
            buttonContainer.appendChild(archiveButton);

            archiveButton.addEventListener('click', async (event) => {
                event.preventDefault(); 
                event.stopPropagation(); 
                
                const currentArchivedCourseIds = await getArchivedCoursesFromStorage();
                
                if (currentArchivedCourseIds.has(courseId)) {
                    currentArchivedCourseIds.delete(courseId);
                    window.cuLmsLog('Course Archiver: Removed course ID', courseId, 'from archived (local).');
                } else {
                    currentArchivedCourseIds.add(courseId);
                    window.cuLmsLog('Course Archiver: Added course ID', courseId, 'to archived (local).');
                }
                
                await setArchivedCoursesInStorage(currentArchivedCourseIds);
                
                // Перерисовываем всю страницу, чтобы обновить состояние
                await renderCoursesBasedOnState(); 
            });
        }
        
        iconElement.src = isLocallyArchived ? UNARCHIVE_ICON_URL : ARCHIVE_ICON_URL;
        iconElement.alt = isLocallyArchived ? 'Убрать из архива' : 'Архивировать';
        archiveButton.title = isLocallyArchived ? 'Убрать из архива' : 'Архивировать';
    }


    // --- Вспомогательные функции ---
    
    // Функция ожидания элемента
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            const observer = new MutationObserver((mutations, obs) => {
                const foundElement = document.querySelector(selector);
                if (foundElement) {
                    obs.disconnect();
                    resolve(foundElement);
                }
            });
            
            // Если body еще не существует, ждем его
            if (!document.body) {
                document.addEventListener('DOMContentLoaded', () => {
                    observer.observe(document.body, { childList: true, subtree: true });
                });
            } else {
                observer.observe(document.body, { childList: true, subtree: true });
            }
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }
    
    // Наблюдатель за изменениями на странице для динамически подгружаемого контента
    function observePageChanges(selector, callbackFn) {
        const obs = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // Убедимся, что это элемент
                            if (node.matches(selector) || node.querySelector(selector)) {
                                shouldUpdate = true;
                                break;
                            }
                            if (node.matches('ul.course-list')) {
                                shouldUpdate = true;
                                break;
                            }
                        }
                    }
                }
                if (shouldUpdate) break;
            }
            
            if (shouldUpdate) {
                window.cuLmsLog('Course Archiver: Detected page changes, re-rendering courses...');
                setTimeout(() => callbackFn(), 500); // Задержка для полного рендеринга
            }
        });
        
        // Наблюдаем за изменениями в теле документа
        obs.observe(document.body, {
            childList: true,
            subtree: true
        });
        window.cuLmsLog('Course Archiver: Started observing page changes.');
        return obs; // Возвращаем observer, чтобы его можно было остановить
    }

    // Вспомогательная функция для инъекции скриптов
    async function injectScript(scriptName) {
        return; // currently disabled, google ToS issues
        const scriptUrl = chrome.runtime.getURL(scriptName);
        // Проверяем, был ли скрипт уже инжектирован
        if (document.head.querySelector(`script[src="${scriptUrl}"]`)) {
            window.cuLmsLog(`Script ${scriptName} already injected.`);
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptUrl;
            script.onload = () => {
                window.cuLmsLog(`Script ${scriptName} injected and loaded.`);
                resolve();
            };
            script.onerror = (e) => {
                window.cuLmsLog(`Failed to inject script ${scriptName}:`, e);
                reject(e);
            };
            document.head.appendChild(script);
        });
    }

    // Вспомогательная функция для экранирования HTML, чтобы предотвратить XSS
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }
    
})();