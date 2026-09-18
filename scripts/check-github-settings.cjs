#!/usr/bin/env node

// Read-only audit for the repository settings needed by the release process.
// It intentionally never mutates GitHub. Use --fixture in tests and local
// rehearsals; online mode reads through the existing gh authentication.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const configPath = path.join(projectRoot, 'config', 'github-settings.json');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function normalizeActual({ protection, pages, environment }) {
  return {
    branchProtection: {
      requiredStatusChecks: protection?.required_status_checks?.contexts || protection?.required_status_checks?.checks?.map((check) => check.context) || [],
      strict: protection?.required_status_checks?.strict === true,
      requiredApprovingReviewCount: protection?.required_pull_request_reviews?.required_approving_review_count ?? 0,
      enforceAdmins: protection?.enforce_admins?.enabled === true,
      allowForcePushes: protection?.allow_force_pushes?.enabled === true,
      allowDeletions: protection?.allow_deletions?.enabled === true
    },
    pages: {
      sourceBranch: pages?.source?.branch || null,
      sourcePath: pages?.source?.path || null,
      buildType: pages?.build_type || null,
      httpsEnforced: pages?.https_enforced === true
    },
    deploymentEnvironment: environment?.name || null
  };
}

function diffSettings(expected, actual) {
  const mismatches = [];
  for (const key of ['requiredStatusChecks', 'strict', 'requiredApprovingReviewCount', 'enforceAdmins', 'allowForcePushes', 'allowDeletions']) {
    const expectedValue = expected.branchProtection[key];
    const actualValue = actual.branchProtection[key];
    if (JSON.stringify(expectedValue) !== JSON.stringify(actualValue)) mismatches.push(`branchProtection.${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
  }
  for (const key of ['sourceBranch', 'sourcePath', 'buildType', 'httpsEnforced']) {
    if (expected.pages[key] !== actual.pages[key]) mismatches.push(`pages.${key}: expected ${JSON.stringify(expected.pages[key])}, got ${JSON.stringify(actual.pages[key])}`);
  }
  if (expected.deploymentEnvironment !== actual.deploymentEnvironment) {
    mismatches.push(`deploymentEnvironment: expected ${JSON.stringify(expected.deploymentEnvironment)}, got ${JSON.stringify(actual.deploymentEnvironment)}`);
  }
  return mismatches;
}

function ghJson(args, { exec = execFileSync } = {}) {
  return JSON.parse(exec('gh', ['api', ...args], { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}

function parseArgs(argv = process.argv.slice(2)) {
  const values = {};
  const flags = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--fixture' || arg === '--repo' || arg === '--report') values[arg.slice(2)] = argv[++i];
    else if (arg.startsWith('--fixture=')) values.fixture = arg.slice(10);
    else if (arg.startsWith('--repo=')) values.repo = arg.slice(7);
    else if (arg.startsWith('--report=')) values.report = arg.slice(9);
    else if (arg === '--allow-unavailable') flags.add('allow-unavailable');
  }
  return { values, flags };
}

function audit({ expected = readJson(configPath), actual = null, fixture = null, repo = expected.repository, gh = ghJson } = {}) {
  let source = actual;
  let unavailable = null;
  if (!source && fixture) source = readJson(fixture);
  if (!source) {
    try {
      source = {
        protection: gh([`repos/${repo}/branches/${expected.defaultBranch}/protection`]),
        pages: gh([`repos/${repo}/pages`]),
        environment: gh([`repos/${repo}/environments/${expected.deploymentEnvironment}`])
      };
    } catch (error) {
      unavailable = error.message || String(error);
    }
  }
  if (!source) return { status: 'unavailable', repository: repo, error: unavailable };
  const normalized = source.branchProtection && source.pages && !source.protection ? source : normalizeActual(source);
  const mismatches = diffSettings(expected, normalized);
  return { status: mismatches.length ? 'drift' : 'passed', repository: repo, expected, actual: normalized, mismatches };
}

if (require.main === module) {
  const { values, flags } = parseArgs();
  const result = audit({ fixture: values.fixture ? path.resolve(projectRoot, values.fixture) : null, repo: values.repo });
  const output = values.report ? path.resolve(projectRoot, values.report) : null;
  if (output) { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`); }
  console.log(JSON.stringify(result, null, 2));
  // The Actions token may be unable to read administrator-only settings. Keep
  // that limitation visible in the report, but never hide an actual drift.
  if (result.status !== 'passed' && !(flags.has('allow-unavailable') && result.status === 'unavailable')) process.exitCode = 1;
}

module.exports = { readJson, normalizeActual, diffSettings, parseArgs, audit };
