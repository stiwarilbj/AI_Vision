// Optional browser regression check. Requires Playwright (or PLAYWRIGHT_MODULE).
// CHROME_EXECUTABLE selects an installed Chrome for Testing binary.
// UI_SCREENSHOTS optionally writes panel screenshots to that directory.
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
    res.setHeader('Content-Type', ({'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png'})[path.extname(file)] || 'application/octet-stream');
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
  const click = async selector => { const el = await get(selector); assert.ok(el, selector); await el.click(); };
  const visible = selector => page.evaluate(s => Boolean(window.__panelTestRoot.querySelector(s)?.getClientRects().length), selector);
  const text = selector => page.evaluate(s => window.__panelTestRoot.querySelector(s)?.textContent, selector);
  const waitText = value => page.waitForFunction(t => window.__panelTestRoot.querySelector('#gemini-popup-response-area')?.textContent.includes(t), value);
  const choose = async value => (await get('#gemini-mode-select')).selectOption(value);
  const request = () => page.evaluate(() => window.__aiVisionTestRequests.filter(r => r.action === 'askGemini').at(-1));
  async function open(scenario = '') {
    if (page) await page.close();
    page = await browser.newPage({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      // Test-only reference: the production root remains closed to page scripts.
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
  async function screenshot(name) {
    if (!process.env.UI_SCREENSHOTS) return;
    fs.mkdirSync(process.env.UI_SCREENSHOTS, { recursive: true });
    await (await get('#gemini-popup')).screenshot({ path: path.join(process.env.UI_SCREENSHOTS, `${name}.png`) });
  }
  try {
    await open();
    assert.equal(await page.evaluate(() => document.querySelector('#ai-vision-host').shadowRoot), null);
    assert.equal(await visible('#gemini-popup-composer'), false);
    assert.equal(await visible('#gemini-popup-presets'), false);
    assert.equal(await visible('#gemini-popup-response-area'), false);
    assert.equal(await visible('#gemini-agent-mode-row'), false);
    await screenshot('extension-welcome');
    await click('#gemini-primary-mode');
    await page.keyboard.press('Escape');
    assert.equal(await visible('#gemini-primary-mode'), true);
    assert.equal(await page.evaluate(() => window.__panelTestRoot.activeElement.id), 'gemini-primary-mode');
    await click('#gemini-primary-mode');
    await page.mouse.move(60, 60); await page.mouse.down(); await page.mouse.move(340, 190); await page.mouse.up();
    await page.waitForFunction(() => window.__panelTestRoot.querySelector('.gemini-capture-preview img'));
    assert.equal(await visible('#gemini-popup-composer'), true);
    assert.equal(await visible('#gemini-popup-presets'), true);
    await click('#gemini-popup-presets button:nth-child(2)');
    await waitText('Local test response.');
    assert.ok((await request()).captureImageData);
    await screenshot('extension-answer');
    await click('.gemini-answer-actions button:nth-child(2)');
    await (await get('#gemini-popup-query-input')).fill('Explain more');
    await page.keyboard.press('Enter');
    await waitText('Local follow-up response with 1 earlier turn.');
    assert.equal((await request()).conversationHistory.length, 2);
    await click('.gemini-answer-actions button:nth-child(3)');
    await waitText('Local follow-up response with 1 earlier turn.');
    assert.equal((await request()).conversationHistory.length, 2);
    await choose('tab');
    assert.equal(await visible('#gemini-popup-response-area'), false);
    assert.equal(await visible('#gemini-capture-frame'), false);
    await click('#gemini-popup-presets button');
    await waitText('Local test response.');
    assert.equal((await request()).mode, 'tab');
    assert.equal((await request()).conversationHistory.length, 0);
    await choose('all-tabs');
    await click('#gemini-popup-presets button');
    await waitText('Local test response.');
    assert.equal((await request()).mode, 'all-tabs');
    await click('#gemini-settings-button');
    await click('#gemini-optional-settings summary');
    assert.equal(await visible('#gemini-model-select'), true);
    await click('#gemini-optional-settings summary');
    await screenshot('extension-settings');
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 640 : 768 });
      assert.equal(await page.evaluate(() => {
        const p = window.__panelTestRoot.querySelector('#gemini-popup');
        const b = p.getBoundingClientRect();
        return b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && p.scrollWidth <= p.clientWidth;
      }), true, `Panel fits ${width}px`);
    }
    await page.setViewportSize({width:390,height:640});
    await click('.gemini-done-button');
    await choose('capture');
    await screenshot('extension-compact');
    await open('setup');
    await page.waitForFunction(() => window.__panelTestRoot.querySelector('#gemini-settings-panel.show'));
    assert.equal(await text('.gemini-api-key-status'), 'Not set yet');
    assert.equal(await visible('.gemini-get-key-link'), true);
    assert.equal(await visible('#gemini-optional-settings'), false);
    assert.equal(await visible('#gemini-agent-mode-row'), false);
    await screenshot('extension-key-setup');
    await (await get('#gemini-settings-api-key')).fill('fictional-test-key');
    await click('.gemini-api-key-actions button');
    await page.waitForFunction(() => window.__panelTestRoot.querySelector('.gemini-api-key-status').textContent === 'Connected');
    assert.equal(await page.evaluate(() => window.__panelTestRoot.querySelector('#gemini-settings-api-key').value), '');
    await click('.gemini-done-button');
    await click('#gemini-text-question');
    await (await get('#gemini-popup-query-input')).fill('A text-only question');
    await page.keyboard.press('Enter');
    await waitText('Local test response.');
    for (const scenario of ['invalid-key', 'quota-key', 'empty-models']) {
      await open(scenario);
      await click('#gemini-settings-button');
      await page.waitForFunction(() => window.__panelTestRoot.querySelector('#gemini-key-feedback').textContent.includes('connection wasn’t confirmed'));
      assert.notEqual(await text('.gemini-api-key-status'), 'Connected');
      assert.equal(await page.evaluate(() => window.__aiVisionTestSettings.hasApiKey), true);
      assert.equal(await (await get('.gemini-check-key')).isEnabled(), true);
      await screenshot(`extension-${scenario}`);
    }
    await open('denied');
    await choose('all-tabs'); await click('#gemini-popup-presets button');
    await waitText('Compare tabs access was not enabled.');
    assert.equal(await request(), undefined);
    assert.equal(await (await get('#gemini-mode-select')).isEnabled(), true);
    await open('error');
    await choose('tab'); await click('#gemini-popup-presets button');
    await waitText('Test connection unavailable');
    assert.equal(await (await get('#gemini-popup-send')).isEnabled(), true);
    for (const scenario of ['approval', 'running']) {
      await open(scenario);
      await click('#gemini-settings-button'); await click('.gemini-switch'); await click('.gemini-done-button');
      assert.equal(await visible('.gemini-mode-note'), true);
      await (await get('#gemini-popup-query-input')).fill('Open the example');
      await click('#gemini-popup-send');
      await waitText(scenario === 'approval' ? 'Approval required' : 'Starting Browser tasks');
      assert.equal(await (await get('#gemini-mode-select')).isEnabled(), false);
      assert.equal(await (await get('#gemini-settings-button')).isEnabled(), false);
      assert.equal(await visible('#gemini-popup-composer'), false);
      await page.setViewportSize({width: 390, height: 600});
      const stopSelector = scenario === 'approval' ? '.gemini-approval-actions button:nth-child(2)' : '.gemini-agent-cancel-button';
      const stopBounds = await (await get(stopSelector)).boundingBox();
      assert.ok(stopBounds && stopBounds.y + stopBounds.height <= 600, 'Stop stays in view on a short window');
      await screenshot(`extension-${scenario}`);
      await click(stopSelector);
      await waitText('Local test task stopped.');
      assert.equal(await (await get('#gemini-mode-select')).isEnabled(), true);
      if (scenario === 'approval') {
        await click('#gemini-popup-send'); await waitText('Approval required');
        await click('.gemini-approve-button'); await waitText('Local test action approved.');
      }
    }
    assert.deepEqual(errors, []);
    console.log('Panel UI checks passed: closed shadow, progressive capture, cancellation/focus, answers/follow-up/retry, all contexts, setup, denial/errors, approval/Stop, four viewport sizes.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
