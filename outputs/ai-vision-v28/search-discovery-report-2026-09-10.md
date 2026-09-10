# Search discovery report — September 10, 2026

Property: https://stiwarilbj.github.io/AI_Vision/  
Google account: gitchub@gmail.com  
Deployment checked: commit b2213fb (Bing verification tag)

## Google Search Console

### URL Inspection

All seven public HTML URLs were inspected in the verified URL-prefix property. Each returned **Page indexed**, with the user-declared canonical selected:

| URL | Result | Selected canonical |
| --- | --- | --- |
| / | Page indexed | https://stiwarilbj.github.io/AI_Vision/ |
| /guides/ai-screenshot-assistant.html | Page indexed | https://stiwarilbj.github.io/AI_Vision/guides/ai-screenshot-assistant.html |
| /guides/copy-text-from-screenshot-chrome.html | Page indexed | https://stiwarilbj.github.io/AI_Vision/guides/copy-text-from-screenshot-chrome.html |
| /guides/summarize-webpage-with-gemini.html | Page indexed | https://stiwarilbj.github.io/AI_Vision/guides/summarize-webpage-with-gemini.html |
| /guides/compare-chrome-tabs-with-gemini.html | Page indexed | https://stiwarilbj.github.io/AI_Vision/guides/compare-chrome-tabs-with-gemini.html |
| /guides/get-gemini-api-key.html | Page indexed | https://stiwarilbj.github.io/AI_Vision/guides/get-gemini-api-key.html |
| /privacy.html | Page indexed | https://stiwarilbj.github.io/AI_Vision/privacy.html |

Fresh indexing requests were accepted for the homepage, screenshot explanation guide, webpage summary guide, and screenshot-to-text guide after the content update. Acceptance places a URL in a crawl queue; it does not confirm that Google has recrawled or reindexed the updated document. The other three pages were already indexed and were not resubmitted.

### Sitemap and quality status

- The canonical sitemap https://stiwarilbj.github.io/AI_Vision/sitemap.xml was resubmitted once. Search Console confirmed **Sitemap submitted successfully**.
- Immediately after submission, the sitemap row still showed **Couldn't fetch** and 0 discovered pages. A direct HTTPS request succeeds with HTTP 200 and valid XML containing all seven URLs. This is a Search Console processing delay or report state, not a live fetch failure.
- Manual Actions: **No issues detected**.
- Security Issues: **No issues detected**.

### Performance baseline

The available Search Console performance window (September 5–7, 2026) shows 326 impressions, 0 clicks, 0% CTR, and average position 5.6. Average position is an aggregate property metric, not a guaranteed position for the target phrase “AI screenshot assistant for Chrome.” Search rankings and indexing timing remain Google decisions.

## Bing Webmaster Tools

- Site ownership was verified for https://stiwarilbj.github.io/AI_Vision/ with the HTML meta method under the available owner account.
- The sitemap https://stiwarilbj.github.io/AI_Vision/sitemap.xml was submitted on September 10. Bing showed 1 known sitemap, 0 errors, 0 warnings, and **Processing** with 0 URLs discovered at the time of capture.
- Representative homepage inspection found the URL **Discovered but not crawled** in the Bing index. Bing's live URL test reported **URL can be indexed by Bing** and **No SEO/GEO issues found**. A one-time homepage indexing request was accepted; acceptance is separate from confirmed indexing.

## IndexNow and crawler access

- The project-scoped public key is available at https://stiwarilbj.github.io/AI_Vision/ai-vision-indexnow-20260910.txt.
- The IndexNow notification workflow completed successfully for commit b2213fb: [GitHub Actions run](https://github.com/stiwarilbj/AI_Vision/actions/runs/34442938848). It runs only after a successful main-branch push that changes website content, verifies the deployed homepage, sitemap, and key file, then submits the canonical sitemap URLs. Pull requests and unchanged website content are skipped.
- The project robots file returns HTTP 200 and explicitly allows Googlebot, Bingbot, OAI-SearchBot, PerplexityBot, and Claude-SearchBot. The hostname-root https://stiwarilbj.github.io/robots.txt returns 404; GitHub Pages does not allow this project to control the host-wide file, and no host-level crawl restriction is declared.
- llms.txt is a factual navigation aid for search assistants. It supplements normal crawlable HTML; it cannot require ChatGPT, Bing, Google, or another system to cite or recommend the product.

Google and Bing submissions are recorded separately from confirmed indexing. Search visibility, rankings, clicks, and AI-assistant recommendations require later measurement by each service.
