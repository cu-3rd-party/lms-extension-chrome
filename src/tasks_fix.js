// Финальная версия content script с клонированием элементов и исправлением стилей
(function() {
    'use strict';

    let isRunning = false;

    /**
     * Внедряет на страницу кастомные CSS-стили.
     */
    function injectCustomStyles() {
        const styleId = 'culms-custom-styles';
        if (document.getElementById(styleId)) return;

        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
            :root {
                --culms-dark-bg-seminar: #a8a8a8;
                --culms-status-seminar: #706f6f;
                --culms-status-solved: #4CAF50; /* <<< ИЗМЕНЕНИЕ: Добавили свою CSS-переменную для удобства */
            }
            /* Стиль для аудиторной работы */
            tui-chip.state-chip[data-culms-status="seminar"] {
                background-color: var(--culms-status-seminar) !important;
                color: white !important;
            }
            /* <<< ИЗМЕНЕНИЕ: Наше новое правило, которое будет перебивать стили темной темы */
            tui-chip.state-chip[data-culms-status="solved"] {
                background-color: var(--culms-status-solved) !important;
                color: white !important;
            }
        `;
        document.head.appendChild(styleElement);
        console.log('Task Status Updater: Custom styles injected.');
    }

    /**
     * Добавляет заголовок "Вес" путем клонирования существующего заголовка "Оценка".
     */
    function addWeightColumnHeader() {
        const headerRow = document.querySelector('.task-table__header');
        if (!headerRow || headerRow.querySelector('[data-culms-weight-header]')) {
            return; // Заголовок уже есть или нет шапки таблицы
        }

        const scoreHeader = headerRow.querySelector('.task-table__score');
        const stateHeader = headerRow.querySelector('.task-table__state');

        if (scoreHeader && stateHeader) {
            const weightHeader = scoreHeader.cloneNode(true); // Клонируем со всеми атрибутами
            weightHeader.setAttribute('data-culms-weight-header', 'true'); // Наш маркер
            weightHeader.textContent = 'Вес'; // Меняем только текст
            stateHeader.parentNode.insertBefore(weightHeader, stateHeader.nextSibling);
        }
    }

    /**
     * Основная функция, которая запускает весь процесс.
     */
    async function runLogic() {
        if (isRunning) return;
        isRunning = true;
        try {
            await waitForElement('.task-table');
            addWeightColumnHeader();
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
     * Получает данные задач из API.
     */
    async function fetchTasksData() {
        try {
            const response = await fetch('https://my.centraluniversity.ru/api/micro-lms/tasks/student');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Task Status Updater: Failed to fetch tasks:', error);
            return [];
        }
    }

    /**
     * Извлекает название задания и курса из HTML-элемента.
     */
    function extractTaskAndCourseNamesFromElement(element) {
        const taskRow = element.closest('tr[class*="task-table__task"]');
        if (!taskRow) return null;
        const taskName = taskRow.querySelector('.task-table__task-name')?.textContent.trim();
        const courseName = taskRow.querySelector('.task-table__course-name')?.textContent.trim();
        return { taskName, courseName };
    }

    /**
     * Находит соответствующую задачу в данных из API.
     */
    function findMatchingTask(htmlNames, tasksData) {
        if (!htmlNames.taskName || !htmlNames.courseName) return null;
        const normalizedHtmlTaskName = htmlNames.taskName.toLowerCase();
        const normalizedHtmlCourseName = htmlNames.courseName.toLowerCase();
        return tasksData.find(task =>
            task.exercise?.name?.toLowerCase().trim() === normalizedHtmlTaskName &&
            task.course?.name?.toLowerCase().trim() === normalizedHtmlCourseName
        );
    }

    /**
     * Обновляет статусы задач и добавляет/обновляет колонку с весом.
     */
    function updateTaskStatuses(tasksData) {
        document.querySelectorAll('tr[class*="task-table__task"]').forEach(row => {
            const statusElement = row.querySelector('.state-chip');
            if (!statusElement) return;

            const htmlNames = extractTaskAndCourseNamesFromElement(statusElement);
            const task = findMatchingTask(htmlNames, tasksData);

            if (task) {
                // Обновление статусов
                if (task.exercise?.activity?.name === 'Аудиторная работа') {
                    statusElement.textContent = 'Аудиторная';
                    statusElement.setAttribute('data-culms-status', 'seminar');
                    row.style.backgroundColor = 'var(--culms-dark-bg-seminar)';
                } else if (task.submitAt !== null && statusElement.textContent.includes('В работе')) {
                    statusElement.textContent = 'Есть решение';
                    // <<< ИЗМЕНЕНИЕ: Убираем инлайновые стили и ставим свой атрибут.
                    // Стилизация теперь будет происходить через CSS, который мы внедрили выше.
                    statusElement.setAttribute('data-culms-status', 'solved');
                    // statusElement.style.backgroundColor = '#4CAF50'; // Больше не нужно
                    // statusElement.style.color = 'white'; // Больше не нужно
                }

                // --- ЛОГИКА КОЛОНКИ "ВЕС" ---
                const weight = task.exercise?.activity?.weight;
                let weightCell = row.querySelector('[data-culms-weight-cell]');

                // Если ячейки еще нет - создаем ее путем клонирования
                if (!weightCell) {
                    const originalScoreCell = row.querySelector('.task-table__score');
                    const stateCell = row.querySelector('.task-table__state');

                    if (originalScoreCell && stateCell) {
                        weightCell = originalScoreCell.cloneNode(true); // <--- Ключевой момент: клонируем ячейку
                        weightCell.setAttribute('data-culms-weight-cell', 'true'); // Ставим маркер, чтобы найти ее в следующий раз
                        stateCell.parentNode.insertBefore(weightCell, stateCell.nextSibling);
                    }
                }

                // Обновляем текст в ячейке (в уже существующей или только что созданной)
                if (weightCell) {
                    weightCell.textContent = (weight !== undefined && weight !== null) ? `${Math.round(weight * 100)}%` : '—';
                }
            }
        });
    }

    /**
     * Ожидает появления элемента в DOM.
     */
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(selector)) return resolve(document.querySelector(selector));
            const observer = new MutationObserver(() => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout waiting for ${selector}`)); }, timeout);
        });
    }

    // --- Запуск скрипта ---
    injectCustomStyles();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runLogic);
    } else {
        runLogic();
    }

    setInterval(runLogic, 10000); // Периодическое обновление
})();