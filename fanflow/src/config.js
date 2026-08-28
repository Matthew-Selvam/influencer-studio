import { fileURLToPath } from 'node:url'
import path from 'node:path'

// FanFlow — runtime configuration. Every value can be overridden with an env var.
const here = path.dirname(fileURLToPath(import.meta.url))

export const config = {
  // HTTP API port for the web app (and connectors) to talk to
  port: Number(process.env.FANFLOW_PORT || 8787),

  // LLM provider routing — "llm.chat" capability
  //   'ollama' → providers/ollama.js (default; blueprint's Llama 3 8B)
  //   'custom' → providers/custom.js (OpenAI-compatible, your own build)
  llmProvider: process.env.FANFLOW_LLM_PROVIDER || 'ollama',

  // Ollama settings (used when llmProvider === 'ollama')
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  // Llama 3 8B is the blueprint's model. Change with: FANFLOW_MODEL=llama3.2 node fanflow/src/server.js
  model: process.env.FANFLOW_MODEL || 'llama3',

  // Custom-provider settings (used when llmProvider === 'custom')
  customUrl: process.env.FANFLOW_CUSTOM_URL || 'http://localhost:8000/v1',
  customModel: process.env.FANFLOW_CUSTOM_MODEL || 'custom-model',
  customApiKey: process.env.FANFLOW_CUSTOM_API_KEY || '',

  // Memory backend: 'file' (local-first JSON, default) | 'memory' (in-memory,
  // for Vercel serverless where the FS is ephemeral). Swappable for pgvector later.
  memoryBackend: process.env.FANFLOW_MEMORY_BACKEND || 'file',
  dataDir: process.env.FANFLOW_DATA_DIR || path.join(here, '..', 'data'),
  memoryFile: process.env.FANFLOW_MEMORY_FILE || null, // null → <dataDir>/memory.json

  // Semantic retrieval: 'vector' (Ollama nomic-embed-text, default) | 'keyword'.
  // 'vector' falls back to keyword automatically if the embed model isn't ready.
  memorySearch: process.env.FANFLOW_MEMORY_SEARCH || 'vector',
  // Embedding model — nomic-embed-text is a good local default (768-dim).
  embedModel: process.env.FANFLOW_EMBED_MODEL || 'nomic-embed-text',

  // Limits — crude token budgeting so a long history never blows the context window
  maxShortTerm: 20,       // short-term messages kept per fan
  maxPromptChars: 12000,  // total prompt character budget for the LLM
  maxMemoryHits: 6,       // memory items injected into the prompt
  eventLogCap: 200,       // rolling event-bus log size
}
