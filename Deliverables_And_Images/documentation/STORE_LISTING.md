# Chrome Web Store copy – version 2.0

## Title from package

AI Vision - Gemini Screenshot & Browser Assistant

## Summary from package

Ask Gemini about screenshots, The Tab, or All Tabs—and use Agent Mode for safe browser tasks in one Chrome window.

## Detailed description

AI Vision: Your Gemini Screenshot & Browser Assistant

Capture part of a webpage, ask questions about the page you are viewing, or analyze supported tabs across one Chrome window using Google's Gemini AI.

What it does:

- Lets you screenshot any visible part of a website
- Sends your selected image and question directly to the Gemini API for analysis
- Reads supported content from the current tab when you choose The Tab mode
- Summarizes, compares, and answers questions across up to 20 tabs in the same Chrome window with All Tabs mode
- Provides summaries, explanations, and direct answers about images, articles, documents, products, research, and other webpage content
- Lets you choose Balanced, Concise, Formal, Casual, Detailed, or Bullet-oriented responses
- Includes five Gemini model options, with gemini-3.5-flash selected by default
- Can open AI Vision without attaching a picture when you click instead of dragging in Capture mode

Agent Mode:

- Turn Agent Mode on or off directly below the mode selector in Capture, The Tab, or All Tabs
- In Capture mode, Agent Mode uses the selected screenshot and acts only in The Tab where the capture started
- In The Tab mode, Agent Mode can read, navigate, click, type, and scroll only in that tab
- In All Tabs mode, Agent Mode can search, switch tabs, navigate, click, type, and scroll across supported tabs in the starting Chrome window
- All Tabs Agent Mode stops if the source tab moves to another window
- Sensitive actions such as passwords, payments, purchases, deletions, uploads, posts, sign-ins, and acceptance of legal terms are blocked
- Every task stops after a 12-step safety limit so you can review what happened

How to use:

- Right-click on a page or click the extension icon to open AI Vision
- Choose Capture, The Tab, or All Tabs using the mode control above the question box
- In Capture mode, drag to select the area you want to analyze; click once to open AI Vision without a picture
- Type a question or use Summarize, Explain, or Answer for an AI-powered response
- Choose a response style and Gemini model in Settings
- Your mode, Agent Mode, and response settings remain selected until you manually change them

Getting started:

You'll need a Google Gemini API key from Google AI Studio. Visit aistudio.google.com/app/apikey, create a key, then paste it into AI Vision's Settings menu. API availability, free-tier limits, model access, and pricing are controlled by Google.

Privacy and control:

- AI Vision runs only when you open it or start a task
- Your API key and preferences are stored locally in your Chrome profile
- Requests go directly from the extension to Google's Gemini API over HTTPS
- AI Vision has no developer-operated analytics, advertising, tracking, or proxy server
- Chrome internal pages, the Chrome Web Store, and other restricted pages cannot be analyzed

Source and support:

The source is publicly available at github.com/gitchubst/AI_Vision. If AI Vision saves you time, please leave an honest rating on the Chrome Web Store. Ratings are never required or rewarded.

AI Vision is an independent project and is not affiliated with or endorsed by Google. Gemini and Chrome are trademarks of Google LLC.

## Privacy form

### Single purpose

AI Vision is a browser-content assistant that lets users ask Google's Gemini API about a selected screenshot, The Tab, or supported tabs in the Chrome window where the extension was opened. Its optional Agent Mode carries out the user's browser-content task within the selected Capture, The Tab, or All Tabs scope. Every permission supports this single purpose: capturing, reading, explaining, comparing, or safely interacting with browser content at the user's request.

### activeTab justification

The activeTab permission supports user-initiated activation from the toolbar or context menu on the page the user is viewing. AI Vision uses the active page as the source for screenshot capture, The Tab questions, and the starting point for window-scoped tasks. Access is initiated by an explicit user action; the extension does not silently activate itself on a page.

### scripting justification

The scripting permission is required to inject the packaged AI Vision interface and stylesheet after the user clicks the extension icon or context-menu item. It is also used, at the user's request, to extract visible page text and visible interactive-element labels for The Tab, All Tabs, and Agent Mode, and to carry out an approved click, typing, or scroll action. No remotely hosted script is injected.

### contextMenus justification

The contextMenus permission creates the “AI Vision” right-click entry. This is one of the extension's two user-controlled launch methods and lets the user start a screenshot or page question from the content they are viewing. It does not add unrelated menus or collect information merely because the menu is displayed.

### storage justification

The storage permission saves the user's Gemini API key and selected model, temperature, mode, response style, and Agent Mode preference in chrome.storage.local. This keeps settings available between sessions and ensures the selected mode remains active until the user changes it. AI Vision does not use this permission for analytics, advertising, or cross-site tracking.

### tabs justification

The tabs permission supports the prominent The Tab, All Tabs, and Agent Mode features. AI Vision identifies the source tab, queries tabs in the starting Chrome window for All Tabs, reads titles and URLs, and switches a selected tab only when All Tabs Agent Mode is enabled. It does not read Chrome's saved browsing-history database, and it limits All Tabs context to 20 tabs per request.

### Host permission justification

Access to http://*/* and https://*/* is required because users may invoke Capture, The Tab, All Tabs, or Agent Mode on ordinary websites across many domains. The access is used only for a user-requested feature: injecting the packaged UI, reading visible page context, capturing the visible tab, or performing a constrained browser action. Restricted Chrome pages and the Chrome Web Store remain inaccessible.

### Are you using remote code?

No, I am not using Remote code.

### Remote code justification

All executable JavaScript and CSS is packaged inside the extension. AI Vision makes HTTPS requests to Google's Gemini API and receives JSON/text responses as data. Those responses are displayed as text or parsed as constrained action data; they are never evaluated with eval, imported as modules, inserted as executable scripts, or otherwise executed as remote code.

### Data disclosure checklist

Disclose these data categories because the extension handles them for its user-facing features:

- Authentication information: the Gemini API key supplied by the user and sent to Google for API authentication.
- Website content: user-selected screenshots, visible page text, and labels or destinations of visible page controls sent to Gemini when needed for a request.
- Web history/browsing activity: live tab titles and URLs used for The Tab, All Tabs, and Agent Mode. AI Vision does not read Chrome's stored browsing-history database.
- User activity: the user's prompts and selected browser task actions.

State that data is used only for the extension's single purpose, is not sold, is not used for advertising or credit decisions, and is sent directly to Google when the user requests Gemini analysis. Link the store listing to the hosted version of `PRIVACY.md` before submission.

## Reviewer note about the retained permissions

This version keeps the extension's existing permissions as requested. Chrome's permission guidance notes that broad host permissions can overlap with `activeTab` and sensitive tab metadata access. If a reviewer asks for further minimization, remove permissions only after retesting Capture, The Tab, All Tabs, and Agent Mode, then update the corresponding disclosures.
