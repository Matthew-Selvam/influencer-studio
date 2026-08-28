# FanFlow — AI Creator OS (backend)

The orchestration core of the FanFlow ecosystem, from the FanFlow blueprints:

```
FanFlow (this service)
├── AI Engine          Ollama · Llama 3 8B · persona · intent · style stats
├── Memory             local JSON store: short-term · episodic · semantic · relationships · vector search
├── Workflow Engine    message → intent → memory → generate → (media?) → store → respond
├── Event Bus          MessageReceived → … → MediaGenerated → AnalyticsUpdated
├── Capability Registry  "llm.chat" → ollama, "memory.search" → vector, …
└── Connectors         Telegram (first plugin)
```

Media generation (Character Studio) stays **in the browser** — the user's own
Higgsfield account is OAuthed per-browser, so the workflow *delegates* media
requests over the event bus instead of calling a model directly.

## Why zero dependencies

Node ≥ 18 has `fetch`, `AbortSignal.timeout`, and `node:http` built in. The
whole backend is dependency-free on purpose — install, run, and move it.

## Memory

- Short-term, episodic and semantic layers plus the relationship engine — a
  local JSON file (`fanflow/data/memory.json`).
- **Vector semantic search** — `memory.search` ranks by meaning, not keywords,
  using Ollama's `nomic-embed-text` (768-dim) for both the query and every
  stored fact/summary. `GET /api/health` reports the live mode:

  ```json
  "embed": { "mode": "vector", "reachable": true, "model": "nomic-embed-text", "active": true }
  ```

  One-time setup (the embed model, ~274 MB):

  ```bash
  ollama pull nomic-embed-text
  ```

  To force the old keyword scorer instead: `FANFLOW_MEMORY_SEARCH=keyword` (or
  `FANFLOW_EMBED_MODEL` for a different embed model). If the embed model isn't
  reachable the store **silently falls back to keyword search**, so the app
  never breaks.

## Setup

```bash
# 1. One-time: pull the LLM (the blueprint's model — ~4.7 GB)
ollama pull llama3

# 2. Start the server (from the repo root or fanflow/)
npm run fanflow        # → http://localhost:8787
# or: cd fanflow && npm start
```

Then open the web app → **Settings → FanFlow** to point it at
`http://localhost:8787`, or use the **FanFlow** page to chat as a fan and watch
the live workflow trace (intent → memory hits → relationship → media requests).

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | server + Ollama + memory stats |
| `GET /api/registry` | capability → provider map |
| `GET /api/events` | rolling event-bus log (newest first) |
| `GET /api/fans` | fans + relationship scores (trust/loyalty/engagement/VIP/purchases) |
| `POST /api/fan` | create a fan `{ fanId, name? }` |
| `POST /api/chat` | fan message → `{ reply, intent, media?, trace }` |
| `POST /api/memory/remember` | add a semantic fact |
| `GET /api/memory/:fanId` | full memory dump for a fan |

Example chat:

```bash
curl -s localhost:8787/api/chat -H 'content-type: application/json' -d '{
  "fanId": "fan-1",
  "message": "hey! can you show me a new outfit?",
  "persona": { "name": "Kayla", "niche": "Fashion", "backstory": "wanna be influencer", "clothingStyle": "Streetwear" }
}'
```

## Deploying to Vercel (serverless)

The same API runs as a Vercel serverless function — the web app calls it
same-origin at `/api/fanflow` (no config needed):

```bash
# 1. Set the runtime env vars in the Vercel project (Settings → Environment Variables)
FANFLOW_LLM_PROVIDER=shell        # demo shell until you wire a real model
FANFLOW_MEMORY_BACKEND=memory     # in-memory (Vercel FS is ephemeral)

# 2. Deploy
vercel --prod
```

On Vercel:
- **Memory** uses the in-memory backend (resets on cold start). For durable
  memory, add an Upstash Redis backend later — the store API stays the same.
- **LLM** runs in `shell` mode: every part of FanFlow works (intent, memory,
  relationships, media requests, event bus) but replies tell you to connect a
  model. To go live:

  ```bash
  FANFLOW_LLM_PROVIDER=custom
  FANFLOW_CUSTOM_URL=https://your-build.example/v1   # your own OpenAI-compatible build
  FANFLOW_CUSTOM_MODEL=my-model
  ```

Local dev still works unchanged (`npm run fanflow`), and the vite dev server
proxies `/api/fanflow` → `localhost:8787` so the frontend behaves identically.

## Connectors (plugins)

```bash
# Telegram — get a token from @BotFather first
BOT_TOKEN=123:abc node fanflow/src/connectors/telegram.js
```

Connectors talk to FanFlow only over its HTTP API — the plugin boundary from
the blueprint. Each fan on Telegram maps to `fanId: tg:<chatId>`.

## Configuration (env vars)

| Var | Default | Purpose |
|---|---|---|
| `FANFLOW_PORT` | `8787` | HTTP API port |
| `FANFLOW_LLM_PROVIDER` | `ollama` | `ollama` or `custom` — routes `llm.chat` |
| `FANFLOW_MODEL` | `llama3` | Ollama chat model |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server |
| `FANFLOW_CUSTOM_URL` | `http://localhost:8000/v1` | Custom provider base URL (OpenAI-compatible) |
| `FANFLOW_CUSTOM_MODEL` | `custom-model` | Custom provider model id |
| `FANFLOW_CUSTOM_API_KEY` | — | Optional bearer token for the custom provider |
| `FANFLOW_DATA_DIR` | `fanflow/data` | memory store location |
| `FANFLOW_MEMORY_SEARCH` | `vector` | `vector` (nomic-embed-text) or `keyword` |
| `FANFLOW_EMBED_MODEL` | `nomic-embed-text` | Ollama embed model for semantic search |
| `BOT_TOKEN` | — | Telegram connector |

## LLM provider abstraction

`llm.chat` resolves through the registry to an **active provider** — add your
own build without touching the workflow, memory, or web UI:

```bash
# Ollama (default) — the blueprint's Llama 3 8B
node fanflow/src/server.js

# Your own lightweight build (any OpenAI-compatible /v1 endpoint)
FANFLOW_LLM_PROVIDER=custom \
FANFLOW_CUSTOM_URL=http://localhost:8000/v1 \
FANFLOW_CUSTOM_MODEL=my-model \
node fanflow/src/server.js
```

Providers live in `fanflow/src/providers/` — each exports `{ name, label,
listModels(), hasModel(model), chat(opts), missingHint(model) }`. To add a
third provider, write `providers/<name>.js` with that shape and register it in
`src/llm.js` (one line). `GET /api/health` reports the active provider and
`GET /api/registry` lists it under `llm.chat`.

## Roadmap (from the blueprint)

- **Done: vector memory** — semantic retrieval via Ollama embeddings with
  keyword fallback (see **Memory** above).
- **pgvector / graphiti** — replace the JSON store itself with a real vector
  DB + knowledge graph while keeping the same API.
- **Episodic summarization** — LLM-written daily/weekly/monthly summaries.
- **More connectors** — Discord, email, Instagram.
- **Marketplace** — persona packs, outfit packs, camera presets.

## Excluded by design

Per the blueprints: no features that conceal AI identity, evade platform
safeguards, or obscure AI provenance. Personas are always framed as fictional
AI characters.
