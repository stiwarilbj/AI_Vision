const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'manifest.json'), 'utf8'));

if (packageJson.version !== manifest.version) {
  throw new Error(`Version mismatch: package.json=${packageJson.version}, manifest.json=${manifest.version}`);
}
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  throw new Error(`Manifest version must be semver-like x.y.z: ${manifest.version}`);
}

console.log(`Version consistency OK: ${manifest.version}`);
