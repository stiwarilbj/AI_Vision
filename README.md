# AI Vision – Gemini Screenshot & Browser Assistant

Ask Gemini about a screenshot, The Tab you are viewing, or every supported tab in one Chrome window. Turn on Agent Mode in any mode when you want AI Vision to complete a constrained multi-step browser task for you.

[Install AI Vision from the Chrome Web Store](https://chromewebstore.google.com/detail/ai-vision-screenshot-ask/ghmmlbclopoakmjjbkkmoefjldgjimgk) · [Get a Gemini API key](https://aistudio.google.com/app/apikey)

## What version 2.0 adds

- Capture mode: drag over part of a webpage and ask a question about the image.
- The Tab mode: ask about readable content on the current webpage.
- All Tabs mode: summarize or compare supported tabs in the current Chrome window.
- Agent Mode in every mode: let AI Vision click, type, scroll, and navigate automatically, with its scope determined by Capture, The Tab, or All Tabs and sensitive actions blocked.
- Response styles: Balanced, Concise, Formal, Casual, Detailed, and Bullet-oriented.
- Five Gemini model choices, with `gemini-3.5-flash` selected by default.
- A fixed 500 × 500 light-blue interface, plus in-app links for ratings and GitHub source.

## Project structure

The repository is organized by responsibility:

```text
src/background/          Chrome APIs, tab context, and Agent Mode
src/content/             Capture UI, assistant panel, and styles
extension-assets/icons/  Icons packaged by manifest.json
store-assets/            Store screenshots, promo tiles, branding, and media
docs/                    Self-contained public website
```

Start with [ARCHITECTURE.md](ARCHITECTURE.md) for the complete project map, runtime flow, internal messages, settings, and safety boundaries.

Run `npm run check` after changing runtime code. The dependency-free checks validate JavaScript syntax, manifest paths, source-tab isolation, capture attachment, and All Tabs window scope.

For a visual smoke test, serve the project root and open `tests/manual/assistant-panel-harness.html`. It supplies fake Chrome APIs and a dummy local key, so it never calls Gemini.

## Gemini models

1. `gemini-3.5-flash` (default)
2. `gemini-3-flash-preview`
3. `gemini-2.5-flash`
4. `gemini-3.1-flash-lite`
5. `gemini-2.5-flash-lite`

Model availability and API pricing are controlled by Google. If Google has not enabled a selected model for your API key, choose another model in Settings.

## Set up AI Vision

1. Install the extension from the Chrome Web Store, or load this folder as an unpacked extension from `chrome://extensions` with Developer mode enabled.
2. Open [Google AI Studio](https://aistudio.google.com/app/apikey) and create a Gemini API key.
3. Open AI Vision, select Settings, paste the key, and save it.
4. Choose a model, temperature, and response style. These settings remain selected until you change them.

The API key is stored in `chrome.storage.local` in the browser profile. Requests are sent directly from the extension to Google's Gemini API over HTTPS; AI Vision does not use a developer-operated proxy server.

## Use the three modes

Open AI Vision from the toolbar icon or the right-click menu. Use the control above the question box to choose a mode:

- **Capture:** drag to select a visible area, then type a question or use Summarize, Explain, or Answer.
- **The Tab:** ask about the readable content of the current HTTP or HTTPS page.
- **All Tabs:** ask across up to 20 supported tabs in the same Chrome window.

The selected mode persists until you manually change it.

## Agent Mode

Agent Mode can be turned on or off directly below the mode selector and stays selected until the user changes it. Its scope follows the selected mode:

- **Capture + Agent Mode:** uses the selected screenshot as context and may act only in The Tab where the capture started.
- **The Tab + Agent Mode:** reads, navigates, clicks, types, and scrolls only in The Tab.
- **All Tabs + Agent Mode:** may search, switch tabs, navigate, click, type, and scroll across supported tabs in the Chrome window where the task started. Moving the source tab to another window stops the task.

Every Agent Mode task stops after no more than 12 steps.

AI Vision blocks password, payment, authentication-code, purchase, deletion, publication, upload, sign-in, legal-acceptance, and similar sensitive actions. Review the browser state before continuing any task that requires user takeover.

## Permissions

- `activeTab`: activates AI Vision for the page the user explicitly invokes it on.
- `scripting`: injects the packaged interface and reads visible page content for the selected mode.
- `contextMenus`: adds the right-click AI Vision launcher.
- `storage`: saves the API key and user-selected settings locally.
- `tabs`: identifies, reads, and switches tabs for The Tab, All Tabs, and Agent Mode.
- `http://*/*` and `https://*/*`: allows the user-requested page reading and interaction features to work across ordinary websites.

Chrome internal pages, the Chrome Web Store, and other restricted pages cannot be read or controlled.

## Privacy

See [PRIVACY.md](PRIVACY.md) for the full data-handling disclosure. In short, AI Vision processes the content the user chooses to analyze, sends the necessary prompt and context to the Gemini API, and stores preferences locally. It does not sell user data or run remotely hosted JavaScript.

## Source and licensing

The source is publicly available in this GitHub repository. There is currently no license file, so public visibility alone does not grant permission to copy, modify, or redistribute the code. Add an OSI-approved license before describing the project as open source.

## Support the project

If AI Vision saves you time, leave an honest rating on the [Chrome Web Store listing](https://chromewebstore.google.com/detail/ai-vision-screenshot-ask/ghmmlbclopoakmjjbkkmoefjldgjimgk). Ratings are never required or rewarded.

AI Vision is an independent project and is not affiliated with or endorsed by Google. Gemini and Chrome are trademarks of Google LLC.
