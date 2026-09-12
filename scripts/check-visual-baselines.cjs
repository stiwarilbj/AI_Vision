// Compare panel screenshots produced by check-panel-ui.cjs with the reviewed
// v2.8 captures. The comparison runs in Chromium so PNG decoding needs no new
// native dependency and the baseline files remain ordinary repository assets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const projectRoot = path.resolve(__dirname, '..');
// Text rasterization and font metrics differ between the macOS developer
// machine and the Ubuntu Actions runner. Keep reviewed captures for each
// supported runner so the comparison measures layout changes rather than OS
// font substitution. A variant can be selected explicitly for local audits.
const baselineVariant = process.env.VISUAL_BASELINE_VARIANT || (process.platform === 'linux' ? 'panel-linux' : 'panel');
const baselineDir = path.join(projectRoot, 'outputs', 'ai-vision-v28', baselineVariant);
const candidateDir = path.resolve(projectRoot, process.env.PANEL_SCREENSHOTS || path.join('outputs', 'panel'));
const names = ['extension-welcome.png', 'extension-capture.png', 'extension-answer.png', 'extension-settings.png', 'extension-key-setup.png'];

async function comparePng(page, baseline, candidate) {
  return page.evaluate(async ({ baseline, candidate }) => {
    const decode = (encoded) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('could not decode a PNG baseline'));
      image.src = `data:image/png;base64,${encoded}`;
    });
    const [before, after] = await Promise.all([decode(baseline), decode(candidate)]);
    if (before.width !== after.width || before.height !== after.height) {
      return { width: before.width, height: before.height, candidateWidth: after.width, candidateHeight: after.height, changedRatio: 1, meanError: 1 };
    }
    const canvas = document.createElement('canvas');
    canvas.width = before.width;
    canvas.height = before.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(before, 0, 0);
    const a = context.getImageData(0, 0, canvas.width, canvas.height).data;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(after, 0, 0);
    const b = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let changed = 0;
    let totalError = 0;
    for (let i = 0; i < a.length; i += 4) {
      const error = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      totalError += error / (255 * 3);
      if (error > 18) changed += 1;
    }
    const pixels = a.length / 4;
    return { width: canvas.width, height: canvas.height, changedRatio: changed / pixels, meanError: totalError / pixels };
  }, { baseline, candidate });
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.CI ? 'chromium' : undefined, executablePath: process.env.CHROME_EXECUTABLE || undefined });
  const page = await browser.newPage();
  const results = [];
  try {
    for (const name of names) {
      const baselinePath = path.join(baselineDir, name);
      const candidatePath = path.join(candidateDir, name);
      assert.ok(fs.existsSync(baselinePath), `missing reviewed baseline: ${name}`);
      assert.ok(fs.existsSync(candidatePath), `panel check did not produce: ${name}`);
      const result = await comparePng(
        page,
        fs.readFileSync(baselinePath).toString('base64'),
        fs.readFileSync(candidatePath).toString('base64')
      );
      // Font rasterization and browser patch versions can move a few pixels;
      // large layout shifts still fail loudly.
      assert.ok(result.changedRatio <= 0.12, `${name} changed ${Math.round(result.changedRatio * 100)}% of pixels`);
      assert.ok(result.meanError <= 0.045, `${name} mean pixel error ${result.meanError.toFixed(3)}`);
      results.push({ name, ...result });
    }
    console.log(`Visual baselines passed: ${results.length} panel states.`);
    if (process.env.VISUAL_REPORT) {
      fs.mkdirSync(path.dirname(path.resolve(projectRoot, process.env.VISUAL_REPORT)), { recursive: true });
      fs.writeFileSync(path.resolve(projectRoot, process.env.VISUAL_REPORT), `${JSON.stringify({ status: 'passed', results }, null, 2)}\n`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  if (process.env.VISUAL_REPORT) {
    fs.mkdirSync(path.dirname(path.resolve(projectRoot, process.env.VISUAL_REPORT)), { recursive: true });
    fs.writeFileSync(path.resolve(projectRoot, process.env.VISUAL_REPORT), `${JSON.stringify({ status: 'failed', error: error && error.stack ? error.stack : String(error) }, null, 2)}\n`);
  }
  console.error(error);
  process.exitCode = 1;
});
