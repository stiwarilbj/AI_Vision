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

Organic assistant searches were not run in this implementation session because signed-in search access for each provider was not available. Direct retrieval and crawler checks are separate from organic discovery.

| Provider | Public discovery path reviewed | Organic query status |
| --- | --- | --- |
| ChatGPT | OAI-SearchBot and ChatGPT-User guidance: https://developers.openai.com/api/docs/bots | Not tested in a fresh search-enabled conversation |
| Google / Gemini | Google AI features use normal indexing and snippet eligibility: https://developers.google.com/search/docs/appearance/ai-features | Search Console status is recorded separately; Gemini answer discovery not tested |
| Claude | Claude search and user-fetch agents are documented by Anthropic | Not tested in a fresh search-enabled conversation |
| Perplexity | Perplexity crawler guidance: https://docs.perplexity.ai/docs/resources/perplexity-crawlers | Not tested in a fresh search-enabled conversation |
| Grok | Public web-search documentation: https://docs.x.ai/developers/tools/web-search | No public registration or crawler integration found; not tested |
| Kimi | Kimi web search and source selection: https://www.kimi.com/en/help/features/search | No separate site registration found; not tested |
| Z.ai | Z.ai web search documentation: https://docs.z.ai/guides/tools/web-search | No separate site registration found; not tested |

The site exposes normal crawlable HTML, descriptive guide links, accurate JSON-LD, the verified sitemap, and a concise llms.txt index. None of these files can instruct an assistant to recommend a product, and no search service guarantees a top result.

## Search Console and Bing baseline

The existing Google report records seven indexed pages with matching canonicals, 326 impressions, zero clicks, and aggregate average position 5.6 for the available September 5–7 window. The sitemap was fetched directly with HTTP 200 but its Search Console row still reported “Couldn’t fetch” at capture time; that processing state is separate from a live fetch.

Bing ownership is verified, the project sitemap is submitted and processing, and the homepage live test reports that it can be indexed. Bing’s index status previously showed “Discovered but not crawled.” No duplicate Google or Bing request was submitted for this pass.

## IndexNow delivery guard

The notifier now derives URLs from docs/sitemap.xml, runs from the successful GitHub Pages deployment-status event, rejects a superseded main branch, verifies changed public files plus the homepage, sitemap, and key, and writes a receipt containing the deployment commit, website-content hash, URL list, live checks, and response. For the final content deployment, commit 5e85cca changed llms.txt; [IndexNow run 34536954146](https://github.com/stiwarilbj/AI_Vision/actions/runs/34536954146) verified the live files and received HTTP 200 from Bing. Automated tests cover unchanged-content skips, scoped URLs, stale deployments, required assets, timeout-safe live checks, and non-success responses. Test runs never submit to Bing.
