'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { panelAuthHeaders, adminFetch } from '@/lib/panel-client-auth'
import {
  escrowReleaseExplanation,
  escrowStatusTone,
  formatDateTime,
  formatMwk,
  isPayoutTx,
  merchantPayoutContactLabel,
  txStatusTone,
  txTypeLabel,
  type EscrowRow,
  type FinanceSummary,
  type WalletRow,
  type WalletTxRow,
} from '@/lib/finance'

type Tab = 'overview' | 'escrow' | 'transactions' | 'wallets' | 'payouts'

const EMPTY_SUMMARY: FinanceSummary = {
  walletCount: 0,
  totalBalance: 0,
  totalPendingBalance: 0,
  platformBalance: 0,
  escrowHeldCount: 0,
  escrowHeldAmount: 0,
  escrowReleasedAmount: 0,
  escrowAutoReleasedAmount: 0,
  escrowRefundedAmount: 0,
  escrowServiceFeesHeld: 0,
  payoutCount: 0,
  payoutAmount: 0,
  merchantsWithPayouts: 0,
  txCount: 0,
}

type EscrowFilter = 'all' | 'held' | 'released' | 'auto_released' | 'refunded'

export default function FinanceAdminPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [wallets, setWallets] = useState<WalletRow[]>([])
  const [transactions, setTransactions] = useState<WalletTxRow[]>([])
  const [escrow, setEscrow] = useState<EscrowRow[]>([])
  const [summary, setSummary] = useState<FinanceSummary>(EMPTY_SUMMARY)
  const [query, setQuery] = useState('')
  const [escrowFilter, setEscrowFilter] = useState<EscrowFilter>('all')
  const [payoutMerchant, setPayoutMerchant] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch('/api/admin/finance', { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load finance data')
      setWallets(data.wallets || [])
      setTransactions(data.transactions || [])
      setEscrow(data.escrow || [])
      setSummary(data.summary || EMPTY_SUMMARY)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load finance data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const q = query.trim().toLowerCase()

  const allPayouts = useMemo(() => transactions.filter(isPayoutTx), [transactions])

  const payoutMerchants = useMemo(() => {
    const map = new Map<string, { key: string; name: string; total: number; count: number }>()
    for (const t of allPayouts) {
      const key = t.walletId || t.userId || 'unknown'
      const cur = map.get(key) || {
        key,
        name: t.merchantName || merchantPayoutContactLabel(t) || 'Merchant',
        total: 0,
        count: 0,
      }
      cur.total += t.amount
      cur.count += 1
      if (t.merchantName) cur.name = t.merchantName
      else if (t.merchantPhone || t.merchantEmail) {
        cur.name = merchantPayoutContactLabel(t)
      }
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [allPayouts])

  const filteredEscrow = useMemo(() => {
    return escrow.filter(e => {
      if (escrowFilter !== 'all' && e.status !== escrowFilter) return false
      if (!q) return true
      return (
        e.orderNumber.toLowerCase().includes(q) ||
        e.itemName.toLowerCase().includes(q) ||
        e.merchantName.toLowerCase().includes(q) ||
        e.merchantUid.toLowerCase().includes(q) ||
        e.buyerUid.toLowerCase().includes(q) ||
        (e.txRef || '').toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.status.toLowerCase().includes(q)
      )
    })
  }, [escrow, escrowFilter, q])

  const filteredTx = useMemo(() => {
    return transactions.filter(t => {
      if (tab === 'payouts') {
        if (!isPayoutTx(t)) return false
        if (payoutMerchant !== 'all') {
          const key = t.walletId || t.userId || 'unknown'
          if (key !== payoutMerchant) return false
        }
      }
      if (!q) return true
      return (
        t.transactionId.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        (t.merchantName || '').toLowerCase().includes(q) ||
        (t.merchantEmail || '').toLowerCase().includes(q) ||
        (t.merchantPhone || '').toLowerCase().includes(q) ||
        (t.userId || '').toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        (t.payoutMethod || '').toLowerCase().includes(q) ||
        (t.recipientName || '').toLowerCase().includes(q) ||
        (t.recipientPhone || '').toLowerCase().includes(q)
      )
    })
  }, [transactions, tab, q, payoutMerchant])

  const filteredWallets = useMemo(() => {
    return wallets.filter(w => {
      if (!q) return true
      return (
        w.merchantName.toLowerCase().includes(q) ||
        w.userId.toLowerCase().includes(q) ||
        w.walletId.toLowerCase().includes(q)
      )
    })
  }, [wallets, q])

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'escrow', label: `Escrow (${summary.escrowHeldCount} held)` },
    { id: 'transactions', label: `Transactions (${summary.txCount})` },
    { id: 'payouts', label: `Payouts (${summary.payoutCount})` },
    { id: 'wallets', label: `Wallets (${summary.walletCount})` },
  ]

  const escrowTabs: Array<{ id: EscrowFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: escrow.length },
    {
      id: 'held',
      label: 'Held',
      count: escrow.filter(e => e.status === 'held').length,
    },
    {
      id: 'released',
      label: 'Buyer confirmed',
      count: escrow.filter(e => e.status === 'released').length,
    },
    {
      id: 'auto_released',
      label: 'Auto (7 days)',
      count: escrow.filter(e => e.status === 'auto_released').length,
    },
    {
      id: 'refunded',
      label: 'Refunded',
      count: escrow.filter(e => e.status === 'refunded').length,
    },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <Link
            href="/dashboard"
            style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}
          >
            ← Dashboard
          </Link>
          <h1 style={{ margin: '8px 0 4px', fontSize: 26, fontWeight: 700 }}>
            Finance & wallets
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
            Merchant balances, escrow holds, and every instant cash-out merchants run —
            same Firestore data as the app.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={btnSecondary}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              ...chip,
              background: tab === t.id ? 'var(--brand, #0F766E)' : '#F3F4F6',
              color: tab === t.id ? '#fff' : '#374151',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'overview' ? (
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search order, merchant, tx ref, wallet…"
          style={{
            width: '100%',
            maxWidth: 420,
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            fontSize: 14,
          }}
        />
      ) : null}

      {loading && wallets.length === 0 && escrow.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Loading finance data…</p>
      ) : null}

      {tab === 'overview' ? <Overview summary={summary} onGo={setTab} /> : null}

      {tab === 'escrow' ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {escrowTabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setEscrowFilter(t.id)}
                style={{
                  ...chip,
                  fontSize: 12,
                  background: escrowFilter === t.id ? '#134E4A' : '#F9FAFB',
                  color: escrowFilter === t.id ? '#fff' : '#4B5563',
                  border: '1px solid #E5E7EB',
                }}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
          {filteredEscrow.length === 0 ? (
            <Empty>No escrow rows match.</Empty>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {filteredEscrow.map(e => (
                <EscrowCard key={e.id} row={e} />
              ))}
            </div>
          )}
        </>
      ) : null}

      {tab === 'payouts' ? (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 14,
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>
              Merchant
            </span>
            <select
              value={payoutMerchant}
              onChange={e => setPayoutMerchant(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                fontSize: 13,
                minWidth: 220,
              }}
            >
              <option value="all">
                All merchants ({summary.payoutCount} payouts · {formatMwk(summary.payoutAmount)})
              </option>
              {payoutMerchants.map(m => (
                <option key={m.key} value={m.key}>
                  {m.name} — {m.count} · {formatMwk(m.total)}
                </option>
              ))}
            </select>
          </div>

          {payoutMerchants.length > 0 && payoutMerchant === 'all' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 10,
                marginBottom: 16,
              }}
            >
              {payoutMerchants.slice(0, 12).map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPayoutMerchant(m.key)}
                  style={{ ...card, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                    {formatMwk(m.total)}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                    {m.count} cash-out{m.count === 1 ? '' : 's'}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {filteredTx.length === 0 ? (
            <Empty>No merchant payouts recorded yet.</Empty>
          ) : (
            <PayoutTable rows={filteredTx} />
          )}
        </>
      ) : null}

      {tab === 'transactions' ? (
        filteredTx.length === 0 ? (
          <Empty>No transactions found.</Empty>
        ) : (
          <TxTable rows={filteredTx} />
        )
      ) : null}

      {tab === 'wallets' ? (
        filteredWallets.length === 0 ? (
          <Empty>No wallets found.</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filteredWallets.map(w => (
              <div key={w.walletId} style={card}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {w.merchantName}
                      {w.isPlatform ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#7C3AED',
                            background: '#F5F3FF',
                            padding: '2px 8px',
                            borderRadius: 999,
                          }}
                        >
                          Platform fees
                        </span>
                      ) : null}
                    </div>
                    <div style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>
                      UID {w.userId} · Wallet {w.walletId}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{formatMwk(w.balance)}</div>
                    <div style={{ color: '#0F766E', fontSize: 12, marginTop: 2, fontWeight: 600 }}>
                      Paid out: {formatMwk(w.payoutTotal)}
                      {w.payoutCount > 0 ? ` (${w.payoutCount})` : ''}
                    </div>
                    {w.pendingBalance > 0 ? (
                      <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>
                        Legacy pending field: {formatMwk(w.pendingBalance)}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 10,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ color: '#9CA3AF', fontSize: 12, flex: 1 }}>
                    Updated {formatDateTime(w.updatedAt)}
                  </div>
                  {w.payoutCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutMerchant(w.walletId)
                        setTab('payouts')
                      }}
                      style={{ ...btnSecondary, padding: '6px 10px', fontSize: 12 }}
                    >
                      View payouts
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}

function Overview({
  summary,
  onGo,
}: {
  summary: FinanceSummary
  onGo: (t: Tab) => void
}) {
  const cards: Array<{
    label: string
    value: string
    sub?: string
    go?: Tab
  }> = [
    {
      label: 'Merchant wallet balances',
      value: formatMwk(summary.totalBalance),
      sub: `${summary.walletCount} wallets`,
      go: 'wallets',
    },
    {
      label: 'Escrow held (not yet paid)',
      value: formatMwk(summary.escrowHeldAmount),
      sub: `${summary.escrowHeldCount} holds · platform fee on hold ${formatMwk(summary.escrowServiceFeesHeld)}`,
      go: 'escrow',
    },
    {
      label: 'Released via buyer confirm',
      value: formatMwk(summary.escrowReleasedAmount),
      sub: 'Buyer tapped confirm receipt in the app',
      go: 'escrow',
    },
    {
      label: 'Auto-released (7-day window)',
      value: formatMwk(summary.escrowAutoReleasedAmount),
      sub: 'No buyer confirm — released after hold window',
      go: 'escrow',
    },
    {
      label: 'Merchant payouts (cash-outs)',
      value: formatMwk(summary.payoutAmount),
      sub: `${summary.payoutCount} payouts · ${summary.merchantsWithPayouts} merchants`,
      go: 'payouts',
    },
    {
      label: 'Platform (service fees)',
      value: formatMwk(summary.platformBalance),
      sub: '2.5% fee wallet (super_admin)',
      go: 'wallets',
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {cards.map(c => (
          <button
            key={c.label}
            type="button"
            onClick={() => c.go && onGo(c.go)}
            style={{
              ...card,
              textAlign: 'left',
              cursor: c.go ? 'pointer' : 'default',
              border: '1px solid #E5E7EB',
            }}
          >
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{c.value}</div>
            {c.sub ? (
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6, lineHeight: 1.4 }}>
                {c.sub}
              </div>
            ) : null}
          </button>
        ))}
      </div>

      <div style={{ ...card, background: '#F8FAFC' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 15 }}>How merchant payout works</h2>
        <ol style={{ margin: 0, paddingLeft: 18, color: '#4B5563', fontSize: 13, lineHeight: 1.6 }}>
          <li>
            Buyer pays → funds go into <strong>order_escrow</strong> (status <code>held</code>),
            not the wallet yet.
          </li>
          <li>
            Merchant ships / marks delivered → <code>deliveredAt</code> + <code>releaseDueAt</code>{' '}
            (usually +7 days).
          </li>
          <li>
            Money reaches the merchant wallet when either the <strong>buyer confirms receipt</strong>{' '}
            (<code>released</code>) or the window passes (<code>auto_released</code>).
          </li>
          <li>
            Merchant cashes out from available balance → PayChangu payout runs and the wallet is
            debited instantly (<code>type: payout</code>, <code>status: completed</code>). Every
            cash-out is recorded under <strong>Payouts</strong>.
          </li>
          <li>
            Refunds on held escrow set status <code>refunded</code> so the merchant is never
            credited.
          </li>
        </ol>
      </div>

      {summary.escrowRefundedAmount > 0 ? (
        <p style={{ marginTop: 14, fontSize: 13, color: '#B91C1C' }}>
          Escrow voided for refunds (merchant not paid): {formatMwk(summary.escrowRefundedAmount)}
        </p>
      ) : null}
    </div>
  )
}

function PayoutTable({ rows }: { rows: WalletTxRow[] }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
            <th style={th}>When</th>
            <th style={th}>Merchant</th>
            <th style={th}>Amount</th>
            <th style={th}>Status</th>
            <th style={th}>Destination</th>
            <th style={th}>Reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => {
            const st = txStatusTone(t.status)
            return (
              <tr key={t.transactionId} style={{ borderTop: '1px solid #F3F4F6' }}>
                <td style={td}>{formatDateTime(t.createdAt)}</td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{t.merchantName || '—'}</div>
                  <div style={{ color: '#6B7280', fontSize: 11 }}>
                    {merchantPayoutContactLabel(t)}
                  </div>
                </td>
                <td style={{ ...td, fontWeight: 700 }}>{formatMwk(t.amount)}</td>
                <td style={td}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: st.bg,
                      color: st.color,
                      border: `1px solid ${st.border}`,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t.status === 'completed' || t.status === 'success'
                      ? 'Cashed out'
                      : t.status}
                  </span>
                </td>
                <td style={td}>
                  <div>{t.description}</div>
                  {[t.payoutMethod, t.bankName, t.recipientName, t.recipientPhone, t.accountNumber]
                    .filter(Boolean)
                    .length > 0 ? (
                    <div style={{ color: '#6B7280', marginTop: 4, fontSize: 12 }}>
                      {[t.payoutMethod, t.bankName, t.recipientName, t.recipientPhone, t.accountNumber]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  ) : null}
                </td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>
                  {t.reference}
                  <div style={{ color: '#9CA3AF', marginTop: 2 }}>{t.transactionId}</div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TxTable({ rows }: { rows: WalletTxRow[] }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
            <th style={th}>When</th>
            <th style={th}>Type</th>
            <th style={th}>Merchant</th>
            <th style={th}>Amount</th>
            <th style={th}>Status</th>
            <th style={th}>Description</th>
            <th style={th}>Reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => {
            const st = txStatusTone(t.status)
            return (
              <tr key={t.transactionId} style={{ borderTop: '1px solid #F3F4F6' }}>
                <td style={td}>{formatDateTime(t.createdAt)}</td>
                <td style={td}>{txTypeLabel(t.type)}</td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{t.merchantName || '—'}</div>
                  <div style={{ color: '#6B7280', fontSize: 11 }}>
                    {merchantPayoutContactLabel(t)}
                  </div>
                </td>
                <td style={{ ...td, fontWeight: 700 }}>{formatMwk(t.amount)}</td>
                <td style={td}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: st.bg,
                      color: st.color,
                      border: `1px solid ${st.border}`,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t.status}
                  </span>
                </td>
                <td style={td}>{t.description}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{t.reference}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EscrowCard({ row }: { row: EscrowRow }) {
  const tone = escrowStatusTone(row.status)
  const explain = escrowReleaseExplanation(row)

  return (
    <div style={card}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {row.orderNumber} · {row.itemName}
          </div>
          <div style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>
            {row.merchantName} · {row.serviceType}
            {row.txRef ? ` · tx ${row.txRef}` : ''}
          </div>
        </div>
        <span
          style={{
            alignSelf: 'flex-start',
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            background: tone.bg,
            color: tone.color,
            border: `1px solid ${tone.border}`,
          }}
        >
          {row.status.replace('_', ' ')}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <Metric label="Merchant gets" value={formatMwk(row.merchantAmount)} />
        <Metric label="Service fee (2.5%)" value={formatMwk(row.serviceFeeAmount)} />
        <Metric label="Shipped" value={formatDateTime(row.deliveredAt)} />
        <Metric label="Auto-release due" value={formatDateTime(row.releaseDueAt)} />
        <Metric label="Released at" value={formatDateTime(row.releasedAt)} />
        <Metric
          label="Release path"
          value={
            row.releaseKind === 'buyer_confirm'
              ? 'Buyer confirmed'
              : row.releaseKind === 'auto_7d' || row.status === 'auto_released'
                ? 'Auto after window'
                : row.releaseKind || '—'
          }
        />
      </div>

      <div
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          background:
            explain.tone === 'refund'
              ? '#FEF2F2'
              : explain.tone === 'released'
                ? '#ECFDF5'
                : explain.tone === 'auto'
                  ? '#EFF6FF'
                  : explain.tone === 'waiting'
                    ? '#FFFBEB'
                    : '#F9FAFB',
          border: '1px solid #E5E7EB',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{explain.title}</div>
        <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.45 }}>{explain.detail}</div>
        {row.refundAfterRelease ? (
          <div style={{ marginTop: 6, fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>
            Refund requested after release — ops clawback may be needed.
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: '#9CA3AF' }}>
        Buyer {row.buyerUid || '—'} · Merchant {row.merchantUid || '—'} · Doc {row.id}
        {row.releaseSource ? ` · via ${row.releaseSource}` : ''}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function Banner({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  const styles =
    tone === 'error'
      ? { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }
      : { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
  return (
    <div
      style={{
        ...styles,
        padding: '10px 14px',
        borderRadius: 8,
        marginBottom: 14,
        fontSize: 14,
      }}
    >
      {children}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p style={{ color: 'var(--muted)', padding: '24px 0', textAlign: 'center' }}>{children}</p>
  )
}

const card: CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 16,
  border: '1px solid #E5E7EB',
}

const chip: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondary: CSSProperties = {
  border: '1px solid #D1D5DB',
  background: '#fff',
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const th: CSSProperties = {
  padding: '10px 12px',
  fontWeight: 600,
  color: '#6B7280',
  whiteSpace: 'nowrap',
}

const td: CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'top',
}
