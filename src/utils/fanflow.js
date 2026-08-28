// FanFlow client — talks to the FanFlow backend (AI + memory orchestration).
//
// Default target is the same-origin '/api/fanflow' — which is the deployed
// Vercel serverless function in production AND a vite dev proxy to the local
// server in development (see vite.config.js). So the app works the same in
// both worlds with zero configuration. Power users can override with an
// absolute URL (e.g. http://localhost:8787) in Settings.
// Media generation is NOT here — it stays in the browser via Character Studio
// (src/studio), because Higgsfield is OAuthed per-browser.

const URL_KEY = 'fanflow_url'
const MODEL_KEY = 'fanflow_model'
const MODEL_MIGRATION_KEY = 'fanflow_model_migrated_v2'

// One-time migration: the per-browser model override is sent as `body.model`
// and WINS over the server default. Anyone who picked "llama3" in Settings
// before the Hermes 3 switch would keep pinning llama3 forever, silently
// undoing the new default and its sampling tune — with the UI still showing
// the server's model in the status pill. Clear the stale pin once so those
// browsers fall back to the server default; an explicit re-pick still sticks.
try {
  if (!localStorage.getItem(MODEL_MIGRATION_KEY)) {
    const pinned = localStorage.getItem(MODEL_KEY)
    if (pinned && pinned.startsWith('llama3')) localStorage.removeItem(MODEL_KEY)
    localStorage.setItem(MODEL_MIGRATION_KEY, '1')
  }
} catch { /* private mode / storage disabled — nothing to migrate */ }

export function getFanflowUrl() {
  const v = localStorage.getItem(URL_KEY)
  if (v) return v.replace(/\/+$/, '')
  // Same-origin by default: '/api/fanflow' → vercel.json rewrite → api/fanflow.js
  return ''
}
export function setFanflowUrl(url) {
  if (url?.trim()) localStorage.setItem(URL_KEY, url.trim())
  else localStorage.removeItem(URL_KEY)
}
export function getFanflowModel() {
  return localStorage.getItem(MODEL_KEY) || ''
}
export function setFanflowModel(model) {
  if (model?.trim()) localStorage.setItem(MODEL_KEY, model.trim())
  else localStorage.removeItem(MODEL_KEY)
}

function resolveBase() {
  const custom = getFanflowUrl()
  // Empty → same origin, path under /api/fanflow
  return custom ? custom : '/api/fanflow'
}

async function ff(path, { method = 'GET', body } = {}) {
  const base = resolveBase()
  let res
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(120000), // local 7B inference can be slow on first token
    })
  } catch {
    throw new Error(`FanFlow server not reachable at ${base || 'same-origin /api/fanflow'} — start it with:  node fanflow/src/server.js (or deploy FanFlow to Vercel)`)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `FanFlow error ${res.status}`)
  return data
}

export async function checkFanflow() { return ff('/health') }
export async function fanflowRegistry() { return ff('/registry') }
export async function fanflowEvents(limit = 30) { return (await ff(`/events?limit=${limit}`)).events }
export async function fanflowFans() { return (await ff('/fans')).fans }
export async function fanflowFanMemory(fanId) { return ff(`/memory/${encodeURIComponent(fanId)}`) }
export async function fanflowCreateFan(fanId, name) { return ff('/fan', { method: 'POST', body: { fanId, name } }) }

export async function fanflowChat({ fanId, characterId, message, persona, model }) {
  return ff('/chat', {
    method: 'POST',
    body: { fanId, characterId, message, persona, model: model || getFanflowModel() || undefined },
  })
}

/** Build the persona payload from an influencer's Character DNA. */
export function personaFromInfluencer(inf) {
  if (!inf) return null
  return {
    name: inf.name,
    gender: inf.gender,
    age: inf.age,
    niche: inf.niche,
    nicheCustom: inf.nicheCustom,
    backstory: inf.backstory,
    physicalDesc: inf.physicalDesc,
    clothingStyle: inf.clothingStyle,
    voice: inf.voice,
    introExtrovert: inf.introExtrovert,
    contentPillars: inf.contentPillars || [],
  }
}
