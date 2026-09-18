import Image from 'next/image'
import Link from 'next/link'
import { listPublicSellBanners } from '@/lib/sell-banners-admin'
import { resolveSellBannerImage } from '@/lib/sell-banners'

const FALLBACK = {
  title: 'Start selling on Vero360',
  body: 'Create a merchant account in the Vero360 app, list your products or services, and reach customers across Malawi.',
  ctaLabel: 'Sell now',
  imageUrl: null as string | null,
}

export default async function SellBannerSection() {
  const banners = await listPublicSellBanners(6)
  const banner = banners[0] ?? FALLBACK
  const imageSrc = resolveSellBannerImage(banner.imageUrl)

  return (
    <section
      id="sell"
      style={{
        padding: '28px 24px',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF7ED 100%)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 24,
            padding: 'clamp(28px, 4vw, 40px) clamp(24px, 4vw, 40px)',
            background: 'linear-gradient(135deg, #9A3412 0%, #EA580C 55%, #F97316 100%)',
            color: '#fff',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: -40,
              top: -50,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', maxWidth: 720, flex: '1 1 280px' }}>
            <p
              style={{
                margin: '0 0 10px',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              Sell on Vero360
            </p>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(24px, 3.5vw, 34px)',
                fontWeight: 900,
                letterSpacing: '-0.4px',
                fontFamily: 'var(--font-display)',
                lineHeight: 1.15,
              }}
            >
              {banner.title}
            </h2>
            {banner.body ? (
              <p
                style={{
                  margin: '12px 0 0',
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.88)',
                  maxWidth: 560,
                }}
              >
                {banner.body}
              </p>
            ) : null}
          </div>

          <div
            style={{
              position: 'relative',
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {imageSrc ? (
              <div
                style={{
                  position: 'relative',
                  width: 120,
                  height: 120,
                  borderRadius: 18,
                  overflow: 'hidden',
                  border: '2px solid rgba(255,255,255,0.35)',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.2)',
                  background: 'rgba(255,255,255,0.12)',
                }}
              >
                <Image
                  src={imageSrc}
                  alt=""
                  fill
                  sizes="120px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ) : null}
            <Link
              href="/get-started?role=merchant"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 28px',
                borderRadius: 12,
                background: '#fff',
                color: '#9A3412',
                fontWeight: 800,
                fontSize: 16,
                boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                textDecoration: 'none',
              }}
            >
              {banner.ctaLabel || 'Sell now'}
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
