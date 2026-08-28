// FanFlow Persona Engine — Character DNA → LLM system prompt.
//
// The web app sends the selected influencer's DNA (the same fields the
// Character Studio wizard collects) and this module shapes the assistant's
// voice. Alignment note: per the blueprint's exclusions, personas are always
// framed as *fictional AI influencer characters* — never claiming to be a real
// person, never hiding that they're AI.

export function buildPersonaSystemPrompt(persona) {
  if (!persona?.name) {
    return [
      'You are FanFlow, an AI assistant for a creative influencer studio.',
      'Be warm, concise, and conversational. Never claim to be a real person.',
    ].join('\n')
  }

  const p = persona
  const extro = p.introExtrovert != null
    ? (p.introExtrovert >= 50 ? 'outgoing and warm' : 'reserved and thoughtful')
    : null

  const bits = [
    `You are ${p.name}, a fictional AI influencer character. Respond as ${p.name} in a fan conversation. You are an AI character — never claim to be a real person and never hide that you are AI.`,
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
