'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
import { PLAY_STORE_URL, APP_STORE_URL, appStoreLinks } from '@/app/components/landing/veroServices'
import ShareListingButton from '@/app/components/open-listing/ShareListingButton'
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
const hero: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 10',
  objectFit: 'cover',
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
  const {
    kind,
    id,
    title,
    location,
    image,
    gallery,
    description,
    amenities,
    type,
    hostName,
    appHref,
  } = listing
  const showImage = /^https?:\/\//i.test(image) || image.startsWith('/api/media')
  const priceLabel = listingPriceLabel(listing)
  const shareKindLabel =
    kind === 'shop' ? 'shop' : kind === 'marketplace' ? 'product' : 'stay'

  return (
    <main style={page}>
      <header style={top}>
        <div
          style={{
            maxWidth: 560,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Logo height={40} textColor="#fff" />
          </Link>
          <ShareListingButton
            light
            title={title || `${shareKindLabel} on Vero360`}
            text={`Check out this ${shareKindLabel} on Vero360: ${title}`}
          />
        </div>
      </header>

      <section style={body}>
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {showImage ? (
            <img key={`${id}-hero`} style={hero} src={image} alt={title} />
          ) : null}
          <div style={{ padding: 20 }}>
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
            {hostName ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
                {kind === 'marketplace' ? 'Sold by' : 'By'} {hostName}
              </p>
            ) : null}
          </div>
        </div>

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
              About this {kind === 'shop' ? 'shop' : kind === 'marketplace' ? 'product' : 'stay'}
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7 }}>
              {description}
            </p>
          </div>
        ) : null}

        {amenities.length > 0 ? (
          <div style={card}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 800,
                marginBottom: 12,
                fontFamily: 'var(--font-display)',
              }}
            >
              Offers
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {amenities.map(item => (
                <span
                  key={item}
                  style={{
                    background: 'var(--primary-light)',
                    color: 'var(--text)',
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {gallery.length > 0 ? (
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
              {gallery.slice(0, 4).map((src, index) => (
                <img
                  key={`${id}-g-${index}-${src}`}
                  src={src}
                  alt=""
                  style={{
                    width: '100%',
                    height: 110,
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
            style={{ ...btn, background: 'var(--primary-dark)', color: '#fff' }}
          >
            Open in Vero360 app
          </a>
          {appStoreLinks.android || PLAY_STORE_URL ? (
            <a
              href={appStoreLinks.android || PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...btn, background: 'var(--primary-light)', color: 'var(--text)' }}
            >
              Get on Google Play
            </a>
          ) : null}
          {appStoreLinks.ios || APP_STORE_URL ? (
            <a
              href={appStoreLinks.ios || APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...btn, background: 'var(--primary-light)', color: 'var(--text)' }}
            >
              Get on the App Store
            </a>
          ) : null}
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-3)',
              marginTop: 12,
              lineHeight: 1.45,
            }}
          >
            Have Vero360? This{' '}
            {kind === 'shop' ? 'shop' : kind === 'marketplace' ? 'product' : 'stay'}{' '}
            opens in the app. If you don’t, get it on Google Play or the App Store.
          </p>
        </div>
      </section>
    </main>
  )
}
