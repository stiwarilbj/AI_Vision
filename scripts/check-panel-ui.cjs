// Browser regression checks for the screenshot-first panel. Requires Playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, `.${new URL(req.url, 'http://localhost').pathname}`);
  if (!file.startsWith(`${root}${path.sep}`)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || undefined });
  const errors = [];
  let page;
  const url = `http://127.0.0.1:${server.address().port}/tests/manual/assistant-panel-harness.html`;
  const get = async selector => (await page.evaluateHandle(s => window.__panelTestRoot.querySelector(s), selector)).asElement();
  const click = async selector => { const element = await get(selector); assert.ok(element, selector); await element.click(); };
  const visible = selector => page.evaluate(s => Boolean(window.__panelTestRoot.querySelector(s)?.getClientRects().length), selector);
  const text = selector => page.evaluate(s => window.__panelTestRoot.querySelector(s)?.textContent || '', selector);
  const waitText = value => page.waitForFunction(t => window.__panelTestRoot.querySelector('#gemini-popup-response-area')?.textContent.includes(t), value);
  const choose = async value => (await get('#gemini-mode-select')).selectOption(value);
  const requests = () => page.evaluate(() => window.__aiVisionTestRequests.filter(r => r.action === 'askGemini'));
  const openMoreActions = () => page.evaluate(() => {
    const details = window.__panelTestRoot.querySelector('#gemini-more-actions');
    if (!details.open) details.querySelector('summary').click();
  });

  async function open(scenario = '') {
    if (page) await page.close();
    page = await browser.newPage({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const attach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function(options) {
        const root = attach.call(this, options);
        if (this.id === 'ai-vision-host') window.__panelTestRoot = root;
        return root;
      };
    });
    await page.goto(`${url}?scenario=${scenario}`);
    await page.waitForFunction(() => window.__panelTestRoot?.querySelector('#gemini-primary-mode'));
  }

  async function captureArea() {
    await click('#gemini-primary-mode');
    await page.waitForFunction(() => window.__panelTestRoot.querySelector('.gemini-selection-help'));
    await page.mouse.move(60, 60); await page.mouse.down(); await page.mouse.move(340, 190); await page.mouse.up();
    await page.waitForFunction(() => {
      const popup = window.__panelTestRoot.querySelector('#gemini-popup');
      return popup?.getClientRects().length && window.__panelTestRoot.querySelector('.gemini-capture-preview img');
    });
  }

  async function screenshot(name) {
    if (!process.env.UI_SCREENSHOTS) return;
    fs.mkdirSync(process.env.UI_SCREENSHOTS, { recursive: true });
    await (await get('#gemini-popup')).screenshot({ path: path.join(process.env.UI_SCREENSHOTS, `${name}.png`) });
  }

  try {
    await open();
    assert.equal(await page.evaluate(() => document.querySelector('#ai-vision-host').shadowRoot), null);
    assert.equal(await visible('#gemini-popup-composer'), false);
    assert.equal(await visible('#gemini-more-actions'), false);
    assert.equal(await visible('#gemini-agent-mode-row'), false);
    assert.equal(await text('#gemini-primary-mode'), 'Select an area');
    await screenshot('extension-welcome');

    await click('#gemini-primary-mode');
    assert.equal(await visible('.gemini-selection-help'), true);
    assert.match(await text('.gemini-selection-help'), /Drag around what you want explained/);
    await click('.gemini-selection-cancel');
    assert.equal(await visible('#gemini-primary-mode'), true);
    assert.equal(await page.evaluate(() => window.__panelTestRoot.activeElement.id), 'gemini-primary-mode');

    await captureArea();
    assert.equal((await requests()).length, 0, 'manual capture does not send automatically');
    assert.equal(await visible('#gemini-explain-capture'), true);
    assert.equal(await visible('#gemini-custom-question'), true);
    assert.equal(await visible('#gemini-popup-composer'), false);
    assert.equal(await visible('#gemini-more-actions'), true);
    await screenshot('extension-capture');
    await click('#gemini-explain-capture');
    await waitText('The selected chart rises from 40 to 100 pages.');
    assert.equal((await requests()).length, 1);
    assert.ok((await requests())[0].captureImageData);
    assert.equal(await visible('#gemini-popup-composer'), true);
    assert.equal(await visible('#gemini-custom-question'), false);
    assert.match(await (await get('#gemini-popup-query-input')).getAttribute('placeholder'), /follow-up/i);
    await screenshot('extension-answer');
    await (await get('#gemini-popup-query-input')).fill('Explain more');
    await page.keyboard.press('Enter');
    await waitText('Local follow-up response with 1 earlier turn.');
    assert.equal((await requests()).at(-1).conversationHistory.length, 2);
    await click('.gemini-answer-actions button:nth-child(2)');
    await waitText('Local follow-up response with 1 earlier turn.');
    assert.equal((await requests()).at(-1).conversationHistory.length, 2);

    await click('#gemini-primary-mode');
    await page.keyboard.press('Escape');
    assert.match(await text('#gemini-popup-response-area'), /Local follow-up response/);
    assert.equal(await visible('.gemini-capture-preview img'), true);
    await captureArea();
    assert.equal(await visible('#gemini-popup-response-area'), false, 'a new capture starts a new conversation');
    assert.equal((await requests()).length, 3, 'a fresh manual capture waits for Explain');

    await choose('tab');
    assert.equal(await visible('#gemini-capture-frame'), false);
    await openMoreActions();
    await click('#gemini-popup-presets button');
    await waitText('The selected chart rises from 40 to 100 pages.');
    assert.equal((await requests()).at(-1).mode, 'tab');
    await choose('all-tabs');
    await openMoreActions();
    await click('#gemini-popup-presets button');
    await waitText('The selected chart rises from 40 to 100 pages.');
    assert.equal((await requests()).at(-1).mode, 'all-tabs');

    await click('#gemini-settings-button');
    assert.equal(await visible('#gemini-capture-behavior'), true);
    assert.equal(await page.evaluate(() => window.__panelTestRoot.querySelector('#gemini-capture-behavior-manual').checked), true);
    await click('#gemini-capture-behavior-auto');
    await page.waitForFunction(() => window.__panelTestRoot.querySelector('#gemini-capture-behavior-feedback').textContent.includes('automatically'));
    assert.equal(await page.evaluate(() => window.__aiVisionTestSettings.geminiCaptureBehavior), 'auto-explain');
    await click('#gemini-capture-behavior-manual');
    await page.waitForFunction(() => window.__panelTestRoot.querySelector('#gemini-capture-behavior-feedback').textContent.includes('wait'));
    await click('#gemini-instructions-panel summary');
    assert.match(await text('#gemini-instructions-panel'), /Help & shortcuts/);
    await click('#gemini-optional-settings summary');
    assert.equal(await visible('#gemini-model-select'), true);
    await screenshot('extension-settings');
    await click('.gemini-done-button');

    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 640 : 768 });
      assert.equal(await page.evaluate(() => {
        const panel = window.__panelTestRoot.querySelector('#gemini-popup');
        const bounds = panel.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight && panel.scrollWidth <= panel.clientWidth;
      }), true, `Panel fits ${width}px`);
    }

    await open('setup');
    await page.waitForFunction(() => window.__panelTestRoot.querySelector('#gemini-settings-panel.show'));
    assert.equal(await text('.gemini-api-key-status'), 'Not set yet');
    assert.equal(await visible('.gemini-get-key-link'), true);
    assert.equal(await visible('#gemini-capture-behavior'), false);
    await screenshot('extension-key-setup');
    await (await get('#gemini-settings-api-key')).fill('fictional-test-key');
    await click('.gemini-api-key-actions button');
    await page.waitForFunction(() => window.__panelTestRoot.querySelector('.gemini-api-key-status').textContent === 'Connected');
    await click('.gemini-done-button');
    await page.waitForFunction(() => window.__panelTestRoot.querySelector('#gemini-screenshot-overlay'));
    await page.keyboard.press('Escape');

    for (const scenario of ['invalid-key', 'quota-key', 'empty-models']) {
      await open(scenario);
      await click('#gemini-settings-button');
      await page.waitForFunction(() => window.__panelTestRoot.querySelector('#gemini-key-feedback').textContent.includes('connection wasn’t confirmed'));
      assert.notEqual(await text('.gemini-api-key-status'), 'Connected');
      assert.equal(await page.evaluate(() => window.__aiVisionTestSettings.hasApiKey), true);
      assert.equal(await (await get('.gemini-check-key')).isEnabled(), true);
    }

    await open('denied');
    await choose('all-tabs'); await openMoreActions(); await click('#gemini-popup-presets button');
    await waitText('Compare tabs access was not enabled.');
    assert.equal((await requests()).length, 0);

    await open('error');
    await choose('tab'); await openMoreActions(); await click('#gemini-popup-presets button');
    await waitText('Test connection unavailable');
    assert.equal(await (await get('#gemini-popup-send')).isEnabled(), true);

    await open('slow-capture');
    await click('#gemini-primary-mode');
    await page.mouse.move(60, 60); await page.mouse.down(); await page.mouse.move(340, 190); await page.mouse.up();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(260);
    assert.equal(await visible('#gemini-primary-mode'), true, 'a stale capture callback does not reopen the panel');
    assert.equal(await visible('.gemini-capture-preview img'), false);

    await open('slow-manual');
    await captureArea();
    await page.evaluate(() => {
      const explain = window.__panelTestRoot.querySelector('#gemini-explain-capture');
      explain.click();
      explain.click();
    });
    assert.equal((await requests()).length, 1, 'duplicate Explain clicks send only one request');
    await waitText('The selected chart rises from 40 to 100 pages.');

    await open('auto');
    assert.match(await text('#gemini-primary-mode'), /Select & explain/);
    await captureArea();
    await waitText('The selected chart rises from 40 to 100 pages.');
    assert.equal((await requests()).length, 1, 'automatic mode sends exactly once');
    await captureArea();
    await waitText('The selected chart rises from 40 to 100 pages.');
    assert.equal((await requests()).length, 2, 'a successful retake explains exactly once');

    await open('slow-request');
    await captureArea();
    await page.waitForFunction(() => window.__panelTestRoot.querySelector('#gemini-request-cancel'));
    await click('#gemini-request-cancel');
    await waitText('Request stopped.');
    await page.waitForTimeout(300);
    assert.equal((await text('#gemini-popup-response-area')).includes('late answer'), false);

    for (const scenario of ['approval', 'running']) {
      await open(scenario);
      await click('#gemini-settings-button'); await click('.gemini-switch'); await click('.gemini-done-button');
      await (await get('#gemini-popup-query-input')).fill('Open the example');
      await click('#gemini-popup-send');
      await waitText(scenario === 'approval' ? 'Approval required' : 'Starting Browser tasks');
      assert.equal(await (await get('#gemini-mode-select')).isEnabled(), false);
      assert.equal(await visible('#gemini-popup-composer'), false);
      await page.setViewportSize({ width: 390, height: 600 });
      const stopSelector = scenario === 'approval' ? '.gemini-approval-actions button:nth-child(2)' : '.gemini-agent-cancel-button';
      const stopBounds = await (await get(stopSelector)).boundingBox();
      assert.ok(stopBounds && stopBounds.y + stopBounds.height <= 600, 'Stop stays in view on a short window');
      await click(stopSelector);
      await waitText('Local test task stopped.');
    }

    assert.deepEqual(errors, []);
    console.log('Panel UI checks passed: one-tap and automatic capture, duplicate prevention, cancellation, stale callbacks, setup, contexts, preferences, answer follow-ups, and Browser task approval/Stop.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
