# AI Vision 2.8.2 store artwork

This set contains five separate Chrome Web Store screenshots for the current AI Vision release. Each composition uses the extension workflow as its subject, with a distinct palette, layout, and visual rhythm.

## Render

From the repository root:

```sh
npm run artwork:render
```

The renderer uses Chromium and writes five opaque 24-bit RGB PNGs to `store-screenshots/`, copies them to `outputs/ai-vision-v282/store-assets/`, and creates `outputs/ai-vision-v282/contact-sheet.png` for review.

## Upload files

- `store-screenshots/01-screenshot-insight.png` — 1280×800
- `store-screenshots/02-ocr-text.png` — 1280×800
- `store-screenshots/03-webpage-summary.png` — 1280×800
- `store-screenshots/04-tab-comparison.png` — 1280×800
- `store-screenshots/05-browser-tasks.png` — 1280×800

The screenshots use short period-free copy, rounded interface cards, full backgrounds, and no release labels or disclaimers.
