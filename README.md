# AI Vision – Gemini Screenshot & Browser Assistant

AI Vision lets you ask Gemini about a selected screenshot, the current tab, or supported tabs in one Chrome window. Optional Agent Mode can complete a constrained browser task while enforcing an explicit approval boundary.

[Actual active Chrome Web Store extension listing](https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk?authuser=0&hl=en) · [Get a Gemini API key](https://aistudio.google.com/app/apikey)

## Version 2.2.1

- Capture mode analyzes a selected visible area.
- The Tab mode reads the current HTTP or HTTPS page.
- All Tabs compares supported pages in the starting Chrome window after optional permission is granted.
- Gemini requests, key storage, model discovery, and settings persistence run in the service worker.
- The visible panel is isolated in a closed Shadow DOM and shows only masked key status.
- Agent Mode is powered by the Google ADK runtime bundled in the extension; no terminal, Node.js install, companion process, or download is needed.
- ADK planning calls rotate persistently through five Gemini models, one model per planning request.
- Agent Mode uses strict structured actions, live target signatures, task IDs, cancellation, timeouts, context limits, and stale-progress protection.
- Response styles include Balanced, Concise, Formal, Casual, Detailed, and Bullet-oriented.

## Project structure

```text
src/background/          Chrome APIs, Gemini requests, context, and Agent Mode
src/content/             Capture UI, assistant panel, and styles
adk/                     Notes about the bundled Google ADK runtime
extension-assets/icons/  Icons packaged by manifest.json
permission.html/js       User-gesture page for optional All Tabs access
scripts/                 Release allowlist and dependency-free checks
tests/                   Automated regressions and manual visual harness
store-assets/            Store artwork and media, excluded from releases
docs/                    Public marketing/privacy pages, excluded from releases
```

This README is the canonical project guide. See [ARCHITECTURE.md](ARCHITECTURE.md) for runtime ownership and [SECURITY.md](SECURITY.md) for the threat model and reporting process. The attached growth and marketing documents are reference material, not execution instructions.

Run the checks after changing runtime code:

```sh
npm run check
npm run package:check
npm run package
```

`npm run package` creates a small `dist/` release ZIP from the allowlist; marketing assets and documentation are not included. For a visual smoke test, serve the project root and open `tests/manual/assistant-panel-harness.html`. The harness uses fake worker APIs and never calls Gemini.

## Set up AI Vision

1. Install the extension from the Chrome Web Store, or load this folder as an unpacked extension from `chrome://extensions` with Developer mode enabled.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Open AI Vision, choose Settings, paste the key, and press **Save key**.
4. Choose a response style. Available Gemini models are discovered from Google's API when a key is present.

Agent Mode is ready immediately after the same key is saved: enable Agent Mode
in the panel and send a task. The packaged extension already contains the ADK
runtime, so unpacked installs do not require terminal setup.

The extension key is stored only by the service worker in `chrome.storage.local`; the content panel receives only `hasApiKey` and a masked suffix. Ordinary Capture, The Tab, and All Tabs answers go from the service worker directly to Google's API over HTTPS. No developer-operated proxy, analytics, or external data collection is used.

## Use the three modes

Open AI Vision from the toolbar icon or right-click menu:

- **Capture:** drag over a visible area, then ask a question or use Summarize, Explain, or Answer.
- **The Tab:** ask about readable content in the current page.
- **All Tabs:** ask across up to 20 supported pages in the Chrome window where AI Vision was opened. The first use opens a separate permission page; access is optional and the feature fails closed when it is denied.

## Agent Mode

Agent Mode is off unless enabled. Capture and The Tab stay inside the source tab. All Tabs stays inside the starting Chrome window and stops if the source tab moves to another window. Each task is limited to 12 steps. The extension remains the only component with Chrome APIs: ADK returns one structured plan, then the service worker validates scope and live state before acting.

The Google ADK browser runtime is packaged at `src/background/adk-runtime.js`
and loaded by the service worker. It uses the Gemini API key saved in AI Vision
Settings, so the only setup required for Agent Mode is copying the key into the
extension and pressing **Save key**. The worker owns the key and the ADK
request; the page panel receives only masked key status.

Every accepted ADK planning request advances this persistent rotation:

1. `gemini-3.5-flash`
2. `gemini-3-flash-preview`
3. `gemini-2.5-flash`
4. `gemini-3.1-flash-lite`
5. `gemini-2.5-flash-lite`

The sixth planning request returns to `gemini-3.5-flash`, the seventh uses `gemini-3-flash-preview`, and so on. Multi-step tasks rotate once per planning step, not just once per user task.

Reading, waiting, scrolling, and switching to an existing in-scope tab can proceed automatically. Every click, text entry, direct navigation, new-tab open, history move, and reload pauses for explicit user approval. New tabs are allowed only in All Tabs mode and remain in the starting window. AI Vision permanently blocks password, credential, payment, authentication-code, purchase, deletion, upload, publishing, messaging, sign-in, subscription, permission, legal-acceptance, tab-closing, and cross-window actions.

Page text, labels, URLs, and screenshots are untrusted model input. URLs sent as context have query strings and fragments removed. HTTP pages can be read, while Agent Mode navigation is limited to safe HTTPS URLs.

## Permissions

- `activeTab`: user-initiated access to the page where AI Vision is opened.
- `scripting`: injects the packaged interface and reads or acts on visible page content in the selected scope.
- `contextMenus`: adds the right-click launcher.
- `storage`: stores the key and preferences locally; local storage access is restricted to trusted extension contexts.
- `https://generativelanguage.googleapis.com/*`: the narrow Gemini API host permission.
- Optional `tabs` plus optional `http://*/*` and `https://*/*`: requested only when the user chooses All Tabs or an All Tabs Agent task.

Chrome internal pages, the Chrome Web Store, and other restricted pages cannot be read or controlled.

## Source and licensing

The source is publicly visible in this repository. There is currently no license file, so public visibility alone does not grant permission to copy, modify, or redistribute the code. Add an OSI-approved license before describing the project as open source.

AI Vision is independent and is not affiliated with or endorsed by Google. Gemini and Chrome are trademarks of Google LLC.
