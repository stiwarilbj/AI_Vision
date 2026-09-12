const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const artworkRoot = path.join(projectRoot, 'release-assets-v2.8');
const specs = [
  { file: 'store-screenshots/01-understand-screenshot.png', width: 1280, height: 800 },
  { file: 'store-screenshots/02-copy-text-from-images.png', width: 1280, height: 800 },
  { file: 'store-screenshots/03-summarize-webpage.png', width: 1280, height: 800 },
  { file: 'store-screenshots/04-compare-two-tabs.png', width: 1280, height: 800 },
  { file: 'store-screenshots/05-add-gemini-key.png', width: 1280, height: 800 },
  { file: 'promotional/06-promo-440x280.png', width: 440, height: 280 },
  { file: 'promotional/07-marquee-1400x560.png', width: 1400, height: 560 }
];

function inspectPng(buffer, relativePath) {
  assert.ok(buffer.length >= 33, `${relativePath} is too small to be a PNG`);
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${relativePath} is not a PNG`);
  assert.equal(buffer.toString('ascii', 12, 16), 'IHDR', `${relativePath} has no IHDR header`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bitDepth: buffer[24], colorType: buffer[25] };
}

function checkStoreAssets({ root = artworkRoot, expected = specs } = {}) {
  for (const spec of expected) {
    const file = path.join(root, spec.file);
    assert.ok(fs.existsSync(file), `Missing Store artwork: ${spec.file}`);
    const bytes = fs.readFileSync(file);
    const info = inspectPng(bytes, spec.file);
    assert.equal(info.width, spec.width, `${spec.file} width must be ${spec.width}px`);
    assert.equal(info.height, spec.height, `${spec.file} height must be ${spec.height}px`);
    assert.equal(info.bitDepth, 8, `${spec.file} must use 8-bit channels`);
    assert.equal(info.colorType, 2, `${spec.file} must be opaque 24-bit RGB (PNG color type 2)`);
    assert.equal(bytes.includes(Buffer.from('AIza')), false, `${spec.file} contains a possible Gemini key`);
  }
  return { status: 'passed', files: expected.map(spec => spec.file) };
}

if (require.main === module) {
  try {
    const result = checkStoreAssets();
    console.log(`Store artwork passed: ${result.files.length} opaque RGB PNGs.`);
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = { checkStoreAssets, inspectPng, specs };
