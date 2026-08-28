// Workspace — the merged Influencers + FanFlow surface.
//
// Previously these were two separate deployments:
//   ai-influencer-roan.vercel.app/influencers
//   fan-flow-five.vercel.app/fanflow
// They are now two tabs on one page, sharing one origin — which means they
// share one localStorage, so the influencer roster written by the Influencers
// tab is the same roster FanFlow reads for its persona picker. (See
// DATA_LAYER.md for what "same DB" does and does not yet mean.)
//
// Layout note: Influencers renders a `position: fixed` full-viewport pane
// anchored to --shell-top, while FanFlow is a normal in-flow page that pads
// itself by --shell-top. Both read the same variable, so raising --shell-top
// here (nav + tab bar) correctly offsets both without either page knowing it
// is embedded.
//
// Both tabs stay MOUNTED across switches — the inactive one is hidden with
// `display: none` rather than unmounted. Influencers holds a lot of transient
// state (selected influencer, open sub-tab, in-flight generations) that would
// be destroyed by unmounting, and FanFlow keeps its thread and poll loop warm.

import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../context/theme'
import Influencers from './Influencers'
import FanFlow from './FanFlow'

const TABS = [
  {
    key: 'influencers',
    path: '/influencers',
    label: 'Influencers',
    hint: 'Roster, character DNA, content studio',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: 'fanflow',
    path: '/fanflow',
    label: 'FanFlow',
    hint: 'Memory, workflow, relationship engine',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5-6.3 4.5L8 13.8l-6-4.6h7.6z" />
      </svg>
    ),
  },
]

export default function Workspace() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isDark } = useTheme()

  // The URL is the source of truth for the active tab, so /influencers and
  // /fanflow keep working as deep links and the back button moves between tabs.
  const active = pathname.startsWith('/fanflow') ? 'fanflow' : 'influencers'

  // Raise the shell offset for as long as the tab bar is on screen, then put it
  // back so standalone routes (and Influencers rendered outside the Workspace)
  // are unaffected.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--shell-top', 'calc(var(--nav-h) + var(--tabs-h))')
    return () => root.style.removeProperty('--shell-top')
  }, [])

  return (
    <>
      <div
        role="tablist"
        aria-label="Workspace"
        style={{
          position: 'fixed',
          top: 'var(--nav-h)',
          left: 0,
          right: 0,
          height: 'var(--tabs-h)',
          zIndex: 90,
          display: 'flex',
          alignItems: 'stretch',
          gap: 2,
          padding: '0 20px',
          background: isDark ? 'rgba(7,7,14,0.88)' : 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(24px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {TABS.map(t => {
          const on = active === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              title={t.hint}
              onClick={() => navigate(t.path)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '0 15px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13.5,
                fontWeight: on ? 650 : 500,
                letterSpacing: '-0.1px',
                color: on
                  ? (isDark ? 'rgba(255,255,255,0.95)' : '#1D1D1F')
                  : (isDark ? 'rgba(255,255,255,0.42)' : 'var(--text-secondary)'),
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => {
                if (!on) e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.72)' : 'var(--text-primary)'
              }}
              onMouseLeave={e => {
                if (!on) e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.42)' : 'var(--text-secondary)'
              }}
            >
              {t.icon}
              {t.label}
              {/* Active underline, inset so it reads as attached to the label */}
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 10,
                  right: 10,
                  bottom: 0,
                  height: 2,
                  borderRadius: '2px 2px 0 0',
                  background: on ? 'linear-gradient(90deg,#EC4899,#8B5CF6)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              />
            </button>
          )
        })}
      </div>

      {/* Both stay mounted; the inactive one is hidden so its state survives. */}
      <div style={{ display: active === 'influencers' ? 'contents' : 'none' }}>
        <Influencers />
      </div>
      <div style={{ display: active === 'fanflow' ? 'contents' : 'none' }}>
        <FanFlow />
      </div>
    </>
  )
}
