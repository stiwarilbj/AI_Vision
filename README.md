# AI Vision

Select part of a webpage, ask Gemini what it means, and ask a follow-up. AI Vision can also copy text from images, summarize articles, and compare Chrome tabs.

[Add to Chrome](https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk) · [Website and guides](https://stiwarilbj.github.io/AI_Vision/)

The v2.8 preview and its release artwork are in this repository. For a ready-to-upload package, download [`AI_Vision_Extension_Package.zip`](AI_Vision_Extension_Package.zip) from the repository root. To rebuild it, run `npm run package`, copy `dist/ai-vision-extension-v2.8.zip` to that filename, and run `npm run package:verify`. Use the [release checklist](RELEASE_OPERATIONS.md) before publishing a draft release.

## Try it

1. Install AI Vision in desktop Chrome.
2. [Get a Gemini API key](https://aistudio.google.com/app/apikey) and save it in AI Vision's settings.
3. Open a webpage, select an area, and ask a question about it.

Need a hand with the key? Follow the [setup guide](https://stiwarilbj.github.io/AI_Vision/guides/get-gemini-api-key.html).

Your key stays in local extension storage. Questions and selected content go directly to Google; there's no AI Vision server in between. Gemini's pricing and usage limits apply. [Privacy details](PRIVACY.md).

This repository contains the **v2.8 preview**. Check the Store listing for the published version; some preview controls may differ.

## How it works

Built with plain JavaScript, Chrome's Manifest V3 APIs, and Gemini.

- The service worker handles API keys and requests. The page interface only receives masked key status.
- Comparing tabs requires optional permission. Cancelling a request stops it, and task IDs keep old browser-task updates from replacing newer ones.
- Optional Browser tasks use Google ADK to propose actions. The worker checks the page again and asks for approval before clicks, typing, or navigation.

See the [architecture](ARCHITECTURE.md) and [security notes](SECURITY.md) for the details.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the pull-request, browser-test, and release checklist.

## Run it locally

Use Node.js 24.13 or newer:

```sh
npm ci
npm run check
npm run package
```

To try the preview, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this repository's folder. Packaging writes the release ZIP to `dist/`.

The website lives in `docs/` and publishes through GitHub Pages.

---

Independent project, not affiliated with Google. The source is public, but no license currently grants permission to reuse or redistribute it.
