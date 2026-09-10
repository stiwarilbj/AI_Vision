#!/usr/bin/env node

/**
 * Notify IndexNow after a successful GitHub Pages deployment.
 *
 * The key file is intentionally public. The workflow only invokes --submit on
 * a main-branch push that changed docs/, and the submit path verifies the live
 * homepage, sitemap, and key file before sending anything to Bing.
 */
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const siteUrl = 'https://stiwarilbj.github.io/AI_Vision/';
const host = new URL(siteUrl).host;
const keyFile = path.join(projectRoot, 'docs', 'ai-vision-indexnow-20260910.txt');
const keyLocation = `${siteUrl}${path.basename(keyFile)}`;
const urls = [
  siteUrl,
  `${siteUrl}guides/ai-screenshot-assistant.html`,
  `${siteUrl}guides/copy-text-from-screenshot-chrome.html`,
  `${siteUrl}guides/summarize-webpage-with-gemini.html`,
  `${siteUrl}guides/compare-chrome-tabs-with-gemini.html`,
  `${siteUrl}guides/get-gemini-api-key.html`,
  `${siteUrl}privacy.html`
];
const defaultEndpoint = 'https://www.bing.com/indexnow';

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
      if (['endpoint', 'output'].includes(name)) {
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

function loadConfig({ endpoint = defaultEndpoint, keyPath = keyFile, keyUrl = keyLocation } = {}) {
  const key = readKey(keyPath);
  const parsedKeyUrl = new URL(keyUrl);
  const parsedSiteUrl = new URL(siteUrl);
  if (parsedKeyUrl.protocol !== 'https:' || parsedKeyUrl.host !== parsedSiteUrl.host || !parsedKeyUrl.pathname.startsWith(parsedSiteUrl.pathname)) {
    throw new Error(`IndexNow keyLocation must be HTTPS and scoped under ${siteUrl}`);
  }
  if (new URL(endpoint).protocol !== 'https:') throw new Error('IndexNow endpoint must use HTTPS');
  return { endpoint, key, keyLocation: parsedKeyUrl.toString(), host, urls: [...urls] };
}

function buildPayload(config = loadConfig()) {
  return { host: config.host, key: config.key, keyLocation: config.keyLocation, urlList: config.urls };
}

async function fetchText(url, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('This Node runtime does not provide fetch');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'text/html,application/xml,text/plain' } });
    return { response, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

async function checkLive({ config = loadConfig(), fetchImpl = globalThis.fetch, attempts = 12, delayMs = 10000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const [home, sitemap, keyFileResponse] = await Promise.all([
        fetchText(config.urls[0], { fetchImpl }),
        fetchText(`${siteUrl}sitemap.xml`, { fetchImpl }),
        fetchText(config.keyLocation, { fetchImpl })
      ]);
      if (home.response.status !== 200) throw new Error(`homepage returned HTTP ${home.response.status}`);
      if (!/<title>[^<]*AI Screenshot Assistant for Chrome[^<]*<\/title>/i.test(home.body)) throw new Error('homepage title was not found');
      if (sitemap.response.status !== 200) throw new Error(`sitemap returned HTTP ${sitemap.response.status}`);
      for (const url of config.urls) if (!sitemap.body.includes(`<loc>${url}</loc>`)) throw new Error(`sitemap is missing ${url}`);
      if (keyFileResponse.response.status !== 200) throw new Error(`key file returned HTTP ${keyFileResponse.response.status}`);
      if (keyFileResponse.body.trim() !== config.key) throw new Error('live IndexNow key does not match the repository key');
      return { ok: true, attempts: attempt, homepage: home.response.status, sitemap: sitemap.response.status, key: keyFileResponse.response.status };
    } catch (error) {
      lastError = error;
      if (attempt < attempts && delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`live deployment check failed after ${attempts} attempt(s): ${lastError?.message || 'unknown error'}`);
}

async function submitIndexNow({ config = loadConfig(), fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('This Node runtime does not provide fetch');
  const response = await fetchImpl(config.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', accept: 'application/json,text/plain' },
    body: JSON.stringify(buildPayload(config))
  });
  const body = await response.text();
  if (![200, 202].includes(response.status)) throw new Error(`IndexNow returned HTTP ${response.status}: ${body.slice(0, 240)}`);
  return { accepted: true, status: response.status, body: body.slice(0, 2000) };
}

async function run({ argv = process.argv.slice(2), env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const { flags, values } = parseArgs(argv);
  const changed = flags.has('changed') || env.WEBSITE_CHANGED === 'true';
  const dryRun = flags.has('dry-run');
  const shouldSubmit = flags.has('submit');
  const config = loadConfig({ endpoint: values.endpoint || env.INDEXNOW_ENDPOINT || defaultEndpoint, keyPath: env.INDEXNOW_KEY_FILE ? path.resolve(projectRoot, env.INDEXNOW_KEY_FILE) : keyFile, keyUrl: env.INDEXNOW_KEY_LOCATION || keyLocation });
  if (!changed) return { status: 'skipped', reason: 'website content did not change', host: config.host, urlCount: config.urls.length, keyLocation: config.keyLocation };
  const result = { status: dryRun ? 'dry-run' : shouldSubmit ? 'submitted' : 'ready', payload: buildPayload(config) };
  if (dryRun || !shouldSubmit) return result;
  result.live = await checkLive({ config, fetchImpl, attempts: Number(env.INDEXNOW_LIVE_ATTEMPTS || 12), delayMs: Number(env.INDEXNOW_LIVE_DELAY_MS || 10000) });
  result.submission = await submitIndexNow({ config, fetchImpl });
  return result;
}

async function main() {
  const { values } = parseArgs();
  try {
    const result = await run();
    const output = `${JSON.stringify(result, null, 2)}\n`;
    process.stdout.write(output);
    if (values.output) fs.writeFileSync(path.resolve(projectRoot, values.output), output);
  } catch (error) {
    process.stderr.write(`IndexNow notification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { siteUrl, host, keyFile, keyLocation, urls, parseArgs, readKey, loadConfig, buildPayload, checkLive, submitIndexNow, run };
