import { listPublicAnnouncements } from '@/lib/announcements-admin'
import AnnouncementsClient from './AnnouncementsClient'

export default async function AnnouncementsSection() {
  const items = await listPublicAnnouncements(12)
  if (items.length === 0) return null

  return (
    <section
      id="announcements"
      style={{
        padding: '88px 24px',
        background: 'linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 42%, #FFFFFF 100%)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '6px 16px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            Announcements
          </span>
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 44px)',
              letterSpacing: '-0.5px',
              marginBottom: 14,
              fontFamily: 'var(--font-display)',
            }}
          >
            What’s new at Vero360
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text-3)', maxWidth: 520, margin: '0 auto' }}>
            Updates, launches, and news from the team.
          </p>
        </div>

        <AnnouncementsClient items={items} />
      </div>
    </section>
  )
}
