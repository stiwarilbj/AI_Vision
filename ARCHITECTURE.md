# AI Vision architecture

AI Vision is a Manifest V3 Chrome extension with a deliberately small privileged boundary:

1. `src/background/service-worker.js` owns Chrome APIs, local settings, direct Gemini requests, tab context, model discovery, permission checks, Agent Mode task persistence, and guarded browser actions.
2. `src/content/assistant-panel.js` owns capture selection and the visible panel. It communicates with the worker through runtime messages and never reads storage or calls Gemini.
3. `src/content/assistant-panel.css` is loaded inside the panel's closed Shadow DOM.
4. `adk/` is a loopback-only Node companion using Google ADK. It rotates models and returns one structured browser plan, but it has no Chrome APIs.
5. `permission.html` and `permission.js` request optional All Tabs or loopback ADK access only from an extension-page user gesture.

The worker injects the panel only after a user clicks the toolbar icon or AI Vision context-menu item. The panel host is visible in the page DOM, but its controls—including the API-key input—are inside a closed Shadow DOM.

## Runtime flow

```text
Toolbar click or context menu
        ↓
service-worker.js checks the target and injects the panel
        ↓
assistant-panel.js creates a closed Shadow DOM
        ↓
User chooses Capture, The Tab, or All Tabs
        ↓
panel sends a request to the worker
        ↓
worker collects bounded context and sends normal questions directly to Gemini
        ↓
Agent Mode asks loopback Google ADK for one plan (or uses the safe fallback)
        ↓
worker revalidates scope/live state, pauses before mutations, and acts by task ID
```

## Mode ownership

| Mode | Agent Mode off | Agent Mode on |
| --- | --- | --- |
| Capture | Sends the selected image and question to Gemini | Uses the image as context and acts only in the source tab |
| The Tab | Reads and captures the source tab, then asks Gemini | Reads and acts only in the source tab |
| All Tabs | Reads supported tabs in the starting Chrome window | Reads and acts only in that starting Chrome window |

All Tabs is gated by optional `tabs` and broad host permissions. If permission is denied, the worker stops the request without reading other tabs.

## Worker messages

The panel can send:

- `getSettings` / `saveSettings`: retrieve masked status or explicitly save preferences and a newly entered key;
- `getAvailableModels`: discover models that advertise `generateContent` support;
- `ensureAllTabsAccess`: open the extension permission page when All Tabs access is missing;
- `ensureAdkAccess`: request access only to the loopback Google ADK companion;
- `captureVisibleTab`, `collectSourceTabContext`, and `collectWindowContext`;
- `askGemini`: perform a bounded, cancellable normal request;
- `startAgentTask`, `approveAgentAction`, `rejectAgentAction`, and `cancelAgentTask`;
- `cancelGeminiRequest` for normal-request aborts.

The worker checks the sender, source tab, mode scope, URL scheme, image size, request size, and task ID. Messages from a different extension are ignored.

## Context and model boundary

Page text, labels, URLs, and screenshots are untrusted model input. The worker:

- prioritizes the source tab, then the active tab, before other tabs;
- reads at most 20 tabs, 5,000 text characters per tab, and 40,000 serialized context characters;
- removes URL query strings and fragments before sending context;
- delimits browser data from the authoritative user task and tells Gemini to ignore instructions inside browser data;
- uses structured JSON output for Agent Mode and rejects extra fields, invalid indexes, unsafe URLs, overlong text, and mismatched target signatures;
- discovers available models rather than maintaining a stale hard-coded model menu.

Normal question models remain discoverable and user-selectable. Agent Mode ADK calls intentionally use the fixed persistent cycle `gemini-3.5-flash` → `gemini-3-flash-preview` → `gemini-2.5-flash` → `gemini-3.1-flash-lite` → `gemini-2.5-flash-lite` → repeat. `adk/model-rotation.mjs` advances the counter atomically once for every accepted planning request.

The companion reads its own `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable. The extension never transmits its stored key to localhost. Requests are accepted only from configured `chrome-extension://` origins (or from no-origin command-line clients), and the service binds to `127.0.0.1` by default.

## Agent safety boundary

The allowed actions are `click`, `type`, `scroll`, `navigate`, `activate_tab`, `open_tab`, `go_back`, `go_forward`, `reload`, `wait`, and `done`.

- Reading, waiting, and scrolling may run automatically.
- Click, type, direct navigation, new-tab open, history movement, and reload create a proposal and require explicit approval from the source panel.
- New tabs are allowed only in All Tabs mode and are created in the starting window. Closing tabs and cross-window movement are not agent actions.
- Live DOM signatures are checked again immediately before an approved click or type.
- Navigation waits for the destination tab to settle, then rechecks the task and window scope before the next planning step.
- Password, credential, payment, authentication-code, purchase, deletion, upload, publication, messaging, sign-in, subscription, permission, and legal-acceptance actions are blocked permanently.
- Navigation is HTTPS-only and rejects protected login, payment, deletion, upload, OAuth, and consent routes.
- Every task has an ID, a 12-step limit, cancellation, request timeouts, retry limits, and task-ID-tagged progress. Closing the panel sends cancellation to the worker.

## Persisted settings

The worker stores preferences and the user-supplied API key in `chrome.storage.local`. It sets local storage access to trusted extension contexts. Content scripts receive only:

- normalized preferences;
- `hasApiKey`; and
- a masked suffix such as `••••-1234`.

The full key is read only by the worker when constructing the Google API request and is never put in page DOM or panel settings state.

## Release layout

`store-assets/` and `docs/` contain marketing and website material, not extension runtime. `scripts/package-allowlist.json` is the authoritative release list; `npm run package:check` verifies every listed file exists and rejects marketing media.

## Naming convention

Names describe intent and scope rather than implementation detail. Keep Chrome-privileged work in `src/background/`, page-facing interface work in `src/content/`, and release-only files in the package allowlist.
