const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const indexnow = require(path.join(projectRoot, 'scripts/notify-indexnow.js'));

test('IndexNow config keeps the key file scoped to the project and covers every public page', () => {
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

test('unchanged content is skipped and dry-run never calls fetch', async () => {
  let calls = 0;
  const skipped = await indexnow.run({ argv: [], env: {}, fetchImpl: async () => { calls += 1; } });
  assert.equal(skipped.status, 'skipped');
  const preview = await indexnow.run({ argv: ['--dry-run', '--changed'], env: {}, fetchImpl: async () => { calls += 1; } });
  assert.equal(preview.status, 'dry-run');
  assert.equal(calls, 0);
});

test('live deployment checks require the current title, sitemap URLs, and matching key', async () => {
  const config = indexnow.loadConfig();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    let body = '<title>AI Screenshot Assistant for Chrome | AI Vision</title>';
    if (String(url).endsWith('/sitemap.xml')) body = config.urls.map((entry) => `<loc>${entry}</loc>`).join('');
    if (String(url) === config.keyLocation) body = config.key;
    return { status: 200, async text() { return body; } };
  };
  const result = await indexnow.checkLive({ config, fetchImpl, attempts: 1, delayMs: 0 });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 3);
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
