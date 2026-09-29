'use client'

import { adminFetch } from '@/lib/panel-client-auth'
import { useCallback, useEffect, useState } from 'react'
import { formatMwk } from '@/lib/vero-api'
import type { PromotePackageConfig, PromotePackagesConfig } from '@/lib/promote-packages-config'

export default function PromotePackagesPricingPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [packages, setPackages] = useState<PromotePackageConfig[]>([])
  const [meta, setMeta] = useState<{ updatedAt?: string | null; updatedByEmail?: string | null }>({})

  const applyConfig = useCallback((config: PromotePackagesConfig) => {
    setPackages(config.packages || [])
    setMeta({ updatedAt: config.updatedAt, updatedByEmail: config.updatedByEmail })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/promote-packages/pricing', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load promote prices')
      applyConfig(data.config as PromotePackagesConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promote prices')
    } finally {
      setLoading(false)
    }
  }, [applyConfig])

  useEffect(() => {
    void load()
  }, [load])

  const updatePkg = (key: string, patch: Partial<PromotePackageConfig>) => {
    setPackages(prev => prev.map(p => (p.key === key ? { ...p, ...patch } : p)))
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      for (const p of packages) {
        if (!Number.isFinite(p.priceMwk) || p.priceMwk < 0) {
          throw new Error(`Invalid price for ${p.label}`)
        }
        if (!Number.isFinite(p.durationHours) || p.durationHours < 1) {
          throw new Error(`Invalid duration for ${p.label}`)
        }
      }
      const res = await adminFetch('/api/admin/promote-packages/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      applyConfig(data.config as PromotePackagesConfig)
      setNotice(data.message || 'Saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--text-3)' }}>Loading promote package prices…</p>
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
        Promote package prices
      </h2>
      <p style={{ margin: '0 0 18px', color: 'var(--text-3)', fontSize: 14, lineHeight: 1.5 }}>
        These are the packages merchants pick for <strong>24h / 1 week on top</strong> and{' '}
        <strong>Facebook ads</strong>. Prices update live in the app after save.
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {packages.map(pkg => (
          <div
            key={pkg.key}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 14,
              background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{pkg.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  {pkg.kind === 'facebook_ads' ? 'Facebook ads' : 'Feed top boost'} · key{' '}
                  <code>{pkg.key}</code>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={pkg.active !== false}
                  onChange={e => updatePkg(pkg.key, { active: e.target.checked })}
                />
                Active
              </label>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
                marginTop: 12,
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700 }}>
                Price (MWK)
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={pkg.priceMwk}
                  onChange={e => updatePkg(pkg.key, { priceMwk: Number(e.target.value) || 0 })}
                  style={{
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    padding: '10px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                />
                <span style={{ color: 'var(--text-4)', fontWeight: 500 }}>{formatMwk(pkg.priceMwk)}</span>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700 }}>
                Duration (hours)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={pkg.durationHours}
                  onChange={e =>
                    updatePkg(pkg.key, { durationHours: Math.max(1, Number(e.target.value) || 1) })
                  }
                  style={{
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    padding: '10px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                />
              </label>

              {pkg.kind === 'facebook_ads' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700 }}>
                  Reach label
                  <input
                    type="text"
                    value={pkg.reachLabel || ''}
                    onChange={e => updatePkg(pkg.key, { reachLabel: e.target.value })}
                    style={{
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      padding: '10px 12px',
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      {(meta.updatedAt || meta.updatedByEmail) && (
        <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--text-4)' }}>
          Last saved
          {meta.updatedByEmail ? ` by ${meta.updatedByEmail}` : ''}
          {meta.updatedAt ? ` · ${meta.updatedAt}` : ''}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
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
