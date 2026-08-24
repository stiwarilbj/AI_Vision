const MAX_CONTEXT_TABS = 20;
const MAX_AGENT_STEPS = 12;

// Extension entry points
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'geminiScreenshotHelper',
    title: 'AI Vision',
    contexts: ['page', 'selection']
  });
});

function isSupportedWebUrl(url = '') {
  return url.startsWith('http://') || url.startsWith('https://');
}

async function openAssistantInTab(tab) {
  if (!tab?.id || !isSupportedWebUrl(tab.url)) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content/assistant-panel.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['src/content/assistant-panel.css']
    });
  } catch (error) {
    console.error('Failed to inject AI Vision:', error);
  }
}

chrome.action.onClicked.addListener(openAssistantInTab);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'geminiScreenshotHelper') {
    openAssistantInTab(tab);
  }
});

// Read-only page context collection
function extractVisiblePageSnapshot() {
  const extensionSelector = '#gemini-popup, #gemini-screenshot-overlay, #gemini-selection-rectangle, #gemini-temp-error, #gemini-api-key-popup';
  const isVisible = (element) => {
    if (!element || element.closest(extensionSelector)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  };

  const textParts = [];
  let characterCount = 0;
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent?.replace(/\s+/g, ' ').trim();
      const parent = node.parentElement;
      if (!text || !parent || parent.closest(extensionSelector)) return NodeFilter.FILTER_REJECT;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  while (characterCount < 7000) {
    const node = walker.nextNode();
    if (!node) break;
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    textParts.push(text);
    characterCount += text.length + 1;
  }

  const interactiveSelector = 'a[href], button, input:not([type="hidden"]), textarea, select, [role="button"], [contenteditable="true"]';
  const interactives = Array.from(document.querySelectorAll(interactiveSelector))
    .filter(isVisible)
    .slice(0, 90)
    .map((element, index) => ({
      index,
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type') || '',
      text: (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 180),
      ariaLabel: (element.getAttribute('aria-label') || '').slice(0, 180),
      placeholder: (element.getAttribute('placeholder') || '').slice(0, 180),
      href: element instanceof HTMLAnchorElement ? element.href.slice(0, 500) : ''
    }));

  return {
    title: document.title,
    url: location.href,
    text: textParts.join('\n').slice(0, 7000),
    interactives
  };
}

async function captureTabSnapshot(tab) {
  const base = {
    tabId: tab.id,
    title: tab.title || 'Untitled',
    url: tab.url || '',
    active: tab.active === true
  };

  if (!tab.id || !isSupportedWebUrl(tab.url)) {
    return { ...base, restricted: true, reason: 'Chrome and extension pages cannot be read' };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractVisiblePageSnapshot
    });
    const snapshot = results?.[0]?.result;
    if (!snapshot) throw new Error('No page content was returned');
    return { ...base, ...snapshot, restricted: false };
  } catch (error) {
    return { ...base, restricted: true, reason: error.message || 'Page access was blocked' };
  }
}

async function collectWindowContext(windowId) {
  const allTabs = await chrome.tabs.query({ windowId });
  const tabs = allTabs.slice(0, MAX_CONTEXT_TABS);
  const snapshots = await Promise.all(tabs.map(captureTabSnapshot));
  return {
    windowId,
    tabs: snapshots,
    omittedCount: Math.max(0, allTabs.length - tabs.length)
  };
}

async function collectAgentContext(mode, sourceTabId, windowId) {
  if (mode === 'all-tabs') {
    return collectWindowContext(windowId);
  }
  const sourceTab = await chrome.tabs.get(sourceTabId);
  return {
    windowId: sourceTab.windowId,
    tabs: [await captureTabSnapshot(sourceTab)],
    omittedCount: 0
  };
}

async function captureVisibleTab(sender, options) {
  if (!sender.tab?.windowId) {
    throw new Error('Could not identify the Chrome window.');
  }
  await chrome.windows.update(sender.tab.windowId, { focused: true }).catch(() => {});
  return chrome.tabs.captureVisibleTab(
    sender.tab.windowId,
    options || { format: 'jpeg', quality: 90 }
  );
}

// Agent planning through Gemini
function getStyleInstruction(style) {
  const styles = {
    balanced: 'Use a balanced, clear tone with enough detail to be useful.',
    concise: 'Be concise and lead with the direct answer.',
    formal: 'Use a polished, formal, professional tone.',
    casual: 'Use a friendly, conversational, casual tone.',
    detailed: 'Give a thorough answer with useful context.',
    bullets: 'Use short, scannable bullet points whenever possible.'
  };
  return styles[style] || styles.balanced;
}

function serializeAgentContext(context) {
  return context.tabs.map((tab, tabIndex) => {
    const interactiveText = (tab.interactives || []).map((item) => {
      const label = item.ariaLabel || item.text || item.placeholder || item.href || item.tag;
      return `  [${item.index}] ${item.tag}${item.type ? ` type=${item.type}` : ''}: ${label}`;
    }).join('\n');
    return [
      `TAB INDEX ${tabIndex}${tab.active ? ' (active)' : ''}`,
      `Title: ${tab.title}`,
      `URL: ${tab.url}`,
      tab.restricted ? `Restricted: ${tab.reason}` : `Page text:\n${tab.text || '[No readable text]'}`,
      tab.restricted ? '' : `Interactive elements:\n${interactiveText || '  [none]'}`
    ].filter(Boolean).join('\n');
  }).join('\n\n---\n\n');
}

function parseAgentDecision(rawText) {
  const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini did not return a browser action.');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function requestNextAgentAction(request, context, history) {
  const allTabsScope = request.mode === 'all-tabs';
  const scopeDescription = allTabsScope
    ? 'the Chrome window where the task started'
    : 'only The Tab where the task started';
  const prompt = `You are operating AI Vision Agent Mode, a constrained browser helper.

USER TASK:
${request.task}

ALLOWED SCOPE:
Operate inside ${scopeDescription}.

CURRENT ${allTabsScope ? 'WINDOW' : 'TAB'} SNAPSHOT:
${serializeAgentContext(context)}

ACTION HISTORY:
${history.length ? history.map((item, index) => `${index + 1}. ${item}`).join('\n') : '[none]'}

Return exactly one JSON object and nothing else. Allowed shapes:
{"action":"click","tabIndex":0,"elementIndex":3,"reason":"..."}
{"action":"type","tabIndex":0,"elementIndex":3,"text":"...","reason":"..."}
{"action":"scroll","tabIndex":0,"direction":"down","reason":"..."}
{"action":"navigate","tabIndex":0,"url":"https://example.com","reason":"..."}
{"action":"activate_tab","tabIndex":0,"reason":"..."}
{"action":"wait","reason":"..."}
{"action":"done","summary":"..."}

Rules:
- Use only tabs and element indexes shown in this snapshot.
- Operate only inside ${scopeDescription}.
- ${allTabsScope ? 'You may activate and navigate the listed tabs.' : 'There is only one allowed tab. Never switch to or act on another tab.'}
- If a capture is attached, use it to understand the task and the page area the user selected.
- Never enter passwords, payment data, authentication codes, or private credentials.
- Never purchase, submit payment, delete data, send/post/publish communications, upload files, change permissions, accept legal terms, or complete sign-in. If the task requires one of these, return done and explain that the user must take over.
- Prefer reading and answering over clicking when the task is already complete.
- After a navigation or click, use wait if the next snapshot needs time to settle.
- ${getStyleInstruction(request.responseStyle)}`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent`;
  const parts = [{ text: prompt }];
  if (typeof request.captureImageData === 'string' && request.captureImageData) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: request.captureImageData } });
  }
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': request.apiKey
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: Math.min(Number(request.temperature) || 0.4, 0.8) }
    })
  });

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details?.error?.message || `Gemini request failed with ${response.status}.`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty browser action.');
  return parseAgentDecision(text);
}

// Guarded browser actions
function performVisiblePageAction(action) {
  const extensionSelector = '#gemini-popup, #gemini-screenshot-overlay, #gemini-selection-rectangle, #gemini-temp-error, #gemini-api-key-popup';
  const isVisible = (element) => {
    if (!element || element.closest(extensionSelector)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  };
  const elements = Array.from(document.querySelectorAll('a[href], button, input:not([type="hidden"]), textarea, select, [role="button"], [contenteditable="true"]'))
    .filter(isVisible)
    .slice(0, 90);

  if (action.action === 'scroll') {
    const amount = Math.max(320, Math.round(window.innerHeight * 0.72));
    window.scrollBy({ top: action.direction === 'up' ? -amount : amount, behavior: 'smooth' });
    return { ok: true, detail: `Scrolled ${action.direction === 'up' ? 'up' : 'down'}` };
  }

  const element = elements[Number(action.elementIndex)];
  if (!element) return { ok: false, detail: 'The target element is no longer available.' };
  const label = `${element.getAttribute('aria-label') || ''} ${element.innerText || element.textContent || ''}`.toLowerCase();

  if (action.action === 'click') {
    const protectedAction = /(buy now|purchase|place order|pay now|delete|remove account|send message|publish|post comment|upload|download|sign in|log in|accept terms|subscribe)/i;
    if (protectedAction.test(label)) {
      return { ok: false, blocked: true, detail: 'This action needs the user to take over.' };
    }
    element.scrollIntoView({ block: 'center', inline: 'center' });
    element.click();
    return { ok: true, detail: `Clicked ${label.trim().slice(0, 100) || element.tagName.toLowerCase()}` };
  }

  if (action.action === 'type') {
    const type = (element.getAttribute('type') || '').toLowerCase();
    const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();
    const fieldName = `${element.getAttribute('name') || ''} ${element.getAttribute('id') || ''} ${label}`.toLowerCase();
    if (type === 'password' || /(password|one-time-code|cc-|card|payment|security code|otp|auth code)/.test(`${autocomplete} ${fieldName}`)) {
      return { ok: false, blocked: true, detail: 'AI Vision will not type into sensitive fields.' };
    }
    element.focus();
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) setter.call(element, String(action.text || ''));
      else element.value = String(action.text || '');
    } else if (element.isContentEditable) {
      element.textContent = String(action.text || '');
    } else {
      return { ok: false, detail: 'The target does not accept text.' };
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, detail: `Typed into ${label.trim().slice(0, 100) || element.tagName.toLowerCase()}` };
  }

  return { ok: false, detail: 'Unsupported page action.' };
}

async function ensureAgentScope(sourceTabId, windowId, mode) {
  const sourceTab = await chrome.tabs.get(sourceTabId);
  if (mode === 'all-tabs' && sourceTab.windowId !== windowId) {
    throw new Error('Agent Mode stopped because the AI Vision tab moved to another window.');
  }
}

async function executeAgentAction(action, context, windowId, sourceTabId, mode) {
  if (action.action === 'wait') {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return { ok: true, detail: 'Waited for the page to update' };
  }

  const tabIndex = Number(action.tabIndex);
  const tab = context.tabs[tabIndex];
  if (!tab?.tabId) throw new Error('Gemini selected a tab that is not available.');
  const liveTab = await chrome.tabs.get(tab.tabId);
  if (mode !== 'all-tabs' && liveTab.id !== sourceTabId) {
    throw new Error('Agent Mode cannot leave The Tab in this mode.');
  }
  if (mode === 'all-tabs' && liveTab.windowId !== windowId) {
    throw new Error('The selected tab is no longer in the starting Chrome window.');
  }

  if (action.action === 'activate_tab') {
    await chrome.tabs.update(tab.tabId, { active: true });
    return { ok: true, detail: `Activated ${liveTab.title || 'tab'}` };
  }

  if (action.action === 'navigate') {
    const url = String(action.url || '');
    if (!isSupportedWebUrl(url)) {
      return { ok: false, blocked: true, detail: 'Only HTTP and HTTPS pages can be opened.' };
    }
    await chrome.tabs.update(tab.tabId, { url, active: true });
    return { ok: true, detail: `Opened ${url}` };
  }

  if (!['click', 'type', 'scroll'].includes(action.action)) {
    return { ok: false, detail: 'Unsupported browser action.' };
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.tabId },
    func: performVisiblePageAction,
    args: [action]
  });
  return results?.[0]?.result || { ok: false, detail: 'The page did not return an action result.' };
}

async function reportAgentProgress(sourceTabId, step, message) {
  try {
    await chrome.tabs.sendMessage(sourceTabId, { action: 'agentModeProgress', step, message });
  } catch (_) {
    // The task can continue if the progress surface is temporarily unavailable.
  }
}

async function runAgentTask(request, sender) {
  const sourceTabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (!sourceTabId || windowId === undefined) {
    throw new Error('Could not identify the starting Chrome window.');
  }
  if (!request.apiKey || !request.model || !request.task) {
    throw new Error('The task is missing its API key, model, or instructions.');
  }
  const mode = ['capture', 'tab', 'all-tabs'].includes(request.mode) ? request.mode : 'tab';
  request.mode = mode;
  const firstProgress = mode === 'all-tabs'
    ? 'Reading tabs in this window'
    : mode === 'capture' && request.captureImageData
      ? 'Reading your capture and The Tab'
      : 'Reading The Tab';

  const history = [];
  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    await ensureAgentScope(sourceTabId, windowId, mode);
    await reportAgentProgress(sourceTabId, step === 0 ? 1 : 2, step === 0 ? firstProgress : `Working on step ${step + 1}`);
    const context = await collectAgentContext(mode, sourceTabId, windowId);
    const decision = await requestNextAgentAction(request, context, history);

    if (decision.action === 'done') {
      await reportAgentProgress(sourceTabId, 3, 'Completing the task');
      return { summary: decision.summary || 'Task completed.' };
    }

    const result = await executeAgentAction(decision, context, windowId, sourceTabId, mode);
    history.push(`${decision.action}: ${result.detail || decision.reason || 'completed'}`);
    if (result.blocked) {
      const scope = mode === 'all-tabs' ? 'the starting Chrome window' : 'The Tab';
      return { summary: `${result.detail} No action was taken outside ${scope}.` };
    }
    if (!result.ok) {
      history.push('The action failed; choose a different visible target on the next step.');
    }
    await new Promise((resolve) => setTimeout(resolve, decision.action === 'navigate' ? 1200 : 650));
  }

  return { summary: 'I reached the 12-step safety limit. Review the current browser state, then start another task if more work is needed.' };
}

// Messages sent by src/content/assistant-panel.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.action) {
      case 'captureVisibleTab':
        return captureVisibleTab(sender, request.options);
      case 'collectSourceTabContext':
        if (!sender.tab) throw new Error('Could not identify the current tab.');
        return { windowId: sender.tab.windowId, tabs: [await captureTabSnapshot(sender.tab)], omittedCount: 0 };
      case 'collectWindowContext':
        if (sender.tab?.windowId === undefined) throw new Error('Could not identify the current Chrome window.');
        return collectWindowContext(sender.tab.windowId);
      case 'runAgentTask':
        return runAgentTask(request, sender);
      default:
        return null;
    }
  })().then(sendResponse).catch((error) => {
    console.error('AI Vision background error:', error);
    sendResponse({ error: error.message || 'Unexpected background error.' });
  });
  return true;
});
