// FanFlow Workflow Engine — the blueprint's core loop:
//
//   Message → Intent → Memory → Generate → (media?) → Store Memory → Respond
//
// Every step emits on the event bus so the web app can render the live trace.
// The workflow is deliberately provider-agnostic: llm.chat goes through
// llm.js (Ollama today), memory.* through memory.js (local JSON today), and
// media requests are delegated to the browser's Character Studio.

import { emit } from './eventBus.js'
import { classifyIntent } from './intent.js'
import { analyzeEmotion } from './emotion.js'
import { buildPersonaSystemPrompt, buildMemoryContext } from './persona.js'
import { llmChat, ModelMissingError } from './llm.js'
import { mediaRequest } from './mediaBridge.js'
import * as memory from './memory.js'

const TOPIC_HINTS = {
  purchase: 'purchases & products',
  media: 'outfits & content',
}

export async function handleMessage({
  fanId = 'anon',
  characterId = 'default',
  message,
  persona = null,
  model = null,
} = {}) {
  const startedAt = Date.now()
  const text = (message || '').trim()
  if (!text) throw new Error('message is required')

  emit('MessageReceived', { fanId, characterId, message: text })

  // 1. Emotion + Intent
  const emotion = analyzeEmotion(text)
  const intent = classifyIntent(text)
  emit('EmotionDetected', { fanId, sentiment: emotion.sentiment, emotions: emotion.emotions, intensity: emotion.intensity })
  emit('IntentDetected', { fanId, intent })

  // 2. Memory retrieval (vector semantic + recent window)
  const memoryStart = Date.now()
  const memoryHits = await memory.searchMemory({ fanId, query: text, limit: 6 })
  const recent = memory.recentMessages({ fanId, limit: 8 })
  emit('MemoryRetrieved', { fanId, hits: memoryHits.length, recent: recent.length, searchTime: Date.now() - memoryStart })

  // 2b. Close the RAG loop — retrieved memories + relationship go INTO the
  // prompt. Without this, search results only decorated the trace and the LLM
  // was limited to the raw recent-message window.
  const fanRec = memory.fanMemory(fanId)
  const memoryContext = buildMemoryContext({ hits: memoryHits, relationship: fanRec?.relationship || null })

  // 3. Generate — persona + memory context + the new message
  const systemPrompt = [buildPersonaSystemPrompt(persona), memoryContext].filter(Boolean).join('\n\n')
  const messages = [
    { role: 'system', content: systemPrompt },
    ...recent.map(m => ({ role: m.role, content: m.text })),
    { role: 'user', content: text },
  ]

  const steps = []
  if (memoryContext) steps.push('memory:context')
  let reply
  try {
    reply = await llmChat({ messages, model })
    steps.push('llm:generate')
  } catch (e) {
    if (e instanceof ModelMissingError) {
      emit('ModelMissing', { fanId, model: e.model })
      reply = `(Model "${e.model}" isn't ready on this provider — ${e.hint} then send this again.)`
      steps.push(`llm:model-missing (${e.model})`)
    } else {
      throw e
    }
  }
  emit('ResponseGenerated', { fanId, reply })

  // 4. Store memory (conversation → short-term, rolls episodic summaries)
  memory.storeMessage({ fanId, role: 'user', text })
  memory.storeMessage({ fanId, role: 'assistant', text: reply })
  emit('MemoryUpdated', { fanId, kind: 'shortTerm' })

  // 4b. Semantic facts from strong intents
  if (intent === 'purchase') {
    memory.remember({ fanId, type: 'event', text: `Fan expressed interest in buying: "${text.slice(0, 140)}"`, tags: ['purchase'] })
  }
  const topic = TOPIC_HINTS[intent]
  if (topic) memory.addTopic({ fanId, topic })

  // 5. Relationship updates
  const bump = { engagement: 1 }
  if (intent === 'praise') bump.trust = 2
  if (intent === 'question') bump.trust = 1
  if (intent === 'purchase') { bump.trust = 1; bump.loyalty = 1; bump.purchases = 1 }
  memory.bumpRelationship({ fanId, ...bump })
  emit('RelationshipUpdated', { fanId, ...bump })

  // 6. Media intent → Character Studio (delegated to the browser)
  let media = null
  if (intent === 'media') {
    const req = mediaRequest({ fanId, characterId, query: text })
    media = { requested: true, requestId: req.requestId }
  }

  // 7. Analytics (style stats + response time + emotion on the reply)
  const style = styleStats(reply)
  const responseTime = Date.now() - startedAt
  const replyEmotion = analyzeEmotion(reply)
  emit('AnalyticsUpdated', { fanId, intent, style, emotion: replyEmotion, responseTime, memoryHitRate: memoryHits.length / Math.max(1, recent.length) })

  steps.push('memory:store', 'relationship:update')
  if (media) steps.push(`media:requested (${media.requestId})`)

  return {
    reply,
    intent,
    emotion,
    characterId,
    media,
    trace: {
      steps,
      memoryHits: memoryHits.map(h => ({ type: h.type, text: h.text, tags: h.tags || [], score: h.score ?? null })),
      recentCount: recent.length,
      style,
      analytics: { responseTime, memoryHitRate: memoryHits.length / Math.max(1, recent.length) },
    },
  }
}

function styleStats(text) {
  const sentences = (text.match(/[.!?…]+(\s|$)/g) || []).length || 1
  const words = (text.match(/\S+/g) || []).length
  const emojis = (text.match(/\p{Extended_Pictographic}/gu) || []).length
  return {
    sentences,
    words,
    emojis,
    avgWordsPerSentence: Math.round((words / sentences) * 10) / 10,
  }
}
