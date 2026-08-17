'use client'

import { useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
import { appStoreLinks } from '@/app/components/landing/veroServices'
import type { ListingModel } from '@/lib/open-listing-types'
import { listingPriceLabel } from '@/lib/open-listing-utils'

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

export default function MarketplaceProductView({ listing }: { listing: ListingModel }) {
  const {
    id,
    title,
    location,
    image,
    gallery,
    description,
    type,
    hostName,
    sellerImage,
    shopId,
    appHref,
  } = listing

  const priceLabel = listingPriceLabel(listing)

  const photos = useMemo(() => {
    const out: string[] = []
    const seen = new Set<string>()
    for (const src of [image, ...gallery]) {
      if (!src || seen.has(src)) continue
      if (!src.startsWith('http') && !src.startsWith('/api/media')) continue
      seen.add(src)
      out.push(src)
    }
    return out
  }, [image, gallery])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('apptry') === '1') return

    const ua = navigator.userAgent || ''
    if (/Vero360|Flutter/i.test(ua)) return

    const isAndroid = /Android/i.test(ua)
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    if (!isAndroid && !isIOS) return

    if (isAndroid) {
      const fallback = new URL(window.location.href)
      fallback.searchParams.set('apptry', '1')
      window.location.replace(
        `intent://marketplace${id ? `/${id}` : ''}` +
          '#Intent;scheme=vero360;package=com.vero265.app;S.browser_fallback_url=' +
          encodeURIComponent(fallback.toString()) +
          ';end',
      )
      return
    }

    window.location.href = appHref
  }, [appHref, id])

  const sellerAvatar =
    sellerImage &&
    (sellerImage.startsWith('http') || sellerImage.startsWith('/api/media'))

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
        {photos.length > 0 ? (
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <img
              src={photos[0]}
              alt={title}
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                objectFit: 'cover',
                display: 'block',
                background: 'var(--surface-2)',
              }}
            />
          </div>
        ) : null}

        <div style={card}>
          {type ? (
            <p
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: 'var(--primary-dark)',
                marginBottom: 8,
              }}
            >
              {type}
            </p>
          ) : null}
          <h1
            style={{
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: -0.4,
              fontFamily: 'var(--font-display)',
              marginBottom: 8,
            }}
          >
            {title}
          </h1>
          {priceLabel ? (
            <p
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: 'var(--primary-dark)',
                marginBottom: 8,
              }}
            >
              {priceLabel}
            </p>
          ) : null}
          {location ? (
            <p style={{ color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>
              {location}
            </p>
          ) : null}
        </div>

        {hostName ? (
          <div style={card}>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 800,
                marginBottom: 12,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Seller
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {sellerAvatar ? (
                <img
                  src={sellerImage}
                  alt={hostName}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    background: 'var(--surface-2)',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'var(--primary-light)',
                    color: 'var(--primary-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {hostName.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>{hostName}</p>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Marketplace seller on Vero360</p>
              </div>
            </div>
            {shopId ? (
              <Link
                href={`/shop/${shopId}`}
                style={{
                  ...btn,
                  background: 'var(--primary-light)',
                  color: 'var(--text)',
                  marginTop: 14,
                }}
              >
                View seller shop
              </Link>
            ) : null}
          </div>
        ) : null}

        {description ? (
          <div style={card}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 800,
                marginBottom: 8,
                fontFamily: 'var(--font-display)',
              }}
            >
              Description
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {description}
            </p>
          </div>
        ) : null}

        {photos.length > 1 ? (
          <div style={card}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 800,
                marginBottom: 12,
                fontFamily: 'var(--font-display)',
              }}
            >
              Photos
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              {photos.slice(1).map((src, index) => (
                <img
                  key={`${id}-photo-${index}-${src}`}
                  src={src}
                  alt=""
                  style={{
                    width: '100%',
                    height: 140,
                    objectFit: 'cover',
                    borderRadius: 12,
                    background: 'var(--surface-2)',
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div style={card}>
          <a
            href={appHref}
            style={{ ...btn, background: 'var(--primary-dark)', color: '#fff', marginTop: 0 }}
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
            Have Vero360? This product opens in the app. If you don’t, you can view it here.
          </p>
        </div>
      </section>
    </main>
  )
}
