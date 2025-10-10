// ==UserScript==
// @name         Central University Course Exporter (Local Server Plugin)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Scans the first available course and uploads material info to a local server.
// @author       You
// @match        https://my.centraluniversity.ru/learn/courses/view/actual
// @grant        none
// ==/UserScript==

(() => {
    // --- ИСПРАВЛЕНИЕ: Предотвращение двойного запуска скрипта ---
    // Background-скрипт может внедрять этот код несколько раз (onCompleted и onHistoryStateUpdated).
    // Этот флаг гарантирует, что основная логика выполнится только один раз на одной странице.
    if (window.courseExporterHasRun) {
        console.log('Course Exporter Plugin: Detected duplicate execution. Aborting.');
        return;
    }
    window.courseExporterHasRun = true;
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---


    // ====================================================================
    // Глобальные переменные и вспомогательные функции
    // ====================================================================

    // Кэш для хранения данных материалов и задач
    let materialsCache = null;
    let currentLongreadsId = null;
    let tasksCache = {};

    const API_DELAY_MS = 1000; // Задержка между запросами к API my.centraluniversity.ru

    // Используем console.log для логирования
    const cuLmsLog = console.log;

    /**
     * Создает задержку выполнения кода.
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ====================================================================
    // ФУНКЦИИ ДЛЯ API-ЗАПРОСОВ К СЕРВЕРУ УНИВЕРСИТЕТА
    // (в основном без изменений, взяты из вашего кода)
    // ====================================================================

    async function fetchMaterials(longreadsId) {
        if (materialsCache && currentLongreadsId === longreadsId) {
            cuLmsLog(`[CU] Returning materials from cache for longread ID: ${longreadsId}`);
            return materialsCache;
        }
        cuLmsLog(`[CU] Fetching materials for longread ID: ${longreadsId}`);
        const apiUrl = `https://my.centraluniversity.ru/api/micro-lms/longreads/${longreadsId}/materials?limit=10000`;
        try {
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: { "accept": "application/json, text/plain, */*" },
                mode: "cors",
                credentials: "include"
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            materialsCache = data;
            currentLongreadsId = longreadsId;
            return data;
        } catch (error) {
            cuLmsLog(`[CU] Error fetching longreads materials for ${longreadsId}:`, error);
            return null;
        }
    }

    async function fetchTaskDetails(taskId) {
        if (tasksCache[taskId]) {
            return tasksCache[taskId];
        }
        cuLmsLog(`[CU] Fetching task details for task ID: ${taskId}`);
        const apiUrl = `https://my.centraluniversity.ru/api/micro-lms/tasks/${taskId}`;
        try {
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: { "accept": "application/json, text/plain, */*" },
                mode: "cors",
                credentials: "include"
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            tasksCache[taskId] = data;
            return data;
        } catch (error) {
            cuLmsLog(`[CU] Error fetching task details for ${taskId}:`, error);
            return null;
        }
    }

    async function getDownloadLinkApi(filename, version) {
        const encodedFilename = encodeURIComponent(filename).replace(/\//g, '%2F');
        const apiUrl = `https://my.centraluniversity.ru/api/micro-lms/content/download-link?filename=${encodedFilename}&version=${version}`;
        try {
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: { "accept": "application/json" },
                mode: "cors",
                credentials: "include"
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data ? data.url : null;
        } catch (error) {
            cuLmsLog(`[CU] Error fetching download link for ${filename}:`, error);
            return null;
        }
    }

    async function fetchStudentCourses() {
        cuLmsLog('[CU] Fetching student courses...');
        const apiUrl = 'https://my.centraluniversity.ru/api/micro-lms/courses/student?limit=10000';
        try {
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: { "accept": "application/json" },
                mode: "cors",
                credentials: "include"
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            cuLmsLog(`[CU] Found ${data.items.length} courses.`);
            return data.items;
        } catch (error) {
            cuLmsLog('[CU] Error fetching student courses:', error);
            return [];
        }
    }

    async function fetchCourseOverview(courseId) {
        cuLmsLog(`[CU] Fetching overview for course ID: ${courseId}`);
        const apiUrl = `https://my.centraluniversity.ru/api/micro-lms/courses/${courseId}/overview`;
        try {
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: { "accept": "application/json" },
                mode: "cors",
                credentials: "include"
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            cuLmsLog(`[CU] Error fetching overview for course ${courseId}:`, error);
            return null;
        }
    }

    async function scanLongreadForDownloadLink(longreadId) {
        const materialsData = await fetchMaterials(longreadId);
        if (!materialsData || !materialsData.items) return null;

        for (const item of materialsData.items) {
            let fileToProcess = null;
            if (item.attachments && item.attachments.length > 0) {
                fileToProcess = item.attachments[0]; // Берем первый файл
            } else if (item.discriminator === "file" && item.content) {
                fileToProcess = item.content;
            }

            if (fileToProcess && fileToProcess.filename && fileToProcess.version) {
                cuLmsLog(`[CU] Found file "${fileToProcess.name}". Getting download link...`);
                const url = await getDownloadLinkApi(fileToProcess.filename, fileToProcess.version);
                if (url) return url; // Возвращаем первую найденную ссылку
            }
        }
        return null; // Если не нашли ссылок
    }

    // ====================================================================
    // ФУНКЦИИ ДЛЯ ВЗАИМОДЕЙСТВИЯ С ЛОКАЛЬНЫМ СЕРВЕРОМ
    // ====================================================================

    /**
     * Отправляет структуру курса на локальный сервер и получает список недостающих лонгридов.
     */
    async function getMissingLongreadsFromServer(payload) {
        cuLmsLog('[Local] Sending course structure to localhost:8000/api/fetch/');
        try {
            const response = await fetch('http://localhost:8000/api/fetch/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`Local server returned status: ${response.status}`);
            }
            const data = await response.json();
            cuLmsLog(`[Local] Server responded with ${data.missing_longreads.length} missing longreads.`);
            return data.missing_longreads;
        } catch (error) {
            cuLmsLog('[Local] Error communicating with /api/fetch/. Is the server running?', error);
            return null;
        }
    }

    /**
     * Загружает данные одного лонгрида на локальный сервер.
     */
    async function uploadLongreadData(payload) {
        cuLmsLog(`[Local] Uploading data for longread ID ${payload.longread_id} to localhost:8000/api/upload/`);
        try {
            const response = await fetch('http://localhost:8000/api/upload/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`Local server returned status: ${response.status}`);
            }
            cuLmsLog(`[Local] Successfully uploaded longread ${payload.longread_id}.`);
            return true;
        } catch (error) {
            cuLmsLog(`[Local] Error uploading data for longread ${payload.longread_id}:`, error);
            return false;
        }
    }


    // ====================================================================
    // ОСНОВНАЯ ЛОГИКА
    // ====================================================================

    async function processFirstCourse() {
        cuLmsLog('--- Starting background course processing ---');

        // 1. Узнаем доступные курсы
        const courses = await fetchStudentCourses();
        if (!courses || courses.length === 0) {
            cuLmsLog('No student courses found. Stopping.');
            return;
        }
        const firstCourse = courses[0]; // Берем только первый курс
        cuLmsLog(`Target course: "${firstCourse.name}" (ID: ${firstCourse.id})`);

        // 2. Получаем его темы и лонгриды
        const overview = await fetchCourseOverview(firstCourse.id);
        if (!overview || !overview.themes) {
            cuLmsLog('Could not fetch course overview. Stopping.');
            return;
        }

        // 3. Формируем структуру для отправки на локальный сервер
        // и создаем карту для быстрого доступа к данным по ID лонгрида
        const longreadInfoMap = new Map();
        const payloadForFetch = {
            courses: [{
                course_id: firstCourse.id,
                themes: overview.themes.map(theme => {
                    theme.longreads.forEach(longread => {
                        longreadInfoMap.set(longread.id, {
                            course_title: firstCourse.name,
                            theme_id: theme.id,
                            theme_title: theme.name,
                            longread_title: longread.name,
                        });
                    });
                    return {
                        theme_id: theme.id,
                        longreads: theme.longreads.map(lr => lr.id),
                    };
                }),
            }, ],
        };

        // 4. Отправляем на сервер и получаем список недостающих ID
        const missingIds = await getMissingLongreadsFromServer(payloadForFetch);
        if (!missingIds || missingIds.length === 0) {
            cuLmsLog('Local server has all materials for this course, or an error occurred. Stopping.');
            return;
        }

        // 5. Обрабатываем каждый недостающий лонгрид
        cuLmsLog(`--- Processing ${missingIds.length} missing longreads ---`);
        for (const longreadId of missingIds) {
            const info = longreadInfoMap.get(longreadId);
            if (!info) {
                cuLmsLog(`Warning: Could not find metadata for missing longread ID ${longreadId}. Skipping.`);
                continue;
            }

            // 6. Ищем ссылку на скачивание
            const downloadLink = await scanLongreadForDownloadLink(longreadId);

            if (downloadLink) {
                // 7. Если ссылка найдена, формируем данные и отправляем на локальный сервер
                const uploadPayload = {
                    course_id: firstCourse.id,
                    theme_id: info.theme_id,
                    longread_id: longreadId,
                    download_link: downloadLink,
                    course_title: info.course_title,
                    theme_title: info.theme_title,
                    longread_title: info.longread_title,
                };
                await uploadLongreadData(uploadPayload);
            } else {
                cuLmsLog(`Warning: No download link found for longread "${info.longread_title}" (ID: ${longreadId}). Skipping.`);
            }

            // Задержка между обработкой каждого лонгрида, чтобы не нагружать сервер
            await delay(API_DELAY_MS);
        }

        cuLmsLog('--- Background processing finished ---');
    }

    // ====================================================================
    // ЗАПУСК СКРИПТА
    // ====================================================================
    function initialize() {
        // Проверяем, что мы на нужной странице
        if (window.location.href === 'https://my.centraluniversity.ru/learn/courses/view/actual') {
            cuLmsLog('Course Exporter Plugin: Detected correct page. Starting process in 3 seconds...');
            // Запускаем с задержкой, чтобы дать странице полностью загрузиться
            setTimeout(processFirstCourse, 3000);
        }
    }

    initialize();

})();