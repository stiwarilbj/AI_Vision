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
  const types = [];
  for (const match of markup.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch (error) {
      fail(`invalid JSON-LD: ${error.message}`);
    }
    const nodes = parsed?.['@graph'] || [parsed];
    for (const node of nodes) {
      if (typeof node?.['@type'] === 'string') types.push(node['@type']);
      if (Array.isArray(node?.['@type'])) types.push(...node['@type']);
    }
  }
  return types;
}

function checkPage(relativePath, expectedCanonical, requiredTypes) {
  const markup = read(relativePath);
  const title = pageTitle(markup);
  const description = metaContent(markup, 'name', 'description');
  assert(title && title.includes('AI Vision'), `${relativePath} needs a descriptive AI Vision title`);
  assert(title.length >= 20 && title.length <= 70, `${relativePath} title length is ${title.length}; expected 20–70 characters`);
  assert(description && description.length >= 80 && description.length <= 170, `${relativePath} description length is ${description?.length || 0}; expected 80–170 characters`);
  assert(canonical(markup) === expectedCanonical, `${relativePath} canonical URL is incorrect`);
  assert((metaContent(markup, 'name', 'robots') || '').includes('index,follow'), `${relativePath} must allow indexing and following links`);
  assert(!/<meta\b[^>]*\bname=["']keywords["']/i.test(markup), `${relativePath} must not use a keyword-stuffing meta tag`);
  assert(!/gitchubst\.github\.io/i.test(markup), `${relativePath} contains the retired GitHub Pages hostname`);
  for (const imageTag of markup.matchAll(/<img\b[^>]*>/gi)) {
    assert(/\balt=["'][^"']*["']/i.test(imageTag[0]), `${relativePath} contains an image without alt text`);
  }
  const types = jsonLdTypes(markup);
  for (const type of requiredTypes) assert(types.includes(type), `${relativePath} JSON-LD is missing ${type}`);
  return { title, description, types };
}

const version = manifest.version;
assert(packageJson.version === version, 'package and manifest versions must match');
const index = checkPage('docs/index.html', siteUrl, ['WebSite', 'SoftwareApplication', 'FAQPage']);
const guidePaths = [
  'ai-screenshot-assistant.html',
  'summarize-webpage-with-gemini.html',
  'compare-chrome-tabs-with-gemini.html'
];
const guides = guidePaths.map((guidePath) => checkPage(
  `docs/guides/${guidePath}`,
  `${siteUrl}guides/${guidePath}`,
  ['Article', 'BreadcrumbList']
));
checkPage('docs/privacy.html', `${siteUrl}privacy.html`, []);

const robots = read('docs/robots.txt');
assert(robots.includes('User-agent: *') && robots.includes('Allow: /'), 'robots.txt must allow the public site');
assert(robots.includes(`Sitemap: ${siteUrl}sitemap.xml`), 'robots.txt sitemap URL must match the canonical site');

const sitemap = read('docs/sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1]);
assert(sitemapUrls.length >= 5, 'sitemap.xml should contain the landing page, three guides, and privacy page');
for (const url of sitemapUrls) {
  assert(url.startsWith(siteUrl), `sitemap URL is outside the canonical site: ${url}`);
  const relative = url.slice(siteUrl.length);
  const localPath = relative ? path.join(docsRoot, relative) : path.join(docsRoot, 'index.html');
  assert(fs.existsSync(localPath), `sitemap URL has no local file: ${url}`);
}

const webManifest = JSON.parse(read('docs/site.webmanifest'));
assert(webManifest.name && webManifest.start_url === '/AI_Vision/', 'site.webmanifest must describe the AI Vision site');
assert(fs.existsSync(path.join(docsRoot, '.nojekyll')), 'docs/.nojekyll is required for static GitHub Pages assets');

const llms = read('docs/llms.txt');
assert(llms.includes(`Current version: ${version}`), 'llms.txt version is stale');
for (const guidePath of guidePaths) {
  assert(llms.includes(`${siteUrl}guides/${guidePath}`), `llms.txt must link to ${guidePath}`);
}

console.log(`SEO checks OK: ${[index, ...guides].length + 1} HTML pages, ${sitemapUrls.length} sitemap URLs, JSON-LD and deployment metadata verified.`);
