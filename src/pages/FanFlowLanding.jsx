import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { checkFanflow, fanflowFans } from '../utils/fanflow'
import { OTHER_SITE } from '../site'

const GRAD = 'linear-gradient(135deg,#8B5CF6,#60A5FA)'

function useLiveStatus() {
  const [status, setStatus] = useState(null)
  const [fans, setFans] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const s = await checkFanflow()
        if (!alive) return
        setStatus(s)
        setError(null)
        try { const f = await fanflowFans(); if (alive) setFans(f) } catch {}
      } catch (e) {
        if (alive) { setStatus(null); setError(e.message) }
      }
    }
    load()
    const id = setInterval(load, 15000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  return { status, fans, error }
}

const METRICS = [
  { label: 'AI Characters', key: 'fans', color: '#8B5CF6' },
  { label: 'Messages', key: 'messages', color: '#60A5FA' },
  { label: 'Events', key: 'events', color: '#34C759' },
  { label: 'LLM', key: 'reachable', color: '#FF9F0A' },
]

export default function FanFlowLanding() {
  const { status, fans, error } = useLiveStatus()

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#07070E',
      overflow: 'hidden',
      padding: 'calc(var(--nav-h) + 40px) 24px 80px',
      textAlign: 'center',
    }}>
      {/* Orbs */}
      <div style={{ position:'absolute', width:760, height:760, top:'-22%', left:'-18%', borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 65%)', animation:'ff-orb1 14s ease-in-out infinite', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', width:620, height:620, top:'-14%', right:'-12%', borderRadius:'50%', background:'radial-gradient(circle, rgba(96,165,250,0.20) 0%, transparent 65%)', animation:'ff-orb2 19s ease-in-out infinite', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', width:820, height:820, bottom:'-32%', left:'18%', borderRadius:'50%', background:'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 65%)', animation:'ff-orb3 23s ease-in-out infinite', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize:'32px 32px', pointerEvents:'none' }}/>

      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(7,7,14,0.82) 100%)', pointerEvents: 'none', zIndex: 1 }}/>

      <div style={{ maxWidth: 720, position: 'relative', zIndex: 2 }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.52)',
          padding: '6px 16px 6px 12px', borderRadius: 20,
          fontSize: 13, fontWeight: 600, letterSpacing: '0.3px',
          marginBottom: 44, border: '1px solid rgba(255,255,255,0.09)',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width:10, height:10 }}>
            <span style={{ position:'absolute', width:10, height:10, borderRadius:'50%', background:'#34C759', opacity:0.35, animation:'ping 1.8s ease-out infinite' }}/>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#34C759', flexShrink:0 }}/>
          </span>
          AI Creator OS
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(139,92,246,0.4)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5-6.3 4.5L8 13.8l-6-4.6h7.6z"/>
            </svg>
          </div>
        </div>

        <h1 style={{ fontSize:'clamp(48px,8vw,88px)', fontWeight:800, letterSpacing:'-3px', lineHeight:1.0, marginBottom:8 }}>
          <span style={{ background: GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>FanFlow</span>
        </h1>

        <p style={{ fontSize:20, color:'rgba(255,255,255,0.38)', lineHeight:1.65, margin:'0 auto 48px', maxWidth:480, fontWeight:400 }}>
          AI orchestration, memory, workflow, and relationship engine for your creator studio.
        </p>

        {/* Live status cards */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 44 }}>
          {METRICS.map(m => {
            let val = '—'
            if (status?.memory) {
              if (m.key === 'fans') val = status.memory.fans
              else if (m.key === 'messages') val = status.memory.messages
              else if (m.key === 'events') val = status.memory.events
              else if (m.key === 'reachable') val = status.llm?.reachable ? 'active' : error ? 'offline' : 'connecting…'
            }
            return (
              <div key={m.key} style={{
                padding: '12px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
                minWidth: 120,
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{val}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</div>
              </div>
            )
          })}
        </div>

        {/* Provider info */}
        {status?.provider && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', marginBottom: 36 }}>
            Provider: <b style={{ color: 'rgba(255,255,255,0.6)' }}>{status.provider.label}</b>
            {' · '}Model: <b style={{ color: 'rgba(255,255,255,0.6)' }}>{status.model}</b>
          </div>
        )}

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/fanflow" style={{
            padding:'17px 44px', borderRadius:980,
            background: GRAD,
            color:'#fff', fontSize:17, fontWeight:700, letterSpacing:'-0.2px',
            boxShadow:'0 0 32px rgba(139,92,246,0.45), 0 4px 20px rgba(0,0,0,0.5)',
            transition:'transform 0.18s, box-shadow 0.18s',
            textDecoration: 'none',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04) translateY(-2px)'; e.currentTarget.style.boxShadow='0 0 60px rgba(139,92,246,0.65), 0 8px 32px rgba(0,0,0,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1) translateY(0)'; e.currentTarget.style.boxShadow='0 0 32px rgba(139,92,246,0.45), 0 4px 20px rgba(0,0,0,0.5)' }}
          >
            Open Dashboard →
          </Link>
          <a href={OTHER_SITE.url} target="_blank" rel="noopener noreferrer" style={{
            padding:'17px 36px', borderRadius:980,
            background: 'rgba(255,255,255,0.06)',
            color:'rgba(255,255,255,0.7)', fontSize:15, fontWeight:600, letterSpacing:'-0.2px',
            border: '1px solid rgba(255,255,255,0.1)',
            transition:'all 0.18s',
            textDecoration: 'none',
          }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.10)'; e.currentTarget.style.color='#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='rgba(255,255,255,0.7)' }}
          >
            {OTHER_SITE.label} ↗
          </a>
        </div>

        {/* Fans preview */}
        {fans.length > 0 && (
          <div style={{ marginTop: 48, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>Active fans</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fans.slice(0, 5).map(f => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                    {(f.name || f.id).charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{f.name || f.id}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>♥ {f.relationship.trust} · 💬 {f.messageCount}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ping {
          0%        { transform: scale(1); opacity: 0.35; }
          80%, 100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes ff-orb1 {
          0%, 100% { transform: translate(0,0) scale(1); }
          33%       { transform: translate(55px,-45px) scale(1.07); }
          66%       { transform: translate(-35px,38px) scale(0.93); }
        }
        @keyframes ff-orb2 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50%       { transform: translate(-45px,55px) scale(1.11); }
        }
        @keyframes ff-orb3 {
          0%, 100% { transform: translate(0,0) scale(1); }
          40%       { transform: translate(35px,-55px) scale(0.90); }
          70%       { transform: translate(-55px,22px) scale(1.08); }
        }
      `}</style>
    </div>
  )
}