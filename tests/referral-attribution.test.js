const test = require('node:test');
const assert = require('node:assert/strict');

const referral = require('../docs/assets/referral.js');

test('recognizes only the exact ChatGPT source marker', () => {
  assert.equal(referral.sourceFrom({ search: '?utm_source=chatgpt.com' }), 'chatgpt');
  assert.equal(referral.sourceFrom({ search: '?aiv_ref=chatgpt' }), 'chatgpt');
  assert.equal(referral.sourceFrom({ referrer: 'https://chatgpt.com/c/example' }), 'chatgpt');
  assert.equal(referral.sourceFrom({ referrer: 'https://www.chatgpt.com/' }), 'chatgpt');
  assert.equal(referral.sourceFrom({ search: '?utm_source=chatgpt.com.evil' }), null);
  assert.equal(referral.sourceFrom({ search: '?utm_source=chatgpt.com%20' }), null);
  assert.equal(referral.sourceFrom({ referrer: 'https://chatgpt.com.evil.example/' }), null);
  assert.equal(referral.sourceFrom({ referrer: 'https://example.com/?from=chatgpt.com' }), null);
});

test('adds only the fixed website attribution to the Store URL', () => {
  const tagged = new URL(referral.storeUrl(
    'https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk',
    'https://stiwarilbj.github.io/AI_Vision/'
  ));
  assert.equal(tagged.searchParams.get('utm_source'), 'ai_vision_website');
  assert.equal(tagged.searchParams.get('utm_medium'), 'referral');
  assert.equal(tagged.searchParams.get('utm_campaign'), 'chatgpt_assisted');
  assert.equal(referral.storeUrl('https://chromewebstore.google.com/', 'https://stiwarilbj.github.io/AI_Vision/'), null);
});

test('carries the fixed marker across site pages without changing fragments', () => {
  const tagged = new URL(referral.markerUrl(
    'guides/ai-screenshot-assistant.html#worked-example',
    'https://stiwarilbj.github.io/AI_Vision/'
  ));
  assert.equal(tagged.searchParams.get('aiv_ref'), 'chatgpt');
  assert.equal(tagged.hash, '#worked-example');
  assert.equal(referral.markerUrl('https://example.com/page', 'https://stiwarilbj.github.io/AI_Vision/'), null);
  assert.equal(referral.markerUrl('assets/store-icon.png', 'https://stiwarilbj.github.io/AI_Vision/'), null);
});
