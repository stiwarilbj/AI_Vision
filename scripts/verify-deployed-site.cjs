#!/usr/bin/env node

// Verify the public Pages deployment against the exact checked-out /docs
// source. This is used after Pages promotion and by the hourly health check.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function publicFiles(source) {
  const result = [];
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const absolute = path.join(source, entry.name);
    if (entry.isDirectory()) result.push(...publicFiles(absolute));
    else if (entry.isFile()) result.push(path.relative(source, absolute).split(path.sep).join('/'));
  }
  return result.sort();
}

function routeFor(relativePath, baseUrl) {
  return relativePath === 'index.html' ? baseUrl : new URL(relativePath, baseUrl).toString();
}

function canonicalFor(relativePath, baseUrl) { return routeFor(relativePath, baseUrl); }

function localTarget(target, pageUrl, baseUrl) {
  if (/^(?:data:|javascript:|mailto:|tel:|#)/i.test(target)) return null;
  let parsed;
  try { parsed = new URL(target, pageUrl); } catch { return { invalid: true }; }
  const base = new URL(baseUrl);
  if (parsed.protocol !== base.protocol || parsed.host !== base.host || !parsed.pathname.startsWith(base.pathname)) return null;
  const suffix = decodeURIComponent(parsed.pathname.slice(base.pathname.length)).replace(/^\/+/, '');
  return { path: suffix || 'index.html', parsed };
}

function contentTypeOkay(file, contentType) {
  if (!contentType) return true;
  if (file.endsWith('.html') || file.endsWith('.txt') || file.endsWith('/')) return /html|text\//i.test(contentType);
  if (file.endsWith('.xml')) return /xml|text\//i.test(contentType);
  return true;
}

async function fetchWithTimeout(url, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetchImpl(url, { redirect: 'manual', signal: controller.signal, headers: { accept: 'text/html,application/xml,text/plain,image/*' } });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { response, bytes, durationMs: Date.now() - started };
  } finally { clearTimeout(timer); }
}

async function verify({ baseUrl = process.env.SITE_LIVE_URL || 'https://stiwarilbj.github.io/AI_Vision/', source = path.join(projectRoot, 'docs'), manifestPath = process.env.PAGES_MANIFEST || null, fetchImpl = globalThis.fetch, attempts = Number(process.env.SITE_VERIFY_ATTEMPTS || 15), delayMs = Number(process.env.SITE_VERIFY_DELAY_MS || 20000), timeoutMs = Number(process.env.SITE_VERIFY_TIMEOUT_MS || 15000), expectedCommit = process.env.PAGES_EXPECTED_COMMIT || null } = {}) {
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  assert.equal(base.protocol, 'https:', 'production site must use HTTPS');
  const sourceRoot = path.resolve(source);
  const files = publicFiles(sourceRoot);
  const expectedCommitValue = expectedCommit || process.env.GITHUB_SHA || 'unknown';
  let expectedManifest = null;
  if (manifestPath) {
    expectedManifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
    assert.equal(expectedManifest.source, 'docs', 'Pages manifest must describe the docs source');
    assert.equal(expectedManifest.commit, expectedCommitValue, 'Pages manifest commit does not match the deployed commit');
    assert.deepEqual(expectedManifest.files.map((file) => file.path).sort(), files, 'Pages manifest file list differs from the checked-out source');
  }
  let lastError;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      const checked = [];
      const get = async (url) => fetchWithTimeout(url, { fetchImpl, timeoutMs });
      const httpUrl = new URL(base); httpUrl.protocol = 'http:';
      const redirect = await get(httpUrl.toString());
      assert.ok([301, 302, 307, 308].includes(redirect.response.status), `HTTP site should redirect, got ${redirect.response.status}`);
      assert.match(redirect.response.headers.get('location') || '', /^https:\/\//i, 'HTTP redirect must point to HTTPS');

      for (const relativePath of files) {
        const url = routeFor(relativePath, base.toString());
        const result = await get(url);
        assert.equal(result.response.status, 200, `${relativePath} returned HTTP ${result.response.status}`);
        assert.ok(contentTypeOkay(relativePath, result.response.headers.get('content-type')), `${relativePath} returned an unexpected content type`);
        const expected = fs.readFileSync(path.join(sourceRoot, relativePath));
        assert.ok(result.bytes.equals(expected), `${relativePath} differs from the checked-out Pages artifact`);
        const sha256 = crypto.createHash('sha256').update(result.bytes).digest('hex');
        const expectedFile = expectedManifest?.files.find((file) => file.path === relativePath);
        if (expectedFile) {
          assert.equal(result.bytes.length, expectedFile.bytes, `${relativePath} byte count differs from the Pages manifest`);
          assert.equal(sha256, expectedFile.sha256, `${relativePath} hash differs from the Pages manifest`);
        }
        checked.push({ path: relativePath, bytes: result.bytes.length, sha256, durationMs: result.durationMs });
        if (relativePath.endsWith('.html')) {
          const markup = result.bytes.toString('utf8');
          const expectedCanonical = canonicalFor(relativePath, base.toString());
          const canonical = markup.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i)?.[1] || markup.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["']/i)?.[1];
          assert.equal(canonical, expectedCanonical, `${relativePath} canonical URL mismatch`);
          for (const match of markup.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
            const local = localTarget(match[1], url, base.toString());
            if (!local || local.invalid || local.path.endsWith('.html') || local.path === 'index.html') continue;
            if (!files.includes(local.path)) throw new Error(`${relativePath} references missing local asset ${local.path}`);
          }
        }
      }
      const manifest = { schemaVersion: 1, repository: 'stiwarilbj/AI_Vision', source: 'docs', commit: expectedCommitValue, files: checked.map(({ path: file, bytes, sha256 }) => ({ path: file, bytes, sha256 })) };
      return { status: 'passed', baseUrl: base.toString(), commit: expectedCommitValue, attempts: attempt, files: checked, manifest };
    } catch (error) {
      lastError = error;
      if (attempt < Math.max(1, attempts) && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  const error = new Error(`deployment verification failed after ${Math.max(1, attempts)} attempt(s): ${lastError?.message || 'unknown error'}`);
  error.cause = lastError;
  throw error;
}

function parseArgs(argv = process.argv.slice(2)) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--base-url', '--source', '--manifest', '--output', '--commit', '--attempts', '--delay-ms', '--timeout-ms'].includes(arg)) values[arg.slice(2)] = argv[++i];
    else if (arg.startsWith('--base-url=')) values['base-url'] = arg.slice(11);
    else if (arg.startsWith('--source=')) values.source = arg.slice(9);
    else if (arg.startsWith('--manifest=')) values.manifest = arg.slice(11);
    else if (arg.startsWith('--output=')) values.output = arg.slice(9);
    else if (arg.startsWith('--commit=')) values.commit = arg.slice(9);
  }
  return values;
}

if (require.main === module) {
  const args = parseArgs();
  verify({ baseUrl: args['base-url'], source: args.source ? path.resolve(projectRoot, args.source) : undefined, manifestPath: args.manifest ? path.resolve(projectRoot, args.manifest) : undefined, expectedCommit: args.commit, attempts: args.attempts ? Number(args.attempts) : undefined, delayMs: args['delay-ms'] ? Number(args['delay-ms']) : undefined, timeoutMs: args['timeout-ms'] ? Number(args['timeout-ms']) : undefined })
    .then((report) => {
      const output = args.output ? path.resolve(projectRoot, args.output) : process.env.SITE_VERIFY_REPORT ? path.resolve(projectRoot, process.env.SITE_VERIFY_REPORT) : null;
      if (output) { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`); }
      console.log(`Deployment verification passed: ${report.files.length} files at ${report.baseUrl}`);
    })
    .catch((error) => {
      const output = args.output ? path.resolve(projectRoot, args.output) : process.env.SITE_VERIFY_REPORT ? path.resolve(projectRoot, process.env.SITE_VERIFY_REPORT) : null;
      if (output) { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify({ status: 'failed', error: error.stack || String(error) }, null, 2)}\n`); }
      console.error(error); process.exitCode = 1;
    });
}

module.exports = { publicFiles, routeFor, localTarget, contentTypeOkay, fetchWithTimeout, verify, parseArgs };
