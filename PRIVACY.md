# AI Vision Privacy Notice

Last updated: August 27, 2026

AI Vision is a Chrome extension that lets a user ask Google's Gemini API about a selected screenshot, the current tab, or supported tabs in one Chrome window. Optional Agent Mode can perform a limited browser task within the scope selected by the user.

## Data AI Vision handles

Only when the user invokes a feature, AI Vision may handle:

- the user's question, response-style choice, selected model, and task controls;
- a screenshot region selected by the user;
- visible webpage text, page titles, page URLs, and labels or destinations of visible interactive elements;
- titles, sanitized URLs, and bounded readable content from up to 20 supported tabs in the starting Chrome window;
- a Gemini API key supplied by the user; and
- local preferences such as mode, temperature, response style, and whether Agent Mode is enabled.

AI Vision does not read the user's saved Chrome browsing-history database. Page text, labels, URLs, and screenshots are treated as untrusted model input and cannot authorize an extension action.

## How data is used and shared

AI Vision uses this information only to provide the feature the user requested. For ordinary questions, the necessary prompt, screenshot, and webpage context are sent directly from the service worker to Google's Gemini API over HTTPS. The extension API key is sent to Google in the `x-goog-api-key` request header for authentication.

When the user grants optional loopback access and runs the Google ADK companion, Agent Mode sends its bounded planning prompt to `127.0.0.1`. The user-operated companion uses its own `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable to call Gemini through Google ADK and returns one structured plan. The extension never sends its stored API key to the companion. If the companion is unavailable, Agent Mode uses the extension's constrained direct-Gemini fallback.

AI Vision has no developer-operated analytics, advertising, tracking, proxy, or data-collection server. The developer does not sell or rent user data. Data sent to Google is handled under Google's applicable Gemini API and privacy terms.

URLs sent as context have query strings and fragments removed. HTTP pages may be read when the user invokes the feature, while Agent Mode navigation is restricted to safe HTTPS URLs.

## Storage and retention

The full Gemini API key and preferences are stored locally in the current Chrome profile through `chrome.storage.local`. Local storage access is restricted to trusted extension contexts, and the content script receives only a boolean key status and masked suffix. The full key is not rendered in the page DOM or sent to the content panel's settings state.

AI Vision does not intentionally store screenshots, page content, prompts, Gemini responses, or task context on a developer server. In-progress Agent Mode state may be held in Chrome session storage so a service-worker restart can validate a task ID; it is removed when the task ends or is cancelled. The optional local ADK companion stores only its next model index and request count in `adk/.data/`; it does not intentionally persist prompt or page context. Users can remove extension data by clearing the extension's data or uninstalling it, and can remove local rotation state by deleting that companion data directory.

## Agent Mode controls

Agent Mode is off unless the user enables it. Capture and The Tab can act only in the source tab. All Tabs is limited to the starting Chrome window and stops if the source tab moves to another window. Each task has a task ID, a 12-step limit, cancellation, timeouts, and bounded context.

Reading, waiting, scrolling, and activating an existing in-scope tab can proceed automatically. Every click, text entry, direct navigation, new-tab open, history movement, and reload requires explicit user approval. New tabs are limited to All Tabs mode and the starting window; closing tabs and cross-window movement are not exposed as agent actions. AI Vision permanently blocks password, credential, payment, authentication-code, purchase, deletion, upload, publication, messaging, sign-in, subscription, permission, and legal-acceptance actions. Approved click and type actions are rechecked against a live DOM signature immediately before execution.

## Permissions

- `activeTab` supports user-initiated access to the page where AI Vision is opened.
- `scripting` injects packaged code and obtains visible page context or performs a permitted action.
- `contextMenus` provides the right-click launcher.
- `storage` stores the key and preferences locally.
- `https://generativelanguage.googleapis.com/*` is the narrow Gemini API host permission.
- Optional `http://127.0.0.1/*` access connects Agent Mode to a companion runtime that the user starts locally.
- Optional `tabs`, `http://*/*`, and `https://*/*` access is requested only when the user chooses All Tabs or an All Tabs Agent task.

Chrome internal pages, the Chrome Web Store, and other restricted pages are not accessible to these features.

## Remote code

AI Vision does not use remotely hosted executable code. JavaScript and CSS are packaged with the extension. Gemini responses are parsed as data; they are never evaluated, imported, or executed as code.

## Limited use

AI Vision's use and transfer of information received from Google APIs follows the Chrome Web Store User Data Policy, including its Limited Use requirements. Data is used only to provide the extension's prominent user-facing features and for security or legal compliance where required.

## Contact

Questions about this notice can be sent to `gitchub@gmail.com`.
