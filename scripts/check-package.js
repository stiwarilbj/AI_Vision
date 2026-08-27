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

console.log(`Release allowlist OK: ${normalized.length} files.`);
