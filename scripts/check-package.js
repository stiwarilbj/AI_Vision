const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const allowlistPath = path.join(__dirname, 'package-allowlist.json');
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
const normalized = allowlist.map((file) => file.replaceAll('\\', '/'));

if (new Set(normalized).size !== normalized.length) {
  throw new Error('The release package allowlist contains duplicate files.');
}

for (const relativePath of normalized) {
  if (relativePath.startsWith('/') || relativePath.includes('..')) throw new Error(`Unsafe package path: ${relativePath}`);
  if (!fs.existsSync(path.join(projectRoot, relativePath))) throw new Error(`Missing allowlisted file: ${relativePath}`);
  if (/\.mp4$|^Deliverables_And_Images\//i.test(relativePath)) throw new Error(`Marketing asset is not allowed in the extension package: ${relativePath}`);
}

const runtimePath = path.join(projectRoot, 'src/background/adk-runtime.js');
const runtime = fs.readFileSync(runtimePath, 'utf8');
if (!runtime.includes('AIVisionAdkRuntime') || runtime.length < 100000) {
  throw new Error('The release package must contain the generated Google ADK browser runtime.');
}
if (/\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\(/.test(runtime)) {
  throw new Error('The generated Google ADK runtime contains unsupported dynamic code.');
}

console.log(`Release allowlist OK: ${normalized.length} files.`);
