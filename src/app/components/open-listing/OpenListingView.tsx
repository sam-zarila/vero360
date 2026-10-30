'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
import { PLAY_STORE_URL, APP_STORE_URL, appStoreLinks } from '@/app/components/landing/veroServices'
import { IosStoreCta } from '@/app/components/landing/IosReviewNotice'
import OpenAppBridge from '@/app/components/open-listing/OpenAppBridge'
import ShareListingButton from '@/app/components/open-listing/ShareListingButton'
import GuestBuyForm, {
  guestFieldInput,
  guestFieldLabel,
} from '@/app/components/open-listing/GuestBuyForm'
import type { ListingModel } from '@/lib/open-listing-types'
import { listingAmountMwk, listingPriceLabel } from '@/lib/open-listing-utils'

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
  const nightly = listingAmountMwk(listing)
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [checkInDate, setCheckInDate] = useState(today)
  const [nights, setNights] = useState(1)
  const stayTotal = nightly * Math.max(1, nights)
  const canBookStay = kind === 'accommodation' && nightly > 0
  const shareKindLabel =
    kind === 'shop' ? 'shop' : kind === 'marketplace' ? 'product' : 'stay'
  const webUrl =
    listing.webUrl ||
    `https://vero360.app/${kind === 'shop' ? 'shop' : kind === 'marketplace' ? 'marketplace' : 'accommodation'}/${id}`

  return (
    <main style={page}>
      <OpenAppBridge appHref={appHref} webUrl={webUrl} />
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
          {canBookStay ? (
            <>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  marginBottom: 12,
                  fontFamily: 'var(--font-display)',
                }}
              >
                Book as guest
              </h2>
              <GuestBuyForm
                checkoutUrl="/api/public/stays/checkout"
                amountMwk={stayTotal}
                submitLabel="Pay and book"
                successMessage="Payment received. We will confirm this stay with the host."
                payload={{
                  listingId: id,
                  checkInDate,
                  nights,
                }}
                extraFields={
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label style={guestFieldLabel} htmlFor="stay-in">
                        Check-in
                      </label>
                      <input
                        id="stay-in"
                        style={guestFieldInput}
                        type="date"
                        min={today}
                        required
                        value={checkInDate}
                        onChange={e => setCheckInDate(e.target.value)}
                      />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={guestFieldLabel} htmlFor="stay-nights">
                        Nights
                      </label>
                      <input
                        id="stay-nights"
                        style={guestFieldInput}
                        type="number"
                        min={1}
                        max={30}
                        value={nights}
                        onChange={e => setNights(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                  </>
                }
              />
              <a href={appHref} style={{ ...btn, background: 'var(--primary-light)', color: 'var(--text)' }}>
                Or open in the Vero360 app
              </a>
            </>
          ) : (
            <>
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
                <IosStoreCta
                  style={{ ...btn, background: 'var(--primary-light)', color: 'var(--text)' }}
                >
                  Get on the App Store
                </IosStoreCta>
              ) : null}
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-3)',
                  marginTop: 12,
                  lineHeight: 1.45,
                }}
              >
                Have Vero360? This {kind === 'shop' ? 'shop' : 'stay'} opens in the app. If you
                don&apos;t, get it on Google Play or the App Store.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
