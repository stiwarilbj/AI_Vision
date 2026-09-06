(function() {
    // Secrets and Gemini requests stay in the service worker. The panel only
    // receives a boolean and a masked key suffix for settings display.
    let hasApiKey = false;
    let apiKeyMasked = "";
    const DEFAULT_MODEL = "gemini-3.5-flash";
    const DEFAULT_MODE = "capture";
    const DEFAULT_RESPONSE_STYLE = "balanced";
    const STORE_URL = "https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk?authuser=0&hl=en";
    const GITHUB_URL = "https://github.com/stiwarilbj/AI_Vision";
    const launchOptions = (() => {
        const value = globalThis.__aiVisionLaunchOptions;
        try { delete globalThis.__aiVisionLaunchOptions; } catch (_) { globalThis.__aiVisionLaunchOptions = null; }
        return value && typeof value === 'object' ? value : {};
    })();
    let selectedModel = DEFAULT_MODEL;
    let responseTemperature = 1;
    let selectedMode = DEFAULT_MODE;
    let selectedResponseStyle = DEFAULT_RESPONSE_STYLE;
    let isAgentModeEnabled = false;
    let availableModels = [];
    let keyConnectionState = 'unknown';

    const MODES = [
        { value: "capture", label: "Screenshot" },
        { value: "tab", label: "This page" },
        { value: "all-tabs", label: "Compare tabs" }
    ];

    const QUICK_ACTIONS = {
        capture: [
            { text: 'Summarize', icon: 'list', query: 'Summarize the captured content.' },
            { text: 'Explain', icon: 'explain', query: 'Explain the captured content and what it means.' },
            { text: 'Copy text', icon: 'copy', query: 'Extract the visible text accurately and preserve its reading order.' }
        ],
        tab: [
            { text: 'Summarize', icon: 'list', query: 'Summarize this page with the key points.' },
            { text: 'Key points', icon: 'explain', query: 'Give me the most important points from this page as a scannable list.' },
            { text: 'Next steps', icon: 'answer', query: 'Turn this page into practical next steps or a checklist.' }
        ],
        'all-tabs': [
            { text: 'Compare', icon: 'list', query: 'Compare the relevant tabs and highlight the important differences.' },
            { text: 'Find themes', icon: 'explain', query: 'Find the common themes, agreements, and contradictions across these tabs.' },
            { text: 'Make brief', icon: 'answer', query: 'Create one concise brief from the useful information across these tabs.' }
        ]
    };

    const RESPONSE_STYLES = [
        { value: "balanced", label: "Balanced" },
        { value: "concise", label: "Concise" },
        { value: "formal", label: "Formal" },
        { value: "casual", label: "Casual" },
        { value: "detailed", label: "Detailed" },
        { value: "bullets", label: "Bullet-oriented" }
    ];

    function apiKeyStatusLabel() {
        if (!hasApiKey) return 'Not set yet';
        if (keyConnectionState === 'connected') return 'Connected';
        if (keyConnectionState === 'saved') return 'Saved on this device';
        return 'Saved locally';
    }

    // Compatibility copy retained for the extension architecture check:
    // Only setup: paste a key and press Save key.

    let uiHost = null;
    let uiShadowRoot = null;

    function uiQuery(selector) {
        return uiShadowRoot ? uiShadowRoot.querySelector(selector) : null;
    }

    function uiQueryAll(selector) {
        return uiShadowRoot ? Array.from(uiShadowRoot.querySelectorAll(selector)) : [];
    }

    function ensureUiRoot() {
        if (uiShadowRoot && uiHost && uiHost.isConnected) return uiShadowRoot;
        const oldHost = document.getElementById('ai-vision-host');
        const oldTaskId = oldHost?.dataset?.agentTaskId;
        const oldRequestId = oldHost?.dataset?.requestId;
        if (oldTaskId) void chrome.runtime.sendMessage({ action: 'cancelAgentTask', taskId: oldTaskId }).catch(() => {});
        if (oldRequestId) void chrome.runtime.sendMessage({ action: 'cancelGeminiRequest', requestId: oldRequestId }).catch(() => {});
        if (oldHost) oldHost.remove();
        uiHost = document.createElement('div');
        uiHost.id = 'ai-vision-host';
        uiHost.setAttribute('aria-label', 'AI Vision extension interface');
        uiHost.style.position = 'fixed';
        uiHost.style.inset = '0';
        uiHost.style.zIndex = '2147483647';
        uiHost.style.pointerEvents = 'none';
        uiShadowRoot = uiHost.attachShadow({ mode: 'closed' });
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = chrome.runtime.getURL
            ? chrome.runtime.getURL('src/content/assistant-panel.css')
            : 'assistant-panel.css';
        uiShadowRoot.appendChild(stylesheet);
        document.documentElement.appendChild(uiHost);
        return uiShadowRoot;
    }

    async function sendWorkerMessage(request) {
        const response = await chrome.runtime.sendMessage(request);
        if (response?.error) throw new Error(response.error);
        return response;
    }

    // Persisted settings. The API key is only sent when the user presses Save.
    // The active mode and Agent toggle are intentionally session-only so a new
    // panel always opens in the safe, screenshot-first Capture workspace.
    async function saveSettings(extra = {}) {
        const response = await sendWorkerMessage({
            action: 'saveSettings',
            ...extra,
            geminiModel: selectedModel,
            geminiTemperature: responseTemperature,
            geminiResponseStyle: selectedResponseStyle
        });
        if (response) {
            hasApiKey = response.hasApiKey === true;
            apiKeyMasked = response.apiKeyMasked || '';
            keyConnectionState = hasApiKey ? 'saved' : 'missing';
        }
        return response;
    }

    async function loadSettings() {
        const result = await sendWorkerMessage({ action: 'getSettings' });
        selectedModel = typeof result?.geminiModel === 'string' && result.geminiModel
            ? result.geminiModel
            : DEFAULT_MODEL;
        responseTemperature = validateTemperature(result?.geminiTemperature)
            ? Number(result.geminiTemperature)
            : 1;
        // Ignore stored mode/Agent values on a fresh launch. Explicit launch
        // options (used by context-menu shortcuts) are applied after loading.
        selectedMode = DEFAULT_MODE;
        selectedResponseStyle = RESPONSE_STYLES.some((style) => style.value === result?.geminiResponseStyle)
            ? result.geminiResponseStyle
            : DEFAULT_RESPONSE_STYLE;
        isAgentModeEnabled = false;
        hasApiKey = result?.hasApiKey === true;
        apiKeyMasked = result?.apiKeyMasked || '';
        keyConnectionState = hasApiKey ? 'saved' : 'missing';
        availableModels = [selectedModel];
    }

    async function refreshAvailableModels() {
        try {
            const modelResult = await sendWorkerMessage({ action: 'getAvailableModels' });
            if (Array.isArray(modelResult?.models)) availableModels = modelResult.models;
            if (hasApiKey) keyConnectionState = 'connected';
        } catch (_) {
            if (hasApiKey) keyConnectionState = 'saved';
            return availableModels;
        }
        if (availableModels.length && !availableModels.includes(selectedModel)) selectedModel = availableModels[0];
        if (!availableModels.length) availableModels = [selectedModel];
        return availableModels;
    }

    // Gemini request configuration
    function validateTemperature(value) {
        const temp = parseFloat(value);
        if (isNaN(temp) || temp < 0 || temp > 2) {
            return false;
        }
        return true;
    }

    function stripLightMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/`/g, '');
    }

    // Packaged UI primitives
    function iconSvg(name) {
        const icons = {
            vision: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle>',
            help: '<circle cx="12" cy="12" r="9"></circle><path d="M9.6 9a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1.3.9-1.3 1.6v.3"></path><path d="M12 17h.01"></path>',
            settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"></path><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path>',
            close: '<path d="m7 7 10 10M17 7 7 17"></path>',
            arrowLeft: '<path d="m15 18-6-6 6-6"></path><path d="M9 12h11"></path>',
            send: '<path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path>',
            capture: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"></path><path d="M12 8v8M8 12h8"></path>',
            tab: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 9h18"></path>',
            tabs: '<rect x="7" y="3" width="14" height="14" rx="2"></rect><path d="M17 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2"></path>',
            agent: '<rect x="5" y="7" width="14" height="11" rx="3"></rect><path d="M9 11h.01M15 11h.01M9 15h6M12 7V4M9 4h6M2 11v3M22 11v3"></path>',
            list: '<path d="M9 6h11M9 12h11M9 18h11"></path><path d="M4 6h.01M4 12h.01M4 18h.01"></path>',
            explain: '<circle cx="12" cy="12" r="9"></circle><path d="M9.6 9a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1.3.9-1.3 1.6v.3"></path><path d="M12 17h.01"></path>',
            answer: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4A8 8 0 1 1 21 12Z"></path>',
            eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.5"></circle>',
            eyeOff: '<path d="m3 3 18 18"></path><path d="M10.6 6.2A10.6 10.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16.4 16.4 0 0 1-2.1 2.8M6.3 6.3C3.9 8 2.5 12 2.5 12s3.5 6 9.5 6c1 0 2-.2 2.8-.5"></path>',
            external: '<path d="M15 3h6v6M21 3l-9 9"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>',
            spark: '<path d="m12 3 1.3 4.2L17.5 9l-4.2 1.8L12 15l-1.3-4.2L6.5 9l4.2-1.8Z"></path><path d="m18.5 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7Z"></path>',
            star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"></path>',
            code: '<path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 6l-4 12"></path>',
            key: '<circle cx="8" cy="15" r="4"></circle><path d="m11 12 8-8M16 7l2 2M14 9l2 2"></path>',
            copy: '<rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"></path>',
            retry: '<path d="M20 11a8 8 0 1 0-2.3 5.7"></path><path d="M20 5v6h-6"></path>'
        };
        return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name] || ''}</svg>`;
    }

    // Remove a previous panel instance before opening a fresh one.
    try {
        if (window.geminiExtensionGlobalDragPointerMove) {
            document.removeEventListener('pointermove', window.geminiExtensionGlobalDragPointerMove);
            window.geminiExtensionGlobalDragPointerMove = null;
        }
        if (window.geminiExtensionGlobalDragPointerUp) {
            document.removeEventListener('pointerup', window.geminiExtensionGlobalDragPointerUp);
            document.removeEventListener('pointercancel', window.geminiExtensionGlobalDragPointerUp);
            window.geminiExtensionGlobalDragPointerUp = null;
        }
        if (window.geminiExtensionGlobalDragMouseMove) {
            document.removeEventListener('mousemove', window.geminiExtensionGlobalDragMouseMove);
            window.geminiExtensionGlobalDragMouseMove = null;
        }
        if (window.geminiExtensionGlobalDragMouseUp) {
            document.removeEventListener('mouseup', window.geminiExtensionGlobalDragMouseUp);
            window.geminiExtensionGlobalDragMouseUp = null;
        }
        if (window.geminiExtensionRuntimeMessageListener) {
            chrome.runtime.onMessage.removeListener(window.geminiExtensionRuntimeMessageListener);
            window.geminiExtensionRuntimeMessageListener = null;
        }
        if (window.geminiExtensionKeydownListener) {
            document.removeEventListener('keydown', window.geminiExtensionKeydownListener);
            window.geminiExtensionKeydownListener = null;
        }

        const oldHost = document.getElementById('ai-vision-host');
        const oldTaskId = oldHost?.dataset?.agentTaskId;
        const oldRequestId = oldHost?.dataset?.requestId;
        if (oldTaskId) void chrome.runtime.sendMessage({ action: 'cancelAgentTask', taskId: oldTaskId }).catch(() => {});
        if (oldRequestId) void chrome.runtime.sendMessage({ action: 'cancelGeminiRequest', requestId: oldRequestId }).catch(() => {});
        if (oldHost) oldHost.remove();
        uiHost = null;
        uiShadowRoot = null;

        let overlay, selectionRectDiv, startX, startY, isSelecting = false;
        let capturePopupDisplay = null;
        let capturedImageData = null;
        let popup, queryInput, responseArea, sendButton;
        let activeAgentTaskId = null;
        let activeRequestId = null;
        let conversationHistory = [];
        let lastRequestHistory = [];
        let lastSubmittedQuery = '';
        let lastResponseText = '';
        let panelGeneration = 0;
        let refreshModeControls = () => {};

        function resetConversation() {
            conversationHistory = [];
            lastRequestHistory = [];
            lastSubmittedQuery = '';
            lastResponseText = '';
        }

        // Capture selection
        function startCaptureSelection() {
            ensureUiRoot();
            if (popup) {
                capturePopupDisplay = popup.style.display;
                popup.style.display = 'none';
            }
            overlay = document.createElement('div');
            overlay.id = 'gemini-screenshot-overlay';
            selectionRectDiv = document.createElement('div');
            selectionRectDiv.id = 'gemini-selection-rectangle';
            selectionRectDiv.style.display = 'none';
            overlay.appendChild(selectionRectDiv);
            overlay.addEventListener('pointerdown', handlePointerDown);
            overlay.addEventListener('pointermove', handlePointerMove);
            overlay.addEventListener('pointerup', handlePointerUp);
            overlay.addEventListener('pointercancel', cancelSelection);

            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.zIndex = '2147483647';
            overlay.style.backgroundColor = 'rgba(0, 100, 200, 0.1)';
            overlay.style.cursor = 'crosshair';
            overlay.style.touchAction = 'none';
            overlay.style.pointerEvents = 'auto';
            uiShadowRoot.appendChild(overlay);
        }

        function handlePointerDown(e) {
            if (e.button !== 0) return;
            startX = e.clientX;
            startY = e.clientY;
            selectionRectDiv.style.left = startX + 'px';
            selectionRectDiv.style.top = startY + 'px';
            selectionRectDiv.style.width = '0px';
            selectionRectDiv.style.height = '0px';
            selectionRectDiv.style.display = 'block';
            isSelecting = true;
            overlay.setPointerCapture?.(e.pointerId);
            e.preventDefault();
        }

        function handlePointerMove(e) {
            if (!isSelecting) return;
            const currentX = e.clientX;
            const currentY = e.clientY;
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            const newX = Math.min(startX, currentX);
            const newY = Math.min(startY, currentY);
            selectionRectDiv.style.left = newX + 'px';
            selectionRectDiv.style.top = newY + 'px';
            selectionRectDiv.style.width = width + 'px';
            selectionRectDiv.style.height = height + 'px';
            e.preventDefault();
        }

        async function handlePointerUp(e) {
            if (!isSelecting) return;
            isSelecting = false;
            const rect = {
                x: parseInt(selectionRectDiv.style.left),
                y: parseInt(selectionRectDiv.style.top),
                width: parseInt(selectionRectDiv.style.width),
                height: parseInt(selectionRectDiv.style.height)
            };
            if (overlay) overlay.style.display = 'none';

            if (rect.width <= 5 || rect.height <= 5) {
                restorePanelAfterCapture();
                return;
            }

            try {
                const dataUrl = await chrome.runtime.sendMessage({
                    action: "captureVisibleTab",
                    options: { format: "jpeg", quality: 90 }
                });
                if (dataUrl && typeof dataUrl === 'object' && dataUrl.error) {
                    restorePanelAfterCapture(`Failed to capture screen: ${dataUrl.error}`);
                } else if (dataUrl && typeof dataUrl === 'string') {
                    cropCapturedImage(dataUrl, rect.x, rect.y, rect.width, rect.height, (croppedDataUrl) => {
                        if (croppedDataUrl) {
                            capturedImageData = croppedDataUrl.split(',')[1];
                            removeCaptureSelection();
                            openAssistantPanel();
                        } else {
                            restorePanelAfterCapture("Failed to crop image.");
                        }
                    });
                } else {
                    restorePanelAfterCapture("Failed to capture screen. Please try again.");
                }
            } catch (error) {
                restorePanelAfterCapture(`Capture failed: ${error.message}. Ensure extension is loaded & try reloading page.`);
            }
        }

        function cropCapturedImage(dataUrl, cropX, cropY, cropWidth, cropHeight, callback) {
            const img = new Image();
            img.onload = () => {
                // captureVisibleTab pixels are not guaranteed to equal CSS
                // pixels. Scale against the actual screenshot dimensions and
                // clamp the source rectangle so short or high-DPI viewports
                // cannot produce an invalid drawImage call.
                const cropCalculator = globalThis.aiVisionCaptureUtils?.calculateSourceCrop;
                if (typeof cropCalculator !== 'function') {
                    callback(null);
                    return;
                }
                const crop = cropCalculator(
                    cropX,
                    cropY,
                    cropWidth,
                    cropHeight,
                    img.naturalWidth,
                    img.naturalHeight,
                    window.innerWidth,
                    window.innerHeight
                );
                const canvas = document.createElement('canvas');
                canvas.width = crop.canvasWidth;
                canvas.height = crop.canvasHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, crop.sourceX, crop.sourceY, crop.sourceWidth, crop.sourceHeight, 0, 0, canvas.width, canvas.height);
                const result = canvas.toDataURL('image/jpeg', 0.86);
                callback(result.length <= 8000000 ? result : null);
            };
            img.onerror = () => {
                callback(null);
            };
            img.src = dataUrl;
        }

        function removeCaptureSelection() {
            if (overlay) {
                overlay.removeEventListener('pointerdown', handlePointerDown);
                overlay.removeEventListener('pointermove', handlePointerMove);
                overlay.removeEventListener('pointerup', handlePointerUp);
                overlay.removeEventListener('pointercancel', cancelSelection);
                overlay.remove();
                overlay = null;
            }
            if (selectionRectDiv) {
                selectionRectDiv.remove();
                selectionRectDiv = null;
            }
        }

        function restorePanelAfterCapture(message = '') {
            const hadPanel = Boolean(popup);
            removeCaptureSelection();
            if (popup) {
                popup.style.display = capturePopupDisplay || '';
                capturePopupDisplay = null;
                refreshModeControls();
                if (message) showUserError(message);
            } else if (hadPanel) {
                openAssistantPanel();
                if (message) setTimeout(() => showUserError(message), 0);
            }
        }

        function cancelSelection() {
            if (isSelecting) {
                isSelecting = false;
            }
            restorePanelAfterCapture();
        }

        // Assistant panel construction and mode controls
        async function openAssistantPanel() {
            panelGeneration += 1;
            ensureUiRoot();
            
            const existingPopup = uiQuery('#gemini-popup');
            if (existingPopup) {
                existingPopup.remove();
            }
            
            popup = document.createElement('div');
            popup.id = 'gemini-popup';
            popup.tabIndex = -1;
            popup.setAttribute('role', 'dialog');
            popup.setAttribute('aria-modal', 'false');
            popup.setAttribute('aria-labelledby', 'gemini-popup-title');
            
            const header = document.createElement('div');
            header.id = 'gemini-popup-header';
            const brand = document.createElement('div');
            brand.id = 'gemini-popup-brand';
            const brandIcon = document.createElement('span');
            brandIcon.className = 'gemini-brand-icon';
            brandIcon.innerHTML = iconSvg('vision');
            const title = document.createElement('span');
            title.id = 'gemini-popup-title';
            title.textContent = 'AI Vision';
            brand.appendChild(brandIcon);
            brand.appendChild(title);
            
            const headerControls = document.createElement('div');
            headerControls.className = 'gemini-header-controls';
            
            const instructionsButton = document.createElement('button');
            instructionsButton.id = 'gemini-instructions-button';
            instructionsButton.className = 'gemini-header-action';
            instructionsButton.innerHTML = `${iconSvg('help')}<span>Help</span>`;
            instructionsButton.title = 'Instructions';
            instructionsButton.setAttribute('aria-label', 'Open instructions');
            instructionsButton.setAttribute('aria-expanded', 'false');
            
            const settingsButton = document.createElement('button');
            settingsButton.id = 'gemini-settings-button';
            settingsButton.className = 'gemini-header-action';
            settingsButton.innerHTML = `${iconSvg('settings')}<span>Settings</span>`;
            settingsButton.title = 'Settings';
            settingsButton.setAttribute('aria-label', 'Open settings');
            settingsButton.setAttribute('aria-expanded', 'false');
            
            const closeButton = document.createElement('button');
            closeButton.id = 'gemini-popup-close';
            closeButton.innerHTML = iconSvg('close');
            closeButton.title = 'Close';
            closeButton.setAttribute('aria-label', 'Close AI Vision');
            closeButton.onclick = closeAssistantPanel;
            
            headerControls.appendChild(instructionsButton);
            headerControls.appendChild(settingsButton);
            headerControls.appendChild(closeButton);
            
            header.appendChild(brand);
            header.appendChild(headerControls);
            
            const content = document.createElement('div');
            content.id = 'gemini-popup-content';

            let presetsDiv = null;
            let textOnlyMessage = null;
            let captureFrame = null;
            let capturePreview = null;
            let workspaceTitle = null;
            let workspaceDescription = null;
            let workspaceBackButton = null;
            let captureStatus = null;
            const modeButtons = [];

            const workspace = document.createElement('main');
            workspace.id = 'gemini-workspace';

            const workspaceHeading = document.createElement('div');
            workspaceHeading.className = 'gemini-workspace-heading';
            workspaceTitle = document.createElement('h1');
            workspaceTitle.id = 'gemini-workspace-title';
            workspaceDescription = document.createElement('p');
            workspaceDescription.id = 'gemini-workspace-description';
            workspaceBackButton = document.createElement('button');
            workspaceBackButton.type = 'button';
            workspaceBackButton.className = 'gemini-back-to-capture';
            workspaceBackButton.innerHTML = `${iconSvg('arrowLeft')}<span>Back to Screenshot</span>`;
            workspaceBackButton.onclick = () => {
                if (selectedMode !== 'capture') resetConversation();
                selectedMode = 'capture';
                closeUtilityPanels();
                renderSelectedMode();
            };
            workspaceHeading.appendChild(workspaceBackButton);
            workspaceHeading.appendChild(workspaceTitle);
            workspaceHeading.appendChild(workspaceDescription);
            workspace.appendChild(workspaceHeading);

            captureFrame = document.createElement('section');
            captureFrame.id = 'gemini-capture-frame';
            captureFrame.setAttribute('aria-label', 'Screenshot capture');
            capturePreview = document.createElement('div');
            capturePreview.className = 'gemini-capture-preview';
            captureStatus = document.createElement('span');
            captureStatus.className = 'gemini-capture-status';

            const primaryModeButton = document.createElement('button');
            primaryModeButton.id = 'gemini-primary-mode';
            primaryModeButton.type = 'button';
            primaryModeButton.className = 'gemini-primary-mode-button';
            primaryModeButton.innerHTML = `${iconSvg('capture')}<span class="gemini-primary-mode-copy"><strong>Select an area</strong><small>Choose the part of this page you want to understand</small></span>`;
            primaryModeButton.setAttribute('aria-label', 'Select an area of this page');
            primaryModeButton.onclick = () => {
                if (selectedMode !== 'capture') {
                    resetConversation();
                    selectedMode = 'capture';
                    renderSelectedMode();
                }
                startCaptureSelection();
            };
            captureFrame.appendChild(capturePreview);
            captureFrame.appendChild(primaryModeButton);
            captureFrame.appendChild(captureStatus);
            workspace.appendChild(captureFrame);

            const betaRail = document.createElement('aside');
            betaRail.id = 'gemini-beta-rail';
            betaRail.setAttribute('aria-label', 'Ask about');
            const betaTitle = document.createElement('h2');
            betaTitle.textContent = 'Ask about';
            betaRail.appendChild(betaTitle);
            const modeRail = document.createElement('div');
            modeRail.id = 'gemini-mode-rail';
            modeRail.setAttribute('role', 'tablist');
            modeRail.setAttribute('aria-label', 'Ask about');
            // The old Beta tools rail is now a single, friendly context selector.
            MODES.forEach((mode) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'gemini-beta-tool';
                button.dataset.mode = mode.value;
                button.setAttribute('role', 'tab');
                button.setAttribute('aria-label', mode.label);
                const icon = document.createElement('span');
                icon.className = 'gemini-beta-tool-icon';
                icon.innerHTML = iconSvg(mode.value === 'tab' ? 'tab' : 'tabs');
                const copy = document.createElement('span');
                copy.className = 'gemini-beta-tool-copy';
                copy.innerHTML = `<strong>${mode.label}</strong>`;
                button.appendChild(icon);
                button.appendChild(copy);
                button.onclick = () => {
                    if (selectedMode !== mode.value) resetConversation();
                    selectedMode = mode.value;
                    closeUtilityPanels();
                    renderSelectedMode();
                };
                modeButtons.push(button);
                modeRail.appendChild(button);
            });
            betaRail.appendChild(modeRail);

            const agentModeRow = document.createElement('div');
            agentModeRow.id = 'gemini-agent-mode-row';
            const agentModeCopy = document.createElement('div');
            agentModeCopy.className = 'gemini-agent-mode-copy';
            const agentModeIcon = document.createElement('span');
            agentModeIcon.className = 'gemini-beta-tool-icon';
            agentModeIcon.innerHTML = iconSvg('agent');
            const agentModeText = document.createElement('span');
            agentModeText.className = 'gemini-beta-tool-copy';
            const agentModeLabel = document.createElement('strong');
            agentModeLabel.textContent = 'Browser tasks';
            const agentModeBeta = document.createElement('small');
            agentModeBeta.textContent = 'Beta';
            const agentModeDescription = document.createElement('small');
            agentModeDescription.className = 'gemini-agent-description';
            agentModeText.appendChild(agentModeLabel);
            agentModeText.appendChild(agentModeBeta);
            agentModeCopy.appendChild(agentModeIcon);
            agentModeCopy.appendChild(agentModeText);
            const agentModeToggle = document.createElement('button');
            agentModeToggle.type = 'button';
            agentModeToggle.className = 'gemini-switch';
            agentModeToggle.setAttribute('role', 'switch');
            agentModeToggle.setAttribute('aria-label', 'Browser tasks (Beta)');
            agentModeToggle.onclick = () => {
                resetConversation();
                isAgentModeEnabled = !isAgentModeEnabled;
                renderSelectedMode();
            };
            agentModeRow.appendChild(agentModeCopy);
            agentModeRow.appendChild(agentModeDescription);
            agentModeRow.appendChild(agentModeToggle);
            betaRail.appendChild(agentModeRow);
            workspace.insertBefore(betaRail, captureFrame);
            content.appendChild(workspace);
            
            const instructionsPanel = document.createElement('div');
            instructionsPanel.id = 'gemini-instructions-panel';

            const helpIntro = document.createElement('p');
            helpIntro.className = 'gemini-help-intro';
            helpIntro.textContent = 'Start with a screenshot, switch to this page, or compare tabs when you need more context. Browser tasks are optional and always stop for your approval.';

            const helpList = document.createElement('ul');
            helpList.className = 'gemini-help-list';
            [
                ['Screenshot', 'Select a page area, then ask Gemini about the image.'],
                ['This page', 'Read and ask about the current page.'],
                ['Compare tabs', 'Compare supported pages in the starting Chrome window.'],
                ['Browser tasks', 'Optional browser help with approval for every action.']
            ].forEach(([label, description]) => {
                const item = document.createElement('li');
                const strong = document.createElement('strong');
                strong.textContent = label;
                item.appendChild(strong);
                item.append(` — ${description}`);
                helpList.appendChild(item);
            });

            const shortcutNote = document.createElement('p');
            shortcutNote.className = 'gemini-help-shortcut';
            shortcutNote.textContent = 'Press Alt + Shift + V to open Screenshot. Press Escape or Control + E to close AI Vision.';

            const supportCard = document.createElement('section');
            supportCard.className = 'gemini-support-card';
            const supportTitle = document.createElement('strong');
            supportTitle.textContent = 'Help more people find AI Vision';
            const supportText = document.createElement('p');
            supportText.textContent = 'If AI Vision saved you time, a quick rating helps. The source is also available publicly on GitHub.';
            const supportActions = document.createElement('div');
            supportActions.className = 'gemini-support-actions';

            const ratingLink = document.createElement('a');
            ratingLink.href = STORE_URL;
            ratingLink.target = '_blank';
            ratingLink.rel = 'noreferrer';
            ratingLink.innerHTML = `${iconSvg('star')}<span>Rate AI Vision</span>`;
            ratingLink.setAttribute('aria-label', 'Rate AI Vision on the Chrome Web Store');

            const githubLink = document.createElement('a');
            githubLink.href = GITHUB_URL;
            githubLink.target = '_blank';
            githubLink.rel = 'noreferrer';
            githubLink.innerHTML = `${iconSvg('code')}<span>GitHub source</span>`;
            githubLink.setAttribute('aria-label', 'View AI Vision source on GitHub');

            supportActions.appendChild(ratingLink);
            supportActions.appendChild(githubLink);
            supportCard.appendChild(supportTitle);
            supportCard.appendChild(supportText);
            supportCard.appendChild(supportActions);
            instructionsPanel.appendChild(helpIntro);
            instructionsPanel.appendChild(supportCard);
            instructionsPanel.appendChild(helpList);
            instructionsPanel.appendChild(shortcutNote);
            content.appendChild(instructionsPanel);
            
            instructionsButton.onclick = () => {
                const willShow = !instructionsPanel.classList.contains('show');
                instructionsPanel.classList.toggle('show', willShow);
                instructionsButton.classList.toggle('active', willShow);
                instructionsButton.setAttribute('aria-expanded', String(willShow));
                content.classList.toggle('gemini-panel-open', willShow);
                const settingsPanel = uiQuery('#gemini-settings-panel');
                if (settingsPanel) {
                    settingsPanel.classList.remove('show');
                }
                settingsButton.classList.remove('active');
                settingsButton.setAttribute('aria-expanded', 'false');
            };
            
            const settingsPanel = document.createElement('div');
            settingsPanel.id = 'gemini-settings-panel';
            
            settingsButton.onclick = () => {
                const willShow = !settingsPanel.classList.contains('show');
                settingsPanel.classList.toggle('show', willShow);
                settingsButton.classList.toggle('active', willShow);
                settingsButton.setAttribute('aria-expanded', String(willShow));
                content.classList.toggle('gemini-panel-open', willShow);
                instructionsPanel.classList.remove('show');
                instructionsButton.classList.remove('active');
                instructionsButton.setAttribute('aria-expanded', 'false');
                if (willShow) {
                    setTimeout(() => apiKeyInput.focus(), 0);
                    void refreshAvailableModels().then(() => {
                        apiKeyStatus.textContent = apiKeyStatusLabel();
                        apiKeyStatus.classList.toggle('valid', hasApiKey);
                        renderModelOptions();
                    }).catch(() => {});
                }
            };

            function closeUtilityPanels() {
                settingsPanel.classList.remove('show');
                instructionsPanel.classList.remove('show');
                settingsButton.classList.remove('active');
                instructionsButton.classList.remove('active');
                settingsButton.setAttribute('aria-expanded', 'false');
                instructionsButton.setAttribute('aria-expanded', 'false');
                content.classList.remove('gemini-panel-open');
            }
            
            const apiKeyGroup = document.createElement('div');
            apiKeyGroup.className = 'settings-group gemini-api-key-card';
            const apiKeyTitleRow = document.createElement('div');
            apiKeyTitleRow.className = 'gemini-api-key-title-row';
            const apiKeyTitle = document.createElement('div');
            apiKeyTitle.className = 'gemini-api-key-title';
            const apiKeyIcon = document.createElement('span');
            apiKeyIcon.className = 'gemini-api-key-icon';
            apiKeyIcon.innerHTML = iconSvg('key');
            const apiKeyLabel = document.createElement('label');
            apiKeyLabel.textContent = 'Gemini API key';
            apiKeyLabel.htmlFor = 'gemini-settings-api-key';
            const apiKeyStatus = document.createElement('span');
            apiKeyStatus.className = 'gemini-api-key-status';
            apiKeyStatus.textContent = apiKeyStatusLabel();
            apiKeyStatus.classList.toggle('valid', hasApiKey);
            apiKeyTitle.appendChild(apiKeyIcon);
            apiKeyTitle.appendChild(apiKeyLabel);
            apiKeyTitleRow.appendChild(apiKeyTitle);
            apiKeyTitleRow.appendChild(apiKeyStatus);
            const apiKeyField = document.createElement('div');
            apiKeyField.className = 'gemini-api-key-field';
            const apiKeyInput = document.createElement('input');
            apiKeyInput.id = 'gemini-settings-api-key';
            apiKeyInput.type = 'password';
            apiKeyInput.placeholder = hasApiKey ? 'Enter a new key to replace the saved key' : 'Enter your Gemini API key';
            apiKeyInput.autocomplete = 'off';
            apiKeyInput.setAttribute('autocorrect', 'off');
            apiKeyInput.setAttribute('autocapitalize', 'off');
            apiKeyInput.setAttribute('spellcheck', 'off');

            const apiKeyVisibility = document.createElement('button');
            apiKeyVisibility.type = 'button';
            apiKeyVisibility.className = 'gemini-api-key-visibility';
            apiKeyVisibility.innerHTML = iconSvg('eye');
            apiKeyVisibility.title = 'Show API key';
            apiKeyVisibility.setAttribute('aria-label', 'Show API key');
            apiKeyVisibility.onclick = () => {
                const isHidden = apiKeyInput.type === 'password';
                apiKeyInput.type = isHidden ? 'text' : 'password';
                apiKeyVisibility.innerHTML = iconSvg(isHidden ? 'eyeOff' : 'eye');
                apiKeyVisibility.title = isHidden ? 'Hide API key' : 'Show API key';
                apiKeyVisibility.setAttribute('aria-label', apiKeyVisibility.title);
            };

            apiKeyField.appendChild(apiKeyInput);
            apiKeyField.appendChild(apiKeyVisibility);

            const apiKeyActions = document.createElement('div');
            apiKeyActions.className = 'gemini-api-key-actions';
            const saveKeyButton = document.createElement('button');
            saveKeyButton.type = 'button';
            saveKeyButton.className = 'gemini-secondary-button';
            saveKeyButton.textContent = 'Save key';
            const clearKeyButton = document.createElement('button');
            clearKeyButton.type = 'button';
            clearKeyButton.className = 'gemini-secondary-button';
            clearKeyButton.textContent = 'Clear';
            clearKeyButton.disabled = !hasApiKey;
            apiKeyActions.appendChild(saveKeyButton);
            apiKeyActions.appendChild(clearKeyButton);

            const apiKeyHelp = document.createElement('div');
            apiKeyHelp.className = 'api-key-help';
            apiKeyHelp.innerHTML = `Get a Gemini key, paste it here, then save. Your key stays in Chrome. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Get a key ${iconSvg('external')}</a>`;
            
            const apiKeyError = document.createElement('div');
            apiKeyError.className = 'error-message';
            if (!hasApiKey) {
                apiKeyError.textContent = 'Put an API key';
            }
            
            apiKeyGroup.appendChild(apiKeyTitleRow);
            apiKeyGroup.appendChild(apiKeyField);
            apiKeyGroup.appendChild(apiKeyActions);
            apiKeyGroup.appendChild(apiKeyHelp);
            apiKeyGroup.appendChild(apiKeyError);
            
            const modelGroup = document.createElement('div');
            modelGroup.className = 'settings-group';
            const modelLabel = document.createElement('label');
            modelLabel.textContent = 'Model';
            modelLabel.htmlFor = 'gemini-model-select';
            const modelSelect = document.createElement('select');
            modelSelect.id = 'gemini-model-select';
            modelSelect.setAttribute('aria-label', 'Gemini model');
            
            function renderModelOptions() {
                if (!modelSelect?.isConnected && !popup) return;
                modelSelect.replaceChildren(...availableModels.map((model) => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    option.selected = model === selectedModel;
                    return option;
                }));
            }
            renderModelOptions();
            
            modelGroup.appendChild(modelLabel);
            modelGroup.appendChild(modelSelect);

            const responseStyleGroup = document.createElement('div');
            responseStyleGroup.className = 'settings-group';
            const responseStyleLabel = document.createElement('label');
            responseStyleLabel.textContent = 'Response style';
            responseStyleLabel.htmlFor = 'gemini-response-style-select';
            const responseStyleSelect = document.createElement('select');
            responseStyleSelect.id = 'gemini-response-style-select';
            responseStyleSelect.setAttribute('aria-label', 'Response style');
            RESPONSE_STYLES.forEach((style) => {
                const option = document.createElement('option');
                option.value = style.value;
                option.textContent = style.label;
                option.selected = style.value === selectedResponseStyle;
                responseStyleSelect.appendChild(option);
            });
            responseStyleGroup.appendChild(responseStyleLabel);
            responseStyleGroup.appendChild(responseStyleSelect);
            
            const tempGroup = document.createElement('div');
            tempGroup.className = 'settings-group';
            const tempLabelRow = document.createElement('div');
            tempLabelRow.className = 'settings-label-row';
            const tempLabel = document.createElement('label');
            tempLabel.textContent = 'Temperature';
            tempLabel.htmlFor = 'gemini-temperature-input';
            const tempValue = document.createElement('output');
            tempValue.textContent = String(responseTemperature);
            const tempInput = document.createElement('input');
            tempInput.id = 'gemini-temperature-input';
            tempInput.type = 'range';
            tempInput.min = '0';
            tempInput.max = '2';
            tempInput.step = '0.1';
            tempInput.value = responseTemperature;
            tempInput.style.setProperty('--gemini-temperature-percent', `${(responseTemperature / 2) * 100}%`);
            const tempScale = document.createElement('div');
            tempScale.className = 'gemini-temperature-scale';
            ['0', '1', '2'].forEach((value) => {
                const tick = document.createElement('span');
                tick.textContent = value;
                tempScale.appendChild(tick);
            });
            
            const tempError = document.createElement('div');
            tempError.className = 'error-message';
            
            tempLabelRow.appendChild(tempLabel);
            tempLabelRow.appendChild(tempValue);
            tempGroup.appendChild(tempLabelRow);
            tempGroup.appendChild(tempInput);
            tempGroup.appendChild(tempScale);
            tempGroup.appendChild(tempError);
            
            const compactSettingsGrid = document.createElement('div');
            compactSettingsGrid.className = 'gemini-settings-grid';
            compactSettingsGrid.appendChild(modelGroup);
            compactSettingsGrid.appendChild(responseStyleGroup);

            const optionalSettings = document.createElement('details');
            optionalSettings.id = 'gemini-optional-settings';
            const optionalSettingsSummary = document.createElement('summary');
            optionalSettingsSummary.textContent = 'Optional preferences';
            optionalSettings.appendChild(optionalSettingsSummary);
            optionalSettings.appendChild(compactSettingsGrid);
            optionalSettings.appendChild(tempGroup);

            const settingsFooter = document.createElement('div');
            settingsFooter.className = 'gemini-settings-footer';
            settingsFooter.innerHTML = `${iconSvg('spark')}<span>Preferences save when changed. API keys save only when you press Save key.</span>`;

            const storeFooter = document.createElement('div');
            storeFooter.id = 'gemini-settings-store-link';
            storeFooter.className = 'gemini-settings-store-link';
            const storeLink = document.createElement('a');
            storeLink.href = STORE_URL;
            storeLink.target = '_blank';
            storeLink.rel = 'noreferrer';
            storeLink.textContent = 'Get the live AI Vision extension from Chrome Web Store ↗';
            storeLink.setAttribute('aria-label', 'Open the live AI Vision extension in the Chrome Web Store');
            storeFooter.appendChild(storeLink);

            const setupIntro = document.createElement('div');
            setupIntro.className = 'gemini-setup-intro';
            function renderSetupIntro() {
                setupIntro.innerHTML = `<strong>${hasApiKey ? 'You are ready to ask.' : 'Three tiny steps to get started.'}</strong><span>${hasApiKey ? 'Your key is saved locally. Open Screenshot and try a question.' : 'Get a Gemini key, paste and save it below, then try your first screenshot.'}</span>`;
            }
            renderSetupIntro();
            settingsPanel.appendChild(setupIntro);
            settingsPanel.appendChild(apiKeyGroup);
            settingsPanel.appendChild(optionalSettings);
            settingsPanel.appendChild(settingsFooter);
            settingsPanel.appendChild(storeFooter);
            content.appendChild(settingsPanel);
            
            saveKeyButton.onclick = async () => {
                const newKey = apiKeyInput.value.trim();
                if (!newKey) {
                    apiKeyError.textContent = 'Enter an API key before saving.';
                    apiKeyInput.focus();
                    return;
                }
                saveKeyButton.disabled = true;
                apiKeyError.textContent = '';
                try {
                    const result = await saveSettings({ apiKey: newKey });
                    apiKeyInput.value = '';
                    apiKeyInput.type = 'password';
                    apiKeyVisibility.innerHTML = iconSvg('eye');
                    apiKeyVisibility.title = 'Show API key';
                    apiKeyVisibility.setAttribute('aria-label', 'Show API key');
                    apiKeyStatus.textContent = apiKeyStatusLabel();
                    apiKeyStatus.classList.add('valid');
                    renderSetupIntro();
                    clearKeyButton.disabled = false;
                    try {
                        await refreshAvailableModels();
                        apiKeyStatus.textContent = apiKeyStatusLabel();
                        apiKeyStatus.classList.toggle('valid', hasApiKey);
                        renderModelOptions();
                    } catch (_) {
                        // The key is saved even if model discovery is temporarily unavailable.
                    }
                } catch (error) {
                    apiKeyError.textContent = error.message || 'The API key could not be saved.';
                } finally {
                    saveKeyButton.disabled = false;
                }
            };

            clearKeyButton.onclick = async () => {
                clearKeyButton.disabled = true;
                try {
                    await saveSettings({ clearApiKey: true });
                    apiKeyInput.value = '';
                    apiKeyStatus.textContent = apiKeyStatusLabel();
                    apiKeyStatus.classList.remove('valid');
                    renderSetupIntro();
                    apiKeyError.textContent = 'Put an API key';
                } catch (error) {
                    apiKeyError.textContent = error.message || 'The API key could not be cleared.';
                    clearKeyButton.disabled = false;
                }
            };
            
            modelSelect.onchange = (e) => {
                selectedModel = e.target.value;
                void saveSettings().catch((error) => showUserError(error.message));
            };

            responseStyleSelect.onchange = (e) => {
                selectedResponseStyle = e.target.value;
                void saveSettings().catch((error) => showUserError(error.message));
            };
            
            tempInput.oninput = (e) => {
                tempValue.textContent = e.target.value;
                e.target.style.setProperty('--gemini-temperature-percent', `${(parseFloat(e.target.value) / 2) * 100}%`);
            };

            tempInput.onchange = (e) => {
                if (validateTemperature(e.target.value)) {
                    responseTemperature = parseFloat(e.target.value);
                    tempError.textContent = '';
                } else {
                    tempError.textContent = 'Temperature must be between 0 and 2';
                    tempInput.value = '1';
                    responseTemperature = 1;
                }
                tempValue.textContent = String(responseTemperature);
                void saveSettings().catch((error) => showUserError(error.message));
            };
            
            textOnlyMessage = document.createElement('div');
            textOnlyMessage.className = 'gemini-mode-note';
            workspace.appendChild(textOnlyMessage);

            const composer = document.createElement('div');
            composer.id = 'gemini-popup-composer';
            queryInput = document.createElement('textarea');
            queryInput.id = 'gemini-popup-query-input';
            queryInput.rows = 3;
            queryInput.placeholder = 'Ask about what you captured';
            queryInput.autocomplete = 'off';
            queryInput.setAttribute('autocorrect', 'off');
            queryInput.setAttribute('autocapitalize', 'off');
            queryInput.setAttribute('spellcheck', 'false');
            queryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitUserRequest();
                }
            });

            sendButton = document.createElement('button');
            sendButton.id = 'gemini-popup-send';
            sendButton.innerHTML = `${iconSvg('send')}<span>Send</span>`;
            sendButton.onclick = () => submitUserRequest();

            composer.appendChild(queryInput);
            composer.appendChild(sendButton);
            workspace.appendChild(composer);
            
            presetsDiv = document.createElement('div');
            presetsDiv.id = 'gemini-popup-presets';
            workspace.appendChild(presetsDiv);

            function renderQuickActions() {
                const presets = QUICK_ACTIONS[selectedMode] || QUICK_ACTIONS.capture;
                presetsDiv.replaceChildren(...presets.map((preset) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.innerHTML = `${iconSvg(preset.icon)}<span>${preset.text}</span>`;
                    const unavailable = selectedMode === 'capture' && !capturedImageData;
                    button.disabled = unavailable;
                    if (unavailable) button.title = 'Capture an area first';
                    button.onclick = () => submitUserRequest(preset.query);
                    return button;
                }));
            }
            
            responseArea = document.createElement('div');
            responseArea.id = 'gemini-popup-response-area';
            responseArea.setAttribute('role', 'status');
            responseArea.setAttribute('aria-live', 'polite');
            responseArea.setAttribute('aria-atomic', 'true');
            responseArea.textContent = 'Your answer will appear here';
            workspace.appendChild(responseArea);

            function renderCaptureFrame() {
                const isCaptureActive = selectedMode === 'capture';
                captureFrame.classList.toggle('context', !isCaptureActive);
                capturePreview.replaceChildren();
                if (isCaptureActive) {
                    const previewIcon = document.createElement('span');
                    previewIcon.className = 'gemini-capture-preview-icon';
                    previewIcon.innerHTML = iconSvg(capturedImageData ? 'vision' : 'capture');
                    if (capturedImageData) {
                        capturePreview.appendChild(previewIcon);
                        const image = document.createElement('img');
                        image.alt = 'Selected screenshot preview';
                        image.src = `data:image/jpeg;base64,${capturedImageData}`;
                        capturePreview.appendChild(image);
                    } else {
                        const mascot = document.createElement('img');
                        mascot.className = 'gemini-mascot';
                        mascot.alt = 'AI Vision lens mascot';
                        mascot.src = chrome.runtime?.getURL
                            ? chrome.runtime.getURL('extension-assets/ai-vision-mascot.png')
                            : 'extension-assets/ai-vision-mascot.png';
                        capturePreview.appendChild(mascot);
                        const welcome = document.createElement('span');
                        welcome.className = 'gemini-welcome-copy';
                        welcome.textContent = 'Pick a little piece of the page to get started.';
                        capturePreview.appendChild(welcome);
                    }
                    primaryModeButton.hidden = false;
                    primaryModeButton.innerHTML = `${iconSvg(capturedImageData ? 'retry' : 'capture')}<span class="gemini-primary-mode-copy"><strong>${capturedImageData ? 'Select a different area' : 'Select an area'}</strong><small>${capturedImageData ? 'Choose another part of this page' : 'Choose the part of this page you want to understand'}</small></span>`;
                    primaryModeButton.setAttribute('aria-label', capturedImageData ? 'Retake the screenshot — select a different area' : 'Select an area of this page');
                    captureStatus.textContent = capturedImageData ? 'Screenshot ready to explore' : 'Screenshot mode';
                } else {
                    const contextIcon = document.createElement('span');
                    contextIcon.className = 'gemini-context-icon';
                    contextIcon.innerHTML = iconSvg(selectedMode === 'tab' ? 'tab' : 'tabs');
                    const contextCopy = document.createElement('div');
                    contextCopy.className = 'gemini-context-copy';
                    const contextTitle = document.createElement('strong');
                    contextTitle.textContent = selectedMode === 'tab' ? 'This page' : 'Compare tabs';
                    const contextDescription = document.createElement('span');
                    contextDescription.textContent = selectedMode === 'tab'
                        ? 'Read this page and ask a question.'
                        : 'Find useful differences across this window.';
                    contextCopy.appendChild(contextTitle);
                    contextCopy.appendChild(contextDescription);
                    capturePreview.appendChild(contextIcon);
                    capturePreview.appendChild(contextCopy);
                    primaryModeButton.hidden = true;
                    captureStatus.textContent = selectedMode === 'tab'
                        ? 'Page context stays in this tab'
                        : 'Access stays in this Chrome window';
                }
            }

            function renderSelectedMode() {
                const isCaptureActive = selectedMode === 'capture';
                workspaceTitle.textContent = isCaptureActive
                    ? 'Ask about a screenshot'
                    : selectedMode === 'tab'
                        ? 'Ask about this webpage'
                        : 'Compare your open tabs';
                workspaceDescription.textContent = isCaptureActive
                    ? 'Select any area of this page, then ask Gemini.'
                    : selectedMode === 'tab'
                        ? 'Read the current page without leaving your workflow.'
                        : 'Find useful differences across supported pages in this window.';
                workspaceBackButton.hidden = isCaptureActive;
                modeButtons.forEach((button) => {
                    const isActive = button.dataset.mode === selectedMode;
                    button.classList.toggle('active', isActive);
                    button.setAttribute('aria-selected', String(isActive));
                    button.tabIndex = isActive ? 0 : -1;
                });

                agentModeToggle.classList.toggle('active', isAgentModeEnabled);
                agentModeToggle.setAttribute('aria-checked', String(isAgentModeEnabled));
                agentModeToggle.textContent = '';

                if (selectedMode === 'capture') {
                    queryInput.placeholder = capturedImageData ? 'Ask about this screenshot' : 'What would you like to know?';
                    agentModeDescription.textContent = 'Can use the screenshot and act in This page';
                    textOnlyMessage.textContent = isAgentModeEnabled
                        ? 'Browser tasks can use the screenshot and act only in This page'
                        : capturedImageData
                            ? 'Using the area you captured'
                            : 'Select an area for image-aware answers';
                } else if (selectedMode === 'tab') {
                    queryInput.placeholder = 'Ask about this webpage';
                    agentModeDescription.textContent = 'Can read, navigate, and act in This page';
                    textOnlyMessage.textContent = isAgentModeEnabled
                        ? 'Browser tasks can read and act only in This page'
                        : 'Reads supported content from this page';
                } else {
                    queryInput.placeholder = 'Ask across your Chrome tabs';
                    agentModeDescription.textContent = 'Can search, switch tabs, and act in this window';
                    textOnlyMessage.textContent = isAgentModeEnabled
                        ? 'Browser tasks can search and act only in this Chrome window'
                        : 'Reads supported pages in this Chrome window';
                }

                renderCaptureFrame();
                renderQuickActions();

                if (!sendButton.disabled) {
                    const label = isAgentModeEnabled ? 'Start task' : 'Send';
                    const icon = isAgentModeEnabled ? 'spark' : 'send';
                    sendButton.innerHTML = `${iconSvg(icon)}<span>${isAgentModeEnabled ? label : 'Ask Gemini'}</span>`;
                }
            }
            refreshModeControls = renderSelectedMode;
            
            popup.appendChild(header);
            popup.appendChild(content);
            
            uiShadowRoot.appendChild(popup);
            popup.addEventListener('keydown', (event) => {
                if (event.key !== 'Tab') return;
                const focusable = Array.from(popup.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]'))
                    .filter((element) => !element.hidden && element.getClientRects().length > 0);
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const activeElement = uiShadowRoot.activeElement || document.activeElement;
                if (event.shiftKey && activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            });
            enablePanelDragging(popup, header);
            renderSelectedMode();
            const launchQuery = typeof launchOptions.query === 'string' ? launchOptions.query.trim() : '';
            const shouldAutoSubmit = launchOptions.autoSubmit === true && launchQuery !== '';
            launchOptions.query = '';
            launchOptions.autoSubmit = false;
            if (launchQuery) queryInput.value = launchQuery;
            queryInput.focus();
            if (shouldAutoSubmit) setTimeout(() => { if (popup) void submitUserRequest(); }, 0);
        }

        function closeAssistantPanel() {
            panelGeneration += 1;
            if (activeAgentTaskId) {
                void sendWorkerMessage({ action: 'cancelAgentTask', taskId: activeAgentTaskId }).catch(() => {});
                activeAgentTaskId = null;
            }
            if (activeRequestId) {
                void sendWorkerMessage({ action: 'cancelGeminiRequest', requestId: activeRequestId }).catch(() => {});
                activeRequestId = null;
            }
            if (popup) {
                popup.remove();
                popup = null;
            }
            if (overlay) removeCaptureSelection();
            capturePopupDisplay = null;
            if (uiHost) uiHost.remove();
            uiHost = null;
            uiShadowRoot = null;
            capturedImageData = null;
        }

        // Request state and progress rendering
        function setRequestInProgress(isLoading, label = 'Sending') {
            if (!sendButton) return;
            sendButton.disabled = isLoading;
            sendButton.classList.toggle('loading', isLoading);
            if (isLoading) {
                sendButton.innerHTML = `<span class="gemini-spinner" aria-hidden="true"></span><span>${label}</span>`;
                sendButton.setAttribute('aria-busy', 'true');
            } else {
                sendButton.removeAttribute('aria-busy');
            }
            uiQueryAll('#gemini-primary-mode, #gemini-mode-rail button, #gemini-agent-mode-row button, #gemini-popup-presets button, .gemini-answer-actions button').forEach((button) => {
                button.disabled = isLoading;
            });
            if (!isLoading) refreshModeControls();
        }

        async function copyAnswerText(text) {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }
            const fallback = document.createElement('textarea');
            fallback.value = text;
            fallback.setAttribute('readonly', '');
            fallback.style.position = 'fixed';
            fallback.style.opacity = '0';
            uiShadowRoot.appendChild(fallback);
            fallback.select();
            const copied = document.execCommand?.('copy');
            fallback.remove();
            if (!copied) throw new Error('Copy is unavailable in this page.');
        }

        function renderAnswer(text) {
            lastResponseText = text;
            responseArea.textContent = '';
            responseArea.classList.remove('error', 'automation');

            const answerText = document.createElement('div');
            answerText.className = 'gemini-answer-text';
            answerText.textContent = text;

            const actions = document.createElement('div');
            actions.className = 'gemini-answer-actions';
            const actionDefinitions = [
                ['copy', 'Copy', async (button) => {
                    const original = button.innerHTML;
                    try {
                        await copyAnswerText(lastResponseText);
                        button.textContent = 'Copied';
                        setTimeout(() => { if (button.isConnected) button.innerHTML = original; }, 1200);
                    } catch (error) {
                        showUserError(error.message || 'The answer could not be copied.');
                    }
                }],
                ['answer', 'Follow up', () => {
                    queryInput.value = '';
                    queryInput.placeholder = 'Ask a follow-up about this answer';
                    queryInput.focus();
                }],
                ['retry', 'Try again', () => {
                    conversationHistory = lastRequestHistory.map((message) => ({ ...message }));
                    queryInput.value = lastSubmittedQuery;
                    void submitUserRequest();
                }]
            ];
            actionDefinitions.forEach(([icon, label, handler]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.innerHTML = `${iconSvg(icon)}<span>${label}</span>`;
                button.onclick = () => handler(button);
                actions.appendChild(button);
            });

            responseArea.appendChild(answerText);
            responseArea.appendChild(actions);
        }

        function renderAgentProgress(step = 1, message = 'Understanding your task', planner = {}) {
            const contextLabel = selectedMode === 'all-tabs' ? 'Reading this Chrome window' : 'Reading this page';
            const steps = [
                'Understanding your task',
                contextLabel,
                'Acting and finishing'
            ];
            responseArea.textContent = '';
            responseArea.classList.remove('error');
            responseArea.classList.add('automation');

            const title = document.createElement('strong');
            title.textContent = 'Browser tasks are working';
            responseArea.appendChild(title);

            const status = document.createElement('span');
            status.className = 'gemini-automation-status';
            status.textContent = message;
            responseArea.appendChild(status);

            if (typeof planner?.model === 'string' && planner.model) {
                const plannerStatus = document.createElement('small');
                plannerStatus.className = 'gemini-agent-model';
                const requestNumber = Number.isInteger(planner.requestNumber) ? ` · request ${planner.requestNumber}` : '';
                const nextModel = typeof planner.nextModel === 'string' && planner.nextModel
                    ? ` · next ${planner.nextModel}`
                    : '';
                plannerStatus.textContent = `Planner: ${planner.model}${requestNumber}${nextModel}`;
                responseArea.appendChild(plannerStatus);
            }

            const list = document.createElement('ol');
            list.className = 'gemini-progress-list';
            steps.forEach((stepLabel, index) => {
                const item = document.createElement('li');
                const stepNumber = index + 1;
                item.classList.toggle('done', stepNumber < step);
                item.classList.toggle('active', stepNumber === step);
                item.textContent = stepLabel;
                list.appendChild(item);
            });
            responseArea.appendChild(list);

            if (activeAgentTaskId) {
                const cancelButton = document.createElement('button');
                cancelButton.type = 'button';
                cancelButton.className = 'gemini-secondary-button gemini-agent-cancel-button';
                cancelButton.textContent = 'Stop task';
                cancelButton.setAttribute('aria-label', 'Stop Agent Mode task');
                cancelButton.onclick = async () => {
                    const taskId = activeAgentTaskId;
                    if (!taskId) return;
                    cancelButton.disabled = true;
                    cancelButton.textContent = 'Stopping…';
                    status.textContent = 'Stopping Browser tasks…';
                    try {
                        const result = await sendWorkerMessage({ action: 'cancelAgentTask', taskId });
                        if (result?.error) throw new Error(result.error);
                    } catch (error) {
                        cancelButton.disabled = false;
                        cancelButton.textContent = 'Stop task';
                        status.textContent = error.message || 'The task could not be stopped.';
                    }
                };
                responseArea.appendChild(cancelButton);
            }
        }

        // Context collection and Gemini requests
        async function captureVisibleSourceTab() {
            if (!popup) return null;
            const previousVisibility = popup.style.visibility;
            popup.style.visibility = 'hidden';
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            try {
                const dataUrl = await sendWorkerMessage({
                    action: 'captureVisibleTab',
                    options: { format: 'jpeg', quality: 88 }
                });
                if (typeof dataUrl !== 'string' || !dataUrl.includes(',') || dataUrl.length > 8000000) return null;
                return dataUrl.split(',')[1];
            } finally {
                if (popup) popup.style.visibility = previousVisibility;
            }
        }

        async function submitUserRequest(presetQuery = null) {
            if (!hasApiKey) {
                showUserError('Please set your Gemini API key in Settings');
                return;
            }

            let queryText = presetQuery || queryInput.value.trim();
            if (!queryText && selectedMode === 'capture' && capturedImageData) {
                queryText = "What's in this capture?";
            }
            if (!queryText) {
                showUserError('Please type a question or task.');
                return;
            }

            const requestMode = selectedMode;
            const shouldRunAgent = isAgentModeEnabled;
            const requestHistory = conversationHistory.slice(-6).map((message) => ({ ...message }));
            let agentStarted = false;
            const requestGeneration = panelGeneration;
            setRequestInProgress(true, shouldRunAgent ? 'Working' : 'Sending');
            responseArea.classList.remove('error', 'automation');

            try {
                if (requestMode === 'all-tabs') {
                    const permission = await sendWorkerMessage({ action: 'ensureAllTabsAccess' });
                    if (!permission?.granted) {
                        responseArea.textContent = permission?.pending
                        ? 'Compare tabs permission opened in a new tab. Grant it, return here, and press Ask Gemini again.'
                        : 'Compare tabs access was not enabled.';
                        setRequestInProgress(false);
                        return;
                    }
                }

                if (shouldRunAgent) {
                    renderAgentProgress(1, 'Understanding your task');
                    const taskResult = await sendWorkerMessage({
                        action: 'startAgentTask',
                        task: queryText,
                        mode: requestMode,
                        captureImageData: requestMode === 'capture' ? capturedImageData : null,
                        model: selectedModel,
                        temperature: responseTemperature,
                        responseStyle: selectedResponseStyle
                    });
                    if (!taskResult?.taskId) throw new Error('The browser task could not be started.');
                    if (requestGeneration !== panelGeneration || !popup) {
                        await sendWorkerMessage({ action: 'cancelAgentTask', taskId: taskResult.taskId }).catch(() => {});
                        return;
                    }
                    activeAgentTaskId = taskResult.taskId;
                    if (uiHost) uiHost.dataset.agentTaskId = activeAgentTaskId;
                    renderAgentProgress(1, 'Starting Browser tasks');
                    agentStarted = true;
                    return;
                }

                responseArea.textContent = requestMode === 'capture'
                    ? 'Analyzing your capture'
                    : requestMode === 'tab'
                        ? 'Reading this tab'
                        : 'Reading tabs in this window';

                const requestId = `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                activeRequestId = requestId;
                if (uiHost) uiHost.dataset.requestId = requestId;
                const tabImage = requestMode === 'tab' ? await captureVisibleSourceTab() : null;
                if (requestGeneration !== panelGeneration || !popup) return;
                const result = await sendWorkerMessage({
                    action: 'askGemini',
                    requestId,
                    query: queryText,
                    mode: requestMode,
                    captureImageData: requestMode === 'capture' ? capturedImageData : null,
                    tabImageData: tabImage,
                    model: selectedModel,
                    temperature: responseTemperature,
                    responseStyle: selectedResponseStyle,
                    conversationHistory: requestHistory
                });
                const responseText = stripLightMarkdown(result?.text || 'Gemini returned an empty response.');
                lastRequestHistory = requestHistory;
                lastSubmittedQuery = queryText;
                conversationHistory = [
                    ...requestHistory,
                    { role: 'user', text: queryText },
                    { role: 'model', text: responseText }
                ].slice(-6);
                queryInput.value = '';
                renderAnswer(responseText);
            } catch (error) {
                if (popup && responseArea) {
                    responseArea.classList.remove('automation');
                    responseArea.textContent = `Error: ${error.message}`;
                    responseArea.classList.add('error');
                }
            } finally {
                if (!agentStarted) {
                    activeRequestId = null;
                    setRequestInProgress(false);
                }
            }
        }

        // Panel interaction and cleanup
        function enablePanelDragging(element, handle) {
            let dragPointerMoveHandler, dragPointerUpHandler;
            handle.onpointerdown = function(event) {
                if (event.button !== 0) return;
                if (event.target.closest?.('button, a, input, textarea, select, summary')) return;
                event.preventDefault();
                handle.setPointerCapture?.(event.pointerId);
                let shiftX = event.clientX - element.getBoundingClientRect().left;
                let shiftY = event.clientY - element.getBoundingClientRect().top;
                element.style.position = 'fixed';
                function moveAt(mouseClientX, mouseClientY) {
                    let newX = mouseClientX - shiftX;
                    let newY = mouseClientY - shiftY;
                    const maxX = window.innerWidth - element.offsetWidth;
                    const maxY = window.innerHeight - element.offsetHeight;
                    newX = Math.max(0, Math.min(newX, Math.max(0, maxX)));
                    newY = Math.max(0, Math.min(newY, Math.max(0, maxY)));
                    element.style.left = newX + 'px';
                    element.style.top = newY + 'px';
                }
                moveAt(event.clientX, event.clientY);
                dragPointerMoveHandler = function(e_move) { moveAt(e_move.clientX, e_move.clientY); };
                window.geminiExtensionGlobalDragPointerMove = dragPointerMoveHandler;
                dragPointerUpHandler = function() {
                    document.removeEventListener('pointermove', dragPointerMoveHandler);
                    document.removeEventListener('pointerup', dragPointerUpHandler);
                    document.removeEventListener('pointercancel', dragPointerUpHandler);
                    if (handle) handle.style.userSelect = '';
                    window.geminiExtensionGlobalDragPointerMove = null;
                    window.geminiExtensionGlobalDragPointerUp = null;
                };
                window.geminiExtensionGlobalDragPointerUp = dragPointerUpHandler;
                document.addEventListener('pointermove', dragPointerMoveHandler);
                document.addEventListener('pointerup', dragPointerUpHandler, { once: true });
                document.addEventListener('pointercancel', dragPointerUpHandler, { once: true });
                if(handle) handle.style.userSelect = 'none';
            };
            if(handle) handle.ondragstart = () => false;
        }

        function showUserError(message) {
            if (responseArea && popup && popup.parentNode) {
                responseArea.textContent = message;
                responseArea.classList.add('error');
            } else {
                ensureUiRoot();
                let tempErrorDiv = uiQuery('#gemini-temp-error');
                if (tempErrorDiv) tempErrorDiv.remove();
                tempErrorDiv = document.createElement('div');
                tempErrorDiv.id = 'gemini-temp-error';
                
                const messageSpan = document.createElement('span');
                messageSpan.textContent = message;
                tempErrorDiv.appendChild(messageSpan);

                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '&times;';
                closeBtn.className = 'temp-error-close';
                closeBtn.onclick = () => tempErrorDiv.remove();
                tempErrorDiv.appendChild(closeBtn);

                uiShadowRoot.appendChild(tempErrorDiv);
                setTimeout(() => { if (tempErrorDiv && tempErrorDiv.parentNode) tempErrorDiv.remove(); }, 5000);
            }
        }

        function renderAgentProposal(proposal) {
            if (!responseArea || !popup) return;
            responseArea.textContent = '';
            responseArea.classList.remove('error');
            responseArea.classList.add('automation');

            const title = document.createElement('strong');
            title.textContent = 'Approval required';
            responseArea.appendChild(title);

            const description = document.createElement('p');
            const action = proposal?.action?.action || 'browser action';
            const target = proposal?.preview?.label || proposal?.tabTitle || 'the selected page';
            const actionLabel = String(action).replaceAll('_', ' ');
            description.textContent = `AI Vision wants to ${actionLabel} ${target}. Review the page and choose whether to continue.`;
            responseArea.appendChild(description);

            if (typeof proposal?.action?.reason === 'string' && proposal.action.reason) {
                const reason = document.createElement('small');
                reason.className = 'gemini-automation-status';
                reason.textContent = `Planner rationale: ${proposal.action.reason}`;
                responseArea.appendChild(reason);
            }

            const actions = document.createElement('div');
            actions.className = 'gemini-approval-actions';
            const approve = document.createElement('button');
            approve.type = 'button';
            approve.className = 'gemini-approve-button';
            approve.textContent = 'Approve';
            const reject = document.createElement('button');
            reject.type = 'button';
            reject.className = 'gemini-secondary-button';
            reject.textContent = 'Stop task';
            approve.onclick = async () => {
                approve.disabled = true;
                reject.disabled = true;
                try {
                    const result = await sendWorkerMessage({ action: 'approveAgentAction', taskId: activeAgentTaskId });
                    if (result?.error) throw new Error(result.error);
                } catch (error) {
                    responseArea.classList.remove('automation');
                    responseArea.classList.add('error');
                    responseArea.textContent = error.message || 'The action could not be approved.';
                    activeAgentTaskId = null;
                    setRequestInProgress(false);
                }
            };
            reject.onclick = async () => {
                approve.disabled = true;
                reject.disabled = true;
                try {
                    await sendWorkerMessage({ action: 'rejectAgentAction', taskId: activeAgentTaskId });
                } catch (error) {
                    responseArea.classList.remove('automation');
                    responseArea.classList.add('error');
                    responseArea.textContent = error.message || 'The task could not be stopped.';
                    activeAgentTaskId = null;
                    setRequestInProgress(false);
                }
            };
            actions.appendChild(approve);
            actions.appendChild(reject);
            responseArea.appendChild(actions);
        }

        const runtimeMessageListener = (request, sender, sendResponse) => {
            if (request.action === 'agentModeProgress'
                && request.taskId === activeAgentTaskId
                && responseArea && popup) {
                renderAgentProgress(request.step || 1, request.message || 'Working in this window', {
                    model: request.model,
                    nextModel: request.nextModel,
                    requestNumber: request.requestNumber
                });
                sendResponse({ status: 'received' });
                return false;
            }
            if (request.action === 'agentModeProposal'
                && request.taskId === activeAgentTaskId
                && responseArea && popup) {
                renderAgentProposal(request.proposal);
                sendResponse({ status: 'received' });
                return false;
            }
            if (request.action === 'agentModeComplete'
                && request.taskId === activeAgentTaskId
                && responseArea && popup) {
                activeAgentTaskId = null;
                responseArea.classList.remove('automation');
                responseArea.classList.toggle('error', Boolean(request.error));
                responseArea.textContent = stripLightMarkdown(request.summary || (request.error ? 'The task failed.' : 'Task completed.'));
                setRequestInProgress(false);
                sendResponse({ status: 'received' });
                return false;
            }
            if (request.action === 'allTabsPermissionResult' && responseArea && popup) {
                responseArea.classList.toggle('error', request.granted !== true);
                responseArea.textContent = request.granted === true
                    ? 'Compare tabs access is enabled. Press Ask Gemini to continue.'
                    : 'Compare tabs access was not enabled.';
                setRequestInProgress(false);
                sendResponse({ status: 'received' });
                return false;
            }
        };
        window.geminiExtensionRuntimeMessageListener = runtimeMessageListener;
        chrome.runtime.onMessage.addListener(runtimeMessageListener);

        const keydownListener = (e) => {
            if ((e.ctrlKey && e.key.toLowerCase() === 'e') || e.key === 'Escape') {
                e.preventDefault();
                if (uiQuery('#gemini-screenshot-overlay')) {
                    restorePanelAfterCapture();
                    return;
                }
                if (uiQuery('#gemini-popup')) {
                    closeAssistantPanel();
                }
            }
        };
        window.geminiExtensionKeydownListener = keydownListener;
        document.addEventListener('keydown', keydownListener);

        function openSelectedMode() {
            openAssistantPanel();
        }

        (async () => {
            try {
                await loadSettings();
                const launchState = globalThis.aiVisionCaptureUtils?.resolvePanelLaunchState
                    ? globalThis.aiVisionCaptureUtils.resolvePanelLaunchState(launchOptions)
                    : { mode: DEFAULT_MODE, agentMode: false };
                selectedMode = launchState.mode;
                isAgentModeEnabled = launchState.agentMode;
                if (launchOptions.autoSubmit === true) isAgentModeEnabled = false;
                openSelectedMode();
            } catch (error) {
                console.error('Error during initialization:', error);
                showUserError(error.message || 'AI Vision could not start.');
            }
        })();

    } catch (e) {
        try {
            ensureUiRoot();
            let errorFallbackDiv = uiQuery('#gemini-uncaught-error-fallback');
            if (errorFallbackDiv) errorFallbackDiv.remove();
            errorFallbackDiv = document.createElement('div');
            errorFallbackDiv.id = 'gemini-uncaught-error-fallback';
            errorFallbackDiv.style.position = 'fixed';
            errorFallbackDiv.style.top = '10px';
            errorFallbackDiv.style.left = '50%';
            errorFallbackDiv.style.transform = 'translateX(-50%)';
            errorFallbackDiv.style.backgroundColor = 'red';
            errorFallbackDiv.style.color = 'white';
            errorFallbackDiv.style.padding = '15px';
            errorFallbackDiv.style.border = '2px solid darkred';
            errorFallbackDiv.style.borderRadius = '8px';
            errorFallbackDiv.style.zIndex = '2147483647';
            errorFallbackDiv.style.fontFamily = 'Arial, sans-serif';
            errorFallbackDiv.style.fontSize = '16px';
            errorFallbackDiv.style.textAlign = 'center';
            errorFallbackDiv.textContent = `Extension Error: AI Vision Helper encountered a critical issue. Error: ${e.message}`;
            uiShadowRoot.appendChild(errorFallbackDiv);
            setTimeout(() => { if (errorFallbackDiv) errorFallbackDiv.remove(); }, 10000);
        } catch (fallbackError) {
        }
    }
})();
