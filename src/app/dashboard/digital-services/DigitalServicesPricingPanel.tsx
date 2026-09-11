'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

type DigitalProductPriceConfig = {
  key: string
  name: string
  subtitle?: string
  category: string
  brandTag?: string
  fixedMwkPrice?: number | null
  usdAmounts?: number[]
  mwkPerUnit?: number | null
  unitLabel?: string
  imageUrl?: string
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
    usdAmounts: isSub ? [] : amounts,
    mwkPerUnit:
      !isSub && p.mwkPerUnit != null && Number(p.mwkPerUnit) > 0
        ? Math.round(Number(p.mwkPerUnit))
        : null,
    unitLabel: !isSub ? (p.unitLabel || '').trim() || undefined : undefined,
    imageUrl: (p.imageUrl || '').trim() || undefined,
    active: p.active !== false,
  }
}

function slugKey(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  return base || `crypto_${Date.now()}`
}

export function DigitalServicesPricingPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rate, setRate] = useState(4700)
  const [products, setProducts] = useState<DraftProduct[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [updatedBy, setUpdatedBy] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('USDT')
  const [newAmounts, setNewAmounts] = useState('10, 50, 100')
  const [newRate, setNewRate] = useState(4700)
  const [newImageUrl, setNewImageUrl] = useState('')

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

  const save = async (overrideProducts?: DraftProduct[]) => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const list = overrideProducts ?? products
      const payload = {
        usdToMwkRate: Number(rate),
        products: list.map(fromDraft),
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
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  const updateProduct = (key: string, patch: Partial<DraftProduct>) => {
    setProducts((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    )
  }

  /** Toggle stock / visibility in the app — saves immediately. */
  const toggleActive = async (key: string, active: boolean) => {
    const next = products.map((p) =>
      p.key === key ? { ...p, active } : p,
    )
    setProducts(next)
    const name = next.find((p) => p.key === key)?.name || key
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch('/api/admin/digital-services/pricing', {
        method: 'PUT',
        body: JSON.stringify({
          usdToMwkRate: Number(rate),
          products: next.map(fromDraft),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update stock')
      const config = data.config as DigitalServicesConfig
      if (config) {
        setRate(config.usdToMwkRate)
        setProducts((config.products || []).map(toDraft))
        setUpdatedAt(config.updatedAt || null)
        setUpdatedBy(config.updatedByEmail || null)
      }
      setNotice(
        active
          ? `${name} is active in the app again.`
          : `${name} deactivated — hidden in the app (out of stock).`,
      )
    } catch (err) {
      setProducts((prev) =>
        prev.map((p) => (p.key === key ? { ...p, active: !active } : p)),
      )
      setError(err instanceof Error ? err.message : 'Could not update stock')
    } finally {
      setSaving(false)
    }
  }

  const uploadImage = async (file: File, target: 'new' | string) => {
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await adminFetch('/api/admin/digital-services/product-image', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const url = String(data.imageUrl || '')
      if (!url) throw new Error('No image URL returned')
      if (target === 'new') setNewImageUrl(url)
      else updateProduct(target, { imageUrl: url })
      setNotice('Picture uploaded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const createCryptoCard = async () => {
    const name = newName.trim()
    if (!name) {
      setError('Enter a name (e.g. USDT, Yuan, BNB).')
      return
    }
    const unit = newUnit.trim() || name
    const amounts = newAmounts
      .split(/[,\s]+/)
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x) && x > 0)
    if (!amounts.length) {
      setError('Enter at least one amount (e.g. 10, 50, 100).')
      return
    }
    const mwkPerUnit = Math.round(Number(newRate) || 0)
    if (mwkPerUnit < 1) {
      setError('Rate (MWK per unit) must be at least 1.')
      return
    }

    let key = slugKey(name)
    const existing = new Set(products.map((p) => p.key))
    if (existing.has(key)) {
      key = `${key}_${Date.now().toString(36).slice(-4)}`
    }

    const draft: DraftProduct = {
      key,
      name,
      subtitle: `${unit} digital card`,
      category: 'crypto',
      brandTag: unit,
      unitLabel: unit,
      mwkPerUnit,
      usdAmounts: amounts,
      usdAmountsText: amounts.join(', '),
      imageUrl: newImageUrl.trim() || undefined,
      fixedMwkPrice: null,
      active: true,
    }

    const next = [...products, draft]
    const ok = await save(next)
    if (ok) {
      setNewName('')
      setNewUnit('USDT')
      setNewAmounts('10, 50, 100')
      setNewRate(4700)
      setNewImageUrl('')
      setNotice(`${name} created and live in the app.`)
    }
  }

  const removeProduct = async (key: string) => {
    const name = products.find((p) => p.key === key)?.name || key
    if (!window.confirm(`Remove ${name}? It will disappear from the app.`)) return
    const next = products.filter((p) => p.key !== key)
    await save(next)
  }

  const subs = products.filter(
    (p) => p.category === 'streaming' || p.category === 'subscription',
  )
  const cryptos = products.filter((p) => p.category === 'crypto')
  const gifts = products.filter(
    (p) =>
      p.category !== 'streaming' &&
      p.category !== 'subscription' &&
      p.category !== 'crypto',
  )

  const newPreview = useMemo(() => {
    const amounts = newAmounts
      .split(/[,\s]+/)
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x) && x > 0)
    const r = Math.round(Number(newRate) || 0)
    const first = amounts[0] || 0
    return {
      first,
      final: first > 0 && r > 0 ? Math.round(first * r) : 0,
      unit: newUnit.trim() || 'unit',
      rate: r,
    }
  }, [newAmounts, newRate, newUnit])

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
            Uncheck <strong>Active</strong> when you are out of stock — that product
            hides in the Vero360 app immediately. Check it again when stock returns.
            Price edits still need <strong>Save prices</strong>.
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

          <h3 style={sectionTitle}>Create crypto / FX gift card</h3>
          <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 13 }}>
            Build USDT, Yuan, BNB, or any unit: picture, name, amounts, your MWK rate,
            and live final price.
          </p>
          <article style={{ ...cardStyle, borderColor: '#FDBA74', background: '#FFF7ED' }}>
            <div style={rowStyle}>
              <label style={fieldLabel}>
                Name
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="USDT"
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabel}>
                Unit label
                <input
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="USDT / CNY / BNB"
                  style={inputStyle}
                />
              </label>
            </div>
            <div style={rowStyle}>
              <label style={fieldLabel}>
                Amounts (comma-separated)
                <input
                  value={newAmounts}
                  onChange={(e) => setNewAmounts(e.target.value)}
                  placeholder="10, 50, 100"
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabel}>
                Rate (MWK per unit)
                <input
                  type="number"
                  min={1}
                  value={newRate}
                  onChange={(e) => setNewRate(Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </label>
            </div>
            <div style={rowStyle}>
              <label style={fieldLabel}>
                Picture URL (optional)
                <input
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://…"
                  style={inputStyle}
                />
              </label>
              <label style={fieldLabel}>
                Or upload picture
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading || saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadImage(file, 'new')
                    e.target.value = ''
                  }}
                  style={{ ...inputStyle, padding: 8 }}
                />
              </label>
            </div>
            {newImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={newImageUrl}
                alt=""
                style={{
                  marginTop: 12,
                  width: 72,
                  height: 72,
                  objectFit: 'cover',
                  borderRadius: 12,
                  border: '1px solid #FDBA74',
                }}
              />
            ) : null}
            <p
              style={{
                margin: '14px 0 0',
                fontSize: 14,
                fontWeight: 800,
                color: '#9A3412',
              }}
            >
              Final price preview:{' '}
              {newPreview.first > 0
                ? `${newPreview.first} ${newPreview.unit} × MWK ${newPreview.rate.toLocaleString()} = MWK ${newPreview.final.toLocaleString()}`
                : 'Enter amount + rate'}
            </p>
            <button
              type="button"
              onClick={() => void createCryptoCard()}
              disabled={saving || uploading}
              style={{ ...primaryBtn, marginTop: 12 }}
            >
              {saving ? 'Creating…' : 'Create gift card'}
            </button>
          </article>

          {cryptos.length > 0 && (
            <>
              <h3 style={sectionTitle}>Your crypto / FX cards</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {cryptos.map((p) => {
                  const amounts = (p.usdAmountsText || '')
                    .split(/[,\s]+/)
                    .map((x) => Number(x.trim()))
                    .filter((x) => Number.isFinite(x) && x > 0)
                  const unitRate = Math.round(Number(p.mwkPerUnit) || 0)
                  const first = amounts[0] || 0
                  const final =
                    first > 0 && unitRate > 0 ? Math.round(first * unitRate) : 0
                  return (
                    <article
                      key={p.key}
                      style={{
                        ...cardStyle,
                        opacity: p.active === false ? 0.72 : 1,
                        borderColor: p.active === false ? '#FECACA' : '#E5E7EB',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <strong style={{ fontSize: 14 }}>
                          {p.name}{' '}
                          <span style={{ color: '#6B7280', fontWeight: 600 }}>
                            · {p.unitLabel || 'unit'}
                          </span>
                        </strong>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <label style={checkLabel}>
                            <input
                              type="checkbox"
                              checked={p.active !== false}
                              disabled={saving}
                              onChange={(e) =>
                                void toggleActive(p.key, e.target.checked)
                              }
                            />
                            {p.active !== false ? 'Active in app' : 'Out of stock'}
                          </label>
                          <button
                            type="button"
                            onClick={() => void removeProduct(p.key)}
                            disabled={saving}
                            style={{
                              ...ghostBtn,
                              padding: '6px 10px',
                              color: '#B91C1C',
                              borderColor: '#FECACA',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            style={{
                              width: 56,
                              height: 56,
                              objectFit: 'cover',
                              borderRadius: 10,
                              border: '1px solid #E5E7EB',
                            }}
                          />
                        ) : null}
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={rowStyle}>
                            <label style={fieldLabel}>
                              Display name
                              <input
                                value={p.name}
                                onChange={(e) =>
                                  updateProduct(p.key, { name: e.target.value })
                                }
                                style={inputStyle}
                              />
                            </label>
                            <label style={fieldLabel}>
                              Unit
                              <input
                                value={p.unitLabel || ''}
                                onChange={(e) =>
                                  updateProduct(p.key, {
                                    unitLabel: e.target.value,
                                    brandTag: e.target.value,
                                  })
                                }
                                style={inputStyle}
                              />
                            </label>
                          </div>
                          <div style={rowStyle}>
                            <label style={fieldLabel}>
                              Amounts
                              <input
                                value={p.usdAmountsText}
                                onChange={(e) =>
                                  updateProduct(p.key, {
                                    usdAmountsText: e.target.value,
                                  })
                                }
                                style={inputStyle}
                              />
                            </label>
                            <label style={fieldLabel}>
                              MWK per unit
                              <input
                                type="number"
                                min={1}
                                value={p.mwkPerUnit ?? 0}
                                onChange={(e) =>
                                  updateProduct(p.key, {
                                    mwkPerUnit: Number(e.target.value) || 0,
                                  })
                                }
                                style={inputStyle}
                              />
                            </label>
                          </div>
                          <label style={{ ...fieldLabel, marginTop: 10 }}>
                            Picture
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploading || saving}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) void uploadImage(file, p.key)
                                e.target.value = ''
                              }}
                              style={{ ...inputStyle, padding: 8 }}
                            />
                          </label>
                          <p
                            style={{
                              margin: '10px 0 0',
                              fontSize: 13,
                              fontWeight: 800,
                              color: '#9A3412',
                            }}
                          >
                            Final:{' '}
                            {first > 0
                              ? `${first} ${p.unitLabel || 'unit'} × ${unitRate.toLocaleString()} = MWK ${final.toLocaleString()}`
                              : 'Set amount + rate'}
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}

          <h3 style={sectionTitle}>Subscriptions (fixed MWK)</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {subs.map((p) => (
              <article
                key={p.key}
                style={{
                  ...cardStyle,
                  opacity: p.active === false ? 0.72 : 1,
                  borderColor: p.active === false ? '#FECACA' : '#E5E7EB',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong style={{ fontSize: 14 }}>{p.name}</strong>
                  <label style={checkLabel} title="When off, this product is hidden in the app">
                    <input
                      type="checkbox"
                      checked={p.active !== false}
                      disabled={saving}
                      onChange={(e) =>
                        void toggleActive(p.key, e.target.checked)
                      }
                    />
                    {p.active !== false ? 'Active in app' : 'Out of stock'}
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
              <article
                key={p.key}
                style={{
                  ...cardStyle,
                  opacity: p.active === false ? 0.72 : 1,
                  borderColor: p.active === false ? '#FECACA' : '#E5E7EB',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong style={{ fontSize: 14 }}>
                    {p.name}{' '}
                    <span style={{ color: '#6B7280', fontWeight: 600 }}>
                      · {p.category}
                    </span>
                  </strong>
                  <label style={checkLabel} title="When off, this product is hidden in the app">
                    <input
                      type="checkbox"
                      checked={p.active !== false}
                      disabled={saving}
                      onChange={(e) =>
                        void toggleActive(p.key, e.target.checked)
                      }
                    />
                    {p.active !== false ? 'Active in app' : 'Out of stock'}
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
