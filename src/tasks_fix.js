// tasks_fix.js (финальная версия с умным предохранителем)
'use strict';

/**
 * Главная функция-обертка, которая решает, нужно ли запускать основную логику.
 */
function initializeTasksFix() {
    // --- НОВЫЙ, УМНЫЙ ПРЕДОХРАНИТЕЛЬ ---
    // Проверяем, есть ли уже на странице результат работы скрипта (колонка "Вес").
    // Если есть, значит, мы уже отработали и ничего делать не нужно.
    if (document.querySelector('[data-culms-weight-header]')) {
        console.log('Task Status Updater: Already initialized on this page. Skipping.');
        return;
    }

    // Если колонки нет, запускаем основную логику.
    runLogic();
}

/**
 * Основная логика: ожидание элементов и их обновление.
 */
async function runLogic() {
    try {
        await waitForElement('tr[class*="task-table__task"]');
        console.log('Task Status Updater: Task rows found, running updates.');
        await new Promise(resolve => setTimeout(resolve, 100));
        addWeightColumnHeader();
        const tasksData = await fetchTasksData();
        if (tasksData && tasksData.length > 0) {
           updateTaskStatuses(tasksData);
        }
    } catch (error) {
        console.error('Task Status Updater: Error in runLogic:', error);
    }
}

// --- Все остальные функции остаются без изменений ---

function updateTaskStatuses(tasksData) {
    document.querySelectorAll('tr[class*="task-table__task"]').forEach(row => {
        const statusElement = row.querySelector('.state-chip');
        if (!statusElement) return;
        const htmlNames = extractTaskAndCourseNamesFromElement(statusElement);
        const task = findMatchingTask(htmlNames, tasksData);
        if (task) {
            if (task.exercise?.activity?.name === 'Аудиторная работа') {
                row.setAttribute('data-culms-row-type', 'seminar');
                statusElement.textContent = 'Аудиторная';
                statusElement.setAttribute('data-culms-status', 'seminar');
            } else {
                row.removeAttribute('data-culms-row-type');
                if (task.submitAt !== null && statusElement.textContent.includes('В работе')) {
                    statusElement.textContent = 'Есть решение';
                    statusElement.setAttribute('data-culms-status', 'solved');
                }
            }
            const weight = task.exercise?.activity?.weight;
            let weightCell = row.querySelector('[data-culms-weight-cell]');
            if (!weightCell) {
                const originalScoreCell = row.querySelector('.task-table__score');
                const stateCell = row.querySelector('.task-table__state');
                if (originalScoreCell && stateCell) {
                    weightCell = originalScoreCell.cloneNode(true);
                    weightCell.setAttribute('data-culms-weight-cell', 'true');
                    stateCell.parentNode.insertBefore(weightCell, stateCell.nextSibling);
                }
            }
            if (weightCell) {
                weightCell.textContent = (weight !== undefined && weight !== null) ? `${Math.round(weight * 100)}%` : '—';
            }
        }
    });
}

function addWeightColumnHeader() {
    const headerRow = document.querySelector('.task-table__header');
    if (!headerRow || headerRow.querySelector('[data-culms-weight-header]')) return;
    const scoreHeader = headerRow.querySelector('.task-table__score');
    const stateHeader = headerRow.querySelector('.task-table__state');
    if (scoreHeader && stateHeader) {
        const weightHeader = scoreHeader.cloneNode(true);
        weightHeader.setAttribute('data-culms-weight-header', 'true');
        weightHeader.textContent = 'Вес';
        stateHeader.parentNode.insertBefore(weightHeader, stateHeader.nextSibling);
    }
}

async function fetchTasksData() {
    try {
        const response = await fetch('https://my.centraluniversity.ru/api/micro-lms/tasks/student');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) { console.error('Task Status Updater: Failed to fetch tasks:', error); return []; }
}

function extractTaskAndCourseNamesFromElement(element) {
    const taskRow = element.closest('tr[class*="task-table__task"]');
    if (!taskRow) return null;
    const taskName = taskRow.querySelector('.task-table__task-name')?.textContent.trim();
    const courseName = taskRow.querySelector('.task-table__course-name')?.textContent.trim();
    return { taskName, courseName };
}

function findMatchingTask(htmlNames, tasksData) {
    if (!htmlNames?.taskName || !htmlNames?.courseName) return null;
    const normalizedHtmlTaskName = htmlNames.taskName.toLowerCase();
    const normalizedHtmlCourseName = htmlNames.courseName.toLowerCase();
    return tasksData.find(task =>
        task.exercise?.name?.toLowerCase().trim() === normalizedHtmlTaskName &&
        task.course?.name?.toLowerCase().trim() === normalizedHtmlCourseName
    );
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
            reject(new Error(`Timeout waiting for ${selector}`));
        }, timeout);
    });
}

// --- Запуск скрипта ---
// Теперь мы запускаем главную функцию-обертку, а не runLogic напрямую.
initializeTasksFix();