const services = [
  {
    emoji: '🚗',
    name: 'Vero Ride',
    tagline: 'Transport on demand',
    desc: 'Book cars, bikes, and airport pickups. Track your driver in real-time with upfront pricing.',
    badge: 'Popular',
    badgeColor: '#F97316',
    features: ['Cars, SUVs & bikes', 'Airport pickup', 'Live tracking'],
  },
  {
    emoji: '🛒',
    name: 'Marketplace',
    tagline: 'Shop local',
    desc: 'Browse products from verified merchants. Secure payments held until both parties are satisfied.',
    badge: 'New',
    badgeColor: '#22C55E',
    features: ['Verified sellers', 'Secure escrow', 'Fast delivery'],
  },
  {
    emoji: '🚚',
    name: 'Vero Courier',
    tagline: 'Send anything',
    desc: 'Same-day parcel and document delivery across the city. Track your package every step of the way.',
    badge: 'Fast',
    badgeColor: '#F59E0B',
    features: ['Same-day delivery', 'Live tracking', 'Proof of delivery'],
  },
  {
    emoji: '🍔',
    name: 'Food',
    tagline: 'Order nearby',
    desc: 'Discover restaurants and food vendors near you. Order meals and get them delivered to your door.',
    badge: 'Trending',
    badgeColor: '#EF4444',
    features: ['Local restaurants', 'Quick delivery', 'Easy reorder'],
  },
  {
    emoji: '🛏️',
    name: 'Stay',
    tagline: 'Accommodation',
    desc: 'Book hotels, lodges, and short-stay accommodation. Compare options and reserve in seconds.',
    badge: 'Book now',
    badgeColor: '#8B5CF6',
    features: ['Hotels & lodges', 'Instant booking', 'Best rates'],
  },
  {
    emoji: '💼',
    name: 'Jobs',
    tagline: 'Find work',
    desc: 'Browse job listings and connect with employers. Apply directly from the app.',
    badge: 'Hiring',
    badgeColor: '#3B82F6',
    features: ['Local listings', 'Easy apply', 'Employer chat'],
  },
]

export default function ServicesSection() {
  return (
    <section id="services" style={{ padding: '100px 24px', background: 'var(--surface)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span style={{
            display: 'inline-block', padding: '6px 16px',
            background: 'var(--primary-light)', color: 'var(--primary-dark)',
            borderRadius: 100, fontSize: 13, fontWeight: 600, marginBottom: 16,
          }}>All-in-one platform</span>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.5px', marginBottom: 16 }}>
            Everything you need, one app
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text-3)', maxWidth: 560, margin: '0 auto' }}>
            Vero360 connects customers, merchants, and service providers in one secure ecosystem —
            marketplace, transport, food, courier, accommodation, jobs, and more.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24,
        }} className="services-grid">
          {services.map((s, i) => (
            <div key={i} className="service-card" style={{
              background: '#fff',
              borderRadius: 20, border: '1px solid var(--border)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                padding: '32px 28px 24px',
                background: i % 3 === 0
                  ? 'linear-gradient(135deg, #FFF7ED, #FFEDD5)'
                  : i % 3 === 1
                  ? 'linear-gradient(135deg, #FFFBEB, #FEF3C7)'
                  : 'linear-gradient(135deg, #F9FAFB, #F3F4F6)',
              }}>
                <div style={{
                  fontSize: 48, marginBottom: 16,
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
                }}>{s.emoji}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700 }}>{s.name}</h3>
                  <span style={{
                    padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                    background: s.badgeColor, color: '#fff',
                  }}>{s.badge}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{s.tagline}</p>
              </div>

              <div style={{ padding: '24px 28px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>{s.desc}</p>

                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {s.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-2)' }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>

                <div style={{ marginTop: 'auto' }}>
                  <a
                    href="/register"
                    className={i === 0 ? 'service-cta service-cta-primary' : 'service-cta service-cta-secondary'}
                  >
                    Open in app
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .service-card { transition: box-shadow 0.3s, transform 0.3s; }
        .service-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-4px); }
        .service-cta {
          display: block; text-align: center;
          padding: 13px 24px; border-radius: 12px;
          font-weight: 600; font-size: 15px;
          transition: all 0.2s;
        }
        .service-cta-primary { background: var(--primary); border: none; color: #fff; }
        .service-cta-primary:hover { background: var(--primary-dark); }
        .service-cta-secondary { background: transparent; border: 1.5px solid var(--border-2); color: var(--text-2); }
        .service-cta-secondary:hover { border-color: var(--primary); color: var(--primary); }
        @media (max-width: 900px) { .services-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 600px) { .services-grid { grid-template-columns: 1fr !important; max-width: 440px; margin: 0 auto; } }
      `}</style>
    </section>
  )
}
