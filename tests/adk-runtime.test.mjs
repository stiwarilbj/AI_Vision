import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { BaseLlm, InMemoryRunner, LlmAgent } from '@google/adk';
import { createAdkServer } from '../adk/server.mjs';
import { ModelRotation, ROTATING_MODELS } from '../adk/model-rotation.mjs';

const EXPECTED_MODELS = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
];

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('the pinned Google ADK runner executes the AI Vision agent loop', async () => {
  class FakePlannerModel extends BaseLlm {
    constructor() { super({ model: 'fake-browser-planner' }); }
    async *generateContentAsync() {
      yield { content: { role: 'model', parts: [{ text: '{"action":"done","summary":"ADK runner executed"}' }] } };
    }
    async connect() { throw new Error('Live mode is not used by this test.'); }
  }
  const agent = new LlmAgent({
    name: 'ai_vision_adk_smoke_test',
    model: new FakePlannerModel(),
    instruction: 'Return one browser action.',
    includeContents: 'none'
  });
  const runner = new InMemoryRunner({ agent, appName: 'ai_vision_adk_smoke_test' });
  let output = '';
  for await (const event of runner.runEphemeral({ userId: 'test', newMessage: { role: 'user', parts: [{ text: 'finish' }] } })) {
    output += (event.content?.parts || []).map((part) => part.text || '').join('');
  }
  assert.match(output, /ADK runner executed/);
});

test('Google ADK model rotation advances one model per request and survives restart', async () => {
  assert.deepEqual([...ROTATING_MODELS], EXPECTED_MODELS);
  const directory = await mkdtemp(join(tmpdir(), 'ai-vision-rotation-'));
  const stateFile = join(directory, 'state.json');
  try {
    const first = new ModelRotation({ stateFile });
    const sequence = [];
    for (let index = 0; index < 6; index += 1) sequence.push((await first.reserve()).model);
    assert.deepEqual(sequence, [...EXPECTED_MODELS, EXPECTED_MODELS[0]]);

    const restarted = new ModelRotation({ stateFile });
    const seventh = await restarted.reserve();
    assert.equal(seventh.model, EXPECTED_MODELS[1]);
    assert.equal(seventh.requestNumber, 7);
    assert.deepEqual(JSON.parse(await readFile(stateFile, 'utf8')), { nextIndex: 2, requestCount: 7 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('ADK server uses the reserved model, returns planner metadata, and protects extension origins', async () => {
  const seen = [];
  const server = createAdkServer({
    environment: { GEMINI_API_KEY: 'test-key', AI_VISION_ALLOW_UNPACKED: '1' },
    rotation: new ModelRotation(),
    runAgentStep: async (request) => {
      seen.push({ model: request.model, prompt: request.prompt, hasAbortSignal: Boolean(request.abortSignal) });
      return { action: 'done', summary: `Planned with ${request.model}` };
    }
  });
  const origin = await listen(server);
  try {
    const models = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await fetch(`${origin}/v1/agent/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'chrome-extension://unpacked-test-id' },
        body: JSON.stringify({ prompt: `step ${index + 1}` })
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      models.push(body.model);
      assert.equal(body.provider, 'google-adk');
      assert.equal(body.requestNumber, index + 1);
      assert.equal(body.decision.summary, `Planned with ${body.model}`);
    }
    assert.deepEqual(models, [...EXPECTED_MODELS, EXPECTED_MODELS[0]]);
    assert.deepEqual(seen.map(({ model }) => model), models);
    assert.equal(seen.every(({ hasAbortSignal }) => hasAbortSignal), true);

    const health = await (await fetch(`${origin}/health`)).json();
    assert.equal(health.hasApiKey, true);
    assert.equal(Object.hasOwn(health, 'apiKey'), false);
    assert.equal(health.nextModel, EXPECTED_MODELS[1]);

    const denied = await fetch(`${origin}/health`, { headers: { Origin: 'https://untrusted.example' } });
    assert.equal(denied.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ADK server fails closed when its API key is absent', async () => {
  const server = createAdkServer({ environment: {}, rotation: new ModelRotation(), runAgentStep: async () => ({ action: 'done', summary: 'unexpected' }) });
  const origin = await listen(server);
  try {
    const response = await fetch(`${origin}/v1/agent/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test' })
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /GEMINI_API_KEY|GOOGLE_API_KEY/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
