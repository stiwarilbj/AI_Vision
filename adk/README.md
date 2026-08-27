# Google ADK companion runtime

AI Vision keeps Chrome tab access and safety enforcement inside the extension. Google ADK runs in this loopback-only Node service and returns one structured browser plan at a time. It never receives Chrome APIs or the extension's stored Gemini key.

## Run locally

This project pins Google ADK 2.0.0 and requires Node.js 24.13 or newer.

```sh
npm install
GEMINI_API_KEY="your-key" npm run adk:start
```

The published extension ID is allowed by default. When testing an unpacked build, either add its ID:

```sh
AI_VISION_EXTENSION_IDS="ghmmlbclopoakmjjbkkmoefjldgjimgk,your-unpacked-id" GEMINI_API_KEY="your-key" npm run adk:start
```

or temporarily allow any installed extension on the local machine:

```sh
AI_VISION_ALLOW_UNPACKED=1 GEMINI_API_KEY="your-key" npm run adk:start
```

The runtime listens only on `127.0.0.1:8765`. `GET /health` reports availability and the next model without returning credentials. `POST /v1/agent/step` rotates persistently through:

1. `gemini-3.5-flash`
2. `gemini-3-flash-preview`
3. `gemini-2.5-flash`
4. `gemini-3.1-flash-lite`
5. `gemini-2.5-flash-lite`

The sixth accepted planning request returns to the first model. Rotation state is stored in `adk/.data/`, which is excluded from Git.
