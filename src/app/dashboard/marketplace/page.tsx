'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  MARKETPLACE_CATEGORIES,
  categoryLabel,
  categoryTone,
  formatDateTime,
  formatMwk,
  partyContactLine,
  resolveMarketplaceImage,
  type MarketplaceCategory,
  type MarketplaceListing,
} from '@/lib/marketplace'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
  DashboardThumbFallback,
} from '@/app/dashboard/DashboardChrome'
import { useConfirmDelete } from '../ConfirmDialog'

const SECTION = DASHBOARD_SECTION_MAP.marketplace

type CategoryTab = 'all' | MarketplaceCategory

type Counts = Record<string, number>

const EMPTY_COUNTS: Counts = {
  all: 0,
  food: 0,
  drinks: 0,
  electronics: 0,
  clothes: 0,
  shoes: 0,
  other: 0,
}

export default function MarketplaceAdminPage() {
  const confirmDelete = useConfirmDelete()
  const [items, setItems] = useState<MarketplaceListing[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryTab>('all')
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/marketplace', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load marketplace')
      setItems(data.items || [])
      setCounts(data.counts || EMPTY_COUNTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marketplace')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      if (category !== 'all' && item.category !== category) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        (item.merchantName || '').toLowerCase().includes(q) ||
        (item.merchantEmail || '').toLowerCase().includes(q) ||
        (item.merchantPhone || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        categoryLabel(item.category).toLowerCase().includes(q)
      )
    })
  }, [items, category, query])

  const remove = async (item: MarketplaceListing) => {
    if (
      !(await confirmDelete(
        item.name,
        'This removes the listing for buyers (inappropriate / policy removal).',
      ))
    ) {
      return
    }
    setBusyKey(item.key)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/marketplace/${encodeURIComponent(item.key)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice(`Removed “${item.name}”`)
      setItems(prev => prev.filter(x => x.key !== item.key))
      setCounts(prev => {
        const next = { ...prev }
        next.all = Math.max(0, (next.all || 0) - 1)
        const cat = String(item.category)
        if (cat in next) next[cat] = Math.max(0, (next[cat] || 0) - 1)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyKey(null)
    }
  }

  const tabs: Array<{ id: CategoryTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all || 0 },
    ...MARKETPLACE_CATEGORIES.map(c => ({
      id: c as CategoryTab,
      label: categoryLabel(c),
      count: counts[c] || 0,
    })),
  ]

  return (
    <div>
      <DashboardBackLink />

      <DashboardPageHeader
        sectionId="marketplace"
        description="Browse, filter, and remove catalog listings. Delete items that violate policy."
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#047857',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {notice}
        </div>
      )}

      <DashboardSearchField
        value={query}
        onChange={value => {
          setQuery(value)
          if (value.trim()) setCategory('all')
        }}
        placeholder="Search name, location, seller…"
        label="Search listings"
        onClear={() => setQuery('')}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {tabs.map(t => {
          const active = category === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setCategory(t.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 100,
                border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: active ? 'var(--primary-50)' : '#fff',
                color: active ? 'var(--primary-dark)' : 'var(--text-2)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {t.label} ({t.count})
            </button>
          )
        })}
      </div>

      <section
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 22,
          boxShadow: 'var(--shadow-sm)',
          minHeight: 420,
        }}
      >
        {loading ? (
          <p style={{ color: 'var(--text-3)' }}>Loading marketplace…</p>
        ) : filtered.length === 0 ? (
          <DashboardEmptyState
            icon={SECTION.icon}
            color={SECTION.color}
            title={
              query.trim() || category !== 'all'
                ? 'No listings match your filters'
                : 'No marketplace listings yet'
            }
            hint={
              query.trim() || category !== 'all'
                ? 'Try clearing search or changing category.'
                : 'New seller listings from the app will appear here.'
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(item => {
              const img = resolveMarketplaceImage(item.image)
              const tone = categoryTone(item.category)
              const busy = busyKey === item.key
              return (
                <article
                  key={item.key}
                  className="marketplace-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '96px 1fr auto',
                    gap: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    alignItems: 'start',
                  }}
                >
                  <div
                    style={{
                      width: 96,
                      height: 80,
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: '#fff',
                      border: '1px solid var(--border)',
                      position: 'relative',
                    }}
                  >
                    {img ? (
                      <Image src={img} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
                    ) : (
                      <DashboardThumbFallback
                        icon={SECTION.icon}
                        color={SECTION.color}
                        bg={SECTION.bg}
                      />
                    )}
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{item.name}</h3>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 100,
                          background: tone.bg,
                          color: tone.color,
                          border: `1px solid ${tone.border}`,
                        }}
                      >
                        {categoryLabel(item.category)}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text-2)',
                        marginBottom: 8,
                      }}
                    >
                      {formatMwk(item.price)} · {item.location}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 8,
                      }}
                    >
                      <Meta
                        label="Seller"
                        value={item.merchantName || '—'}
                        sub={
                          partyContactLine(item.merchantPhone, item.merchantEmail) ||
                          'No phone or email'
                        }
                      />
                      <Meta label="Listed" value={formatDateTime(item.createdAt)} />
                      {item.description ? (
                        <Meta
                          label="Description"
                          value={
                            item.description.length > 100
                              ? `${item.description.slice(0, 100)}…`
                              : item.description
                          }
                        />
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(item)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: '1px solid #FECACA',
                        background: busy ? '#FEE2E2' : '#FEF2F2',
                        color: '#B91C1C',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: busy ? 'wait' : 'pointer',
                        opacity: busy ? 0.7 : 1,
                      }}
                    >
                      {busy ? 'Removing…' : 'Delete'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <style jsx global>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        @media (max-width: 760px) {
          .marketplace-row {
            grid-template-columns: 72px 1fr !important;
          }
          .marketplace-row > div:last-child {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </div>
  )
}

function Meta({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        background: '#fff',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-4)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  )
}
