# Chrome Web Store copy – version 2.6

Official active listing: https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk?authuser=0&hl=en

## Title from package

AI Vision: Gemini Screenshot, Webpage & Multi-Tab AI Assistant for Chrome

## Summary from package

Ask Gemini about screenshots, webpages, articles, products, research, and up to 20 tabs—then run safe approval-based browser tasks.

## Category

Workflow & Planning

## Detailed description

Turn the page you see into an answer you can use.

AI Vision is a Gemini-powered Chrome extension for visual questions, webpage reading, and focused browser workflows. Capture a region, ask about the page in front of you, or compare supported tabs without copying content into another app.

Choose the workflow that fits:

- **Screenshot:** select a chart, image, paragraph, product detail, or error and ask Gemini about exactly what matters.
- **This page:** summarize, explain, or question readable content from the current supported webpage.
- **Compare tabs:** compare and synthesize up to 20 supported pages in the Chrome window where the task began.

For everyday productivity, AI Vision can:

- Explain screenshots, charts, diagrams, interfaces, and error messages in plain language
- Summarize articles, documents, product pages, and research sources
- Compare claims, prices, requirements, or limitations across open tabs
- Keep a short follow-up conversation in the open panel, with Copy, Follow up, and Try again actions
- Use quick prompts such as Summarize, Explain, and Copy text, plus Balanced, Concise, Formal, Casual, Detailed, or Bullet-oriented response styles
- Open from the toolbar, the right-click menu, or **Alt + Shift + V**

### Optional Browser tasks (Beta)

Enable Browser tasks when you want a bounded browser workflow instead of an explanation. Screenshot and This page stay in the source tab. Compare tabs can search, switch, navigate, click, type, or scroll only inside the starting Chrome window.

Reading, waiting, and scrolling can proceed automatically. Clicks, text entry, navigation, new tabs, history movement, and reloads pause for your approval. Passwords, credentials, payments, purchases, deletions, uploads, posts, sign-ins, permission changes, legal acceptance, and other sensitive actions are permanently blocked. Every task stops after 12 steps so you can review what happened.

The Google ADK browser runtime is bundled with the extension. Each planning step uses the configured Gemini rotation inside the service worker—no terminal, Node.js installation, companion process, or download is required.

### Get started in under two minutes

1. Install AI Vision from the Chrome Web Store.
2. Create a Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey), open Settings, and press **Save key**.
3. Open a page, press **Alt + Shift + V**, choose Screenshot, This page, or Compare tabs, and ask a question.

Google controls API availability, model access, free-tier limits, and pricing. Compare tabs asks for its optional permission only when you choose that mode.

### Privacy and control

AI Vision runs when you open it or start a task. Your Gemini API key and preferences stay in local Chrome extension storage; the visible panel receives only masked key status. Prompts and the screenshot or page context needed for a request go directly to Google's Gemini API over HTTPS.

There is no developer-operated analytics, advertising, tracking, or proxy server. Chrome internal pages, the Chrome Web Store, and other restricted pages cannot be analyzed. See the linked privacy notice for the complete data-handling details.

The source is publicly available at [github.com/stiwarilbj/AI_Vision](https://github.com/stiwarilbj/AI_Vision). If AI Vision saves you time, an honest Chrome Web Store rating helps other people find it. Ratings are never required or rewarded.

AI Vision is an independent project and is not affiliated with or endorsed by Google. Gemini and Chrome are trademarks of Google LLC.

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

The storage permission saves the user's Gemini API key and selected model, temperature, mode, response style, and Browser tasks preference in chrome.storage.local. This keeps settings available between sessions and ensures the selected mode remains active until the user changes it. AI Vision does not use this permission for analytics, advertising, or cross-site tracking.

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
