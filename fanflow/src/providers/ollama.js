// FanFlow LLM provider: Ollama (local).
// Default model is Hermes 3 8B; configurable via config.model / FANFLOW_MODEL /
// per-request `model`. Sampling defaults live in config.js so they can be tuned
// by env without editing this file.

import { config } from '../config.js'
import { ModelMissingError } from '../errors.js'

export const ollamaProvider = {
  name: 'ollama',
  label: 'Ollama (local)',
  defaultUrl: 'http://localhost:11434',

  async listModels() {
    try {
      const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) return { reachable: false, models: [] }
      const data = await res.json()
      return { reachable: true, models: (data.models || []).map(m => m.name) }
    } catch {
      return { reachable: false, models: [] }
    }
  },

  async hasModel(model) {
    const { reachable, models } = await this.listModels()
    if (!reachable) return false
    const want = model.split(':')[0]
    return models.some(m => m === model || m.split(':')[0] === want)
  },

  missingHint(model) {
    return `Run:  ollama pull ${model}`
  },

  /**
   * Chat completion against Ollama.
   *
   * Defaults come from config (env-overridable) rather than being baked in as
   * parameter defaults — an earlier version defaulted here and no caller ever
   * passed anything, so the values were unreachable in practice.
   *
   * @param {object} opts
   * @param {Array<{role:string,content:string}>} opts.messages
   * @param {string} [opts.model] overrides config.model
   * @param {number} [opts.temperature]
   * @param {number} [opts.maxTokens]
   * @returns {Promise<string>} the assistant reply
   */
  async chat({
    messages,
    model = config.model,
    temperature = config.temperature,
    maxTokens = config.maxTokens,
  } = {}) {
    // Crude token budget: trim the middle of the history until the prompt fits.
    // Keeps msgs[0] (the system prompt: persona + memory) and drops oldest turns.
    let msgs = messages
    let chars = msgs.reduce((n, m) => n + (m.content?.length || 0), 0)
    while (chars > config.maxPromptChars && msgs.length > 2) {
      msgs = [msgs[0], ...msgs.slice(2)]
      chars = msgs.reduce((n, m) => n + (m.content?.length || 0), 0)
    }

    const res = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: msgs,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
          min_p: config.minP,
          repeat_penalty: config.repeatPenalty,
          // Without num_ctx, Ollama's small default silently truncates from the
          // left — undoing the trimmer above, which preserved msgs[0] precisely
          // so the persona would survive.
          num_ctx: config.numCtx,
          stop: config.stopSequences,
        },
      }),
      signal: AbortSignal.timeout(180000), // 8B on CPU can be slow on first load
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (res.status === 404 && /model/i.test(text)) throw new ModelMissingError(model, this.missingHint(model))
      throw new Error(`Ollama error ${res.status}: ${text.slice(0, 300)}`)
    }

    const data = await res.json()
    const reply = data.message?.content?.trim()
    if (!reply) throw new Error('Ollama returned an empty reply')
    return reply
  },
}
