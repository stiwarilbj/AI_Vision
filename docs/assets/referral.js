(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AIVisionReferral = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const markerName = 'aiv_ref';
  const markerValue = 'chatgpt';
  const storeHost = 'chromewebstore.google.com';
  const storePath = '/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk';
  const sitePath = '/AI_Vision/';

  function exactChatGptReferrer(referrer) {
    if (!referrer) return false;
    try {
      const url = new URL(referrer);
      return (url.protocol === 'https:' || url.protocol === 'http:')
        && (url.hostname === 'chatgpt.com' || url.hostname === 'www.chatgpt.com');
    } catch {
      return false;
    }
  }

  function sourceFrom({ search = '', referrer = '' } = {}) {
    let params;
    try {
      params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    } catch {
      params = new URLSearchParams();
    }
    if (params.get(markerName) === markerValue || params.get('utm_source') === 'chatgpt.com') return markerValue;
    return exactChatGptReferrer(referrer) ? markerValue : null;
  }

  function isSiteUrl(url) {
    return url.hostname === 'stiwarilbj.github.io'
      && url.protocol === 'https:'
      && url.pathname.startsWith(sitePath);
  }

  function isPublicPage(url, prefix) {
    return url.pathname === prefix || url.pathname.endsWith('.html');
  }

  function isLocalSiteUrl(url, base) {
    return (base.hostname === '127.0.0.1' || base.hostname === 'localhost')
      && url.origin === base.origin
      && url.pathname.startsWith('/docs/')
      && isPublicPage(url, '/docs/');
  }

  function isStoreUrl(url) {
    return url.protocol === 'https:' && url.hostname === storeHost && url.pathname === storePath;
  }

  function storeUrl(href, base) {
    const url = new URL(href, base);
    if (!isStoreUrl(url)) return null;
    url.searchParams.set('utm_source', 'ai_vision_website');
    url.searchParams.set('utm_medium', 'referral');
    url.searchParams.set('utm_campaign', 'chatgpt_assisted');
    return url.toString();
  }

  function markerUrl(href, base) {
    const baseUrl = new URL(base);
    const url = new URL(href, baseUrl);
    if (!(isSiteUrl(url) && isPublicPage(url, sitePath)) && !isLocalSiteUrl(url, baseUrl)) return null;
    url.searchParams.set(markerName, markerValue);
    return url.toString();
  }

  function apply(document, location, referrer = '') {
    const source = sourceFrom({ search: location.search, referrer });
    if (!source) return { source: null, internal: 0, store: 0 };
    let internal = 0;
    let store = 0;
    for (const link of document.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || /^(?:mailto:|tel:|javascript:|data:)/i.test(href)) continue;
      try {
        const taggedStore = storeUrl(href, location.href);
        if (taggedStore) {
          link.setAttribute('href', taggedStore);
          store += 1;
          continue;
        }
        const taggedInternal = markerUrl(href, location.href);
        if (taggedInternal) {
          link.setAttribute('href', taggedInternal);
          internal += 1;
        }
      } catch {
        // Leave malformed or unsupported links unchanged.
      }
    }
    return { source, internal, store };
  }

  return { markerName, markerValue, exactChatGptReferrer, sourceFrom, isSiteUrl, isStoreUrl, storeUrl, markerUrl, apply };
}));
