(function registerPageActivityBridge() {
  if (globalThis.__aiVisionPageActivityInstalled) return;
  globalThis.__aiVisionPageActivityInstalled = true;

  const THROTTLE_MS = 750;
  let lastSentAt = 0;

  function sendActivity(activity) {
    const now = Date.now();
    if (now - lastSentAt < THROTTLE_MS) return;
    lastSentAt = now;
    let selectionPreview = '';
    try {
      const selected = String(globalThis.getSelection?.()?.toString?.() || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (selected) selectionPreview = selected.slice(0, 120);
    } catch (_) {
      // Selection access can fail on cross-origin frames; skip the preview.
    }
    const title = String(document.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const path = String(globalThis.location?.pathname || '/').slice(0, 120);
    void chrome.runtime.sendMessage({
      action: 'recordPageActivity',
      activity,
      title,
      path,
      selectionPreview
    }).catch(() => {});
  }

  const listenerOptions = { capture: true, passive: true };
  document.addEventListener('pointerdown', () => sendActivity('pointer'), listenerOptions);
  document.addEventListener('scroll', () => sendActivity('scroll'), listenerOptions);
})();
