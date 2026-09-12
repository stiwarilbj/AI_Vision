const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const projectRoot = path.resolve(__dirname, '..');
const artworkRoot = path.join(projectRoot, 'release-assets-v2.8');
const htmlPath = path.join(artworkRoot, 'store-artwork.html');
const outputs = [
  ['?slide=1', 'store-screenshots/01-understand-screenshot.png', 1280, 800],
  ['?slide=2', 'store-screenshots/02-copy-text-from-images.png', 1280, 800],
  ['?slide=3', 'store-screenshots/03-summarize-webpage.png', 1280, 800],
  ['?slide=4', 'store-screenshots/04-compare-two-tabs.png', 1280, 800],
  ['?slide=5', 'store-screenshots/05-add-gemini-key.png', 1280, 800],
  ['?promo=small', 'promotional/06-promo-440x280.png', 440, 280],
  ['?promo=marquee', 'promotional/07-marquee-1400x560.png', 1400, 560]
];

async function render() {
  if (!fs.existsSync(htmlPath)) throw new Error(`Missing artwork source: ${htmlPath}`);
  const browser = await chromium.launch({ headless: true, channel: process.env.CI ? 'chromium' : undefined, executablePath: process.env.CHROME_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const artworkUrl = pathToFileURL(htmlPath).href;
    for (const [query, relativeOutput, width, height] of outputs) {
      await page.setViewportSize({ width, height });
      await page.goto(`${artworkUrl}${query}`, { waitUntil: 'load' });
      await page.waitForFunction(() => [...document.images].every(image => image.complete));
      await page.locator('#art').screenshot({ path: path.join(artworkRoot, relativeOutput), animations: 'disabled' });
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) render().then(() => console.log(`Rendered ${outputs.length} AI Vision v2.8 artwork files.`)).catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { outputs, render };
