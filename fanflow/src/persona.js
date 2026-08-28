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
