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
  // Hermes 3 8B (Llama 3.1 fine-tune, ChatML-templated) holds a character
  // voice far better than base Llama 3 in fan roleplay.
  // Change with: FANFLOW_MODEL=llama3 node fanflow/src/server.js
  model: process.env.FANFLOW_MODEL || 'hermes3:8b',

  // ── Sampling ────────────────────────────────────────────────────────────
  // min_p is the main quality lever: it prunes the tail relative to the top
  // token's probability, so a higher temperature stays coherent rather than
  // drifting. Tuned for character consistency at conversational latency.
  //
  // NOTE: SillyTavern's `smoothing_factor` (quadratic sampling) has NO Ollama
  // equivalent — it is a koboldcpp/llama.cpp sampler, and Ollama silently
  // ignores unknown option keys rather than erroring. min_p covers most of the
  // same ground. If smoothing ever becomes a hard requirement that means
  // moving to koboldcpp behind the `custom` provider, not adding a key here.
  temperature: Number(process.env.FANFLOW_TEMPERATURE ?? 0.9),
  minP: Number(process.env.FANFLOW_MIN_P ?? 0.07),
  repeatPenalty: Number(process.env.FANFLOW_REPEAT_PENALTY ?? 1.04),
  maxTokens: Number(process.env.FANFLOW_MAX_TOKENS ?? 350),

  // Context window. When unset, Ollama applies its own default (2048 on many
  // builds) and truncates the prompt FROM THE LEFT — silently eating the
  // system prompt that the provider's trimmer goes out of its way to preserve.
  // Must stay comfortably above maxPromptChars/4 (~3k tokens).
  numCtx: Number(process.env.FANFLOW_NUM_CTX ?? 8192),

  // Stop sequences. Hermes 3 is ChatML-templated; without these it can emit
  // its own turn markers or carry on writing the fan's next line.
  stopSequences: process.env.FANFLOW_STOP
    ? process.env.FANFLOW_STOP.split('|')
    : ['<|im_end|>', '<|im_start|>', '\nfan:', '\nFan:'],

  // How long Ollama keeps the model resident after a request. Ollama's own
  // default is 5m, so a quiet gap costs the next fan a ~9s cold load against
  // a ~1.5s warm reply — the difference between "texting" and "waiting".
  // '-1' pins it in memory indefinitely; use '5m' to reclaim RAM when idle.
  keepAlive: process.env.FANFLOW_KEEP_ALIVE || '30m',

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
  maxShortTerm: Number(process.env.FANFLOW_MAX_SHORT_TERM ?? 20),      // short-term messages kept per fan
  maxPromptChars: Number(process.env.FANFLOW_MAX_PROMPT_CHARS ?? 12000), // total prompt character budget for the LLM
  maxMemoryHits: Number(process.env.FANFLOW_MAX_MEMORY_HITS ?? 6),     // memory items injected into the prompt
  eventLogCap: Number(process.env.FANFLOW_EVENT_LOG_CAP ?? 200),       // rolling event-bus log size
}
