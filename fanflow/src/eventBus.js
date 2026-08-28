// FanFlow Event Bus — in-process pub/sub with a rolling, inspectable event log.
//
// The blueprint's bus: MessageReceived → MemoryUpdated → RelationshipUpdated →
// MediaRequested → MediaGenerated → AnalyticsUpdated. Everything that happens
// in the workflow emits here; the web app polls GET /api/events to render the
// live trace. Connectors can subscribe with on() for push behavior.
//
// Events are also persisted to the memory store so the log survives restarts.

import { recordEvent } from './memory.js'

const listeners = new Map()
const log = []
let seq = 0

/** Subscribe to an event name (or '*' for everything). Returns an unsubscribe fn. */
export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(fn)
  return () => listeners.get(event)?.delete(fn)
}

/** Emit an event to subscribers + the rolling log. Returns the entry. */
export function emit(event, data = {}) {
  seq++
  const entry = { seq, t: Date.now(), name: event, data }
  log.push(entry)
  if (log.length > 200) log.shift()
  for (const fn of listeners.get(event) || []) {
    try { fn(entry) } catch (e) { console.error('[fanflow] event listener error:', e) }
  }
  for (const fn of listeners.get('*') || []) {
    try { fn(entry) } catch (e) { console.error('[fanflow] event listener error:', e) }
  }
  // Persist (best-effort, async, never throws)
  recordEvent(entry).catch(() => {})
  return entry
}

/** Most recent events, oldest-first, capped at `limit`. */
export function getEvents(limit = 50) {
  return log.slice(-Math.min(limit, 200))
}
