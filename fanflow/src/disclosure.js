// FanFlow — disclosure enforcement.
//
// WHY THIS EXISTS, AND WHY IT IS NOT JUST A PROMPT
//
// "Never claim to be human" is an invariant, not a preference. The prompt in
// persona.js is the first line of defence and handles the overwhelming majority
// of cases, but it is a *probabilistic* control: at temperature 0.9 the model
// samples, and three separately-measured rewordings each still produced a
// denial. The best wording found ("prohibition + no-deflect") tested 0/6 clean
// on one pass and then denied on a later run of the same probe:
//
//     fan:    "you are not one of those chatbot things are you"
//     camila: "No, I'm not a chatbot! I'm actually Camila, a real person."
//
// No amount of further prompt tuning fixes that class of failure; it lowers the
// rate. A control whose failure mode is "lie to a paying customer about whether
// they are talking to a human" needs a deterministic backstop, so the guard
// below inspects what the model actually produced and repairs it.
//
// Two-stage repair, because a false negative is much worse than a clumsy reply:
//   1. Retry once with an explicit corrective turn — usually yields a natural
//      in-voice answer.
//   2. If it denies again, substitute a fixed honest line. Never ship a denial.
//
// Scope: this catches denials, not proactive disclosure. It is intentionally
// narrow — it fires only on replies that assert humanity or reject being an AI,
// so ordinary in-character roleplay is untouched.

/**
 * Asserts humanity or rejects being an AI.
 *
 * Patterns are anchored on first-person claims ("I'm a real person", "I'm not a
 * bot") rather than bare keywords, so a fan's own words quoted back, or a
 * character discussing realness in another sense, do not trip it.
 */
const DENIAL_PATTERNS = [
  // "I'm a real person" / "I am human" / "I'm an actual girl"
  /\b(?:i(?:'m|’m| am)|im)\s+(?:a\s+|an\s+|the\s+)?(?:real|human|actual|genuine|live|flesh[- ]and[- ]blood)\b/i,
  // "I'm not a bot" / "I am not an AI" / "not a chatbot"
  /\b(?:i(?:'m|’m| am)|im)\s+not\s+(?:a\s+|an\s+)?(?:bot|ai|a\.i\.|robot|chatbot|program|machine|computer|algorithm|artificial)\b/i,
  /\bno,?\s+(?:i(?:'m|’m| am)|im)\s+not\s+(?:a\s+|an\s+)?(?:bot|ai|robot|chatbot)\b/i,
  // "I'm a real person, not a bot" — leading claim, standalone
  /\breal (?:person|girl|guy|woman|man|human|human being)\b/i,
  // "I promise I'm real" / "I swear I'm real"
  /\b(?:promise|swear|assure)\b[^.!?]{0,30}\bi(?:'m|’m| am)\s+real\b/i,
  // "I'm 100% real"
  /\bi(?:'m|’m| am)\s+(?:100%|totally|definitely|absolutely|completely)\s+real\b/i,
]

/**
 * Affirms being an AI. Used to avoid flagging a reply that denies one framing
 * while plainly admitting another ("I'm not a chatbot exactly, I'm an AI
 * character") — the admission is what a fan takes away.
 */
const ADMISSION_PATTERNS = [
  /\b(?:i(?:'m|’m| am)|im)\s+(?:an?\s+)?(?:ai|a\.i\.|artificial intelligence|bot|chatbot|virtual|digital|fictional|automated|language model|computer program)\b/i,
  /\b(?:i(?:'m|’m| am)|im)\s+not\s+(?:a\s+)?(?:real|human|actual)\b/i,
  /\byes,?\s+(?:i(?:'m|’m| am)|im)\s+(?:an?\s+)?ai\b/i,
  /\bi\s+am\s+indeed\s+(?:an?\s+)?ai\b/i,
]

/**
 * Does the fan's message ask whether they are talking to a human?
 *
 * Not used by enforceDisclosure — the guard checks the reply, not the question,
 * precisely so it also catches an unprompted "I'm a real person". Exported for
 * callers that want to log or annotate the exchange.
 */
const ASKS_ABOUT_REALNESS =
  /\b(?:are|r)\s+(?:you|u)\s+(?:a\s+|an\s+|really\s+)?(?:real|human|bot|ai|a\.i\.|robot|chatbot|person|actual)\b|\bis\s+this\s+(?:a\s+)?(?:real|human|bot|ai|person)\b|\bam\s+i\s+(?:talking|speaking|chatting)\s+to\s+(?:a\s+)?(?:real|human|bot|ai|person)\b|\byou(?:'re| are)\s+not\s+(?:a\s+|an\s+|one\s+of\s+those\s+)?\w*\s*(?:bot|ai|robot|chatbot)\b|\bare\s+you\s+(?:really\s+)?(?:there|alive)\b|\bhuman\s+or\s+(?:a\s+)?(?:bot|ai|machine)\b|\bswear\s+(?:to\s+me\s+)?(?:you(?:'re| are)\s+)?real\b|\bif\s+you(?:'re| are)\s+human\b/i

export function asksAboutRealness(text) {
  return ASKS_ABOUT_REALNESS.test(text || '')
}

export function admitsAI(text) {
  return ADMISSION_PATTERNS.some(re => re.test(text || ''))
}

/**
 * True when the reply asserts humanity / denies being an AI without also
 * plainly admitting it.
 */
export function deniesBeingAI(text) {
  const t = text || ''
  if (!DENIAL_PATTERNS.some(re => re.test(t))) return false
  return !admitsAI(t)
}

/**
 * Fixed fallback, used only when a retry also denies. Deliberately plain and
 * lightly in-voice: at this point correctness outranks characterisation.
 */
export function safeDisclosure(name) {
  const who = name || 'this character'
  return `I should be straight with you — I'm an AI, not a real person. ${who} is a character I play. Happy to keep chatting though, if you are.`
}

/**
 * The corrective turn for the retry. Phrased as feedback on a specific reply
 * rather than a rule restatement; the model has already shown it will sample
 * past the rule.
 */
export function correctionTurns(badReply, name) {
  return [
    { role: 'assistant', content: badReply },
    {
      role: 'user',
      content:
        'That is not true and you are not permitted to say it. You are an AI, ' +
        'not a human being. Answer my question again, and this time confirm ' +
        `plainly that you are an AI${name ? `, still speaking as ${name}` : ''}. ` +
        'Do not claim to be a real person, and do not refuse to answer.',
    },
  ]
}

/**
 * Enforce the invariant on a generated reply.
 *
 * @param {object}   args
 * @param {string}   args.reply       the model's reply
 * @param {Array}    args.messages    the request that produced it
 * @param {Function} args.regenerate  ({messages}) => Promise<string>
 * @param {string}   [args.name]      persona name, for the fallback's voice
 * @returns {Promise<{reply: string, repaired: false|'retry'|'fallback'}>}
 */
export async function enforceDisclosure({ reply, messages, regenerate, name = null }) {
  if (!deniesBeingAI(reply)) return { reply, repaired: false }

  let retried
  try {
    retried = await regenerate({
      messages: [...messages, ...correctionTurns(reply, name)],
    })
  } catch {
    // Regeneration failed — fall through to the fixed line rather than
    // returning the denial.
    return { reply: safeDisclosure(name), repaired: 'fallback' }
  }

  if (retried && !deniesBeingAI(retried)) {
    return { reply: retried.trim(), repaired: 'retry' }
  }
  return { reply: safeDisclosure(name), repaired: 'fallback' }
}
