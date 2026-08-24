# AI Vision Privacy Notice

Last updated: August 24, 2026

AI Vision – Gemini Screenshot & Browser Assistant is a Chrome extension that lets a user ask Google's Gemini API about a selected screenshot, The Tab, or supported tabs in one Chrome window. Its optional Agent Mode can perform a limited browser task within the scope selected by the user.

## Data AI Vision handles

Only when a user invokes a feature, AI Vision may handle:

- the user's question, response-style choice, and selected Gemini model;
- a screenshot region selected by the user;
- visible webpage text, page titles, page URLs, and labels or destinations of visible interactive elements;
- titles, URLs, and readable content from up to 20 supported tabs in the Chrome window where AI Vision was opened;
- a Gemini API key supplied by the user; and
- local settings such as mode, temperature, response style, and whether Agent Mode is enabled.

AI Vision reads live tab information needed for The Tab, All Tabs, and Agent Mode. It does not read the user's saved Chrome browsing-history database.

## How the data is used and shared

AI Vision uses this information only to provide the feature the user requested. The prompt and necessary screenshot or webpage context are sent directly from the extension to the Google Gemini API over HTTPS. The Gemini API key is also sent to Google in the `x-goog-api-key` request header so Google can authenticate the request.

AI Vision has no developer-operated analytics, advertising, tracking, or proxy server. The developer does not sell or rent user data. Data sent to Google is handled under Google's applicable Gemini API and privacy terms.

## Storage and retention

The Gemini API key and user preferences are stored locally through `chrome.storage.local` in the user's Chrome profile. AI Vision does not intentionally store screenshots, page content, prompts, Gemini responses, or browsing-task context on a developer server. Users can remove locally stored extension data by clearing the extension's data or uninstalling the extension.

## Agent Mode controls

Agent Mode is off unless the user enables it. In Capture and The Tab modes, it can act only in the source tab. In All Tabs mode, it is limited to the Chrome window where the task started and stops if the source tab moves to another window. Every task stops after 12 steps. AI Vision blocks entry into fields that appear to request passwords, payment information, or authentication codes. It also blocks automated purchases, payments, deletions, messages, posts, uploads, sign-ins, subscriptions, and acceptance of legal terms.

## Permissions

- `activeTab` supports user-initiated access to the page where AI Vision is opened.
- `scripting` injects the packaged AI Vision interface and obtains visible page context.
- `contextMenus` provides the right-click launcher.
- `storage` stores the API key and preferences locally.
- `tabs` supports The Tab, All Tabs, and Agent Mode within the user-selected scope.
- `http://*/*` and `https://*/*` allow these user-requested features on ordinary websites.

Chrome internal pages, the Chrome Web Store, and other restricted pages are not accessible to these features.

## Remote code

AI Vision does not use remotely hosted executable code. Its JavaScript and CSS are packaged with the extension. Responses returned by the Gemini API are treated as data and are not evaluated, imported, or executed as code.

## Limited use

AI Vision's use and transfer of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements. Data is used only to provide or improve the extension's prominent user-facing features and for security or legal compliance where required.

## Contact

Questions about this notice can be sent to `gitchub@gmail.com`.
