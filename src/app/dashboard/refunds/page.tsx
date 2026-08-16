'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  formatDateTime,
  formatMwk,
  refundDueAt,
  refundStatusLabel,
  refundStatusTone,
  refundTypeLabel,
  type RefundRequest,
  type RefundStatus,
} from '@/lib/refunds'
import { useConfirm } from '../ConfirmDialog'

type Tab = 'all' | 'pending' | 'processing' | 'completed' | 'failed'

type Counts = {
  all: number
  pending: number
  processing: number
  completed: number
  failed: number
}

const EMPTY_COUNTS: Counts = {
  all: 0,
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
}

export default function RefundsAdminPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState<RefundRequest[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [tab, setTab] = useState<Tab>('pending')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/refunds', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load refunds')
      setItems(data.items || [])
      setCounts(data.counts || EMPTY_COUNTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load refunds')
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
      if (tab === 'pending' && item.status !== 'pending') return false
      if (tab === 'processing' && item.status !== 'processing') return false
      if (tab === 'completed' && item.status !== 'completed') return false
      if (tab === 'failed' && item.status !== 'failed' && item.status !== 'rejected') {
        return false
      }
      if (!q) return true
      return (
        item.orderNumber.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        (item.txRef || '').toLowerCase().includes(q) ||
        (item.refundId || '').toLowerCase().includes(q) ||
        item.orderId.toLowerCase().includes(q) ||
        refundTypeLabel(item.refundType).toLowerCase().includes(q)
      )
    })
  }, [items, tab, query])

  const setStatus = async (item: RefundRequest, status: RefundStatus) => {
    const label = refundStatusLabel(status)
    if (
      !(await confirm({
        title: 'Confirm change?',
        message: `Mark refund for ${item.orderNumber} as “${label}”?`,
        confirmLabel: 'Yes',
        cancelLabel: 'No',
        danger: status === 'failed' || status === 'rejected',
      }))
    ) {
      return
    }

    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(`/api/admin/refunds/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setNotice(`Refund for ${item.orderNumber} marked ${refundStatusLabel(status)}`)
      if (data.item) {
        setItems(prev => prev.map(x => (x.id === item.id ? data.item : x)))
      }
      await load()
      if (status === 'completed') setTab('completed')
      else if (status === 'processing') setTab('processing')
      else if (status === 'failed' || status === 'rejected') setTab('failed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'processing', label: 'Processing', count: counts.processing },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'failed', label: 'Failed', count: counts.failed },
  ]

  return (
    <div>
      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-3)',
          marginBottom: 18,
        }}
      >
        ← Dashboard
      </Link>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
            }}
          >
            Refunds
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: 14 }}>
            Marketplace refund requests from the app (Firestore{' '}
            <code>refund_requests</code>). Track pending and mark completed after
            PayChangu processing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: '#fff',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-2)',
          }}
        >
          Refresh
        </button>
      </div>

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

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ position: 'relative', flex: '1 1 260px' }}>
          <span className="sr-only">Search refunds</span>
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              if (e.target.value.trim()) setTab('all')
            }}
            placeholder="Search order #, item, reason, tx ref…"
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
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
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
          <p style={{ color: 'var(--text-3)' }}>Loading refunds…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-3)' }}>
            {query.trim() || tab !== 'all'
              ? 'No refunds match your filters.'
              : 'No refund requests yet. When buyers or sellers request refunds in the app, they appear here.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(item => {
              const tone = refundStatusTone(item.status)
              const busy = busyId === item.id
              const due = refundDueAt(item)
              return (
                <article
                  key={item.id}
                  className="refund-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    alignItems: 'start',
                  }}
                >
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
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                        {item.itemName}
                      </h3>
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
                        {refundStatusLabel(item.status)}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 100,
                          background: '#F3F4F6',
                          color: '#374151',
                          border: '1px solid #E5E7EB',
                        }}
                      >
                        {refundTypeLabel(item.refundType)}
                      </span>
                      {item.initiatedBySeller && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 100,
                            background: '#FFF7ED',
                            color: '#C2410C',
                            border: '1px solid #FED7AA',
                          }}
                        >
                          Seller initiated
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text-2)',
                        marginBottom: 8,
                      }}
                    >
                      {item.orderNumber} · {formatMwk(item.amount)} {item.currency}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 8,
                      }}
                    >
                      <Meta label="Reason" value={item.reason} />
                      <Meta
                        label="Requested"
                        value={formatDateTime(item.createdAt)}
                        sub={
                          due && item.status !== 'completed'
                            ? `SLA due ${formatDateTime(due)}`
                            : undefined
                        }
                      />
                      <Meta
                        label="Tx / refund id"
                        value={item.txRef || '—'}
                        sub={item.refundId || undefined}
                      />
                      {item.completedAt ? (
                        <Meta label="Completed" value={formatDateTime(item.completedAt)} />
                      ) : null}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      minWidth: 140,
                    }}
                  >
                    {item.status !== 'processing' && item.status !== 'completed' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(item, 'processing')}
                        style={actionBtn('#EFF6FF', '#1D4ED8', '#BFDBFE', busy)}
                      >
                        Mark processing
                      </button>
                    )}
                    {item.status !== 'completed' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(item, 'completed')}
                        style={actionBtn('#ECFDF5', '#047857', '#A7F3D0', busy)}
                      >
                        Mark completed
                      </button>
                    )}
                    {item.status !== 'failed' &&
                      item.status !== 'rejected' &&
                      item.status !== 'completed' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setStatus(item, 'failed')}
                          style={actionBtn('#FEF2F2', '#B91C1C', '#FECACA', busy)}
                        >
                          Mark failed
                        </button>
                      )}
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
          .refund-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

function actionBtn(bg: string, color: string, border: string, busy: boolean) {
  return {
    padding: '9px 12px',
    borderRadius: 10,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 800,
    cursor: busy ? ('wait' as const) : ('pointer' as const),
    opacity: busy ? 0.7 : 1,
  }
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
