#!/usr/bin/env node

// Combine verifier, browser smoke, and settings-audit evidence into one
// stable report consumed by the incident deduplication helper.
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function readIfPresent(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function compose({ deployment, smoke, settings, commit = null, checkedAt = new Date().toISOString(), superseded = false } = {}) {
  const checks = { deployment, smoke, settings };
  if (superseded) {
    return {
      status: 'superseded',
      commit: commit || deployment?.commit || null,
      checkedAt,
      failures: [],
      note: 'A newer successful Pages deployment appeared while this check was running; results were discarded to avoid a false incident.',
      checks
    };
  }
  const failures = [];
  const warnings = [];
  for (const [name, result] of Object.entries(checks)) {
    if (!result || result.status !== 'passed') {
      // GitHub's built-in Actions token cannot read some administrator-only
      // endpoints (notably branch protection). Record that limitation without
      // turning an otherwise healthy deployment into a false incident. Any
      // actual drift or failed production check remains a hard failure.
      if (name === 'settings' && result?.status === 'unavailable') warnings.push({ check: name, note: result.error || 'Settings audit unavailable to this token' });
      else failures.push({ check: name, error: result?.error || `${name} did not pass` });
    }
  }
  return {
    status: failures.length ? 'failed' : 'passed',
    commit: commit || deployment?.commit || null,
    checkedAt,
    failures,
    warnings,
    checks
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const values = {};
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (['--deployment', '--smoke', '--settings', '--commit', '--output'].includes(arg)) values[arg.slice(2)] = argv[++index];
    else if (arg === '--superseded') flags.add('superseded');
    else if (arg.startsWith('--deployment=')) values.deployment = arg.slice(13);
    else if (arg.startsWith('--smoke=')) values.smoke = arg.slice(8);
    else if (arg.startsWith('--settings=')) values.settings = arg.slice(11);
    else if (arg.startsWith('--commit=')) values.commit = arg.slice(9);
    else if (arg.startsWith('--output=')) values.output = arg.slice(9);
  }
  return { values, flags };
}

if (require.main === module) {
  const { values: args, flags } = parseArgs();
  const report = compose({
    deployment: readIfPresent(path.resolve(projectRoot, args.deployment)),
    smoke: readIfPresent(path.resolve(projectRoot, args.smoke)),
    settings: readIfPresent(path.resolve(projectRoot, args.settings)),
    commit: args.commit || process.env.PAGES_DEPLOY_COMMIT,
    superseded: flags.has('superseded')
  });
  const output = path.resolve(projectRoot, args.output || process.env.HEALTH_REPORT || 'outputs/health/health-report.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Health report ${report.status}: ${output}`);
  if (!['passed', 'superseded'].includes(report.status)) process.exitCode = 1;
}

module.exports = { readIfPresent, compose, parseArgs };
