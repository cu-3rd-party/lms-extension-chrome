// Кэш для хранения данных материалов, чтобы не делать повторные запросы к API
let materialsCache = null;
let currentLongreadsId = null;
// Новый кэш для хранения данных по задачам, чтобы не делать повторные запросы
let tasksCache = {};

async function fetchMaterials(longreadsId) {
    if (materialsCache && currentLongreadsId === longreadsId) {
        console.log('Returning materials from cache for longreads ID:', longreadsId);
        return materialsCache;
    }

    console.log(`Fetching materials for longreads ID: ${longreadsId}`);
    const apiUrl = `https://my.centraluniversity.ru/api/micro-lms/longreads/${longreadsId}/materials?limit=10000`;

    try {
        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "accept": "application/json, text/plain, */*"
            },
            mode: "cors",
            credentials: "include" // Явно указываем включать куки
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.error('Unauthorized: Please ensure you are logged in. Authorization likely failed due to missing or invalid cookies.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Successfully fetched materials:', data);
        materialsCache = data;
        currentLongreadsId = longreadsId;
        return data;

    } catch (error) {
        console.error('Error fetching longreads materials:', error);
        return null;
    }
}

async function fetchTaskDetails(taskId) {
    if (!taskId) {
        console.error('fetchTaskDetails received null or undefined taskId.');
        return null;
    }
    if (tasksCache[taskId]) {
        console.log('Returning task details from cache for task ID:', taskId);
        return tasksCache[taskId];
    }

    console.log(`Fetching task details for task ID: ${taskId}`);
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
                console.error('Unauthorized: Please ensure you are logged in. Authorization likely failed due to missing or invalid cookies.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Successfully fetched task details:', data);
        tasksCache[taskId] = data;
        return data;
    } catch (error) {
        console.error('Error fetching task details:', error);
        return null;
    }
}


async function getDownloadUrl(fileElement, materialsData) {
    const fileNameDiv = fileElement.querySelector('.t-name');
    const fileTypeDiv = fileElement.querySelector('.t-type');

    if (!fileNameDiv || !fileTypeDiv) {
        console.error('Could not find file name or type elements for file element:', fileElement);
        return null;
    }

    const displayedFileName = fileNameDiv.textContent.trim();
    const fileExtension = fileTypeDiv.textContent.trim();
    const fullDisplayedFileNameWithExt = displayedFileName + fileExtension;
    console.log('Attempting to find download URL for displayed file:', fullDisplayedFileNameWithExt);

    let foundFilename = null;
    let foundVersion = null;

    for (const item of materialsData.items) {
        // Case 1: File is in item.attachments (e.g., HW files provided by instructor)
        if (item.attachments && item.attachments.length > 0) {
            for (const attachment of item.attachments) {
                if (attachment.name === fullDisplayedFileNameWithExt) {
                    foundFilename = attachment.filename;
                    foundVersion = attachment.version;
                    console.log('Found file in item.attachments (Case 1).');
                    break;
                }
            }
        }
        if (foundFilename) break;

        // Case 2: File is directly in item.content (e.g., standalone file materials)
        if (item.discriminator === "file" && item.content && item.content.name === fullDisplayedFileNameWithExt) {
            foundFilename = item.content.filename;
            foundVersion = item.content.version;
            console.log('Found file in item.content (Case 2a).');
            break;
        } else if (item.discriminator === "file" && item.filename === fullDisplayedFileNameWithExt) {
             // Fallback for cases where 'name' might not be in content, but 'filename' is root
            foundFilename = item.filename;
            foundVersion = item.version;
            console.log('Found file in item.filename (Case 2b).');
            break;
        }
        if (foundFilename) break;

        // Case 3: File is an attachment of a student's solution to a task.
        // We need to find the taskId from the materials item itself.
        if (item.taskId || (item.task && item.task.id)) {
            const taskId = item.taskId || item.task.id;
            console.log(`Checking task item with derived taskId: ${taskId} for solution attachment.`);
            
            const taskDetails = await fetchTaskDetails(taskId);
            if (taskDetails && taskDetails.solution && taskDetails.solution.attachments && taskDetails.solution.attachments.length > 0) {
                for (const attachment of taskDetails.solution.attachments) {
                    if (attachment.name === fullDisplayedFileNameWithExt) {
                        foundFilename = attachment.filename;
                        foundVersion = attachment.version;
                        console.log('Found file in task solution attachments (Case 3).');
                        break;
                    }
                }
            } else if (taskDetails && !taskDetails.solution) {
                console.log(`Task ${taskId} details found, but no 'solution' object.`);
            } else if (taskDetails && taskDetails.solution && (!taskDetails.solution.attachments || taskDetails.solution.attachments.length === 0)) {
                console.log(`Task ${taskId} solution found, but no attachments.`);
            }
        }
        if (foundFilename) break;
    }

    if (!foundFilename || !foundVersion) {
        console.error('Could not find corresponding attachment data for:', fullDisplayedFileNameWithExt);
        return null;
    }

    const encodedFilenameForDownloadLink = encodeURIComponent(foundFilename)
                                              .replace(/\//g, '%2F'); // Заменяем слеши, если они есть

    const downloadLinkApiUrl = `https://my.centraluniversity.ru/api/micro-lms/content/download-link?filename=${encodedFilenameForDownloadLink}&version=${foundVersion}`;
    console.log('Fetching API URL for download link:', downloadLinkApiUrl);

    try {
        const response = await fetch(downloadLinkApiUrl, {
            method: "GET",
            headers: {
                "accept": "application/json, text/plain, */*"
            },
            mode: "cors",
            credentials: "include"
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.error('Unauthorized: Please ensure you are logged in. Authorization likely failed due to missing or invalid cookies.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response for download link:', data);

        return data ? data.url : null;

    } catch (error) {
        console.error('Error fetching download link:', error);
        return null;
    }
}

async function overrideDownloadButtons() {
    const pathSegments = window.location.pathname.split('/');
    let longreadsId = '';
    for (let i = 0; i < pathSegments.length; i++) {
        if (pathSegments[i] === 'longreads' && i + 1 < pathSegments.length) {
            longreadsId = pathSegments[i + 1];
            break;
        }
    }
    if (!longreadsId) {
        console.error('Could not dynamically extract longreads ID from URL. Cannot proceed with fetching materials.');
        return;
    }

    const materialsData = await fetchMaterials(longreadsId);
    if (!materialsData || !materialsData.items || materialsData.items.length === 0) {
        console.warn('No materials data found for this longreads ID or failed to fetch.');
        return;
    }

    const fileContainers = document.querySelectorAll('a.file');
    const unprocessedFileContainers = Array.from(fileContainers).filter(container => !container.dataset.hasListenerForOpen);

    if (unprocessedFileContainers.length > 0) {
        console.log(`Processing ${unprocessedFileContainers.length} new file containers.`);
        unprocessedFileContainers.forEach(container => {
            // Добавляем обработчик на фазе захвата, чтобы он сработал до других обработчиков
            // и имел возможность предотвратить дефолтное действие
            container.addEventListener('click', async (event) => {
                // Проверяем, был ли клик по кнопке с классом file-download или tuiiconbutton (которая является кнопкой скачивания)
                const isDownloadButton = event.target.closest('button.file-download, button[tuiiconbutton]');

                if (isDownloadButton) {
                    // Если это кнопка "Скачать", мы не вмешиваемся
                    console.log('Click on a download button detected within file container. Allowing native button behavior.');
                    return;
                }

                // Для всех остальных кликов внутри a.file:
                // 1. Предотвращаем дефолтное действие (переход по ссылке, скачивание)
                event.preventDefault();
                // 2. Останавливаем распространение события, чтобы оно не достигло других обработчиков выше
                event.stopPropagation();
                
                console.log('File container clicked (excluding download button), attempting to open in new tab...');

                const url = await getDownloadUrl(container, materialsData);
                if (url) {
                    chrome.runtime.sendMessage({ action: "openNewTab", url: url }, function(response) {
                        if (chrome.runtime.lastError) {
                            console.error('Error sending message to background.js:', chrome.runtime.lastError.message);
                            return;
                        }
                    });
                    console.log('Opened new tab with URL:', url);
                } else {
                    console.error('Failed to get download URL for opening in new tab.');
                }
            }, { capture: true }); // Важно: { capture: true }

            container.dataset.hasListenerForOpen = 'true';
        });
    }
}

overrideDownloadButtons();

const observer = new MutationObserver((mutationsList, observer) => {
    let relevantChangeDetected = false;
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.matches('a.file') ||
                        node.querySelector('a.file') ||
                        node.matches('cu-uploaded-files-list') ||
                        node.querySelector('cu-uploaded-files-list')) {
                        relevantChangeDetected = true;
                        break;
                    }
                }
            }
        }
        if (relevantChangeDetected) break;
    }

    if (relevantChangeDetected) {
        console.log('DOM changed: potential file container added. Re-running override.');
        setTimeout(overrideDownloadButtons, 50);
    }
});

observer.observe(document.body, { childList: true, subtree: true });