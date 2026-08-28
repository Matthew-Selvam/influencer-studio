// FanFlow Embeddings — the "memory.search" vector backend.
//
// Powers real semantic retrieval over the local memory store. The embedding
// model is Ollama's nomic-embed-text (768-dim), already local-first like the
// LLM itself. Every semantic fact / episodic summary gets an embedding so
// search can rank by meaning instead of keyword overlap.
//
// Graceful degradation is by design: if the embed model (or Ollama) isn't
// reachable, embed() returns null and the memory store silently falls back to
// its keyword scorer. The web UI stays the same either way.
//
//   config.embedModel / FANFLOW_EMBED_MODEL   → which Ollama model to embed with
//   config.memorySearch / FANFLOW_MEMORY_SEARCH → 'vector' (default) | 'keyword'

import { config } from './config.js'

// Cached availability probe with a short TTL — Ollama can flap (disk sleep,
// restarts, model pulls) and we don't want one missed probe to permanently
// disable semantic search for the lifetime of the process.
let availability = null
const CACHE_MS = 30000

export async function embedModelAvailable(ttl = CACHE_MS) {
  if (availability && Date.now() - availability.at < ttl) return availability
  try {
    const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) {
      availability = { reachable: false, model: config.embedModel, at: Date.now() }
      return availability
    }
    const data = await res.json()
    const models = (data.models || []).map(m => m.name)
    const want = config.embedModel.split(':')[0]
    availability = {
      reachable: models.some(m => m === config.embedModel || m.split(':')[0] === want),
      model: config.embedModel,
      at: Date.now(),
    }
  } catch {
    availability = { reachable: false, model: config.embedModel, at: Date.now() }
  }
  return availability
}

/** Embed a string with Ollama. Returns a number[] or null when unavailable. */
export async function embed(text) {
  const avail = await embedModelAvailable()
  if (!avail.reachable) return null
  const input = String(text || '').slice(0, 8000)

  // Preferred: batched /api/embed endpoint (Ollama >= 0.28).
  try {
    const res = await fetch(`${config.ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.embedModel, input }),
      signal: AbortSignal.timeout(60000),
    })
    if (res.ok) {
      const data = await res.json()
      const vec = data.embeddings?.[0]
      if (Array.isArray(vec)) return vec
    }
  } catch { /* fall through to legacy API */ }

  // Legacy single-prompt /api/embeddings.
  try {
    const res = await fetch(`${config.ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.embedModel, prompt: input }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data.embedding) ? data.embedding : null
  } catch {
    return null
  }
}

/** Cosine similarity in [0, 1] (vectors are already normalized-ish but we normalize anyway). */
export function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/** Round to 5 decimals so a 768-dim vector stays small in the JSON store. */
export function quantize(vec) {
  return vec.map(v => Math.round(v * 1e5) / 1e5)
}
