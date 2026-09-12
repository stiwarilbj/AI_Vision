#!/usr/bin/env node

/**
 * Notify IndexNow after the matching GitHub Pages deployment is live.
 *
 * This script is intentionally conservative. It derives the submitted URL list
 * from the checked-in sitemap, verifies the public files before POSTing, and
 * writes a receipt so an operator can distinguish accepted, failed, and
 * ambiguous responses. The workflow supplies the Pages deployment commit and
 * changed docs paths; the workflow itself rejects failed, foreign, pull-request,
 * and superseded deployments before invoking --submit.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const siteUrl = 'https://stiwarilbj.github.io/AI_Vision/';
const site = new URL(siteUrl);
const host = site.host;
const sitemapFile = path.join(projectRoot, 'docs', 'sitemap.xml');
const keyFile = path.join(projectRoot, 'docs', 'ai-vision-indexnow-20260910.txt');
const keyLocation = `${siteUrl}${path.basename(keyFile)}`;
const defaultEndpoint = 'https://www.bing.com/indexnow';
const officialStoreUrl = 'https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk';

function parseArgs(argv = process.argv.slice(2)) {
  const flags = new Set();
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--') && arg.includes('=')) {
      const [name, ...rest] = arg.slice(2).split('=');
      values[name] = rest.join('=');
    } else if (arg.startsWith('--')) {
      const name = arg.slice(2);
      if (['endpoint', 'output', 'receipt', 'changed-files'].includes(name)) {
        values[name] = argv[index + 1];
        index += 1;
      } else {
        flags.add(name);
      }
    }
  }
  return { flags, values };
}

function readKey(file = keyFile) {
  const key = fs.readFileSync(file, 'utf8').trim();
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
    throw new Error(`IndexNow key must contain 8–128 letters, numbers, or hyphens: ${file}`);
  }
  return key;
}

function parseSitemap(xml) {
  const found = [...String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].trim());
  if (!found.length) throw new Error('sitemap contains no URL locations');
  const urls = [];
  const seen = new Set();
  for (const value of found) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`sitemap contains an invalid URL: ${value}`);
    }
    if (parsed.protocol !== site.protocol || parsed.host !== site.host || !parsed.pathname.startsWith(site.pathname) || parsed.search || parsed.hash) {
      throw new Error(`sitemap URL is outside the canonical site: ${value}`);
    }
    const canonical = parsed.toString();
    if (!seen.has(canonical)) {
      seen.add(canonical);
      urls.push(canonical);
    }
  }
  return urls;
}

function readSitemap(file = sitemapFile) {
  return parseSitemap(fs.readFileSync(file, 'utf8'));
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(parseList);
  return String(value).split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function normalizeChangedFile(value) {
  const normalized = String(value).replaceAll('\\', '/').replace(/^\.\//, '');
  return normalized === 'docs' ? 'docs/' : normalized;
}

function changedFilesFrom({ values = {}, env = process.env } = {}) {
  return [...new Set(parseList(values['changed-files'] || env.INDEXNOW_CHANGED_FILES).map(normalizeChangedFile))];
}

function loadConfig({ endpoint = defaultEndpoint, keyPath = keyFile, keyUrl = keyLocation, sitemapPath = sitemapFile } = {}) {
  const key = readKey(keyPath);
  const parsedKeyUrl = new URL(keyUrl);
  if (parsedKeyUrl.protocol !== 'https:' || parsedKeyUrl.host !== site.host || !parsedKeyUrl.pathname.startsWith(site.pathname) || parsedKeyUrl.search || parsedKeyUrl.hash) {
    throw new Error(`IndexNow keyLocation must be HTTPS and scoped under ${siteUrl}`);
  }
  if (new URL(endpoint).protocol !== 'https:') throw new Error('IndexNow endpoint must use HTTPS');
  return { endpoint, key, keyLocation: parsedKeyUrl.toString(), host, urls: readSitemap(sitemapPath), sitemapPath };
}

function buildPayload(config = loadConfig()) {
  return { host: config.host, key: config.key, keyLocation: config.keyLocation, urlList: config.urls };
}

function liveUrlForFile(relativePath) {
  const normalized = normalizeChangedFile(relativePath);
  if (!normalized.startsWith('docs/')) return null;
  const publicPath = normalized.slice('docs/'.length);
  return publicPath === 'index.html' || publicPath === '' ? siteUrl : `${siteUrl}${publicPath}`;
}

function expectedFileForLiveUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== site.protocol || parsed.host !== site.host || !parsed.pathname.startsWith(site.pathname) || parsed.search || parsed.hash) return null;
  let suffix;
  try {
    suffix = decodeURIComponent(parsed.pathname.slice(site.pathname.length));
  } catch {
    return null;
  }
  const relative = suffix && suffix !== '/' ? suffix.replace(/^\/+/, '') : 'index.html';
  const docsRoot = path.join(projectRoot, 'docs');
  const absolute = path.resolve(docsRoot, relative);
  if (absolute !== docsRoot && !absolute.startsWith(`${docsRoot}${path.sep}`)) return null;
  return absolute;
}

function filesForHash(changedFiles, { sitemapPath = sitemapFile } = {}) {
  const candidates = new Set([sitemapPath]);
  const requested = parseList(changedFiles).map(normalizeChangedFile);
  const docsFiles = requested.length ? requested : ['docs/index.html', 'docs/robots.txt', 'docs/llms.txt'];
  for (const entry of docsFiles) {
    const absolute = path.isAbsolute(entry) ? entry : path.join(projectRoot, entry);
    if (!fs.existsSync(absolute)) continue;
    const stats = fs.statSync(absolute);
    if (stats.isDirectory()) {
      const walk = (directory) => {
        for (const child of fs.readdirSync(directory, { withFileTypes: true })) {
          const childPath = path.join(directory, child.name);
          if (child.isDirectory()) walk(childPath);
          else if (child.isFile()) candidates.add(childPath);
        }
      };
      walk(absolute);
    } else {
      candidates.add(absolute);
    }
  }
  return [...candidates].sort();
}

function websiteContentHash(changedFiles = [], options = {}) {
  const hash = crypto.createHash('sha256');
  for (const file of filesForHash(changedFiles, options)) {
    const relative = path.relative(projectRoot, file).split(path.sep).join('/');
    hash.update(relative);
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function fetchResource(url, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('This Node runtime does not provide fetch');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'text/html,application/xml,text/plain' } });
    const bytes = typeof response.arrayBuffer === 'function'
      ? Buffer.from(await response.arrayBuffer())
      : Buffer.from(await response.text(), 'utf8');
    return { response, bytes, body: bytes.toString('utf8') };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, options = {}) {
  return fetchResource(url, options);
}

function assertResponseContentType(response, url) {
  const contentType = response?.headers?.get?.('content-type');
  if (!contentType) return;
  if (url.endsWith('.xml') && !/xml|text\//i.test(contentType)) throw new Error(`sitemap content type was ${contentType}`);
  if (url.endsWith('.html') || url.endsWith('/') || url.endsWith('.txt')) {
    if (!/html|text\//i.test(contentType)) throw new Error(`page content type was ${contentType} for ${url}`);
  }
}

function assertSameDeployedFile(url, bytes) {
  const expected = expectedFileForLiveUrl(url);
  if (!expected || !fs.existsSync(expected) || fs.statSync(expected).isDirectory()) return;
  const expectedBytes = fs.readFileSync(expected);
  if (!Buffer.from(bytes).equals(expectedBytes)) {
    throw new Error(`deployed file content does not match ${path.relative(projectRoot, expected)}: ${url}`);
  }
}

async function checkLive({ config = loadConfig(), fetchImpl = globalThis.fetch, attempts = 12, delayMs = 10000, requiredPaths = [] } = {}) {
  const requiredUrls = [...new Set(parseList(requiredPaths).map((entry) => entry.startsWith('http') ? entry : liveUrlForFile(entry)).filter(Boolean))];
  let lastError;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      const urlsToFetch = [config.urls[0], `${siteUrl}sitemap.xml`, config.keyLocation, ...requiredUrls];
      const responses = await Promise.all(urlsToFetch.map((url) => fetchText(url, { fetchImpl })));
      const [home, sitemap, keyFileResponse, ...requiredResponses] = responses;
      if (home.response.status !== 200) throw new Error(`homepage returned HTTP ${home.response.status}`);
      assertResponseContentType(home.response, config.urls[0]);
      if (!/<title>[^<]*AI Screenshot Assistant for Chrome[^<]*<\/title>/i.test(home.body)) throw new Error('homepage title was not found');
      if (!home.body.includes(`<link rel="canonical" href="${config.urls[0]}">`)) throw new Error('homepage canonical URL was not found');
      if (!home.body.includes(officialStoreUrl)) throw new Error('homepage installation link was not found');
      assertSameDeployedFile(config.urls[0], home.bytes);
      if (sitemap.response.status !== 200) throw new Error(`sitemap returned HTTP ${sitemap.response.status}`);
      assertResponseContentType(sitemap.response, `${siteUrl}sitemap.xml`);
      const liveUrls = parseSitemap(sitemap.body);
      if (liveUrls.length !== config.urls.length || liveUrls.some((url, index) => url !== config.urls[index])) throw new Error('live sitemap does not match the checked-in sitemap');
      if (keyFileResponse.response.status !== 200) throw new Error(`key file returned HTTP ${keyFileResponse.response.status}`);
      assertResponseContentType(keyFileResponse.response, config.keyLocation);
      if (keyFileResponse.body.trim() !== config.key) throw new Error('live IndexNow key does not match the repository key');
      for (let index = 0; index < requiredResponses.length; index += 1) {
        if (requiredResponses[index].response.status !== 200) throw new Error(`changed file returned HTTP ${requiredResponses[index].response.status}: ${requiredUrls[index]}`);
        assertResponseContentType(requiredResponses[index].response, requiredUrls[index]);
        assertSameDeployedFile(requiredUrls[index], requiredResponses[index].bytes);
      }
      return { ok: true, attempts: attempt, homepage: home.response.status, sitemap: sitemap.response.status, key: keyFileResponse.response.status, required: requiredUrls, verifiedFiles: [config.urls[0], ...requiredUrls] };
    } catch (error) {
      lastError = error;
      if (attempt < Math.max(1, attempts) && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`live deployment check failed after ${Math.max(1, attempts)} attempt(s): ${lastError?.message || 'unknown error'}`);
}

async function submitIndexNow({ config = loadConfig(), fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('This Node runtime does not provide fetch');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || 15000));
  let response;
  try {
    response = await fetchImpl(config.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', accept: 'application/json,text/plain' },
      body: JSON.stringify(buildPayload(config)),
      signal: controller.signal
    });
  } catch (error) {
    // A network error or timeout leaves the provider's receipt unknown. Mark it
    // explicitly so the workflow will not silently submit the same hash again.
    const ambiguous = new Error(`IndexNow submission outcome is unknown: ${error?.message || error}`);
    ambiguous.ambiguous = true;
    throw ambiguous;
  } finally {
    clearTimeout(timer);
  }
  let body;
  try {
    body = await response.text();
  } catch (error) {
    const ambiguous = new Error(`IndexNow submission outcome is unknown: ${error?.message || error}`);
    ambiguous.ambiguous = true;
    throw ambiguous;
  }
  if (![200, 202].includes(response.status)) throw new Error(`IndexNow returned HTTP ${response.status}: ${body.slice(0, 240)}`);
  return { accepted: true, status: response.status, body: body.slice(0, 2000) };
}

function readReceipt(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read IndexNow receipt ${file}: ${error.message}`);
  }
}

function receiptFor(result, { commit = null, websiteContentHash: contentHash = null, changedFiles = [] } = {}) {
  return {
    status: result.status,
    commit,
    websiteContentHash: contentHash,
    changedFiles,
    urls: result.payload?.urlList || result.urls || [],
    keyLocation: result.payload?.keyLocation || result.keyLocation || keyLocation,
    response: result.submission || null,
    live: result.live || null,
    reason: result.reason || null,
    recordedAt: new Date().toISOString()
  };
}

function writeReceipt(file, receipt) {
  if (!file) return;
  const absolute = path.resolve(projectRoot, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(receipt, null, 2)}\n`);
}

async function run({ argv = process.argv.slice(2), env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const { flags, values } = parseArgs(argv);
  const changed = flags.has('changed') || env.WEBSITE_CHANGED === 'true';
  const dryRun = flags.has('dry-run');
  const shouldSubmit = flags.has('submit');
  const config = loadConfig({
    endpoint: values.endpoint || env.INDEXNOW_ENDPOINT || defaultEndpoint,
    keyPath: env.INDEXNOW_KEY_FILE ? path.resolve(projectRoot, env.INDEXNOW_KEY_FILE) : keyFile,
    keyUrl: env.INDEXNOW_KEY_LOCATION || keyLocation,
    sitemapPath: env.INDEXNOW_SITEMAP_FILE ? path.resolve(projectRoot, env.INDEXNOW_SITEMAP_FILE) : sitemapFile
  });
  if (!changed) return { status: 'skipped', reason: 'website content did not change', host: config.host, urlCount: config.urls.length, keyLocation: config.keyLocation, urls: config.urls };
  const changedFiles = changedFilesFrom({ values, env });
  const commit = env.INDEXNOW_DEPLOY_COMMIT || env.GITHUB_SHA || null;
  const contentHash = websiteContentHash(changedFiles, { sitemapPath: config.sitemapPath });
  const previousReceiptPath = values.receipt || env.INDEXNOW_RECEIPT_FILE;
  const previous = readReceipt(previousReceiptPath);
  if (['submitted', 'ambiguous'].includes(previous?.status) && previous.websiteContentHash === contentHash && JSON.stringify(previous.urls) === JSON.stringify(config.urls)) {
    const reason = previous.status === 'ambiguous'
      ? 'the previous submission outcome is ambiguous; review its receipt before retrying'
      : 'website content was already acknowledged';
    return { status: 'skipped', reason, commit, websiteContentHash: contentHash, urls: config.urls, receipt: previous };
  }
  const result = { status: dryRun ? 'dry-run' : shouldSubmit ? 'submitted' : 'ready', commit, websiteContentHash: contentHash, changedFiles, payload: buildPayload(config) };
  if (dryRun || !shouldSubmit) return result;
  try {
    result.live = await checkLive({ config, fetchImpl, attempts: Number(env.INDEXNOW_LIVE_ATTEMPTS || 12), delayMs: Number(env.INDEXNOW_LIVE_DELAY_MS || 10000), requiredPaths: changedFiles });
    // Do not retry a POST. An ambiguous response is preserved by main() as an
    // ambiguous receipt and requires a human decision before another submit.
    result.submission = await submitIndexNow({ config, fetchImpl, timeoutMs: Number(env.INDEXNOW_SUBMIT_TIMEOUT_MS || 15000) });
  } catch (error) {
    error.context = { commit, websiteContentHash: contentHash, changedFiles, urls: config.urls };
    throw error;
  }
  return result;
}

async function main() {
  const { values } = parseArgs();
  const outputPath = values.output;
  const receiptPath = values.receipt || outputPath;
  try {
    const result = await run();
    const output = `${JSON.stringify(result, null, 2)}\n`;
    process.stdout.write(output);
    if (outputPath) writeReceipt(outputPath, receiptFor(result, { commit: result.commit, websiteContentHash: result.websiteContentHash, changedFiles: result.changedFiles }));
    if (values.receipt && values.receipt !== outputPath) writeReceipt(values.receipt, receiptFor(result, { commit: result.commit, websiteContentHash: result.websiteContentHash, changedFiles: result.changedFiles }));
  } catch (error) {
    const context = error.context || {};
    const failure = {
      status: error.ambiguous ? 'ambiguous' : 'failed',
      commit: context.commit || process.env.INDEXNOW_DEPLOY_COMMIT || process.env.GITHUB_SHA || null,
      websiteContentHash: context.websiteContentHash || null,
      changedFiles: context.changedFiles || [],
      urls: context.urls || [],
      response: null,
      error: error.message,
      recordedAt: new Date().toISOString()
    };
    if (receiptPath) writeReceipt(receiptPath, failure);
    process.stderr.write(`IndexNow notification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { siteUrl, host, sitemapFile, keyFile, keyLocation, defaultEndpoint, officialStoreUrl, parseArgs, readKey, parseSitemap, readSitemap, loadConfig, buildPayload, liveUrlForFile, expectedFileForLiveUrl, filesForHash, websiteContentHash, fetchResource, fetchText, checkLive, submitIndexNow, readReceipt, receiptFor, writeReceipt, run };
