// courses_fix.js (версия с исправленным URL перехода)
'use strict';

// --- Глобальные переменные и инициализация ---

let currentUrl = location.href;
main();


// --- Основная логика ---

/**
 * Главная функция. Устанавливает наблюдателей и запускает первую отрисовку.
 */
function main() {
    browser.storage.onChanged.addListener((changes) => {
        if (changes.archivedCourseIds || changes.themeEnabled) {
            renderCoursesBasedOnState();
        }
    });

    const observer = new MutationObserver(() => {
        if (location.href !== currentUrl) {
            currentUrl = location.href;
            console.log('Course Archiver: URL changed, re-running logic.');
            runLogicForPage();
        }
    });

    observer.observe(document.body, { subtree: true, childList: true });

    runLogicForPage();
}

/**
 * Функция-обертка, которая ждет появления списка курсов и запускает отрисовку.
 */
async function runLogicForPage() {
    try {
        await waitForElement('ul.course-list', 15000);
        await renderCoursesBasedOnState();
    } catch (e) {
        console.log("Course Archiver: Not a course page, or content failed to load in time.");
    }
}


// --- Функции для работы с API и хранилищем (без изменений) ---

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
        const data = await browser.storage.local.get('archivedCourseIds');
        return new Set(data.archivedCourseIds || []);
    } catch (e) {
        console.error("Course Archiver: Error getting data from storage", e);
        return new Set();
    }
}

async function setArchivedCoursesInStorage(archivedCourseIds) {
    try {
        await browser.storage.local.set({ archivedCourseIds: Array.from(archivedCourseIds) });
    } catch (e) {
        console.error("Course Archiver: Error saving data to storage", e);
    }
}


// --- Функции отрисовки и управления DOM ---

async function renderCoursesBasedOnState() {
    const courseListContainer = document.querySelector('ul.course-list');
    if (!courseListContainer) return;

    const currentPath = window.location.pathname;
    const isOnArchivedPage = currentPath.includes('/courses/view/archived');
    const isOnActivePage = !isOnArchivedPage;

    const themeData = await browser.storage.sync.get('themeEnabled');
    const isDarkTheme = !!themeData.themeEnabled;

    const storedArchivedCourseIds = await getArchivedCoursesFromStorage();
    const allApiCourses = await fetchAllCoursesData();

    const templateLi = document.querySelector('li.course-card');
    if (!templateLi) {
        console.error("Course Archiver: Template element for cloning not found.");
        return;
    }

    const coursesToDisplay = allApiCourses.filter(course => {
        const isLocallyArchived = storedArchivedCourseIds.has(course.id);
        const isApiArchived = course.isArchived;

        if (isOnActivePage) {
            return !isApiArchived && !isLocallyArchived;
        } else {
            return isApiArchived || isLocallyArchived;
        }
    });

    courseListContainer.innerHTML = '';

    coursesToDisplay.forEach(courseData => {
        const newLi = createCourseCardElement(courseData, templateLi);
        if (newLi) {
            courseListContainer.appendChild(newLi);
            updateCourseCard(newLi, courseData.id, storedArchivedCourseIds.has(courseData.id), isDarkTheme);
        }
    });
}


function createCourseCardElement(courseData, templateLi) {
    const newLi = templateLi.cloneNode(true);
    newLi.style.display = '';
    newLi.setAttribute('data-course-id', courseData.id);

    const title = newLi.querySelector('.course-name');
    if (title) {
        title.textContent = escapeHtml(courseData.name);
    }
    
    const linkComponent = newLi.querySelector('cu-course-card');
    if (linkComponent) {
        linkComponent.onclick = () => {
            // ИЗМЕНЕНО: Исправлен URL для перехода на страницу курса
            window.location.href = `/learn/courses/view/actual/${courseData.id}`;
        };
        linkComponent.style.cursor = 'pointer';
    }

    newLi.querySelectorAll('.archive-button-container').forEach(el => el.remove());
    return newLi;
}

function updateCourseCard(li, courseId, isLocallyArchived, isDarkTheme) {
    const imageAreaContainer = li.querySelector('div.course-card');
    if (!imageAreaContainer) return;

    imageAreaContainer.style.position = 'relative';

    let buttonContainer = li.querySelector('.archive-button-container');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'archive-button-container';
        imageAreaContainer.appendChild(buttonContainer);
    }

    buttonContainer.style.cssText = `position: absolute; right: 8px; bottom: 4px; z-index: 10;`;
    buttonContainer.innerHTML = '';

    const archiveButton = document.createElement('button');
    archiveButton.style.cssText = `background: none; border: none; padding: 0; cursor: pointer; line-height: 0;`;

    const iconSpan = document.createElement('span');
    const iconUrl = isLocallyArchived
        ? browser.runtime.getURL('icons/unarchive.svg')
        : browser.runtime.getURL('icons/archive.svg');
    const iconColor = isDarkTheme ? '#FFFFFF' : '#4b5563';

    iconSpan.style.cssText = `
        display: inline-block;
        width: 24px;
        height: 24px;
        mask-image: url(${iconUrl});
        -webkit-mask-image: url(${iconUrl});
        mask-size: contain;
        -webkit-mask-size: contain;
        mask-repeat: no-repeat;
        background-color: ${iconColor} !important;
    `;

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


// --- Вспомогательные функции ---

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