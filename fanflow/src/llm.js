// FanFlow "llm.chat" capability — provider router.
//
// The exported surface (llmChat / listModels / hasModel / ModelMissingError)
// is the stable API; the actual work is delegated to the active provider:
//
//   ollama  → providers/ollama.js  (default, blueprint's Llama 3 8B)
//   custom  → providers/custom.js  (OpenAI-compatible drop-in for your own build)
//
// Swap providers with one env var:  FANFLOW_LLM_PROVIDER=custom
// Adding a new provider = write providers/<name>.js with the same shape and
// register it below.

import { config } from './config.js'
import { ollamaProvider } from './providers/ollama.js'
import { customProvider } from './providers/custom.js'
import { shellProvider } from './providers/shell.js'
import { ModelMissingError } from './errors.js'

export { ModelMissingError }

const PROVIDERS = {
  ollama: ollamaProvider,
  custom: customProvider,
  shell: shellProvider,
}

/** The provider selected by FANFLOW_LLM_PROVIDER (defaults to ollama). */
export function activeProvider() {
  return PROVIDERS[config.llmProvider] || ollamaProvider
}

/** All registered providers (for the registry / system panel). */
export function listProviders() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label }))
}

/** Ollama-style model listing, delegated to the active provider. */
export async function listModels() {
  return activeProvider().listModels()
}

export async function hasModel(model) {
  return activeProvider().hasModel(model)
}

/** Chat completion, delegated to the active provider. */
export async function llmChat(opts) {
  return activeProvider().chat(opts)
}

/** The provider-appropriate default model name (llama3 for ollama, customModel for custom, shell for shell). */
export function defaultModel() {
  const p = activeProvider()
  if (p.name === 'custom') return config.customModel || 'custom-model'
  if (p.name === 'shell') return 'shell'
  return config.model
}
