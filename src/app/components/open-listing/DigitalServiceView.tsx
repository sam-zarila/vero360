'use client'

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
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
  fixedMwkPrice: number | null
  usdAmounts: number[]
  usdToMwkRate: number
  isFixedPrice: boolean
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
const label: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 6,
}
const input: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontSize: 15,
  fontFamily: 'inherit',
  background: '#fff',
  boxSizing: 'border-box',
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
  fontSize: 15,
  fontFamily: 'inherit',
}

export default function DigitalServiceView({
  product,
}: {
  product: DigitalServicePublicDetail
}) {
  const presets = product.usdAmounts.length
    ? product.usdAmounts
    : [10, 25, 50, 100]
  const [selectedUsd, setSelectedUsd] = useState<number>(presets[0])
  const [customUsd, setCustomUsd] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const amountMwk = useMemo(() => {
    if (product.isFixedPrice && product.fixedMwkPrice) {
      return Math.round(product.fixedMwkPrice)
    }
    const custom = Number(customUsd)
    const usd =
      Number.isFinite(custom) && custom > 0 ? custom : selectedUsd
    return Math.round(usd * Math.max(1, product.usdToMwkRate || 4700))
  }, [
    product.isFixedPrice,
    product.fixedMwkPrice,
    product.usdToMwkRate,
    selectedUsd,
    customUsd,
  ])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const custom = Number(customUsd)
      const usdPayload = product.isFixedPrice
        ? null
        : Number.isFinite(custom) && custom >= 1
          ? custom
          : selectedUsd

      const res = await fetch('/api/public/digital-services/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productKey: product.key,
          buyerName: name.trim(),
          buyerEmail: email.trim(),
          buyerPhone: phone.trim(),
          selectedUsd: usdPayload,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Could not start payment')
      }
      const checkoutUrl = String(data.checkoutUrl || '').trim()
      if (!checkoutUrl) throw new Error('No checkout URL returned')
      window.location.href = checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setSubmitting(false)
    }
  }

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
            style={{
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
            }}
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
                <p
                  style={{
                    margin: '6px 0 0',
                    color: 'var(--text-3)',
                    fontSize: 14,
                  }}
                >
                  {product.subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <form onSubmit={onSubmit}>
            {!product.isFixedPrice ? (
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Amount (USD)</label>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  {presets.map(usd => {
                    const active = !customUsd && selectedUsd === usd
                    return (
                      <button
                        key={usd}
                        type="button"
                        onClick={() => {
                          setSelectedUsd(usd)
                          setCustomUsd('')
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 999,
                          border: active
                            ? '2px solid #EA580C'
                            : '1px solid var(--border)',
                          background: active ? '#FFF7ED' : '#fff',
                          fontWeight: 800,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        ${usd}
                      </button>
                    )
                  })}
                </div>
                <input
                  style={input}
                  inputMode="decimal"
                  placeholder="Or enter custom USD (1–500)"
                  value={customUsd}
                  onChange={e => setCustomUsd(e.target.value)}
                />
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: '#9A3412',
                    fontWeight: 700,
                  }}
                >
                  ≈ {formatMwk(amountMwk)} at {formatMwk(product.usdToMwkRate)} / USD
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: '#FFF7ED',
                  border: '1px solid #FED7AA',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9A3412' }}>
                  Price
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: '#9A3412',
                    marginTop: 2,
                  }}
                >
                  {formatMwk(amountMwk)}
                </div>
                <div style={{ fontSize: 13, color: '#9A3412', marginTop: 4 }}>
                  1-month subscription
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={label} htmlFor="buyer-name">
                Full name
              </label>
              <input
                id="buyer-name"
                style={input}
                required
                minLength={2}
                autoComplete="name"
                placeholder="As on your mobile money account"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={label} htmlFor="buyer-phone">
                Malawi mobile number
              </label>
              <input
                id="buyer-phone"
                style={input}
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="0881234567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={label} htmlFor="buyer-email">
                Email
              </label>
              <input
                id="buyer-email"
                style={input}
                required
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            {error ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: '#FEF2F2',
                  color: '#991B1B',
                  fontWeight: 600,
                  fontSize: 14,
                  marginBottom: 10,
                }}
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              style={{
                ...btn,
                background: 'linear-gradient(135deg, #EA580C, #F97316)',
                color: '#fff',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting
                ? 'Opening PayChangu…'
                : `Pay ${formatMwk(amountMwk)} with mobile money`}
            </button>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-3)',
                lineHeight: 1.5,
                margin: '12px 0 0',
                textAlign: 'center',
              }}
            >
              You’ll complete payment securely on PayChangu (Airtel Money / TNM Mpamba
              / bank). We’ll email fulfilment details after payment.
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}

export function formatDigitalPriceLabel(opts: {
  fixedMwkPrice?: number | null
  usdAmounts?: number[]
  usdToMwkRate: number
  isSubscription: boolean
}): {
  priceLabel: string | null
  amountsLabel: string | null
  rateLabel: string | null
} {
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
