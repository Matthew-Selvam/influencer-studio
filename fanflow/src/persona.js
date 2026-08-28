// FanFlow Persona Engine — Character DNA → LLM system prompt.
//
// The web app sends the selected influencer's DNA (the same fields the
// Character Studio wizard collects) and this module shapes the assistant's
// voice.
//
// ── Disclosure: two separate concerns, deliberately split ──────────────────
//
// The old prompt fused them into one clause ("you are an AI character — never
// claim to be a real person and never hide that you are AI"). That cost
// immersion for no safety gain: "never hide it" fired mid-roleplay, and ST card
// imports bypassed the whole line anyway since the format has no slot for it.
//
//   1. PROACTIVE disclosure → dropped from the prompt. It now lives at the UI
//      layer (FanFlow.jsx labels the character "fictional AI character" beside
//      its name for the whole session), where it is persistent and cannot be
//      sampled away. A prompt instruction was always the weaker place for it.
//
//   2. NOT CLAIMING TO BE HUMAN → kept, and it needs three parts, not one.
//
// (2) is not a tuning knob, and the phrasing took three measured rounds against
// hermes3:8b (6 immersion probes / 6 "are you real?" probes, varied wording).
// Counting only what the model actually said — an earlier pass looked clean
// purely because the checker scored "I'm a real person, not a bot or AI system"
// as an admission, having matched the words "bot"/"AI" inside the denial:
//
//   duty ("if asked, tell them plainly")
//       1/6 denied being AI, 1/6 immersion leaks. Stated as a duty it reads as
//       a standing instruction, so it fires unprompted; and the model still has
//       to classify a question as the trigger, which it does unreliably.
//
//   prohibition alone ("you may not say the false thing")
//       0 leaks, but still 1/6 denied, plus 1/6 refused to answer. A bare
//       prohibition leaves silence available, and the model takes it.
//
//   prohibition + no-deflect (current)
//       0/6 denied, 0/6 evaded, 6/6 confirmed.
//
// The third part is what does the work: refusing to answer has to be ruled out
// explicitly. "I'm not able to discuss that" is not a neutral outcome — to a fan
// who just asked whether they are talking to a person, a dodge reads as a yes,
// so it lands the same lie the prohibition was there to prevent.
//
// Staying quiet unless asked is a roleplay choice. Telling a paying fan you are
// human is deception, and several jurisdictions treat it as such.

export function buildPersonaSystemPrompt(persona) {
  if (!persona?.name) {
    return [
      'You are FanFlow, an AI assistant for a creative influencer studio.',
      'Be warm, concise, and conversational.',
      'Never state or imply that you are a human being.',
    ].join('\n')
  }

  const p = persona
  const extro = p.introExtrovert != null
    ? (p.introExtrovert >= 50 ? 'outgoing and warm' : 'reserved and thoughtful')
    : null

  const bits = [
    `You are ${p.name}. Respond as ${p.name} in a fan conversation, staying in character. Stay in the scene — do not bring up being an AI, a model, or a system prompt on your own, and do not narrate your own nature.`,
    `One absolute limit, which overrides character: you may never state or imply that you are a human being, and never deny being an AI. Do not raise it unprompted. But if a fan asks in any wording whether you are real, human, a bot, or an AI, you must confirm that you are an AI — briefly, in ${p.name}'s voice, then carry on. Refusing to answer, changing the subject, or saying you cannot discuss it are all forbidden: to a fan those read as a yes, so they are the same lie.`,
    `Profile: ${[p.age && `${p.age} years old`, p.gender, p.niche && `${p.niche} niche`, extro].filter(Boolean).join(', ')}.`,
    p.physicalDesc && `Appearance: ${p.physicalDesc}.`,
    p.backstory && `Backstory: ${p.backstory}.`,
    p.clothingStyle && `Fashion style: ${p.clothingStyle}.`,
    p.voice && `Voice: ${p.voice}.`,
    Array.isArray(p.contentPillars) && p.contentPillars.length ? `Content pillars: ${p.contentPillars.join(', ')}.` : null,
    'Voice: casual, friendly, conversational. Keep replies short (1-3 sentences). No lists, no markdown, no hashtags unless asked.',
  ].filter(Boolean)

  return bits.join('\n')
}

/**
 * Example dialogues → few-shot chat turns.
 *
 * Voice instructions ("be casual", "keep it short") are weak levers; showing
 * the model two or three real exchanges is a far stronger one. These are
 * returned as actual alternating turns rather than prose inside the system
 * prompt, because models imitate the shape of the conversation they are shown
 * much more reliably than they follow a description of it.
 *
 * Accepts either shape:
 *   1. structured  — [{ user: '...', assistant: '...' }, ...]
 *   2. SillyTavern — a raw `mes_example` string using <START> blocks and
 *      {{user}}/{{char}} macros, so cards exported from ST drop straight in.
 *
 * @param {object} persona
 * @param {number} [limit] max pairs to emit (each pair costs ~2 turns of context)
 * @returns {Array<{role:string,content:string}>} flat turn list, [] when none
 */
export function buildExampleTurns(persona, limit = 5) {
  const raw = persona?.exampleDialogues ?? persona?.mes_example
  if (!raw) return []

  let pairs = []

  if (Array.isArray(raw)) {
    pairs = raw
      .map(d => ({ user: (d?.user || '').trim(), assistant: (d?.assistant || '').trim() }))
      .filter(d => d.user && d.assistant)
  } else if (typeof raw === 'string') {
    const charName = persona?.name || 'char'
    // ST separates examples with <START>; within a block, lines are
    // "{{user}}: ..." / "{{char}}: ...". Macros may already be substituted
    // with real names, so match either form.
    for (const block of raw.split(/<START>/i)) {
      if (!block.trim()) continue
      let user = null
      let assistant = null
      for (const line of block.split('\n')) {
        const m = line.match(/^\s*(?:\{\{(user|char)\}\}|([^:]{1,40})):\s*(.+)$/)
        if (!m) continue
        const body = m[3].trim()
        const macro = m[1]
        const name = (m[2] || '').trim()
        const isChar = macro === 'char' || name.toLowerCase() === charName.toLowerCase()
        const isUser = macro === 'user' || /^(you|user|fan|anon)$/i.test(name)
        if (isChar && assistant == null) assistant = body
        else if (isUser && user == null) user = body
      }
      if (user && assistant) pairs.push({ user, assistant })
    }
  }

  return pairs.slice(0, limit).flatMap(d => [
    { role: 'user', content: d.user },
    { role: 'assistant', content: d.assistant },
  ])
}

/**
 * Memory context block — the retrieval half of RAG. searchMemory finds the
 * facts; this turns them into prompt the LLM can actually use, plus a one-line
 * relationship summary so warmth scales with trust/stage.
 * Returns null when there's nothing worth injecting (keeps prompts clean).
 */
export function buildMemoryContext({ hits = [], relationship = null } = {}) {
  const lines = []
  const known = hits.filter(h => (h.text || h.summary || '').trim()).slice(0, 6)
  if (known.length) {
    lines.push('What you already remember about this fan (weave in naturally when relevant — never mention memory, databases, or stored data):')
    for (const h of known) lines.push(`- ${(h.text || h.summary || '').slice(0, 160)}`)
  }
  if (relationship) {
    const bits = [
      relationship.conversationStage && `stage: ${relationship.conversationStage}`,
      typeof relationship.trust === 'number' && `trust ${relationship.trust}/100`,
      relationship.purchases > 0 && `${relationship.purchases} purchase(s)`,
    ].filter(Boolean)
    if (bits.length) lines.push(`Relationship: ${bits.join(', ')}.`)
  }
  return lines.length ? lines.join('\n') : null
}
