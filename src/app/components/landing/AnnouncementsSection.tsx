import Image from 'next/image'
import {
  formatAnnouncementPostedAt,
  resolveAnnouncementImage,
  type Announcement,
} from '@/lib/announcements'
import { listPublicAnnouncements } from '@/lib/announcements-admin'

function AnnouncementCard({ item }: { item: Announcement }) {
  const img = resolveAnnouncementImage(item.imageUrl)
  return (
    <article
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 100,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          background: 'linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%)',
        }}
      >
        {img ? (
          <Image src={img} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: '#9A3412',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.02em',
            }}
          >
            Vero360
          </div>
        )}
      </div>
      <div style={{ padding: '20px 20px 22px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <time
          dateTime={item.postedAt || undefined}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--primary)',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        >
          {formatAnnouncementPostedAt(item.postedAt)}
        </time>
        <h3
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '-0.3px',
            lineHeight: 1.25,
            fontFamily: 'var(--font-display)',
          }}
        >
          {item.title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.55,
            color: 'var(--text-2)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {item.description}
        </p>
      </div>
    </article>
  )
}

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

        <div
          className="announce-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: items.length === 1 ? 'minmax(0, 560px)' : 'repeat(3, 1fr)',
            gap: 24,
            justifyContent: 'center',
          }}
        >
          {items.map(item => (
            <AnnouncementCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .announce-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .announce-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
