// courses_fix.js (кросс-браузерная версия, исправленная после слияния)
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
        // Используем browser.storage для кросс-браузерности
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


async function rende