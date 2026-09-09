'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'

type DigitalProductPriceConfig = {
  key: string
  name: string
  subtitle?: string
  category: string
  brandTag?: string
  fixedMwkPrice?: number | null
  usdAmounts?: number[]
  active?: boolean
}

type DigitalServicesConfig = {
  usdToMwkRate: number
  products: DigitalProductPriceConfig[]
  updatedAt?: string | null
  updatedByEmail?: string | null
}

type DraftProduct = DigitalProductPriceConfig & {
  usdAmountsText: string
}

function toDraft(p: DigitalProductPriceConfig): DraftProduct {
  return {
    ...p,
    usdAmountsText: (p.usdAmounts || []).join(', '),
  }
}

function fromDraft(p: DraftProduct): DigitalProductPriceConfig {
  const isSub = p.category === 'streaming' || p.category === 'subscription'
  const amounts = p.usdAmountsText
    .split(/[,\s]+/)
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x > 0)

  return {
    key: p.key,
    name: p.name.trim(),
    subtitle: (p.subtitle || '').trim() || undefined,
    category: p.category,
    brandTag: (p.brandTag || '').trim() || undefined,
    fixedMwkPrice: isSub
      ? Math.max(0, Math.round(Number(p.fixedMwkPrice) || 0))
      : null,
    usdAmounts: isSub ? undefined : amounts,
    active: p.active !== false,
  }
}

export function DigitalServicesPricingPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rate, setRate] = useState(4700)
  const [products, setProducts] = useState<DraftProduct[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [updatedBy, setUpdatedBy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/digital-services/pricing', {
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load pricing')
      const config = data.config as DigitalServicesConfig
      setRate(config.usdToMwkRate || 4700)
      setProducts((config.products || []).map(toDraft))
      setUpdatedAt(config.updatedAt || null)
      setUpdatedBy(config.updatedByEmail || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = {
        usdToMwkRate: Number(rate),
        products: products.map(fromDraft),
      }
      const res = await adminFetch('/api/admin/digital-services/pricing', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setNotice(
        data.message ||
          'Pricing saved. App users see new rates on next open/refresh.',
      )
      const config = data.config as DigitalServicesConfig
      if (config) {
        setRate(config.usdToMwkRate)
        setProducts((config.products || []).map(toDraft))
        setUpdatedAt(config.updatedAt || null)
        setUpdatedBy(config.updatedByEmail || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const updateProduct = (key: string, patch: Partial<DraftProduct>) => {
    setProducts((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    )
  }

  const subs = products.filter(
    (p) => p.category === 'streaming' || p.category === 'subscription',
  )
  const gifts = products.filter(
    (p) => p.category !== 'streaming' && p.category !== 'subscription',
  )

  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: 22,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
            Prices & USD → MWK rate
          </h2>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13.5 }}>
            Changes apply in the Vero360 app without a code release. Users pick
            them up on next open / refresh.
          </p>
          {(updatedAt || updatedBy) && (
            <p style={{ margin: '6px 0 0', color: '#9A3412', fontSize: 12.5, fontWeight: 600 }}>
              Last saved{updatedBy ? ` by ${updatedBy}` : ''}
              {updatedAt ? ` · ${new Date(updatedAt).toLocaleString()}` : ''}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => void load()} disabled={loading || saving} style={ghostBtn}>
            Reload
          </button>
          <button type="button" onClick={() => void save()} disabled={loading || saving} style={primaryBtn}>
            {saving ? 'Saving…' : 'Save prices'}
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 12,
            background: error ? '#FEF2F2' : '#ECFDF5',
            color: error ? '#991B1B' : '#166534',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {error || notice}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading pricing…</p>
      ) : (
        <>
          <label style={labelStyle}>
            USD → MWK rate (gift cards & gaming)
            <input
              type="number"
              min={100}
              max={100000}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value) || 0)}
              style={inputStyle}
            />
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
              Example: $10 gift card = MWK {(10 * (Number(rate) || 0)).toLocaleString()}
            </span>
          </label>

          <h3 style={sectionTitle}>Subscriptions (fixed MWK)</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {subs.map((p) => (
              <article key={p.key} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong style={{ fontSize: 14 }}>{p.name}</strong>
                  <label style={checkLabel}>
                    <input
                      type="checkbox"
                      checked={p.active !== false}
                      onChange={(e) =>
                        updateProduct(p.key, { active: e.target.checked })
                      }
                    />
                    Active
                  </label>
                </div>
                <div style={rowStyle}>
                  <label style={fieldLabel}>
                    Display name
                    <input
                      value={p.name}
                      onChange={(e) => updateProduct(p.key, { name: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabel}>
                    MWK price / month
                    <input
                      type="number"
                      min={0}
                      value={p.fixedMwkPrice ?? 0}
                      onChange={(e) =>
                        updateProduct(p.key, {
                          fixedMwkPrice: Number(e.target.value) || 0,
                        })
                      }
                      style={inputStyle}
                    />
                  </label>
                </div>
                <label style={fieldLabel}>
                  Subtitle
                  <input
                    value={p.subtitle || ''}
                    onChange={(e) =>
                      updateProduct(p.key, { subtitle: e.target.value })
                    }
                    style={inputStyle}
                  />
                </label>
              </article>
            ))}
          </div>

          <h3 style={sectionTitle}>Gift cards & gaming (USD amounts)</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {gifts.map((p) => (
              <article key={p.key} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong style={{ fontSize: 14 }}>
                    {p.name}{' '}
                    <span style={{ color: '#6B7280', fontWeight: 600 }}>
                      · {p.category}
                    </span>
                  </strong>
                  <label style={checkLabel}>
                    <input
                      type="checkbox"
                      checked={p.active !== false}
                      onChange={(e) =>
                        updateProduct(p.key, { active: e.target.checked })
                      }
                    />
                    Active
                  </label>
                </div>
                <div style={rowStyle}>
                  <label style={fieldLabel}>
                    Display name
                    <input
                      value={p.name}
                      onChange={(e) => updateProduct(p.key, { name: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabel}>
                    USD amounts (comma-separated)
                    <input
                      value={p.usdAmountsText}
                      onChange={(e) =>
                        updateProduct(p.key, { usdAmountsText: e.target.value })
                      }
                      placeholder="10, 25, 50, 100"
                      style={inputStyle}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

const primaryBtn: CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '10px 14px',
  background: '#FF8A00',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const ghostBtn: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  padding: '10px 14px',
  background: '#fff',
  color: '#374151',
  fontWeight: 700,
  cursor: 'pointer',
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 18,
  maxWidth: 360,
}

const fieldLabel: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 12.5,
  fontWeight: 700,
  color: '#4B5563',
  flex: 1,
  minWidth: 160,
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: '1px solid #D1D5DB',
  padding: '10px 12px',
  fontSize: 14,
  fontWeight: 500,
  background: '#F9FAFB',
}

const sectionTitle: CSSProperties = {
  margin: '22px 0 10px',
  fontSize: 15,
  fontWeight: 900,
  color: '#111827',
}

const cardStyle: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 14,
  padding: 14,
  background: '#FFFCFA',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 10,
}

const checkLabel: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12.5,
  fontWeight: 700,
  color: '#374151',
}
