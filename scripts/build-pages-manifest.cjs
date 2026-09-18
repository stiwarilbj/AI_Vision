#!/usr/bin/env node

// Build a deterministic manifest for the exact /docs artifact promoted to
// GitHub Pages. It contains no secrets or timestamps, so the same commit has
// the same evidence locally and in Actions.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');

function collectFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files.sort();
}

function buildManifest({ source = path.join(projectRoot, 'docs'), commit = null } = {}) {
  const sourceRoot = path.resolve(source);
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) throw new Error(`Pages source directory is missing: ${sourceRoot}`);
  const resolvedCommit = commit || process.env.GITHUB_SHA || (() => {
    try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
  })();
  const files = collectFiles(sourceRoot).map((absolute) => {
    const bytes = fs.readFileSync(absolute);
    return {
      path: path.relative(sourceRoot, absolute).split(path.sep).join('/'),
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    };
  });
  return { schemaVersion: 1, repository: 'stiwarilbj/AI_Vision', source: 'docs', commit: resolvedCommit, files };
}

function parseArgs(argv = process.argv.slice(2)) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source' || arg === '--output' || arg === '--commit') values[arg.slice(2)] = argv[++i];
    else if (arg.startsWith('--source=')) values.source = arg.slice('--source='.length);
    else if (arg.startsWith('--output=')) values.output = arg.slice('--output='.length);
    else if (arg.startsWith('--commit=')) values.commit = arg.slice('--commit='.length);
  }
  return values;
}

if (require.main === module) {
  const args = parseArgs();
  const manifest = buildManifest({ source: args.source || process.env.PAGES_SOURCE, commit: args.commit || process.env.PAGES_COMMIT });
  const output = path.resolve(projectRoot, args.output || process.env.PAGES_MANIFEST || 'outputs/pages/artifact-manifest.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Pages artifact manifest written: ${path.relative(projectRoot, output)} (${manifest.files.length} files, ${manifest.commit})`);
}

module.exports = { collectFiles, buildManifest, parseArgs };
