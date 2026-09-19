'use client'

import Image from 'next/image'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
import StoreDownloadLinks from '@/app/components/landing/StoreDownloadLinks'

const STEPS = [
  {
    n: '1',
    title: 'Open or download the Vero360 app',
    body: 'Install Vero360 from the App Store or Google Play, then open the app to create your account.',
  },
  {
    n: '2',
    title: 'Select Merchant',
    body: 'On Create your account, tap Merchant (store icon) so you register as a seller.',
  },
  {
    n: '3',
    title: 'Select your service',
    body: 'Choose Marketplace, Food & Restaurants, or Accommodation, then finish your business details and create the account.',
  },
]

const SERVICES = [
  {
    name: 'Marketplace',
    desc: 'Sell products to customers across Malawi.',
    image: '/sell-guide/merchant-service-select.png',
    alt: 'Vero360 app: Merchant selected with Marketplace highlighted in the service menu',
  },
  {
    name: 'Food & Restaurants',
    desc: 'List your menu and take food orders.',
    image: '/sell-guide/food-register.png',
    alt: 'Vero360 app: Merchant selected with Food & Restaurants highlighted in the service menu',
  },
  {
    name: 'Accommodation',
    desc: 'List stays, rooms, and guest bookings.',
    image: '/sell-guide/accommodation-register.png',
    alt: 'Vero360 app: Merchant selected with Accommodation highlighted in the service menu',
  },
]

export default function StartSellingPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #9A3412 0%, #F97316 45%, #EA580C 100%)',
          padding: '40px 24px 72px',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Logo height={42} textColor="#fff" />
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              marginTop: 20,
              color: 'rgba(255,255,255,0.85)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Back to home
          </Link>
          <h1
            style={{
              margin: '24px 0 10px',
              fontSize: 'clamp(30px, 5vw, 46px)',
              fontWeight: 900,
              color: '#fff',
              letterSpacing: '-0.5px',
              fontFamily: 'var(--font-display)',
              lineHeight: 1.1,
            }}
          >
            Start selling on Vero360
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              color: 'rgba(255,255,255,0.82)',
              maxWidth: 560,
              lineHeight: 1.65,
            }}
          >
            Follow these steps in the app to register as a merchant for Marketplace, restaurants, or
            accommodation.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '-40px auto 0', padding: '0 24px 80px' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            border: '1px solid var(--border)',
            boxShadow: '0 16px 40px rgba(154, 52, 18, 0.12)',
            padding: '28px 24px',
            display: 'grid',
            gap: 18,
          }}
        >
          {STEPS.map(step => (
            <div
              key={step.n}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr',
                gap: 14,
                alignItems: 'start',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #EA580C, #F97316)',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 18,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {step.n}
              </div>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text)',
                  }}
                >
                  {step.title}
                </h2>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: 'var(--text-2)',
                  }}
                >
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <h2
          style={{
            margin: '36px 0 10px',
            fontSize: 22,
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
          }}
        >
          Pick your merchant service
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6 }}>
          After you tap Merchant, open the service menu and choose one. Screenshots match what you see
          in the app:
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 20,
          }}
          className="sell-service-grid"
        >
          {SERVICES.map(s => (
            <article
              key={s.name}
              style={{
                background: '#fff',
                borderRadius: 20,
                border: '1px solid var(--border)',
                overflow: 'hidden',
                boxShadow: '0 10px 28px rgba(0,0,0,0.06)',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  aspectRatio: '9 / 16',
                  background: '#F9FAFB',
                }}
              >
                <Image
                  src={s.image}
                  alt={s.alt}
                  fill
                  unoptimized
                  style={{ objectFit: 'cover', objectPosition: 'top center' }}
                  sizes="(max-width: 900px) 100vw, 320px"
                />
              </div>
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{s.name}</div>
                <div style={{ marginTop: 4, fontSize: 14, color: 'var(--text-3)', lineHeight: 1.45 }}>
                  {s.desc}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div style={{ marginTop: 28, maxWidth: 360 }}>
          <StoreDownloadLinks maxWidth={360} />
        </div>

        <p
          style={{
            marginTop: 28,
            fontSize: 14,
            color: 'var(--text-3)',
            textAlign: 'center',
          }}
        >
          Prefer a full merchant tutorial?{' '}
          <Link href="/get-started?role=merchant" style={{ color: 'var(--primary)', fontWeight: 700 }}>
            Watch get started video
          </Link>
        </p>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .sell-service-grid {
            grid-template-columns: 1fr !important;
            max-width: 360px;
            margin: 0 auto;
          }
        }
      `}</style>
    </main>
  )
}
