const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVICE_WORKER_PATH = path.join(PROJECT_ROOT, 'src/background/service-worker.js');
const SERVICE_WORKER_CODE = fs.readFileSync(SERVICE_WORKER_PATH, 'utf8');

function createServiceWorkerHarness() {
  const calls = {
    capturedTabs: [],
    fetchBodies: [],
    queriedWindows: [],
    sentMessages: []
  };
  const tabsById = new Map([
    [10, { id: 10, windowId: 7, url: 'https://example.com/source', title: 'Source', active: true }],
    [11, { id: 11, windowId: 7, url: 'https://example.com/notes', title: 'Notes', active: false }]
  ]);
  let runtimeMessageListener;

  const chrome = {
    action: { onClicked: { addListener() {} } },
    contextMenus: {
      create() {},
      onClicked: { addListener() {} }
    },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener) {
          runtimeMessageListener = listener;
        }
      }
    },
    scripting: {
      async executeScript(details) {
        calls.capturedTabs.push(details.target.tabId);
        if (details.func?.name === 'extractVisiblePageSnapshot') {
          const tab = tabsById.get(details.target.tabId);
          return [{ result: {
            title: tab.title,
            url: tab.url,
            text: `Readable text from ${tab.title}`,
            interactives: []
          } }];
        }
        return [{ result: { ok: true, detail: 'Test action completed' } }];
      },
      async insertCSS() {}
    },
    tabs: {
      async captureVisibleTab() {
        return 'data:image/jpeg;base64,visible-tab';
      },
      async get(tabId) {
        return { ...tabsById.get(tabId) };
      },
      async query({ windowId }) {
        calls.queriedWindows.push(windowId);
        return [...tabsById.values()].filter((tab) => tab.windowId === windowId);
      },
      async sendMessage(tabId, message) {
        calls.sentMessages.push({ tabId, message });
      },
      async update(tabId, updates) {
        const current = tabsById.get(tabId);
        tabsById.set(tabId, { ...current, ...updates });
        return tabsById.get(tabId);
      }
    },
    windows: { async update() {} }
  };

  async function fetch(_url, options) {
    calls.fetchBodies.push(JSON.parse(options.body));
    return {
      ok: true,
      async json() {
        return {
          candidates: [{ content: { parts: [{ text: '{"action":"done","summary":"Task complete"}' }] } }]
        };
      }
    };
  }

  vm.runInNewContext(SERVICE_WORKER_CODE, {
    chrome,
    console,
    fetch,
    setTimeout(callback) {
      callback();
      return 0;
    }
  }, { filename: SERVICE_WORKER_PATH });

  async function dispatch(request) {
    assert.equal(typeof runtimeMessageListener, 'function');
    return new Promise((resolve) => {
      const staysOpen = runtimeMessageListener(
        request,
        { tab: tabsById.get(10) },
        resolve
      );
      assert.equal(staysOpen, true);
    });
  }

  return { calls, dispatch };
}

test('manifest references only existing packaged runtime files', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'manifest.json'), 'utf8'));
  const packagedPaths = [
    manifest.background.service_worker,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon)
  ];

  for (const relativePath of packagedPaths) {
    assert.equal(fs.existsSync(path.join(PROJECT_ROOT, relativePath)), true, relativePath);
  }
});

test('The Tab context reads the source tab without querying other tabs', async () => {
  const { calls, dispatch } = createServiceWorkerHarness();
  const response = await dispatch({ action: 'collectSourceTabContext' });

  assert.equal(response.tabs.length, 1);
  assert.equal(response.tabs[0].tabId, 10);
  assert.deepEqual(calls.queriedWindows, []);
});

test('Capture Agent Mode keeps source-tab scope and attaches the capture', async () => {
  const { calls, dispatch } = createServiceWorkerHarness();
  const response = await dispatch({
    action: 'runAgentTask',
    task: 'Explain and act on the selected area',
    mode: 'capture',
    captureImageData: 'selected-capture',
    apiKey: 'test-key',
    model: 'gemini-3.5-flash',
    temperature: 1,
    responseStyle: 'balanced'
  });

  const requestParts = calls.fetchBodies[0].contents[0].parts;
  assert.equal(response.summary, 'Task complete');
  assert.deepEqual(calls.queriedWindows, []);
  assert.equal(requestParts.some((part) => part.inline_data?.data === 'selected-capture'), true);
});

test('All Tabs Agent Mode queries only the starting Chrome window', async () => {
  const { calls, dispatch } = createServiceWorkerHarness();
  const response = await dispatch({
    action: 'runAgentTask',
    task: 'Compare the open tabs',
    mode: 'all-tabs',
    apiKey: 'test-key',
    model: 'gemini-3.5-flash',
    temperature: 1,
    responseStyle: 'bullets'
  });

  assert.equal(response.summary, 'Task complete');
  assert.deepEqual(calls.queriedWindows, [7]);
});
