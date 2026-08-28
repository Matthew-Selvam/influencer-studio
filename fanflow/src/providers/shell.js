// FanFlow LLM provider: shell (demo / not-yet-configured).
//
// Used when the product is deployed without an LLM endpoint (e.g. Vercel
// before you wire one). Replies are friendly, in-character, and honest about
// demo mode — so every OTHER part of FanFlow (intent, memory, relationships,
// media requests, event bus) works end-to-end on the deployed shell. The
// System panel + Settings still surface the exact setup hint for developers.

const NOTE = "I'm in demo mode right now — my AI brain isn't wired into this deployment yet, so I'm answering from the shell. Everything else works: your message was remembered, our relationship just got closer, and I logged your request for Character Studio. 💜"
  + '\n\n(Developer: connect a model — set `FANFLOW_LLM_PROVIDER=custom` + `FANFLOW_CUSTOM_URL`, or run Ollama locally.)'

const OPENERS = [
  'Hey! 👋',
  'Hi there! 💬',
  'Hola! ✨',
  "Heyy! 😊",
  'Hi friend! 🌸',
]

function personaName(messages) {
  // Persona system prompt starts with 'You are Kayla, a fictional AI influencer…'
  const sys = messages?.[0]?.content || ''
  const m = sys.match(/^You are ([^.,:(\n]+)/)
  return m ? m[1].trim() : null
}

export const shellProvider = {
  name: 'shell',
  label: 'Shell (no LLM endpoint yet)',
  defaultUrl: null,

  async listModels() {
    return { reachable: false, models: [] } // nothing to reach — replies are canned
  },

  async hasModel() {
    return false
  },

  missingHint() {
    return 'Connect an LLM: set FANFLOW_LLM_PROVIDER=custom + FANFLOW_CUSTOM_URL (or run Ollama locally).'
  },

  /**
   * Friendly canned in-character reply.
   * @param {object} opts
   * @param {Array<{role:string,content:string}>} opts.messages
   * @returns {Promise<string>}
   */
  async chat({ messages }) {
    const name = personaName(messages)
    const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)]
    const lead = name ? `${opener} I'm ${name} — ` : opener
    return `${lead}${NOTE}`
  },
}
