// Простой и эффективный content script
(async function() {
    'use strict';
    
    // Переменная для включения/выключения отладки
    const DEBUG = false; // поменяй на true для включения логов
    // realdev notes: этот DEBUG действует только на файл tasks_fix.js
    console.log('Task Status Updater: Extension loaded');
    
    // Ждем загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
    
    async function init() {
        try {
            // Ждем появления таблиц с задачами
            await waitForElement('.task-table');
            
            // Получаем данные задач
            const tasksData = await fetchTasksData();
            
            // Обновляем статусы на странице
            updateTaskStatuses(tasksData);
            
            // Наблюдаем за изменениями на странице (для SPA)
            observePageChanges(tasksData);
            
        } catch (error) {
            console.log('Task Status Updater: Error:', error);
        }
    }
    
    // Функция получения данных задач
    async function fetchTasksData() {
        try {
            const response = await fetch('https://my.centraluniversity.ru/api/micro-lms/tasks/student');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            debugLog('Task Status Updater: Fetched', data.length, 'tasks');
            return data;
        } catch (error) {
            console.log('Task Status Updater: Failed to fetch tasks:', error);
            return [];
        }
    }
    
    // Функция для отладочного логирования
    function debugLog(...args) {
        if (DEBUG) {
            console.log(...args);
        }
    }
    
    // Функция извлечения ID задачи из элемента на странице
    function extractTaskIdFromElement(element) {
        // Пытаемся найти ID разными способами
        
        // 1. Ищем в data-атрибутах
        const dataTaskId = element.closest('[data-task-id]');
        if (dataTaskId) return dataTaskId.getAttribute('data-task-id');
        
        // 2. Ищем в ID элемента
        const parentWithId = element.closest('[id*="task"]');
        if (parentWithId && parentWithId.id) return parentWithId.id;
        
        // 3. Ищем ссылку на задачу
        const taskLink = element.closest('a[href*="task"]') || element.querySelector('a[href*="task"]');
        if (taskLink && taskLink.href) {
            const match = taskLink.href.match(/task[_-]?(\d+)/i);
            if (match) return match[1];
        }
        
        // 4. Ищем в тексте названия задачи (последний вариант)
        const taskRow = element.closest('tr, .task-item, .task-row');
        if (taskRow) {
            const taskNameElement = taskRow.querySelector('.task-name, .exercise-name, [class*="name"]');
            if (taskNameElement) {
                return taskNameElement.textContent.trim();
            }
        }
        
        return null;
    }
    
    // Функция поиска соответствия задачи по ID или названию
    function findMatchingTask(taskIdOrName, tasksData) {
        if (!taskIdOrName) return null;
        
        // Сначала ищем по ID
        const taskById = tasksData.find(task => 
            task.id === taskIdOrName || 
            task.exercise?.id === taskIdOrName ||
            task.taskId === taskIdOrName
        );
        if (taskById) return taskById;
        
        // Если не нашли по ID, ищем по названию
        const taskByName = tasksData.find(task => 
            task.exercise?.name && 
            task.exercise.name.toLowerCase().includes(taskIdOrName.toLowerCase())
        );
        if (taskByName) return taskByName;
        
        // Пробуем найти частичное совпадение по названию
        if (typeof taskIdOrName === 'string') {
            const partialMatch = tasksData.find(task => 
                task.exercise?.name && 
                taskIdOrName.toLowerCase().includes(task.exercise.name.toLowerCase())
            );
            if (partialMatch) return partialMatch;
        }
        
        return null;
    }
    
    // Функция обновления статусов
    function updateTaskStatuses(tasksData) {
        // Находим все элементы с классом state-chip
        const statusElements = document.querySelectorAll('.state-chip');
        
        debugLog('Task Status Updater: Found', statusElements.length, 'status elements');
        debugLog('Task Status Updater: Available tasks data:', tasksData);
        
        let updatedCount = 0;
        
        statusElements.forEach((element, index) => {
            // Извлекаем ID или название задачи из элемента
            const taskIdOrName = extractTaskIdFromElement(element);
            
            if (taskIdOrName) {
                debugLog(`Task ${index}: Extracted ID/Name -`, taskIdOrName);
                
                // Находим соответствующую задачу в данных API
                const task = findMatchingTask(taskIdOrName, tasksData);
                
                if (task) {
                    debugLog(`Task ${index}: Found matching task -`, task.exercise?.name);
                    
                    // Проверяем, есть ли submitAt (решение отправлено)
                    if (task.submitAt !== null) {
                        // Если статус "В работе" - меняем на "Есть решение"
                        if (element.textContent.includes('В работе')) {
                            element.textContent = 'Есть решение';
                            element.style.backgroundColor = '#4CAF50'; // зеленый
                            element.style.color = 'white';
                            element.setAttribute('data-appearance', 'support-positive');
                            
                            updatedCount++;
                            debugLog(`Task Status Updater: Updated task "${task.exercise?.name}"`);
                        }
                    }
                    
                    // Дополнительная логика: если задача оценена
                    if (task.state === 'evaluated' || task.state === 'review') {
                        if (element.textContent.includes('В работе')) {
                            element.textContent = 'Проверяется';
                            element.style.backgroundColor = '#FF9800'; // оранжевый
                            element.style.color = 'white';
                            updatedCount++;
                        }
                    }
                } else {
                    debugLog(`Task ${index}: No matching task found for`, taskIdOrName);
                }
            } else {
                debugLog(`Task ${index}: Could not extract task ID/name`);
                
                // Fallback: попробуем найти по порядку, но с дополнительной проверкой
                const task = tasksData[index];
                if (task && element.textContent.includes('В работе')) {
                    debugLog(`Task ${index}: Using fallback matching for`, task.exercise?.name);
                    
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
        
        // Всегда показываем итоговое количество обновленных задач
        if (updatedCount > 0) {
            console.log(`Task Status Updater: Updated ${updatedCount} tasks`);
        }
    }
    
    // Функция ожидания элемента
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
    
    // Наблюдатель за изменениями на странице
    function observePageChanges(tasksData) {
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            if (node.querySelector && node.querySelector('.state-chip')) {
                                shouldUpdate = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldUpdate) {
                setTimeout(() => updateTaskStatuses(tasksData), 500);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Периодическое обновление (каждые 30 секунд)
    setInterval(async () => {
        try {
            const tasksData = await fetchTasksData();
            updateTaskStatuses(tasksData);
        } catch (error) {
            console.log('Task Status Updater: Periodic update failed:', error);
        }
    }, 30000);
    
})();