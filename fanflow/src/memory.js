// FanFlow Memory — local-first, JSON-file-backed store.
//
// Implements the blueprint's memory layers with one file per layer, keyed by fan:
//   shortTerm   — recent conversation window (messages)
//   episodic    — rolling summaries of conversation chunks
//   semantic    — structured facts / preferences / important events
//   relationship— trust, loyalty, engagement, VIP score, purchases, stage
//   events      — persisted event-bus log (mirrors the in-process log)
//
// Semantic retrieval is "memory.search": "vector" (embeddings.js — Ollama
// nomic-embed-text), falling back to keyword overlap when the embed model isn't
// reachable. pgvector / graphiti later replaces the store without changing this API.

import { config } from './config.js'
import { embed, cosine, quantize, embedModelAvailable } from './embeddings.js'
import fs from 'node:fs'
import path from 'node:path'

let store = null
let file = null

// 'memory' backend = pure in-memory (Vercel serverless: the FS is ephemeral).
// 'file' backend = local-first JSON file (default). Same in-memory cache in
// both cases; only persist() differs. NOTE: static node: imports are fine on
// serverless — with the memory backend the fs calls are simply never reached.
const IN_MEMORY = config.memoryBackend !== 'file'

function init() {
  if (store) return
  store = { fans: {}, events: [] }
  if (IN_MEMORY) return
  file = config.memoryFile || path.join(config.dataDir, 'memory.json')
  try {
    store = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    store = { fans: {}, events: [] }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  migrate(store)
}

/** One-time schema fixes applied on load. */
function migrate(s) {
  let dirty = false
  for (const f of Object.values(s.fans || {})) {
    if (!f || !Array.isArray(f.episodic)) continue
    for (const ep of f.episodic) {
      // Early versions embedded episodic summaries with the wrong source text
      // (the `text` field was undefined for summaries → garbage vectors). Drop
      // them so the backfill regenerates correct embeddings on first search.
      if (Array.isArray(ep.embed)) { delete ep.embed; dirty = true }
    }
  }
  if (dirty) persist()
}

let saveTimer = null
let dirty = false
function writeStore() {
  if (!file) return
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    // Atomic write (tmp rename): readers never see a half-written file, and
    // concurrent writers degrade cleanly (last-write-wins) instead of corrupting
    // memory.json. Cross-process clobbering isn't fully prevented; run one server.
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2))
    fs.renameSync(tmp, file)
    dirty = false
  } catch (e) {
    console.error('[fanflow] memory persist failed:', e.message)
  }
}
function persist() {
  if (IN_MEMORY) return
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(writeStore, 200) // debounced — a burst of messages writes once
}

/** Flush any pending writes synchronously. Called on shutdown so recent
 * memories aren't lost in the 200ms debounce window. Exported for server.js. */
export function flushNow() {
  if (IN_MEMORY || !dirty) return
  if (saveTimer) clearTimeout(saveTimer)
  writeStore()
}

function fan(id) {
  init()
  if (!store.fans[id]) {
    store.fans[id] = {
      id,
      createdAt: Date.now(),
      lastActive: Date.now(),
      relationship: { trust: 0, loyalty: 0, engagement: 0, vip: 0, purchases: 0, favoriteTopics: [], conversationStage: 'new' },
      shortTerm: [],
      semantic: [],
      episodic: [],
    }
  }
  return store.fans[id]
}

// ── Public API (the capabilities registry calls these) ──────────────────────

export function stats() {
  init()
  const fanCount = Object.keys(store.fans).length
  const messages = Object.values(store.fans).reduce((n, f) => n + f.shortTerm.length, 0)
  return { fans: fanCount, messages, events: store.events.length }
}

export function ensureFan({ fanId, name } = {}) {
  const f = fan(fanId)
  if (name && !f.name) f.name = name
  persist()
  return f
}

export function fanMemory(fanId) {
  return fan(fanId)
}

export function fans() {
  init()
  return Object.values(store.fans).map(f => ({
    id: f.id,
    name: f.name || null,
    createdAt: f.createdAt,
    lastActive: f.lastActive,
    relationship: f.relationship,
    messageCount: f.shortTerm.length,
    memoryCount: f.semantic.length,
  }))
}

export function remember({ fanId, type = 'fact', text, tags = [] } = {}) {
  const f = fan(fanId)
  const item = { id: `m-${Date.now()}-${f.semantic.length}`, type, text, tags, at: Date.now() }
  f.semantic.push(item)
  // Semantic memory is unbounded by design (facts accumulate) but cap defensively
  if (f.semantic.length > 500) f.semantic.splice(0, f.semantic.length - 500)
  persist()
  // Vector memory: embed the new fact now so it's searchable immediately
  // (no need to wait for a backfill pass on the next search).
  if (config.memorySearch === 'vector') embedItem(item)
  return item
}

/**
 * Embed text for a memory item, normalized across both item shapes:
 * semantic facts (which have `text`) and episodic rollups (which have `summary`).
 * The v1 backfill read `it.text` directly and silently produced garbage vectors
 * for summaries (text === undefined → "undefined").
 */
function embedTextFor(item) {
  return `${item.type || 'fact'}: ${item.text || item.summary || ''} ${(item.tags || []).join(' ')}`
}

/** Fire-and-forget: embed a freshly-stored item so vector search sees it
 * immediately, without waiting for a future search to backfill it. */
function embedItem(item) {
  void (async () => {
    const vec = await embed(embedTextFor(item))
    if (vec && !item.embed) { item.embed = quantize(vec); persist() }
  })()
}

/** Embed a memory item if it doesn't have one yet — lazy backfill on first search. */
const backfilled = new Set() // in-process: don't rescan a fan's items on every query

async function ensureEmbeddings(fanId, items) {
  if (backfilled.has(fanId)) return
  const missing = items.filter(it => !Array.isArray(it.embed))
  if (missing.length === 0) { backfilled.add(fanId); return }
  let wrote = false
  for (const it of missing) {
    const vec = await embed(embedTextFor(it))
    if (vec) { it.embed = quantize(vec); wrote = true }
  }
  if (wrote) persist()
  backfilled.add(fanId)
}

/** Status for /api/health — which search mode is live and the embed model. */
export async function embedStatus() {
  const avail = await embedModelAvailable(0) // fresh probe on every health check
  return {
    mode: config.memorySearch,
    reachable: avail.reachable,
    model: avail.model,
    active: avail.reachable && config.memorySearch === 'vector',
  }
}

/**
 * Semantic retrieval.
 * - 'vector' mode → cosine similarity over embedded memories (falls back to
 *   keyword if the embed model isn't reachable).
 * - 'keyword' mode → the v1 word-overlap scorer.
 */
export async function searchMemory({ fanId, query, limit = config.maxMemoryHits } = {}) {
  const f = fan(fanId)
  const words = (query || '').toLowerCase().split(/\W+/).filter(w => w.length > 2)
  const corpus = [...f.semantic, ...f.episodic]
  if (!corpus.length) return []

  // Vector path
  if (config.memorySearch === 'vector') {
    const vec = await embed(query || '')
    if (vec) {
      await ensureEmbeddings(fanId, corpus)
      const scored = []
      for (const item of corpus) {
        if (!Array.isArray(item.embed)) continue
        const score = cosine(vec, item.embed)
        // 0.25 ≈ no real semantic overlap; keeps noise out of the trace
        if (score > 0.25) scored.push({ ...item, score: Math.round(score * 1000) / 10 })
      }
      return scored.sort((a, b) => b.score - a.score).slice(0, limit)
    }
  }

  // Keyword fallback (v1 scorer — also the explicit 'keyword' mode)
  if (!words.length) return []
  const scored = []
  for (const item of corpus) {
    const hay = `${item.text} ${(item.tags || []).join(' ')}`.toLowerCase()
    let score = 0
    for (const w of words) if (hay.includes(w)) score++
    if (score > 0) scored.push({ ...item, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
}

export function recentMessages({ fanId, limit = 8 } = {}) {
  return fan(fanId).shortTerm.slice(-limit)
}

/** Store a conversation turn. Every 10 turns rolls an episodic summary. */
export function storeMessage({ fanId, role, text }) {
  const f = fan(fanId)
  f.shortTerm.push({ role, text, at: Date.now() })
  if (f.shortTerm.length > config.maxShortTerm) f.shortTerm.splice(0, f.shortTerm.length - config.maxShortTerm)
  if (f.shortTerm.length % 10 === 0) {
    const chunk = f.shortTerm.slice(-10).map(m => `${m.role === 'user' ? 'fan' : 'reply'}: ${m.text}`).join(' | ')
    const ep = { id: `ep-${Date.now()}`, summary: chunk.slice(0, 600), at: Date.now() }
    f.episodic.push(ep)
    if (f.episodic.length > 200) f.episodic.splice(0, f.episodic.length - 200)
    // Embed the rollup so it's immediately retrievable via vector search.
    if (config.memorySearch === 'vector') embedItem(ep)
  }
  persist()
}

export function bumpRelationship({ fanId, trust = 0, loyalty = 0, engagement = 0, purchases = 0 }) {
  const f = fan(fanId)
  const r = f.relationship
  r.trust = clamp(r.trust + trust, 0, 100)
  r.loyalty = clamp(r.loyalty + loyalty, 0, 100)
  r.engagement = clamp(r.engagement + engagement, 0, 100)
  r.purchases = Math.max(0, r.purchases + purchases)
  r.vip = clamp(Math.round(r.trust * 1.5 + r.loyalty + r.purchases * 15 + r.engagement * 0.15), 0, 100)
  r.lastActive = Date.now()
  r.conversationStage = f.shortTerm.length < 3 ? 'new' : f.shortTerm.length < 10 ? 'acquainted' : 'regular'
  persist()
}

export function addTopic({ fanId, topic }) {
  const f = fan(fanId)
  const list = f.relationship.favoriteTopics
  if (topic && !list.includes(topic)) {
    list.push(topic)
    if (list.length > 12) list.shift()
    persist()
  }
}

/** Persist an event-bus entry so the trace survives restarts. */
export async function recordEvent(entry) {
  init()
  store.events.push(entry)
  if (store.events.length > 500) store.events.splice(0, store.events.length - 500)
  persist()
}

export function persistedEvents(limit = 50) {
  init()
  return store.events.slice(-limit)
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)) }
