const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(projectRoot, 'src/background/service-worker.js'), 'utf8');
const panel = fs.readFileSync(path.join(projectRoot, 'src/content/assistant-panel.js'), 'utf8');
const adkBundlePath = path.join(projectRoot, 'src/background/adk-runtime.js');
const adkBundle = fs.existsSync(adkBundlePath) ? fs.readFileSync(adkBundlePath, 'utf8') : '';
const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

const expectedAgentModels = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
];
const officialStoreUrl = 'https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk?authuser=0&hl=en';

const forbiddenInPanel = [
  /chrome\.storage/,
  /x-goog-api-key/,
  /generativelanguage\.googleapis\.com/,
  /\beval\s*\(/,
  /new\s+Function\s*\(/
];
for (const pattern of forbiddenInPanel) {
  if (pattern.test(panel)) throw new Error(`Panel security lint failed: ${pattern}`);
}
for (const file of ['SECURITY.md', 'PRIVACY.md', 'ARCHITECTURE.md', 'scripts/package-allowlist.json']) {
  if (!fs.existsSync(path.join(projectRoot, file))) throw new Error(`Missing project control: ${file}`);
}
if (!manifest.permissions.includes('activeTab') || manifest.permissions.includes('tabs')) {
  throw new Error('Permission lint failed: activeTab must remain required and tabs must remain optional.');
}
if (!manifest.host_permissions.includes('https://generativelanguage.googleapis.com/*')) {
  throw new Error('Permission lint failed: missing narrow Gemini host permission.');
}
if (!manifest.optional_host_permissions.includes('http://*/*') || !manifest.optional_host_permissions.includes('https://*/*')) {
  throw new Error('Permission lint failed: broad HTTP/HTTPS access must remain optional for All Tabs.');
}
if (!/responseSchema/.test(worker) || !/targetSignature/.test(worker)) {
  throw new Error('Security lint failed: structured actions and live target signatures are required.');
}
if (packageJson.devDependencies?.['@google/adk'] !== '2.0.0') {
  throw new Error('ADK lint failed: the vendored build must remain pinned to @google/adk 2.0.0.');
}
if (!worker.includes("importScripts?.('src/background/adk-runtime.js')")) {
  throw new Error('ADK lint failed: the service worker must load the packaged browser bundle.');
}
if (worker.includes('127.0.0.1') || panel.includes('127.0.0.1')) {
  throw new Error('ADK lint failed: the extension must not depend on a localhost companion.');
}
if (adkBundle.length < 100000 || !adkBundle.includes('AIVisionAdkRuntime')) {
  throw new Error('ADK lint failed: the generated in-extension runtime bundle is missing or unexpectedly small.');
}
if (/\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\(/.test(adkBundle)) {
  throw new Error('ADK lint failed: the packaged runtime contains unsupported dynamic code.');
}
for (const [index, model] of expectedAgentModels.entries()) {
  if (!worker.includes(`'${model}'`)) throw new Error(`Worker ADK model allowlist is missing ${model}.`);
}
if (!readme.includes(officialStoreUrl) || !panel.includes(officialStoreUrl)) {
  throw new Error('Documentation lint failed: official Chrome Web Store listing is missing.');
}

console.log('Static lint OK.');
