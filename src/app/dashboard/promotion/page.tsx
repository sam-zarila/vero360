'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  formatMwk,
  formatPromoDate,
  postedByEmail,
  postedByLabel,
  resolvePromoImage,
  type Promo,
} from '@/lib/promo'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardThumbFallback,
} from '@/app/dashboard/DashboardChrome'
import { useConfirm, useConfirmDelete } from '../ConfirmDialog'

const SECTION = DASHBOARD_SECTION_MAP.promotion

type Tab = 'live' | 'inactive' | 'all'
type Counts = { all: number; live: number; inactive: number }

export default function PromotionAdminPage() {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const [promos, setPromos] = useState<Promo[]>([])
  const [counts, setCounts] = useState<Counts>({ all: 0, live: 0, inactive: 0 })
  const [tab, setTab] = useState<Tab>('live')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/promos?scope=all', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load promotions')
      setPromos(data.promos || [])
      setCounts(data.counts || { all: 0, live: 0, inactive: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promotions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    if (tab === 'live') return promos.filter(p => p.isActive)
    if (tab === 'inactive') return promos.filter(p => !p.isActive)
    return promos
  }, [promos, tab])

  const deactivate = async (id: number) => {
    const promo = promos.find(p => p.id === id)
    if (
      !(await confirm({
        title: 'Deactivate?',
        message: `Deactivate “${promo?.title || `promo #${id}`}”?\n\nIt will stop showing in the app.`,
        confirmLabel: 'Yes, deactivate',
        cancelLabel: 'No',
        danger: true,
      }))
    ) {
      return
    }
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/promos/${id}/deactivate`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Deactivate failed')
      setPromos(prev => prev.map(p => (p.id === id ? { ...p, isActive: false } : p)))
      setCounts(c => ({
        all: c.all,
        live: Math.max(0, c.live - 1),
        inactive: c.inactive + 1,
      }))
      setNotice('Promotion deactivated')
      setTab('inactive')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deactivate failed')
    }
  }

  const remove = async (id: number) => {
    const promo = promos.find(p => p.id === id)
    if (!(await confirmDelete(promo?.title || `promo #${id}`, 'This permanently deletes the promotion.'))) {
      return
    }
    setError('')
    try {
      const res = await adminFetch(`/api/admin/promos/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice('Promotion deleted')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="promotion"
        description="Review live and deactivated promos, and see which merchant posted each one."
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {(
            [
              ['live', `Live (${counts.live})`],
              ['inactive', `Deactivated (${counts.inactive})`],
              ['all', `All (${counts.all})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{
                padding: '8px 14px',
                borderRadius: 100,
                border: tab === key ? 'none' : '1px solid var(--border)',
                background: tab === key ? 'var(--primary)' : '#fff',
                color: tab === key ? '#fff' : 'var(--text-2)',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-3)' }}>Loading promotions…</p>
        ) : filtered.length === 0 ? (
          <DashboardEmptyState
            icon={SECTION.icon}
            color={SECTION.color}
            title="No promotions in this view"
            hint={
              tab === 'inactive'
                ? 'Deactivated promos appear here after you deactivate them.'
                : undefined
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(promo => {
              const img = resolvePromoImage(promo.image)
              return (
                <article
                  key={promo.id}
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
                  className="promo-row"
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{promo.title}</h3>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 100,
                          background: promo.isActive ? '#ECFDF5' : '#FEF2F2',
                          color: promo.isActive ? '#166534' : '#991B1B',
                        }}
                      >
                        {promo.isActive ? 'Live' : 'Deactivated'}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
                      {promo.description || 'No description'}
                    </p>
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
                        {postedByLabel(promo)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {postedByEmail(promo)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
                      {formatMwk(promo.price)} · {formatPromoDate(promo.startDate)} → {formatPromoDate(promo.endDate)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {promo.isActive && (
                      <button
                        type="button"
                        onClick={() => void deactivate(promo.id)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: '1px solid var(--border)',
                          background: '#fff',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-2)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Deactivate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(promo.id)}
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
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <style>{`
        @media (max-width: 700px) {
          .promo-row { grid-template-columns: 72px 1fr !important; }
          .promo-row > div:last-child { grid-column: 1 / -1; flex-direction: row !important; }
        }
      `}</style>
    </div>
  )
}
