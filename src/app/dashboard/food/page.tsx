'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  formatDateTime,
  formatMwk,
  resolveFoodImage,
  sourceLabel,
  type FoodItem,
  type FoodSource,
} from '@/lib/food'

type SourceTab = 'all' | FoodSource

export default function FoodAdminPage() {
  const [items, setItems] = useState<FoodItem[]>([])
  const [counts, setCounts] = useState({ all: 0, api: 0, marketplace: 0, menu: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [sourceTab, setSourceTab] = useState<SourceTab>('all')
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/food', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load food items')
      setItems(data.items || [])
      setCounts(data.counts || { all: 0, api: 0, marketplace: 0, menu: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load food items')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      if (sourceTab !== 'all' && item.source !== sourceTab) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.restaurant.toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q)
      )
    })
  }, [items, query, sourceTab])

  const remove = async (item: FoodItem) => {
    if (!confirm(`Delete “${item.name}” from ${sourceLabel(item.source)}?`)) return
    setBusyKey(item.key)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/admin/food/${encodeURIComponent(item.key)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice(`Deleted “${item.name}”`)
      setItems(prev => prev.filter(x => x.key !== item.key))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyKey(null)
    }
  }

  const tabs: Array<{ id: SourceTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'menu', label: 'Kitchen menu', count: counts.menu },
    { id: 'marketplace', label: 'Marketplace', count: counts.marketplace },
    { id: 'api', label: 'API', count: counts.api },
  ]

  return (
    <div>
      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-3)',
          marginBottom: 20,
        }}
      >
        ← Back to dashboard
      </Link>

      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'clamp(24px, 3vw, 32px)',
              fontWeight: 900,
              letterSpacing: '-0.4px',
              marginBottom: 6,
            }}
          >
            Food
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-3)', margin: 0, maxWidth: 560 }}>
            Food from marketplace listings and merchant kitchen menus. Search, filter, or delete items.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          style={{
            alignSelf: 'flex-start',
            padding: '8px 14px',
            borderRadius: 100,
            border: '1px solid var(--border)',
            background: '#fff',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--text-2)',
          }}
        >
          Refresh
        </button>
      </div>

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

      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <label style={{ flex: '1 1 280px', position: 'relative', display: 'block' }}>
          <span className="sr-only">Search food</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search dish or restaurant…"
            autoComplete="off"
            style={{
              width: '100%',
              padding: '11px 14px 11px 40px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: '#fff',
              fontSize: 14,
              color: 'var(--text)',
              outline: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-4)',
              fontSize: 15,
              pointerEvents: 'none',
            }}
          >
            ⌕
          </span>
        </label>
        {query.trim() && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: '#fff',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-2)',
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {tabs.map(t => {
          const active = sourceTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSourceTab(t.id)}
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
          <p style={{ color: 'var(--text-3)' }}>Loading food items…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-3)' }}>
            {query.trim()
              ? `No food found for “${query.trim()}”.`
              : 'No food items yet. New marketplace food and kitchen menu posts will appear here.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(item => {
              const img = resolveFoodImage(item.image)
              const busy = busyKey === item.key
              return (
                <article
                  key={item.key}
                  className="food-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '96px 1fr auto',
                    gap: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 96,
                      height: 72,
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
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'grid',
                          placeItems: 'center',
                          color: 'var(--text-4)',
                          fontSize: 12,
                        }}
                      >
                        No img
                      </div>
                    )}
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{item.name}</h3>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 100,
                          background: '#FFF7ED',
                          color: '#C2410C',
                          border: '1px solid #FED7AA',
                        }}
                      >
                        {sourceLabel(item.source)}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                      {item.restaurant}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
                      {formatMwk(item.price)}
                      {item.location ? ` · ${item.location}` : ''}
                      {item.createdAt ? ` · ${formatDateTime(item.createdAt)}` : ''}
                    </div>
                    {item.description ? (
                      <p
                        style={{
                          margin: '8px 0 0',
                          fontSize: 13,
                          color: 'var(--text-3)',
                          lineHeight: 1.45,
                        }}
                      >
                        {item.description.length > 140
                          ? `${item.description.slice(0, 140)}…`
                          : item.description}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(item)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#991B1B',
                      whiteSpace: 'nowrap',
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    Delete
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <style>{`
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
        @media (max-width: 700px) {
          .food-row { grid-template-columns: 72px 1fr !important; }
          .food-row > button { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  )
}
