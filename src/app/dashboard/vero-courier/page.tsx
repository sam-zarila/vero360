'use client'
import { adminFetch } from '@/lib/panel-client-auth'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  adminActionsFor,
  formatDateTime,
  statusLabel,
  statusTone,
  type CourierDelivery,
  type CourierStatus,
} from '@/lib/courier'
import { useConfirm } from '../ConfirmDialog'

type Tab = 'all' | 'PENDING' | 'ACCEPTED' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED'

type Counts = {
  all: number
  pending: number
  accepted: number
  onTheWay: number
  delivered: number
  cancelled: number
}

const EMPTY_COUNTS: Counts = {
  all: 0,
  pending: 0,
  accepted: 0,
  onTheWay: 0,
  delivered: 0,
  cancelled: 0,
}

const ACTION_STYLES: Record<
  'accept' | 'coming' | 'deliver' | 'reject',
  { bg: string; color: string; border: string }
> = {
  accept: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  coming: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  deliver: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  reject: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
}

export default function VeroCourierAdminPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState<CourierDelivery[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [tab, setTab] = useState<Tab>('PENDING')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/courier', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load courier deliveries')
      setItems(data.items || [])
      setCounts(data.counts || EMPTY_COUNTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courier deliveries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byTab = tab === 'all' ? items : items.filter(item => item.status === tab)
    if (!q) return byTab

    return byTab.filter(item => {
      const tracking = item.trackingNumber.toLowerCase()
      const id = String(item.id)
      return tracking.includes(q) || id.includes(q) || tracking.replace(/^vc/, '').includes(q.replace(/^vc/, ''))
    })
  }, [items, tab, query])

  const setStatus = async (id: number, status: CourierStatus, label: string) => {
    if (status === 'CANCELLED') {
      if (
        !(await confirm({
          title: 'Reject delivery?',
          message: `Reject delivery #${id}?\n\nThe user will see this as Rejected.`,
          confirmLabel: 'Yes, reject',
          cancelLabel: 'No',
          danger: true,
        }))
      ) {
        return
      }
    } else {
      if (
        !(await confirm({
          title: 'Confirm action?',
          message: `${label} for delivery #${id}?`,
          confirmLabel: 'Yes',
          cancelLabel: 'No',
          danger: false,
        }))
      ) {
        return
      }
    }

    setError('')
    setNotice('')
    setBusyId(id)
    try {
      const res = await adminFetch(`/api/admin/courier/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Status update failed')
      setNotice(`Delivery #${id} marked ${label}. User will see this update.`)
      if (status === 'ACCEPTED') setTab('ACCEPTED')
      else if (status === 'ON_THE_WAY') setTab('ON_THE_WAY')
      else if (status === 'DELIVERED') setTab('DELIVERED')
      else if (status === 'CANCELLED') setTab('CANCELLED')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed')
    } finally {
      setBusyId(null)
    }
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'PENDING', label: 'Needs action', count: counts.pending },
    { id: 'ACCEPTED', label: 'Accepted', count: counts.accepted },
    { id: 'ON_THE_WAY', label: 'Coming', count: counts.onTheWay },
    { id: 'DELIVERED', label: 'Delivered', count: counts.delivered },
    { id: 'CANCELLED', label: 'Rejected', count: counts.cancelled },
    { id: 'all', label: 'All', count: counts.all },
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
            Vero Courier
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-3)', margin: 0, maxWidth: 560 }}>
            Manage courier requests. Accept, mark Coming, or Reject — the user sees these updates in the app.
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
        <label
          style={{
            flex: '1 1 260px',
            position: 'relative',
            display: 'block',
          }}
        >
          <span className="sr-only">Search courier number</span>
          <input
            type="search"
            value={query}
            onChange={e => {
              const value = e.target.value
              setQuery(value)
              if (value.trim()) setTab('all')
            }}
            placeholder="Search courier / tracking number…"
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
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--primary)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
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
          <p style={{ color: 'var(--text-3)' }}>Loading courier deliveries…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-3)' }}>
            {query.trim()
              ? `No courier found for “${query.trim()}”.`
              : tab === 'PENDING'
                ? 'No pending courier requests. New requests will appear here for Accept / Reject.'
                : 'No courier deliveries in this view.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(item => {
              const tone = statusTone(item.status)
              const busy = busyId === item.id
              const actions = adminActionsFor(item.status)

              return (
                <article
                  key={item.id}
                  className="courier-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 16,
                    padding: 16,
                    borderRadius: 14,
                    border:
                      item.status === 'PENDING'
                        ? '1.5px solid var(--primary)'
                        : '1px solid var(--border)',
                    background: item.status === 'PENDING' ? 'var(--primary-50)' : 'var(--surface)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                        #{item.id}
                        {item.trackingNumber ? ` · ${item.trackingNumber}` : ''}
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
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <Meta
                        label="Sender"
                        value={item.senderName || item.phone || '—'}
                        sub={item.email || item.phone}
                      />
                      <Meta label="City" value={item.city || '—'} />
                      <Meta label="Pickup" value={item.pickupLocation || '—'} />
                      <Meta label="Drop-off" value={item.dropoffLocation || '—'} />
                      {item.recipientName && (
                        <Meta
                          label="Recipient"
                          value={item.recipientName}
                          sub={item.recipientPhone || undefined}
                        />
                      )}
                      {item.typeOfGoods && (
                        <Meta
                          label="Goods"
                          value={item.typeOfGoods}
                          sub={item.descriptionOfGoods || undefined}
                        />
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
                      Created {formatDateTime(item.createdAt)}
                      {item.updatedAt ? ` · Updated ${formatDateTime(item.updatedAt)}` : ''}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      alignItems: 'stretch',
                      minWidth: 150,
                    }}
                  >
                    {actions.length > 0 ? (
                      <>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--text-4)',
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                          }}
                        >
                          Update user
                        </span>
                        {actions.map(action => {
                          const style = ACTION_STYLES[action.kind]
                          return (
                            <button
                              key={action.status}
                              type="button"
                              disabled={busy}
                              onClick={() => void setStatus(item.id, action.status, action.label)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: `1px solid ${style.border}`,
                                background: style.bg,
                                fontSize: 13,
                                fontWeight: 700,
                                color: style.color,
                                opacity: busy ? 0.6 : 1,
                              }}
                            >
                              {action.label}
                            </button>
                          )
                        })}
                      </>
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', maxWidth: 160 }}>
                        {item.status === 'DELIVERED'
                          ? 'Completed. User was notified as Delivered.'
                          : 'Rejected. User was notified.'}
                      </p>
                    )}
                  </div>
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
        @media (max-width: 760px) {
          .courier-row { grid-template-columns: 1fr !important; }
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
