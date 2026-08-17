'use client'

import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
import { appStoreLinks } from '@/app/components/landing/veroServices'
import type { ListingModel } from '@/lib/open-listing'

const page: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--surface)',
}
const top: CSSProperties = {
  background: 'linear-gradient(135deg, #9A3412 0%, #F97316 45%, #EA580C 100%)',
  padding: '28px 24px 36px',
}
const body: CSSProperties = {
  maxWidth: 560,
  margin: '-28px auto 0',
  padding: '0 24px 80px',
}
const hero: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 10',
  objectFit: 'cover',
  borderRadius: 18,
  background: 'var(--surface-2)',
  display: 'block',
}
const card: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 20,
  padding: 20,
  boxShadow: 'var(--shadow)',
  marginTop: 18,
}
const btn: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'center',
  textDecoration: 'none',
  borderRadius: 14,
  padding: '14px 16px',
  fontWeight: 800,
  marginTop: 10,
}

export default function OpenListingView({ listing }: { listing: ListingModel }) {
  const { kind, id, title, location, price, period, image, appHref } = listing
  const showImage = /^https?:\/\//i.test(image)
  const priceLabel = price ? `MWK ${price}${period ? ` ${period}` : ''}` : ''

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('apptry') === '1') return

    const ua = navigator.userAgent || ''
    if (/Vero360|Flutter/i.test(ua)) return

    const isAndroid = /Android/i.test(ua)
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    if (!isAndroid && !isIOS) return

    const appPath = kind === 'marketplace' ? 'marketplace' : 'accommodation'

    if (isAndroid) {
      const fallback = new URL(window.location.href)
      fallback.searchParams.set('apptry', '1')
      window.location.replace(
        `intent://${appPath}${id ? `/${id}` : ''}` +
          '#Intent;scheme=vero360;package=com.vero265.app;S.browser_fallback_url=' +
          encodeURIComponent(fallback.toString()) +
          ';end',
      )
      return
    }

    window.location.href = appHref
  }, [appHref, id, kind])

  return (
    <main style={page}>
      <header style={top}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Logo height={40} textColor="#fff" />
          </Link>
        </div>
      </header>

      <section style={body}>
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {showImage ? <img style={hero} src={image} alt={title} /> : null}
          <div style={{ padding: 20 }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: -0.4,
                fontFamily: 'var(--font-display)',
                marginBottom: 6,
              }}
            >
              {title}
            </h1>
            {location ? (
              <p style={{ color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>
                {location}
              </p>
            ) : null}
            {priceLabel ? (
              <p
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: 'var(--primary-dark)',
                  marginBottom: 4,
                }}
              >
                {priceLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div style={card}>
          <a
            href={appHref}
            style={{ ...btn, background: 'var(--primary-dark)', color: '#fff' }}
          >
            Open in Vero360 app
          </a>
          <a
            href={appStoreLinks.android}
            style={{ ...btn, background: 'var(--primary-light)', color: 'var(--text)' }}
          >
            Get the app
          </a>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-3)',
              marginTop: 12,
              lineHeight: 1.45,
            }}
          >
            Have Vero360? This {kind === 'marketplace' ? 'listing' : 'stay'} opens
            in the app. If you don’t, you can view it here.
          </p>
        </div>
      </section>
    </main>
  )
}
