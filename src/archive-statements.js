const ARCHIVE_KEY = "cu.lms.archived-statements";
const ALLOWED_PATH = "/learn/reports/student-performance";

(async function () {
    if (window.location.pathname.replace(/\/$/, '') !== ALLOWED_PATH) {
        console.log("[LMS Extension] Skipped: not the main student performance page (path mismatch)");
        return;
    }

    if (!window.cuLmsLog) {
        window.cuLmsLog = console.log;
    }
    window.cuLmsLog("[LMS Extension] Student Performance Enhancer loaded");

    // Хранилище архивированных курсов
    let archivedCourses = new Map();
    let currentView = 'main'; // 'main' или 'archive'
    let isInitialized = false;
    let currentPath = window.location.pathname;
    let currentTheme = null; // Текущая тема (для отслеживания изменений)

    function showLoader() {
        // Ищем контейнер tui-loader
        const loaderContainer = document.querySelector('tui-loader[_ngcontent-ng-c3267422601]');
        if (!loaderContainer) {
            window.cuLmsLog("[LMS Extension] Loader container not found");
            return;
        }

        // Проверяем, не добавлен ли уже loader
        if (loaderContainer.querySelector('.lms-extension-loader')) return;

        const loader = document.createElement('div');
        loader.className = 'lms-extension-loader';
        loader.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--tui-base-01, #fff);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
        `;

        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 48px;
            height: 48px;
            border: 4px solid var(--tui-base-05, #e0e0e0);
            border-top-color: var(--tui-primary, #526ed3);
            border-radius: 50%;
            animation: lms-spin 1s linear infinite;
        `;

        loader.appendChild(spinner);

        // Делаем контейнер относительным
        loaderContainer.style.position = 'relative';
        loaderContainer.appendChild(loader);

        // Добавляем стили для анимации
        if (!document.querySelector('#lms-loader-styles')) {
            const style = document.createElement('style');
            style.id = 'lms-loader-styles';
            style.textContent = `
                @keyframes lms-spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    function hideLoader() {
        const loader = document.querySelector('.lms-extension-loader');
        if (loader) {
            loader.remove();
        }
    }

    async function loadArchivedCourses() {
        try {
            const data = await browser.storage.local.get(ARCHIVE_KEY);
            if (data[ARCHIVE_KEY]) {
                archivedCourses = new Map(Object.entries(data[ARCHIVE_KEY]));
                window.cuLmsLog(`[LMS Extension] Loaded ${archivedCourses.size} archived courses`);
            }
        } catch (error) {
            window.cuLmsLog("[LMS Extension] Failed to load archive:", error);
        }
    }

    async function saveArchivedCourses() {
        try {
            const obj = Object.fromEntries(archivedCourses);

            // Если архив пуст — просто удаляем ключ и выходим
            if (archivedCourses.size === 0) {
                await browser.storage.local.remove(ARCHIVE_KEY);
                window.cuLmsLog("[LMS Extension] Archive cleared completely");
                return;
            }

            // Иначе обновляем значение
            await browser.storage.local.set({ [ARCHIVE_KEY]: obj });
        } catch (error) {
            window.cuLmsLog("[LMS Extension] Failed to save archive:", error);
        }
    }

    function applyArchivedState() {
        const table = document.querySelector("table.cu-table");
        if (!table) return;
        for (const [href] of archivedCourses) {
            const row = table.querySelector(`a[href="${href}"]`)?.closest("tr");
            if (row) row.style.display = "none";
        }
    }

    async function addArchiveButtons() {
        const rows = document.querySelectorAll("tr[tuitr]");
        const themeData = await browser.storage.sync.get("themeEnabled");
        const isDarkTheme = !!themeData.themeEnabled;
        currentTheme = isDarkTheme; // Запоминаем текущую тему

        for (const row of rows) {
            if (row.querySelector(".lms-archive-btn")) continue;

            const cells = row.querySelectorAll("td");
            const firstCell = cells[0];
            const secondCell = cells[1];
            if (!firstCell || !secondCell) continue;

            const link = firstCell.querySelector("a");
            if (!link) continue;

            const courseName = link.textContent.trim();
            const courseHref = link.getAttribute("href");
            const scoreText = secondCell.textContent.trim();

            secondCell.style.position = "relative";

            const archiveButton = document.createElement("button");
            archiveButton.className = "lms-archive-btn";
            archiveButton.style.cssText = `
                position: absolute;
                right: 1rem;
                top: 50%;
                transform: translateY(-50%);
                width: 1.25rem;
                height: 1.25rem;
                padding: 0;
                border: none;
                background: none;
                cursor: pointer;
                line-height: 0;
            `;

            const iconUrl = browser.runtime.getURL("icons/archive.svg");
            const iconSpan = document.createElement("span");
            iconSpan.className = "lms-icon-span"; // Добавляем класс для поиска
            iconSpan.style.cssText = `
                display: inline-block;
                width: 100%;
                height: 100%;
                mask-image: url(${iconUrl});
                -webkit-mask-image: url(${iconUrl});
                mask-size: contain;
                -webkit-mask-size: contain;
                mask-repeat: no-repeat;
                background-color: ${isDarkTheme ? "#FFFFFF" : "#4b5563"};
                transition: background-color 0.2s;
            `;

            archiveButton.appendChild(iconSpan);
            secondCell.appendChild(archiveButton);

            archiveButton.addEventListener("mouseenter", () => {
                iconSpan.style.backgroundColor = "#1f2937";
            });
            archiveButton.addEventListener("mouseleave", () => {
                const theme = currentTheme !== null ? currentTheme : isDarkTheme;
                iconSpan.style.backgroundColor = theme ? "#FFFFFF" : "#4b5563";
            });

            archiveButton.addEventListener("click", async (e) => {
                e.stopPropagation();

                archivedCourses.set(courseHref, {
                    name: courseName,
                    href: courseHref,
                    score: scoreText
                });

                row.style.display = "none";
                await saveArchivedCourses();
                window.cuLmsLog("[LMS Extension] Archived:", courseName);
            });
        }
    }

    function addBreadcrumbNavigation() {
        const breadcrumbs = document.querySelector("tui-breadcrumbs");

        if (!breadcrumbs) {
            window.cuLmsLog("[LMS Extension] ❌ breadcrumbs not found!");
            return;
        }

        const existingArchiveLink = breadcrumbs.querySelector(".archive-link");

        if (existingArchiveLink) {
            window.cuLmsLog("[LMS Extension] ⚠️ Archive link already exists, skipping creation");
            attachStatementLinkHandler();
            return;
        }

        const separator = document.createElement("tui-icon");
        separator.className = "t-icon";
        separator.dataset.icon = "svg";
        separator.style = `
            --t-icon: url(assets/cu/icons/cuIconChevronRight.svg);
            width: 16px;
            height: 16px;
            flex-shrink: 0;
            margin: 0 4px;
        `;

        const archiveLink = document.createElement("a");
        archiveLink.textContent = "Архивированные";
        archiveLink.className = "breadcrumbs__item archive-link";
        archiveLink.setAttribute("tuiappearance", "");
        archiveLink.setAttribute("tuiicons", "");
        archiveLink.setAttribute("tuilink", "");
        archiveLink.dataset.appearance = "action-grayscale";

        breadcrumbs.appendChild(separator);
        breadcrumbs.appendChild(archiveLink);

        const mainFieldset = document.querySelector("fieldset.t-content");
        const archivePlaceholder = document.createElement("div");
        archivePlaceholder.className = "archive-placeholder";
        archivePlaceholder.style.display = "none";

        if (mainFieldset && mainFieldset.parentNode) {
            mainFieldset.parentNode.insertBefore(archivePlaceholder, mainFieldset.nextSibling);
        }

        const activeColor =
            getComputedStyle(document.documentElement)
                .getPropertyValue("--culms-dark-status-neutral")
                .trim() || "#007BFF";

        // Обработчик клика по ссылке "Архивированные"
        archiveLink.addEventListener("click", (e) => {
            e.preventDefault();

            if (currentView === 'archive') {
                return;
            }

            currentView = 'archive';

            if (mainFieldset) {
                mainFieldset.style.display = "none";
            }
            archivePlaceholder.style.display = "block";

            archiveLink.style.color = activeColor;
            archiveLink.classList.add("breadcrumbs__item_last");

            // Убираем активный класс у других элементов
            const allBreadcrumbItems = breadcrumbs.querySelectorAll(".breadcrumbs__item");
            allBreadcrumbItems.forEach(item => {
                if (item !== archiveLink) {
                    item.style.color = "";
                    item.classList.remove("breadcrumbs__item_last");
                }
            });

            renderArchivedTableUI();
        });

        // Добавляем обработчики на кнопку "Ведомость"
        attachStatementLinkHandler();
    }

    // Отдельная функция для отслеживания кликов по "Ведомость"
    function attachStatementLinkHandler() {
        const breadcrumbs = document.querySelector("tui-breadcrumbs");
        if (!breadcrumbs) {
            window.cuLmsLog("[LMS Extension] ❌ breadcrumbs not found in attachStatementLinkHandler");
            return;
        }

        // Находим все ссылки "Ведомость"
        const allLinks = breadcrumbs.querySelectorAll('a[href="/learn/reports/student-performance"]');

        const mainFieldset = document.querySelector("fieldset.t-content");
        const archiveLink = breadcrumbs.querySelector(".archive-link");

        const activeColor =
            getComputedStyle(document.documentElement)
                .getPropertyValue("--culms-dark-status-neutral")
                .trim() || "#007BFF";

        allLinks.forEach((link, index) => {
            // Пропускаем архивную ссылку
            if (link.classList.contains("archive-link")) {
                return;
            }

            // Проверяем, не добавлен ли уже обработчик
            if (link.dataset.lmsHandlerAttached === "true") {
                window.cuLmsLog(`[LMS Extension] ⏭️ Handler already attached to link ${index}`);
                return;
            }

            link.dataset.lmsHandlerAttached = "true";

            // Используем capture phase
            link.addEventListener("click", async (e) => {
                if (currentView === 'main') {
                    return; // Позволяем Angular обработать
                }

                // Перехватываем событие только если в архиве
                window.cuLmsLog("[LMS Extension] 🛑 Preventing default and switching to main view");
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                currentView = 'main';

                // Получаем актуальные элементы
                const currentMainFieldset = document.querySelector("fieldset.t-content");
                const currentArchivePlaceholder = document.querySelector(".archive-placeholder");
                const currentArchiveLink = document.querySelector(".archive-link");

                // Показать основную таблицу, скрыть архив
                if (currentMainFieldset) {
                    currentMainFieldset.style.display = "";
                }

                if (currentArchivePlaceholder) {
                    currentArchivePlaceholder.style.display = "none";
                }

                // Визуальное обновление хлебных крошек
                link.style.color = activeColor;
                link.classList.add("breadcrumbs__item_last");
                if (currentArchiveLink) {
                    currentArchiveLink.style.color = "";
                    currentArchiveLink.classList.remove("breadcrumbs__item_last");
                }

                // Форсируем повторное применение функционала
                await loadArchivedCourses();
                applyArchivedState();
                await addArchiveButtons();

            }, true); // true = capture phase

            window.cuLmsLog(`[LMS Extension] ✅ Handler attached successfully to link ${index}`);
        });
    }

    // =============================
    // 3️⃣ Визуал таблицы архива
    // =============================
    async function renderArchivedTableUI() {
        const archivePlaceholder = document.querySelector(".archive-placeholder");
        if (!archivePlaceholder) return;

        archivePlaceholder.innerHTML = "";

        const themeData = await browser.storage.sync.get("themeEnabled");
        const isDarkTheme = !!themeData.themeEnabled;
        currentTheme = isDarkTheme; // Обновляем текущую тему

        const fieldset = document.createElement("fieldset");
        fieldset.setAttribute("_ngcontent-ng-c37613583", "");
        fieldset.className = "t-content";

        const scrollbar = document.createElement("tui-scrollbar");
        scrollbar.setAttribute("_ngcontent-ng-c3267422601", "");
        scrollbar.className = "scroll-bar _native-hidden";
        scrollbar.setAttribute("_nghost-ng-c2057308684", "");

        const contentWrapper = document.createElement("div");
        contentWrapper.setAttribute("_ngcontent-ng-c2057308684", "");
        contentWrapper.className = "t-content";

        const table = document.createElement("table");
        table.setAttribute("_ngcontent-ng-c3267422601", "");
        table.setAttribute("tuitable", "");
        table.className = "cu-table _stuck";
        table.dataset.size = "m";

        const thead = document.createElement("thead");
        thead.setAttribute("_ngcontent-ng-c3267422601", "");
        thead.innerHTML = `
      <tr _ngcontent-ng-c3267422601="" tuithgroup="">
        <th _ngcontent-ng-c3267422601="" tuith="" class="column-course _sticky" _nghost-ng-c1881890297="">
          Предмет
        </th>
        <th _ngcontent-ng-c3267422601="" tuith="" tuisortable="" class="column-total _sticky" _nghost-ng-c1881890297="">
          <button _ngcontent-ng-c1881890297="" type="button" class="t-sort">
            Итого
            <tui-icon _ngcontent-ng-c1881890297="" class="t-icon" data-icon="svg"
              style="--t-icon: url(assets/cu/icons/cuIconChevronSelectorVertical.svg);
                     width: 16px; height: 16px;">
            </tui-icon>
          </button>
        </th>
      </tr>
    `;

        const tbody = document.createElement("tbody");
        tbody.setAttribute("_ngcontent-ng-c3267422601", "");
        tbody.setAttribute("tuitbody", "");
        tbody.setAttribute("_nghost-ng-c1775097393", "");

        if (archivedCourses.size === 0) {
            tbody.innerHTML = `
        <tr _ngcontent-ng-c3267422601="" tuitr="" style="--t-row-height: 48px;">
          <td _ngcontent-ng-c3267422601="" tuitd="" colspan="2" style="text-align: center; padding: 2rem;">
            Нет архивированных ведомостей
          </td>
        </tr>
      `;
        } else {
            archivedCourses.forEach((course) => {
                const tr = document.createElement("tr");
                tr.setAttribute("_ngcontent-ng-c3267422601", "");
                tr.setAttribute("tuitr", "");
                tr.style = "--t-row-height: 48px;";

                const firstCell = document.createElement("td");
                firstCell.setAttribute("_ngcontent-ng-c3267422601", "");
                firstCell.setAttribute("tuitd", "");
                firstCell.className = "_border-right column-course link-container";
                firstCell.setAttribute("_nghost-ng-c4079261847", "");
                firstCell.innerHTML = `
          <a _ngcontent-ng-c3267422601=""
             tuiappearance=""
             tuiicons=""
             tuilink=""
             data-appearance="action"
             href="${course.href}">
            ${course.name}
          </a>
        `;

                const secondCell = document.createElement("td");
                secondCell.setAttribute("_ngcontent-ng-c3267422601", "");
                secondCell.setAttribute("tuitd", "");
                secondCell.setAttribute("_nghost-ng-c4079261847", "");
                secondCell.style.position = "relative";
                secondCell.textContent = course.score + " ";

                const unarchiveButton = document.createElement("button");
                unarchiveButton.className = "lms-unarchive-btn";
                unarchiveButton.style.cssText = `
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          width: 1.25rem;
          height: 1.25rem;
          padding: 0;
          border: none;
          background: none;
          cursor: pointer;
          line-height: 0;
          z-index: 10;
        `;

                const iconUrl = browser.runtime.getURL("icons/unarchive.svg");
                const iconSpan = document.createElement("span");
                iconSpan.className = "lms-icon-span"; // Добавляем класс для поиска
                iconSpan.style.cssText = `
          display: inline-block;
          width: 100%;
          height: 100%;
          mask-image: url(${iconUrl});
          -webkit-mask-image: url(${iconUrl});
          mask-size: contain;
          -webkit-mask-size: contain;
          mask-repeat: no-repeat;
          background-color: ${isDarkTheme ? "#FFFFFF" : "#4b5563"};
          transition: background-color 0.2s;
          pointer-events: none;
        `;

                unarchiveButton.appendChild(iconSpan);
                secondCell.appendChild(unarchiveButton);

                unarchiveButton.addEventListener("mouseenter", () => {
                    iconSpan.style.backgroundColor = "#1f2937";
                });
                unarchiveButton.addEventListener("mouseleave", () => {
                    const theme = currentTheme !== null ? currentTheme : isDarkTheme;
                    iconSpan.style.backgroundColor = theme ? "#FFFFFF" : "#4b5563";
                });

                unarchiveButton.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    // Удаляем из Map
                    archivedCourses.delete(course.href);

                    // Сохраняем изменения
                    await saveArchivedCourses();

                    // Показываем оригинальную строку
                    const mainTable = document.querySelector("table.cu-table");
                    const originalRow = mainTable?.querySelector(`a[href="${course.href}"]`)?.closest("tr");
                    if (originalRow) {
                        originalRow.style.display = "";
                    }

                    // Перерисовываем таблицу архива
                    await renderArchivedTableUI();
                });

                tr.appendChild(firstCell);
                tr.appendChild(secondCell);
                tbody.appendChild(tr);
            });
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        contentWrapper.appendChild(table);
        scrollbar.appendChild(contentWrapper);
        fieldset.appendChild(scrollbar);
        archivePlaceholder.appendChild(fieldset);
    }

    function cleanup() {
        window.cuLmsLog("[LMS Extension] Cleaning up...");

        // Удаляем архивную ссылку и разделитель
        const breadcrumbs = document.querySelector("tui-breadcrumbs");
        if (breadcrumbs) {
            const archiveLink = breadcrumbs.querySelector(".archive-link");
            if (archiveLink) {
                const separator = archiveLink.previousElementSibling;
                if (separator && separator.tagName === "TUI-ICON") {
                    separator.remove();
                }
                archiveLink.remove();
            }
        }

        // Удаляем placeholder архива
        const archivePlaceholder = document.querySelector(".archive-placeholder");
        if (archivePlaceholder) {
            archivePlaceholder.remove();
        }

        // Удаляем кнопки архивирования
        document.querySelectorAll(".lms-archive-btn").forEach(btn => btn.remove());

        // Удаляем loader если остался
        hideLoader();

        // Сбрасываем состояние
        currentView = 'main';
        isInitialized = false;

        window.cuLmsLog("[LMS Extension] Cleanup complete");
    }

    async function initialize() {
        if (isInitialized) return;

        window.cuLmsLog("[LMS Extension] Starting initialization");

        const tableExists = !!document.querySelector("table.cu-table tr[tuitr]");
        if (!tableExists) {
            showLoader();
        }

        await loadArchivedCourses();

        if (currentView === 'main') {
            applyArchivedState();
            await addArchiveButtons();
            addBreadcrumbNavigation();
        }

        if (!tableExists) {
            hideLoader();
        }

        isInitialized = true;
        window.cuLmsLog("[LMS Extension] Initialization complete");
    }

    function initObserver() {
        const mainContainer = document.body;

        let timeoutId;

        const observer = new MutationObserver(() => {
            // Проверяем, изменился ли путь
            const newPath = window.location.pathname;
            if (newPath !== currentPath) {
                window.cuLmsLog("[LMS Extension] Path changed from", currentPath, "to", newPath);
                currentPath = newPath;

                // Если ушли со страницы ведомостей - очищаем
                if (!newPath.includes('/learn/reports/student-performance')) {
                    cleanup();
                    return;
                }

                // Если вернулись на страницу ведомостей - переинициализируем
                if (newPath.includes('/learn/reports/student-performance')) {
                    window.cuLmsLog("[LMS Extension] Returned to statements page, reinitializing...");
                    cleanup();
                    isInitialized = false;
                }
            }

            const breadcrumbsExist = !!document.querySelector("tui-breadcrumbs");
            if (!breadcrumbsExist && isInitialized) {
                window.cuLmsLog("[LMS Extension] DOM reset detected, reinitializing...");
                cleanup();
            }

            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
                // Проверяем, есть ли таблица на странице
                const table = document.querySelector("tr[tuitr]");
                if (table && !isInitialized) {
                    await initialize();
                } else if (table && isInitialized && currentView === 'main') {
                    // Обновляем кнопки только если мы в основном режиме
                    applyArchivedState();
                    addArchiveButtons();
                    addBreadcrumbNavigation();
                }

            }, 150);
        });

        observer.observe(mainContainer, { childList: true, subtree: true });
    }

    async function waitForAngularRender() {
        const table = document.querySelector("tr[tuitr]");
        if (table) {
            await new Promise(resolve => setTimeout(resolve, 100));
            await initialize();
            initObserver();
        } else {
            setTimeout(waitForAngularRender, 100);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", waitForAngularRender);
    } else {
        waitForAngularRender();
    }

    // Слушаем изменения темы
    browser.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.themeEnabled) {
            const isDarkTheme = !!changes.themeEnabled.newValue;
            currentTheme = isDarkTheme;

            // Обновляем цвет всех иконок
            document.querySelectorAll('.lms-icon-span').forEach(iconSpan => {
                iconSpan.style.backgroundColor = isDarkTheme ? "#FFFFFF" : "#4b5563";
            });

            window.cuLmsLog(`[LMS Extension] Theme changed to ${isDarkTheme ? 'dark' : 'light'}, icons updated`);
        }
    });
})();