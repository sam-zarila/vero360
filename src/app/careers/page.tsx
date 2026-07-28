import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'

const openings = [
  {
    emoji: '📣',
    title: 'Marketing',
    desc: 'Help us grow Vero360 across Malawi — campaigns, partnerships, community outreach, and brand strategy.',
  },
  {
    emoji: '🎨',
    title: 'Graphic Design',
    desc: 'Create visuals for our app, social media, marketing materials, and brand identity.',
  },
  {
    emoji: '🎬',
    title: 'Video & Content Creation',
    desc: 'Produce tutorials, promotional videos, and social content that tells the Vero360 story.',
  },
  {
    emoji: '💻',
    title: 'Developers',
    desc: 'Build and improve our platform — mobile, web, and backend systems that power everyday services.',
  },
]

const APPLY_EMAIL = 'info@vero360.app'
const applyMailto = `mailto:${APPLY_EMAIL}?subject=${encodeURIComponent('Vero360 Careers Application')}&body=${encodeURIComponent('Hi Vero360 team,\n\nI would like to apply for a role at Vero360.\n\nName:\nRole applying for:\n\nPlease find my CV and qualifications attached.\n\nThank you.')}`

export default function CareersPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <div style={{
        background: 'linear-gradient(135deg, #9A3412 0%, #F97316 45%, #EA580C 100%)',
        padding: '48px 24px 80px',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 28 }}>
            <Logo height={44} textColor="#fff" />
          </div>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 500,
            marginBottom: 32,
          }}>
            ← Back to home
          </Link>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, color: '#fff',
            letterSpacing: '-0.5px', marginBottom: 12, fontFamily: 'var(--font-display)',
          }}>
            Careers at Vero360
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, maxWidth: 520 }}>
            We&apos;re a young team building Malawi&apos;s super app. If you&apos;re passionate about technology and impact, we want to hear from you.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '-48px auto 0', padding: '0 24px 80px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20,
        }} className="careers-grid">
          {openings.map(role => (
            <div key={role.title} style={{
              background: '#fff', borderRadius: 20,
              border: '1px solid var(--border)',
              padding: '32px 28px',
              boxShadow: 'var(--shadow)',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'var(--primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, marginBottom: 18,
              }}>{role.emoji}</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, fontFamily: 'var(--font-display)' }}>
                {role.title}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.7 }}>
                {role.desc}
              </p>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 40, background: '#fff', borderRadius: 20,
          border: '1px solid var(--border)', padding: '40px 36px',
          textAlign: 'center', boxShadow: 'var(--shadow)',
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, fontFamily: 'var(--font-display)' }}>
            Ready to join us?
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 28, maxWidth: 480, margin: '0 auto 28px' }}>
            Send us your CV and qualifications at {APPLY_EMAIL}. Tell us which role you&apos;re applying for and what you&apos;d bring to the team.
          </p>
          <a
            href={applyMailto}
            className="careers-apply-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 12,
              background: 'var(--primary)', color: '#fff',
              fontWeight: 700, fontSize: 16,
              boxShadow: 'var(--shadow-primary)',
            }}
          >
            Apply now
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
              <path d="M4 6h16v12H4V6zm0 0l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </div>

      <style>{`
        .careers-apply-btn:hover {
          background: var(--primary-dark);
          transform: translateY(-1px);
        }
        @media (max-width: 640px) {
          .careers-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}
