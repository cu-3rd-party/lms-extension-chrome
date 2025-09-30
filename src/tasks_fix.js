// Простой и эффективный content script
(function() {
    'use strict';

    let isRunning = false;
    let debounceTimer;

    function debounce(func, delay) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(func, delay);
    }

    /**
     * Внедряет на страницу кастомные CSS-стили и переменные.
     */
    function injectCustomStyles() {
        const styleId = 'culms-custom-styles';
        if (document.getElementById(styleId)) {
            return;
        }

        const styleElement = document.createElement('style');
        styleElement.id = styleId;

        styleElement.textContent = `
            :root {
                --culms-dark-bg-seminar: #a8a8a8;
                --culms-status-seminar: #706f6f;
            }

            /*
              --- ИЗМЕНЕНИЕ ---
              Делаем селектор более специфичным, добавляя имя тега 'tui-chip'.
              Теперь он будет "сильнее" правил из другого плагина.
            */
            tui-chip.state-chip[data-culms-status="seminar"] {
                background-color: var(--culms-status-seminar) !important;
                color: white !important;
            }
        `;

        document.head.appendChild(styleElement);
        console.log('Task Status Updater: Custom styles injected.');
    }

    /**
     * Основная функция, которая запускает весь процесс.
     */
    async function runLogic() {
        if (isRunning) return;
        isRunning = true;
        try {
            await waitForElement('.task-table');
            const tasksData = await fetchTasksData();
            if (tasksData.length > 0) {
               updateTaskStatuses(tasksData);
            }
        } catch (error) {
            console.error('Task Status Updater: Error:', error);
        } finally {
            isRunning = false;
        }
    }

    /**
     * Функция получения данных задач из API.
     */
    async function fetchTasksData() {
        try {
            const response = await fetch('https://my.centraluniversity.ru/api/micro-lms/tasks/student');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Task Status Updater: Failed to fetch tasks:', error);
            return [];
        }
    }

    /**
     * Извлекает название задания и название курса из элемента HTML.
     */
    function extractTaskAndCourseNamesFromElement(element) {
        const taskRow = element.closest('tr[class*="task-table__task"], .task-item, .task-row');
        if (!taskRow) return null;
        const taskNameElement = taskRow.querySelector('.task-table__task-name, .task-name, .exercise-name, [class*="task-name"]');
        const courseNameElement = taskRow.querySelector('.task-table__course-name, .course-name, [class*="course-name"]');
        const taskName = taskNameElement ? taskNameElement.textContent.trim() : null;
        const courseName = courseNameElement ? courseNameElement.textContent.trim() : null;
        return { taskName, courseName };
    }

    /**
     * Находит соответствующую задачу в массиве данных из API.
     */
    function findMatchingTask(htmlNames, tasksData) {
        const { taskName: htmlTaskName, courseName: htmlCourseName } = htmlNames;
        if (!htmlTaskName || !htmlCourseName) return null;
        const normalizedHtmlTaskName = htmlTaskName.toLowerCase().trim();
        const normalizedHtmlCourseName = htmlCourseName.toLowerCase().trim();
        return tasksData.find(task => {
            const apiTaskName = task.exercise?.name?.toLowerCase().trim() || '';
            const apiCourseName = task.course?.name?.toLowerCase().trim() || '';
            return apiTaskName === normalizedHtmlTaskName && apiCourseName === normalizedHtmlCourseName;
        });
    }

    /**
     * Обновляет статусы задач на странице на основе данных из API.
     */
    function updateTaskStatuses(tasksData) {
        const statusElements = document.querySelectorAll('.state-chip');
        let updatedCount = 0;

        statusElements.forEach((element) => {
            element.removeAttribute('data-culms-status');
            const parentRow = element.closest('tr[class*="task-table__task"], .task-item, .task-row');
            if (parentRow) parentRow.style.backgroundColor = '';

            const htmlNames = extractTaskAndCourseNamesFromElement(element);
            if (!htmlNames || !htmlNames.taskName || !htmlNames.courseName) return;

            const task = findMatchingTask(htmlNames, tasksData);

            if (task) {
                let isUpdated = false;

                if (task.exercise?.activity?.name === 'Аудиторная работа') {
                    element.textContent = 'Аудиторная';
                    element.setAttribute('data-culms-status', 'seminar');
                    element.style.backgroundColor = '';
                    element.style.color = '';

                    const taskRow = element.closest('tr[class*="task-table__task"], .task-item, .task-row');
                    if (taskRow) {
                        taskRow.style.backgroundColor = 'var(--culms-dark-bg-seminar)';
                    }
                    isUpdated = true;
                } else if (task.submitAt !== null) {
                    if (element.textContent.includes('В работе')) {
                         element.textContent = 'Есть решение';
                         element.style.backgroundColor = '#4CAF50';
                         element.style.color = 'white';
                         element.setAttribute('data-appearance', 'support-positive');
                         isUpdated = true;
                    }
                }

                if (isUpdated) updatedCount++;
            }
        });

        if (updatedCount > 0) {
            console.log(`Task Status Updater: Updated ${updatedCount} tasks.`);
        }
    }

    /**
     * Ожидает появления элемента в DOM.
     */
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) return resolve(element);
            const observer = new MutationObserver((mutations, obs) => {
                const foundElement = document.querySelector(selector);
                if (foundElement) {
                    obs.disconnect();
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

    // --- Запуск скрипта ---

    injectCustomStyles();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(runLogic, 1500));
    } else {
        setTimeout(runLogic, 1500);
    }

    const observer = new MutationObserver(() => {
        if (document.querySelector('.task-table')) {
            debounce(runLogic, 10000);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();