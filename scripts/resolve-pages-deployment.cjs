#!/usr/bin/env node

// Resolve the newest successful GitHub Pages deployment for main. Health
// checks use this commit instead of assuming that the branch tip is live.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');

function runGh(args, { exec = execFileSync } = {}) {
  const output = exec('gh', ['api', ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(output || 'null');
}

function newestSuccessfulDeployment({ repo = process.env.GITHUB_REPOSITORY || 'stiwarilbj/AI_Vision', gh = runGh } = {}) {
  const deployments = gh([`repos/${repo}/deployments?environment=github-pages&ref=main&per_page=30`]);
  if (!Array.isArray(deployments)) return null;
  const ordered = [...deployments].sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')));
  for (const deployment of ordered) {
    if (deployment?.environment !== 'github-pages' || deployment?.ref !== 'main' || !deployment?.sha || !deployment?.id) continue;
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

function parseArgs(argv = process.argv.slice(2)) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo' || arg === '--output' || arg === '--github-output') values[arg.slice(2)] = argv[++index];
    else if (arg.startsWith('--repo=')) values.repo = arg.slice(7);
    else if (arg.startsWith('--output=')) values.output = arg.slice(9);
    else if (arg.startsWith('--github-output=')) values['github-output'] = arg.slice(16);
  }
  return values;
}

if (require.main === module) {
  const args = parseArgs();
  let result;
  try {
    result = newestSuccessfulDeployment({ repo: args.repo });
  } catch (error) {
    console.error(`Could not resolve the latest Pages deployment: ${error.message || error}`);
    process.exitCode = 1;
  }
  if (process.exitCode !== 1) {
    if (!result) {
      console.error('No successful github-pages deployment for main was found.');
      process.exitCode = 1;
    } else {
      const payload = { status: 'passed', repository: args.repo || process.env.GITHUB_REPOSITORY || 'stiwarilbj/AI_Vision', deployment: result };
      const output = args.output ? path.resolve(projectRoot, args.output) : null;
      if (output) {
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
      }
      const githubOutput = args['github-output'] || process.env.GITHUB_OUTPUT;
      if (githubOutput) {
        fs.appendFileSync(githubOutput, `DEPLOY_SHA=${result.sha}\nDEPLOYMENT_ID=${result.id}\n`);
      }
      console.log(JSON.stringify(payload, null, 2));
    }
  }
}

module.exports = { runGh, newestSuccessfulDeployment, parseArgs };
