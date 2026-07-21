'use client'

import { useEffect, useState } from 'react'

const services = [
  {
    id: 'vero-ride',
    emoji: '🚗',
    name: 'Vero Ride',
    tagline: 'Transport on demand',
    desc: 'Book cars, bikes, and airport pickups. Track your driver in real-time with upfront pricing.',
    badge: 'Popular',
    badgeColor: '#F97316',
    features: ['Cars, SUVs & bikes', 'Airport pickup', 'Live tracking'],
    videoTitle: 'How to use Vero Ride',
    videoDesc: 'Learn how to book a ride, track your driver, and pay securely on Vero360.',
    // Set to a video URL or embed src when the tutorial is ready
    videoUrl: null as string | null,
  },
  {
    id: 'marketplace',
    emoji: '🛒',
    name: 'Marketplace',
    tagline: 'Shop local',
    desc: 'Browse products from verified merchants. Secure payments held until both parties are satisfied.',
    badge: 'New',
    badgeColor: '#22C55E',
    features: ['Verified sellers', 'Secure escrow', 'Fast delivery'],
    videoTitle: 'How to use Marketplace',
    videoDesc: 'See how to browse products, place orders, and shop safely with escrow on Vero360.',
    videoUrl: null as string | null,
  },
  {
    id: 'vero-courier',
    emoji: '🚚',
    name: 'Vero Courier',
    tagline: 'Send anything',
    desc: 'Same-day parcel and document delivery across the city. Track your package every step of the way.',
    badge: 'Fast',
    badgeColor: '#F59E0B',
    features: ['Same-day delivery', 'Live tracking', 'Proof of delivery'],
    videoTitle: 'How to use Vero Courier',
    videoDesc: 'Learn how to send parcels, track deliveries, and confirm receipt on Vero360.',
    videoUrl: null as string | null,
  },
  {
    id: 'food',
    emoji: '🍔',
    name: 'Food',
    tagline: 'Order nearby',
    desc: 'Discover restaurants and food vendors near you. Order meals and get them delivered to your door.',
    badge: 'Trending',
    badgeColor: '#EF4444',
    features: ['Local restaurants', 'Quick delivery', 'Easy reorder'],
    videoTitle: 'How to order food',
    videoDesc: 'Learn how to find restaurants, place food orders, and track delivery on Vero360.',
    videoUrl: null as string | null,
  },
  {
    id: 'stay',
    emoji: '🛏️',
    name: 'Stay',
    tagline: 'Accommodation',
    desc: 'Book hotels, lodges, and short-stay accommodation. Compare options and reserve in seconds.',
    badge: 'Book now',
    badgeColor: '#8B5CF6',
    features: ['Hotels & lodges', 'Instant booking', 'Best rates'],
    videoTitle: 'How to book accommodation',
    videoDesc: 'See how to browse stays, compare options, and complete a booking on Vero360.',
    videoUrl: null as string | null,
  },
  {
    id: 'jobs',
    emoji: '💼',
    name: 'Jobs',
    tagline: 'Find work',
    desc: 'Browse job listings and connect with employers. Apply directly from the app.',
    badge: 'Hiring',
    badgeColor: '#3B82F6',
    features: ['Local listings', 'Easy apply', 'Employer chat'],
    videoTitle: 'How to find jobs',
    videoDesc: 'Learn how to browse listings, apply for roles, and chat with employers on Vero360.',
    videoUrl: null as string | null,
  },
]

type Service = (typeof services)[number]

export default function ServicesSection() {
  const [activeService, setActiveService] = useState<Service | null>(null)

  useEffect(() => {
    if (!activeService) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveService(null)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [activeService])

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
            <div key={s.id} className="service-card" style={{
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
                  <button
                    type="button"
                    onClick={() => setActiveService(s)}
                    className={i === 0 ? 'service-cta service-cta-primary' : 'service-cta service-cta-secondary'}
                  >
                    View tutorial
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeService && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-title"
          onClick={() => setActiveService(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '32px 28px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
              <div>
                <span style={{
                  display: 'inline-block', padding: '4px 12px', marginBottom: 10,
                  background: 'var(--primary-light)', color: 'var(--primary-dark)',
                  borderRadius: 100, fontSize: 12, fontWeight: 700,
                }}>
                  {activeService.emoji} {activeService.name} tutorial
                </span>
                <h3 id="tutorial-title" style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                  {activeService.videoTitle}
                </h3>
                <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.7, marginTop: 8 }}>
                  {activeService.videoDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveService(null)}
                aria-label="Close tutorial"
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  border: '1px solid var(--border)', background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-2)', fontSize: 20, lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              aspectRatio: '16 / 9',
              borderRadius: 16,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            }}>
              {activeService.videoUrl ? (
                <iframe
                  src={activeService.videoUrl}
                  title={activeService.videoTitle}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ width: '100%', height: '100%', border: 0 }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 12,
                }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="28" height="28" fill="#fff" viewBox="0 0 24 24" aria-hidden>
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 500, textAlign: 'center', padding: '0 24px' }}>
                    Tutorial video for {activeService.name} — coming soon
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .service-card { transition: box-shadow 0.3s, transform 0.3s; }
        .service-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-4px); }
        .service-cta {
          display: block; width: 100%; text-align: center;
          padding: 13px 24px; border-radius: 12px;
          font-weight: 600; font-size: 15px;
          transition: all 0.2s; cursor: pointer;
          font-family: inherit;
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
