'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import Link from 'next/link'
import { panelAuthHeaders } from '@/lib/panel-client-auth'
import {
  escrowStatusTone,
  formatDateTime,
  formatMwk,
  isPayoutTx,
  payoutPaidToLabel,
  platformServiceOf,
  serviceFeePercentLabel,
  txStatusTone,
  type EscrowRow,
  type WalletRow,
  type WalletTxRow,
} from '@/lib/finance'
import {
  MIN_PAYOUT_MWK,
  PAYOUT_BANKS,
  PAYOUT_MOMO,
} from '@/lib/payout-destinations'
import {
  isPawaPayCollectionTx,
  isPawaPayPayoutTx,
  pawapayCollectionFeeMwk,
  pawapayCollectionFeePercentLabel,
  pawapayPayoutFeeMwk,
  pawapayPayoutFeePercentLabel,
  resolvedPawaPayPayoutFee,
} from '@/lib/pawapay-fees'
import { useConfirmDelete } from '../ConfirmDialog'

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
  pawapayPayoutFees: number
  pawapayCollectionFees: number
  pawapayTotalFees: number
  pawapayPayoutCount: number
  pawapayCollectionCount: number
}

type WalletView =
  | 'available'
  | 'collected'
  | 'escrow'
  | 'released'
  | 'paid_out'
  | 'pawapay'
  | 'pawapay_payout'
  | 'pawapay_collection'
  | `service:${string}`

const ORDER_FEE_SERVICES = new Set(['marketplace', 'food', 'stay', 'courier'])

function isFeeTx(t: WalletTxRow): boolean {
  const type = t.type.toLowerCase()
  return type === 'service_fee' || type === 'fee'
}

function matchesWalletView(t: WalletTxRow, view: WalletView): boolean {
  switch (view) {
    case 'available':
      return true
    case 'collected':
      return isFeeTx(t)
    case 'escrow':
      return false
    case 'released':
      return isFeeTx(t) && ORDER_FEE_SERVICES.has(t.service)
    case 'paid_out':
      return isPayoutTx(t)
    case 'pawapay':
      return isPawaPayPayoutTx(t) || isPawaPayCollectionTx(t)
    case 'pawapay_payout':
      return isPawaPayPayoutTx(t)
    case 'pawapay_collection':
      return isPawaPayCollectionTx(t)
    default:
      return isFeeTx(t) && t.service === view.slice('service:'.length)
  }
}

type WalletEscrowRow = Pick<
  EscrowRow,
  | 'id'
  | 'status'
  | 'serviceType'
  | 'orderNumber'
  | 'itemName'
  | 'merchantName'
  | 'merchantAmount'
  | 'serviceFeeAmount'
  | 'feeRate'
  | 'txRef'
  | 'createdAt'
  | 'releasedAt'
  | 'releaseKind'
>

function escrowForView(rows: WalletEscrowRow[], view: WalletView): WalletEscrowRow[] {
  if (view === 'escrow') return rows.filter(e => e.status === 'held')
  if (view === 'released') {
    return rows.filter(e => e.status === 'released' || e.status === 'auto_released')
  }
  if (view.startsWith('service:')) {
    const id = view.slice('service:'.length)
    return rows.filter(
      e =>
        e.status === 'held' &&
        platformServiceOf({ serviceType: e.serviceType }) === id,
    )
  }
  return []
}

function viewExplain(
  view: WalletView,
  serviceLabel?: string,
): { title: string; body: string } {
  switch (view) {
    case 'available':
      return {
        title: 'Available to pay out',
        body: 'Current platform-wallet balance in Firestore. It rises when commission is credited and falls when you cash out. PawaPay’s cut is taken from the PawaPay wallet, not this number.',
      }
    case 'collected':
      return {
        title: 'Collected commission',
        body: 'Every service-fee credit into this wallet. Marketplace, food, stay, and courier fees arrive after escrow release. Ride, digital, promote, and homepage-ad payments credit as soon as they are paid.',
      }
    case 'escrow':
      return {
        title: 'Still in escrow',
        body: 'Platform fee sitting on held orders. It is not in this wallet yet. When the buyer confirms receipt or the 7-day window passes, the fee is credited here.',
      }
    case 'released':
      return {
        title: 'Released order fees',
        body: 'Platform fees on marketplace, food, stay, and courier orders that already left escrow. Matching wallet credits are listed with the orders they came from.',
      }
    case 'paid_out':
      return {
        title: 'Paid out',
        body: 'Cash-outs from this wallet to a bank (PayChangu) or mobile money (PawaPay). The amount is what the recipient received.',
      }
    case 'pawapay':
      return {
        title: 'PawaPay took',
        body: 'Estimated Malawi fees PawaPay plus the mobile-money operator take: about 2.75% on cash-outs and 3.33% on digital, promote, and homepage-ad collections. That cut is not deducted from this ledger balance.',
      }
    case 'pawapay_payout':
      return {
        title: 'PawaPay cash-out fees',
        body: 'Mobile-money payouts from this wallet go through PawaPay. The fee is about 2.75% (TNM) or 2.76% (Airtel). The recipient still gets the full cash-out amount.',
      }
    case 'pawapay_collection':
      return {
        title: 'PawaPay collection fees',
        body: 'When a customer pays for digital services, promoted ads, or homepage ads via PawaPay, about 3.33% of that collection is taken by PawaPay and the mobile-money operator.',
      }
    default:
      return {
        title: serviceLabel || 'Service',
        body: `Commission credits for ${serviceLabel || 'this service'}. Amounts still in escrow for this service stay off the wallet until the order is released.`,
      }
  }
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
  pawapayPayoutFees: 0,
  pawapayCollectionFees: 0,
  pawapayTotalFees: 0,
  pawapayPayoutCount: 0,
  pawapayCollectionCount: 0,
}

export default function SuperAdminWalletPage() {
  const confirmDelete = useConfirmDelete()
  const [wallet, setWallet] = useState<WalletRow | null>(null)
  const [transactions, setTransactions] = useState<WalletTxRow[]>([])
  const [escrow, setEscrow] = useState<WalletEscrowRow[]>([])
  const [summary, setSummary] = useState<Summary>(EMPTY)
  const [services, setServices] = useState<ServiceBucket[]>([])
  const [query, setQuery] = useState('')
  const [view, setView] = useState<WalletView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cashOutOpen, setCashOutOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const ledgerRef = useRef<HTMLDivElement>(null)

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
      setEscrow(Array.isArray(data.escrow) ? data.escrow : [])
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

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('view')
    if (!raw) return
    const allowed: WalletView[] = [
      'available',
      'collected',
      'escrow',
      'released',
      'paid_out',
      'pawapay',
      'pawapay_payout',
      'pawapay_collection',
    ]
    if (allowed.includes(raw as WalletView) || raw.startsWith('service:')) {
      setView(raw as WalletView)
    }
  }, [])

  const q = query.trim().toLowerCase()
  const viewEscrow = useMemo(
    () => (view ? escrowForView(escrow, view) : []),
    [escrow, view],
  )
  const filtered = useMemo(() => {
    const scoped = view ? transactions.filter(t => matchesWalletView(t, view)) : transactions
    if (!q) return scoped
    return scoped.filter(
      t =>
        t.description.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        t.transactionId.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.service.toLowerCase().includes(q),
    )
  }, [transactions, q, view])

  const activeService = view?.startsWith('service:')
    ? services.find(s => s.id === view.slice('service:'.length))
    : undefined
  const explain = view ? viewExplain(view, activeService?.label) : null

  function selectView(next: WalletView) {
    setView(cur => (cur === next ? null : next))
    setQuery('')
    window.requestAnimationFrame(() => {
      ledgerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const canCashOut = (summary.balance || 0) >= MIN_PAYOUT_MWK && !!wallet

  async function clearWallet() {
    if (
      !(await confirmDelete(
        'platform wallet',
        'Available balance, pending balance, and wallet history will be set to zero. Money still held in escrow is not touched.',
      ))
    ) {
      return
    }
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
            Vero360 commission from marketplace, food, stay, car hire, rides, digital services,
            promoted ads, and homepage ads is collected here. PawaPay’s processing
            fee is deducted from that commission; the rest stays in this wallet.
            Pay out the available balance to a bank or mobile money.
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

      <button
        type="button"
        onClick={() => selectView('available')}
        style={{
          ...card,
          background: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)',
          color: '#fff',
          marginBottom: 16,
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          outline: view === 'available' ? '3px solid #99F6E4' : 'none',
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>
          {wallet?.merchantName || 'Vero 360 Platform'}
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, margin: '8px 0 4px' }}>
          {formatMwk(summary.balance)}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Available to pay out · click to see every ledger row
        </div>
        {summary.pawapayTotalFees > 0 ? (
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
            PawaPay has taken <strong>{formatMwk(summary.pawapayTotalFees)}</strong> so
            far — {formatMwk(summary.pawapayPayoutFees)} on cash-outs and{' '}
            {formatMwk(summary.pawapayCollectionFees)} on digital/ad collections. That
            cut comes from the PawaPay wallet, not this ledger balance.
          </div>
        ) : null}
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
      </button>

      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 10px' }}>
        Click a card to see the transactions behind it.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Stat
          label="Collected"
          value={formatMwk(summary.lifetimeFees)}
          selected={view === 'collected'}
          onClick={() => selectView('collected')}
        />
        <Stat
          label="Still in escrow"
          value={formatMwk(summary.feesHeld)}
          sub={`${summary.heldCount} orders · not payable yet`}
          selected={view === 'escrow'}
          onClick={() => selectView('escrow')}
        />
        <Stat
          label="Released order fees"
          value={formatMwk(summary.feesCollected)}
          selected={view === 'released'}
          onClick={() => selectView('released')}
        />
        <Stat
          label="Paid out"
          value={formatMwk(summary.payoutTotal)}
          sub={`${summary.payoutCount} payouts`}
          selected={view === 'paid_out'}
          onClick={() => selectView('paid_out')}
        />
        <Stat
          label="PawaPay took"
          value={formatMwk(summary.pawapayTotalFees)}
          sub={`Cash-outs ${formatMwk(summary.pawapayPayoutFees)} · collections ${formatMwk(summary.pawapayCollectionFees)}`}
          selected={view === 'pawapay'}
          onClick={() => selectView('pawapay')}
        />
        <Stat
          label="PawaPay cash-out fees"
          value={formatMwk(summary.pawapayPayoutFees)}
          sub={`${summary.pawapayPayoutCount} mobile-money payouts · ~${pawapayPayoutFeePercentLabel()}`}
          selected={view === 'pawapay_payout'}
          onClick={() => selectView('pawapay_payout')}
        />
        <Stat
          label="PawaPay collection fees"
          value={formatMwk(summary.pawapayCollectionFees)}
          sub={`${summary.pawapayCollectionCount} digital/ad payments · ${pawapayCollectionFeePercentLabel()}`}
          selected={view === 'pawapay_collection'}
          onClick={() => selectView('pawapay_collection')}
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
              service.id === 'pawapay'
                ? service.waiting > 0
                  ? `${formatMwk(service.waiting)} still to deduct`
                  : service.count > 0
                    ? `${service.count} processing fees`
                    : 'No processing fees yet'
                : service.waiting > 0
                  ? `${formatMwk(service.waiting)} still in escrow`
                  : service.count > 0
                    ? `${service.count} credits`
                    : 'No credits yet'
            }
            selected={view === `service:${service.id}`}
            onClick={() => selectView(`service:${service.id}`)}
          />
        ))}
      </div>

      <div ref={ledgerRef}>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: '8px 0 12px' }}>
        {explain ? explain.title : 'Ledger'}
      </h2>
      {explain ? (
        <div
          style={{
            ...card,
            background: '#F0FDFA',
            border: '1px solid #99F6E4',
            marginBottom: 14,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: '#134E4A', lineHeight: 1.5 }}>
            {explain.body}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#0F766E' }}>
            {filtered.length} ledger row{filtered.length === 1 ? '' : 's'}
            {viewEscrow.length > 0
              ? ` · ${viewEscrow.length} escrow order${viewEscrow.length === 1 ? '' : 's'}`
              : ''}
            {view?.startsWith('pawapay')
              ? ` · PawaPay cut ${formatMwk(
                  view === 'pawapay_payout'
                    ? summary.pawapayPayoutFees
                    : view === 'pawapay_collection'
                      ? summary.pawapayCollectionFees
                      : summary.pawapayTotalFees,
                )}`
              : ''}
          </p>
          <button
            type="button"
            onClick={() => setView(null)}
            style={{ ...secondaryBtn, marginTop: 10, padding: '6px 10px', fontSize: 12 }}
          >
            Show all transactions
          </button>
        </div>
      ) : null}
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

      {viewEscrow.length > 0 ? (
        <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
          {viewEscrow.map(row => (
            <EscrowLine key={row.id} row={row} />
          ))}
        </div>
      ) : null}

      {loading && transactions.length === 0 ? (
        <p style={{ color: '#6B7280' }}>Loading wallet…</p>
      ) : filtered.length === 0 && viewEscrow.length === 0 ? (
        <div style={card}>
          <p style={{ margin: 0, color: '#6B7280' }}>
            {view
              ? 'No matching transactions for this card yet.'
              : 'No commission or payouts yet. Marketplace, food, stay, and car hire fees land here when an order is released, after PawaPay processing is deducted. Ride, digital, advert, and promotion payments credit this wallet as soon as they are paid.'}
          </p>
        </div>
      ) : filtered.length === 0 ? null : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(t => {
            const tone = txStatusTone(t.status)
            const payout = isPayoutTx(t)
            const processing = t.type.toLowerCase() === 'processing_fee'
            const outgoing = payout || processing
            const pawaFee = payout
              ? isPawaPayPayoutTx(t)
                ? resolvedPawaPayPayoutFee(t)
                : 0
              : isPawaPayCollectionTx(t)
                ? pawapayCollectionFeeMwk(t.amount)
                : 0
            const focusPawaFee = Boolean(view?.startsWith('pawapay') && pawaFee > 0)
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
                      {payout && payoutPaidToLabel(t)
                        ? ` · paid to ${payoutPaidToLabel(t)}`
                        : ''}
                      {processing ? ' · deducted from commission' : ''}
                      {pawaFee > 0 && !focusPawaFee
                        ? ` · PawaPay ${formatMwk(pawaFee)}`
                        : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 18,
                        color: outgoing || focusPawaFee ? '#C2410C' : '#0F766E',
                      }}
                    >
                      {focusPawaFee
                        ? formatMwk(pawaFee)
                        : `${outgoing ? '−' : '+'}${formatMwk(t.amount)}`}
                    </div>
                    {focusPawaFee ? (
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        PawaPay on {formatMwk(t.amount)}
                      </div>
                    ) : null}
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
                      {payout ? 'payout' : processing ? 'processing' : t.status}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>

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
  const payoutAmount = Math.round(Number(amount)) || 0
  const momoName = PAYOUT_MOMO.find(m => m.id === operatorId)?.name
  const pawapayFee =
    method === 'mobile_money' && payoutAmount > 0
      ? pawapayPayoutFeeMwk(payoutAmount, momoName)
      : 0

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
          PawaPay plus the mobile-money operator take about {pawapayPayoutFeePercentLabel(momoName)}{' '}
          on cash-outs.
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
        {method === 'mobile_money' && pawapayFee > 0 ? (
          <p style={{ margin: '-4px 0 14px', fontSize: 13, color: '#9A3412', fontWeight: 600 }}>
            PawaPay takes about {formatMwk(pawapayFee)} ({pawapayPayoutFeePercentLabel(momoName)})
            on this cash-out. Recipient still gets {formatMwk(payoutAmount)}.
          </p>
        ) : null}

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
  selected,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected || false}
      style={{
        ...card,
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        border: selected ? '2px solid #0F766E' : '1px solid #E5E7EB',
        background: selected ? '#F0FDFA' : '#fff',
      }}
    >
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{value}</div>
      {sub ? (
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{sub}</div>
      ) : (
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>View transactions</div>
      )}
    </button>
  )
}

function EscrowLine({ row }: { row: WalletEscrowRow }) {
  const tone = escrowStatusTone(row.status)
  return (
    <div style={card}>
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
            {row.orderNumber} · {row.itemName}
          </div>
          <div style={{ color: '#6B7280', fontSize: 12, marginTop: 4 }}>
            {row.merchantName} · {row.serviceType}
            {row.txRef ? ` · ${row.txRef}` : ''}
            {row.createdAt ? ` · ${formatDateTime(row.createdAt)}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#0F766E' }}>
            {formatMwk(row.serviceFeeAmount)}
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            Platform fee ({serviceFeePercentLabel(row)})
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
            {row.status.replace('_', ' ')}
          </span>
        </div>
      </div>
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
