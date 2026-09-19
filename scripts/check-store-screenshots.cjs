const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { checkSourceProvenance, checkStoreAssets } = require('./check-store-assets.cjs');

const projectRoot = path.resolve(__dirname, '..');
const artworkRoot = path.join(projectRoot, 'release-assets-v2.8.2');
const screenshotRoot = path.join(artworkRoot, 'store-screenshots');
const artworkPath = path.join(artworkRoot, 'store-artwork.html');
const names = [
  '01-screenshot-insight.png',
  '02-ocr-text.png',
  '03-webpage-summary.png',
  '04-tab-comparison.png',
  '05-browser-tasks.png'
];

function uniqueHashes() {
  return new Set(names.map(name => crypto.createHash('sha256').update(fs.readFileSync(path.join(screenshotRoot, name))).digest('hex'))).size;
}

async function checkArtwork() {
  checkSourceProvenance();
  const actual = fs.readdirSync(screenshotRoot).filter(file => file.endsWith('.png')).sort();
  assert.deepEqual(actual, names.slice().sort(), 'Store upload directory must contain exactly five PNG screenshots.');
  checkStoreAssets();
  assert.equal(uniqueHashes(), names.length, 'Store screenshots must be distinct files.');

  const browser = await chromium.launch({ headless: true, channel: process.env.CI ? 'chromium' : undefined, executablePath: process.env.CHROME_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    for (let index = 1; index <= names.length; index += 1) {
      await page.goto(`${pathToFileURL(artworkPath).href}?slide=${index}`, { waitUntil: 'load' });
      const result = await page.evaluate(() => {
        const art = document.querySelector('#art');
        const visibleText = document.body.innerText;
        const bounds = [...document.querySelectorAll('#art *')].map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height);
        const overflow = bounds.some(rect => rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1);
        const rounded = [...document.querySelectorAll('#art *')].filter(node => getComputedStyle(node).borderRadius !== '0px').length;
        const style = getComputedStyle(art);
        return {
          visibleText,
          headingCount: document.querySelectorAll('#art h1').length,
          overflow,
          rounded,
          fullBackground: style.backgroundImage !== 'none' || style.backgroundColor !== 'rgba(0, 0, 0, 0)',
          width: art.getBoundingClientRect().width,
          height: art.getBoundingClientRect().height
        };
      });
      assert.equal(result.headingCount, 1, `Slide ${index} must have one headline.`);
      assert.equal(result.overflow, false, `Slide ${index} has clipped content.`);
      assert.equal(result.width, 1280, `Slide ${index} must be 1280px wide.`);
      assert.equal(result.height, 800, `Slide ${index} must be 800px high.`);
      assert.equal(result.fullBackground, true, `Slide ${index} must have a non-blank background.`);
      assert.ok(result.rounded >= 8, `Slide ${index} should use rounded interface elements.`);
      assert.equal(result.visibleText.includes('.'), false, `Slide ${index} contains a visible period.`);
      assert.equal(/2\.8|version|preview|disclaimer/i.test(result.visibleText), false, `Slide ${index} contains release or disclaimer copy.`);
    }
  } finally {
    await browser.close();
  }
  return { status: 'passed', screenshots: names.length, uniqueFiles: uniqueHashes() };
}

if (require.main === module) {
  checkArtwork().then(result => console.log(`Store screenshot checks passed: ${result.screenshots} distinct 1280x800 RGB PNGs.`)).catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { checkArtwork, names };
