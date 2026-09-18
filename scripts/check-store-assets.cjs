const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

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
  const crcTable = inspectPng.crcTable || (inspectPng.crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  }));
  const crc32 = value => {
    let crc = 0xffffffff;
    for (const byte of value) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  let offset = 8;
  let ihdr = null;
  let idat = [];
  let sawIend = false;
  let chunkCount = 0;
  while (offset < buffer.length) {
    assert.ok(offset + 12 <= buffer.length, `${relativePath} has a truncated PNG chunk`);
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    assert.ok(crcEnd <= buffer.length, `${relativePath} has a truncated ${type} chunk`);
    const data = buffer.subarray(dataStart, dataEnd);
    const expectedCrc = buffer.readUInt32BE(dataEnd);
    assert.equal(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), expectedCrc, `${relativePath} has an invalid ${type} CRC`);
    chunkCount += 1;
    if (chunkCount === 1) assert.equal(type, 'IHDR', `${relativePath} must start with IHDR`);
    if (type === 'IHDR') {
      assert.equal(ihdr, null, `${relativePath} contains duplicate IHDR chunks`);
      assert.equal(length, 13, `${relativePath} has an invalid IHDR length`);
      ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9], compression: data[10], filter: data[11], interlace: data[12] };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      assert.equal(length, 0, `${relativePath} has a non-empty IEND chunk`);
      sawIend = true;
      assert.equal(crcEnd, buffer.length, `${relativePath} has bytes after IEND`);
      break;
    }
    offset = crcEnd;
  }
  assert.ok(ihdr, `${relativePath} is missing IHDR`);
  assert.ok(sawIend, `${relativePath} is missing IEND`);
  assert.ok(idat.length, `${relativePath} is missing IDAT data`);
  assert.ok(ihdr.width > 0 && ihdr.height > 0, `${relativePath} has an empty image`);
  assert.equal(ihdr.compression, 0, `${relativePath} uses an unsupported PNG compression method`);
  assert.equal(ihdr.filter, 0, `${relativePath} uses an unsupported PNG filter method`);
  assert.equal(ihdr.interlace, 0, `${relativePath} must be non-interlaced`);
  if (ihdr.bitDepth === 8 && ihdr.colorType === 2) {
    let decoded;
    try { decoded = zlib.inflateSync(Buffer.concat(idat)); }
    catch (error) { throw new Error(`${relativePath} has invalid compressed pixel data: ${error.message}`); }
    const expectedBytes = (ihdr.width * 3 + 1) * ihdr.height;
    assert.equal(decoded.length, expectedBytes, `${relativePath} pixel data is truncated or has unexpected rows`);
  }
  return ihdr;
}

function checkSourceProvenance({ root = artworkRoot, manifestPath = path.join(root, 'source-manifest.json') } = {}) {
  assert.ok(fs.existsSync(manifestPath), `Missing reviewed source manifest: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.version, '2.8', 'Source manifest must target v2.8.');
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0, 'Source manifest must list reviewed files.');
  for (const item of manifest.files) {
    const file = path.join(root, item.file);
    assert.ok(fs.existsSync(file), `Missing reviewed renderer input: ${item.file}`);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(digest, item.sha256, `Renderer input changed without review: ${item.file}`);
  }
  return { status: 'passed', files: manifest.files.map(item => item.file) };
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
  }
  return { status: 'passed', files: expected.map(spec => spec.file) };
}

if (require.main === module) {
  try {
    checkSourceProvenance();
    const result = checkStoreAssets();
    console.log(`Store artwork passed: ${result.files.length} opaque RGB PNGs.`);
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = { checkSourceProvenance, checkStoreAssets, inspectPng, specs };
