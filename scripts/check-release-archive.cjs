const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const defaultArchive = path.join(projectRoot, 'outputs', 'ai-vision-v28', 'ai-vision-extension-v2.8.zip');
const defaultAllowlist = path.join(__dirname, 'package-allowlist.json');

function readArchiveEntries(archivePath) {
  try {
    return execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
      .split(/\r?\n/)
      .map(entry => entry.trim())
      .filter(Boolean)
      .map(entry => entry.replaceAll('\\', '/'));
  } catch (error) {
    throw new Error(`Could not list release archive ${archivePath}: ${error.message}`);
  }
}

function readArchiveEntry(archivePath, entry) {
  try {
    return execFileSync('unzip', ['-p', archivePath, entry]);
  } catch (error) {
    throw new Error(`Could not read ${entry} from ${archivePath}: ${error.message}`);
  }
}

function loadAllowlist(allowlistPath = defaultAllowlist) {
  const listed = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  const normalized = listed.map(file => file.replaceAll('\\', '/'));
  assert.equal(new Set(normalized).size, normalized.length, 'The release package allowlist contains duplicate files.');
  for (const relativePath of normalized) {
    assert.ok(relativePath && !relativePath.startsWith('/') && !relativePath.includes('..'), `Unsafe package path: ${relativePath}`);
  }
  return normalized.sort();
}

function checkArchive({
  archivePath = process.env.RELEASE_ARCHIVE || defaultArchive,
  sourceRoot = projectRoot,
  allowlistPath = defaultAllowlist,
  listEntries = readArchiveEntries,
  readEntry = readArchiveEntry
} = {}) {
  assert.ok(fs.existsSync(archivePath), `Missing release archive: ${archivePath}`);
  const expectedEntries = loadAllowlist(allowlistPath);
  const actualEntries = listEntries(archivePath).slice().sort();
  assert.deepEqual(actualEntries, expectedEntries, 'Release archive contents differ from the package allowlist.');
  for (const relativePath of expectedEntries) {
    const sourcePath = path.join(sourceRoot, relativePath);
    assert.ok(fs.existsSync(sourcePath), `Missing source file for ${relativePath}`);
    const source = fs.readFileSync(sourcePath);
    const archived = readEntry(archivePath, relativePath);
    assert.ok(Buffer.isBuffer(archived), `Archive reader did not return bytes for ${relativePath}`);
    assert.ok(source.equals(archived), `Release archive is stale for ${relativePath}`);
  }
  const manifest = JSON.parse(readEntry(archivePath, 'manifest.json').toString('utf8'));
  const sourceManifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8'));
  assert.equal(manifest.version, sourceManifest.version, 'Packaged manifest version differs from source manifest.');
  assert.equal(manifest.version, packageJson.version, 'Packaged manifest version differs from package metadata.');
  return { status: 'passed', archivePath, entries: actualEntries, version: manifest.version };
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = { archivePath: process.env.RELEASE_ARCHIVE || defaultArchive };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--archive') args.archivePath = argv[++index];
    else if (value.startsWith('--archive=')) args.archivePath = value.slice('--archive='.length);
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

if (require.main === module) {
  try {
    const result = checkArchive(parseArgs());
    console.log(`Release archive passed: ${result.entries.length} files, version ${result.version}.`);
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = { checkArchive, loadAllowlist, parseArgs, readArchiveEntries, readArchiveEntry };
