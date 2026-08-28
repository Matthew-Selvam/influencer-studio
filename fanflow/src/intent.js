// FanFlow Intent Detection — fast, deterministic, zero-cost.
//
// v1 is a keyword/heuristic classifier (lightweight, no extra LLM round-trip).
// The registry entry "intent.detect": "heuristic" makes it swappable for an
// LLM-backed classifier later without touching the workflow.
//
// Intents: greeting | question | purchase | media | praise | chat

const RULES = [
  {
    intent: 'purchase',
    test: /\b(buy|purchase|order|price|cost|how much|shop|checkout|cart|billing|deal|discount)\b/i,
  },
  {
    intent: 'media',
    test: /\b(pic|pics|photo|photos|picture|image|images|video|videos|selfie|outfit|look|show me|send me|generate|make me|create me|new post|post a)\b/i,
  },
  {
    intent: 'praise',
    test: /\b(thanks|thank you|love (it|this|that|you)|awesome|amazing|great|cool|nice|sick|fire|cute|gorgeous|beautiful)\b/i,
  },
  {
    intent: 'greeting',
    test: /^(hi|hey|hello|yo|sup|hola|good (morning|afternoon|evening)|wassup|heyy)\b/i,
  },
  {
    intent: 'question',
    test: /\b(who|what|when|where|why|how|which|can you|could you|do you|are you|tell me|would you)\b|\?/i,
  },
]

export function classifyIntent(message) {
  const text = (message || '').trim()
  if (!text) return 'chat'
  for (const { intent, test } of RULES) {
    if (test.test(text)) return intent
  }
  return 'chat'
}
