(function() {
    // User configuration. These values mirror the keys stored in chrome.storage.local.
    let geminiApiKey = "";
    const DEFAULT_MODEL = "gemini-3.5-flash";
    const DEFAULT_MODE = "capture";
    const DEFAULT_RESPONSE_STYLE = "balanced";
    const STORE_URL = "https://chromewebstore.google.com/detail/ai-vision-screenshot-ask/ghmmlbclopoakmjjbkkmoefjldgjimgk";
    const GITHUB_URL = "https://github.com/gitchubst/AI_Vision";
    let selectedModel = DEFAULT_MODEL;
    let responseTemperature = 1;
    let selectedMode = DEFAULT_MODE;
    let selectedResponseStyle = DEFAULT_RESPONSE_STYLE;
    let isAgentModeEnabled = false;

    const MODELS = [
        "gemini-3.5-flash",
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite"
    ];

    const MODES = [
        { value: "capture", label: "Capture" },
        { value: "tab", label: "The Tab" },
        { value: "all-tabs", label: "All Tabs" }
    ];

    const RESPONSE_STYLES = [
        { value: "balanced", label: "Balanced" },
        { value: "concise", label: "Concise" },
        { value: "formal", label: "Formal" },
        { value: "casual", label: "Casual" },
        { value: "detailed", label: "Detailed" },
        { value: "bullets", label: "Bullet-oriented" }
    ];

    const RESPONSE_STYLE_INSTRUCTIONS = {
        balanced: "Use a balanced, clear tone with enough detail to be useful.",
        concise: "Be concise and lead with the direct answer.",
        formal: "Use a polished, formal, professional tone.",
        casual: "Use a friendly, conversational, casual tone.",
        detailed: "Give a thorough answer with useful context and clearly separated sections when helpful.",
        bullets: "Organize the answer as short, scannable bullet points whenever possible."
    };

    // Persisted settings
    function saveSettings() {
        chrome.storage.local.set({
            'geminiApiKey': geminiApiKey,
            'geminiModel': selectedModel,
            'geminiTemperature': responseTemperature,
            'geminiMode': selectedMode,
            'geminiResponseStyle': selectedResponseStyle,
            'geminiAgentMode': isAgentModeEnabled
        }, () => {
        });
    }
    async function loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get([
                'geminiApiKey',
                'geminiModel',
                'geminiTemperature',
                'geminiMode',
                'geminiResponseStyle',
                'geminiAgentMode',
                'geminiAutoBrowse'
            ], (result) => {
                if (result.geminiApiKey) geminiApiKey = result.geminiApiKey;
                if (result.geminiModel && MODELS.includes(result.geminiModel)) {
                    selectedModel = result.geminiModel;
                } else {
                    selectedModel = DEFAULT_MODEL;
                }
                if (result.geminiTemperature !== undefined) responseTemperature = result.geminiTemperature;
                if (MODES.some((mode) => mode.value === result.geminiMode)) {
                    selectedMode = result.geminiMode;
                } else {
                    selectedMode = DEFAULT_MODE;
                }
                if (RESPONSE_STYLES.some((style) => style.value === result.geminiResponseStyle)) {
                    selectedResponseStyle = result.geminiResponseStyle;
                } else {
                    selectedResponseStyle = DEFAULT_RESPONSE_STYLE;
                }
                isAgentModeEnabled = result.geminiAgentMode === true
                    || (result.geminiAgentMode === undefined && result.geminiAutoBrowse === true);
                geminiApiUrl = buildGeminiApiUrl();
                resolve();
            });
        });
    }

    // Gemini request configuration
    function validateTemperature(value) {
        const temp = parseFloat(value);
        if (isNaN(temp) || temp < 0 || temp > 2) {
            return false;
        }
        return true;
    }

    function validateApiKey(key) {
        return key && key.trim() !== "";
    }

    function buildGeminiApiUrl() {
        return `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;
    }

    function buildStyledPrompt(queryText) {
        const styleInstruction = RESPONSE_STYLE_INSTRUCTIONS[selectedResponseStyle] || RESPONSE_STYLE_INSTRUCTIONS.balanced;
        return `${queryText}\n\nAnswer the request directly. Do not say \"the image says\" or \"the page says\" when you can refer to the subject itself. Use clear English and preserve necessary technical terms. ${styleInstruction}`;
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
            send: '<path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path>',
            list: '<path d="M9 6h11M9 12h11M9 18h11"></path><path d="M4 6h.01M4 12h.01M4 18h.01"></path>',
            explain: '<circle cx="12" cy="12" r="9"></circle><path d="M9.6 9a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1.3.9-1.3 1.6v.3"></path><path d="M12 17h.01"></path>',
            answer: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4A8 8 0 1 1 21 12Z"></path>',
            eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.5"></circle>',
            eyeOff: '<path d="m3 3 18 18"></path><path d="M10.6 6.2A10.6 10.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16.4 16.4 0 0 1-2.1 2.8M6.3 6.3C3.9 8 2.5 12 2.5 12s3.5 6 9.5 6c1 0 2-.2 2.8-.5"></path>',
            external: '<path d="M15 3h6v6M21 3l-9 9"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>',
            spark: '<path d="m12 3 1.3 4.2L17.5 9l-4.2 1.8L12 15l-1.3-4.2L6.5 9l4.2-1.8Z"></path><path d="m18.5 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7Z"></path>',
            star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"></path>',
            code: '<path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 6l-4 12"></path>',
            key: '<circle cx="8" cy="15" r="4"></circle><path d="m11 12 8-8M16 7l2 2M14 9l2 2"></path>'
        };
        return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name] || ''}</svg>`;
    }

    let geminiApiUrl = buildGeminiApiUrl();

    // Remove a previous panel instance before opening a fresh one.
    try {
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

        const idsToRemove = ['gemini-screenshot-overlay', 'gemini-selection-rectangle', 'gemini-popup', 'gemini-temp-error', 'gemini-uncaught-error-fallback'];
        idsToRemove.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.remove();
            }
        });

        if (document.body.classList.contains('gemini-extension-active')) {
            document.body.classList.remove('gemini-extension-active');
        }

        let overlay, selectionRectDiv, startX, startY, isSelecting = false;
        let capturedImageData = null;
        let popup, queryInput, responseArea, sendButton;
        let refreshModeControls = () => {};

        // Capture selection
        function startCaptureSelection() {
            overlay = document.createElement('div');
            overlay.id = 'gemini-screenshot-overlay';
            document.body.appendChild(overlay);
            selectionRectDiv = document.createElement('div');
            selectionRectDiv.id = 'gemini-selection-rectangle';
            selectionRectDiv.style.display = 'none';
            overlay.appendChild(selectionRectDiv);
            overlay.addEventListener('mousedown', handleMouseDown);
            overlay.addEventListener('mousemove', handleMouseMove);
            overlay.addEventListener('mouseup', handleMouseUp);
            overlay.addEventListener('mouseleave', cancelSelection);

            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.zIndex = '2147483647';
            overlay.style.backgroundColor = 'rgba(0, 100, 200, 0.1)';
            overlay.style.cursor = 'crosshair';
        }

        function handleMouseDown(e) {
            if (e.button !== 0) return;
            startX = e.clientX;
            startY = e.clientY;
            selectionRectDiv.style.left = startX + 'px';
            selectionRectDiv.style.top = startY + 'px';
            selectionRectDiv.style.width = '0px';
            selectionRectDiv.style.height = '0px';
            selectionRectDiv.style.display = 'block';
            isSelecting = true;
            e.preventDefault();
        }

        function handleMouseMove(e) {
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

        async function handleMouseUp(e) {
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
                capturedImageData = null;
                openAssistantPanel();
                removeCaptureSelection();
                return;
            }

            try {
                const dataUrl = await chrome.runtime.sendMessage({
                    action: "captureVisibleTab",
                    options: { format: "jpeg", quality: 90 }
                });
                if (dataUrl && typeof dataUrl === 'object' && dataUrl.error) {
                    showUserError(`Failed to capture screen: ${dataUrl.error}`);
                    removeCaptureSelection();
                } else if (dataUrl && typeof dataUrl === 'string') {
                    cropCapturedImage(dataUrl, rect.x, rect.y, rect.width, rect.height, (croppedDataUrl) => {
                        if (croppedDataUrl) {
                            capturedImageData = croppedDataUrl.split(',')[1];
                            openAssistantPanel();
                        } else {
                            showUserError("Failed to crop image.");
                        }
                        removeCaptureSelection();
                    });
                } else {
                    showUserError("Failed to capture screen. Please try again.");
                    removeCaptureSelection();
                }
            } catch (error) {
                showUserError(`Capture failed: ${error.message}. Ensure extension is loaded & try reloading page.`);
                removeCaptureSelection();
            }
        }

        function cropCapturedImage(dataUrl, cropX, cropY, cropWidth, cropHeight, callback) {
            const img = new Image();
            img.onload = () => {
                const dpr = window.devicePixelRatio || 1;
                const canvas = document.createElement('canvas');
                canvas.width = cropWidth * dpr;
                canvas.height = cropHeight * dpr;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, cropX * dpr, cropY * dpr, cropWidth * dpr, cropHeight * dpr, 0, 0, cropWidth * dpr, cropHeight * dpr);
                callback(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = () => {
                showUserError("Failed to process image. Page content might be restricted or image failed to load.");
                callback(null);
            }
            img.src = dataUrl;
        }

        function removeCaptureSelection() {
            if (overlay) {
                overlay.removeEventListener('mousedown', handleMouseDown);
                overlay.removeEventListener('mousemove', handleMouseMove);
                overlay.removeEventListener('mouseup', handleMouseUp);
                overlay.removeEventListener('mouseleave', cancelSelection);
                overlay.remove();
                overlay = null;
            }
            if (selectionRectDiv) {
                selectionRectDiv.remove();
                selectionRectDiv = null;
            }
        }

        function cancelSelection() {
            if (isSelecting) {
                isSelecting = false;
            }
        }

        // Assistant panel construction and mode controls
        async function openAssistantPanel() {
            await loadSettings();
            
            const existingPopup = document.getElementById('gemini-popup');
            if (existingPopup) {
                existingPopup.remove();
            }
            
            popup = document.createElement('div');
            popup.id = 'gemini-popup';
            
            const header = document.createElement('div');
            header.id = 'gemini-popup-header';
            const brand = document.createElement('div');
            brand.id = 'gemini-popup-brand';
            const brandIcon = document.createElement('span');
            brandIcon.className = 'gemini-brand-icon';
            brandIcon.innerHTML = iconSvg('vision');
            const title = document.createElement('span');
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
            instructionsButton.setAttribute('aria-expanded', 'false');
            
            const settingsButton = document.createElement('button');
            settingsButton.id = 'gemini-settings-button';
            settingsButton.className = 'gemini-header-action';
            settingsButton.innerHTML = `${iconSvg('settings')}<span>Settings</span>`;
            settingsButton.title = 'Settings';
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
            const modeButtons = [];

            const modeRail = document.createElement('div');
            modeRail.id = 'gemini-mode-rail';
            modeRail.setAttribute('role', 'tablist');
            modeRail.setAttribute('aria-label', 'AI Vision mode');
            MODES.forEach((mode) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.mode = mode.value;
                button.textContent = mode.label;
                button.setAttribute('role', 'tab');
                button.onclick = () => {
                    selectedMode = mode.value;
                    saveSettings();
                    if (selectedMode === 'capture' && !capturedImageData) {
                        closeAssistantPanel();
                        startCaptureSelection();
                        return;
                    }
                    closeUtilityPanels();
                    renderSelectedMode();
                };
                modeButtons.push(button);
                modeRail.appendChild(button);
            });
            content.appendChild(modeRail);

            const agentModeRow = document.createElement('div');
            agentModeRow.id = 'gemini-agent-mode-row';
            const agentModeCopy = document.createElement('div');
            agentModeCopy.className = 'gemini-agent-mode-copy';
            const agentModeLabel = document.createElement('span');
            agentModeLabel.textContent = 'Agent Mode';
            const agentModeDescription = document.createElement('small');
            agentModeCopy.appendChild(agentModeLabel);
            agentModeCopy.appendChild(agentModeDescription);
            const agentModeToggle = document.createElement('button');
            agentModeToggle.type = 'button';
            agentModeToggle.className = 'gemini-switch';
            agentModeToggle.setAttribute('role', 'switch');
            agentModeToggle.setAttribute('aria-label', 'Agent Mode');
            agentModeToggle.onclick = () => {
                isAgentModeEnabled = !isAgentModeEnabled;
                saveSettings();
                renderSelectedMode();
            };
            agentModeRow.appendChild(agentModeCopy);
            agentModeRow.appendChild(agentModeToggle);
            content.appendChild(agentModeRow);
            
            const instructionsPanel = document.createElement('div');
            instructionsPanel.id = 'gemini-instructions-panel';

            const helpIntro = document.createElement('p');
            helpIntro.className = 'gemini-help-intro';
            helpIntro.textContent = 'Choose a mode above the question box. Your mode and response style stay selected until you change them.';

            const helpList = document.createElement('ul');
            helpList.className = 'gemini-help-list';
            [
                ['Capture', 'Drag over a page area, then ask Gemini about the image.'],
                ['The Tab', 'Read and ask about the current page.'],
                ['All Tabs', 'Compare supported pages in the starting Chrome window.'],
                ['Agent Mode', 'Turn it on in any mode to let AI Vision complete a multi-step task. Capture and The Tab stay in one tab; All Tabs stays in one window.']
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
            shortcutNote.textContent = 'Press Control + E to close AI Vision.';

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
                const settingsPanel = document.getElementById('gemini-settings-panel');
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
            apiKeyStatus.textContent = validateApiKey(geminiApiKey) ? 'Saved locally' : 'Required';
            apiKeyStatus.classList.toggle('valid', validateApiKey(geminiApiKey));
            apiKeyTitle.appendChild(apiKeyIcon);
            apiKeyTitle.appendChild(apiKeyLabel);
            apiKeyTitleRow.appendChild(apiKeyTitle);
            apiKeyTitleRow.appendChild(apiKeyStatus);
            const apiKeyField = document.createElement('div');
            apiKeyField.className = 'gemini-api-key-field';
            const apiKeyInput = document.createElement('input');
            apiKeyInput.id = 'gemini-settings-api-key';
            apiKeyInput.type = 'password';
            apiKeyInput.value = geminiApiKey;
            apiKeyInput.placeholder = 'Enter your Gemini API key';
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

            const apiKeyHelp = document.createElement('div');
            apiKeyHelp.className = 'api-key-help';
            apiKeyHelp.innerHTML = `Stored only in this Chrome profile · <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Get a key ${iconSvg('external')}</a>`;
            
            const apiKeyError = document.createElement('div');
            apiKeyError.className = 'error-message';
            if (!validateApiKey(geminiApiKey)) {
                apiKeyError.textContent = 'Put an API key';
            }
            
            apiKeyGroup.appendChild(apiKeyTitleRow);
            apiKeyGroup.appendChild(apiKeyField);
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
            
            MODELS.forEach((model) => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                option.selected = model === selectedModel;
                modelSelect.appendChild(option);
            });
            
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

            const settingsFooter = document.createElement('div');
            settingsFooter.className = 'gemini-settings-footer';
            settingsFooter.innerHTML = `${iconSvg('spark')}<span>Changes save automatically. Agent Mode stays above the question box.</span>`;

            settingsPanel.appendChild(apiKeyGroup);
            settingsPanel.appendChild(compactSettingsGrid);
            settingsPanel.appendChild(tempGroup);
            settingsPanel.appendChild(settingsFooter);
            content.appendChild(settingsPanel);
            
            apiKeyInput.oninput = (e) => {
                const newKey = e.target.value.trim();
                if (validateApiKey(newKey)) {
                    geminiApiKey = newKey;
                    apiKeyError.textContent = '';
                    apiKeyStatus.textContent = 'Saved locally';
                    apiKeyStatus.classList.add('valid');
                } else {
                    geminiApiKey = '';
                    apiKeyError.textContent = 'Put an API key';
                    apiKeyStatus.textContent = 'Required';
                    apiKeyStatus.classList.remove('valid');
                }
                geminiApiUrl = buildGeminiApiUrl();
                saveSettings();
            };
            
            modelSelect.onchange = (e) => {
                selectedModel = e.target.value;
                geminiApiUrl = buildGeminiApiUrl();
                saveSettings();
            };

            responseStyleSelect.onchange = (e) => {
                selectedResponseStyle = e.target.value;
                saveSettings();
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
                saveSettings();
            };
            
            textOnlyMessage = document.createElement('div');
            textOnlyMessage.className = 'gemini-mode-note';
            content.appendChild(textOnlyMessage);

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
            content.appendChild(composer);
            
            if (capturedImageData !== null) {
                presetsDiv = document.createElement('div');
                presetsDiv.id = 'gemini-popup-presets';
                const presets = [
                    { text: "Summarize", icon: "list", query: "Summarize the captured content." },
                    { text: "Explain", icon: "explain", query: "Explain the captured content and what it means." },
                    { text: "Answer", icon: "answer", query: "Answer the question or request shown in the captured content." }
                ];
                presets.forEach(preset => {
                    const button = document.createElement('button');
                    button.innerHTML = `${iconSvg(preset.icon)}<span>${preset.text}</span>`;
                    button.onclick = () => submitUserRequest(preset.query);
                    presetsDiv.appendChild(button);
                });
                content.appendChild(presetsDiv);
            }
            
            responseArea = document.createElement('div');
            responseArea.id = 'gemini-popup-response-area';
            responseArea.textContent = 'Put in a question';
            content.appendChild(responseArea);

            function renderSelectedMode() {
                modeButtons.forEach((button) => {
                    const isActive = button.dataset.mode === selectedMode;
                    button.classList.toggle('active', isActive);
                    button.setAttribute('aria-selected', String(isActive));
                    button.tabIndex = isActive ? 0 : -1;
                });

                agentModeToggle.classList.toggle('active', isAgentModeEnabled);
                agentModeToggle.setAttribute('aria-checked', String(isAgentModeEnabled));

                if (selectedMode === 'capture') {
                    queryInput.placeholder = 'Ask about what you captured';
                    agentModeDescription.textContent = 'Can use the capture and act in The Tab';
                    textOnlyMessage.textContent = isAgentModeEnabled
                        ? 'Agent Mode can use the capture and act only in The Tab'
                        : capturedImageData
                            ? 'Using the area you captured'
                            : 'No capture selected — your question will be text only';
                } else if (selectedMode === 'tab') {
                    queryInput.placeholder = 'Ask about The Tab';
                    agentModeDescription.textContent = 'Can read, navigate, and act in The Tab';
                    textOnlyMessage.textContent = isAgentModeEnabled
                        ? 'Agent Mode can read and act only in The Tab'
                        : 'Reads the page and sees The Tab';
                } else {
                    queryInput.placeholder = 'Ask across this Chrome window';
                    agentModeDescription.textContent = 'Can search, switch tabs, and act in this window';
                    textOnlyMessage.textContent = isAgentModeEnabled
                        ? 'Agent Mode can search and act only in this Chrome window'
                        : 'Reads supported pages across this Chrome window';
                }

                if (presetsDiv) {
                    presetsDiv.hidden = selectedMode !== 'capture';
                }

                if (!sendButton.disabled) {
                    const label = isAgentModeEnabled ? 'Start task' : 'Send';
                    const icon = isAgentModeEnabled ? 'spark' : 'send';
                    sendButton.innerHTML = `${iconSvg(icon)}<span>${label}</span>`;
                }
            }
            refreshModeControls = renderSelectedMode;
            
            popup.appendChild(header);
            popup.appendChild(content);
            
            document.body.appendChild(popup);
            enablePanelDragging(popup, header);
            renderSelectedMode();
            queryInput.focus();
        }

        function closeAssistantPanel() {
            if (popup) {
                popup.remove();
                popup = null;
            }
            capturedImageData = null;
        }

        // Request state and progress rendering
        function setRequestInProgress(isLoading, label = 'Sending') {
            sendButton.disabled = isLoading;
            sendButton.classList.toggle('loading', isLoading);
            if (isLoading) {
                sendButton.innerHTML = `<span class="gemini-spinner" aria-hidden="true"></span><span>${label}</span>`;
                sendButton.setAttribute('aria-busy', 'true');
            } else {
                sendButton.removeAttribute('aria-busy');
                refreshModeControls();
            }
            document.querySelectorAll('#gemini-mode-rail button, #gemini-agent-mode-row button').forEach((button) => {
                button.disabled = isLoading;
            });
        }

        function renderAgentProgress(step = 1, message = 'Understanding your task') {
            const contextLabel = selectedMode === 'all-tabs' ? 'Reading this Chrome window' : 'Reading The Tab';
            const steps = [
                'Understanding your task',
                contextLabel,
                'Acting and finishing'
            ];
            responseArea.textContent = '';
            responseArea.classList.remove('error');
            responseArea.classList.add('automation');

            const title = document.createElement('strong');
            title.textContent = 'Agent Mode is working';
            responseArea.appendChild(title);

            const status = document.createElement('span');
            status.className = 'gemini-automation-status';
            status.textContent = message;
            responseArea.appendChild(status);

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
        }

        // Context collection and Gemini requests
        async function captureVisibleSourceTab() {
            if (!popup) return null;
            const previousVisibility = popup.style.visibility;
            popup.style.visibility = 'hidden';
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            try {
                const dataUrl = await chrome.runtime.sendMessage({
                    action: 'captureVisibleTab',
                    options: { format: 'jpeg', quality: 88 }
                });
                if (typeof dataUrl !== 'string' || !dataUrl.includes(',')) return null;
                return dataUrl.split(',')[1];
            } finally {
                if (popup) popup.style.visibility = previousVisibility;
            }
        }

        function formatTabContextForGemini(context) {
            if (!context || !Array.isArray(context.tabs)) return '';
            const tabSections = context.tabs.map((tab, index) => {
                const content = tab.restricted
                    ? `[This page could not be read: ${tab.reason || 'restricted Chrome page'}]`
                    : (tab.text || '[No readable page text]');
                return `TAB ${index + 1}\nTitle: ${tab.title || 'Untitled'}\nURL: ${tab.url || 'Unavailable'}\n${content}`;
            });
            return `Browser context from the Chrome window where AI Vision is open:\n\n${tabSections.join('\n\n---\n\n')}`;
        }

        async function requestGeminiAnswer(parts) {
            const response = await fetch(geminiApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': geminiApiKey
                },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { temperature: responseTemperature }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: 'Unknown API error structure' } }));
                const errorMessage = errorData?.error?.message || 'No specific message.';
                if (errorMessage.includes('API key not valid')) {
                    throw new Error('API key not valid. Please put in a valid API key.');
                }
                throw new Error(`API Error: ${response.status} ${response.statusText}. ${errorMessage}`);
            }

            const data = await response.json();
            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (responseText) return stripLightMarkdown(responseText);
            if (data.promptFeedback?.blockReason) {
                throw new Error(`Blocked: ${data.promptFeedback.blockReason}. ${data.promptFeedback.blockReasonMessage || ''}`.trim());
            }
            throw new Error('Received an empty or unexpected response from Gemini.');
        }

        async function submitUserRequest(presetQuery = null) {
            if (!validateApiKey(geminiApiKey)) {
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
            setRequestInProgress(true, shouldRunAgent ? 'Working' : 'Sending');
            responseArea.classList.remove('error', 'automation');

            try {
                if (shouldRunAgent) {
                    renderAgentProgress(1, 'Understanding your task');
                    const taskResult = await chrome.runtime.sendMessage({
                        action: 'runAgentTask',
                        task: queryText,
                        mode: requestMode,
                        captureImageData: requestMode === 'capture' ? capturedImageData : null,
                        apiKey: geminiApiKey,
                        model: selectedModel,
                        temperature: responseTemperature,
                        responseStyle: selectedResponseStyle
                    });
                    if (!taskResult || taskResult.error) {
                        throw new Error(taskResult?.error || 'The browser task could not be completed.');
                    }
                    responseArea.classList.remove('automation');
                    responseArea.textContent = stripLightMarkdown(taskResult.summary || 'Task completed.');
                    return;
                }

                responseArea.textContent = requestMode === 'capture'
                    ? 'Analyzing your capture'
                    : requestMode === 'tab'
                        ? 'Reading this tab'
                        : 'Reading tabs in this window';

                const parts = [];
                if (requestMode === 'capture' && capturedImageData) {
                    parts.push({ inline_data: { mime_type: 'image/jpeg', data: capturedImageData } });
                }

                if (requestMode === 'tab') {
                    const [context, tabImage] = await Promise.all([
                        chrome.runtime.sendMessage({ action: 'collectSourceTabContext' }),
                        captureVisibleSourceTab()
                    ]);
                    if (context?.error) throw new Error(context.error);
                    const browserContext = formatTabContextForGemini(context);
                    if (browserContext) parts.push({ text: browserContext });
                    if (tabImage) parts.push({ inline_data: { mime_type: 'image/jpeg', data: tabImage } });
                } else if (requestMode === 'all-tabs') {
                    const context = await chrome.runtime.sendMessage({ action: 'collectWindowContext' });
                    if (context?.error) throw new Error(context.error);
                    const browserContext = formatTabContextForGemini(context);
                    if (browserContext) parts.push({ text: browserContext });
                }

                parts.push({ text: buildStyledPrompt(queryText) });
                responseArea.textContent = await requestGeminiAnswer(parts);
            } catch (error) {
                responseArea.classList.remove('automation');
                responseArea.textContent = `Error: ${error.message}`;
                responseArea.classList.add('error');
            } finally {
                setRequestInProgress(false);
            }
        }

        // Panel interaction and cleanup
        function enablePanelDragging(element, handle) {
            let dragMouseMoveHandler, dragMouseUpHandler;
            handle.onmousedown = function(event) {
                if (event.button !== 0) return;
                event.preventDefault();
                let shiftX = event.clientX - element.getBoundingClientRect().left;
                let shiftY = event.clientY - element.getBoundingClientRect().top;
                element.style.position = 'fixed';
                function moveAt(mouseClientX, mouseClientY) {
                    let newX = mouseClientX - shiftX;
                    let newY = mouseClientY - shiftY;
                    const maxX = window.innerWidth - element.offsetWidth;
                    const maxY = window.innerHeight - element.offsetHeight;
                    newX = Math.max(0, Math.min(newX, maxX));
                    newY = Math.max(0, Math.min(newY, maxY));
                    element.style.left = newX + 'px';
                    element.style.top = newY + 'px';
                }
                moveAt(event.clientX, event.clientY);
                dragMouseMoveHandler = function(e_move) { moveAt(e_move.clientX, e_move.clientY); };
                window.geminiExtensionGlobalDragMouseMove = dragMouseMoveHandler;
                dragMouseUpHandler = function() {
                    document.removeEventListener('mousemove', dragMouseMoveHandler);
                    document.removeEventListener('mouseup', dragMouseUpHandler);
                    if(handle) handle.style.userSelect = '';
                    window.geminiExtensionGlobalDragMouseMove = null;
                    window.geminiExtensionGlobalDragMouseUp = null;
                };
                window.geminiExtensionGlobalDragMouseUp = dragMouseUpHandler;
                document.addEventListener('mousemove', dragMouseMoveHandler);
                document.addEventListener('mouseup', dragMouseUpHandler);
                if(handle) handle.style.userSelect = 'none';
            };
            if(handle) handle.ondragstart = () => false;
        }

        function showUserError(message) {
            if (responseArea && popup && popup.parentNode) {
                responseArea.textContent = message;
                responseArea.classList.add('error');
            } else {
                let tempErrorDiv = document.getElementById('gemini-temp-error');
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

                document.body.appendChild(tempErrorDiv);
                setTimeout(() => { if (tempErrorDiv && tempErrorDiv.parentNode) tempErrorDiv.remove(); }, 5000);
            }
        }

        const runtimeMessageListener = (request, sender, sendResponse) => {
            if (request.action === 'agentModeProgress' && responseArea && popup) {
                renderAgentProgress(request.step || 1, request.message || 'Working in this window');
                sendResponse({ status: 'received' });
                return false;
            }
        };
        window.geminiExtensionRuntimeMessageListener = runtimeMessageListener;
        chrome.runtime.onMessage.addListener(runtimeMessageListener);

        const keydownListener = (e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                if (document.getElementById('gemini-screenshot-overlay')) {
                    removeCaptureSelection();
                }
                if (document.getElementById('gemini-popup')) {
                    closeAssistantPanel();
                }
            }
        };
        window.geminiExtensionKeydownListener = keydownListener;
        document.addEventListener('keydown', keydownListener);

        function openSelectedMode() {
            if (selectedMode === 'capture') {
                startCaptureSelection();
            } else {
                capturedImageData = null;
                openAssistantPanel();
            }
        }

        // First-run API key setup
        function openApiKeySetup() {
            const popup = document.createElement('div');
            popup.id = 'gemini-api-key-popup';
            popup.innerHTML = `
                <div id="gemini-api-key-header">Enter API Key <button id="gemini-api-key-close">×</button></div>
                <div id="gemini-api-key-body">
                    <p>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a> to get your API key</p>
                    <input type="password" id="gemini-api-key-input" placeholder="Enter your API key here" />
                    <button id="gemini-api-key-save">Save</button>
                </div>
            `;
            document.body.appendChild(popup);

            const closeButton = document.getElementById('gemini-api-key-close');
            const saveButton = document.getElementById('gemini-api-key-save');

            closeButton.addEventListener('click', () => {
                popup.remove();
                chrome.storage.local.set({ 'needApiKeyPopup': true });
            });

            saveButton.addEventListener('click', () => {
                const apiKeyInput = document.getElementById('gemini-api-key-input');
                const apiKey = apiKeyInput.value.trim();
                if (apiKey) {
                    geminiApiKey = apiKey;
                    chrome.storage.local.set({
                        'geminiApiKey': apiKey,
                        'needApiKeyPopup': false
                    }, () => {
                        saveSettings();
                        popup.remove();
                        openSelectedMode();
                    });
                } else {
                    alert('Please enter a valid API key.');
                }
            });

            popup.style.position = 'fixed';
            popup.style.top = '50px';
            popup.style.right = '50px';
        }

        (async () => {
            try {
                await loadSettings();
                chrome.storage.local.get(['needApiKeyPopup', 'geminiApiKey'], (result) => {
                    if (!result.geminiApiKey || result.needApiKeyPopup) {
                        openApiKeySetup();
                    } else {
                        openSelectedMode();
                    }
                });
            } catch (error) {
                console.error('Error during initialization:', error);
                openApiKeySetup();
            }
        })();

    } catch (e) {
        try {
            let errorFallbackDiv = document.getElementById('gemini-uncaught-error-fallback');
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
            document.body.appendChild(errorFallbackDiv);
            setTimeout(() => { if (errorFallbackDiv) errorFallbackDiv.remove(); }, 10000);
        } catch (fallbackError) {
        }
    }
})();
