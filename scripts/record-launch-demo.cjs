const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent((request.url || '/').split('?')[0]);
    const relative = requested === '/' ? '/outputs/launch-v25/demo-storyboard.html' : requested;
    const filePath = path.resolve(root, `.${relative}`);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath)) { response.writeHead(404); response.end(); return; }
    const extension = path.extname(filePath);
    const type = extension === '.html' ? 'text/html; charset=utf-8' : 'image/png';
    response.writeHead(200, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(filePath).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const pageUrl = `http://127.0.0.1:${server.address().port}/outputs/launch-v25/demo-storyboard.html`;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(pageUrl);
    await page.waitForFunction(() => typeof window.recordDemo === 'function' && document.images.length >= 0);
    const base64 = await page.evaluate(() => window.recordDemo());
    fs.writeFileSync(path.join(root, 'outputs/launch-v25/ai-vision-v25-demo.webm'), Buffer.from(base64, 'base64'));
  } finally {
    await browser.close();
    server.close();
  }
})();
