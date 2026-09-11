'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
import DownloadAppModal from '@/app/components/landing/DownloadAppModal'
import {
  PLAY_STORE_URL,
  APP_STORE_URL,
  appStoreLinks,
} from '@/app/components/landing/veroServices'
import { formatMwk } from '@/lib/vero-api'

export type DigitalServicePublicDetail = {
  key: string
  name: string
  subtitle: string | null
  categoryLabel: string
  brandTag: string | null
  image: string | null
  priceLabel: string | null
  amountsLabel: string | null
  rateLabel: string | null
}

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
  border: 'none',
  cursor: 'pointer',
}

export default function DigitalServiceView({
  product,
}: {
  product: DigitalServicePublicDetail
}) {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const links = useMemo(() => appStoreLinks, [])

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
            <Logo />
          </Link>
          <Link
            href="/browse/digital-services"
            style={{ color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
          >
            All digital
          </Link>
        </div>
      </header>

      <div style={body}>
        <div style={card}>
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                overflow: 'hidden',
                background: 'linear-gradient(145deg, #FFF7ED, #FFEDD5)',
                border: '1px solid #FED7AA',
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontWeight: 900, color: '#EA580C', fontSize: 22 }}>
                  {(product.brandTag || product.name).slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#EA580C',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {product.categoryLabel}
              </div>
              <h1
                style={{
                  margin: '4px 0 0',
                  fontSize: 24,
                  letterSpacing: '-0.4px',
                  lineHeight: 1.15,
                }}
              >
                {product.name}
              </h1>
              {product.subtitle ? (
                <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: 14 }}>
                  {product.subtitle}
                </p>
              ) : null}
            </div>
          </div>

          {product.priceLabel ? (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: '#FFF7ED',
                border: '1px solid #FED7AA',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9A3412' }}>Price</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#9A3412', marginTop: 2 }}>
                {product.priceLabel}
              </div>
              {product.amountsLabel ? (
                <div style={{ fontSize: 13, color: '#9A3412', marginTop: 4, opacity: 0.85 }}>
                  {product.amountsLabel}
                </div>
              ) : null}
              {product.rateLabel ? (
                <div style={{ fontSize: 12, color: '#C2410C', marginTop: 6 }}>
                  {product.rateLabel}
                </div>
              ) : null}
            </div>
          ) : null}

          <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5, margin: '0 0 8px' }}>
            Browse here, then open the Vero360 app to buy securely with mobile money. Delivery is
            handled in-app after payment.
          </p>

          <button
            type="button"
            onClick={() => setDownloadOpen(true)}
            style={{
              ...btn,
              background: 'linear-gradient(135deg, #EA580C, #F97316)',
              color: '#fff',
            }}
          >
            Buy in the Vero360 app
          </button>

          {links.android ? (
            <a href={PLAY_STORE_URL} style={{ ...btn, background: '#111827', color: '#fff' }}>
              Get it on Google Play
            </a>
          ) : null}
          {links.ios ? (
            <a href={APP_STORE_URL} style={{ ...btn, background: '#fff', color: '#111827', border: '1px solid var(--border)' }}>
              Download on the App Store
            </a>
          ) : null}
        </div>
      </div>

      <DownloadAppModal open={downloadOpen} onClose={() => setDownloadOpen(false)} />
    </main>
  )
}

export function formatDigitalPriceLabel(opts: {
  fixedMwkPrice?: number | null
  usdAmounts?: number[]
  usdToMwkRate: number
  isSubscription: boolean
}): { priceLabel: string | null; amountsLabel: string | null; rateLabel: string | null } {
  const rate = Math.max(1, opts.usdToMwkRate || 4700)
  if (opts.isSubscription && opts.fixedMwkPrice && opts.fixedMwkPrice > 0) {
    return {
      priceLabel: formatMwk(opts.fixedMwkPrice),
      amountsLabel: '1-month subscription',
      rateLabel: null,
    }
  }
  const amounts = (opts.usdAmounts || []).filter(n => n > 0)
  if (!amounts.length) {
    if (opts.fixedMwkPrice && opts.fixedMwkPrice > 0) {
      return {
        priceLabel: formatMwk(opts.fixedMwkPrice),
        amountsLabel: null,
        rateLabel: null,
      }
    }
    return { priceLabel: null, amountsLabel: null, rateLabel: null }
  }
  const fromMwk = Math.round(amounts[0] * rate)
  return {
    priceLabel: `From ${formatMwk(fromMwk)}`,
    amountsLabel: `USD options: ${amounts.map(a => `$${a}`).join(', ')}`,
    rateLabel: `Approx. MWK at ${formatMwk(rate)} per USD`,
  }
}
