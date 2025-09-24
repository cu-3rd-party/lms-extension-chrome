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
            //window.debugLog('Task Status Updater: Error:', error);
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
                // Проверяем, появились ли новые элементы с .state-chip
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
            window.debugLog('Task Status Updater: Fetched', data.length, 'tasks');
            return data;
        } catch (error) {
            window.debugLog('Task Status Updater: Failed to fetch tasks:', error);
            return [];
        }
    }

    function extractTaskIdFromElement(element) {
        // ... (код остается прежним) ...
        const dataTaskId = element.closest('[data-task-id]');
        if (dataTaskId) return dataTaskId.getAttribute('data-task-id');
        
        const parentWithId = element.closest('[id*="task"]');
        if (parentWithId && parentWithId.id) return parentWithId.id;
        
        const taskLink = element.closest('a[href*="task"]') || element.querySelector('a[href*="task"]');
        if (taskLink && taskLink.href) {
            const match = taskLink.href.match(/task[_-]?(\d+)/i);
            if (match) return match[1];
        }
        
        const taskRow = element.closest('tr, .task-item, .task-row');
        if (taskRow) {
            const taskNameElement = taskRow.querySelector('.task-name, .exercise-name, [class*="name"]');
            if (taskNameElement) {
                return taskNameElement.textContent.trim();
            }
        }
        
        return null;
    }

    function findMatchingTask(taskIdOrName, tasksData) {
        // ... (код остается прежним) ...
        if (!taskIdOrName) return null;
        
        const taskById = tasksData.find(task => 
            task.id === taskIdOrName || 
            task.exercise?.id === taskIdOrName ||
            task.taskId === taskIdOrName
        );
        if (taskById) return taskById;
        
        const taskByName = tasksData.find(task => 
            task.exercise?.name && 
            task.exercise.name.toLowerCase().includes(taskIdOrName.toLowerCase())
        );
        if (taskByName) return taskByName;
        
        if (typeof taskIdOrName === 'string') {
            const partialMatch = tasksData.find(task => 
                task.exercise?.name && 
                taskIdOrName.toLowerCase().includes(task.exercise.name.toLowerCase())
            );
            if (partialMatch) return partialMatch;
        }
        
        return null;
    }

    function updateTaskStatuses(tasksData) {
        // ... (код остается прежним) ...
        const statusElements = document.querySelectorAll('.state-chip');
        
        window.debugLog('Task Status Updater: Found', statusElements.length, 'status elements');
        window.debugLog('Task Status Updater: Available tasks data:', tasksData);
        
        let updatedCount = 0;
        
        statusElements.forEach((element, index) => {
            const taskIdOrName = extractTaskIdFromElement(element);
            
            if (taskIdOrName) {
                window.debugLog(`Task ${index}: Extracted ID/Name -`, taskIdOrName);
                
                const task = findMatchingTask(taskIdOrName, tasksData);
                
                if (task) {
                    window.debugLog(`Task ${index}: Found matching task -`, task.exercise?.name);
                    
                    if (task.submitAt !== null) {
                        if (element.textContent.includes('В работе')) {
                            element.textContent = 'Есть решение';
                            element.style.backgroundColor = '#4CAF50';
                            element.style.color = 'white';
                            element.setAttribute('data-appearance', 'support-positive');
                            
                            updatedCount++;
                            window.debugLog(`Task Status Updater: Updated task "${task.exercise?.name}"`);
                        }
                    }
                    
                    if (task.state === 'evaluated' || task.state === 'review') {
                        if (element.textContent.includes('В работе') || element.textContent.includes('Есть решение')) {
                            element.textContent = 'Проверяется';
                            element.style.backgroundColor = '#FF9800';
                            element.style.color = 'white';
                            updatedCount++;
                        }
                    }
                } else {
                    window.debugLog(`Task ${index}: No matching task found for`, taskIdOrName);
                }
            } else {
                window.debugLog(`Task ${index}: Could not extract task ID/name`);
                
                const task = tasksData[index];
                if (task && element.textContent.includes('В работе')) {
                    window.debugLog(`Task ${index}: Using fallback matching for`, task.exercise?.name);
                    
                    if (task.submitAt !== null) {
                        element.textContent = 'Есть решение';
                        element.style.backgroundColor = '#4CAF50';
                        element.style.color = 'white';
                        element.setAttribute('data-appearance', 'support-positive');
                        updatedCount++;
                    }
                    
                    if (task.state === 'evaluated' || task.state === 'review') {
                        element.textContent = 'Проверяется';
                        element.style.backgroundColor = '#FF9800';
                        element.style.color = 'white';
                        updatedCount++;
                    }
                }
            }
        });
        
        if (updatedCount > 0) {
            window.debugLog(`Task Status Updater: Updated ${updatedCount} tasks`);
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

    // Убрал setInterval, так как MutationObserver и так отлично справляется.
    // Если нужно, можно добавить его обратно, но он не решает проблему навигации.
})();