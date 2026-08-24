# AI Vision version 2.0 growth playbook

Updated August 24, 2026

No legitimate change can guarantee immediate first-page Google rankings or a surge of users. The fastest credible path is to improve store conversion, reduce uninstalls, publish a crawlable canonical site, and repeatedly demonstrate a few valuable use cases to the right audiences.

## Publish in the next 48 hours

1. Upload the version 2.0 extension package and all five 1280 × 800 screenshots, the 128 × 128 icon, the 440 × 280 small promo tile, and the 1400 × 560 marquee tile.
2. Paste the title, summary, description, privacy answers, and disclosure checklist from `STORE_LISTING.md`. Link the listing to the hosted privacy page.
3. Enable GitHub Pages: repository **Settings → Pages → Deploy from a branch → main → /docs**. After deployment, confirm that `https://gitchubst.github.io/AI_Vision/` and `/privacy.html` load.
4. Add that Pages URL to the repository's Website field. Set the repository description to: “Ask Gemini about screenshots, webpages, and tabs in one Chrome window—with optional constrained browser automation.”
5. Add focused GitHub topics: `chrome-extension`, `gemini`, `ai-assistant`, `screenshot`, `tab-summarizer`, `browser-automation`.
6. Add the Pages domain to Google Search Console and submit `https://gitchubst.github.io/AI_Vision/sitemap.xml`.
7. Use the in-app rating link to ask active users for an honest review. Never require, gate, purchase, or reward ratings.

## Launch one clear story

Do not market every feature at once. Lead with one sentence:

> Ask Gemini about a screenshot, the current page, or every tab in one Chrome window.

Create three 20–40 second demonstrations from the included screenshots or a fresh screen recording:

- Compare products or research across several tabs.
- Explain a chart, diagram, error, or paragraph from a selected screenshot.
- Turn on Agent Mode, give it a small reversible browser task, and show how Capture and The Tab stay within one tab while All Tabs stays within one window.

Publish the clips where the exact audience already discusses these problems: Chrome-extension communities, Gemini developer communities, productivity communities, and relevant subreddits or forums whose rules allow self-promotion. Write a useful mini-tutorial for each community instead of posting the same promotional message everywhere.

## Build search and answer-engine authority

- Keep one canonical landing page with stable wording, real screenshots, FAQs, privacy details, and direct store/GitHub links.
- Publish helpful pages that match real questions, such as “How to compare multiple Chrome tabs with Gemini” and “How to ask Gemini about part of a screenshot.” Each page should show an original workflow, limitations, and examples.
- Seek a small number of relevant backlinks: tutorial writers, extension roundups, Gemini newsletters, and productivity creators. A genuine walkthrough is more useful than a generic directory listing.
- Keep `robots.txt` open to `OAI-SearchBot`. The included `llms.txt` is a supplemental machine-readable facts page, not a ranking guarantee.
- Keep SoftwareApplication structured data accurate. Do not add invented reviews, ratings, prices, or capabilities.

## Improve conversion and retention

- Make the first successful answer take less than two minutes: explain the API-key step clearly, confirm when the key is saved, and offer a simple first prompt.
- If a selected Gemini model is unavailable for a user's key, show a clear fallback instruction instead of a generic API error.
- Keep the 500 × 500 UI stable and remember the user's mode and style.
- Ask for a rating only after the user has reached the Help area; do not interrupt the first-run experience.
- Review support emails and store reviews weekly. Turn repeated confusion into onboarding copy or UI fixes.

## Measure a weekly funnel

Track these numbers once per week:

1. Chrome Web Store listing impressions.
2. Listing visitors who install.
3. New installs versus uninstalls.
4. Weekly active users and successful Gemini requests, if a future privacy-respecting opt-in measurement system is added.
5. Number and average of honest store ratings.
6. Search Console impressions, clicks, queries, and indexed pages.

Change one listing variable at a time for at least one full week—first screenshot, short description, or headline—so the result is interpretable. Prioritize install conversion and low uninstall rate over raw page views.

## Authoritative guidance

- Chrome Web Store listing quality and discovery: https://developer.chrome.com/docs/webstore/best-listing
- Chrome Web Store user-data requirements: https://developer.chrome.com/docs/webstore/user_data
- Google helpful-content guidance: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google SoftwareApplication structured data: https://developers.google.com/search/docs/appearance/structured-data/software-app
- OpenAI crawler controls: https://developers.openai.com/api/docs/bots
