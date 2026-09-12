const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const names = ['extension-welcome.png', 'extension-capture.png', 'extension-answer.png', 'extension-settings.png', 'extension-key-setup.png', 'extension-approval.png'];
const variants = ['panel-linux', 'panel'];

function checkBaselineFiles({ root = projectRoot, baselineVariants = variants, requiredNames = names } = {}) {
  const missing = [];
  for (const variant of baselineVariants) {
    for (const name of requiredNames) {
      const file = path.join(root, 'outputs', 'ai-vision-v28', variant, name);
      if (!fs.existsSync(file)) missing.push(path.relative(root, file));
    }
  }
  assert.deepEqual(missing, [], `Missing reviewed visual baselines: ${missing.join(', ')}`);
  return { status: 'passed', variants: baselineVariants, names: requiredNames };
}

if (require.main === module) {
  try {
    const result = checkBaselineFiles();
    console.log(`Reviewed visual baselines passed: ${result.variants.length} variants × ${result.names.length} states.`);
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = { checkBaselineFiles, names, variants };
