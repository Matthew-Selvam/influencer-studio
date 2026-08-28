// FanFlow Telegram connector — the first plugin.
//
// Zero-dependency long-polling Telegram bot. It talks to the FanFlow server
// purely over its HTTP API (the plugin pattern from the blueprint), so it can
// run on a different machine than the server.
//
// Setup:
//   1. Talk to @BotFather on Telegram → /newbot → copy the token.
//   2. ollama pull llama3            (the model the bot replies with)
//   3. BOT_TOKEN=123:abc node fanflow/src/connectors/telegram.js
//
// Optional env:
//   FANFLOW_URL   default http://localhost:8787
//   PERSONA_NAME  the character the bot plays (default "FanFlow")
//
// The bot speaks as an AI character (per the blueprint's exclusions: never
// pretending to be human, never hiding that it's AI).

const BOT_TOKEN = process.env.BOT_TOKEN
const FANFLOW_URL = (process.env.FANFLOW_URL || 'http://localhost:8787').replace(/\/$/, '')
const PERSONA = {
  name: process.env.PERSONA_NAME || 'FanFlow',
  niche: 'content creator studio',
  voice: 'casual and friendly',
}

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN env var. Get one from @BotFather, then:')
  console.error('  BOT_TOKEN=123:abc node fanflow/src/connectors/telegram.js')
  process.exit(1)
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`

async function api(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || data?.ok === false) {
    throw new Error(`Telegram ${method} failed: ${data?.description || res.status}`)
  }
  return data.result
}

async function sendMessage(chatId, text) {
  await api('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true })
}

async function fanflowChat(chatId, text) {
  const res = await fetch(`${FANFLOW_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fanId: `tg:${chatId}`, message: text, persona: PERSONA }),
    signal: AbortSignal.timeout(120000),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `FanFlow error ${res.status}`)
  return data
}

async function main() {
  console.log(`[telegram] polling as bot ${BOT_TOKEN.slice(0, 12)}… → ${FANFLOW_URL}`)
  let offset = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let updates = []
    try {
      updates = await api('getUpdates', { offset, timeout: 30 })
    } catch (e) {
      console.error('[telegram] getUpdates error:', e.message)
      await new Promise(r => setTimeout(r, 3000))
      continue
    }
    for (const u of updates) {
      offset = Math.max(offset, u.update_id + 1)
      const msg = u.message
      if (!msg?.text) continue
      const chatId = msg.chat.id
      try {
        const { reply, intent } = await fanflowChat(chatId, msg.text)
        const tag = intent === 'chat' ? '' : `\n\n_[intent: ${intent}]_`
        await sendMessage(chatId, reply + tag)
      } catch (e) {
        console.error('[telegram] chat error:', e.message)
        try { await sendMessage(chatId, `Something went wrong: ${e.message}`) } catch (_) {}
      }
    }
  }
}

main().catch(e => { console.error('[telegram] fatal:', e); process.exit(1) })
