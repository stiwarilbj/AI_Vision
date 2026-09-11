# Community launch drafts

These are prepared drafts. They are not published until the account owner reviews the final text and confirms the individual submission.

## r/chrome_extensions

**Suggested flair:** Self Promotion

**Title:** I built a Chrome extension that explains a selected screenshot with Gemini — feedback welcome

**Body:**

I built AI Vision because I kept switching between a webpage and an AI chat to ask about one chart, error, or image.

The public Chrome Web Store build is v2.5. The short flow is:

1. Install AI Vision.
2. Add your own Gemini API key from Google AI Studio.
3. Open a normal webpage, drag over the part you want to understand, and ask a question.

It can also transcribe text from images, summarize supported webpages, and compare tabs. The extension cannot run on `chrome://` pages or the Chrome Web Store itself, so the demo uses a normal sample page. That restriction confused an earlier tester, so I’ve made it explicit in the setup and FAQ.

I’m looking for feedback on the first screenshot and key-setup steps, especially where the wording could be clearer. Honest usability feedback is more useful than an upvote:

https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk

## r/SideProject

**Title:** I made the first-use flow for my screenshot-to-answer Chrome extension much smaller

**Body:**

My side project, AI Vision, turns a selected part of a webpage into a Gemini question. I wanted the first try to feel like one small loop: select a chart or error, get an explanation, then ask one follow-up without leaving Chrome.

The public build is v2.5. It also has image-to-text, webpage summaries, and tab comparisons. Users bring their own Gemini API key, and requests go directly to Google. The Web Store and Chrome internal pages are restricted; ordinary webpages work.

I’d like specific feedback on two things: is the key setup understandable for someone who has never used Google AI Studio, and is it obvious what to select before asking a question?

Try the public install here:

https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk

## Product Hunt

**Name:** AI Vision

**Tagline:** Explain screenshots and copy image text in Chrome

**Canonical URL:** https://stiwarilbj.github.io/AI_Vision/

**Description:**

AI Vision is a free Chrome extension for asking Gemini about what is on screen. Select a chart, error message, image, or page detail, get a plain-language answer, and ask a follow-up without leaving Chrome. It can also copy text from images, summarize supported webpages, and compare tabs. Bring your own Gemini API key from Google AI Studio; requests go directly to Google, which sets model access and usage limits.

**Maker introduction / first comment:**

I made AI Vision after too many small context switches between a webpage and a separate AI chat. The public v2.5 build keeps the first task small: select one visible area, ask Gemini, and follow up while the capture stays in context. I’d appreciate feedback on the setup wording and on which screenshot tasks feel most useful. The examples use fictional content, and no key is bundled.

**Gallery:** `01-select-capture.png` and `02-answer-follow-up.png`.

Do not add UTM parameters, ask for votes, or submit a duplicate launch. Use Product Hunt’s own scheduling and gallery fields.
