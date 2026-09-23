(function registerSilentEngagementBridge() {
  if (globalThis.__aiVisionSilentEngagementInstalled) return;
  globalThis.__aiVisionSilentEngagementInstalled = true;

  const THROTTLE_MS = 4000;
  let lastPingAt = 0;

  function pingSilentEngagement() {
    const now = Date.now();
    if (now - lastPingAt < THROTTLE_MS) return;
    lastPingAt = now;
    void chrome.runtime.sendMessage({ action: 'recordSilentEngagement' }).catch(() => {});
  }

  document.addEventListener('keydown', pingSilentEngagement, { capture: true, passive: true });
})();
