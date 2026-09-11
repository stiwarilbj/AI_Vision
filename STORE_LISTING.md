# Chrome Web Store copy – version 2.8 package (public listing currently v2.5)

Official active listing (public v2.5): https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk

Prepared public-v2.5 capture set: `outputs/ai-vision-v28/store-assets/public-v25/`. These 1280×800 captures were taken from the public listing and show Capture, Settings, and The Tab controls. They are the conservative listing assets to use while the package remains v2.8 preview-only.

## Title from package

AI Vision: AI Screenshot Assistant

## Summary from package

Explain screenshots, copy text from images, and ask follow-up questions in Chrome with your own Gemini API key.

## Category

Workflow & Planning

## Detailed description

AI Vision is an AI screenshot assistant for Chrome. Select part of a chart, image, error message, or document, ask Gemini what it means, and keep the answer ready for a follow-up.

Use it to:

- Explain charts, diagrams, interfaces, and error messages
- Copy text from screenshots and other images
- Summarize a readable webpage while you browse
- Compare useful details across supported tabs

### Get started

1. Install AI Vision from the Chrome Web Store.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey), open AI Vision Settings, and save it.
3. Open an ordinary webpage, choose **Capture**, select an area, and ask a question. Follow up from the answer; labels may vary in the public v2.5 listing.

Browser tasks (Beta) are optional and approval-gated, with a visible Stop action. AI Vision is free to install, but Google controls Gemini access, quotas, and any billing. Gemini can misread small or blurry text, so check important facts. Chrome internal pages, the Chrome Web Store, and other restricted pages cannot be analyzed.

Your key and preferences stay in Chrome's local storage. Your prompt and the screenshot or page context needed for a request go directly to Google's Gemini API over HTTPS; there is no developer proxy or analytics. See the privacy notice and source at [github.com/stiwarilbj/AI_Vision](https://github.com/stiwarilbj/AI_Vision). AI Vision is an independent project and is not affiliated with Google.

## Privacy form

### Single purpose

AI Vision is a browser-content assistant that lets users ask Google's Gemini API about a selected screenshot, This page, or supported tabs in the Chrome window where the extension was opened. Its optional Browser tasks feature carries out the user's browser-content task within the selected Screenshot, This page, or Compare tabs scope. Every permission supports this single purpose: capturing, reading, explaining, comparing, or safely interacting with browser content at the user's request.

### activeTab justification

The activeTab permission supports user-initiated activation from the toolbar or context menu on the page the user is viewing. AI Vision uses the active page as the source for Screenshot capture, This page questions, and the starting point for window-scoped tasks. Access is initiated by an explicit user action; the extension does not silently activate itself on a page.

### scripting justification

The scripting permission is required to inject the packaged AI Vision interface after the user clicks the extension icon or context-menu item. It is also used, at the user's request, to extract visible page text and visible interactive-element labels for This page, Compare tabs, and Browser tasks, and to carry out an approved click, typing, or scroll action. No remotely hosted script is injected.

### contextMenus justification

The contextMenus permission creates the “AI Vision” right-click entry. This is one of the extension's two user-controlled launch methods and lets the user start a screenshot or page question from the content they are viewing. It does not add unrelated menus or collect information merely because the menu is displayed.

### storage justification

The storage permission saves the user's Gemini API key, selected model, temperature, response style, screenshot explanation preference, and Browser tasks preference in chrome.storage.local. This keeps settings available between sessions. AI Vision does not use this permission for analytics, advertising, or cross-site tracking.

### tabs justification

The optional tabs permission supports Compare tabs and Compare tabs Browser tasks. AI Vision identifies the source tab, queries tabs in the starting Chrome window, reads titles and URLs, and switches a selected tab only when Compare tabs Browser tasks is enabled. It requests this permission only after the user chooses Compare tabs, fails closed when permission is denied, does not read Chrome's saved browsing-history database, and limits context to 20 tabs per request.

### Host permission justification

The required host permission is limited to `https://generativelanguage.googleapis.com/*` for Gemini requests and the bundled ADK planner. Optional `http://*/*` and `https://*/*` access is requested only when the user chooses Compare tabs, because that mode reads supported pages across multiple domains. Screenshot and This page use user-initiated `activeTab` access. Restricted Chrome pages and the Chrome Web Store remain inaccessible.

### Are you using remote code?

No, I am not using Remote code.

### Remote code justification

All executable JavaScript and CSS is packaged inside the extension. AI Vision makes HTTPS requests to Google's Gemini API and receives JSON/text responses as data. Those responses are displayed as text or parsed as constrained action data; they are never evaluated with eval, imported as modules, inserted as executable scripts, or otherwise executed as remote code.

### Data disclosure checklist

Disclose these data categories because the extension handles them for its user-facing features:

- Authentication information: the Gemini API key supplied by the user and sent to Google for API authentication.
- Website content: user-selected screenshots, visible page text, and labels or destinations of visible page controls sent to Gemini when needed for a request.
- Web history/browsing activity: live tab titles and URLs used for This page, Compare tabs, and Browser tasks. AI Vision does not read Chrome's stored browsing-history database.
- User activity: the user's prompts and selected browser task actions.

State that data is used only for the extension's single purpose, is not sold, and is not used for advertising or credit decisions. Normal and Browser tasks requests are sent directly to Google from the service worker using the user-supplied key. Link the store listing to the hosted version of `PRIVACY.md` before submission.

## Reviewer note about the retained permissions

This version keeps only `activeTab`, `scripting`, `contextMenus`, `storage`, and the narrow Gemini host permission as required permissions. `tabs` and ordinary HTTP/HTTPS host access are optional. Retest Screenshot, This page, Compare tabs, ADK rotation, and Browser tasks after any permission change.
