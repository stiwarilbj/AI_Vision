#!/usr/bin/env node

// Keep one GitHub issue open for a recurring production-health failure. The
// marker makes unchanged failures quiet and records recovery explicitly.
const crypto = require('node:crypto');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function runGh(args, { exec = execFileSync } = {}) {
  return exec('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function markerFor(report) {
  const stable = { status: report.status, commit: report.commit || null, error: report.error || null, failures: report.failures || [] };
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 16);
}

function markerInBody(body = '') { return body.match(/ai-vision-health:([a-f0-9]{16})/)?.[1] || null; }

function issueBody(report, marker) {
  return `<!-- ai-vision-health:${marker} -->\nAI Vision production health check failed.\n\nCommit: ${report.commit || 'unknown'}\nChecked: ${report.checkedAt || new Date().toISOString()}\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``;
}

function parseArgs(argv = process.argv.slice(2)) {
  const values = {};
  const flags = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report' || arg === '--repo' || arg === '--assignee') values[arg.slice(2)] = argv[++i];
    else if (arg === '--dry-run') flags.add('dry-run');
  }
  return { values, flags };
}

function listOpenIssues({ repo, gh = runGh } = {}) {
  const raw = gh([`issue`, `list`, `--repo`, repo, '--state', 'open', '--search', '[AI Vision health] in:title', '--json', 'number,title,body,url']);
  return raw ? JSON.parse(raw) : [];
}

function manage({ report, repo = process.env.GITHUB_REPOSITORY || 'stiwarilbj/AI_Vision', assignee = process.env.HEALTH_ISSUE_ASSIGNEE || 'stiwarilbj', dryRun = false, gh = runGh } = {}) {
  const marker = markerFor(report);
  const issues = listOpenIssues({ repo, gh });
  const issue = issues.find((candidate) => candidate.title === '[AI Vision health] Production smoke check failed') || issues[0];
  const actions = [];
  const invoke = (args) => { actions.push(args); if (!dryRun) gh(args); };
  if (report.status === 'superseded') {
    return { status: 'superseded', marker, issue: issue?.number, actions };
  }
  if (report.status === 'passed') {
    if (issue) {
      if (markerInBody(issue.body) !== marker) invoke(['issue', 'comment', String(issue.number), '--repo', repo, '--body', `Recovery confirmed at ${report.checkedAt || new Date().toISOString()} (commit ${report.commit || 'unknown'}).`]);
      invoke(['issue', 'close', String(issue.number), '--repo', repo, '--comment', 'Closed after a successful production health check.']);
    }
    return { status: 'recovered', marker, actions };
  }
  const body = issueBody(report, marker);
  if (!issue) {
    invoke(['issue', 'create', '--repo', repo, '--title', '[AI Vision health] Production smoke check failed', '--body', body, '--assignee', assignee]);
    return { status: 'opened', marker, actions };
  }
  if (markerInBody(issue.body) !== marker) invoke(['issue', 'comment', String(issue.number), '--repo', repo, '--body', body]);
  return { status: 'updated', marker, issue: issue.number, actions };
}

if (require.main === module) {
  const { values, flags } = parseArgs();
  const report = JSON.parse(fs.readFileSync(values.report, 'utf8'));
  const result = manage({ report, repo: values.repo, assignee: values.assignee, dryRun: flags.has('dry-run') });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { runGh, markerFor, markerInBody, issueBody, parseArgs, listOpenIssues, manage };
