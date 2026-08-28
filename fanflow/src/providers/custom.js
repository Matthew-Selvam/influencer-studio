// FanFlow LLM provider: custom build (OpenAI-compatible).
//
// This is the drop-in slot for YOUR OWN lightweight model service. If your
// build exposes an OpenAI-compatible /v1/chat/completions endpoint, point
// FanFlow at it and it replaces Ollama:
//
//   FANFLOW_LLM_PROVIDER=custom \
//   FANFLOW_CUSTOM_URL=http://localhost:8000/v1 \
//   FANFLOW_CUSTOM_MODEL=my-model \
//   node fanflow/src/server.js
//
// Keeping it OpenAI-compatible means you can swap in anything — a llama.cpp
// server, vLLM, Ollama's own OpenAI shim, a fine-tuned build — without
// touching FanFlow again.

import { config } from '../config.js'
import { ModelMissingError } from '../errors.js'

export const customProvider = {
  name: 'custom',
  label: 'Custom build (OpenAI-compatible)',
  defaultUrl: 'http://localhost:8000/v1',

  get url() { return (config.customUrl || this.defaultUrl).replace(/\/+$/, '') },
  get model() { return config.customModel || 'custom-model' },

  async listModels() {
    try {
      const res = await fetch(`${this.url}/models`, {
        headers: config.customApiKey ? { Authorization: `Bearer ${config.customApiKey}` } : {},
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return { reachable: false, models: [] }
      const data = await res.json()
      return { reachable: true, models: (data.data || []).map(m => m.id) }
    } catch {
      return { reachable: false, models: [] }
    }
  },

  async hasModel(model) {
    const { reachable } = await this.listModels()
    return reachable // the endpoint decides availability at request time
  },

  missingHint(model) {
    return `Point FANFLOW_CUSTOM_URL at your running build (model "${model || this.model}").`
  },

  /**
   * Chat completion against an OpenAI-compatible /v1/chat/completions.
   * @param {object} opts
   * @param {Array<{role:string,content:string}>} opts.messages
   * @param {string} [opts.model] overrides config.customModel
   * @param {number} [opts.temperature]
   * @param {number} [opts.maxTokens]
   * @returns {Promise<string>} the assistant reply
   */
  async chat({
    messages,
    model,
    temperature = config.temperature,
    maxTokens = config.maxTokens,
  } = {}) {
    const useModel = model || this.model

    // Crude token budget (same policy as Ollama provider).
    let msgs = messages
    let chars = msgs.reduce((n, m) => n + (m.content?.length || 0), 0)
    while (chars > config.maxPromptChars && msgs.length > 2) {
      msgs = [msgs[0], ...msgs.slice(2)]
      chars = msgs.reduce((n, m) => n + (m.content?.length || 0), 0)
    }

    const res = await fetch(`${this.url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.customApiKey ? { Authorization: `Bearer ${config.customApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: useModel,
        messages: msgs,
        temperature,
        max_tokens: maxTokens,
        stop: config.stopSequences,
        stream: false,
        // Deliberately NOT sending min_p / repeat_penalty here. They are
        // llama.cpp/koboldcpp/vLLM extensions, not part of the OpenAI schema,
        // and strict endpoints (OpenAI itself) reject unknown keys with a 400.
        // If this provider is pointed at koboldcpp to get the full sampler set,
        // add them there behind an explicit opt-in flag.
      }),
      signal: AbortSignal.timeout(180000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (res.status === 404) throw new ModelMissingError(useModel, this.missingHint(useModel))
      throw new Error(`Custom provider error ${res.status}: ${text.slice(0, 300)}`)
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content?.trim()
    if (!reply) throw new Error('Custom provider returned an empty reply')
    return reply
  },
}
