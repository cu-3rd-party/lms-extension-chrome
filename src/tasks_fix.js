// tasks_fix.js (финальная версия с точной подсветкой статуса)
'use strict';

// --- БЛОК ОЧИСТКИ ФИЛЬТРОВ В LOCALSTORAGE ---
(function cleanFiltersInLocalStorage() {
    const filterKey = 'cu.lms.actual-student-tasks-filter';
    try {
        const storedFilterJSON = localStorage.getItem(filterKey);
        if (storedFilterJSON) {
            const filterData = JSON.parse(storedFilterJSON);
            if (filterData.course?.length > 0 || filterData.state?.length > 0) {
                console.log('Task Status Updater: Found default filters in localStorage. Cleaning them...', filterData);
                filterData.course = [];
                filterData.state = [];
                localStorage.setItem(filterKey, JSON.stringify(filterData));
                console.log('Task Status Updater: Filters cleaned. The site will now fetch all tasks.');
            }
        }
    } catch (error) {
        console.error('Task Status Updater: Failed to clean localStorage filters.', error);
    }
})();

/**
 * Главная функция-обертка.
 */
function initializeTasksFix() {
    if (document.querySelector('[data-culms-weight-header]')) {
        console.log('Task Status Updater: Already initialized. Skipping.');
        return;
    }
    runLogic();
}

/**
 * Основная логика: ожидание элементов, обновление данных и настройка фильтра.
 */
async function runLogic() {
    try {
        await waitForElement('tr[class*="task-table__task"]');
        console.log('Task Status Updater: Task rows found, running updates.');
        
        addWeightColumnHeader();
        const tasksData = await fetchTasksData();
        if (tasksData && tasksData.length > 0) {
           updateTaskStatuses(tasksData);
        }
        
        initializeAllFilters();
        setupDropdownInterceptor();

    } catch (error) {
        console.error('Task Status Updater: Error in runLogic:', error);
    }
}


// --- БЛОК ЛОГИКИ ДЛЯ ДВУХ НЕЗАВИСИМЫХ ФИЛЬТРОВ ---

const HARDCODED_STATUSES = ["В работе", "Есть решение", "Ревью", "Бэклог", "Аудиторная"];
const selectedStatuses = new Set(HARDCODED_STATUSES);
const allAvailableCourses = new Set();
const selectedCourses = new Set();

function initializeAllFilters() {
    allAvailableCourses.clear();
    document.querySelectorAll('tr[class*="task-table__task"] .task-table__course-name').forEach(el => {
        const courseName = el.textContent.trim();
        if (courseName) allAvailableCourses.add(courseName);
    });
    allAvailableCourses.forEach(course => selectedCourses.add(course));
}

function applyCombinedFilter() {
    document.querySelectorAll('tr[class*="task-table__task"]').forEach(row => {
        const statusEl = row.querySelector('.state-chip');
        const courseEl = row.querySelector('.task-table__course-name');
        
        if (statusEl && courseEl) {
            const rowStatus = statusEl.textContent.trim();
            const rowCourse = courseEl.textContent.trim();
            const isStatusVisible = selectedStatuses.has(rowStatus);
            const isCourseVisible = selectedCourses.has(rowCourse);
            row.style.display = (isStatusVisible && isCourseVisible) ? '' : 'none';
        }
    });
}

function handleStatusFilterClick(event) {
    const optionButton = event.target.closest('button[tuioption]');
    if (!optionButton) return;
    updateSelection(selectedStatuses, optionButton.textContent.trim(), optionButton);
    applyCombinedFilter();
}

function handleCourseFilterClick(event) {
    const optionButton = event.target.closest('button[tuioption]');
    if (!optionButton) return;
    updateSelection(selectedCourses, optionButton.textContent.trim(), optionButton);
    applyCombinedFilter();
}

function updateSelection(selectionSet, text, button) {
    if (selectionSet.has(text)) selectionSet.delete(text);
    else selectionSet.add(text);
    const isSelected = selectionSet.has(text);
    button.classList.toggle('t-option_selected', isSelected);
    button.setAttribute('aria-selected', isSelected.toString());
    const checkbox = button.querySelector('input[tuicheckbox]');
    if (checkbox) checkbox.checked = isSelected;
}

function setupDropdownInterceptor() {
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1 || !node.matches('tui-dropdown')) continue;
                const dataListWrapper = node.querySelector('tui-data-list-wrapper.multiselect__dropdown');
                if (!dataListWrapper) continue;
                const statusFilterContainer = document.querySelector('cu-multiselect-filter[controlname="state"]');
                const courseFilterContainer = document.querySelector('cu-multiselect-filter[controlname="course"]');
                if (!dataListWrapper.dataset.culmsRebuilt && statusFilterContainer && statusFilterContainer.contains(document.activeElement)) {
                    buildDropdown(dataListWrapper, 'state');
                }
                else if (!dataListWrapper.dataset.culmsRebuilt && courseFilterContainer && courseFilterContainer.contains(document.activeElement)) {
                    buildDropdown(dataListWrapper, 'course');
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function buildDropdown(dataListWrapper, type) {
    dataListWrapper.dataset.culmsRebuilt = 'true';
    const dataList = dataListWrapper.querySelector('tui-data-list');
    if (!dataList) return;
    dataList.innerHTML = ''; 
    if (type === 'state') {
        HARDCODED_STATUSES.forEach(text => dataList.appendChild(createFilterOption(text, selectedStatuses.has(text))));
        dataListWrapper.addEventListener('click', handleStatusFilterClick);
    } else if (type === 'course') {
        initializeAllFilters();
        const sortedCourses = [...allAvailableCourses].sort();
        sortedCourses.forEach(text => dataList.appendChild(createFilterOption(text, selectedCourses.has(text))));
        dataListWrapper.addEventListener('click', handleCourseFilterClick);
    }
}

function createFilterOption(text, isSelected) {
    const button = document.createElement('button');
    button.className = 'ng-star-inserted';
    if (isSelected) button.classList.add('t-option_selected');
    button.setAttribute('tuiicons', ''); button.setAttribute('type', 'button'); button.setAttribute('role', 'option');
    button.setAttribute('automation-id', 'tui-data-list-wrapper__option'); button.setAttribute('tuielement', '');
    button.setAttribute('tuioption', ''); button.setAttribute('aria-selected', isSelected.toString());
    const finalStyle = `pointer-events: none; --t-checked-icon: url(assets/cu/icons/cuIconCheck.svg); --t-indeterminate-icon: url(assets/cu/icons/cuIconMinus.svg);`;
    button.innerHTML = `
        <tui-multi-select-option>
            <input tuiappearance tuicheckbox type="checkbox" class="_readonly" data-appearance="primary" data-size="s" style="${finalStyle}">
            <span class="t-content ng-star-inserted"> ${text} </span>
        </tui-multi-select-option>`;
    const checkbox = button.querySelector('input[tuicheckbox]');
    if (checkbox) checkbox.checked = isSelected;
    return button;
}

// --- Остальной код ---

/**
 * Обновляет статусы задач и добавляет подсветку. (ИЗМЕНЕННАЯ ФУНКЦИЯ)
 */
function updateTaskStatuses(tasksData) {
    document.querySelectorAll('tr[class*="task-table__task"]').forEach(row => {
        const statusElement = row.querySelector('.state-chip');
        if (!statusElement) return;
        
        // Сбрасываем кастомные стили перед проверкой
        statusElement.style.backgroundColor = '';
        statusElement.style.color = '';

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
                    
                    // --- ЛАСТ ФИКС: ТОЧНЫЕ ЦВЕТА КАК НА СКРИНШОТЕ ---
                    statusElement.style.backgroundColor = '#5cb85c'; // Зеленый фон
                    statusElement.style.color = '#ffffff';       // Белый текст
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
initializeTasksFix();