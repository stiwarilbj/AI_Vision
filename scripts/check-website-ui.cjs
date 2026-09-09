// Serve the repository root, then run with SITE_TEST_URL (default below).
// Uses the same optional Playwright and Chrome settings as check-panel-ui.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_TEST_URL || 'http://127.0.0.1:8765/docs/';
const reportPath = process.env.WEBSITE_REPORT || '';
const docsRoot = path.resolve(__dirname, '..', 'docs');
function discoverPublicPages(directory = docsRoot) {
  const pages = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) pages.push(...discoverPublicPages(absolute));
    else if (entry.isFile() && entry.name.endsWith('.html')) pages.push(path.relative(docsRoot, absolute).split(path.sep).join('/'));
  }
  return pages;
}
const writeReport = report => {
  if (!reportPath) return;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
};
(async () => {
  const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROME_EXECUTABLE || undefined });
  const failures = [];
  const widths = [390,768,1024,1440];
  const pages = discoverPublicPages().sort().map(route => route === 'index.html' ? '' : route);
  let homepagePayloadSize = null;
  const heroImagePath = path.join(docsRoot, 'assets/previews/hero-showcase.jpg');
  const heroImageBytes = fs.statSync(heroImagePath).size;
  assert.ok(heroImageBytes < 300000, `Hero image ${heroImageBytes} under 300 KB`);
  try {
    const page = await browser.newPage({ reducedMotion:'reduce' });
    page.on('pageerror',e => failures.push(e.message));
    page.on('response',r => { if(r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
    for (const route of pages) {
      for (const width of widths) {
        await page.setViewportSize({width,height:900});
        await page.goto(base+route);
        await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(()=>{}))));
        assert.equal(await page.locator('h1').count(),1, `${route} has one heading`);
        const overflow = await page.evaluate(() => ({width:document.documentElement.scrollWidth, nodes:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>e.tagName+'.'+e.className)}));
        assert.ok(overflow.width <= width, `${route} fits ${width}: ${JSON.stringify(overflow)}`);
        const images = await page.locator('img[src]').evaluateAll(imgs => imgs.map(i => ({src:i.getAttribute('src'),width:i.width,height:i.height,nw:i.naturalWidth,nh:i.naturalHeight})));
        for(const i of images) {
          assert.ok(i.nw > 0,`Image loads: ${i.src}`);
          if(i.width && i.height) assert.ok(Math.abs(i.width/i.height - i.nw/i.nh) < .035,`Undistorted: ${i.src}`);
        }
        if(process.env.UI_SCREENSHOTS && !route && [390,1440].includes(width)) {
          fs.mkdirSync(process.env.UI_SCREENSHOTS,{recursive:true});
          await page.screenshot({path:path.join(process.env.UI_SCREENSHOTS,`website-${width}.png`),fullPage:true});
        }
      }
    }
    await page.goto(base);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip-link').evaluate(e => e === document.activeElement),true);
    for(const example of ['tabs','page','screenshot']) {
      await page.locator(`[data-example="${example}"]`).click();
      assert.equal(await page.locator('.example:visible').count(),1);
      assert.equal(await page.locator(`[data-sample="${example}"]`).isVisible(),true);
    }
    for (const route of pages) {
      await page.goto(base + route);
      const lightboxLink = page.locator('[data-lightbox]').first();
      if (await lightboxLink.count()) {
        await lightboxLink.focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#lightbox').evaluate(e=>e.open),true, `${route} opens its image dialog`);
        await page.keyboard.press('Escape');
        assert.equal(await lightboxLink.evaluate(e=>e===document.activeElement),true, `${route} restores image focus`);
      }
    }
    const cold = await browser.newPage();
    const payloads = [];
    cold.on('response', response => payloads.push(response.body().then(body => body.length)));
    await cold.goto(base);
    await cold.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(()=>{}))));
    homepagePayloadSize = (await Promise.all(payloads)).reduce((a,b)=>a+b,0);
    assert.ok(homepagePayloadSize < 800000, `Homepage transfer ${homepagePayloadSize} under 800 KB`);
    console.log(`Cold homepage payload: ${homepagePayloadSize} bytes (uncompressed resource bodies).`);
    await cold.close();
    const nojs = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
    const plain = await nojs.newPage();
    for (const route of pages) {
      await plain.goto(base + route);
      assert.equal(await plain.locator('h1').count(),1, `${route} remains readable without JavaScript`);
      assert.ok((await plain.locator('body').innerText()).length > 100, `${route} has essential no-JS content`);
      if (!route) {
        assert.equal(await plain.locator('.example:visible').count(),3);
        assert.equal(await plain.locator('a[href="guides/get-gemini-api-key.html"]').first().isVisible(),true);
        assert.equal(await plain.locator('a[href="guides/copy-text-from-screenshot-chrome.html"]').first().isVisible(),true);
        await plain.locator('summary').first().click();
        assert.equal(await plain.locator('.faq-list details').first().evaluate(e=>e.open),true);
      }
    }
    await nojs.close();
    assert.deepEqual(failures,[]);
    writeReport({
      status: 'passed',
      base,
      pages,
      widths,
      homepagePayloadBytes: homepagePayloadSize,
      heroImageBytes,
      checks: ['one heading per page', 'no horizontal overflow', 'image proportions', 'keyboard lightbox', 'interactive examples', 'no-JavaScript content', 'reduced motion'],
      generatedAt: new Date().toISOString()
    });
    console.log(`Website checks passed: ${pages.length} pages, four widths, image proportions, no overflow, demo scenarios, keyboard dialog, no-JavaScript content.`);
  } finally { await browser.close(); }
})().catch(error => {
  writeReport({ status: 'failed', base, error: error && error.stack ? error.stack : String(error), generatedAt: new Date().toISOString() });
  console.error(error);
  process.exitCode=1;
});
