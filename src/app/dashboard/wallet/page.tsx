'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import { panelAuthHeaders } from '@/lib/panel-client-auth'
import {
  formatDateTime,
  formatMwk,
  isPayoutTx,
  txStatusTone,
  type WalletRow,
  type WalletTxRow,
} from '@/lib/finance'
import {
  MIN_PAYOUT_MWK,
  PAYOUT_BANKS,
  PAYOUT_MOMO,
} from '@/lib/payout-destinations'

type ServiceBucket = {
  id: string
  label: string
  credited: number
  waiting: number
  count: number
}

type Summary = {
  balance: number
  pendingBalance: number
  lifetimeFees: number
  feesHeld: number
  feesCollected: number
  heldCount: number
  feeCount: number
  payoutTotal: number
  payoutCount: number
}

const EMPTY: Summary = {
  balance: 0,
  pendingBalance: 0,
  lifetimeFees: 0,
  feesHeld: 0,
  feesCollected: 0,
  heldCount: 0,
  feeCount: 0,
  payoutTotal: 0,
  payoutCount: 0,
}

export default function SuperAdminWalletPage() {
  const [wallet, setWallet] = useState<WalletRow | null>(null)
  const [transactions, setTransactions] = useState<WalletTxRow[]>([])
  const [summary, setSummary] = useState<Summary>(EMPTY)
  const [services, setServices] = useState<ServiceBucket[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cashOutOpen, setCashOutOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const headers = await panelAuthHeaders()
      const res = await fetch('/api/admin/wallet', { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load admin wallet')
      setWallet(data.wallet || null)
      setTransactions(data.transactions || [])
      setSummary({ ...EMPTY, ...(data.summary || {}) })
      setServices(Array.isArray(data.byService) ? data.byService : [])
      const bf = data.backfill
      if (bf && typeof bf.credited === 'number' && bf.credited > 0) {
        setNotice(
          `Recovered ${bf.credited} missing fee credit${bf.credited === 1 ? '' : 's'} totaling ${formatMwk(bf.amount)}.`,
        )
      } else if (bf && typeof bf.mergedDuplicates === 'number' && bf.mergedDuplicates > 0) {
        setNotice(
          `Merged ${bf.mergedDuplicates} duplicate platform wallet${bf.mergedDuplicates === 1 ? '' : 's'} into the canonical admin wallet.`,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin wallet')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return transactions
    return transactions.filter(
      t =>
        t.description.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        t.transactionId.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q),
    )
  }, [transactions, q])

  const canCashOut = (summary.balance || 0) >= MIN_PAYOUT_MWK && !!wallet

  async function clearWallet() {
    const ok = window.confirm(
      'Clear the platform wallet? Available balance, pending balance, and wallet history will be set to zero. Money still held in escrow is not touched.',
    )
    if (!ok) return
    setClearing(true)
    setError('')
    setNotice('')
    try {
      const headers = await panelAuthHeaders()
      const res = await fetch('/api/admin/wallet/clear', { method: 'POST', headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not clear platform wallet')
      const cleared = formatMwk(Number(data.balanceCleared) || 0)
      await load()
      setNotice(`Cleared ${cleared} from the platform wallet.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear platform wallet')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Platform wallet</h1>
          <p style={{ color: '#6B7280', marginTop: 6, marginBottom: 0, maxWidth: 640 }}>
            Vero360 commission from marketplace, food, stay, rides, digital services,
            promoted ads, and homepage ads is collected here. Pay out the available
            balance to a bank or mobile money.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard/finance" style={secondaryBtn}>
            Open finance
          </Link>
          <button type="button" onClick={() => void load()} style={secondaryBtn}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => void clearWallet()}
            disabled={clearing || loading || !wallet}
            style={{
              ...secondaryBtn,
              color: '#991B1B',
              borderColor: '#FECACA',
              opacity: clearing || loading || !wallet ? 0.5 : 1,
            }}
          >
            {clearing ? 'Clearing…' : 'Clear wallet'}
          </button>
          <button
            type="button"
            onClick={() => setCashOutOpen(true)}
            disabled={!canCashOut}
            style={{
              ...primaryBtn,
              opacity: canCashOut ? 1 : 0.5,
              cursor: canCashOut ? 'pointer' : 'not-allowed',
            }}
            title={
              canCashOut
                ? 'Cash out available balance'
                : `Need at least MWK ${MIN_PAYOUT_MWK.toLocaleString()} available`
            }
          >
            Pay out
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            ...card,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          style={{
            ...card,
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#047857',
            marginBottom: 16,
          }}
        >
          {notice}
        </div>
      ) : null}

      <div
        style={{
          ...card,
          background: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)',
          color: '#fff',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>
          {wallet?.merchantName || 'Vero 360 Platform'}
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, margin: '8px 0 4px' }}>
          {formatMwk(summary.balance)}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Available to pay out · {wallet?.userId || 'super_admin'}
        </div>
        {summary.feesHeld > 0 ? (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.12)',
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            <strong>{formatMwk(summary.feesHeld)}</strong> is still in escrow across{' '}
            {summary.heldCount} order{summary.heldCount === 1 ? '' : 's'}. It moves
            into this balance when the order is released.
          </div>
        ) : null}
        {!wallet && !loading ? (
          <p style={{ margin: '12px 0 0', fontSize: 13, opacity: 0.9 }}>
            The wallet is created on the first commission credit from the app.
          </p>
        ) : null}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Stat label="Collected" value={formatMwk(summary.lifetimeFees)} />
        <Stat
          label="Still in escrow"
          value={formatMwk(summary.feesHeld)}
          sub={`${summary.heldCount} orders · not payable yet`}
        />
        <Stat label="Released order fees" value={formatMwk(summary.feesCollected)} />
        <Stat
          label="Paid out"
          value={formatMwk(summary.payoutTotal)}
          sub={`${summary.payoutCount} payouts`}
        />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 800, margin: '4px 0 12px' }}>
        Commission by service
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {services.map(service => (
          <Stat
            key={service.id}
            label={service.label}
            value={formatMwk(service.credited)}
            sub={
              service.waiting > 0
                ? `${formatMwk(service.waiting)} still in escrow`
                : service.count > 0
                  ? `${service.count} credits`
                  : 'No credits yet'
            }
          />
        ))}
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 800, margin: '8px 0 12px' }}>Ledger</h2>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search description, tx ref, type…"
        style={{
          width: '100%',
          maxWidth: 420,
          marginBottom: 14,
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid #E5E7EB',
          fontSize: 14,
        }}
      />

      {loading && transactions.length === 0 ? (
        <p style={{ color: '#6B7280' }}>Loading wallet…</p>
      ) : filtered.length === 0 ? (
        <div style={card}>
          <p style={{ margin: 0, color: '#6B7280' }}>
            No commission or payouts yet. Marketplace, food, and stay fees land here
            when an order is released. Ride, digital, advert, and promotion payments
            credit this wallet as soon as they are paid.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(t => {
            const tone = txStatusTone(t.status)
            const payout = isPayoutTx(t)
            return (
              <div key={t.transactionId} style={card}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {t.description}
                      {!payout && t.service && t.service !== 'other' ? (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            color: '#0F766E',
                          }}
                        >
                          {t.service.replace('_', ' ')}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>
                      {formatDateTime(t.createdAt)} · {t.reference}
                      {payout && t.payoutMethod ? ` · ${t.payoutMethod}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 18,
                        color: payout ? '#C2410C' : '#0F766E',
                      }}
                    >
                      {payout ? '−' : '+'}
                      {formatMwk(t.amount)}
                    </div>
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: tone.bg,
                        color: tone.color,
                      }}
                    >
                      {payout ? 'payout' : t.status}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {cashOutOpen ? (
        <CashOutDialog
          available={summary.balance}
          onClose={() => setCashOutOpen(false)}
          onSuccess={async () => {
            setCashOutOpen(false)
            await load()
          }}
        />
      ) : null}
    </div>
  )
}

function CashOutDialog({
  available,
  onClose,
  onSuccess,
}: {
  available: number
  onClose: () => void
  onSuccess: () => Promise<void>
}) {
  const [method, setMethod] = useState<'bank' | 'mobile_money'>('bank')
  const [amount, setAmount] = useState(String(Math.floor(available)))
  const [bankUuid, setBankUuid] = useState<string>(PAYOUT_BANKS[0].uuid)
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [operatorId, setOperatorId] = useState<string>(PAYOUT_MOMO[0].id)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    const n = Math.round(Number(amount))
    if (!Number.isFinite(n) || n < MIN_PAYOUT_MWK) {
      setErr(`Minimum withdrawal is MWK ${MIN_PAYOUT_MWK.toLocaleString()}.`)
      return
    }
    if (n > available) {
      setErr('Amount is more than the available balance.')
      return
    }
    setBusy(true)
    try {
      const headers = await panelAuthHeaders(true)
      const payload =
        method === 'bank'
          ? {
              method,
              amount: n,
              bankUuid,
              accountName,
              accountNumber,
              email,
            }
          : {
              method,
              amount: n,
              operatorId,
              phone,
              email,
            }
      const res = await fetch('/api/admin/wallet/payout', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Cash-out failed')
      await onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Cash-out failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={e => void submit(e)}
        onClick={e => e.stopPropagation()}
        style={{
          ...card,
          width: '100%',
          maxWidth: 460,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Pay out</h3>
        <p style={{ margin: '0 0 16px', color: '#6B7280', fontSize: 13 }}>
          Available {formatMwk(available)}. Minimum MWK {MIN_PAYOUT_MWK.toLocaleString()}.
          Mobile money is sent instantly through PawaPay. Bank transfers stay on PayChangu.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setMethod('bank')}
            style={method === 'bank' ? primaryBtn : secondaryBtn}
          >
            Bank
          </button>
          <button
            type="button"
            onClick={() => setMethod('mobile_money')}
            style={method === 'mobile_money' ? primaryBtn : secondaryBtn}
          >
            Mobile money
          </button>
        </div>

        <label style={label}>
          Amount (MWK)
          <input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            inputMode="numeric"
            style={input}
            required
          />
        </label>

        {method === 'bank' ? (
          <>
            <label style={label}>
              Bank
              <select
                value={bankUuid}
                onChange={e => setBankUuid(e.target.value)}
                style={input}
              >
                {PAYOUT_BANKS.map(b => (
                  <option key={b.uuid} value={b.uuid}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={label}>
              Account name
              <input
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                style={input}
                required
              />
            </label>
            <label style={label}>
              Account number
              <input
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                style={input}
                required
              />
            </label>
          </>
        ) : (
          <>
            <label style={label}>
              Operator
              <select
                value={operatorId}
                onChange={e => setOperatorId(e.target.value)}
                style={input}
              >
                {PAYOUT_MOMO.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={label}>
              Mobile number
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0999xxxxxx"
                style={input}
                required
              />
            </label>
          </>
        )}

        <label style={label}>
          Email (optional)
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={input}
          />
        </label>

        {err ? (
          <div style={{ color: '#991B1B', fontSize: 13, margin: '8px 0 12px' }}>{err}</div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={secondaryBtn} disabled={busy}>
            Cancel
          </button>
          <button type="submit" style={primaryBtn} disabled={busy}>
            {busy ? 'Sending…' : 'Request payout'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{value}</div>
      {sub ? (
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{sub}</div>
      ) : null}
    </div>
  )
}

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: 14,
  padding: 16,
}

const primaryBtn: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#0F766E',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryBtn: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #E5E7EB',
  background: '#fff',
  color: '#111827',
  fontWeight: 700,
  textDecoration: 'none',
  cursor: 'pointer',
}

const label: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 12,
}

const input: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #E5E7EB',
  fontSize: 14,
  fontWeight: 500,
  width: '100%',
}
