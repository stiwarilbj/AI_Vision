# AI Vision v2.8 artwork

These compositions are the editable sources for the five Chrome Web Store screenshots and two promotional tiles. They use the real v2.8 panel captures with fictional material; answer copy is illustrative.

## Render

From the repository root:

```sh
npm run artwork:render
```

The renderer uses Chromium and writes the final 24-bit RGB PNGs to `store-screenshots/` and `promotional/`. `source/` contains the captured interface images and the blue-only generated backgrounds. The tiny `v2.8 GitHub preview` label is intentional until the Store listing has been updated.

## Files

- `store-screenshots/01-understand-screenshot.png` — 1280×800
- `store-screenshots/02-copy-text-from-images.png` — 1280×800
- `store-screenshots/03-summarize-webpage.png` — 1280×800
- `store-screenshots/04-compare-two-tabs.png` — 1280×800
- `store-screenshots/05-add-gemini-key.png` — 1280×800
- `promotional/06-promo-440x280.png` — 440×280
- `promotional/07-marquee-1400x560.png` — 1400×560

All final PNGs are opaque RGB images with square outer edges and no credentials.
