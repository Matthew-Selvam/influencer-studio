import { handleApiRequest } from '../fanflow/src/router.js'

// Node runtime (default). Long LLM inference can exceed the 10s default.
export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  // /api/fanflow/* is routed here by a vercel.json rewrite that captures the
  // sub-path into __ffpath (plain Vercel functions don't support multi-segment
  // catch-alls — same workaround as api/hfproxy.js). Rebuild '/api/<subpath>'.
  const sub = (req.query?.__ffpath || '').replace(/^\/+/, '')
  const pathname = '/api' + (sub ? '/' + sub : '/health')

  const { status, body } = await handleApiRequest({
    method: req.method,
    pathname,
    searchParams: new URLSearchParams(req.url.split('?')[1] || ''),
    body: req.body || {},
  })

  return res.status(status).json(body)
}
