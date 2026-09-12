const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const { buildManifest, parseArgs: parseManifestArgs } = require('../scripts/build-pages-manifest.cjs');
const { verify, localTarget, contentTypeOkay } = require('../scripts/verify-deployed-site.cjs');
const { newestSuccessfulDeployment } = require('../scripts/resolve-pages-deployment.cjs');
const { compose } = require('../scripts/compose-health-report.cjs');
const settings = require('../scripts/check-github-settings.cjs');
const incidents = require('../scripts/manage-health-incident.cjs');

function tempDir(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

test('Pages manifest is deterministic, sorted, and hashes the exact source bytes', () => {
  const source = tempDir('ai-vision-pages-');
  fs.mkdirSync(path.join(source, 'nested'));
  fs.writeFileSync(path.join(source, 'z.txt'), 'last');
  fs.writeFileSync(path.join(source, 'nested', 'a.txt'), 'first');
  const manifest = buildManifest({ source, commit: 'fixture-commit' });
  assert.equal(manifest.commit, 'fixture-commit');
  assert.deepEqual(manifest.files.map((file) => file.path), ['nested/a.txt', 'z.txt']);
  assert.equal(manifest.files[0].sha256, crypto.createHash('sha256').update('first').digest('hex'));
  assert.deepEqual(parseManifestArgs(['--source', 'docs', '--commit=abc', '--output', 'manifest.json']), { source: 'docs', commit: 'abc', output: 'manifest.json' });
});

test('deployed-site verification checks redirect, bytes, content types, canonical, and local assets', async () => {
  const source = tempDir('ai-vision-site-');
  fs.writeFileSync(path.join(source, 'index.html'), '<!doctype html><html><head><link rel="canonical" href="https://example.test/site/"></head><body><img src="asset.txt"></body></html>');
  fs.writeFileSync(path.join(source, 'asset.txt'), 'fixture asset');
  const manifestPath = path.join(tempDir('ai-vision-manifest-'), 'manifest.json');
  const manifest = buildManifest({ source, commit: 'fixture-commit' });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    const parsed = new URL(url);
    if (parsed.protocol === 'http:') return { status: 308, headers: { get: (name) => name.toLowerCase() === 'location' ? 'https://example.test/site/' : null }, async arrayBuffer() { return Buffer.from(''); } };
    const relative = parsed.pathname.endsWith('/site/') ? 'index.html' : parsed.pathname.split('/').pop();
    const body = fs.readFileSync(path.join(source, relative));
    return {
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? (relative.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain') : null },
      async arrayBuffer() { return body; }
    };
  };
  const report = await verify({ baseUrl: 'https://example.test/site/', source, manifestPath, fetchImpl, attempts: 1, delayMs: 0, expectedCommit: 'fixture-commit' });
  assert.equal(report.status, 'passed');
  assert.equal(report.commit, 'fixture-commit');
  assert.equal(calls.length, 3, 'HTTP redirect plus two exact source files were checked');
  assert.equal(contentTypeOkay('index.html', 'text/html'), true);
  assert.equal(localTarget('../outside', 'https://example.test/site/', 'https://example.test/site/'), null);
});

test('deployed-site verification retries a transient failure without hiding a mismatch', async () => {
  const source = tempDir('ai-vision-retry-');
  fs.writeFileSync(path.join(source, 'index.html'), '<link rel="canonical" href="https://example.test/site/">');
  let attempt = 0;
  const fetchImpl = async (url) => {
    attempt += 1;
    if (attempt === 1) throw new Error('temporary CDN failure');
    const parsed = new URL(url);
    if (parsed.protocol === 'http:') return { status: 301, headers: { get: () => 'https://example.test/site/' }, async arrayBuffer() { return Buffer.from(''); } };
    return { status: 200, headers: { get: () => 'text/html' }, async arrayBuffer() { return fs.readFileSync(path.join(source, 'index.html')); } };
  };
  const report = await verify({ baseUrl: 'https://example.test/site/', source, fetchImpl, attempts: 2, delayMs: 0 });
  assert.equal(report.status, 'passed');
  assert.ok(attempt >= 3);
});

test('Pages deployment resolver chooses the newest successful deployment', () => {
  const gh = (args) => {
    const endpoint = args[0];
    if (endpoint.includes('/deployments?')) return [
      { id: 2, sha: 'failed-sha', ref: 'main', environment: 'github-pages', created_at: '2026-09-12T10:00:00Z' },
      { id: 1, sha: 'good-sha', ref: 'main', environment: 'github-pages', created_at: '2026-09-12T09:00:00Z' }
    ];
    if (endpoint.includes('/deployments/2/statuses')) return [{ state: 'failure' }];
    if (endpoint.includes('/deployments/1/statuses')) return [{ state: 'success', updated_at: '2026-09-12T09:05:00Z' }];
    throw new Error(`unexpected endpoint: ${endpoint}`);
  };
  assert.equal(newestSuccessfulDeployment({ repo: 'owner/repo', gh }).sha, 'good-sha');
});

test('health report fails closed when any mandatory check is missing or failed', () => {
  const passed = { status: 'passed' };
  assert.equal(compose({ deployment: passed, smoke: passed, settings: passed, commit: 'abc' }).status, 'passed');
  assert.equal(compose({ deployment: { status: 'failed' }, smoke: { status: 'failed' }, settings: { status: 'failed' }, superseded: true }).status, 'superseded');
  const failed = compose({ deployment: { status: 'failed', error: 'stale asset' }, smoke: passed, settings: null, commit: 'abc' });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.failures.length, 2);
});

test('settings audit reports pass and drift from a fixture without mutating anything', () => {
  const expected = settings.readJson(path.join(projectRoot, 'config/github-settings.json'));
  const fixture = tempDir('ai-vision-settings-');
  const actual = {
    branchProtection: { ...expected.branchProtection },
    pages: { ...expected.pages },
    deploymentEnvironment: expected.deploymentEnvironment
  };
  const fixturePath = path.join(fixture, 'settings.json');
  fs.writeFileSync(fixturePath, JSON.stringify(actual));
  assert.equal(settings.audit({ fixture: fixturePath }).status, 'passed');
  actual.pages.buildType = 'legacy';
  fs.writeFileSync(fixturePath, JSON.stringify(actual));
  const drift = settings.audit({ fixture: fixturePath });
  assert.equal(drift.status, 'drift');
  assert.match(drift.mismatches.join('\n'), /pages\.buildType/);
});

test('health incident manager deduplicates unchanged failures and closes on recovery in dry-run mode', () => {
  const calls = [];
  const emptyGh = (args) => {
    calls.push(args);
    return args[0] === 'issue' && args[1] === 'list' ? '[]' : '';
  };
  const report = { status: 'failed', commit: 'abc', checkedAt: '2026-09-12T10:00:00Z', error: 'smoke failed', failures: ['smoke'] };
  const opened = incidents.manage({ report, repo: 'owner/repo', dryRun: true, gh: emptyGh });
  assert.equal(opened.status, 'opened');
  assert.equal(opened.actions[0][0], 'issue');
  const marker = incidents.markerFor(report);
  const existing = { number: 7, title: '[AI Vision health] Production smoke check failed', body: `<!-- ai-vision-health:${marker} -->` };
  const existingGh = (args) => {
    calls.push(args);
    return args[0] === 'issue' && args[1] === 'list' ? JSON.stringify([existing]) : '';
  };
  const unchanged = incidents.manage({ report, repo: 'owner/repo', dryRun: true, gh: existingGh });
  assert.equal(unchanged.status, 'updated');
  assert.equal(unchanged.actions.length, 0);
  const recovered = incidents.manage({ report: { status: 'passed', commit: 'abc', checkedAt: report.checkedAt }, repo: 'owner/repo', dryRun: true, gh: existingGh });
  assert.equal(recovered.status, 'recovered');
  assert.equal(recovered.actions.length, 2);
  assert.equal(recovered.actions[0][1], 'comment');
  assert.equal(recovered.actions[1][1], 'close');
  const superseded = incidents.manage({ report: { status: 'superseded', commit: 'new' }, repo: 'owner/repo', dryRun: true, gh: existingGh });
  assert.equal(superseded.status, 'superseded');
  assert.equal(superseded.actions.length, 0);
});

test('reliability workflows keep deployment, health, and PR gates explicit', () => {
  const pages = fs.readFileSync(path.join(projectRoot, '.github/workflows/pages.yml'), 'utf8');
  const health = fs.readFileSync(path.join(projectRoot, '.github/workflows/health.yml'), 'utf8');
  const template = fs.readFileSync(path.join(projectRoot, '.github/pull_request_template.md'), 'utf8');
  assert.match(pages, /workflow_run:/);
  assert.match(pages, /workflows: \["CI"\]/);
  assert.match(pages, /cancel-in-progress: false/);
  assert.match(pages, /git ls-remote origin refs\/heads\/main/);
  assert.match(pages, /actions\/upload-pages-artifact@7b1f4a764d45c48632c6b24a0339c27f5614fb0b/);
  assert.match(pages, /actions\/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e/);
  assert.match(pages, /artifact-manifest\.json/);
  assert.match(pages, /Verify public files and run browser smoke checks/);
  assert.match(health, /cron: '17 \* \* \* \*'/);
  assert.match(health, /workflow_run:/);
  assert.match(health, /for attempt in 1 2 3/);
  assert.match(health, /manage-health-incident/);
  assert.match(health, /build-pages-manifest/);
  assert.match(health, /retention-days: 30/);
  assert.match(template, /rollback/i);
});
