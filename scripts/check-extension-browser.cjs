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
  const options = {
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
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
  try {
    assert.equal(manifest.version, '2.8', 'the smoke test targets the v2.8 manifest');
    assert.equal(manifest.manifest_version, 3, 'the release uses Manifest V3');
    assert.ok(manifest.permissions.includes('storage'), 'storage permission is declared');
    assert.ok(manifest.permissions.includes('activeTab'), 'activeTab permission is declared');

    firstContext = await openProfile(profile);
    const { context, worker } = firstContext;
    const extensionId = worker.url().split('/')[2];
    assert.ok(extensionId, 'the worker has an extension id');
    assert.equal(await worker.evaluate(() => typeof globalThis.AIVisionAdkRuntime), 'object', 'the bundled ADK runtime is loaded');
    assert.equal(await worker.evaluate(() => typeof openAssistantInTab), 'function', 'the worker exposes the action injection boundary');

    const pageErrors = [];
    const networkCalls = [];
    const unexpectedRequests = [];
    context.on('request', (request) => {
      const url = request.url();
      if (!/^(?:about:|chrome:\/\/|chrome-extension:\/\/|devtools:\/\/|data:|http:\/\/127\.0\.0\.1:)/.test(url)) {
        unexpectedRequests.push(url);
      }
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('request', (request) => {
      if (request.url().includes('generativelanguage.googleapis.com')) networkCalls.push(request.url());
    });
    await page.goto(report.fixture);
    assert.equal(await page.title(), 'AI Vision synthetic test page');

    // Messaging is exercised from a real extension page, while the synthetic
    // tab remains untouched because activeTab is intentionally not granted by
    // a test-only background call.
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
    assert.equal(reopenedSettings.hasKey, false, 'the restarted profile still has no API key');
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
      'no Gemini network request without an explicit question or key'
    ];
    console.log('Extension browser smoke check passed in isolated Chromium profiles.');
  } catch (error) {
    report.error = error && error.stack ? error.stack : String(error);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await firstContext?.context.close().catch(() => {});
    await reopenedContext?.context.close().catch(() => {});
    await freshContext?.context.close().catch(() => {});
    await new Promise((resolve) => fixtureServer.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(freshProfile, { recursive: true, force: true });
    report.finishedAt = new Date().toISOString();
    writeReport(report);
  }
})().catch((error) => {
  writeReport({ status: 'failed', error: error && error.stack ? error.stack : String(error) });
  console.error(error);
  process.exitCode = 1;
});
