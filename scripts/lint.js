const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(projectRoot, 'src/background/service-worker.js'), 'utf8');
const panel = fs.readFileSync(path.join(projectRoot, 'src/content/assistant-panel.js'), 'utf8');
const rotation = fs.readFileSync(path.join(projectRoot, 'adk/model-rotation.mjs'), 'utf8');
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
if (!manifest.optional_host_permissions.includes('http://*/*')) {
  throw new Error('Permission lint failed: the optional loopback ADK origin must be requestable.');
}
if (!/responseSchema/.test(worker) || !/targetSignature/.test(worker)) {
  throw new Error('Security lint failed: structured actions and live target signatures are required.');
}
if (packageJson.dependencies?.['@google/adk'] !== '2.0.0') {
  throw new Error('ADK lint failed: @google/adk must remain pinned to 2.0.0.');
}
for (const [index, model] of expectedAgentModels.entries()) {
  const previous = index === 0 ? -1 : rotation.indexOf(expectedAgentModels[index - 1]);
  const current = rotation.indexOf(model);
  if (current < 0 || current < previous) throw new Error(`ADK rotation lint failed at ${model}.`);
  if (!worker.includes(`'${model}'`)) throw new Error(`Worker ADK model allowlist is missing ${model}.`);
}
if (!readme.includes(officialStoreUrl) || !panel.includes(officialStoreUrl)) {
  throw new Error('Documentation lint failed: official Chrome Web Store listing is missing.');
}

console.log('Static lint OK.');
