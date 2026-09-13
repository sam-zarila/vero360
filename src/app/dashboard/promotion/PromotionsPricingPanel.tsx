'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useState } from 'react'
import { formatMwk } from '@/lib/vero-api'
import type { PromotionsConfig } from '@/lib/promotions-config'

function parsePresetsInput(raw: string): number[] {
  return raw
    .split(/[\n,]+/)
    .map(s => Number(String(s).replace(/[^\d.]/g, '')))
    .filter(n => Number.isFinite(n) && n > 0)
    .map(n => Math.round(n))
}

export default function PromotionsPricingPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [presetsText, setPresetsText] = useState('')
  const [allowCustomPrice, setAllowCustomPrice] = useState(true)
  const [meta, setMeta] = useState<{ updatedAt?: string | null; updatedByEmail?: string | null }>(
    {},
  )

  const applyConfig = useCallback((config: PromotionsConfig) => {
    setPresetsText((config.pricePresetsMwk || []).join(', '))
    setAllowCustomPrice(config.allowCustomPrice !== false)
    setMeta({
      updatedAt: config.updatedAt,
      updatedByEmail: config.updatedByEmail,
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/promotions/pricing', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load pricing')
      applyConfig(data.config as PromotionsConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing')
    } finally {
      setLoading(false)
    }
  }, [applyConfig])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const pricePresetsMwk = parsePresetsInput(presetsText)
      if (pricePresetsMwk.length === 0) {
        throw new Error('Add at least one price (MWK).')
      }
      const res = await adminFetch('/api/admin/promotions/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricePresetsMwk, allowCustomPrice }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save pricing')
      applyConfig(data.config as PromotionsConfig)
      setNotice(data.message || 'Saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--text-3)' }}>Loading promotion prices…</p>
  }

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
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>
        Merchant promotion prices
      </h2>
      <p style={{ margin: '0 0 18px', color: 'var(--text-3)', fontSize: 14, lineHeight: 1.5 }}>
        These MWK amounts appear as choices when a merchant posts a promotion in the app.
        Customers see the selected price on the Promotions page.
      </p>

      {(error || notice) && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: error ? '#FEF2F2' : '#ECFDF5',
            color: error ? '#991B1B' : '#166534',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {error || notice}
        </div>
      )}

      <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
        Price presets (MWK): comma or new-line separated
      </label>
      <textarea
        value={presetsText}
        onChange={e => setPresetsText(e.target.value)}
        rows={4}
        style={{
          width: '100%',
          borderRadius: 12,
          border: '1px solid var(--border)',
          padding: 12,
          fontSize: 14,
          marginBottom: 14,
          fontFamily: 'inherit',
        }}
        placeholder="3000, 5000, 8000, 10000"
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {parsePresetsInput(presetsText).map(p => (
          <span
            key={p}
            style={{
              padding: '6px 10px',
              borderRadius: 100,
              background: '#FFF7ED',
              color: '#C2410C',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {formatMwk(p)}
          </span>
        ))}
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 18,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <input
          type="checkbox"
          checked={allowCustomPrice}
          onChange={e => setAllowCustomPrice(e.target.checked)}
        />
        Allow merchants to type a custom price
      </label>

      {(meta.updatedAt || meta.updatedByEmail) && (
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-4)' }}>
          Last saved
          {meta.updatedByEmail ? ` by ${meta.updatedByEmail}` : ''}
          {meta.updatedAt ? ` · ${meta.updatedAt}` : ''}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          style={{
            padding: '10px 16px',
            borderRadius: 12,
            border: 'none',
            background: 'var(--primary)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {saving ? 'Saving…' : 'Save prices'}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={saving}
          style={{
            padding: '10px 16px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: '#fff',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Reload
        </button>
      </div>
    </section>
  )
}
