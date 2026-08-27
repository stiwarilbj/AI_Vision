(() => {
  const params = new URLSearchParams(window.location.search);
  const requestId = params.get('requestId') || '';
  const scope = params.get('scope') === 'adk-runtime' ? 'adk-runtime' : 'all-tabs';
  const sourceTabId = params.get('sourceTabId') || '';
  const sourceWindowId = params.get('sourceWindowId') || '';
  const grantButton = document.getElementById('grant');
  const cancelButton = document.getElementById('cancel');
  const status = document.getElementById('status');
  const title = document.getElementById('title');
  const description = document.getElementById('description');
  const permission = scope === 'adk-runtime'
    ? { origins: ['http://127.0.0.1/*'] }
    : { permissions: ['tabs'], origins: ['http://*/*', 'https://*/*'] };

  if (scope === 'adk-runtime') {
    title.textContent = 'Connect AI Vision to Google ADK?';
    description.textContent = 'Agent Mode uses an optional companion service running only on 127.0.0.1. This permission lets the extension ask that local ADK service for a browser plan; Chrome tab actions and approvals stay inside the extension.';
    grantButton.textContent = 'Allow local ADK';
  } else {
    title.textContent = 'Enable All Tabs for AI Vision?';
    description.textContent = 'All Tabs lets AI Vision read supported pages in the Chrome window where you started the request. It is optional and only used when you choose All Tabs or an All Tabs task.';
    grantButton.textContent = 'Allow All Tabs';
  }

  function setBusy(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error', isError);
    grantButton.disabled = true;
    cancelButton.disabled = true;
  }

  async function finish(granted) {
    try {
      await chrome.runtime.sendMessage({
        action: 'permissionPageResult',
        requestId,
        scope,
        sourceTabId,
        sourceWindowId,
        granted
      });
    } finally {
      setTimeout(() => window.close(), 100);
    }
  }

  grantButton.addEventListener('click', async () => {
    setBusy('Requesting Chrome permission…');
    try {
      const granted = await chrome.permissions.request(permission);
      await finish(granted === true);
    } catch (error) {
      status.classList.remove('error');
      await finish(false);
      status.textContent = `Permission was not granted: ${error?.message || 'request failed'}`;
      status.classList.add('error');
    }
  });

  cancelButton.addEventListener('click', async () => {
    setBusy(scope === 'adk-runtime' ? 'Local ADK access was not enabled.' : 'All Tabs access was not enabled.');
    await finish(false);
  });

  chrome.permissions.contains(permission)
    .then((granted) => {
      if (granted) {
        status.textContent = scope === 'adk-runtime' ? 'Local ADK access is already enabled.' : 'All Tabs access is already enabled.';
        grantButton.textContent = 'Continue';
      }
    })
    .catch(() => {});
})();
