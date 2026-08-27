const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const allowlist = JSON.parse(fs.readFileSync(path.join(__dirname, 'package-allowlist.json'), 'utf8'));
const outputDirectory = path.join(projectRoot, 'dist');
const outputPath = path.join(outputDirectory, `ai-vision-extension-v${packageJson.version}.zip`);

fs.mkdirSync(outputDirectory, { recursive: true });
if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

try {
  childProcess.execFileSync('zip', ['-q', '-r', outputPath, ...allowlist], { cwd: projectRoot, stdio: 'inherit' });
} catch (error) {
  throw new Error(`Could not create the release archive with the system zip command: ${error.message}`);
}

console.log(`Created ${path.relative(projectRoot, outputPath)} from ${allowlist.length} allowlisted files.`);
