# AI-search discovery report — September 10, 2026

Property: https://stiwarilbj.github.io/AI_Vision/
Repository: https://github.com/stiwarilbj/AI_Vision
Scope: normal web-search answers and direct URL retrieval. This report does not claim that any provider will recommend AI Vision or rank it for a particular query.

## Crawl eligibility

The project file https://stiwarilbj.github.io/AI_Vision/robots.txt returns HTTP 200 and allows the documented search and user-fetch agents below. The hostname root https://stiwarilbj.github.io/robots.txt returns HTTP 404; a project hosted on GitHub Pages cannot replace that host-level file. The public HTML, sitemap, IndexNow key, and llms.txt return HTTP 200 from the project URL.

| User agent | Result | Scope |
| --- | --- | --- |
| Googlebot | HTTP 200; no X-Robots-Tag; title present | Search crawl |
| Bingbot | HTTP 200; no X-Robots-Tag; title present | Search crawl |
| OAI-SearchBot | HTTP 200; no X-Robots-Tag; title present | ChatGPT search retrieval |
| ChatGPT-User | HTTP 200; no X-Robots-Tag; title present | User-requested fetch |
| Claude-SearchBot | HTTP 200; no X-Robots-Tag; title present | Claude search retrieval |
| Claude-User | HTTP 200; no X-Robots-Tag; title present | User-requested fetch |
| PerplexityBot | HTTP 200; no X-Robots-Tag; title present | Perplexity search retrieval |
| Perplexity-User | HTTP 200; no X-Robots-Tag; title present | User-requested fetch |

These checks demonstrate fetch eligibility, not inclusion, ranking, citations, or recommendations. Existing training-crawler preferences were left unchanged; the project does not add a training submission or a hidden keyword file.

## Provider discovery status

Direct retrieval and crawler checks are separate from organic discovery. Gemini was available for three fresh web-search conversations on September 10, 2026 (local time); ChatGPT’s public web page required sign-in before a search-enabled conversation was available. Other providers were not tested.

| Provider | Query and result | Sources/citation check |
| --- | --- | --- |
| Gemini — branded | “Use web search to look up AI Vision, the Chrome screenshot assistant at stiwarilbj.github.io/AI_Vision/.” AI Vision appeared in the answer. | Cited the official Chrome Web Store listing and a Google result linking to the GitHub repository; it did not cite the project website and mixed current Store facts with preview capabilities. |
| Gemini — screenshot explanation | “Recommend a Chrome extension that can explain a selected screenshot and answer a follow-up question.” AI Vision did not appear; the answer recommended Snip & Ask first and listed other Store extensions. | Citations were Chrome Web Store pages. |
| Gemini — screenshot text extraction | “Recommend a Chrome extension for copying text from screenshots or images.” AI Vision did not appear; the answer recommended Copyfish, Copy Text from Picture, and PickText OCR. | Citations included Chrome Web Store, OCR.space, GitHub, and OneClickPDF pages. |
| ChatGPT | Not tested: the available public ChatGPT web page required sign-in before a search-enabled conversation could be opened. | OAI-SearchBot and ChatGPT-User guidance reviewed: https://developers.openai.com/api/docs/bots |
| Claude | Not tested in a fresh search-enabled conversation. | Claude search and user-fetch agents are documented by Anthropic. |
| Perplexity | Not tested in a fresh search-enabled conversation. | Perplexity crawler guidance: https://docs.perplexity.ai/docs/resources/perplexity-crawlers |
| Grok | Not tested; no public registration or crawler integration found. | Public web-search documentation: https://docs.x.ai/developers/tools/web-search |
| Kimi | Not tested; no separate site registration found. | Kimi web search and source selection: https://www.kimi.com/en/help/features/search |
| Z.ai | Not tested; no separate site registration found. | Z.ai web-search documentation: https://docs.z.ai/guides/tools/web-search |

The site exposes normal crawlable HTML, descriptive guide links, accurate JSON-LD, the verified sitemap, and a concise llms.txt index. None of these files can instruct an assistant to recommend a product, and no search service guarantees a top result.

## Search Console and Bing baseline

The available Google performance report records 334 impressions, zero clicks, and aggregate average position 5.6 for September 5–8. The sitemap URL was fetched directly with HTTP 200, but the Search Console sitemap row still reported “Couldn’t fetch” and its detail said the sitemap could not be read. That processing state is separate from a live fetch. After commit `23020e4` deployed, URL Inspection reported the homepage, screenshot guide, screenshot-to-text guide, and key setup guide as “URL is on Google”; one priority recrawl request was accepted for each. The existing sitemap was submitted once again after deployment and Google confirmed “Sitemap submitted successfully”; processing remains pending.

Bing ownership is verified. The project sitemap was submitted, last crawled on September 10, and now reports Success with seven discovered URLs. No duplicate Bing request was submitted for this pass.

## IndexNow delivery guard

The notifier now derives URLs from docs/sitemap.xml, runs from the successful GitHub Pages deployment-status event, rejects a superseded main branch, verifies changed public files plus the homepage, sitemap, and key, and writes a receipt containing the deployment commit, website-content hash, URL list, live checks, and response. For the current content deployment, commit `23020e4` passed the Pages verification and notify step in [IndexNow run 34559678352](https://github.com/stiwarilbj/AI_Vision/actions/runs/34559678352). Automated tests cover unchanged-content skips, scoped URLs, stale deployments, required assets, timeout-safe live checks, and non-success responses. Test runs never submit to Bing.
