import { useInfluencers } from '../store'
import { Link } from 'react-router-dom'

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  )
}

function Stat({ label, value, color, max }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : value
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{max ? `${value}/${max}` : value}</span>
      </div>
      {max && (
        <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: color || '#8B5CF6', transition: 'width 0.5s' }} />
        </div>
      )}
    </div>
  )
}

function computeHealth(inf) {
  const history = inf.generationHistory || []
  const wardrobe = inf.wardrobeSlots || []
  const homeImgs = inf.homeImages || []
  const brandDealImgs = inf.brandDealImages || []
  const videos = history.filter(e => e.type === 'video')
  const images = history.filter(e => e.type === 'image')

  // Total output
  const totalAssets = images.length + videos.length + homeImgs.length + brandDealImgs.length

  // Outfit variety
  const outfitVariety = Math.min(10, wardrobe.length + (images.length > 0 ? 1 : 0) + (videos.length > 0 ? 1 : 0))

  // Pose variety (approximate from photo studio history)
  const poseScore = Math.min(10, Math.round(images.length * 0.8 + videos.length * 0.5))

  // Location variety
  const locationScore = Math.min(10, Math.round(1 + images.length * 0.3 + homeImgs.length * 0.5))

  // Content consistency (how evenly spread across types)
  const total = images.length + videos.length + homeImgs.length + brandDealImgs.length || 1
  const ideal = total / 4
  const variance = (
    Math.abs(images.length - ideal) +
    Math.abs(videos.length - ideal) +
    Math.abs(homeImgs.length - ideal) +
    Math.abs(brandDealImgs.length - ideal)
  ) / 4
  const consistency = Math.max(0, Math.min(10, Math.round(10 - variance)))

  // Face drift risk (more photos = more consistent, no photos = risky)
  const faceDriftRisk = images.length < 3 ? 7 : images.length < 6 ? 4 : 1

  return { totalAssets, outfitVariety, poseScore, locationScore, consistency, faceDriftRisk }
}

export default function CharacterHealth() {
  const [influencers] = useInfluencers()

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#34C759,#60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>❤️</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>Character Health Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Consistency, variety, and face-drift risk for each influencer</p>
          </div>
        </div>

        {influencers.length === 0 ? (
          <Section title="No characters">
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Create an influencer first to see health metrics.
            </p>
            <Link to="/create" style={{ display: 'inline-block', marginTop: 12, padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg, #EC4899, #8B5CF6)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>+ Create</Link>
          </Section>
        ) : (
          influencers.map(inf => {
            const h = computeHealth(inf)
            return (
              <Section key={inf.id} title={inf.name}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <Stat label="Total Assets" value={h.totalAssets} color="#8B5CF6" max={100} />
                    <Stat label="Outfit Variety" value={h.outfitVariety} color="#0A84FF" max={10} />
                    <Stat label="Pose Variety" value={h.poseScore} color="#FF9F0A" max={10} />
                  </div>
                  <div>
                    <Stat label="Location Variety" value={h.locationScore} color="#34C759" max={10} />
                    <Stat label="Content Consistency" value={h.consistency} color="#8B5CF6" max={10} />
                    <Stat label="Face Drift Risk" value={h.faceDriftRisk} color={h.faceDriftRisk > 5 ? '#FF3B30' : '#FF9F0A'} max={10} />
                  </div>
                </div>
                {h.faceDriftRisk > 5 && (
                  <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)', fontSize: 13, color: '#FF3B30', lineHeight: 1.5 }}>
                    ⚠️ Low photo count — consider generating more reference images to maintain face consistency.
                  </div>
                )}
                {h.outfitVariety < 3 && (
                  <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.18)', fontSize: 13, color: '#FF9F0A', lineHeight: 1.5 }}>
                    💡 Add wardrobe items or generate more outfit variations to improve variety.
                  </div>
                )}
              </Section>
            )
          })
        )}
      </div>
    </div>
  )
}