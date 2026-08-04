import { formatDateTime, formatMwk } from '@/lib/vero-api'

export const WALLETS_COLLECTION = 'wallets'
export const WALLET_TX_COLLECTION = 'wallet_transactions'
export const ORDER_ESCROW_COLLECTION = 'order_escrow'

export type EscrowStatus =
  | 'held'
  | 'released'
  | 'auto_released'
  | 'refunded'
  | string

export type WalletRow = {
  walletId: string
  userId: string
  merchantName: string
  balance: number
  pendingBalance: number
  updatedAt: string | null
  createdAt: string | null
  isPlatform: boolean
}

export type WalletTxRow = {
  transactionId: string
  walletId: string
  merchantName: string | null
  userId: string | null
  type: string
  amount: number
  status: string
  description: string
  reference: string
  createdAt: string | null
  payoutMethod: string | null
  bankName: string | null
  accountNumber: string | null
  recipientName: string | null
  recipientPhone: string | null
  fee: number | null
}

export type EscrowRow = {
  id: string
  status: EscrowStatus
  serviceType: string
  orderNumber: string
  itemName: string
  buyerUid: string
  merchantUid: string
  merchantName: string
  merchantAmount: number
  serviceFeeAmount: number
  txRef: string | null
  deliveredAt: string | null
  releaseDueAt: string | null
  releasedAt: string | null
  releaseKind: string | null
  releaseSource: string | null
  refundAfterRelease: boolean
  refundReason: string | null
  createdAt: string | null
  updatedAt: string | null
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString()
      } catch {
        return null
      }
    }
    const seconds =
      (value as { _seconds?: number; seconds?: number })._seconds ??
      (value as { seconds?: number }).seconds
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString()
  }
  return null
}

export function parseWallet(id: string, data: Record<string, unknown>): WalletRow {
  const userId = str(data.userId)
  return {
    walletId: str(data.walletId) || id,
    userId,
    merchantName: str(data.merchantName) || (userId === 'super_admin' ? 'Vero 360 Platform' : 'Merchant'),
    balance: num(data.balance),
    pendingBalance: num(data.pendingBalance),
    updatedAt: tsToIso(data.updatedAt),
    createdAt: tsToIso(data.createdAt),
    isPlatform: userId === 'super_admin',
  }
}

export function parseWalletTx(
  id: string,
  data: Record<string, unknown>,
  walletLookup?: Map<string, WalletRow>,
): WalletTxRow {
  const walletId = str(data.walletId)
  const wallet = walletLookup?.get(walletId)
  return {
    transactionId: str(data.transactionId) || id,
    walletId,
    merchantName: wallet?.merchantName || null,
    userId: wallet?.userId || null,
    type: str(data.type) || 'credit',
    amount: num(data.amount),
    status: str(data.status).toLowerCase() || 'pending',
    description: str(data.description) || '—',
    reference: str(data.reference) || '—',
    createdAt: tsToIso(data.createdAt),
    payoutMethod: str(data.payoutMethod) || null,
    bankName: str(data.bankName) || null,
    accountNumber: str(data.accountNumber) || null,
    recipientName: str(data.recipientName) || null,
    recipientPhone: str(data.recipientPhone) || null,
    fee: data.fee == null || data.fee === '' ? null : num(data.fee),
  }
}

export function parseEscrow(id: string, data: Record<string, unknown>): EscrowRow {
  return {
    id,
    status: str(data.status).toLowerCase() || 'held',
    serviceType: str(data.serviceType) || 'marketplace',
    orderNumber: str(data.orderNumber) || id,
    itemName: str(data.itemName) || '—',
    buyerUid: str(data.buyerUid),
    merchantUid: str(data.merchantUid),
    merchantName: str(data.merchantName) || 'Merchant',
    merchantAmount: num(data.merchantAmount),
    serviceFeeAmount: num(data.serviceFeeAmount),
    txRef: str(data.txRef || data.tx_ref) || null,
    deliveredAt: tsToIso(data.deliveredAt),
    releaseDueAt: tsToIso(data.releaseDueAt),
    releasedAt: tsToIso(data.releasedAt),
    releaseKind: str(data.releaseKind) || null,
    releaseSource: str(data.releaseSource) || null,
    refundAfterRelease: data.refundAfterRelease === true,
    refundReason: str(data.refundReason) || null,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  }
}

/** Human explanation of how / when money reaches the merchant. */
export function escrowReleaseExplanation(e: EscrowRow): {
  title: string
  detail: string
  tone: 'held' | 'waiting' | 'released' | 'auto' | 'refund'
} {
  const status = e.status.toLowerCase()

  if (status === 'refunded') {
    return {
      title: 'Refunded — not paid to merchant',
      detail: e.refundReason
        ? `Hold voided for refund. ${e.refundReason}`
        : 'Escrow voided so the merchant is not paid.',
      tone: 'refund',
    }
  }

  if (status === 'released') {
    const byBuyer =
      e.releaseKind === 'buyer_confirm' ||
      (e.releaseKind || '').includes('buyer')
    return {
      title: byBuyer ? 'Released — buyer confirmed receipt' : 'Released to merchant wallet',
      detail: byBuyer
        ? `Buyer confirmed parcel receipt${e.releasedAt ? ` on ${formatDateTime(e.releasedAt)}` : ''}. Merchant credited.`
        : `Funds credited to merchant${e.releasedAt ? ` on ${formatDateTime(e.releasedAt)}` : ''}.`,
      tone: 'released',
    }
  }

  if (status === 'auto_released') {
    return {
      title: 'Released — automatic after hold window',
      detail: `Buyer did not confirm in time. Auto-released after the escrow window${
        e.releasedAt ? ` on ${formatDateTime(e.releasedAt)}` : ''
      }.`,
      tone: 'auto',
    }
  }

  // held
  if (!e.deliveredAt) {
    return {
      title: 'Held — waiting for shipment',
      detail:
        'Payment is held until the merchant uploads shipment proof / marks delivered. Then the buyer can confirm or auto-release starts.',
      tone: 'held',
    }
  }

  if (e.releaseDueAt) {
    const due = new Date(e.releaseDueAt)
    const overdue = !Number.isNaN(due.getTime()) && due.getTime() <= Date.now()
    return {
      title: overdue
        ? 'Held — auto-release due (awaiting process)'
        : 'Held — awaiting buyer confirm or auto-release',
      detail: overdue
        ? `Shipment recorded. Auto-release was due ${formatDateTime(e.releaseDueAt)}. Buyer can still confirm; otherwise Cloud Function / app refresh releases funds.`
        : `Shipment recorded. Buyer can confirm receipt to release now, or funds auto-release on ${formatDateTime(e.releaseDueAt)} (7-day window after ship).`,
      tone: 'waiting',
    }
  }

  return {
    title: 'Held — shipped, window not set',
    detail: 'Delivered timestamp present but release due date missing — may need repair.',
    tone: 'waiting',
  }
}

export function escrowStatusTone(status: string): {
  bg: string
  color: string
  border: string
} {
  switch (status.toLowerCase()) {
    case 'held':
      return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
    case 'released':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    case 'auto_released':
      return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
    case 'refunded':
      return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
    default:
      return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
  }
}

export function txStatusTone(status: string): {
  bg: string
  color: string
  border: string
} {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    case 'pending':
    case 'processing':
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
    case 'failed':
    case 'cancelled':
      return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
    default:
      return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
  }
}

export function txTypeLabel(type: string) {
  switch (type.toLowerCase()) {
    case 'payout':
      return 'Payout'
    case 'sale_escrow':
      return 'Sale (escrow release)'
    case 'credit':
      return 'Credit'
    case 'debit':
      return 'Debit'
    case 'refund':
      return 'Refund'
    case 'fee':
    case 'service_fee':
      return 'Service fee'
    default:
      return type || 'Transaction'
  }
}

export type FinanceSummary = {
  walletCount: number
  totalBalance: number
  totalPendingBalance: number
  platformBalance: number
  escrowHeldCount: number
  escrowHeldAmount: number
  escrowReleasedAmount: number
  escrowAutoReleasedAmount: number
  escrowRefundedAmount: number
  escrowServiceFeesHeld: number
  pendingPayoutCount: number
  pendingPayoutAmount: number
  completedPayoutAmount: number
  txCount: number
}

export function buildFinanceSummary(
  wallets: WalletRow[],
  txs: WalletTxRow[],
  escrow: EscrowRow[],
): FinanceSummary {
  const merchantWallets = wallets.filter(w => !w.isPlatform)
  const platform = wallets.find(w => w.isPlatform)

  const payouts = txs.filter(t => t.type.toLowerCase() === 'payout')
  const pendingPayouts = payouts.filter(t => t.status === 'pending' || t.status === 'processing')
  const completedPayouts = payouts.filter(t => t.status === 'completed' || t.status === 'success')

  const held = escrow.filter(e => e.status === 'held')
  const released = escrow.filter(e => e.status === 'released')
  const auto = escrow.filter(e => e.status === 'auto_released')
  const refunded = escrow.filter(e => e.status === 'refunded')

  return {
    walletCount: wallets.length,
    totalBalance: merchantWallets.reduce((s, w) => s + w.balance, 0),
    totalPendingBalance: merchantWallets.reduce((s, w) => s + w.pendingBalance, 0),
    platformBalance: platform?.balance ?? 0,
    escrowHeldCount: held.length,
    escrowHeldAmount: held.reduce((s, e) => s + e.merchantAmount, 0),
    escrowReleasedAmount: released.reduce((s, e) => s + e.merchantAmount, 0),
    escrowAutoReleasedAmount: auto.reduce((s, e) => s + e.merchantAmount, 0),
    escrowRefundedAmount: refunded.reduce((s, e) => s + e.merchantAmount, 0),
    escrowServiceFeesHeld: held.reduce((s, e) => s + e.serviceFeeAmount, 0),
    pendingPayoutCount: pendingPayouts.length,
    pendingPayoutAmount: pendingPayouts.reduce((s, t) => s + t.amount, 0),
    completedPayoutAmount: completedPayouts.reduce((s, t) => s + t.amount, 0),
    txCount: txs.length,
  }
}

export { formatDateTime, formatMwk }
