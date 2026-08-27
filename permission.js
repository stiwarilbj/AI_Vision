(() => {
  const params = new URLSearchParams(window.location.search);
  const requestId = params.get('requestId') || '';
  const sourceTabId = params.get('sourceTabId') || '';
  const sourceWindowId = params.get('sourceWindowId') || '';
  const scope = 'all-tabs';
  const grantButton = document.getElementById('grant');
  const cancelButton = document.getElementById('cancel');
  const status = document.getElementById('status');
  const permission = { permissions: ['tabs'], origins: ['http://*/*', 'https://*/*'] };

  document.getElementById('title').textContent = 'Enable All Tabs for AI Vision?';
  document.getElementById('description').textContent = 'All Tabs lets AI Vision read supported pages in the Chrome window where you started the request. It is optional and only used when you choose All Tabs or an All Tabs task.';
  grantButton.textContent = 'Allow All Tabs';

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
      await finish(false);
      status.textContent = `Permission was not granted: ${error?.message || 'request failed'}`;
      status.classList.add('error');
    }
  });

  cancelButton.addEventListener('click', async () => {
    setBusy('All Tabs access was not enabled.');
    await finish(false);
  });

  chrome.permissions.contains(permission)
    .then((granted) => {
      if (granted) {
        status.textContent = 'All Tabs access is already enabled.';
        grantButton.textContent = 'Continue';
      }
    })
    .catch(() => {});
})();
