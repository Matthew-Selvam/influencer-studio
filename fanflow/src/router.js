// FanFlow shared API router — ONE source of truth for every endpoint.
//
// Used by BOTH runtimes so behavior is identical:
//   • local dev      → fanflow/src/server.js (node:http wrapper)
//   • Vercel serverless → api/fanflow.js        (Web Request/Response wrapper)
//
// `handleApiRequest` is transport-agnostic: it takes parsed inputs and returns
// a plain { status, body }. Each wrapper is ~30 lines.

import { config } from './config.js'
import { getEvents, emit } from './eventBus.js'
import { registry, run } from './registry.js'
import { listModels, activeProvider, listProviders, defaultModel } from './llm.js'
import { handleMessage } from './workflow.js'
import * as memory from './memory.js'

/**
 * @param {object} r
 * @param {string} r.method   'GET' | 'POST' | ...
 * @param {string} r.pathname  e.g. '/api/chat' (both local + serverless use this form)
 * @param {URLSearchParams} [r.searchParams]
 * @param {object} [r.body]   parsed JSON body (POST)
 * @returns {Promise<{status:number, body:object}>}
 */
export async function handleApiRequest({ method, pathname, searchParams, body = {} }) {
  try {
    // Accept both '/api/health' and root-relative '/health' (the web client
    // calls root-relative; the local server historically used '/api/...').
    if (!pathname.startsWith('/api/')) pathname = '/api' + pathname
    if (method === 'GET' && pathname === '/api/health') {
      const provider = activeProvider()
      const models = await listModels()
      return {
        status: 200,
        body: {
          ok: true,
          service: 'fanflow',
          version: '0.1.0',
          port: config.port,
          model: defaultModel(),
          provider: { name: provider.name, label: provider.label },
          providers: listProviders(),
          llm: { reachable: models.reachable, models: models.models },
          // Back-compat alias for the web UI (Settings dropdown + FanFlow panel)
          ollama: models,
          embed: await memory.embedStatus(),
          memory: memory.stats(),
        },
      }
    }

    if (method === 'GET' && pathname === '/api/registry') {
      return { status: 200, body: registry }
    }

    if (method === 'GET' && pathname === '/api/events') {
      const limit = Number(searchParams?.get('limit')) || 50
      return { status: 200, body: { events: [...getEvents(limit)].reverse() } } // newest first for the UI
    }

    if (method === 'GET' && pathname === '/api/fans') {
      return { status: 200, body: { fans: memory.fans() } }
    }

    if (method === 'POST' && pathname === '/api/fan') {
      if (!body.fanId) return { status: 400, body: { error: 'fanId is required' } }
      const fan = memory.ensureFan(body)
      emit('FanCreated', { fanId: body.fanId })
      return { status: 200, body: { fan } }
    }

    if (method === 'POST' && pathname === '/api/chat') {
      if (!body.message?.trim()) return { status: 400, body: { error: 'message is required' } }
      const result = await handleMessage({
        fanId: body.fanId || `anon-${Date.now().toString(36)}`,
        characterId: body.characterId || 'default',
        message: body.message,
        persona: body.persona || null,
        model: body.model || defaultModel(),
      })
      return { status: 200, body: result }
    }

    if (method === 'POST' && pathname === '/api/memory/remember') {
      if (!body.fanId || !body.text) return { status: 400, body: { error: 'fanId and text are required' } }
      const item = memory.remember(body)
      emit('MemoryUpdated', { fanId: body.fanId, kind: 'semantic' })
      return { status: 200, body: { item } }
    }

    if (method === 'POST' && pathname === '/api/media/generate') {
      const result = await run('media.request', {
        fanId: body.fanId || 'anon',
        characterId: body.characterId || 'default',
        query: body.query || '',
      })
      return { status: 200, body: result }
    }

    // Param route: GET /api/memory/:fanId
    const m = pathname.match(/^\/api\/memory\/(.+)$/)
    if (m && method === 'GET') {
      return { status: 200, body: memory.fanMemory(decodeURIComponent(m[1])) }
    }

    return { status: 404, body: { error: 'Not found', hint: 'GET /api/health' } }
  } catch (e) {
    console.error('[fanflow] route error:', e)
    return { status: 500, body: { error: e.message } }
  }
}
