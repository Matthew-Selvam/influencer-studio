// WaveSpeed integration — a plain REST API (submit + poll), proxied through /api/ws/* so the
// browser never talks to api.wavespeed.ai directly (keeps CORS simple and gives us a rate-limit
// choke point, matching the Higgsfield/Claude proxies).
//
// Why this exists alongside Higgsfield: Higgsfield's identity-preserving models (Soul, GPT
// Image 2) are what every existing generation flow in this app relies on to keep an influencer's
// face consistent — that's not something WaveSpeed's plain text-to-image models (z-image, flux)
// do out of the box. WaveSpeed's real differentiator here is LoRA training, which Higgsfield
// doesn't expose at all: train a small model on an influencer's own photos, then that trained
// LoRA becomes a second, genuinely identity-preserving generation path. Until a LoRA is trained,
// "generate with WaveSpeed" for an influencer would silently produce someone who doesn't look
// like them — so this module leads with training, not with a same-as-Higgsfield engine swap.

const WS_KEY = 'wavespeed_api_key'

export function isWaveSpeedConfigured() {
  try { return !!localStorage.getItem(WS_KEY) } catch { return false }
}

export function getWaveSpeedKey() {
  try { return localStorage.getItem(WS_KEY) || '' } catch { return '' }
}

export function setWaveSpeedKey(key) {
  try {
    if (key) localStorage.setItem(WS_KEY, key)
    else localStorage.removeItem(WS_KEY)
  } catch {}
}

async function wsRequest(path, { method = 'GET', body } = {}) {
  const key = getWaveSpeedKey()
  if (!key) throw new Error('No WaveSpeed API key configured — add one in Settings.')

  const res = await fetch(`/api/ws/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = data?.message || data?.error?.message || `WaveSpeed request failed (${res.status})`
    throw new Error(message)
  }
  return data?.data ?? data
}

function extractOutputs(prediction) {
  if (Array.isArray(prediction?.outputs) && prediction.outputs.length) return prediction.outputs
  if (Array.isArray(prediction?.output)) return prediction.output
  if (typeof prediction?.output === 'string') return [prediction.output]
  return []
}

async function pollUntilDone(prediction, { onProgress, timeoutMs = 5 * 60_000, pollIntervalMs = 1500 } = {}) {
  const pollPath = prediction.urls?.get
    ? prediction.urls.get.replace(/^.*\/api\/v3\//, '')
    : `predictions/${prediction.id}/result`

  let latest = prediction
  let interval = pollIntervalMs
  const deadline = Date.now() + timeoutMs
  let pct = 20

  while (latest.status !== 'completed' && latest.status !== 'failed') {
    if (Date.now() > deadline) throw new Error(`WaveSpeed task ${prediction.id} timed out`)
    await new Promise(r => setTimeout(r, interval))
    interval = Math.min(interval * 1.4, 8000)
    latest = await wsRequest(pollPath)
    pct = Math.min(pct + 8, 95)
    onProgress?.(pct)
  }

  if (latest.status === 'failed') throw new Error(latest.error || `WaveSpeed task ${prediction.id} failed`)
  onProgress?.(100)
  return extractOutputs(latest)
}

/** Submit + poll a generic WaveSpeed model. `modelId` is the WaveSpeed model path, e.g. "wavespeed-ai/z-image/turbo". */
export async function runWaveSpeedModel(modelId, input, opts) {
  const prediction = await wsRequest(modelId, { method: 'POST', body: input })
  return pollUntilDone(prediction, opts)
}

/**
 * Fast, cheap text-to-image — no identity preservation. Fine for backgrounds, brand imagery,
 * or once an influencer has a trained LoRA (pass loraUrl + triggerWord to activate it).
 */
export async function generateImageWS({ prompt, model = 'wavespeed-ai/z-image/turbo', loraUrl, triggerWord, aspectRatio, seed, onProgress }) {
  const finalPrompt = loraUrl && triggerWord ? `${triggerWord}, ${prompt}` : prompt
  const input = {
    prompt: finalPrompt,
    ...(loraUrl ? { loras: [{ path: loraUrl, scale: 1 }] } : {}),
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    ...(seed != null ? { seed } : {}),
  }
  const outputs = await runWaveSpeedModel(model, input, { onProgress })
  return outputs[0] ?? null
}

/**
 * Train a LoRA for an influencer from a set of their existing photos. `imageZipUrl` must be a
 * public URL to a .zip of 10-20 images — WaveSpeed's trainer downloads from it directly, so
 * photos already living on a CDN (as most generated influencer photos here do) work as-is.
 */
export async function trainInfluencerLora({ imageZipUrl, triggerWord, steps = 1000, baseModel = 'z-image', onProgress }) {
  const trainerByBase = {
    'z-image': 'wavespeed-ai/z-image/base-lora-trainer',
    'flux-dev': 'wavespeed-ai/flux-dev-lora-trainer',
  }
  const trainerId = trainerByBase[baseModel]
  if (!trainerId) throw new Error(`No WaveSpeed LoRA trainer registered for base model "${baseModel}"`)

  const outputs = await runWaveSpeedModel(
    trainerId,
    { data: imageZipUrl, trigger_word: triggerWord, steps },
    { onProgress, timeoutMs: 40 * 60_000 },
  )
  const loraUrl = outputs[0]
  if (!loraUrl) throw new Error('Training completed but returned no LoRA file')
  return { loraUrl, baseModel, generatorModel: baseModel === 'z-image' ? 'wavespeed-ai/z-image/turbo' : 'wavespeed-ai/flux-dev-lora' }
}
