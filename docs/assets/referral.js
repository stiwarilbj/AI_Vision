(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AIVisionReferral = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const markerName = 'aiv_ref';
  // Keep the original value as the compatibility default for existing shared links.
  const markerValue = 'chatgpt';
  const storeHost = 'chromewebstore.google.com';
  const storePath = '/detail/ai-vision-gemini-screensh/ghmmlbclopoakmjjbkkmoefjldgjimgk';
  const sitePath = '/AI_Vision/';

  // These are intentionally allowlisted. Broad hosts such as google.com, x.com, or
  // microsoft.com are not evidence that a visit came from an AI assistant.
  const providers = Object.freeze([
    { id: 'chatgpt', sourceValues: ['chatgpt', 'chatgpt.com'], referrerHosts: ['chatgpt.com', 'www.chatgpt.com'] },
    { id: 'gemini', sourceValues: ['gemini', 'gemini.google.com'], referrerHosts: ['gemini.google.com', 'www.gemini.google.com'] },
    { id: 'claude', sourceValues: ['claude', 'claude.ai'], referrerHosts: ['claude.ai', 'www.claude.ai'] },
    { id: 'kimi', sourceValues: ['kimi', 'kimi.com'], referrerHosts: ['kimi.com', 'www.kimi.com'] },
    { id: 'deepseek', sourceValues: ['deepseek', 'chat.deepseek.com'], referrerHosts: ['chat.deepseek.com', 'www.deepseek.com'] },
    { id: 'grok', sourceValues: ['grok', 'grok.com'], referrerHosts: ['grok.com', 'www.grok.com'] },
    { id: 'zai', sourceValues: ['zai', 'z.ai'], referrerHosts: ['z.ai', 'www.z.ai'] },
    { id: 'perplexity', sourceValues: ['perplexity', 'perplexity.ai'], referrerHosts: ['perplexity.ai', 'www.perplexity.ai'] },
    { id: 'copilot', sourceValues: ['copilot', 'copilot.microsoft.com'], referrerHosts: ['copilot.microsoft.com', 'www.copilot.microsoft.com'] }
  ]);

  const sourceMap = new Map();
  const markerMap = new Map();
  const hostMap = new Map();
  for (const provider of providers) {
    for (const value of provider.sourceValues) sourceMap.set(value, provider.id);
    markerMap.set(provider.id, provider.id);
    for (const host of provider.referrerHosts) hostMap.set(host, provider.id);
  }

  function providerId(value, map) {
    if (typeof value !== 'string' || !value) return null;
    return map.get(value.toLowerCase()) || null;
  }

  function exactReferrer(referrer) {
    if (!referrer) return null;
    try {
      const url = new URL(referrer);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return hostMap.get(url.hostname.toLowerCase()) || null;
    } catch {
      return null;
    }
  }

  function exactChatGptReferrer(referrer) {
    return exactReferrer(referrer) === 'chatgpt';
  }

  function valuesFor(params, name, map, { rejectUnknown = false } = {}) {
    const values = params.getAll(name);
    if (!values.length) return { provider: null, present: false, valid: true };
    const ids = values.map(value => providerId(value, map));
    if (rejectUnknown && ids.some(id => !id)) return { provider: null, present: true, valid: false };
    const known = ids.filter(Boolean);
    if (!known.length || new Set(known).size > 1) return { provider: null, present: true, valid: false };
    return { provider: known[0], present: true, valid: true };
  }

  function sourceFrom({ search = '', referrer = '' } = {}) {
    let params;
    try {
      params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    } catch {
      params = new URLSearchParams();
    }
    const incoming = valuesFor(params, 'utm_source', sourceMap, { rejectUnknown: true });
    const carried = valuesFor(params, markerName, markerMap, { rejectUnknown: true });
    if (!incoming.valid || !carried.valid) return null;
    const referred = exactReferrer(referrer);
    const known = [incoming.provider, carried.provider, referred].filter(Boolean);
    if (new Set(known).size > 1) return null;
    return incoming.provider || carried.provider || referred || null;
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

  function storeUrl(href, base, source) {
    const url = new URL(href, base);
    if (!isStoreUrl(url) || !providerId(source, markerMap)) return null;
    url.searchParams.set('utm_source', 'ai_vision_website');
    url.searchParams.set('utm_medium', 'referral');
    url.searchParams.set('utm_campaign', `${source}_assisted`);
    return url.toString();
  }

  function markerUrl(href, base, source) {
    const baseUrl = new URL(base);
    const url = new URL(href, baseUrl);
    const normalizedSource = providerId(source, markerMap);
    if (!normalizedSource) return null;
    if (!(isSiteUrl(url) && isPublicPage(url, sitePath)) && !isLocalSiteUrl(url, baseUrl)) return null;
    url.searchParams.set(markerName, normalizedSource);
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
        const taggedStore = storeUrl(href, location.href, source);
        if (taggedStore) {
          link.setAttribute('href', taggedStore);
          store += 1;
          continue;
        }
        const taggedInternal = markerUrl(href, location.href, source);
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

  return {
    markerName,
    markerValue,
    providers,
    exactChatGptReferrer,
    exactReferrer,
    sourceFrom,
    isSiteUrl,
    isStoreUrl,
    storeUrl,
    markerUrl,
    apply
  };
}));
