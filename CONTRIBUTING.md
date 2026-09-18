# Contributing to AI Vision

Use a branch and open a pull request for every change. Keep changes reviewable and confirm the relevant local checks before merging.

## Local checks

```sh
npm ci
npx playwright install chromium
npm run check
npm run panel:check
npm run visual:check
npm run package
npm run extension:check
```

The browser checks use fictional pages and disposable Chromium profiles. They intercept Gemini traffic and must never receive a real API key. If a manual Gemini check is needed, use a separate test project and key; keep it out of source, screenshots, traces, and logs. GitHub Actions CI checks are intentionally disabled for this repository.

## Release and Pages

The package is built from the allowlisted extension files with `npm run package`. GitHub Pages publishes `main` from `/docs`. After a merge, confirm the Pages deployment and public files before treating a release as live. A rollback is a normal revert pull request followed by the same checks.
