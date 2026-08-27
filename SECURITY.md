# Security policy

## Scope

AI Vision is a Manifest V3 browser extension. The highest-risk areas are the Gemini API-key flow, page-content handling, optional tab permissions, and Agent Mode actions.

The service worker is the Chrome-privileged boundary. It owns the extension API key, storage, direct Gemini calls, permissions, task state, and browser actions. The content panel uses a closed Shadow DOM and receives only masked key status. Webpage text, labels, URLs, screenshots, and Google ADK responses are untrusted data.

The bundled Google ADK browser runtime runs inside the service worker, uses the key stored in trusted extension storage, and has no direct Chrome API authority. It can propose an action but cannot approve or execute one; the worker validates and executes approved actions.

## Agent safety policy

- Reading, waiting, and scrolling may run without a prompt.
- Clicks, text entry, direct navigation, new-tab open, history movement, and reload require explicit approval in the panel.
- New tabs are limited to All Tabs mode and the starting window. Tab closing and cross-window movement are not supported agent actions.
- Password, credential, payment, authentication-code, purchase, deletion, upload, publication, messaging, sign-in, subscription, permission, and legal-acceptance actions are blocked.
- Approved click and type actions require a live DOM signature match immediately before execution.
- Tasks are scoped to the source tab or starting window, have a 12-step limit, and can be cancelled.

## Reporting a vulnerability

Please do not include API keys, screenshots, private page content, or other secrets in a public issue. Email a concise report to `gitchub@gmail.com` with:

1. the affected version;
2. exact reproduction steps;
3. impact and expected behavior; and
4. a minimal proof of concept that does not contain real user data.

The project will acknowledge valid reports when possible, investigate the affected code path, and publish a fix or mitigation when appropriate. There is no bug-bounty program at this time.

## Release checks

Before packaging a release, run `npm run check` and `npm audit`. They validate syntax, the generated ADK bundle, model rotation, sender and scope checks, key isolation, action schema guards, cancellation and timeout behavior, context limits, permission failure behavior, dependency advisories, and the release allowlist. Only files listed in `scripts/package-allowlist.json` belong in the extension upload; the ADK runtime is included in that package and no companion process is required.
