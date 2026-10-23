'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AdminPasswordGate } from '@/app/dashboard/AdminPasswordGate'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
} from '@/app/dashboard/DashboardChrome'
import { BankTransferPanel } from '@/app/dashboard/finance/BankTransferPanel'
import { useConfirm, useConfirmDelete } from '@/app/dashboard/ConfirmDialog'
import { useAdminAlerts } from '@/app/dashboard/AdminAlertsProvider'
import { adminFetch, panelAuthHeaders } from '@/lib/panel-client-auth'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import { formatDateTime, formatMwk } from '@/lib/vero-api'

const SECTION = DASHBOARD_SECTION_MAP['bank-transfers']

type SourceGroup = 'all' | 'marketplace' | 'food' | 'stay' | 'digital'
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'rejected'

type Proof = {
  id: string
  txRef: string
  amountMwk: number
  proofUrl: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  source: string
  title: string
  status: string
  createdAt: string | null
  digitalOrderId?: string | null
}

function sourceGroup(source: string): Exclude<SourceGroup, 'all'> {
  const s = (source || '').toLowerCase()
  if (s === 'food') return 'food'
  if (s === 'stay' || s === 'accommodation') return 'stay'
  if (s === 'digital') return 'digital'
  return 'marketplace'
}

function sourceLabel(source: string) {
  switch (sourceGroup(source)) {
    case 'food':
      return 'Food'
    case 'stay':
      return 'Accommodation'
    case 'digital':
      return 'Digital services'
    default:
      return 'Marketplace'
  }
}

function sourceHref(source: string) {
  switch (sourceGroup(source)) {
    case 'food':
      return '/dashboard/food'
    case 'stay':
      return '/dashboard/stay?tab=bookings'
    case 'digital':
      return '/dashboard/digital-services'
    default:
      return '/dashboard/orders'
  }
}

function isPending(status: string) {
  const s = (status || '').toLowerCase()
  return s !== 'confirmed' && s !== 'paid' && s !== 'rejected'
}

function statusMeta(status: string) {
  const s = (status || '').toLowerCase()
  if (s === 'confirmed' || s === 'paid') {
    return { label: 'Money received', bg: '#ECFDF5', color: '#166534' }
  }
  if (s === 'rejected') {
    return { label: 'Not received', bg: '#FEF2F2', color: '#991B1B' }
  }
  return { label: 'Waiting for confirmation', bg: '#FEF3C7', color: '#92400E' }
}

export default function BankTransfersAdminPage() {
  return (
    <AdminPasswordGate
      title="Bank transfers"
      description="Enter your admin panel password to open Bank transfers. This ledger is separate from PawaPay."
    >
      <BankTransfersInner />
    </AdminPasswordGate>
  )
}

function BankTransfersInner() {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const payments = useAdminAlerts().payments
  const [items, setItems] = useState<Proof[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<SourceGroup>('all')
  const [status, setStatus] = useState<StatusFilter>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, setPending] = useState(0)
  const [confirmed, setConfirmed] = useState(0)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [confirmedAmount, setConfirmedAmount] = useState(0)
  const [bySource, setBySource] = useState({
    marketplace: 0,
    food: 0,
    stay: 0,
    digital: 0,
  })
  const [bySourceAmount, setBySourceAmount] = useState({
    marketplace: 0,
    food: 0,
    stay: 0,
    digital: 0,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch('/api/admin/finance/bank-transfers', {
        headers,
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load bank transfers')
      setItems(Array.isArray(data.items) ? data.items : [])
      setPending(Number(data.pending) || 0)
      setConfirmed(Number(data.confirmed) || 0)
      setPendingAmount(Number(data.pendingAmountMwk) || 0)
      setConfirmedAmount(Number(data.confirmedAmountMwk) || 0)
      setBySource({
        marketplace: Number(data.bySource?.marketplace) || 0,
        food: Number(data.bySource?.food) || 0,
        stay: Number(data.bySource?.stay) || 0,
        digital: Number(data.bySource?.digital) || 0,
      })
      setBySourceAmount({
        marketplace: Number(data.bySourceAmountMwk?.marketplace) || 0,
        food: Number(data.bySourceAmountMwk?.food) || 0,
        stay: Number(data.bySourceAmountMwk?.stay) || 0,
        digital: Number(data.bySourceAmountMwk?.digital) || 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load bank transfers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    payments.markBankSeen?.()
  }, [payments.markBankSeen])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      if (source !== 'all' && sourceGroup(item.source) !== source) return false
      const pendingRow = isPending(item.status)
      if (status === 'pending' && !pendingRow) return false
      if (status === 'confirmed' && item.status !== 'confirmed' && item.status !== 'paid') {
        return false
      }
      if (status === 'rejected' && item.status !== 'rejected') return false
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        item.txRef.toLowerCase().includes(q) ||
        item.buyerName.toLowerCase().includes(q) ||
        item.buyerEmail.toLowerCase().includes(q) ||
        item.buyerPhone.toLowerCase().includes(q) ||
        sourceLabel(item.source).toLowerCase().includes(q)
      )
    })
  }, [items, query, source, status])

  const setTransferStatus = async (item: Proof, next: 'confirmed' | 'rejected' | 'pending_review') => {
    const ok = await confirm({
      title:
        next === 'confirmed'
          ? 'Mark money received?'
          : next === 'rejected'
            ? 'Mark not received?'
            : 'Move back to waiting?',
      message:
        next === 'confirmed'
          ? `Confirm ${formatMwk(item.amountMwk)} for ${item.title}. This is tracked on Bank transfers only — not in PawaPay.`
          : next === 'rejected'
            ? `Mark ${item.title} as not received?`
            : `Return ${item.title} to waiting for confirmation?`,
      confirmLabel: next === 'confirmed' ? 'Money received' : next === 'rejected' ? 'Not received' : 'Waiting',
    })
    if (!ok) return
    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch(`/api/admin/finance/bank-transfers/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setNotice(data.message || 'Updated')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const removeTransfer = async (item: Proof) => {
    if (
      !(await confirmDelete(
        item.title || item.txRef || item.id,
        `Permanently delete this ${sourceLabel(item.source).toLowerCase()} bank transfer? This cannot be undone.`,
      ))
    ) {
      return
    }
    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      const res = await adminFetch(
        `/api/admin/finance/bank-transfers/${encodeURIComponent(item.id)}`,
        { method: 'DELETE' },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setNotice(`Deleted ${item.title || item.txRef || 'bank transfer'}`)
      setItems(prev => prev.filter(x => x.id !== item.id))
      const group = sourceGroup(item.source)
      setBySource(prev => ({ ...prev, [group]: Math.max(0, prev[group] - 1) }))
      setBySourceAmount(prev => ({
        ...prev,
        [group]: Math.max(0, prev[group] - item.amountMwk),
      }))
      if (isPending(item.status)) {
        setPending(n => Math.max(0, n - 1))
        setPendingAmount(n => Math.max(0, n - item.amountMwk))
      } else if (item.status === 'confirmed' || item.status === 'paid') {
        setConfirmed(n => Math.max(0, n - 1))
        setConfirmedAmount(n => Math.max(0, n - item.amountMwk))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const sourceTabs: Array<{ id: SourceGroup; label: string; count: number }> = [
    { id: 'all', label: 'All services', count: items.length },
    { id: 'marketplace', label: 'Marketplace', count: bySource.marketplace },
    { id: 'food', label: 'Food', count: bySource.food },
    { id: 'stay', label: 'Accommodation', count: bySource.stay },
    { id: 'digital', label: 'Digital', count: bySource.digital },
  ]

  const statusTabs: Array<{ id: StatusFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: items.length },
    { id: 'pending', label: 'Waiting', count: pending },
    { id: 'confirmed', label: 'Received', count: confirmed },
    {
      id: 'rejected',
      label: 'Not received',
      count: items.filter(i => i.status === 'rejected').length,
    },
  ]

  return (
    <div>
      <DashboardBackLink />
      <DashboardPageHeader
        sectionId="bank-transfers"
        description="National Bank ledger by service: Marketplace, Food, Accommodation, Digital. PawaPay mobile money stays in Finance."
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

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

      <BankTransferPanel />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Metric label="Waiting" value={String(pending)} sub={formatMwk(pendingAmount)} />
        <Metric label="Received" value={String(confirmed)} sub={formatMwk(confirmedAmount)} />
        <Metric label="All bank transfers" value={String(items.length)} sub="Not in PawaPay" />
        <Metric label="Marketplace" value={String(bySource.marketplace)} sub={formatMwk(bySourceAmount.marketplace)} />
        <Metric label="Food" value={String(bySource.food)} sub={formatMwk(bySourceAmount.food)} />
        <Metric label="Accommodation" value={String(bySource.stay)} sub={formatMwk(bySourceAmount.stay)} />
        <Metric label="Digital" value={String(bySource.digital)} sub={formatMwk(bySourceAmount.digital)} />
      </div>

      <DashboardSearchField
        value={query}
        onChange={setQuery}
        placeholder="Search buyer, ref, service…"
        label="Search bank transfers"
        onClear={() => setQuery('')}
      />

      <ChipRow
        tabs={sourceTabs}
        active={source}
        onPick={id => setSource(id)}
      />
      <ChipRow
        tabs={statusTabs}
        active={status}
        onPick={id => setStatus(id)}
      />

      {loading && items.length === 0 ? (
        <p style={{ color: 'var(--text-3)' }}>Loading bank transfers…</p>
      ) : filtered.length === 0 ? (
        <DashboardEmptyState
          icon={SECTION.icon}
          color={SECTION.color}
          title={query.trim() ? `No transfers for “${query.trim()}”` : 'No bank transfers yet'}
          hint="When a customer uploads a National Bank slip, it appears here — separate from PawaPay."
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(item => {
            const tone = statusMeta(item.status)
            const busy = busyId === item.id
            const pendingRow = isPending(item.status)
            return (
              <article
                key={item.id}
                style={{
                  background: '#fff',
                  border: '1px solid #FDE68A',
                  borderRadius: 14,
                  padding: 16,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 160px) 1fr auto',
                  gap: 16,
                  alignItems: 'start',
                }}
              >
                {item.proofUrl ? (
                  <a href={item.proofUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.proofUrl}
                      alt="Transfer slip"
                      style={{
                        width: '100%',
                        height: 140,
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: '1px solid #FCD34D',
                        background: '#FFFBEB',
                      }}
                    />
                  </a>
                ) : (
                  <div
                    style={{
                      height: 140,
                      borderRadius: 10,
                      background: '#FFFBEB',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#92400E',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    No photo
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{item.title}</div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: '#FFF7ED',
                        color: '#9A3412',
                      }}
                    >
                      {sourceLabel(item.source)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: tone.bg,
                        color: tone.color,
                      }}
                    >
                      {tone.label}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, color: '#B45309' }}>
                    {formatMwk(item.amountMwk)}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>
                    {item.buyerName}
                    {item.buyerPhone ? ` · ${item.buyerPhone}` : ''}
                    {item.buyerEmail ? ` · ${item.buyerEmail}` : ''}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#6B7280' }}>
                    Ref {item.txRef || '—'}
                    {item.createdAt ? ` · ${formatDateTime(item.createdAt)}` : ''}
                  </div>
                  <Link
                    href={sourceHref(item.source)}
                    style={{
                      display: 'inline-block',
                      marginTop: 8,
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#9A3412',
                    }}
                  >
                    Open {sourceLabel(item.source).toLowerCase()} order
                  </Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
                  {pendingRow ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setTransferStatus(item, 'confirmed')}
                        style={actionBtn('#166534', '#ECFDF5', '#A7F3D0')}
                      >
                        {busy ? 'Saving…' : 'Money received'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setTransferStatus(item, 'rejected')}
                        style={actionBtn('#991B1B', '#FEF2F2', '#FECACA')}
                      >
                        Not received
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setTransferStatus(item, 'pending_review')}
                      style={actionBtn('#92400E', '#FFFBEB', '#FDE68A')}
                    >
                      Back to waiting
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeTransfer(item)}
                    style={actionBtn('#991B1B', '#FEF2F2', '#FECACA')}
                  >
                    {busy ? 'Removing…' : 'Delete'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #FDE68A',
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 900 }}>{value}</div>
      <div style={{ marginTop: 2, fontSize: 12, color: '#6B7280' }}>{sub}</div>
    </div>
  )
}

function ChipRow<T extends string>({
  tabs,
  active,
  onPick,
}: {
  tabs: Array<{ id: T; label: string; count: number }>
  active: T
  onPick: (id: T) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {tabs.map(t => {
        const on = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            style={{
              padding: '8px 12px',
              borderRadius: 100,
              border: on ? '1px solid #B45309' : '1px solid var(--border)',
              background: on ? '#FFFBEB' : '#fff',
              color: on ? '#9A3412' : 'var(--text-2)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {t.label} ({t.count})
          </button>
        )
      })}
    </div>
  )
}

function actionBtn(color: string, bg: string, border: string): CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 10,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}
