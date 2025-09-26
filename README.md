# Cloudflare Assistant

A minimal AI-powered chat app running entirely on Cloudflare:
- **LLM**: Workers AI (Llama 3.1, with graceful fallback)
- **Workflow / coordination**: Durable Object per session (WebSocket)
- **User input**: Static chat UI (Pages-style, `public/`)
- **Memory / state**: Durable Object storage (short-term) + Vectorize (best-effort long-term)

## Architecture

- `src/index.ts`
  - Routes `/agents/<session>` to a Durable Object instance keyed by `<session>`.
  - Serves static assets from `public/` via the `[assets]` binding.

- `src/PersonalAssistantAgent.ts`
  - Accepts a WebSocket, streams messages.
  - Stores short-term history in DO storage.
  - Calls Workers AI using a small helper that tries multiple valid model IDs:
    - `@cf/meta/llama-3.1-70b-instruct`
    - `@cf/meta/llama-3.1-8b-instruct`
    - `@cf/mistral/mistral-7b-instruct-v0.2`
  - (Optional) Long-term memory with Vectorize using `@cf/baai/bge-base-en-v1.5`.

- `public/index.html` + `public/index.js`
  - Simple chat interface using a **native WebSocket** (no fragile SDK import).

## Prereqs

- Node 18+
- Wrangler 4.x
- Logged into Cloudflare in this terminal:
  ```bash
  npx wrangler login
  npx wrangler whoami
