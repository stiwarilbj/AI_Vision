const test = require('node:test');
const assert = require('node:assert/strict');

const referral = require('../docs/assets/referral.js');

const providers = referral.providers.map(provider => provider.id);

test('recognizes every allowlisted assistant source and exact referrer host', () => {
  for (const provider of referral.providers) {
    for (const sourceValue of provider.sourceValues) {
      assert.equal(referral.sourceFrom({ search: `?utm_source=${sourceValue}` }), provider.id);
    }
    assert.equal(referral.sourceFrom({ search: `?aiv_ref=${provider.id}` }), provider.id);
    for (const host of provider.referrerHosts) {
      assert.equal(referral.sourceFrom({ referrer: `https://${host}/answer` }), provider.id);
    }
  }
});

test('rejects unknown, broad, spoofed, and conflicting sources', () => {
  assert.equal(referral.sourceFrom({ search: '?utm_source=chatgpt.com.evil' }), null);
  assert.equal(referral.sourceFrom({ search: '?utm_source=chatgpt.com%20' }), null);
  assert.equal(referral.sourceFrom({ search: '?utm_source=google.com' }), null);
  assert.equal(referral.sourceFrom({ search: '?utm_source=x.com' }), null);
  assert.equal(referral.sourceFrom({ search: '?aiv_ref=unknown' }), null);
  assert.equal(referral.sourceFrom({ referrer: 'https://chatgpt.com.evil.example/' }), null);
  assert.equal(referral.sourceFrom({ referrer: 'https://example.com/?from=chatgpt.com' }), null);
  assert.equal(referral.sourceFrom({ referrer: 'https://x.com/grok' }), null);
  assert.equal(referral.sourceFrom({ search: '?utm_source=chatgpt.com&utm_source=gemini' }), null);
  assert.equal(referral.sourceFrom({ search: '?utm_source=chatgpt.com&aiv_ref=claude' }), null);
  assert.equal(referral.sourceFrom({ search: '?utm_source=gemini', referrer: 'https://chatgpt.com/' }), null);
  assert.equal(referral.sourceFrom({ search: '?utm_source=unknown', referrer: 'https://chatgpt.com/' }), null);
});

test('adds a provider-specific fixed attribution to the Store URL', () => {
  for (const provider of providers) {
    const tagged = new URL(referral.storeUrl(
      'https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk',
      'https://stiwarilbj.github.io/AI_Vision/',
      provider
    ));
    assert.equal(tagged.searchParams.get('utm_source'), 'ai_vision_website');
    assert.equal(tagged.searchParams.get('utm_medium'), 'referral');
    assert.equal(tagged.searchParams.get('utm_campaign'), `${provider}_assisted`);
  }
  assert.equal(referral.storeUrl('https://chromewebstore.google.com/', 'https://stiwarilbj.github.io/AI_Vision/', 'chatgpt'), null);
  assert.equal(referral.storeUrl('https://chromewebstore.google.com/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk', 'https://stiwarilbj.github.io/AI_Vision/', 'unknown'), null);
});

test('carries the provider marker across public site pages without changing fragments', () => {
  for (const provider of ['chatgpt', 'gemini', 'deepseek', 'copilot']) {
    const tagged = new URL(referral.markerUrl(
      'guides/ai-screenshot-assistant.html#worked-example',
      'https://stiwarilbj.github.io/AI_Vision/',
      provider
    ));
    assert.equal(tagged.searchParams.get('aiv_ref'), provider);
    assert.equal(tagged.hash, '#worked-example');
  }
  assert.equal(referral.markerUrl('https://example.com/page', 'https://stiwarilbj.github.io/AI_Vision/', 'chatgpt'), null);
  assert.equal(referral.markerUrl('assets/store-icon.png', 'https://stiwarilbj.github.io/AI_Vision/', 'chatgpt'), null);
  assert.equal(referral.markerUrl('guides/ai-screenshot-assistant.html', 'https://stiwarilbj.github.io/AI_Vision/', 'unknown'), null);
});
