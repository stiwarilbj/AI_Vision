const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'),
  'utf8',
);

test('CI keeps the release gate reproducible and uploads browser evidence', () => {
  assert.match(workflow, /concurrency:\n  group: ci-\$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}\n  cancel-in-progress: true/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
  assert.match(workflow, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/);
  assert.match(workflow, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);
  assert.match(workflow, /timeout-minutes: 30/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /Validate Store artwork dimensions and encoding/);
  assert.match(workflow, /npm run assets:check/);
  assert.match(workflow, /npm run package/);
  assert.match(workflow, /npm run website:check/);
  assert.match(workflow, /npm run panel:check/);
  assert.match(workflow, /npm run visual:check/);
  assert.match(workflow, /npm run extension:check/);
  assert.match(workflow, /hashFiles\('outputs\/ci\/\*\*'\) != ''/);
  assert.match(workflow, /path: outputs\/ci\//);
  assert.match(workflow, /PLAYWRIGHT_TRACE_DIR: outputs\/ci\/traces\/panel/);
  assert.match(workflow, /VISUAL_DIFF_DIR: outputs\/ci\/visual-diffs/);
  assert.match(workflow, /retention-days: 30/);
  assert.match(workflow, /quality-gate:/);
  assert.match(workflow, /needs: checks/);
  assert.match(workflow, /CHECKS_RESULT: \$\{\{ needs\.checks\.result \}\}/);
  assert.match(workflow, /if \[ \"\$CHECKS_RESULT\" != \"success\" \]/);
  assert.match(workflow, /if-no-files-found: warn/);
});
