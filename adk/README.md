# Bundled Google ADK runtime

AI Vision ships the browser-compatible Google ADK runtime at
`src/background/adk-runtime.js`. It is loaded by the MV3 service worker, so an
end user does not need Node.js, a companion process, a localhost permission, or
any terminal command.

To use Agent Mode, load the repository folder as an unpacked extension, open
AI Vision Settings, paste a Gemini API key, press **Save key**, enable Agent
Mode, and send a task. The service worker stores the key in trusted extension
storage and rotates requests through the five configured Gemini models.

Contributors who change `src/background/adk-runtime-entry.js` can rebuild the
checked-in bundle with `npm run build:adk`; the generated file is included in
the Chrome Web Store package. `npm run check` rebuilds it automatically.
