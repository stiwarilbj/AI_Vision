const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RUNTIME_PATH = path.join(PROJECT_ROOT, 'src/background/adk-runtime.js');
const RUNTIME_CODE = fs.readFileSync(RUNTIME_PATH, 'utf8');

function createRuntimeSandbox(fetch) {
  const sandbox = {
    console,
    crypto: webcrypto,
    fetch,
    AbortController,
    AbortSignal,
    DOMException,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    ReadableStream,
    WritableStream,
    TransformStream,
    Headers,
    Request,
    Response,
    Blob,
    File,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    structuredClone,
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    navigator: { userAgent: 'Chrome Extension Test' }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(RUNTIME_CODE, sandbox, { filename: RUNTIME_PATH });
  return sandbox;
}

test('the packaged Google ADK runtime runs in a worker-like browser context', async () => {
  const requests = [];
  const sandbox = createRuntimeSandbox(async (url, options) => {
    requests.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      async json() {
        return {
          candidates: [{
            content: {
              role: 'model',
              parts: [{ text: '{"action":"done","summary":"Bundled ADK ran"}' }]
            }
          }]
        };
      }
    };
  });

  assert.equal(typeof sandbox.AIVisionAdkRuntime?.runAgentStep, 'function');
  const result = await sandbox.AIVisionAdkRuntime.runAgentStep({
    apiKey: 'test-key',
    model: 'gemini-3.5-flash',
    prompt: 'finish safely'
  });

  assert.equal(JSON.stringify(result), JSON.stringify({ action: 'done', summary: 'Bundled ADK ran' }));
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /models\/gemini-3\.5-flash:generateContent$/);
  assert.equal(requests[0].options.headers.get('x-goog-api-key'), 'test-key');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.contents[0].parts[0].text, 'finish safely');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.doesNotMatch(RUNTIME_CODE, /\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\(/);
});

test('the packaged Google ADK runtime honors AbortSignal cancellation', async () => {
  const sandbox = createRuntimeSandbox((_url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  }));
  const controller = new AbortController();
  const pending = sandbox.AIVisionAdkRuntime.runAgentStep({
    apiKey: 'test-key',
    model: 'gemini-2.5-flash',
    prompt: 'wait for cancellation',
    abortSignal: controller.signal
  });
  setTimeout(() => controller.abort(), 0);
  await assert.rejects(pending, /cancel|abort/i);
});
