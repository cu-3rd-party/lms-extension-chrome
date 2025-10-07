// courses_fix.js (кросс-браузерная версия)
'use strict';

/**
 * Главная функция-обертка.
 */
function initializeCourseFix() {
    if (document.querySelector('.archive-button-container')) {
        return;
    }
    initializeCourseArchiver();
}

/**
 * Основная логика.
 */
async function initializeCourseArchiver() {
    try {
        await waitForElement('ul.course-list', 10000);
        await renderCoursesBasedOnState();
        // ИЗМЕНЕНО: chrome.storage -> browser.storage
        browser.storage.onChanged.addListener((changes) => {
            if (changes.themeEnabled) {
                renderCoursesBasedOnState();
            }
        });
    } catch (error) {
        console.error('Course Archiver: Failed to initialize:', error);
    }
}

async function fetchAllCoursesData() {
    try {
        const API_BASE_URL = 'https://my.centraluniversity.ru/api/micro-lms';
        const activeResponse = await fetch(`${API_BASE_URL}/courses/student?limit=10000&state=published`);
        const archivedResponse = await fetch(`${API_BASE_URL}/courses/student?limit=10000&state=archived`);
        if (!activeResponse.ok || !archivedResponse.ok) {
            throw new Error(`HTTP error! Statuses: ${activeResponse.status}, ${archivedResponse.status}`);
        }
        const activeCourses = (await activeResponse.json()).items;
        const archivedCourses = (await archivedResponse.json()).items;
        const allCoursesMap = new Map();
        activeCourses.forEach(course => allCoursesMap.set(course.id, course));
        archivedCourses.forEach(course => allCoursesMap.set(course.id, course));
        return Array.from(allCoursesMap.values());
    } catch (error) {
        console.error(`Course Archiver: Failed to fetch all courses:`, error);
        return [];
    }
}

async function getArchivedCoursesFromStorage() {
    try {
        // ИЗМЕНЕНО: chrome.storage -> browser.storage
        const data = await browser.storage.local.get('archivedCourseIds');
        return new Set(data.archivedCourseIds || []);
    } catch (e) {
        console.error("Course Archiver: Error getting data from storage", e);
        return new Set();
    }
}

async function setArchivedCoursesInStorage(archivedCourseIds) {
    try {
        // ИЗМЕНЕНО: chrome.storage -> browser.storage
        await browser.storage.local.set({ archivedCourseIds: Array.from(archivedCourseIds) });
    } catch (e) {
        console.error("Course Archiver: Error saving data to storage", e);
    }
}


async function renderCoursesBasedOnState() {
    const courseListContainer = document.querySelector('ul.course-list');
    if (!courseListContainer) return;
    const currentPath = window.location.pathname;
    const isOnArchivedPage = currentPath.includes('/courses/view/archived');
    const isOnActivePage = currentPath.includes('/courses/view/actual');
    if (!isOnActivePage && !isOnArchivedPage) return;

    // ИЗМЕНЕНО: chrome.storage -> browser.storage
    const themeData = await browser.storage.sync.get('themeEnabled');
    const isDarkTheme = !!themeData.themeEnabled;

    const storedArchivedCourseIds = await getArchivedCoursesFromStorage();
    const allApiCourses = await fetchAllCoursesData();
    const coursesToEvaluate = new Map();
    allApiCourses.forEach(course => {
        coursesToEvaluate.set(course.id, {
            data: course,
            isLocallyArchived: storedArchivedCourseIds.has(course.id),
            isApiArchived: course.isArchived
        });
    });

    courseListContainer.querySelectorAll('li').forEach(li => {
        const courseId = getCourseIdFromLi(li);
        if (!courseId) return;
        const courseInfo = coursesToEvaluate.get(courseId);
        let shouldShow = false;
        if (courseInfo) {
            if (isOnActivePage) shouldShow = !courseInfo.isApiArchived && !courseInfo.isLocallyArchived;
            else if (isOnArchivedPage) shouldShow = courseInfo.isApiArchived || courseInfo.isLocallyArchived;
        }
        li.style.display = shouldShow ? '' : 'none';
        if (shouldShow) {
            updateCourseCard(li, courseId, storedArchivedCourseIds.has(courseId), isDarkTheme);
            coursesToEvaluate.delete(courseId);
        }
    });

    for (const [courseId, courseInfo] of coursesToEvaluate.entries()) {
        const { data, isLocallyArchived, isApiArchived } = courseInfo;
        let shouldShow = false;
        if (isOnActivePage) shouldShow = !isApiArchived && !isLocallyArchived;
        else if (isOnArchivedPage) shouldShow = isApiArchived || isLocallyArchived;

        if (shouldShow) {
            const courseLi = createCourseCardElement(data);
            if (courseLi) {
                courseListContainer.appendChild(courseLi);
                updateCourseCard(courseLi, courseId, isLocallyArchived, isDarkTheme);
            }
        }
    }
}


function getCourseIdFromLi(li) {
    let courseId = li.getAttribute('data-course-id');
    if (courseId) return parseInt(courseId, 10);
    const courseLink = li.querySelector('a[href*="/learn/courses/view/"]');
    if (courseLink) {
        const hrefMatch = courseLink.href.match(/\/view\/(?:actual|archived)\/(\d+)/);
        if (hrefMatch) return parseInt(hrefMatch[1], 10);
    }
    return null;
}

function createCourseCardElement(courseData) {
    const templateLi = document.querySelector('ul.course-list li:not([style*="display: none"])');
    if (!templateLi) return null;
    const newLi = templateLi.cloneNode(true);
    newLi.style.display = '';
    newLi.setAttribute('data-course-id', courseData.id);
    const link = newLi.querySelector('a[href*="/learn/courses/view/"]');
    if (link) {
        link.href = `/learn/courses/view/actual/${courseData.id}`;
        const title = link.querySelector('.course-card__title');
        if (title) title.textContent = escapeHtml(courseData.name);
    }
    newLi.querySelectorAll('.archive-button-container').forEach(el => el.remove());
    return newLi;
}


/**
 * Обновляет карточку курса: добавляет/обновляет кнопку архивации.
 * @param {HTMLLIElement} li - Элемент списка `<li>` карточки курса.
 * @param {number} courseId - ID курса.
 * @param {boolean} isLocallyArchived - Находится ли курс в локальном архиве.
 * @param {boolean} isDarkTheme - Включена ли темная тема.
 */
function updateCourseCard(li, courseId, isLocallyArchived, isDarkTheme) {
    const paragraphSection = li.querySelector('section.tui-island__paragraph');
    if (!paragraphSection) return;

    paragraphSection.style.cssText = 'position: relative; height: 100%;';

    const titleElement = paragraphSection.querySelector('h2.course-card__title');
    if (titleElement) {
        titleElement.classList.remove('three-lines-text');
        titleElement.style.paddingBottom = '32px';
    }

    let buttonContainer = li.querySelector('.archive-button-container');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'archive-button-container';
        paragraphSection.appendChild(buttonContainer);
    }

    buttonContainer.style.cssText = '';
    buttonContainer.style.position = 'absolute';
    buttonContainer.style.right = '-0.3rem';
    buttonContainer.style.bottom = '-0.5rem';

    buttonContainer.innerHTML = '';

    const archiveButton = document.createElement('button');
    archiveButton.style.cssText = `background: none; border: none; padding: 0; cursor: pointer; line-height: 0;`;

    const iconSpan = document.createElement('span');

    // ИЗМЕНЕНО: chrome.runtime -> browser.runtime
    const iconUrl = isLocallyArchived
        ? browser.runtime.getURL('icons/unarchive.svg')
        : browser.runtime.getURL('icons/archive.svg');

    const iconColor = isDarkTheme ? 'white' : '#4b5563';

    iconSpan.style.display = 'inline-block';
    iconSpan.style.width = '24px';
    iconSpan.style.height = '24px';
    iconSpan.style.setProperty('mask-image', `url(${iconUrl})`);
    iconSpan.style.setProperty('-webkit-mask-image', `url(${iconUrl})`);
    iconSpan.style.setProperty('mask-size', 'contain');
    iconSpan.style.setProperty('-webkit-mask-size', 'contain');
    iconSpan.style.setProperty('mask-repeat', 'no-repeat');
    iconSpan.style.setProperty('background-color', iconColor, 'important');

    archiveButton.appendChild(iconSpan);
    buttonContainer.appendChild(archiveButton);

    archiveButton.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const currentArchivedCourseIds = await getArchivedCoursesFromStorage();
        if (currentArchivedCourseIds.has(courseId)) {
            currentArchivedCourseIds.delete(courseId);
        } else {
            currentArchivedCourseIds.add(courseId);
        }
        await setArchivedCoursesInStorage(currentArchivedCourseIds);
        await renderCoursesBasedOnState();
    });
}


function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) return resolve(element);
        const observer = new MutationObserver(() => {
            const foundElement = document.querySelector(selector);
            if (foundElement) {
                observer.disconnect();
                resolve(foundElement);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }, timeout);
    });
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}


initializeCourseFix();