import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useInfluencers } from '../store'
import {
  checkFanflow,
  fanflowChat,
  fanflowFans,
  fanflowFanMemory,
  fanflowCreateFan,
  fanflowEvents,
  fanflowRegistry,
  personaFromInfluencer,
} from '../utils/fanflow'

const GRAD = 'linear-gradient(135deg,#EC4899,#8B5CF6)'
const FAN_ID_KEY = 'fanflow_fan_id'
const CHAR_ID_KEY = 'fanflow_character_id'
// Panel height: fills the viewport on desktop, caps at 680px so wrapped
// panels stay reachable (the page scrolls) on narrow windows.
const PANEL_H = 'min(680px, calc(100vh - var(--shell-top) - 190px))'

const INTENT_META = {
  media:    { label: 'Media request',   color: '#8B5CF6' },
  purchase: { label: 'Purchase intent', color: '#34C759' },
  praise:   { label: 'Praise',          color: '#FF9F0A' },
  question: { label: 'Question',        color: '#0A84FF' },
  general:  { label: 'General',         color: '#6E6E73' },
}

const EVENT_COLORS = {
  ServiceStarted: '#8B5CF6', MessageReceived: '#0A84FF', IntentDetected: '#FF9F0A',
  MemoryRetrieved: '#34C759', MemoryUpdated: '#30B0C7', ResponseGenerated: '#EC4899',
  RelationshipUpdated: '#34C759', MediaRequested: '#8B5CF6', AnalyticsUpdated: '#6E6E73',
  ModelMissing: '#FF3B30', FanCreated: '#FF9F0A',
}

const STARTERS = [
  'Show me your latest outfit 👗',
  "What's your skincare routine?",
  'I might buy your merch 👀',
  'Tell me about your new drop',
  'You look amazing in that post!',
]

const TABS = [
  { id: 'trace', label: 'Trace' },
  { id: 'relationship', label: 'Fan' },
  { id: 'memory', label: 'Memory' },
  { id: 'events', label: 'Events' },
  { id: 'system', label: 'System' },
]

function fmtTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function infAvatar(inf) {
  if (!inf) return null
  return inf.mainImage || inf.characterSheetImage || inf.closeUpImage1 || inf.generationHistory?.[0]?.url || null
}
function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>{children}</div>
}
function StatCell({ label, value }) {
  return (
    <div style={{ padding: '9px 10px', borderRadius: 10, background: 'var(--bg-tertiary)', textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 2 }}>{label}</div>
    </div>
  )
}
function EmptyPanel({ icon, title, text }) {
  return (
    <div style={{ padding: '20px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>{text}</div>
    </div>
  )
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 3, flexShrink: 0, overflow: 'hidden',
      background: src ? `url("${src}") center/cover no-repeat` : GRAD,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.4,
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
    }}>
      {!src && (name ? name.charAt(0).toUpperCase() : 'F')}
    </div>
  )
}

function StatusPill({ status, checking }) {
  const ok = !!status
  const color = checking ? '#FF9F0A' : ok ? '#34C759' : '#FF3B30'
  const label = checking ? 'Connecting…' : ok ? 'Connected' : 'Offline'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-subtle)', fontSize: 13, fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
      <span>{label}</span>
      {ok && <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>· {status.model}</span>}
    </div>
  )
}

function CharStrip({ influencers, charId, onSelect }) {
  const options = [
    { id: 'generic', name: 'FanFlow', sub: 'generic AI', img: null },
    ...influencers.map(i => ({ id: i.id, name: i.name, sub: i.niche || 'creator', img: infAvatar(i) })),
  ]
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {options.map(o => {
        const active = o.id === charId
        return (
          <button key={o.id} onClick={() => onSelect(o.id)} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '6px 12px 6px 6px', borderRadius: 14, flexShrink: 0,
            background: active ? 'var(--accent-light)' : 'var(--surface)',
            border: `1.5px solid ${active ? '#8B5CF6' : 'var(--border-subtle)'}`,
            boxShadow: active ? '0 2px 12px rgba(139,92,246,0.25)' : 'none',
            transition: 'all 0.18s',
          }}>
            <Avatar src={o.img} name={o.name} size={34} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{o.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{o.sub}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function FanRail({ fans, fanId, onSelect, newName, setNewName, onCreate }) {
  return (
    <div style={{ width: 248, height: PANEL_H, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Fans · CRM</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fans.length}</span>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
        {fans.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
            No fans yet.<br />Send a message to create one.
          </div>
        ) : fans.map(f => {
          const active = f.id === fanId
          return (
            <button key={f.id} onClick={() => onSelect(f.id)} style={{
              width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2,
              background: active ? 'var(--accent-light)' : 'transparent',
              border: `1px solid ${active ? 'rgba(139,92,246,0.35)' : 'transparent'}`,
              transition: 'all 0.15s',
            }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                {(f.name || f.id).charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name || f.id}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>♥ {f.relationship.trust} · 💬 {f.messageCount}</div>
              </div>
            </button>
          )
        })}
      </div>
      <div style={{ padding: 10, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6 }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onCreate()}
          placeholder="New fan name"
          style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', fontSize: 12.5, color: 'var(--text-primary)' }}
        />
        <button onClick={onCreate} style={{ padding: '8px 12px', borderRadius: 8, background: GRAD, color: '#fff', fontSize: 12, fontWeight: 700 }}>Add</button>
      </div>
    </div>
  )
}

function MessageBubble({ m, char }) {
  if (m.role === 'error') {
    return (
      <div style={{ alignSelf: 'center', padding: '8px 14px', borderRadius: 999, background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', fontSize: 12.5, color: '#FF3B30', maxWidth: '85%', textAlign: 'center' }}>{m.text}</div>
    )
  }
  if (m.role === 'user') {
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '76%', animation: 'ff-msg 0.25s cubic-bezier(0.22,1,0.36,1)' }}>
        <div style={{ padding: '11px 15px', borderRadius: '16px 16px 4px 16px', background: GRAD, color: '#fff', fontSize: 14, lineHeight: 1.5, boxShadow: '0 2px 10px rgba(139,92,246,0.25)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 3 }}>you · {fmtTime(m.at)}</div>
      </div>
    )
  }
  const meta = INTENT_META[m.intent]
  return (
    <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-start', maxWidth: '84%', animation: 'ff-msg 0.25s cubic-bezier(0.22,1,0.36,1)' }}>
      <Avatar src={char ? infAvatar(char) : null} name={char ? char.name : 'F'} size={30} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>{char ? char.name : 'FanFlow'}</span>
          {meta && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: `${meta.color}1a`, color: meta.color }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color }} /> {meta.label}
            </span>
          )}
        </div>
        <div style={{ padding: '11px 15px', borderRadius: '4px 16px 16px 16px', background: 'var(--bg-tertiary)', fontSize: 14, lineHeight: 1.55, border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {m.text}
          {m.media?.requested && (
            <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.28)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13 }}>🎬</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Media request · {String(m.media.requestId).replace(/^media-/, '')}</span>
              <Link to="/influencers" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#8B5CF6' }}>Character Studio →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Typing({ char }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, animation: 'ff-msg 0.2s ease' }}>
      <Avatar src={char ? infAvatar(char) : null} name={char ? char.name : 'F'} size={30} />
      <div style={{ padding: '13px 16px', borderRadius: '4px 16px 16px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-tertiary)', animation: `ff-dot 1.2s ${i * 0.18}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes ff-dot { 0%,60%,100% { transform: translateY(0); opacity: .4 } 30% { transform: translateY(-4px); opacity: 1 } }
@keyframes ff-msg { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}

function EmptyThread({ onPick }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: 24 }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(139,92,246,0.4)' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
          <path d="M19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Your fan's first message</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 320, marginTop: 4, lineHeight: 1.5 }}>
          Chat as a fan — FanFlow runs the workflow, remembers everything, and tracks the relationship.
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 440 }}>
        {STARTERS.map(s => (
          <button key={s} onClick={() => onPick(s)} style={{
            padding: '8px 14px', borderRadius: 999, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
            fontSize: 12.5, color: 'var(--text-primary)', transition: 'all 0.15s', cursor: 'pointer',
          }}>{s}</button>
        ))}
      </div>
    </div>
  )
}

// ── Right-panel views ────────────────────────────────────────────────────────

function TraceView({ trace }) {
  if (!trace) return <EmptyPanel icon="⚙️" title="No trace yet" text="Send a message and watch the workflow run: intent → memory → generate → store → respond." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <Label>Intent</Label>
        <div style={{ marginTop: 7 }}>
          {INTENT_META[trace.intent] ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999, background: `${INTENT_META[trace.intent].color}1a`, color: INTENT_META[trace.intent].color }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: INTENT_META[trace.intent].color }} />
              {INTENT_META[trace.intent].label}
            </span>
          ) : (
            <code style={{ fontSize: 12 }}>{trace.intent}</code>
          )}
        </div>
      </div>
      <div>
        <Label>Workflow steps</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
          {(trace.steps || []).map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(52,199,89,0.15)', color: '#34C759', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✓</span>
              <code style={{ fontSize: 11.5, color: s.includes('model-missing') ? '#FF9F0A' : 'var(--text-primary)' }}>{s}</code>
            </div>
          ))}
        </div>
      </div>
      {trace.memoryHits?.length > 0 && (
        <div>
          <Label>Memory retrieved ({trace.memoryHits.length})</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {trace.memoryHits.slice(0, 4).map((h, i) => (
              <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-tertiary)', fontSize: 11.5, lineHeight: 1.4 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', color: '#8B5CF6' }}>{h.type}</span>
                  {h.score != null && <span style={{ fontSize: 10, fontWeight: 700, color: h.score >= 35 ? '#34C759' : '#FF9F0A' }}>{h.score}%</span>}
                </span>
                <div style={{ marginTop: 2 }}>{h.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {trace.style && (
        <div>
          <Label>Style stats</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <StatCell label="Words" value={trace.style.words} />
            <StatCell label="Sentences" value={trace.style.sentences} />
            <StatCell label="Emojis" value={trace.style.emojis} />
            <StatCell label="Words / sent." value={trace.style.avgWordsPerSentence} />
          </div>
        </div>
      )}
    </div>
  )
}

function RelationshipView({ fan, detail }) {
  const r = detail?.relationship
  if (!r) return <EmptyPanel icon="💞" title="No fan selected" text="Pick a fan to see the relationship engine: trust, loyalty, engagement, VIP." />
  const rows = [
    ['Trust', r.trust, '#34C759'],
    ['Loyalty', r.loyalty, '#0A84FF'],
    ['Engagement', r.engagement, '#FF9F0A'],
    ['VIP score', r.vip, '#8B5CF6'],
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rows.map(([label, val, color]) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
            <span style={{ fontWeight: 600 }}>{label}</span>
            <span style={{ fontWeight: 700, color }}>{val}</span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, val)}%`, height: '100%', borderRadius: 999, background: color, transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCell label="Purchases" value={r.purchases} />
        <StatCell label="Stage" value={r.conversationStage} />
        <StatCell label="Messages" value={fan?.messageCount ?? detail?.shortTerm?.length ?? 0} />
        <StatCell label="Memories" value={detail?.semantic?.length ?? 0} />
      </div>
      {r.favoriteTopics?.length > 0 && (
        <div>
          <Label>Favorite topics</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {r.favoriteTopics.map(t => (
              <span key={t} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 999, background: 'var(--accent-light)', color: '#8B5CF6', fontWeight: 600 }}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MemoryView({ detail }) {
  if (!detail) return <EmptyPanel icon="🧠" title="No fan selected" text="Pick a fan to inspect their semantic facts and episodic summaries." />
  const semantic = detail.semantic || []
  const episodic = detail.episodic || []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Label>Semantic facts ({semantic.length})</Label>
        {semantic.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.5 }}>Nothing stored yet — strong intents (like purchases) are remembered automatically.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {semantic.slice().reverse().slice(0, 12).map(it => (
              <div key={it.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-tertiary)', fontSize: 12, lineHeight: 1.45 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', color: '#8B5CF6' }}>{it.type}</span>
                <div style={{ marginTop: 3 }}>{it.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label>Episodic summaries ({episodic.length})</Label>
        {episodic.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>Summaries roll up after every 10 messages.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {episodic.slice().reverse().slice(0, 6).map(ep => (
              <div key={ep.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-tertiary)', fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                <span style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>{fmtTime(ep.at)}</span>
                {ep.summary}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EventsView({ events }) {
  if (!events?.length) return <EmptyPanel icon="📡" title="No events" text="The event bus is quiet — chat actions will appear here live." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {events.slice(0, 30).map(e => {
        const color = EVENT_COLORS[e.name] || '#6E6E73'
        const label = e.data?.fanId ? `${e.name} · ${String(e.data.fanId).slice(0, 10)}` : e.name
        return (
          <div key={e.seq} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-tertiary)', fontSize: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', flexShrink: 0 }}>{fmtTime(e.t)}</span>
          </div>
        )
      })}
    </div>
  )
}

function SystemView({ registry, status }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Label>Capability registry</Label>
        {registry ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {Object.entries(registry).map(([cap, prov]) => (
              <div key={cap} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--bg-tertiary)', fontSize: 11.5 }}>
                <code style={{ flex: 1, color: 'var(--text-primary)' }}>{cap}</code>
                <span style={{ color: 'var(--text-tertiary)', textAlign: 'right', fontSize: 10.5 }}>{prov}</span>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>Registry unavailable.</div>}
      </div>
      {status && (
        <div>
          <Label>Runtime</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {[
              ['Service', status.service],
              ['Version', status.version],
              ['Provider', status.provider?.label || 'Ollama (local)'],
              ['Model', status.model],
              ['LLM', status.ollama?.reachable ? 'reachable' : 'offline'],
              ['Memory search', status.embed ? `${status.embed.active ? 'vector ✓' : 'keyword (fallback)'} · ${status.embed.reachable ? status.embed.model : 'embed model offline'}` : '—'],
              ['Fans', status.memory?.fans],
              ['Messages', status.memory?.messages],
              ['Events logged', status.memory?.events],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 10px', borderRadius: 8, background: 'var(--bg-tertiary)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function OfflineState({ checking, error, onRetry }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 460, textAlign: 'center', padding: 40, background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 20, boxShadow: 'var(--shadow-md)' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
          {checking ? '⏳' : '🔌'}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{checking ? 'Connecting to FanFlow…' : 'FanFlow server is offline'}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '10px 0 16px' }}>
          The AI + memory layer runs either as the deployed Vercel function (same-origin{' '}
          <code style={{ fontSize: 12, background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 5 }}>/api/fanflow</code>)
          or as a local server for Ollama. Start the local one in a terminal:
        </p>
        <code style={{ display: 'block', padding: '12px 16px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border-subtle)', fontSize: 13, fontFamily: 'monospace', textAlign: 'left', overflowX: 'auto' }}>node fanflow/src/server.js</code>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
          <button onClick={onRetry} style={{ padding: '10px 20px', borderRadius: 10, background: GRAD, color: '#fff', fontSize: 13.5, fontWeight: 700, boxShadow: '0 2px 10px rgba(139,92,246,0.35)' }}>
            Retry connection
          </button>
          <Link to="/settings" style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Open Settings
          </Link>
        </div>
        {error && <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{error}</div>}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FanFlow() {
  const [influencers] = useInfluencers()
  const [status, setStatus] = useState(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState(null)
  const [fans, setFans] = useState([])
  const [events, setEvents] = useState([])
  const [registry, setRegistry] = useState(null)
  const [fanDetail, setFanDetail] = useState(null)
  const [messages, setMessages] = useState([])
  const [fanId, setFanId] = useState(() => localStorage.getItem(FAN_ID_KEY) || 'local-fan')
  const [charId, setCharId] = useState(() => localStorage.getItem(CHAR_ID_KEY) || 'generic')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [newFanName, setNewFanName] = useState('')
  const [tab, setTab] = useState('trace')
  const [lastTrace, setLastTrace] = useState(null)
  const threadRef = useRef(null)
  const loadSeqRef = useRef(0)

  const selectedChar = charId === 'generic' ? null : influencers.find(i => i.id === charId)
  const currentFan = fans.find(f => f.id === fanId)

  async function loadFan(fid, withThread) {
    const seq = ++loadSeqRef.current // ignore stale responses on quick fan switches
    try {
      const m = await fanflowFanMemory(fid)
      if (seq !== loadSeqRef.current) return
      setFanDetail(m)
      if (withThread) {
        setMessages((m.shortTerm || []).map((t, i) => ({ id: `${t.at}-${i}`, role: t.role, text: t.text, at: t.at })))
        setLastTrace(null)
      }
    } catch {}
  }

  const bootstrap = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      const s = await checkFanflow()
      setStatus(s)
      const [f, e, r] = await Promise.all([fanflowFans(), fanflowEvents(40), fanflowRegistry()])
      setFans(f); setEvents(e); setRegistry(r)
      if (!f.some(x => x.id === fanId)) {
        try {
          await fanflowCreateFan(fanId, 'Local Fan')
          setFans(await fanflowFans())
        } catch {}
      }
      await loadFan(fanId, true)
    } catch (err) {
      setStatus(null)
      setError(err.message)
    } finally {
      setChecking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { bootstrap() }, [bootstrap])

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  function selectFan(fid) {
    setFanId(fid)
    localStorage.setItem(FAN_ID_KEY, fid)
    loadFan(fid, true)
  }

  function selectChar(id) {
    setCharId(id)
    localStorage.setItem(CHAR_ID_KEY, id)
  }

  async function createFan() {
    const name = newFanName.trim()
    if (!name) return
    const id = 'fan-' + Date.now().toString(36)
    try {
      await fanflowCreateFan(id, name)
      setFans(await fanflowFans())
      setNewFanName('')
      selectFan(id)
    } catch (e) { setError(e.message) }
  }

  function refreshSideData() {
    fanflowFans().then(setFans).catch(() => {})
    fanflowEvents(40).then(setEvents).catch(() => {})
    fanflowFanMemory(fanId).then(setFanDetail).catch(() => {})
  }

  async function send(overrideText) {
    const text = (overrideText ?? input).trim()
    if (!text || sending || !status) return
    setInput('')
    setMessages(prev => [...prev, { id: Date.now().toString(36) + 'u', role: 'user', text, at: Date.now() }])
    setSending(true)
    setLastTrace(null)
    try {
      const res = await fanflowChat({
        fanId,
        characterId: charId,
        message: text,
        persona: personaFromInfluencer(selectedChar),
      })
      setMessages(prev => [...prev, { id: Date.now().toString(36) + 'a', role: 'assistant', text: res.reply, intent: res.intent, media: res.media, at: Date.now() }])
      setLastTrace(res)
      refreshSideData()
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now().toString(36) + 'e', role: 'error', text: e.message, at: Date.now() }])
      if (e.message.includes('not reachable')) setStatus(null) // server died mid-session
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ paddingTop: 'var(--shell-top)', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '22px 24px', minHeight: 'calc(100vh - var(--shell-top))', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(139,92,246,0.4)', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5-6.3 4.5L8 13.8l-6-4.6h7.6z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>FanFlow</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>AI Creator OS — memory · workflow · relationship engine</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusPill status={status} checking={checking} />
            <Link to="/settings" style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)', background: 'var(--surface)', transition: 'all 0.15s',
            }}>Settings</Link>
          </div>
        </div>

        {!status ? (
          <OfflineState checking={checking} error={error} onRetry={bootstrap} />
        ) : (
          <>
            {/* Character strip */}
            <CharStrip influencers={influencers} charId={charId} onSelect={selectChar} />

            {/* Main */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <FanRail fans={fans} fanId={fanId} onSelect={selectFan} newName={newFanName} setNewName={setNewFanName} onCreate={createFan} />

              {/* Chat column */}
              <div style={{ flex: 1, minWidth: 360, height: PANEL_H, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar src={selectedChar ? infAvatar(selectedChar) : null} name={selectedChar ? selectedChar.name : 'F'} size={32} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{selectedChar ? selectedChar.name : 'FanFlow'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {selectedChar ? `${selectedChar.niche || 'creator'} · fictional AI character` : 'generic assistant'}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                    fan: <b style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{currentFan?.name || fanId}</b>
                  </div>
                </div>

                <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {messages.length === 0 && !sending && <EmptyThread onPick={send} />}
                  {messages.map(m => <MessageBubble key={m.id} m={m} char={selectedChar} />)}
                  {sending && <Typing char={selectedChar} />}
                </div>

                {/* Composer */}
                <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                      rows={1}
                      placeholder={`Message ${selectedChar ? selectedChar.name : 'your creator'}…`}
                      style={{ flex: 1, resize: 'none', minHeight: 44, maxHeight: 120, padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 }}
                    />
                    <button
                      onClick={() => send()}
                      disabled={sending || !input.trim()}
                      style={{
                        width: 44, height: 44, borderRadius: 12, background: GRAD, color: '#fff', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 10px rgba(139,92,246,0.35)', opacity: (!input.trim() || sending) ? 0.5 : 1,
                        transition: 'all 0.15s, transform 0.1s',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                    </button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Enter to send · Shift+Enter for a new line</span>
                    {sending && <span style={{ color: '#8B5CF6', fontWeight: 600 }}>running workflow…</span>}
                  </div>
                </div>
              </div>

              {/* Right panel */}
              <div style={{ width: 320, height: PANEL_H, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 4 }}>
                  {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                      flex: 1, padding: '6px 2px', borderRadius: 8, fontSize: 11.5, fontWeight: tab === t.id ? 700 : 500,
                      color: tab === t.id ? '#8B5CF6' : 'var(--text-secondary)',
                      background: tab === t.id ? 'var(--accent-light)' : 'transparent',
                      transition: 'all 0.15s',
                    }}>{t.label}</button>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                  {tab === 'trace' && <TraceView trace={lastTrace} />}
                  {tab === 'relationship' && <RelationshipView fan={currentFan} detail={fanDetail} />}
                  {tab === 'memory' && <MemoryView detail={fanDetail} />}
                  {tab === 'events' && <EventsView events={events} />}
                  {tab === 'system' && <SystemView registry={registry} status={status} />}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
