# AI Vision architecture

AI Vision is a Manifest V3 Chrome extension with two runtime parts:

1. `src/background/service-worker.js` owns Chrome APIs, tab context, Agent Mode planning, scope checks, and guarded browser actions.
2. `src/content/assistant-panel.js` owns capture selection, the 500 × 500 assistant interface, settings, and direct Gemini answers. Its styles live beside it in `assistant-panel.css`.

The service worker injects the content files only after the user clicks the toolbar icon or AI Vision context-menu item.

## Project map

```text
AI_Vision-main/
├── manifest.json                  Chrome extension entry point and permissions
├── package.json                   Dependency-free development check command
├── README.md                      User setup and feature guide
├── ARCHITECTURE.md                Runtime ownership and data flow
├── PRIVACY.md                     Data-handling disclosure
├── STORE_LISTING.md               Chrome Web Store copy and justifications
├── GROWTH_PLAYBOOK.md             Distribution and adoption ideas
├── src/
│   ├── background/
│   │   └── service-worker.js      Chrome APIs, page context, and Agent Mode
│   └── content/
│       ├── assistant-panel.js     Capture UI, modes, settings, and Gemini answers
│       └── assistant-panel.css    Light-blue fixed-size interface styles
├── extension-assets/
│   └── icons/                     Icons packaged with the extension
├── tests/
│   ├── extension-architecture.test.js
│   │                              Runtime path and scope regression checks
│   └── manual/                    Local browser harnesses for visual smoke tests
├── store-assets/
│   ├── screenshots/               Five numbered Chrome Web Store screenshots
│   ├── promotional/               Small and marquee promotional tiles
│   ├── branding/                  Store icon and editable source image
│   ├── media/                     Demo and marketing source media
│   └── archive/                   Legacy artwork kept out of active assets
└── docs/                           Self-contained public website for GitHub Pages
    └── assets/                     Website images deployed with `docs/`
```

`docs/assets/` intentionally contains deployment-ready copies of selected store visuals. Keeping the website self-contained prevents its image paths from depending on files outside the published `docs/` directory.

## Runtime flow

```text
Toolbar click or context menu
        ↓
service-worker.js injects the assistant panel
        ↓
User chooses Capture, The Tab, or All Tabs
        ↓
assistant-panel.js either asks Gemini directly
or requests tab context / Agent Mode from the service worker
        ↓
service-worker.js enforces tab/window scope before every agent action
```

## Mode ownership

| Mode | Agent Mode off | Agent Mode on |
| --- | --- | --- |
| Capture | Sends the selected image and question to Gemini | Uses the image as context and acts only in the source tab |
| The Tab | Reads and captures the source tab, then asks Gemini | Reads and acts only in the source tab |
| All Tabs | Reads supported tabs in the starting Chrome window | Reads and acts only in that starting Chrome window |

The source tab is the tab where the user opened AI Vision. Agent Mode checks its scope before every step and stops after 12 steps.

## Internal messages

The content script sends four descriptive actions to the service worker:

- `captureVisibleTab`: capture the visible source tab as JPEG data.
- `collectSourceTabContext`: read the source tab only.
- `collectWindowContext`: read supported tabs in the source Chrome window.
- `runAgentTask`: plan and execute a scoped Agent Mode task.

The service worker sends `agentModeProgress` back to the content script so the panel can show task progress.

## Persisted settings

All settings are stored locally in the current Chrome profile with `chrome.storage.local`:

- `geminiApiKey`
- `geminiModel`
- `geminiTemperature`
- `geminiMode`
- `geminiResponseStyle`
- `geminiAgentMode`

`geminiAutoBrowse` is read only as a one-time compatibility path for users upgrading from the previous setting name.

## Safety boundary

Agent Mode will not type passwords, payment data, or authentication codes. It also blocks purchases, deletion, publishing, uploads, sign-in, legal acceptance, and similar sensitive actions. Chrome internal pages and other restricted URLs are never read or controlled.

## Naming convention

Names describe intent and scope rather than implementation detail. For example:

- `selectedModel`, not `VERSION`
- `openAssistantInTab`, not `injectContentScript`
- `captureTabSnapshot`, not `snapshotTab`
- `requestNextAgentAction`, not `chooseBrowserAction`
- `executeAgentAction`, not `executeBrowserAction`

When adding code, keep Chrome-privileged work in `src/background/` and page-facing interface work in `src/content/`. Add only packaged runtime files to `manifest.json`; marketing media belongs in `store-assets/`.
