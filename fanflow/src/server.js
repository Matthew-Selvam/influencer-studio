// FanFlow — HTTP API server (zero dependencies, Node >= 18).
//
//   npm run fanflow          → starts on http://localhost:8787
//
// This file is ONLY the node:http wrapper. All routing lives in router.js so
// the exact same API runs on Vercel serverless (api/fanflow.js). The web app
// talks to this service for AI + memory; the browser keeps media generation
// (Character Studio) via its own Higgsfield account.

import { createServer } from 'node:http'
import { config } from './config.js'
import { emit } from './eventBus.js'
import { handleApiRequest } from './router.js'
import { activeProvider, listProviders, defaultModel } from './llm.js'
import { flushNow } from './memory.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    res.end()
    return
  }
  const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {}
  const { status, body: payload } = await handleApiRequest({
    method: req.method,
    pathname: url.pathname,
    searchParams: url.searchParams,
    body,
  })
  const text = JSON.stringify(payload, null, 2)
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) })
  res.end(text)
})

// Graceful shutdown: flush any in-flight memory writes so recent messages and
// the freshly-embedded vector don't vanish in the persist debounce window.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { try { server.close(() => {}) } catch {} try { flushNow() } catch {} process.exit(0) })
}

server.listen(config.port, () => {
  const provider = activeProvider()
  emit('ServiceStarted', { port: config.port, model: defaultModel(), provider: provider.name })
  console.log('')
  console.log('  FanFlow — AI Creator OS backend')
  console.log(`  Listening on   http://localhost:${config.port}`)
  console.log(`  LLM provider   ${provider.label} (${provider.name}) — model "${defaultModel()}"`)
  console.log(`  Available      ${listProviders().map(p => p.label).join(' · ')}  (FANFLOW_LLM_PROVIDER to switch)`)
  console.log(`  Memory store   ${config.memoryBackend === 'file' ? config.dataDir + '/memory.json' : config.memoryBackend + ' (in-memory)'}`)
  console.log('')
  console.log('  Endpoints:')
  console.log('    GET  /api/health          status + provider + memory stats')
  console.log('    GET  /api/registry        capability → provider map')
  console.log('    GET  /api/events          event bus log (newest first)')
  console.log('    GET  /api/fans            fan list + relationship scores')
  console.log('    POST /api/fan             create a fan   { fanId, name? }')
  console.log('    POST /api/chat            fan message → reply + trace')
  console.log('    POST /api/memory/remember { fanId, text, type?, tags? }')
  console.log('    GET  /api/memory/:fanId   full memory for one fan')
  console.log('')
})
