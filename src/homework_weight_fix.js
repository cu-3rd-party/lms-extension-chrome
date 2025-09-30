// ==UserScript==
// @name         Longread Weight Displayer
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Displays the weight of a longread task on its page, works with or without a score block.
// @author       You
// @match        https://my.centraluniversity.ru/learn/courses/view/actual/*/themes/*/longreads/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    /**
     * Основная функция, запускающая всю логику.
     */
    async function runLogic() {
        const match = window.location.pathname.match(/longreads\/(\d+)/);
        if (!match || document.querySelector('[data-culms-longread-weight]')) {
            return;
        }

        const longreadId = match[1];

        try {
            const apiResponse = await fetchLongreadData(longreadId);
            const weight = findWeightInApiResponse(apiResponse);

            if (weight === null) {
                console.log('Longread Weight: Weight not found in API response.');
                return;
            }

            // Ждем появления всего списка с информацией, а не конкретного элемента
            const infoList = await waitForInfoList();
            if (!infoList) return;

            insertWeightElement(infoList, weight);

        } catch (error) {
            console.error('Longread Weight: Error:', error);
        }
    }

    /**
     * Делает запрос к API и возвращает данные.
     * @param {string} longreadId - ID лекции из URL.
     * @returns {Promise<Object>} - Ответ от API.
     */
    async function fetchLongreadData(longreadId) {
        const apiUrl = `https://my.centraluniversity.ru/api/micro-lms/longreads/${longreadId}/materials?limit=10000`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`API request failed! Status: ${response.status}`);
        }
        return await response.json();
    }

    /**
     * Находит первое валидное значение веса в ответе API.
     * @param {Object} data - Весь объект ответа от API.
     * @returns {number|null} - Значение веса или null.
     */
    function findWeightInApiResponse(data) {
        if (!data || !Array.isArray(data.items)) return null;
        const itemWithWeight = data.items.find(item =>
            item?.estimation?.activity && typeof item.estimation.activity.weight === 'number'
        );
        return itemWithWeight ? itemWithWeight.estimation.activity.weight : null;
    }

    /**
     * Ищет <li> по тексту в его заголовке внутри указанного списка.
     * @param {HTMLElement} listElement - Элемент <ul>.
     * @param {string} title - Текст для поиска (например, "Статус").
     * @returns {HTMLElement|null}
     */
    function findItemByTitle(listElement, title) {
        for (const li of listElement.querySelectorAll('.task-info__item')) {
            const titleSpan = li.querySelector('.task-info__item-title');
            if (titleSpan && titleSpan.textContent.trim() === title) {
                return li;
            }
        }
        return null;
    }

    /**
     * Клонирует подходящий элемент, заполняет его данными о весе и вставляет на страницу.
     * @param {HTMLElement} infoList - Элемент <ul>, содержащий информацию о задании.
     * @param {number} weight - Значение веса (например, 0.2).
     */
    function insertWeightElement(infoList, weight) {
        // Проверяем еще раз, чтобы избежать дублирования
        if (infoList.querySelector('[data-culms-longread-weight]')) return;

        // 1. Находим "якорь" - элемент, после которого будет вставка. "Статус" самый надежный.
        const anchorItem = findItemByTitle(infoList, 'Статус');
        if (!anchorItem) {
            console.log('Longread Weight: Could not find "Статус" item to insert after.');
            return;
        }

        // 2. Находим источник для клонирования. Сначала ищем "Оценку", если нет - "Дедлайн".
        const cloneSourceItem = findItemByTitle(infoList, 'Оценка') || findItemByTitle(infoList, 'Дедлайн');
        if (!cloneSourceItem) {
            console.log('Longread Weight: Could not find a suitable item to clone ("Оценка" or "Дедлайн").');
            return;
        }

        // 3. Клонируем, изменяем и вставляем
        const weightListItem = cloneSourceItem.cloneNode(true);
        weightListItem.setAttribute('data-culms-longread-weight', 'true');

        const titleSpan = weightListItem.querySelector('.task-info__item-title');
        const valueSpan = weightListItem.querySelectorAll('span')[1]; // Второй span - это всегда значение

        if (titleSpan) {
            titleSpan.textContent = 'Вес';
        }

        if (valueSpan) {
            // Очищаем от возможного сложного содержимого (как <tui-chip>) и вставляем свой текст
            valueSpan.innerHTML = ` ${Math.round(weight * 100)}% `;
        }

        // Вставляем наш новый элемент сразу после "Статуса"
        anchorItem.parentNode.insertBefore(weightListItem, anchorItem.nextSibling);
        console.log('Longread Weight: Weight info added successfully.');
    }

    /**
     * Ожидает появления списка с информацией о задании в DOM.
     * @param {number} timeout - Время ожидания в миллисекундах.
     * @returns {Promise<HTMLElement>}
     */
    function waitForInfoList(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const selector = 'ul.task-info';
            const checkInterval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(checkInterval);
                    clearTimeout(failTimer);
                    resolve(element);
                }
            }, 100);

            const failTimer = setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error(`Wait for "${selector}" timed out.`));
            }, timeout);
        });
    }


    // --- Запуск скрипта ---

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runLogic);
    } else {
        runLogic();
    }

    let lastUrl = location.href;
    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            runLogic();
        }
    }).observe(document.body, { subtree: true, childList: true });

})();