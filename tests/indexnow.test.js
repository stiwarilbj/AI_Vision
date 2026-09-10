const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const indexnow = require(path.join(projectRoot, 'scripts/notify-indexnow.js'));

test('IndexNow config derives the scoped URL list from the sitemap', () => {
  const config = indexnow.loadConfig();
  assert.equal(config.host, 'stiwarilbj.github.io');
  assert.equal(config.urls.length, 7);
  assert.ok(config.urls.includes('https://stiwarilbj.github.io/AI_Vision/'));
  assert.ok(config.keyLocation.startsWith('https://stiwarilbj.github.io/AI_Vision/'));
  assert.match(config.key, /^[A-Za-z0-9-]{8,128}$/);
  assert.deepEqual(indexnow.buildPayload(config), {
    host: config.host,
    key: config.key,
    keyLocation: config.keyLocation,
    urlList: config.urls
  });
});

test('sitemap parsing rejects external URLs and preserves canonical order', () => {
  const xml = '<urlset><url><loc>https://stiwarilbj.github.io/AI_Vision/</loc></url><url><loc>https://stiwarilbj.github.io/AI_Vision/privacy.html</loc></url><url><loc>https://stiwarilbj.github.io/AI_Vision/privacy.html</loc></url></urlset>';
  assert.deepEqual(indexnow.parseSitemap(xml), [
    'https://stiwarilbj.github.io/AI_Vision/',
    'https://stiwarilbj.github.io/AI_Vision/privacy.html'
  ]);
  assert.throws(() => indexnow.parseSitemap('<urlset><loc>https://example.com/</loc></urlset>'), /outside the canonical site/);
});

test('unchanged content is skipped and dry-run never calls fetch', async () => {
  let calls = 0;
  const skipped = await indexnow.run({ argv: [], env: {}, fetchImpl: async () => { calls += 1; } });
  assert.equal(skipped.status, 'skipped');
  const preview = await indexnow.run({ argv: ['--dry-run', '--changed'], env: {}, fetchImpl: async () => { calls += 1; } });
  assert.equal(preview.status, 'dry-run');
  assert.match(preview.websiteContentHash, /^[a-f0-9]{64}$/);
  assert.equal(calls, 0);
});

test('a submitted receipt skips the same acknowledged website content', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-vision-indexnow-'));
  const receiptPath = path.join(temporary, 'receipt.json');
  const changedFiles = ['docs/index.html'];
  const contentHash = indexnow.websiteContentHash(changedFiles);
  fs.writeFileSync(receiptPath, JSON.stringify({ status: 'submitted', websiteContentHash: contentHash, urls: indexnow.loadConfig().urls }));
  const result = await indexnow.run({ argv: ['--changed', '--changed-files', 'docs/index.html', '--receipt', receiptPath], env: { INDEXNOW_DEPLOY_COMMIT: 'same-commit' }, fetchImpl: async () => { throw new Error('must not fetch'); } });
  assert.equal(result.status, 'skipped');
  assert.match(result.reason, /already acknowledged/);
});

test('live deployment checks changed public files, title, sitemap, and matching key', async () => {
  const config = indexnow.loadConfig();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    let body = '<title>AI Screenshot Assistant for Chrome | AI Vision</title>';
    if (String(url).endsWith('/sitemap.xml')) body = config.urls.map((entry) => `<loc>${entry}</loc>`).join('');
    if (String(url) === config.keyLocation) body = config.key;
    return { status: 200, async text() { return body; } };
  };
  const result = await indexnow.checkLive({ config, fetchImpl, attempts: 1, delayMs: 0, requiredPaths: ['docs/index.html', 'docs/assets/site.css'] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.required, [
    'https://stiwarilbj.github.io/AI_Vision/',
    'https://stiwarilbj.github.io/AI_Vision/assets/site.css'
  ]);
  assert.equal(calls.length, 5);
});

test('external key locations are rejected and submissions surface non-success responses', async () => {
  assert.throws(() => indexnow.loadConfig({ keyUrl: 'https://example.com/key.txt' }), /scoped under/);
  let request;
  await assert.rejects(indexnow.submitIndexNow({
    config: indexnow.loadConfig(),
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return { status: 500, async text() { return 'temporary failure'; } };
    }
  }), /HTTP 500/);
  assert.equal(request.url, 'https://www.bing.com/indexnow');
  assert.equal(JSON.parse(request.options.body).urlList.length, 7);
});

test('the checked-in key file contains exactly the key used by the notifier', () => {
  assert.equal(fs.readFileSync(indexnow.keyFile, 'utf8').trim(), indexnow.loadConfig().key);
});

test('IndexNow workflow waits for the successful Pages deployment and rejects stale events', () => {
  const workflow = fs.readFileSync(path.join(projectRoot, '.github/workflows/indexnow.yml'), 'utf8');
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflow_run\.name == 'pages build and deployment'/);
  assert.match(workflow, /conclusion == 'success'/);
  assert.match(workflow, /head_sha/);
  assert.match(workflow, /repository\.full_name == github\.repository/);
  assert.match(workflow, /git ls-remote origin refs\/heads\/main/);
  assert.match(workflow, /INDEXNOW_CHANGED_FILES/);
  assert.match(workflow, /Restore an acknowledged receipt/);
  assert.match(workflow, /gh run download/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
});
