import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { startHiggsfieldOAuthPopup, disconnectHF, isHFConnected } from '../utils/higgsfieldAuth'
import { getWaveSpeedKey, setWaveSpeedKey } from '../utils/wavespeedGenerate'
import { checkFanflow, getFanflowUrl, setFanflowUrl, getFanflowModel, setFanflowModel } from '../utils/fanflow'
import { useTheme } from '../context/theme'

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
      </div>
      <div style={{ padding: '20px 24px' }}>{children}</div>
    </div>
  )
}

const CLAUDE_KEY = 'claude_api_key'

export default function Settings() {
  const location = useLocation()
  const { theme, toggle } = useTheme()
  const [hfConnected, setHfConnected] = useState(isHFConnected)
  const [hfLoading, setHfLoading] = useState(false)
  const [claudeKey, setClaudeKey] = useState(() => localStorage.getItem(CLAUDE_KEY) || '')
  const [claudeInput, setClaudeInput] = useState('')
  const [showClaudeInput, setShowClaudeInput] = useState(false)
  const [wsKey, setWsKey] = useState(getWaveSpeedKey)
  const [wsInput, setWsInput] = useState('')
  const [showWsInput, setShowWsInput] = useState(false)
  const [ffUrl, setFfUrl] = useState(getFanflowUrl)
  const [ffSaved, setFfSaved] = useState(true)
  const [ffStatus, setFfStatus] = useState(null)
  const [ffError, setFfError] = useState(null)
  const [ffChecking, setFfChecking] = useState(true)
  const [ffModel, setFfModel] = useState(getFanflowModel)

  useEffect(() => {
    let alive = true
    setFfChecking(true)
    setFfError(null)
    checkFanflow()
      .then(s => { if (alive) setFfStatus(s) })
      .catch(e => { if (alive) { setFfStatus(null); setFfError(e.message) } })
      .finally(() => { if (alive) setFfChecking(false) })
    return () => { alive = false }
  }, [ffUrl])
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('connected') === '1') {
      setHfConnected(true)
    }
  }, [location.search])

  async function connectHiggsfield() {
    setHfLoading(true)
    try {
      await startHiggsfieldOAuthPopup()
      setHfConnected(true)
    } catch (e) {
      if (e.message !== 'cancelled') alert('Failed to connect Higgsfield: ' + e.message)
    } finally {
      setHfLoading(false)
    }
  }

  function disconnectHighgsfield() {
    if (!confirm('Disconnect your Higgsfield account?')) return
    disconnectHF()
    setHfConnected(false)
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 28 }}>Settings</h1>

        <Section title="Appearance">
          <div style={{ display: 'flex', gap: 10 }}>
            {(['light', 'dark']).map(val => {
              const on = theme === val
              return (
                <button key={val} onClick={e => { if (!on) toggle(e.clientX, e.clientY) }} style={{
                  flex: 1, padding: '14px 12px', borderRadius: 12, cursor: on ? 'default' : 'pointer',
                  border: `1.5px solid ${on ? '#8B5CF6' : 'var(--border)'}`,
                  background: on ? 'rgba(139,92,246,0.09)' : 'var(--bg)',
                  color: on ? '#8B5CF6' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  boxShadow: on ? '0 0 0 1px #8B5CF655' : 'none',
                }}>
                  {val === 'light' ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="5"/>
                      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                  )}
                  {val.charAt(0).toUpperCase() + val.slice(1)}
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Higgsfield">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            Connect your Higgsfield account to generate influencer images directly in the app. Images use your own Higgsfield credits.
          </p>
          {hfConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34C759' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#34C759' }}>Higgsfield connected</span>
              </div>
              <button onClick={disconnectHighgsfield} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, color: '#FF3B30', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)', fontWeight: 500 }}>
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectHiggsfield}
              disabled={hfLoading}
              style={{ padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#1D1D1F', color: '#fff', display: 'flex', alignItems: 'center', gap: 8, opacity: hfLoading ? 0.6 : 1 }}
            >
              {hfLoading ? (
                <>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                  Connecting…
                </>
              ) : (
                'Connect Higgsfield'
              )}
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </button>
          )}
        </Section>

        <Section title="Claude AI">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            Add your Anthropic API key to let Claude analyze the image just before generating your product character sheet.
          </p>
          {claudeKey ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34C759' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#34C759' }}>Claude connected</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>···{claudeKey.slice(-4)}</span>
                </div>
                <button
                  onClick={() => { localStorage.removeItem(CLAUDE_KEY); setClaudeKey(''); setClaudeInput(''); setShowClaudeInput(false) }}
                  style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, color: '#FF3B30', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)', fontWeight: 500 }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : showClaudeInput ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                type="password"
                value={claudeInput}
                onChange={e => setClaudeInput(e.target.value)}
                placeholder="sk-ant-..."
                onKeyDown={e => {
                  if (e.key === 'Enter' && claudeInput.trim()) {
                    const k = claudeInput.trim()
                    localStorage.setItem(CLAUDE_KEY, k)
                    setClaudeKey(k)
                    setClaudeInput('')
                    setShowClaudeInput(false)
                  }
                }}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'monospace' }}
              />
              <button
                onClick={() => {
                  const k = claudeInput.trim()
                  if (!k) return
                  localStorage.setItem(CLAUDE_KEY, k)
                  setClaudeKey(k)
                  setClaudeInput('')
                  setShowClaudeInput(false)
                }}
                style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#1D1D1F', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowClaudeInput(true)}
              style={{ padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#1D1D1F', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Add API Key
            </button>
          )}
        </Section>

        <Section title="WaveSpeed">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            Add your WaveSpeed API key to train a custom LoRA from an influencer's photos — a second,
            identity-preserving generation path alongside Higgsfield. Uses your own WaveSpeed credits.
          </p>
          {wsKey ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34C759' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#34C759' }}>WaveSpeed connected</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>···{wsKey.slice(-4)}</span>
              </div>
              <button
                onClick={() => { setWaveSpeedKey(''); setWsKey(''); setWsInput(''); setShowWsInput(false) }}
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, color: '#FF3B30', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)', fontWeight: 500 }}
              >
                Remove
              </button>
            </div>
          ) : showWsInput ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                type="password"
                value={wsInput}
                onChange={e => setWsInput(e.target.value)}
                placeholder="ws-..."
                onKeyDown={e => {
                  if (e.key === 'Enter' && wsInput.trim()) {
                    const k = wsInput.trim()
                    setWaveSpeedKey(k)
                    setWsKey(k)
                    setWsInput('')
                    setShowWsInput(false)
                  }
                }}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'monospace' }}
              />
              <button
                onClick={() => {
                  const k = wsInput.trim()
                  if (!k) return
                  setWaveSpeedKey(k)
                  setWsKey(k)
                  setWsInput('')
                  setShowWsInput(false)
                }}
                style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#1D1D1F', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowWsInput(true)}
              style={{ padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#1D1D1F', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Add API Key
            </button>
          )}
        </Section>

        <Section title="FanFlow (AI Creator OS)">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
            FanFlow is the orchestration layer: LLM, memory, and the message → intent → memory → respond
            workflow. It runs either as a Vercel serverless function (deployed, same-origin{' '}
            <code style={{ fontSize: 12, background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 5 }}>/api/fanflow</code>)
            or as a local server (<code style={{ fontSize: 12, background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 5 }}>node fanflow/src/server.js</code>).
            Media generation stays in your browser (Character Studio).
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              value={ffUrl}
              onChange={e => { setFfUrl(e.target.value); setFfSaved(false) }}
              placeholder="same-origin (/api/fanflow) · or http://localhost:8787"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'monospace' }}
            />
            <button
              onClick={() => { setFanflowUrl(ffUrl); setFfSaved(true) }}
              style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#1D1D1F', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              {ffSaved ? 'Saved' : 'Save'}
            </button>
          </div>

          {ffChecking ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Checking connection…</p>
          ) : ffError ? (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.18)', fontSize: 13, color: '#FF3B30', lineHeight: 1.5 }}>
              {ffError}
            </div>
          ) : ffStatus && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34C759' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#34C759' }}>FanFlow connected</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>· {ffStatus.memory.fans} fan(s), {ffStatus.memory.messages} message(s)</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Provider: <b style={{ color: 'var(--text-primary)' }}>{ffStatus.provider?.label || 'Ollama (local)'}</b>
                {' · '}<b style={{ color: ffStatus.ollama.reachable ? 'var(--text-primary)' : '#FF3B30' }}>{ffStatus.ollama.reachable ? 'reachable' : 'offline'}</b>
                {' · '}default model: <b style={{ color: 'var(--text-primary)' }}>{ffStatus.model}</b>
              </div>
              {ffStatus.ollama.models?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ffStatus.ollama.models.map(m => (
                      <span key={m} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        {m}
                      </span>
                    ))}
                  </div>
                  <select
                    value={ffModel}
                    onChange={e => { setFanflowModel(e.target.value); setFfModel(e.target.value) }}
                    style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', fontSize: 13, color: 'var(--text-primary)', maxWidth: 320 }}
                  >
                    <option value="">Server default ({ffStatus.model})</option>
                    {ffStatus.ollama.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
