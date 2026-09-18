#!/usr/bin/env node

// Prepare a reversible /docs restoration patch from a previously verified
// GitHub Pages deployment. This helper is deliberately read-only with respect
// to GitHub: it only reads deployment metadata and writes a local artifact.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const DEFAULT_REPOSITORY = process.env.GITHUB_REPOSITORY || 'stiwarilbj/AI_Vision';

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  });
}

function runGh(args) {
  const output = execFileSync('gh', ['api', ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(output || 'null');
}

function parseArgs(argv = process.argv.slice(2)) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (['--repo', '--commit', '--current-ref', '--patch', '--output'].includes(arg)) {
      values[arg.slice(2)] = argv[++index];
    } else if (arg.startsWith('--repo=')) values.repo = arg.slice('--repo='.length);
    else if (arg.startsWith('--commit=')) values.commit = arg.slice('--commit='.length);
    else if (arg.startsWith('--current-ref=')) values['current-ref'] = arg.slice('--current-ref='.length);
    else if (arg.startsWith('--patch=')) values.patch = arg.slice('--patch='.length);
    else if (arg.startsWith('--output=')) values.output = arg.slice('--output='.length);
  }
  return values;
}

function assertRepository(repo) {
  if (!/^[^/\s]+\/[^/\s]+$/.test(String(repo || ''))) throw new Error(`Invalid repository: ${repo || '(missing)'}`);
}

function assertCommit(commit) {
  if (!/^[0-9a-f]{40}$/i.test(String(commit || ''))) {
    throw new Error('verified_commit must be a full 40-character commit SHA');
  }
  return String(commit).toLowerCase();
}

function assertRef(ref) {
  if (!ref || typeof ref !== 'string' || ref.startsWith('-') || /[\0\n\r]/.test(ref)) {
    throw new Error(`Invalid current ref: ${ref || '(missing)'}`);
  }
}

function successfulDeploymentForCommit({ repo, commit, gh = runGh } = {}) {
  const deployments = gh([`repos/${repo}/deployments?environment=github-pages&ref=main&per_page=100`]);
  if (!Array.isArray(deployments)) return null;
  const ordered = [...deployments].sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')));
  for (const deployment of ordered) {
    if (String(deployment?.sha || '').toLowerCase() !== commit) continue;
    if (deployment?.environment !== 'github-pages' || deployment?.ref !== 'main' || !deployment?.id) continue;
    const statuses = gh([`repos/${repo}/deployments/${deployment.id}/statuses?per_page=30`]);
    if (!Array.isArray(statuses)) continue;
    const success = statuses.find((status) => status?.state === 'success');
    if (!success) continue;
    return {
      id: deployment.id,
      sha: deployment.sha,
      ref: deployment.ref,
      environment: deployment.environment,
      createdAt: deployment.created_at || null,
      updatedAt: success.updated_at || deployment.updated_at || null,
      statusUrl: success.target_url || success.url || null
    };
  }
  return null;
}

function relativeArtifactPath(file) {
  const relative = path.relative(projectRoot, file);
  return relative && !relative.startsWith('..') ? relative.split(path.sep).join('/') : file;
}

function prepareRollback({
  repo = DEFAULT_REPOSITORY,
  commit,
  currentRef = 'main',
  git = runGit,
  gh = runGh,
  patchPath = null,
  outputPath = null
} = {}) {
  assertRepository(repo);
  const verifiedCommit = assertCommit(commit);
  assertRef(currentRef);

  const resolved = String(git(['rev-parse', '--verify', `${verifiedCommit}^{commit}`], { encoding: 'utf8' })).trim().toLowerCase();
  if (resolved !== verifiedCommit) throw new Error(`Commit ${verifiedCommit} is not available in this checkout`);

  const docsTree = String(git(['ls-tree', '-d', '--name-only', verifiedCommit, 'docs'], { encoding: 'utf8' })).trim().split(/\s+/).filter(Boolean);
  if (!docsTree.includes('docs')) throw new Error(`Verified commit ${verifiedCommit} does not contain a /docs directory`);

  const deployment = successfulDeploymentForCommit({ repo, commit: verifiedCommit, gh });
  if (!deployment) throw new Error(`Commit ${verifiedCommit} has no successful github-pages deployment on main`);

  const rawPatch = git(['diff', '--binary', currentRef, verifiedCommit, '--', 'docs']);
  const patch = Buffer.isBuffer(rawPatch) ? rawPatch : Buffer.from(String(rawPatch || ''), 'utf8');
  const result = {
    schemaVersion: 1,
    status: 'passed',
    repository: repo,
    verifiedCommit,
    currentRef,
    deployment,
    patch: {
      path: patchPath ? relativeArtifactPath(path.resolve(projectRoot, patchPath)) : null,
      bytes: patch.length,
      sha256: crypto.createHash('sha256').update(patch).digest('hex'),
      empty: patch.length === 0
    },
    generatedAt: new Date().toISOString(),
    instructions: patch.length === 0
      ? 'The current ref already matches the verified /docs tree; no rollback patch is needed.'
      : 'Apply the patch on a fresh branch from main, open a normal pull request, and let the quality gate and Pages verifier run before merging. This artifact does not change production directly.'
  };

  if (patchPath) {
    const destination = path.resolve(projectRoot, patchPath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, patch);
  }
  if (outputPath) {
    const destination = path.resolve(projectRoot, outputPath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}

if (require.main === module) {
  const args = parseArgs();
  try {
    const result = prepareRollback({
      repo: args.repo || DEFAULT_REPOSITORY,
      commit: args.commit,
      currentRef: args['current-ref'] || 'main',
      patchPath: args.patch || 'outputs/rollback/docs-rollback.patch',
      outputPath: args.output || 'outputs/rollback/rollback.json'
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Could not prepare Pages rollback: ${error.message || error}`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, successfulDeploymentForCommit, prepareRollback };
