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
  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(workflow, /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/);
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
  assert.match(workflow, /resolved Node 24 releases/);
  assert.match(workflow, /timeout-minutes: 30/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /Verify reviewed visual baselines before browser work/);
  assert.match(workflow, /npm run visual:baseline-files/);
  assert.match(workflow, /npm run package/);
  assert.match(workflow, /Verify the freshly built archive against source/);
  assert.match(workflow, /RELEASE_ARCHIVE: dist\/ai-vision-extension-v2\.8\.zip/);
  assert.match(workflow, /Extract the release archive for Chromium[\s\S]*Validate Store artwork dimensions and encoding/);
  assert.match(workflow, /npm run assets:check/);
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
