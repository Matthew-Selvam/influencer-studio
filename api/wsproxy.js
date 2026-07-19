import { rateLimit, clientIp } from '../lib/rateLimit.js'

// WaveSpeed's REST API (submit + poll) needs no OAuth dance and no SSE streaming, unlike
// Higgsfield's MCP proxy — a plain forward is enough. Each user brings their own WaveSpeed API
// key (same "bring your own key" model as Claude): the browser sends it as a normal Authorization
// header, this function forwards it upstream unmodified, and never stores or logs it.

const UPSTREAM = 'https://api.wavespeed.ai/api/v3'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).send('Method not allowed')

  const rl = rateLimit(clientIp(req.headers))
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter))
    return res.status(429).json({ error: { message: 'Too many requests — slow down a moment and try again.' } })
  }

  const auth = req.headers['authorization']
  if (!auth) return res.status(400).json({ error: { message: 'Missing Authorization header (your WaveSpeed API key)' } })

  // /api/ws/<sub-path> is routed here by a vercel.json rewrite into __wspath, same pattern as
  // the Higgsfield proxy — plain (non-Next) Vercel functions don't support multi-segment
  // catch-alls, only the injected query param survives the rewrite reliably.
  const subPath = String(req.query.__wspath || '').replace(/^\/+/, '')
  if (!subPath) return res.status(400).json({ error: { message: 'Missing WaveSpeed path' } })

  try {
    const upstream = await fetch(`${UPSTREAM}/${subPath}`, {
      method: req.method,
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    })
    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: { message: e.message } })
  }
}
