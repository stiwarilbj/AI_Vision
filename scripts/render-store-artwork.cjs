const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { checkSourceProvenance } = require('./check-store-assets.cjs');

const projectRoot = path.resolve(__dirname, '..');
const artworkRoot = path.join(projectRoot, 'release-assets-v2.8.2');
const htmlPath = path.join(artworkRoot, 'store-artwork.html');
const outputs = [
  ['?slide=1', 'store-screenshots/01-screenshot-insight.png', 1280, 800],
  ['?slide=2', 'store-screenshots/02-ocr-text.png', 1280, 800],
  ['?slide=3', 'store-screenshots/03-webpage-summary.png', 1280, 800],
  ['?slide=4', 'store-screenshots/04-tab-comparison.png', 1280, 800],
  ['?slide=5', 'store-screenshots/05-browser-tasks.png', 1280, 800]
];
const outputRoot = path.join(projectRoot, 'outputs', 'ai-vision-v282');
const outputStoreRoot = path.join(outputRoot, 'store-assets');

async function render() {
  if (!fs.existsSync(htmlPath)) throw new Error(`Missing artwork source: ${htmlPath}`);
  checkSourceProvenance();
  const browser = await chromium.launch({ headless: true, channel: process.env.CI ? 'chromium' : undefined, executablePath: process.env.CHROME_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const artworkUrl = pathToFileURL(htmlPath).href;
    fs.mkdirSync(outputStoreRoot, { recursive: true });
    for (const [query, relativeOutput, width, height] of outputs) {
      await page.setViewportSize({ width, height });
      await page.goto(`${artworkUrl}${query}`, { waitUntil: 'load' });
      const destination = path.join(artworkRoot, relativeOutput);
      await page.locator('#art').screenshot({ path: destination, animations: 'disabled' });
      fs.copyFileSync(destination, path.join(outputStoreRoot, path.basename(relativeOutput)));
    }
    await page.setViewportSize({ width: 1360, height: 650 });
    const contactMarkup = outputs.map(([, relativeOutput]) => `<img src="${pathToFileURL(path.join(artworkRoot, relativeOutput)).href}" alt="AI Vision store screenshot">`).join('');
    await page.setContent(`<!doctype html><style>*{box-sizing:border-box}body{margin:0;background:#101522;font-family:system-ui,sans-serif}.contact{width:1360px;height:650px;padding:24px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:18px}.contact img{width:100%;height:285px;object-fit:cover;border-radius:20px;box-shadow:0 12px 30px #0008}.contact img:last-child{grid-column:2}</style><main class="contact">${contactMarkup}</main>`);
    await page.locator('.contact').screenshot({ path: path.join(outputRoot, 'contact-sheet.png'), animations: 'disabled' });
  } finally {
    await browser.close();
  }
}

if (require.main === module) render().then(() => console.log(`Rendered ${outputs.length} AI Vision v2.8.2 artwork files and a contact sheet.`)).catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { outputs, render };
