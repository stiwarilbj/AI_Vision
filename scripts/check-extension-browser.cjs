// Smoke-test the packaged extension in an isolated Chromium profile.
// This deliberately uses synthetic page content and never reads a user's
// normal Chrome profile or contacts Gemini.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const projectRoot = path.resolve(__dirname, '..');
const extensionPath = path.resolve(process.env.EXTENSION_PATH || projectRoot);
const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'));
let testExtensionPath;
let testExtensionCleanup;
const fixtureHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>AI Vision synthetic test page</title></head>
<body><main><h1>Quarterly reading progress</h1><p>This fictional page exists only for the automated extension smoke test.</p>
<button type="button">Example control</button></main></body></html>`;

function startFixtureServer() {
  const server = http.createServer((request, response) => {
    if (new URL(request.url, 'http://127.0.0.1').pathname !== '/fixture.html') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(fixtureHtml);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function launchOptions() {
  const loadedExtensionPath = testExtensionPath || extensionPath;
  const options = {
    headless: true,
    args: [
      `--disable-extensions-except=${loadedExtensionPath}`,
      `--load-extension=${loadedExtensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking'
    ]
  };
  if (process.env.CHROME_EXECUTABLE) options.executablePath = process.env.CHROME_EXECUTABLE;
  else if (process.env.CI) options.channel = 'chromium';
  else {
    const candidates = [
      chromium.executablePath(),
      '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];
    const executable = candidates.find((candidate) => fs.existsSync(candidate));
    if (executable) options.executablePath = executable;
  }
  return options;
}

function prepareTestExtension() {
  // The production package keeps host permissions narrow. A disposable copy
  // receives loopback plus a temporary broad capture grant so headless Chrome
  // can exercise the real injection and capture path. This copy is deleted at
  // the end of the test and never enters the release package.
  testExtensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-vision-extension-test-'));
  fs.cpSync(extensionPath, testExtensionPath, { recursive: true });
  const testManifestPath = path.join(testExtensionPath, 'manifest.json');
  const testManifest = JSON.parse(fs.readFileSync(testManifestPath, 'utf8'));
  testManifest.host_permissions = [...new Set([...(testManifest.host_permissions || []), 'http://127.0.0.1/*', '<all_urls>'])];
  fs.writeFileSync(testManifestPath, `${JSON.stringify(testManifest, null, 2)}\n`);
  testExtensionCleanup = () => fs.rmSync(testExtensionPath, { recursive: true, force: true });
}

async function installWorkerFixtures(worker) {
  await worker.evaluate(() => {
    globalThis.__aiVisionTestFetchCalls = [];
    globalThis.fetch = async (url, options = {}) => {
      const method = String(options.method || 'GET').toUpperCase();
      globalThis.__aiVisionTestFetchCalls.push({ url: String(url), method, body: options.body || null });
      if (method === 'GET') {
        return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      let requestBody = {};
      try { requestBody = JSON.parse(options.body || '{}'); } catch (_) { /* keep the deterministic default */ }
      const prompt = JSON.stringify(requestBody);
      const text = /USER TASK|Open the example control|browser task/i.test(prompt)
        ? JSON.stringify({ action: 'navigate', tabIndex: 0, url: 'https://example.com/fixture', reason: 'Open the fictional example destination.' })
        : 'Fixture answer: the selected chart rises from 40 to 100 pages. Ask a follow-up if you want the largest change explained.';
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    return true;
  });
  await worker.evaluate(async () => {
    await chrome.storage.local.set({ geminiApiKey: 'fixture-key', geminiModel: 'gemini-3.5-flash', geminiCaptureBehavior: 'manual' });
  });
}

async function exposeOpenShadowAndInject(worker, tabId, tabUrl) {
  await worker.evaluate(async ({ tabId, tabUrl }) => {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (globalThis.__aiVisionTestOpenShadow) return;
        const attachShadow = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function(options) {
          return attachShadow.call(this, { ...(options || {}), mode: 'open' });
        };
        globalThis.__aiVisionTestOpenShadow = true;
      }
    });
    await openAssistantInTab({ id: tabId, url: tabUrl });
  }, { tabId, tabUrl });
}

async function serviceWorkerFor(context) {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  return worker;
}

async function openProfile(userDataDir) {
  const context = await chromium.launchPersistentContext(userDataDir, launchOptions());
  try {
    const worker = await serviceWorkerFor(context);
    assert.match(worker.url(), /^chrome-extension:\/\//, 'the extension service worker started');
    return { context, worker };
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}

function writeReport(report) {
  const reportPath = process.env.EXTENSION_REPORT;
  if (!reportPath) return;
  fs.mkdirSync(path.dirname(path.resolve(projectRoot, reportPath)), { recursive: true });
  fs.writeFileSync(path.resolve(projectRoot, reportPath), `${JSON.stringify(report, null, 2)}\n`);
}

(async () => {
  const startedAt = new Date().toISOString();
  const fixtureServer = await startFixtureServer();
  const fixturePort = fixtureServer.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-vision-smoke-'));
  const freshProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-vision-smoke-fresh-'));
  const report = { status: 'failed', version: manifest.version, startedAt, fixture: `http://127.0.0.1:${fixturePort}/fixture.html` };
  let firstContext;
  let reopenedContext;
  let freshContext;
  let debugPage;
  try {
    assert.equal(manifest.version, '2.8', 'the smoke test targets the v2.8 manifest');
    assert.equal(manifest.manifest_version, 3, 'the release uses Manifest V3');
    assert.ok(manifest.permissions.includes('storage'), 'storage permission is declared');
    assert.ok(manifest.permissions.includes('activeTab'), 'activeTab permission is declared');

    prepareTestExtension();
    firstContext = await openProfile(profile);
    const { context, worker } = firstContext;
    const extensionId = worker.url().split('/')[2];
    assert.ok(extensionId, 'the worker has an extension id');
    assert.equal(await worker.evaluate(() => typeof globalThis.AIVisionAdkRuntime), 'object', 'the bundled ADK runtime is loaded');
    assert.equal(await worker.evaluate(() => typeof openAssistantInTab), 'function', 'the worker exposes the action injection boundary');

    const pageErrors = [];
    const networkCalls = [];
    const unexpectedRequests = [];
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (/^(?:about:|chrome:\/\/|chrome-extension:\/\/|devtools:\/\/|data:|http:\/\/127\.0\.0\.1:)/.test(url)) {
        await route.continue();
        return;
      }
      unexpectedRequests.push(url);
      await route.abort();
    });
    context.on('request', (request) => {
      const url = request.url();
      if (!/^(?:about:|chrome:\/\/|chrome-extension:\/\/|devtools:\/\/|data:|http:\/\/127\.0\.0\.1:)/.test(url)) {
        unexpectedRequests.push(url);
      }
    });
    const page = await context.newPage();
    debugPage = page;
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('request', (request) => {
      if (request.url().includes('generativelanguage.googleapis.com')) networkCalls.push(request.url());
    });
    await page.goto(report.fixture);
    assert.equal(await page.title(), 'AI Vision synthetic test page');

    // Confirm the disposable profile starts empty before loading fixture data.
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/permission.html`);
    const settings = await extensionPage.evaluate(() => chrome.runtime.sendMessage({ action: 'getSettings' }));
    assert.equal(settings.hasApiKey, false, 'the fresh profile has no API key');
    assert.equal(settings.geminiCaptureBehavior, 'manual', 'missing capture behavior defaults to manual');

    const marker = `smoke-${Date.now()}`;
    const storedMarker = await extensionPage.evaluate(async (value) => {
      await chrome.storage.local.set({ aiVisionSmokeMarker: value });
      return (await chrome.storage.local.get(['aiVisionSmokeMarker'])).aiVisionSmokeMarker;
    }, marker);
    assert.equal(storedMarker, marker, 'extension storage can persist a test marker');

    await installWorkerFixtures(worker);
    const fixtureTabId = await worker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((tab) => tab.url === url)?.id;
    }, report.fixture);
    assert.ok(Number.isInteger(fixtureTabId), 'the service worker can identify the synthetic tab');
    await exposeOpenShadowAndInject(worker, fixtureTabId, report.fixture);
    const panel = page.locator('#ai-vision-host');
    await panel.waitFor({ state: 'attached', timeout: 15000 });
    const primary = panel.locator('#gemini-primary-mode');
    await primary.waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await primary.textContent(), 'Select an area', 'the actual injected panel opens in Screenshot mode');
    await primary.click();
    await panel.locator('.gemini-selection-help').waitFor({ state: 'visible' });
    await page.mouse.move(80, 120);
    await page.mouse.down();
    await page.mouse.move(560, 420);
    await page.mouse.up();
    await panel.locator('.gemini-capture-preview img').waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await panel.locator('#gemini-explain-capture').isVisible(), true, 'the real panel offers Explain screenshot after capture');
    await panel.locator('#gemini-explain-capture').click();
    await panel.locator('.gemini-answer-text').waitFor({ state: 'visible', timeout: 15000 });
    assert.match(await panel.locator('.gemini-answer-text').textContent(), /Fixture answer/);
    await panel.locator('#gemini-popup-query-input').fill('What should I ask next?');
    await panel.locator('#gemini-popup-query-input').press('Enter');
    await panel.locator('.gemini-answer-text').waitFor({ state: 'visible', timeout: 15000 });
    const fetchCalls = await worker.evaluate(() => globalThis.__aiVisionTestFetchCalls || []);
    assert.ok(fetchCalls.some((call) => call.method === 'POST'), 'the real answer flow reaches the service worker Gemini boundary');
    await primary.click();
    await page.keyboard.press('Escape');
    assert.equal(await panel.locator('.gemini-capture-preview img').isVisible(), true, 'cancelling a retake preserves the previous screenshot');

    await panel.locator('#gemini-settings-button').click();
    await panel.locator('#gemini-capture-behavior-auto').click();
    await panel.locator('.gemini-done-button').click();
    await worker.evaluate(() => { globalThis.__aiVisionTestFetchCalls = []; });
    await primary.click();
    await page.mouse.move(90, 130);
    await page.mouse.down();
    await page.mouse.move(520, 380);
    await page.mouse.up();
    await panel.locator('.gemini-answer-text').waitFor({ state: 'visible', timeout: 15000 });
    const automaticCalls = await worker.evaluate(() => (globalThis.__aiVisionTestFetchCalls || []).filter((call) => call.method === 'POST'));
    assert.equal(automaticCalls.length, 1, 'automatic mode sends exactly one request for a successful capture');

    await panel.locator('#gemini-settings-button').click();
    await panel.locator('.gemini-switch').click();
    await panel.locator('.gemini-done-button').click();
    await panel.locator('#gemini-popup-query-input').fill('Open the example control');
    await panel.locator('#gemini-popup-send').click();
    await panel.locator('.gemini-approval-actions').waitFor({ state: 'visible', timeout: 15000 });
    assert.match(await panel.locator('#gemini-popup-response-area').textContent(), /Approval required/);
    await panel.locator('.gemini-approval-actions button:nth-child(2)').click();
    await panel.locator('#gemini-popup-response-area').waitFor({ state: 'visible' });
    await page.waitForFunction(() => /Task (?:cancelled|stopped)/i.test(document.querySelector('#ai-vision-host')?.shadowRoot?.querySelector('#gemini-popup-response-area')?.textContent || ''));

    const deniedAllTabs = await worker.evaluate(async () => {
      try { await askGemini({ mode: 'all-tabs', query: 'Compare these tabs', requestId: 'fixture-denied' }, { tab: { windowId: 1, id: 1 } }); return false; }
      catch (error) { return /All Tabs access|not enabled/i.test(error.message); }
    });
    assert.equal(deniedAllTabs, true, 'the service worker denies Compare tabs without optional permission');

    // The extension page above also exercises the real runtime message path;
    // the synthetic tab never receives a production credential.
    assert.deepEqual(networkCalls, [], 'no Gemini request occurs during startup or inspection');
    assert.deepEqual(unexpectedRequests, [], 'unexpected external network requests fail the smoke test');
    assert.deepEqual(pageErrors, [], 'the synthetic page has no extension runtime errors');

    const screenshotDir = process.env.EXTENSION_SCREENSHOTS;
    if (screenshotDir) {
      const absolute = path.resolve(projectRoot, screenshotDir);
      fs.mkdirSync(absolute, { recursive: true });
      await page.screenshot({ path: path.join(absolute, 'extension-browser-smoke.png'), fullPage: true });
    }
    await firstContext.context.close();
    firstContext = null;

    reopenedContext = await openProfile(profile);
    const reopenedSettings = await reopenedContext.worker.evaluate(async (value) => {
      const settingsValue = await chrome.storage.local.get(['aiVisionSmokeMarker', 'geminiApiKey']);
      return { marker: settingsValue.aiVisionSmokeMarker, hasKey: Boolean(settingsValue.geminiApiKey) };
    }, marker);
    assert.equal(reopenedSettings.marker, marker, 'the test marker survives a profile restart');
    assert.equal(reopenedSettings.hasKey, true, 'the fixture key survives a profile restart');
    await reopenedContext.context.close();
    reopenedContext = null;

    freshContext = await openProfile(freshProfile);
    const freshValues = await freshContext.worker.evaluate(async () => chrome.storage.local.get(['aiVisionSmokeMarker', 'geminiApiKey']));
    assert.equal(freshValues.aiVisionSmokeMarker, undefined, 'a fresh profile starts without test state');
    assert.equal(freshValues.geminiApiKey, undefined, 'a fresh profile starts without credentials');
    await freshContext.context.close();
    freshContext = null;

    report.status = 'passed';
    report.checks = [
      'Manifest V3 and v2.8 metadata',
      'service worker startup and bundled ADK runtime',
      'extension-page messaging and default settings',
      'isolated storage persistence and fresh-profile reset',
      'no Gemini network request without an explicit question or key',
      'real injected capture, explanation, follow-up, retake cancellation, and automatic mode',
      'service-worker permission denial for Compare tabs and fixture Gemini responses',
      'real Browser-task approval and Stop action'
    ];
    console.log('Extension browser smoke check passed in isolated Chromium profiles.');
  } catch (error) {
    report.error = error && error.stack ? error.stack : String(error);
    if (debugPage) {
      report.panelDebug = await debugPage.locator('#ai-vision-host').evaluate((host) => ({
        shadow: Boolean(host.shadowRoot),
        text: host.shadowRoot?.textContent?.slice(0, 2000) || '',
        html: host.shadowRoot?.innerHTML?.slice(0, 4000) || ''
      })).catch((debugError) => ({ error: debugError.message }));
    }
    console.error(error);
    process.exitCode = 1;
  } finally {
    await firstContext?.context.close().catch(() => {});
    await reopenedContext?.context.close().catch(() => {});
    await freshContext?.context.close().catch(() => {});
    await new Promise((resolve) => fixtureServer.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(freshProfile, { recursive: true, force: true });
    testExtensionCleanup?.();
    report.finishedAt = new Date().toISOString();
    writeReport(report);
  }
})().catch((error) => {
  writeReport({ status: 'failed', error: error && error.stack ? error.stack : String(error) });
  console.error(error);
  process.exitCode = 1;
});
