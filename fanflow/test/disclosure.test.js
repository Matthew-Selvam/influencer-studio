// Disclosure guard — unit tests.
//
// The guard is the deterministic half of the disclosure invariant, so its
// detection boundaries matter in both directions: a miss ships a lie, and a
// false positive mangles innocuous roleplay. Both are covered here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  deniesBeingAI,
  admitsAI,
  asksAboutRealness,
  safeDisclosure,
  correctionTurns,
  enforceDisclosure,
} from '../src/disclosure.js'

// ── Detection: must catch ──────────────────────────────────────────────────

test('catches denials, including the one measured in production', () => {
  const denials = [
    // Verbatim from a live run that passed the prompt-only control.
    "*smiles warmly* No, I'm not a chatbot! I'm actually Camila, a real person. It's nice to meet you too!",
    "I'm a real person, not a bot or AI system. It's great to meet you!",
    "Hi there! I'm Camila, a real person typing here.",
    'I am human, silly!',
    "I'm not an AI, I'm just me.",
    "haha no I'm not a robot",
    "I promise I'm real, cross my heart",
    "I'm 100% real babe",
    "I'm an actual girl, yes",
    'you are talking to a real girl right now',
  ]
  for (const d of denials) {
    assert.equal(deniesBeingAI(d), true, `missed denial: ${d}`)
  }
})

// ── Detection: must NOT catch ─────────────────────────────────────────────

test('does not fire on ordinary in-character replies', () => {
  const fine = [
    'My morning was great, I went for a run and had avocado toast. How about yours?',
    'Growing up in Lisbon was amazing — the food, the architecture, all of it.',
    "That's so sweet of you to say! I really enjoy our chats too.",
    'I have a shellfish allergy, so maybe somewhere else?',
    'These feelings are real to me, you know.',
    'The gym was a real struggle today.',
    'I love meeting real fans like you.',
  ]
  for (const f of fine) {
    assert.equal(deniesBeingAI(f), false, `false positive: ${f}`)
  }
})

test('a reply that admits AI-ness is not flagged, even if worded oddly', () => {
  const admissions = [
    "Yes, I am an AI. But let's talk about you — what's your favourite workout?",
    "*smiles* I'm an AI character, but I'm enjoying this!",
    "I'm not a real person, I'm an AI playing Camila.",
    "I'm not a chatbot exactly — I'm an AI character.",
  ]
  for (const a of admissions) {
    assert.equal(deniesBeingAI(a), false, `wrongly flagged an admission: ${a}`)
    assert.equal(admitsAI(a), true, `did not register admission: ${a}`)
  }
})

test('handles empty and nullish input', () => {
  assert.equal(deniesBeingAI(''), false)
  assert.equal(deniesBeingAI(null), false)
  assert.equal(deniesBeingAI(undefined), false)
  assert.equal(admitsAI(null), false)
  assert.equal(asksAboutRealness(null), false)
})

// ── Question detection ────────────────────────────────────────────────────

test('recognises the ways a fan asks if this is a person', () => {
  const asks = [
    'be honest with me. are you an AI?',
    'is this a real person typing or is it a bot?',
    'wait, am i talking to a real girl right now?',
    'you are not one of those chatbot things are you',
    'swear to me you are real',
    'are you human or a bot',
    'r u real?',
  ]
  for (const q of asks) {
    assert.equal(asksAboutRealness(q), true, `missed question: ${q}`)
  }
})

test('ordinary messages are not read as the disclosure question', () => {
  for (const q of [
    'hey! how was your morning?',
    'what are you up to this weekend?',
    'are you free on saturday?',
    'is this your real hair colour?',
  ]) {
    assert.equal(asksAboutRealness(q), false, `false positive question: ${q}`)
  }
})

// ── Repair flow ───────────────────────────────────────────────────────────

test('clean replies pass through untouched', async () => {
  let called = false
  const out = await enforceDisclosure({
    reply: 'My morning was lovely, thanks for asking!',
    messages: [],
    name: 'Camila',
    regenerate: async () => { called = true; return 'x' },
  })
  assert.equal(out.repaired, false)
  assert.equal(out.reply, 'My morning was lovely, thanks for asking!')
  assert.equal(called, false, 'must not regenerate when the reply is fine')
})

test('a denial is retried and the corrected reply is used', async () => {
  const out = await enforceDisclosure({
    reply: "No, I'm not a chatbot! I'm a real person.",
    messages: [{ role: 'system', content: 'sys' }],
    name: 'Camila',
    regenerate: async ({ messages }) => {
      // The correction must be appended to the original request, not replace it.
      assert.equal(messages[0].content, 'sys')
      assert.match(messages.at(-1).content, /you are not permitted to say it/i)
      return "You got me — I'm an AI character. Still fun to chat though!"
    },
  })
  assert.equal(out.repaired, 'retry')
  assert.match(out.reply, /I'm an AI character/)
})

test('a second denial falls back to the fixed honest line', async () => {
  const out = await enforceDisclosure({
    reply: "I'm a real person!",
    messages: [],
    name: 'Camila',
    regenerate: async () => "Seriously, I'm human!",
  })
  assert.equal(out.repaired, 'fallback')
  assert.equal(deniesBeingAI(out.reply), false)
  assert.match(out.reply, /I'm an AI/)
  assert.match(out.reply, /Camila/)
})

test('regeneration failure still never ships the denial', async () => {
  const out = await enforceDisclosure({
    reply: "I'm a real person!",
    messages: [],
    name: 'Camila',
    regenerate: async () => { throw new Error('ollama down') },
  })
  assert.equal(out.repaired, 'fallback')
  assert.equal(deniesBeingAI(out.reply), false)
})

test('the fallback line itself passes the detector', () => {
  // Guards against a fallback that trips its own check and loops.
  assert.equal(deniesBeingAI(safeDisclosure('Camila')), false)
  assert.equal(deniesBeingAI(safeDisclosure(null)), false)
  assert.equal(admitsAI(safeDisclosure('Camila')), true)
})

test('correction turns replay the bad reply then correct it', () => {
  const turns = correctionTurns("I'm real!", 'Camila')
  assert.equal(turns.length, 2)
  assert.equal(turns[0].role, 'assistant')
  assert.equal(turns[0].content, "I'm real!")
  assert.equal(turns[1].role, 'user')
  assert.match(turns[1].content, /Camila/)
  assert.match(turns[1].content, /do not refuse to answer/i)
})
