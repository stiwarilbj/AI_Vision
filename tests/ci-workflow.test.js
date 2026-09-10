const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'),
  'utf8',
);

test('CI only uploads a browser report when the report exists', () => {
  assert.match(workflow, /if: always\(\) && hashFiles\('outputs\/website-browser-report\.json'\) != ''/);
  assert.match(workflow, /if-no-files-found: warn/);
});
