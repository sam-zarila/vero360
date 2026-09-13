'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Logo from '@/app/components/landing/Logo'
import { formatMwk } from '@/lib/vero-api'
import type { NetflixPlanPublicCard } from '@/lib/netflix-plans'

const page: CSSProperties = {
  minHeight: '100vh',
  background: '#FFFBF6',
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

export default function NetflixPlanPickerView({
  plans,
  brandImage,
}: {
  plans: NetflixPlanPublicCard[]
  brandImage: string | null
}) {
  const router = useRouter()
  const defaultKey =
    plans.find(p => p.spec.mostPopular)?.productKey || plans[0]?.productKey || ''
  const [selectedKey, setSelectedKey] = useState(defaultKey)

  const selected = plans.find(p => p.productKey === selectedKey) || plans[0]

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
              gap: 14,
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 72,
                height: 48,
                borderRadius: 12,
                overflow: 'hidden',
                background: 'linear-gradient(145deg, #FFF7ED, #FFEDD5)',
                border: '1px solid #FED7AA',
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {brandImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brandImage}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontWeight: 900, color: '#EA580C' }}>N</span>
              )}
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#EA580C',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Subscription
              </div>
              <h1
                style={{
                  margin: '4px 0 0',
                  fontSize: 24,
                  letterSpacing: '-0.4px',
                  lineHeight: 1.15,
                }}
              >
                Choose your plan
              </h1>
            </div>
          </div>
          <p style={{ margin: '0 0 16px', color: 'var(--text-3)', fontSize: 14, lineHeight: 1.45 }}>
            Netflix — pick the plan that fits you. Change anytime.
          </p>

          <div style={{ display: 'grid', gap: 12 }}>
            {plans.map(plan => {
              const active = selectedKey === plan.productKey
              return (
                <button
                  key={plan.productKey}
                  type="button"
                  onClick={() => setSelectedKey(plan.productKey)}
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: active
                      ? 'linear-gradient(145deg, #FFF7ED, #FFFFFF)'
                      : '#fff',
                    border: active ? '2px solid #EA580C' : '1px solid #E8E4DE',
                    borderRadius: 18,
                    padding: 16,
                    boxShadow: active ? '0 8px 24px rgba(234,88,12,0.12)' : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <strong
                      style={{
                        flex: 1,
                        fontSize: 17,
                        letterSpacing: '-0.2px',
                        color: '#1A1A1A',
                      }}
                    >
                      {plan.spec.title}
                    </strong>
                    {plan.spec.mostPopular ? (
                      <span
                        style={{
                          background: '#EA580C',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 800,
                          borderRadius: 999,
                          padding: '4px 9px',
                        }}
                      >
                        Most popular
                      </span>
                    ) : null}
                    <span
                      aria-hidden
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: active ? '6px solid #EA580C' : '2px solid #C4C0B8',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      color: '#EA580C',
                      fontWeight: 900,
                      fontSize: 16,
                      marginBottom: 10,
                    }}
                  >
                    {formatMwk(plan.priceMwk)} / month
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    {plan.spec.featureLines.map(line => (
                      <li
                        key={line}
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'flex-start',
                          color: '#6B7280',
                          fontSize: 13.2,
                          lineHeight: 1.35,
                          fontWeight: 500,
                        }}
                      >
                        <span style={{ color: '#EA580C', fontWeight: 900 }}>✓</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return
              router.push(selected.href)
            }}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 18,
              border: 'none',
              borderRadius: 14,
              padding: '14px 16px',
              fontWeight: 900,
              fontSize: 16,
              fontFamily: 'inherit',
              cursor: selected ? 'pointer' : 'not-allowed',
              background: 'linear-gradient(135deg, #EA580C, #F97316)',
              color: '#fff',
              opacity: selected ? 1 : 0.6,
            }}
          >
            Continue
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
            Next you’ll enter your details and pay with mobile money. Use Back to
            return to this plan list.
          </p>
        </div>
      </div>
    </main>
  )
}
