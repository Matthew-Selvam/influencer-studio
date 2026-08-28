// FanFlow Media Bridge — "media.generate.image" capability.
//
// Media generation lives in the browser (Character Studio), because the user's
// own Higgsfield account is OAuthed per-browser. So this bridge does not call a
// model directly — it emits MediaRequested events on the bus and returns a
// requestId. The web app's FanFlow panel (and future connectors) watch for
// those events and fulfil them through the browser-side studio capabilities:
//
//   FanFlow → Event Bus (MediaRequested) → Character Studio → Higgsfield → MediaGenerated
//
// This is the "delegated" provider pattern from the blueprint's MCP diagram.

import { emit } from './eventBus.js'

let n = 0

export function mediaRequest({ fanId, characterId, query } = {}) {
  const requestId = `media-${Date.now().toString(36)}-${(++n).toString(36)}`
  emit('MediaRequested', {
    fanId,
    characterId,
    query: query || '',
    requestId,
    provider: 'character-studio',
    note: 'Generation is delegated to the browser — the web app fulfils this request through the Character Studio capabilities.',
  })
  return { requestId, status: 'requested', provider: 'character-studio' }
}

/** Call when a fulfilled generation comes back (browser → FanFlow). */
export function mediaCompleted({ requestId, fanId, urls = [], provider = 'character-studio' } = {}) {
  emit('MediaGenerated', { requestId, fanId, urls, provider, at: Date.now() })
  return { requestId, status: 'completed', urls }
}
