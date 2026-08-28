// FanFlow Capability Registry — the blueprint's provider-abstraction map:
//
//   { "llm.chat": "ollama", "memory.search": "local", "media.generate.image": "character-studio" }
//
// Consumers ask for a *capability*, never a provider. Swapping Ollama for
// another LLM later is a one-entry change here (plus the provider module).

import { llmChat, listModels, hasModel, listProviders } from './llm.js'
import * as memory from './memory.js'
import { mediaRequest, mediaCompleted } from './mediaBridge.js'
import { classifyIntent } from './intent.js'
import { analyzeEmotion } from './emotion.js'
import { buildPersonaSystemPrompt } from './persona.js'
import { activeProvider } from './llm.js'

export const registry = {
  'llm.chat': activeProvider().label,
  'llm.list-models': activeProvider().label,
  'llm.has-model': activeProvider().label,
  'llm.providers': listProviders().map(p => p.label).join(', '),
  'memory.remember': 'local-json',
  'memory.search': 'local-json + embeddings (vector)',
  'memory.embed': 'ollama nomic-embed-text',
  'memory.recent': 'local-json',
  'memory.summary': 'local-json',
  'memory.stats': 'local-json',
  'intent.detect': 'heuristic (LLM later)',
  'emotion.analyze': 'heuristic (LLM later)',
  'persona.build': 'local',
  'analytics.style': 'local',
  'media.generate.image': 'character-studio (delegated → browser)',
  'media.request': 'local',
  'media.completed': 'local',
}

export async function run(capability, params = {}) {
  switch (capability) {
    case 'llm.chat': return llmChat(params)
    case 'llm.list-models': return listModels()
    case 'llm.has-model': return hasModel(params.model)
    case 'memory.remember': return memory.remember(params)
    case 'memory.search': return await memory.searchMemory(params)
    case 'memory.embed': return await memory.embedStatus()
    case 'memory.recent': return memory.recentMessages(params)
    case 'memory.summary': return memory.fanMemory(params.fanId)
    case 'memory.stats': return memory.stats()
    case 'intent.detect': return classifyIntent(params.message)
    case 'emotion.analyze': return analyzeEmotion(params.message)
    case 'persona.build': return buildPersonaSystemPrompt(params.persona)
    case 'media.request': return mediaRequest(params)
    case 'media.completed': return mediaCompleted(params)
    default: throw new Error(`Unknown capability: ${capability}`)
  }
}
