import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'

const roles = [
  {
    id: 'customer',
    emoji: '👤',
    title: 'Customer',
    desc: 'Shop, ride, order food, book stays, and access every Vero360 service as a user.',
    cta: 'Watch  tutorial video',
    href: '/register?role=customer',
  },
  {
    id: 'merchant',
    emoji: '🏪',
    title: 'Merchant',
    desc: 'List products, manage orders, and grow your business on the Vero360 marketplace.',
    cta: 'Watch tutorial video',
    href: '/register?role=merchant',
  },
  {
    id: 'driver',
    emoji: '🧑‍✈️',
    title: 'Driver',
    desc: 'Join Vero Ride and courier networks. Earn on your schedule with weekly payouts.',
    cta: 'Watch tutorial video',
    href: '/register?role=driver',
  },
]

export default function GetStartedPage() {
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
            Get started with Vero360
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, maxWidth: 520 }}>
            Choose how you want to use the platform,watch the tutorial video to get started.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '-48px auto 0', padding: '0 24px 80px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20,
        }} className="roles-grid">
          {roles.map(role => (
            <Link
              key={role.id}
              href={role.href}
              className="role-card"
              style={{
                background: '#fff', borderRadius: 20,
                border: '1px solid var(--border)',
                padding: '32px 28px',
                display: 'flex', flexDirection: 'column',
                transition: 'box-shadow 0.25s, transform 0.25s, border-color 0.25s',
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'var(--primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, marginBottom: 20,
              }}>{role.emoji}</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, fontFamily: 'var(--font-display)' }}>
                {role.title}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.7, flex: 1, marginBottom: 24 }}>
                {role.desc}
              </p>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                color: 'var(--primary)', fontWeight: 700, fontSize: 15,
              }}>
                {role.cta}
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .role-card:hover {
          box-shadow: var(--shadow-lg);
          transform: translateY(-4px);
          border-color: var(--primary-light);
        }
        @media (max-width: 768px) {
          .roles-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}
