// Простой и эффективный content script
(function() {
    'use strict';

    // Основная функция, которая запускает весь процесс
    async function runLogic() {
        try {
            // Ждем появления таблиц с задачами
            await waitForElement('.task-table');
            // Получаем актуальные данные задач
            const tasksData = await fetchTasksData();
            // Обновляем статусы на странице
            updateTaskStatuses(tasksData);
        } catch (error) {
            console.error('Task Status Updater: Error:', error); // Используем console.error для лучшего отслеживания
        }
    }

    // Функция получения данных задач
    async function fetchTasksData() {
        try {
            const response = await fetch('https://my.centraluniversity.ru/api/micro-lms/tasks/student');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Task Status Updater: Fetched', data.length, 'tasks');
            return data;
        } catch (error) {
            console.error('Task Status Updater: Failed to fetch tasks:', error);
            return []; // Возвращаем пустой массив в случае ошибки
        }
    }

    /**
     * Извлекает название задания и название курса из элемента HTML.
     * @param {HTMLElement} element Элемент, представляющий статус задачи или родительский элемент.
     * @returns {{taskName: string|null, courseName: string|null}|null} Объект с именами, или null, если не найдено.
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
     * @param {{taskName: string|null, courseName: string|null}} htmlNames Объект с названиями из HTML.
     * @param {Array<Object>} tasksData Массив объектов задач из API.
     * @returns {Object|null} Найденный объект задачи, или null.
     */
    function findMatchingTask(htmlNames, tasksData) {
        const { taskName: htmlTaskName, courseName: htmlCourseName } = htmlNames;
        if (!htmlTaskName || !htmlCourseName) return null;

        const normalizedHtmlTaskName = htmlTaskName.toLowerCase().trim();
        const normalizedHtmlCourseName = htmlCourseName.toLowerCase().trim();

        // 1. Поиск точного совпадения
        let matchedTask = tasksData.find(task => {
            const apiTaskName = task.exercise?.name?.toLowerCase().trim() || '';
            const apiCourseName = task.course?.name?.toLowerCase().trim() || '';
            return apiTaskName === normalizedHtmlTaskName && apiCourseName === normalizedHtmlCourseName;
        });

        if (matchedTask) return matchedTask;

        // 2. Поиск частичного совпадения как запасной вариант
        matchedTask = tasksData.find(task => {
            const apiTaskName = task.exercise?.name?.toLowerCase().trim() || '';
            const apiCourseName = task.course?.name?.toLowerCase().trim() || '';

            const taskNameMatches = (apiTaskName.includes(normalizedHtmlTaskName) && normalizedHtmlTaskName.length > 3) ||
                                    (normalizedHtmlTaskName.includes(apiTaskName) && apiTaskName.length > 3);

            const courseNameMatches = (apiCourseName.includes(normalizedHtmlCourseName) && normalizedHtmlCourseName.length > 3) ||
                                      (normalizedHtmlCourseName.includes(apiCourseName) && apiCourseName.length > 3);

            return taskNameMatches && courseNameMatches;
        });

        return matchedTask;
    }

    /**
     * Обновляет статусы задач на странице на основе данных из API.
     * @param {Array<Object>} tasksData
     */
    function updateTaskStatuses(tasksData) {
        const statusElements = document.querySelectorAll('.state-chip');
        console.log('Task Status Updater: Found', statusElements.length, 'status elements');
        let updatedCount = 0;

        statusElements.forEach((element, index) => {
            const htmlNames = extractTaskAndCourseNamesFromElement(element);
            if (!htmlNames || !htmlNames.taskName || !htmlNames.courseName) {
                console.warn(`Task ${index}: Could not extract task and/or course name for element`, element);
                return;
            }

            // console.log(`Task ${index}: Extracted names - Task: "${htmlNames.taskName}", Course: "${htmlNames.courseName}"`);
            const task = findMatchingTask(htmlNames, tasksData);

            if (task) {
                // console.log(`Task ${index}: Found matching task - "${task.exercise?.name}" in "${task.course?.name}"`);
                let isUpdated = false;
                // Статус "Проверяется" имеет самый высокий приоритет
                if (task.state === 'evaluated' || task.state === 'review') {
                    // if (!element.textContent.includes('Проверяется')) {
                    //     element.textContent = 'Проверяется';
                    //     element.style.backgroundColor = '#FF9800'; // Оранжевый
                    //     element.style.color = 'white';
                    //     element.setAttribute('data-appearance', 'support-warning');
                    //     isUpdated = true;
                    // }
                }
                // Затем проверяем, есть ли решение, если статус еще не "Проверяется"
                else if (task.submitAt !== null) {
                    if (element.textContent.includes('В работе')) {
                         element.textContent = 'Есть решение';
                         element.style.backgroundColor = '#4CAF50'; // Зеленый
                         element.style.color = 'white';
                         element.setAttribute('data-appearance', 'support-positive');
                         isUpdated = true;
                    }
                }
                if (isUpdated) {
                    updatedCount++;
                    console.log(`Task Status Updater: Updated task "${task.exercise?.name}"`);
                }
            } else {
                // console.warn(`Task ${index}: No matching task found for HTML names Task: "${htmlNames.taskName}", Course: "${htmlNames.courseName}"`);
            }
        });

        if (updatedCount > 0) {
            console.log(`Task Status Updater: Updated ${updatedCount} tasks`);
        }
    }

    /**
     * Ожидает появления элемента в DOM.
     * @param {string} selector CSS-селектор элемента.
     * @param {number} timeout Время ожидания в миллисекундах.
     * @returns {Promise<Element>}
     */
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

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    // --- Запуск скрипта ---

    // Запускаем логику при первой загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runLogic);
    } else {
        // Небольшая задержка, чтобы дать SPA-фреймворку отрисовать страницу
        setTimeout(runLogic, 1000);
    }

    // Создаем MutationObserver для отслеживания изменений в DOM (для SPA-навигации)
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    // Проверяем, появился ли в добавленных узлах нужный нам элемент
                    if (node.nodeType === 1 && (node.matches('.task-table') || node.querySelector('.task-table'))) {
                        // Запускаем логику снова с задержкой
                        setTimeout(runLogic, 500);
                        return; // Выходим из обоих циклов после первого найденного совпадения
                    }
                }
            }
        }
    });

    // Начинаем наблюдение за изменениями в document.body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();