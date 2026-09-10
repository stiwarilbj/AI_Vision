const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const docsRoot = path.join(projectRoot, 'docs');
const siteUrl = 'https://stiwarilbj.github.io/AI_Vision/';
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function fail(message) {
  throw new Error(`SEO check failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function metaContent(markup, attribute, value) {
  const escapedAttribute = escapeRegExp(attribute);
  const escapedValue = escapeRegExp(value);
  const patterns = [
    new RegExp(`<meta\\b[^>]*\\b${escapedAttribute}=["']${escapedValue}["'][^>]*\\bcontent=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\b${escapedAttribute}=["']${escapedValue}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = markup.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function pageTitle(markup) {
  return markup.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || null;
}

function canonical(markup) {
  return markup.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1]
    || markup.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i)?.[1]
    || null;
}

function jsonLdTypes(markup) {
  return jsonLdNodes(markup).flatMap((node) => Array.isArray(node?.['@type']) ? node['@type'] : typeof node?.['@type'] === 'string' ? [node['@type']] : []);
}

function jsonLdNodes(markup) {
  const nodes = [];
  for (const match of markup.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch (error) {
      fail(`invalid JSON-LD: ${error.message}`);
    }
    nodes.push(...(parsed?.['@graph'] || [parsed]));
  }
  return nodes;
}

function publicHtmlPaths(directory = docsRoot) {
  const paths = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...publicHtmlPaths(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      paths.push(path.relative(docsRoot, absolutePath).split(path.sep).join('/'));
    }
  }
  return paths;
}

function localPathFor(target, relativePath) {
  let resolved;
  try {
    resolved = new URL(target, `${siteUrl}${relativePath}`);
  } catch (error) {
    fail(`${relativePath} contains an invalid URL: ${target}`);
  }
  const site = new URL(siteUrl);
  if (resolved.hostname !== site.hostname || resolved.protocol !== site.protocol || !resolved.pathname.startsWith(site.pathname)) return null;
  const localRelative = decodeURIComponent(resolved.pathname.slice(site.pathname.length));
  const normalized = localRelative.endsWith('/') || !localRelative ? `${localRelative}index.html` : localRelative;
  const file = path.resolve(docsRoot, normalized);
  assert(file === docsRoot || file.startsWith(`${docsRoot}${path.sep}`), `destination escapes docs: ${target}`);
  return { file, resolved };
}

function pngDimensions(file) {
  const bytes = fs.readFileSync(file);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(signature)) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  return null;
}

function imageTargetFromTag(tag, attribute) {
  return tag.match(new RegExp(`\\b${attribute}=["']([^"']+)["']`, 'i'))?.[1] || null;
}

function dateOnPage(markup) {
  return markup.match(/<time\b[^>]*\bdatetime=["'](\d{4}-\d{2}-\d{2})["'][^>]*>/i)?.[1] || null;
}

function countMatches(markup, pattern) {
  return [...markup.matchAll(pattern)].length;
}

function checkPage(relativePath, expectedCanonical, requiredTypes) {
  const markup = read(`docs/${relativePath}`);
  const title = pageTitle(markup);
  const description = metaContent(markup, 'name', 'description');
  assert(title && title.includes('AI Vision'), `${relativePath} needs a descriptive AI Vision title`);
  assert(title.length >= 20 && title.length <= 70, `${relativePath} title length is ${title.length}; expected 20–70 characters`);
  assert(description && description.length >= 80 && description.length <= 170, `${relativePath} description length is ${description?.length || 0}; expected 80–170 characters`);
  assert(canonical(markup) === expectedCanonical, `${relativePath} canonical URL is incorrect`);
  assert((metaContent(markup, 'name', 'robots') || '').includes('index,follow'), `${relativePath} must allow indexing and following links`);
  assert(!/<meta\b[^>]*\bname=["']keywords["']/i.test(markup), `${relativePath} must not use a keyword-stuffing meta tag`);
  assert(!/gitchubst\.github\.io/i.test(markup), `${relativePath} contains the retired GitHub Pages hostname`);
  assert(countMatches(markup, /<code\b/gi) === countMatches(markup, /<\/code>/gi), `${relativePath} has unbalanced code tags`);
  assert(countMatches(markup, /<pre\b/gi) === countMatches(markup, /<\/pre>/gi), `${relativePath} has unbalanced preformatted blocks`);
  const nodes = jsonLdNodes(markup);
  for (const imageTag of markup.matchAll(/<img\b[^>]*>/gi)) {
    const tag = imageTag[0];
    assert(/\balt=["'][^"']*["']/i.test(tag), `${relativePath} contains an image without alt text`);
    const src = imageTargetFromTag(tag, 'src');
    if (src) {
      const width = Number(tag.match(/\bwidth=["'](\d+)["']/i)?.[1]);
      const height = Number(tag.match(/\bheight=["'](\d+)["']/i)?.[1]);
      assert(width > 0 && height > 0, `${relativePath} image dimensions must be positive: ${src}`);
    }
  }
  const types = jsonLdTypes(markup);
  for (const type of requiredTypes) assert(types.includes(type), `${relativePath} JSON-LD is missing ${type}`);
  const ogImage = metaContent(markup, 'property', 'og:image');
  const ogWidth = Number(metaContent(markup, 'property', 'og:image:width'));
  const ogHeight = Number(metaContent(markup, 'property', 'og:image:height'));
  assert(ogImage && ogWidth > 0 && ogHeight > 0, `${relativePath} needs a social image with dimensions`);
  const ogLocal = localPathFor(ogImage, relativePath);
  assert(ogLocal && fs.existsSync(ogLocal.file), `${relativePath} social image is not a local site asset: ${ogImage}`);
  const ogActual = pngDimensions(ogLocal.file);
  if (ogActual) assert(ogActual.width === ogWidth && ogActual.height === ogHeight, `${relativePath} social image dimensions do not match metadata`);
  const twitterImage = metaContent(markup, 'name', 'twitter:image');
  assert(twitterImage, `${relativePath} needs a Twitter image`);
  const twitterLocal = localPathFor(twitterImage, relativePath);
  assert(twitterLocal && fs.existsSync(twitterLocal.file), `${relativePath} Twitter image is not a local site asset: ${twitterImage}`);

  if (relativePath === 'index.html') {
    const website = nodes.find((node) => node?.['@type'] === 'WebSite');
    const application = nodes.find((node) => node?.['@type'] === 'SoftwareApplication');
    assert(website?.url === expectedCanonical, `${relativePath} WebSite URL must match canonical`);
    assert(application?.url === expectedCanonical, `${relativePath} SoftwareApplication URL must match canonical`);
    assert(application?.softwareVersion === '2.5', `${relativePath} SoftwareApplication must reflect the public Store version 2.5`);
    assert(String(application?.releaseNotes || '').includes('v2.8'), `${relativePath} SoftwareApplication release notes must identify the v2.8 preview`);
    const appImage = localPathFor(application?.image || '', relativePath);
    assert(appImage && fs.existsSync(appImage.file), `${relativePath} SoftwareApplication image is missing`);
  }
  if (relativePath.startsWith('guides/')) {
    const article = nodes.find((node) => node?.['@type'] === 'Article');
    assert(article?.mainEntityOfPage === expectedCanonical, `${relativePath} Article mainEntityOfPage must match canonical`);
    assert(article?.description === description, `${relativePath} Article description must match the page description`);
    const articleImage = localPathFor(article?.image || '', relativePath);
    assert(articleImage && fs.existsSync(articleImage.file), `${relativePath} Article image is missing`);
    const breadcrumb = nodes.find((node) => node?.['@type'] === 'BreadcrumbList');
    const breadcrumbItems = breadcrumb?.itemListElement || [];
    assert(breadcrumbItems.at(-1)?.item === expectedCanonical, `${relativePath} breadcrumb must end at the canonical URL`);
    const visibleDate = dateOnPage(markup);
    assert(visibleDate && article?.dateModified === visibleDate, `${relativePath} visible date and Article dateModified must match`);
  }
  return { relativePath, title, description, types, nodes, markup };
}

const version = manifest.version;
assert(packageJson.version === version, 'package and manifest versions must match');
const publicPages = publicHtmlPaths().sort();
assert(publicPages.length > 0, 'docs must contain public HTML pages');
const guidePaths = publicPages.filter((relativePath) => relativePath.startsWith('guides/'));
const pageInfos = publicPages.map((relativePath) => {
  const requiredTypes = relativePath === 'index.html'
    ? ['WebSite', 'SoftwareApplication']
    : relativePath.startsWith('guides/')
      ? ['Article', 'BreadcrumbList']
      : [];
  const expectedCanonical = relativePath === 'index.html' ? siteUrl : `${siteUrl}${relativePath}`;
  return checkPage(relativePath, expectedCanonical, requiredTypes);
});
assert(new Set(pageInfos.map(page => page.title)).size === pageInfos.length, 'page titles must be distinct');
assert(new Set(pageInfos.map(page => page.description)).size === pageInfos.length, 'page descriptions must be distinct');
assert(pageInfos.every(page => !page.types.includes('FAQPage')), 'FAQPage JSON-LD is retired for this site and must not be emitted');
assert(metaContent(read('docs/index.html'), 'name', 'google-site-verification') === 'YLyFwZK2cHcakG3nOrYRYw27DdFpeYfny3f_DKoIWP8', 'preserve the verified Search Console property tag');
assert(metaContent(read('docs/index.html'), 'name', 'msvalidate.01') === 'EFCCCA467135B73D7F4747E1C1A15E33', 'preserve the Bing Webmaster verification tag');

// Check every local destination, including same-site absolute links, fragments, and image fallbacks.
for (const relativePath of publicPages) {
  const markup = read(`docs/${relativePath}`);
  for (const match of markup.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
    const target = match[1];
    if (/^(?:mailto:|data:|javascript:)/i.test(target)) continue;
    const local = localPathFor(target, relativePath);
    if (!local) {
      if (/^https?:/i.test(target)) continue;
      fail(`${relativePath} has an invalid local destination: ${target}`);
    }
    assert(fs.existsSync(local.file), `${relativePath} has a missing destination: ${target}`);
    if (local.resolved.hash && local.file.endsWith('.html')) {
      const fragment = decodeURIComponent(local.resolved.hash.slice(1));
      assert(new RegExp(`\\bid=["']${escapeRegExp(fragment)}["']`).test(fs.readFileSync(local.file, 'utf8')), `${relativePath} has a broken fragment: ${target}`);
    }
  }
  for (const match of markup.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    for (const candidate of match[1].split(',')) {
      const target = candidate.trim().split(/\s+/)[0];
      if (!target) continue;
      const local = localPathFor(target, relativePath);
      assert(local && fs.existsSync(local.file), `${relativePath} has a missing responsive image source: ${target}`);
    }
  }
  assert(metaContent(markup, 'property', 'og:url') === canonical(markup), `${relativePath} social URL differs from canonical`);
}

const robots = read('docs/robots.txt');
assert(robots.includes('User-agent: *') && robots.includes('Allow: /'), 'robots.txt must allow the public site');
assert(robots.includes(`Sitemap: ${siteUrl}sitemap.xml`), 'robots.txt sitemap URL must match the canonical site');
for (const crawler of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot']) {
  assert(new RegExp(`User-agent:\\s*${escapeRegExp(crawler)}[\\s\\S]*?Allow:\\s*/`, 'i').test(robots), `robots.txt must explicitly allow ${crawler}`);
}

const homepageMarkup = read('docs/index.html');
assert(/id=["']facts["'][\s\S]*?Product facts|PRODUCT FACTS/i.test(homepageMarkup), 'homepage needs a visible product facts section');
for (const fact of ['Gemini Chrome extension', 'supported webpages', 'Google AI Studio', 'official Chrome Web Store', 'public GitHub repository']) {
  assert(homepageMarkup.includes(fact), `homepage product facts should mention ${fact}`);
}

const extractionGuide = read('docs/guides/copy-text-from-screenshot-chrome.html');
assert(countMatches(extractionGuide, /class=["']source-table["']/gi) === 1, 'screenshot text guide must contain one source table');
const outsidePre = extractionGuide.replace(/<pre\b[\s\S]*?<\/pre>/gi, '');
assert(!/(^|\n)\s*\|[^\n]*\|\s*$/m.test(outsidePre), 'screenshot text guide contains a stray Markdown table outside its code block');
assert(!/<\/code>\s*<\/pre>\s*<\/div>\s*<\/div>/i.test(outsidePre), 'screenshot text guide contains a malformed closing fragment');

const indexNowKeyPath = path.join(docsRoot, 'ai-vision-indexnow-20260910.txt');
assert(fs.existsSync(indexNowKeyPath), 'IndexNow key file is missing from docs');
const indexNowKey = fs.readFileSync(indexNowKeyPath, 'utf8').trim();
assert(/^[A-Za-z0-9-]{8,128}$/.test(indexNowKey), 'IndexNow key must use a valid public key format');
assert(`${siteUrl}ai-vision-indexnow-20260910.txt`.startsWith(siteUrl), 'IndexNow keyLocation must stay scoped to the project path');

const sitemap = read('docs/sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1]);
const expectedSitemapUrls = new Set(publicPages.map((relativePath) => relativePath === 'index.html' ? siteUrl : `${siteUrl}${relativePath}`));
assert(sitemapUrls.length === expectedSitemapUrls.size, 'sitemap.xml must contain exactly one URL for every public HTML page');
assert(new Set(sitemapUrls).size === sitemapUrls.length, 'sitemap.xml must not contain duplicate URLs');
for (const url of sitemapUrls) {
  assert(url.startsWith(siteUrl), `sitemap URL is outside the canonical site: ${url}`);
  const relative = url.slice(siteUrl.length);
  const localPath = relative ? path.join(docsRoot, relative) : path.join(docsRoot, 'index.html');
  assert(fs.existsSync(localPath), `sitemap URL has no local file: ${url}`);
}
for (const url of expectedSitemapUrls) assert(sitemapUrls.includes(url), `sitemap.xml is missing ${url}`);
const sitemapDates = new Map([...sitemap.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>[\s\S]*?<\/url>/gi)].map((match) => [match[1], match[2]]));
for (const page of pageInfos) {
  const visibleDate = dateOnPage(page.markup);
  if (!visibleDate) continue;
  const url = page.relativePath === 'index.html' ? siteUrl : `${siteUrl}${page.relativePath}`;
  assert(sitemapDates.get(url) === visibleDate, `${page.relativePath} visible modification date must match sitemap lastmod`);
}

const webManifest = JSON.parse(read('docs/site.webmanifest'));
assert(webManifest.name && webManifest.start_url === '/AI_Vision/', 'site.webmanifest must describe the AI Vision site');
assert(fs.existsSync(path.join(docsRoot, '.nojekyll')), 'docs/.nojekyll is required for static GitHub Pages assets');

const llms = read('docs/llms.txt');
assert(llms.includes(`Current version: ${version}`), 'llms.txt version is stale');
assert(llms.includes('public Chrome Web Store listing currently shows version 2.5'), 'llms.txt must disclose the verified public Store version');
assert(llms.includes('2.8 GitHub-build preview'), 'llms.txt must distinguish the GitHub preview from the public Store version');
for (const guidePath of guidePaths) {
  assert(llms.includes(`${siteUrl}${guidePath}`), `llms.txt must link to ${guidePath}`);
}

console.log(`SEO checks OK: ${pageInfos.length} HTML pages, ${sitemapUrls.length} sitemap URLs, JSON-LD and deployment metadata verified.`);
