#!/usr/bin/env node

// Small synthetic smoke test for the already deployed Pages site. It never
// opens a user's profile, submits a Gemini request, or records analytics.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const projectRoot = path.resolve(__dirname, '..');
const base = process.env.SITE_LIVE_URL || 'https://stiwarilbj.github.io/AI_Vision/';
const reportPath = process.env.PRODUCTION_SMOKE_REPORT ? path.resolve(projectRoot, process.env.PRODUCTION_SMOKE_REPORT) : null;
const screenshotDir = process.env.PRODUCTION_SMOKE_SCREENSHOTS ? path.resolve(projectRoot, process.env.PRODUCTION_SMOKE_SCREENSHOTS) : null;

function writeReport(report) {
  if (!reportPath) return;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

(async () => {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true, channel: process.env.CI ? 'chromium' : undefined, executablePath: process.env.CHROME_EXECUTABLE || undefined });
  const report = { status: 'failed', base, startedAt, viewports: [] };
  const failures = [];
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') failures.push(`console: ${message.text()}`); });
    page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });

    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
      assert.equal(await page.title(), 'AI Screenshot Assistant for Chrome | AI Vision');
      assert.equal(await page.locator('h1').count(), 1);
      assert.ok((await page.locator('body').innerText()).includes('Your AI screenshot assistant for Chrome.'));
      assert.ok(await page.locator('a[href*="chromewebstore.google.com/detail/ai-vision-gemini-screensh"]').first().isVisible());
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      assert.equal(overflow, true, `homepage overflows at ${viewport.width}px`);
      report.viewports.push(viewport);
      if (screenshotDir) {
        fs.mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({ path: path.join(screenshotDir, `homepage-${viewport.width}.png`), fullPage: false });
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('[data-example="screenshot"]').click();
    assert.equal(await page.locator('.example:visible').count(), 1, 'sample example reveals one scenario');
    const lightboxLink = page.locator('[data-lightbox]').first();
    await lightboxLink.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#lightbox').evaluate((dialog) => dialog.open), true, 'image enlargement opens');
    await page.keyboard.press('Escape');
    assert.equal(await lightboxLink.evaluate((element) => element === document.activeElement), true, 'image focus returns after closing');
    await page.locator('a[href="guides/ai-screenshot-assistant.html"]').first().click();
    await page.waitForLoadState('networkidle');
    assert.match(await page.url(), /guides\/ai-screenshot-assistant\.html/);
    assert.equal(await page.locator('h1').count(), 1);
    assert.deepEqual(failures, []);
    report.status = 'passed';
    report.checks = ['homepage identity and installation link', 'desktop and mobile overflow', 'sample interaction', 'keyboard image enlargement', 'guide navigation', 'no browser console or HTTP errors'];
    report.finishedAt = new Date().toISOString();
    writeReport(report);
    console.log(`Production smoke check passed: ${base}`);
  } catch (error) {
    report.error = error && error.stack ? error.stack : String(error);
    report.failures = failures;
    report.finishedAt = new Date().toISOString();
    writeReport(report);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => { writeReport({ status: 'failed', error: error.stack || String(error) }); console.error(error); process.exitCode = 1; });
