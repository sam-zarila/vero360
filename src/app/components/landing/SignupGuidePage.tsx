'use client'

import Image from 'next/image'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
import StoreDownloadLinks from '@/app/components/landing/StoreDownloadLinks'
import type { SellBannerAudience, SellBannerAudienceKey } from '@/lib/sell-banners'
import { parseSellBannerAudience } from '@/lib/sell-banners'

type GuideConfig = {
  eyebrow: string
  title: string
  subtitle: string
  steps: Array<{ n: string; title: string; body: string }>
  screenshot: string
  screenshotAlt: string
  videoHref: string
  videoLabel: string
}

const GUIDES: Record<SellBannerAudienceKey, GuideConfig> = {
  marketplace: {
    eyebrow: 'Marketplace merchant',
    title: 'Start selling on Marketplace',
    subtitle:
      'Register as a Merchant in the app, then choose Marketplace to list products for customers across Malawi.',
    steps: [
      {
        n: '1',
        title: 'Open or download the Vero360 app',
        body: 'Install Vero360 from the App Store or Google Play, then open the app.',
      },
      {
        n: '2',
        title: 'Select Merchant',
        body: 'On Create your account, tap Merchant (store icon).',
      },
      {
        n: '3',
        title: 'Select Marketplace',
        body: 'Open the service menu and choose Marketplace, then finish signup.',
      },
    ],
    screenshot: '/sell-guide/merchant-service-select.png',
    screenshotAlt: 'Vero360 app: Merchant with Marketplace selected in the service menu',
    videoHref: '/get-started?role=merchant',
    videoLabel: 'Watch merchant get started video',
  },
  food: {
    eyebrow: 'Food & Restaurants',
    title: 'Sell food on Vero360',
    subtitle:
      'Register as a Merchant, then choose Food & Restaurants to list your menu and take orders.',
    steps: [
      {
        n: '1',
        title: 'Open or download the Vero360 app',
        body: 'Install Vero360 from the App Store or Google Play, then open the app.',
      },
      {
        n: '2',
        title: 'Select Merchant',
        body: 'On Create your account, tap Merchant (store icon).',
      },
      {
        n: '3',
        title: 'Select Food & Restaurants',
        body: 'Open the service menu and choose Food & Restaurants, then finish signup.',
      },
    ],
    screenshot: '/sell-guide/food-register.png',
    screenshotAlt: 'Vero360 app: Merchant with Food & Restaurants selected',
    videoHref: '/get-started?role=merchant',
    videoLabel: 'Watch merchant get started video',
  },
  accommodation: {
    eyebrow: 'Accommodation',
    title: 'List stays on Vero360',
    subtitle:
      'Register as a Merchant, then choose Accommodation to list rooms and guest bookings.',
    steps: [
      {
        n: '1',
        title: 'Open or download the Vero360 app',
        body: 'Install Vero360 from the App Store or Google Play, then open the app.',
      },
      {
        n: '2',
        title: 'Select Merchant',
        body: 'On Create your account, tap Merchant (store icon).',
      },
      {
        n: '3',
        title: 'Select Accommodation',
        body: 'Open the service menu and choose Accommodation, then finish signup.',
      },
    ],
    screenshot: '/sell-guide/accommodation-register.png',
    screenshotAlt: 'Vero360 app: Merchant with Accommodation selected',
    videoHref: '/get-started?role=merchant',
    videoLabel: 'Watch merchant get started video',
  },
  driver: {
    eyebrow: 'Driver',
    title: 'Become a Vero360 driver',
    subtitle: 'Create a driver account in the app to accept rides and deliveries on your schedule.',
    steps: [
      {
        n: '1',
        title: 'Open or download the Vero360 app',
        body: 'Install Vero360 from the App Store or Google Play, then open the app.',
      },
      {
        n: '2',
        title: 'Select Driver',
        body: 'On Create your account, tap Driver (car icon) — not Customer or Merchant.',
      },
      {
        n: '3',
        title: 'Finish signup and start earning',
        body: 'Enter your details, agree to the terms, create your account, then complete driver verification when prompted.',
      },
    ],
    screenshot: '/sell-guide/driver-register.png',
    screenshotAlt: 'Vero360 app: Create your account with Driver selected',
    videoHref: '/get-started?role=driver',
    videoLabel: 'Watch driver get started video',
  },
}

export function SignupGuidePage({ audience }: { audience: SellBannerAudience | SellBannerAudienceKey }) {
  const key = parseSellBannerAudience(audience)
  const guide = GUIDES[key]

  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #9A3412 0%, #F97316 45%, #EA580C 100%)',
          padding: '40px 24px 72px',
        }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
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
          <p
            style={{
              margin: '20px 0 0',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            {guide.eyebrow}
          </p>
          <h1
            style={{
              margin: '8px 0 10px',
              fontSize: 'clamp(30px, 5vw, 46px)',
              fontWeight: 900,
              color: '#fff',
              letterSpacing: '-0.5px',
              fontFamily: 'var(--font-display)',
              lineHeight: 1.1,
            }}
          >
            {guide.title}
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
            {guide.subtitle}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: '-40px auto 0', padding: '0 24px 80px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 300px)',
            gap: 28,
            alignItems: 'start',
          }}
          className="signup-guide-grid"
        >
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
            {guide.steps.map(step => (
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

            <div style={{ marginTop: 8, maxWidth: 360 }}>
              <StoreDownloadLinks maxWidth={360} />
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              borderRadius: 24,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.12)',
              background: '#F9FAFB',
              aspectRatio: '9 / 16',
              maxWidth: 300,
              margin: '0 auto',
              width: '100%',
            }}
          >
            <Image
              src={guide.screenshot}
              alt={guide.screenshotAlt}
              fill
              unoptimized
              priority
              style={{ objectFit: 'cover', objectPosition: 'top center' }}
              sizes="300px"
            />
          </div>
        </div>

        <p
          style={{
            marginTop: 28,
            fontSize: 14,
            color: 'var(--text-3)',
            textAlign: 'center',
          }}
        >
          Prefer a full tutorial?{' '}
          <Link href={guide.videoHref} style={{ color: 'var(--primary)', fontWeight: 700 }}>
            {guide.videoLabel}
          </Link>
        </p>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .signup-guide-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  )
}
