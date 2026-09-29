'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import {
  formatDateTime,
  formatMwk,
  latestArrivalTimeLeft,
  resolveLatestImage,
  type LatestArrival,
} from '@/lib/latest-arrivals'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardThumbFallback,
} from '@/app/dashboard/DashboardChrome'
import { useConfirmDelete } from '../ConfirmDialog'

const SECTION = DASHBOARD_SECTION_MAP['latest-arrivals']

export default function LatestArrivalsAdminPage() {
  const confirmDelete = useConfirmDelete()
  const [items, setItems] = useState<LatestArrival[]>([])
  const [totalFromApi, setTotalFromApi] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/latest-arrivals', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load latest arrivals')
      setItems(data.items || [])
      setTotalFromApi(data.counts?.totalFromApi ?? (data.items || []).length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load latest arrivals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (item: LatestArrival) => {
    if (!(await confirmDelete(item.name || `arrival #${item.id}`, 'This permanently removes it from latest arrivals.'))) {
      return
    }
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/latest-arrivals/${item.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice('Latest arrival deleted')
      setItems(prev => prev.filter(x => x.id !== item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="latest-arrivals"
        description="Goods posted in the last 24 hours. Older posts drop off automatically."
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />
      {!loading ? (
        <p style={{ fontSize: 13, color: '#6B7280', margin: '-8px 0 16px' }}>
          Showing {items.length} active
          {totalFromApi > items.length ? ` · ${totalFromApi - items.length} expired (hidden)` : ''}
        </p>
      ) : null}

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
          <p style={{ color: 'var(--text-3)' }}>Loading latest arrivals…</p>
        ) : items.length === 0 ? (
          <DashboardEmptyState
            icon={SECTION.icon}
            color={SECTION.color}
            title="No goods posted in the last 24 hours"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {items.map(item => {
              const img = resolveLatestImage(item.image)
              const left = latestArrivalTimeLeft(item.createdAt)
              return (
                <article
                  key={item.id}
                  className="arrival-row"
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
                      <DashboardThumbFallback
                        icon={SECTION.icon}
                        color={SECTION.color}
                        bg={SECTION.bg}
                      />
                    )}
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>{item.name}</h3>
                    <div
                      style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        gap: 2,
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: '#fff',
                        border: '1px solid var(--border)',
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Posted by
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                        {item.merchantName || 'Unknown merchant'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {item.merchantEmail || '—'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
                      {formatMwk(item.price)} · {formatDateTime(item.createdAt)}
                      {left ? (
                        <span style={{ marginLeft: 8, fontWeight: 700, color: '#0F766E' }}>
                          · {left}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
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
        @media (max-width: 700px) {
          .arrival-row { grid-template-columns: 72px 1fr !important; }
          .arrival-row > button { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  )
}
