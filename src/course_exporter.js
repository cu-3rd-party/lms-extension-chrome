// currently disabled; 
// course-exporter.js

// Весь код обернут в Немедленно Вызываемую Функциональную Экспрессию (IIFE)
// для создания локальной области видимости и предотвращения конфликтов переменных
(() => {
    // ====================================================================
    // Глобальные переменные и вспомогательные функции
    // ====================================================================

    // Кэш для хранения данных материалов и задач, теперь в локальной области видимости
    let materialsCache = null;
    let currentLongreadsId = null;
    let tasksCache = {};

    const COURSE_SCAN_DELAY_MS = 1000; // Задержка между запросами (в мс)

    // Mock-функция лога, чтобы избежать ошибок, если она не определена
    if (!window.cuLmsLog) {
        window.cuLmsLog = console.log;
    }

    /**
     * Создает задержку выполнения кода.
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ====================================================================
    // ФУНКЦИИ ДЛЯ API-ЗАПРОСОВ (из вашего оригинального кода)
    // ====================================================================

    async function fetchMaterials(longreadsId) {
        if (materialsCache && currentLongreadsId === longreadsId) {
            window.cuLmsLog('Returning materials from cache for longreads ID:', longreadsId);
            return materialsCache;
        }

        window.cuLmsLog(`Fetching materials for longreads ID: ${longreadsId}`);
        const apiUrl = `https://my.centraluniversity.ru/api/micro-lms/longreads/${longreadsId}/materials?limit=10000`;

        try {
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "accept": "application/json, text/plain, */*"
                },
                mode: "cors",
                credentials: "include"
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.cuLmsLog('Unauthorized: Please ensure you are logged in. Authorization likely failed due to missing or invalid cookies.');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            window.cuLmsLog('Successfully fetched materials:', data);
            materialsCache = data;
            currentLongreadsId = longreadsId;
            return data;

        } catch (error) {
            window.cuLmsLog('Error fetching longreads materials:', error);
            return null;
        }
    }

    async function fetchTaskDetails(taskId) {
        if (!taskId) {
            window.cuLmsLog('fetchTaskDetails received null or undefined taskId.');
            return null;
        }
        if (tasksCache[taskId]) {
            // Закомментируем, чтобы избежать ненужного логирования при активном сканировании
            // window.cuLmsLog('Returning task details from cache for task ID:', taskId); 
            return tasksCache[taskId];
        }

        window.cuLmsLog(`Fetching task details for task ID: ${taskId}`);
        const apiUrl = `https://my.centraluniversity.ru/api/micro-lms/tasks/${taskId}`;

        try {
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "accept": "application/json, text/plain, */*"
                },
                mode: "cors",
                credentials: "include"
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.cuLmsLog('Unauthorized: Please ensure you are logged in. Authorization likely failed due to missing or invalid cookies.');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            window.cuLmsLog('Successfully fetched task details:', data);
            tasksCache[taskId] = data;
            return data;
        } catch (error) {
            window.cuLmsLog('Error fetching task details:', error);
            return null;
        }
    }

    /**
     * Получает финальную ссылку на скачивание файла.
     * Мы не используем оригинальную getDownloadUrl, так как она полагается на DOM,
     * а здесь мы работаем с чистыми данными API.
     * Эта функция переопределена, чтобы работать напрямую с filename и version.
     */
    async function getDownloadLinkApi(filename, version) {
        const encodedFilenameForDownloadLink = encodeURIComponent(filename)
            .replace(/\//g, '%2F');

        const downloadLinkApiUrl = `https://my.centraluniversity.ru/api/micro-lms/content/download-link?filename=${encodedFilenameForDownloadLink}&version=${version}`;

        try {
            const response = await fetch(downloadLinkApiUrl, {
                method: "GET",
                headers: { "accept": "application/json" },
                mode: "cors",
                credentials: "include"
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.cuLmsLog('Unauthorized: Please ensure you are logged in.');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data ? data.url : null;

        } catch (error) {
            window.cuLmsLog(`Error fetching download link for ${filename}:`, error);
            return null;
        }
    }

    // ====================================================================
    // ОСНОВНАЯ ЛОГИКА ЭКСПОРТА
    // ====================================================================

    /**
     * 1. Получает список всех курсов студента.
     */
    async function fetchStudentCourses() {
        const apiUrl = 'https://my.centraluniversity.ru/api/micro-lms/courses/student?limit=10000';
        try {
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: { "accept": "application/json" },
                mode: "cors",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            window.cuLmsLog(`Successfully fetched ${data.items.length} student courses.`);
            return data.items.map(course => ({
                id: course.id,
                name: course.name,
                isArchived: course.isArchived,
                themes: []
            }));
        } catch (error) {
            window.cuLmsLog('Error fetching student courses:', error);
            return [];
        }
    }

    /**
     * 2. Получает обзор курса (темы и longreads).
     */
    async function fetchCourseOverview(courseId) {
        const apiUrl = `https://my.centraluniversity.ru/api/micro-lms/courses/${courseId}/overview`;
        try {
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: { "accept": "application/json" },
                mode: "cors",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.themes.map(theme => ({
                id: theme.id,
                name: theme.name,
                longreads: theme.longreads.map(longread => ({
                    id: longread.id,
                    name: longread.name,
                    downloadUrls: []
                }))
            }));
        } catch (error) {
            window.cuLmsLog(`Error fetching overview for course ${courseId}:`, error);
            return [];
        }
    }

    /**
     * 3 & 4. Сканирует лонгрид, получает материалы и генерирует ссылки на скачивание.
     */
    async function scanLongreadMaterials(longreadId) {
        const downloadUrls = [];
        const materialsData = await fetchMaterials(longreadId);

        if (!materialsData || !materialsData.items) {
            window.cuLmsLog(`No materials data for longread ${longreadId}.`);
            return downloadUrls;
        }

        window.cuLmsLog(`--> Processing ${materialsData.items.length} materials...`);

        for (const item of materialsData.items) {
            const filesToProcess = [];

            // Case 1 & 2: Файлы в item.attachments или item.content (для типа 'file')
            if (item.attachments && item.attachments.length > 0) {
                filesToProcess.push(...item.attachments);
            }
            if (item.discriminator === "file" && item.content) {
                filesToProcess.push(item.content);
            } else if (item.discriminator === "file" && item.filename && item.version) {
                filesToProcess.push({ name: item.filename, filename: item.filename, version: item.version });
            }

            // Case 3: Файлы в student's solution (через Task API)
            if (item.taskId || (item.task && item.task.id)) {
                const taskId = item.taskId || item.task.id;

                // Делаем таймаут перед запросом деталей таска
                await delay(COURSE_SCAN_DELAY_MS);

                const taskDetails = await fetchTaskDetails(taskId);

                if (taskDetails && taskDetails.solution && taskDetails.solution.attachments && taskDetails.solution.attachments.length > 0) {
                    filesToProcess.push(...taskDetails.solution.attachments);
                }
            }

            // Получаем ссылку для каждого найденного файла
            for (const file of filesToProcess) {
                if (!file.filename || !file.version || !file.name) continue;

                window.cuLmsLog(`---> Getting download link for file: ${file.name}`);

                const url = await getDownloadLinkApi(file.filename, file.version);
                if (url) {
                    downloadUrls.push({
                        fileName: file.name,
                        fullDownloadLink: url
                    });
                }
            }

            await delay(COURSE_SCAN_DELAY_MS); // Задержка после обработки каждого материала
        }

        return downloadUrls;
    }

    /**
     * Основная функция для запуска экспорта курсов.
     */
    async function exportCourseData(processAll = false) {
        if (window.location.pathname !== '/learn/courses/view/actual') {
            window.cuLmsLog('Course export runs only on /learn/courses/view/actual page.');
            return;
        }

        window.cuLmsLog('Starting course data export...');

        // 1. Получаем список курсов
        let studentCourses = await fetchStudentCourses();
        if (studentCourses.length === 0) {
            window.cuLmsLog('No courses found or failed to fetch initial course list.');
            return;
        }

        const coursesToProcess = processAll ? studentCourses : studentCourses.slice(0, 2);
        const results = [];

        window.cuLmsLog(`Processing ${coursesToProcess.length} courses... (processAll: ${processAll})`);

        // 2. Итерируемся по курсам
        for (const course of coursesToProcess) {
            window.cuLmsLog(`\n✅ Processing course: ${course.name} (ID: ${course.id})`);

            // Запрос обзора курса
            const themes = await fetchCourseOverview(course.id);
            await delay(COURSE_SCAN_DELAY_MS * 3);

            // 3 & 4. Итерируемся по темам и лонгридам
            for (const theme of themes) {
                for (const longread of theme.longreads) {
                    window.cuLmsLog(`\n---> Processing longread: ${longread.name} (ID: ${longread.id})`);

                    // Сканирование материалов и получение ссылок
                    longread.downloadUrls = await scanLongreadMaterials(longread.id);
                    await delay(COURSE_SCAN_DELAY_MS * 2); // Дополнительная задержка после лонгрида
                }
            }

            results.push({
                id: course.id,
                name: course.name,
                isArchived: course.isArchived,
                themes: themes
            });

            window.cuLmsLog(`\nFinished processing course: ${course.name}`);
            await delay(COURSE_SCAN_DELAY_MS * 5); // Большая задержка между курсами
        }

        // 5. Вывод результатов в консоль
        window.cuLmsLog('====================================================');
        window.cuLmsLog('🚀 ALL COURSE DATA EXPORTED SUCCESSFULLY:');
        window.cuLmsLog(JSON.stringify(results, null, 2));
        window.cuLmsLog('====================================================');
    }


    // ====================================================================
    // ЗАПУСК СКРИПТА
    // ====================================================================

    function initializeCourseExporter() {
        const isExporterEnabled = localStorage.getItem('cuLmsExporterEnabled') === 'true';

        // ИЗМЕНИТЕ ЗДЕСЬ, ЧТОБЫ СКАНДРОВАТЬ ВСЕ КУРСЫ:
        const processAllCourses = false;

        if (isExporterEnabled) {
            window.cuLmsLog('Course Exporter is ENABLED in localStorage. Starting scan...');
            // Запускаем экспорт с таймаутом, чтобы дать странице полностью загрузиться
            setTimeout(() => exportCourseData(processAllCourses), 1000);
        } else {
            window.cuLmsLog('Course Exporter is DISABLED in localStorage. Skipping scan.');
        }
    }

    // Запускаем инициализацию при загрузке DOM
    initializeCourseExporter();

})();