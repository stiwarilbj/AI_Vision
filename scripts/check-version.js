const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'manifest.json'), 'utf8'));
const storeListing = fs.readFileSync(path.join(projectRoot, 'STORE_LISTING.md'), 'utf8');

function listingField(heading) {
  const match = storeListing.match(new RegExp(`## ${heading}\\s*\\n\\s*([^\\n]+)`, 'i'));
  return match?.[1]?.trim() || '';
}

if (packageJson.version !== manifest.version) {
  throw new Error(`Version mismatch: package.json=${packageJson.version}, manifest.json=${manifest.version}`);
}
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  throw new Error(`Manifest version must be semver-like x.y.z: ${manifest.version}`);
}

const manifestNameLength = [...manifest.name].length;
const manifestDescriptionLength = [...manifest.description].length;
const shortNameLength = [...(manifest.short_name || '')].length;
if (manifestNameLength > 75) throw new Error(`Manifest name is ${manifestNameLength} characters; maximum is 75.`);
if (manifestDescriptionLength > 132) throw new Error(`Manifest description is ${manifestDescriptionLength} characters; maximum is 132.`);
if (!manifest.short_name || shortNameLength > 12) throw new Error(`Manifest short_name must be present and no longer than 12 characters; got ${shortNameLength}.`);

const listingTitle = listingField('Title from package');
const listingSummary = listingField('Summary from package');
if (listingTitle !== manifest.name) throw new Error('STORE_LISTING.md title does not match manifest.name.');
if (listingSummary !== manifest.description) throw new Error('STORE_LISTING.md summary does not match manifest.description.');
if (!storeListing.includes(`# Chrome Web Store copy – version ${manifest.version}`)) {
  throw new Error('STORE_LISTING.md version heading is stale.');
}

console.log(`Version consistency OK: ${manifest.version}`);
console.log(`Store metadata OK: name ${manifestNameLength}/75, summary ${manifestDescriptionLength}/132, short name ${shortNameLength}/12.`);
