// Простой и эффективный content script
(async function() {
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
            window.cuLmsLog('Task Status Updater: Error:', error); // Логирование остается
        }
    }
    
    // Запускаем логику при первой загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runLogic);
    } else {
        setTimeout(runLogic, 1000);
    }

    // Создаем MutationObserver для отслеживания изменений в DOM
    // Это будет работать для SPA-навигации
    const observer = new MutationObserver((mutations) => {
        let shouldRun = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                // Проверяем, появились ли новые элементы с .task-table
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 && node.querySelector && node.querySelector('.task-table')) {
                        shouldRun = true;
                        break;
                    }
                }
            }
            if (shouldRun) break;
        }

        if (shouldRun) {
            // Запускаем логику снова с задержкой, чтобы дать странице полностью загрузиться
            setTimeout(runLogic, 500);
        }
    });

    // Начинаем наблюдение за изменениями в document.body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Функция получения данных задач
    async function fetchTasksData() {
        try {
            const response = await fetch('https://my.centraluniversity.ru/api/micro-lms/tasks/student');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            window.cuLmsLog('Task Status Updater: Fetched', data.length, 'tasks'); // Логирование остается
            return data;
        } catch (error) {
            window.cuLmsLog('Task Status Updater: Failed to fetch tasks:', error); // Логирование остается
            return [];
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
        
        // Возвращаем объект, чтобы было ясно, что мы ищем
        return { taskName, courseName };
    }

    /**
     * Находит соответствующую задачу в массиве данных из API, сравнивая по названию курса и названию задания.
     * @param {{taskName: string|null, courseName: string|null}} htmlNames Объект с названиями из HTML.
     * @param {Array<Object>} tasksData Массив объектов задач из API.
     * @returns {Object|null} Найденный объект задачи, или null, если не найдено.
     */
    function findMatchingTask(htmlNames, tasksData) {
        const { taskName: htmlTaskName, courseName: htmlCourseName } = htmlNames;

        if (!htmlTaskName || !htmlCourseName) return null; // Оба названия должны присутствовать для сравнения

        const normalizedHtmlTaskName = htmlTaskName.toLowerCase().trim();
        const normalizedHtmlCourseName = htmlCourseName.toLowerCase().trim();

        // Ищем точное совпадение по названию задания И названию курса
        const matchedTask = tasksData.find(task => {
            const apiTaskName = task.exercise?.name ? task.exercise.name.toLowerCase().trim() : '';
            const apiCourseName = task.course?.name ? task.course.name.toLowerCase().trim() : '';

            // Точное совпадение
            return apiTaskName === normalizedHtmlTaskName &&
                   apiCourseName === normalizedHtmlCourseName;
        });

        if (matchedTask) return matchedTask;

        // Если точное совпадение не найдено, можно добавить частичное, если это необходимо
        // Например: HTML: "ДЗ 1. Git & GitLab", API: "Git & GitLab"
        // HTML: "Основы разработки на Go", API: "Основы разработки на Go (лекции)"

        // Частичное совпадение: HTML-название задания содержится в API-названии задания, И HTML-название курса содержится в API-названии курса
        // Или наоборот, если API-название содержится в HTML-названии.
        // Это более гибкий подход, но "точно" означает, скорее всего, точное совпадение.
        // Если "точно" - это 100% совпадение строк, то оставляем только `matchedTask` выше.
        // Но для реальных данных часто бывают небольшие расхождения, поэтому я предложу более гибкий вариант как запасной.

        const partialMatchedTask = tasksData.find(task => {
            const apiTaskName = task.exercise?.name ? task.exercise.name.toLowerCase().trim() : '';
            const apiCourseName = task.course?.name ? task.course.name.toLowerCase().trim() : '';

            const taskNameMatches = (apiTaskName === normalizedHtmlTaskName) || // Точное совпадение
                                    (apiTaskName.includes(normalizedHtmlTaskName) && normalizedHtmlTaskName.length > 3) || // HTML-имя в API-имени
                                    (normalizedHtmlTaskName.includes(apiTaskName) && apiTaskName.length > 3); // API-имя в HTML-имени

            const courseNameMatches = (apiCourseName === normalizedHtmlCourseName) || // Точное совпадение
                                      (apiCourseName.includes(normalizedHtmlCourseName) && normalizedHtmlCourseName.length > 3) || // HTML-имя в API-имени
                                      (normalizedHtmlCourseName.includes(apiCourseName) && apiCourseName.length > 3); // API-имя в HTML-имени
            
            return taskNameMatches && courseNameMatches;
        });

        return partialMatchedTask; // Возвращаем либо точное, либо частичное совпадение
    }

    function updateTaskStatuses(tasksData) {
        const statusElements = document.querySelectorAll('.state-chip');
        
        window.cuLmsLog('Task Status Updater: Found', statusElements.length, 'status elements'); // Логирование остается
        
        let updatedCount = 0;
        
        statusElements.forEach((element, index) => {
            const htmlNames = extractTaskAndCourseNamesFromElement(element);
            
            if (htmlNames && htmlNames.taskName && htmlNames.courseName) {
                window.cuLmsLog(`Task ${index}: Extracted names - Task: "${htmlNames.taskName}", Course: "${htmlNames.courseName}"`); // Логирование остается
                
                const task = findMatchingTask(htmlNames, tasksData);
                
                if (task) {
                    window.cuLmsLog(`Task ${index}: Found matching task - "${task.exercise?.name}" in "${task.course?.name}"`); // Логирование остается
                    
                    // Обновляем статус, если задача уже была отправлена (submitAt не null)
                    if (task.submitAt !== null) {
                        if (element.textContent.includes('В работе')) {
                            element.textContent = 'Есть решение';
                            element.style.backgroundColor = '#4CAF50'; // Зеленый
                            element.style.color = 'white';
                            element.setAttribute('data-appearance', 'support-positive');
                            
                            updatedCount++;
                            window.cuLmsLog(`Task Status Updater: Updated task "${task.exercise?.name}" to "Есть решение"`); // Логирование остается
                        }
                    }
                    
                    // Обновляем статус, если задача находится на оценке или ревью
                    if (task.state === 'evaluated' || task.state === 'review') {
                        if (element.textContent.includes('В работе') || element.textContent.includes('Есть решение')) {
                            element.textContent = 'Проверяется';
                            element.style.backgroundColor = '#FF9800'; // Оранжевый
                            element.style.color = 'white';
                            element.setAttribute('data-appearance', 'support-warning');
                            updatedCount++;
                            window.cuLmsLog(`Task Status Updater: Updated task "${task.exercise?.name}" to "Проверяется"`); // Логирование остается
                        }
                    }
                } else {
                    window.cuLmsLog(`Task ${index}: No matching task found for HTML names Task: "${htmlNames.taskName}", Course: "${htmlNames.courseName}"`); // Логирование остается
                }
            } else {
                window.cuLmsLog(`Task ${index}: Could not extract task and/or course name for element`, element); // Логирование остается
            }
        });
        
        if (updatedCount > 0) {
            window.cuLmsLog(`Task Status Updater: Updated ${updatedCount} tasks`); // Логирование остается
        }
    }

    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found`));
            }, timeout);
        });
    }
})();