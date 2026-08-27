import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { runAdkAgentStep } from './agent.mjs';
import { ModelRotation, ROTATING_MODELS } from './model-rotation.mjs';

const MAX_BODY_BYTES = 9_000_000;
const DEFAULT_EXTENSION_ID = 'ghmmlbclopoakmjjbkkmoefjldgjimgk';
const directory = dirname(fileURLToPath(import.meta.url));

function json(response, status, value, origin = null) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': origin || 'null',
    'Vary': 'Origin'
  });
  response.end(body);
}

function parseAllowedExtensionIds(value) {
  return new Set(String(value || DEFAULT_EXTENSION_ID).split(',').map((item) => item.trim()).filter(Boolean));
}

function allowedOrigin(origin, allowedExtensionIds, allowAnyExtension) {
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'chrome-extension:') return false;
    return allowAnyExtension || allowedExtensionIds.has(parsed.hostname) ? origin : false;
  } catch (_) {
    return false;
  }
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (_) {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

function resolveApiKey(environment) {
  return String(environment.GEMINI_API_KEY || environment.GOOGLE_API_KEY || environment.GOOGLE_GENAI_API_KEY || '').trim();
}

export function createAdkServer({
  environment = process.env,
  rotation = new ModelRotation({ stateFile: join(directory, '.data', 'model-rotation.json') }),
  runAgentStep = runAdkAgentStep,
  requestTimeoutMs = 55000
} = {}) {
  const allowedExtensionIds = parseAllowedExtensionIds(environment.AI_VISION_EXTENSION_IDS);
  const allowAnyExtension = environment.AI_VISION_ALLOW_UNPACKED === '1';
  const apiKey = resolveApiKey(environment);

  return createServer(async (request, response) => {
    const origin = allowedOrigin(request.headers.origin, allowedExtensionIds, allowAnyExtension);
    if (origin === false) {
      json(response, 403, { ok: false, error: 'This extension origin is not allowed.' });
      return;
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': origin || 'null',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
        'Vary': 'Origin'
      });
      response.end();
      return;
    }

    try {
      if (request.method === 'GET' && request.url === '/health') {
        await rotation.load();
        json(response, 200, {
          ok: true,
          service: 'ai-vision-google-adk',
          adkVersion: '2.0.0',
          hasApiKey: Boolean(apiKey),
          models: ROTATING_MODELS,
          ...rotation.snapshot()
        }, origin);
        return;
      }
      if (request.method === 'GET' && request.url === '/v1/models') {
        await rotation.load();
        json(response, 200, { ok: true, models: ROTATING_MODELS, ...rotation.snapshot() }, origin);
        return;
      }
      if (request.method !== 'POST' || request.url !== '/v1/agent/step') {
        json(response, 404, { ok: false, error: 'Route not found.' }, origin);
        return;
      }
      if (!apiKey) throw Object.assign(new Error('Set GEMINI_API_KEY or GOOGLE_API_KEY before starting the ADK runtime.'), { status: 503 });
      const body = await readJson(request);
      if (typeof body?.prompt !== 'string' || !body.prompt.trim()) throw Object.assign(new Error('prompt is required.'), { status: 400 });
      const reserved = await rotation.reserve();
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);
      request.once('aborted', () => abortController.abort());
      try {
        const decision = await runAgentStep({
          apiKey,
          model: reserved.model,
          prompt: body.prompt,
          imageData: typeof body.imageData === 'string' ? body.imageData : '',
          temperature: body.temperature,
          abortSignal: abortController.signal
        });
        json(response, 200, {
          ok: true,
          provider: 'google-adk',
          adkVersion: '2.0.0',
          model: reserved.model,
          nextModel: reserved.nextModel,
          requestNumber: reserved.requestNumber,
          decision
        }, origin);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const status = error?.status || (error?.name === 'AbortError' ? 504 : 500);
      json(response, status, { ok: false, error: error?.message || 'ADK request failed.' }, origin);
    }
  });
}

export async function startAdkServer(options = {}) {
  const host = options.host || process.env.AI_VISION_ADK_HOST || '127.0.0.1';
  const port = Number(options.port ?? process.env.AI_VISION_ADK_PORT ?? 8765);
  const server = createAdkServer(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = await startAdkServer();
  const address = server.address();
  console.log(`AI Vision Google ADK runtime listening on http://${address.address}:${address.port}`);
  console.log(`Model rotation: ${ROTATING_MODELS.join(' -> ')}`);
}
