import 'server-only'

import { getAdminDb } from '@/lib/firebase-admin'

export const BANK_TRANSFER_PAYMENTS_COLLECTION = 'bank_transfer_payments'

export function isBankTransferPending(status: string) {
  const s = status.trim().toLowerCase()
  return s !== 'confirmed' && s !== 'paid' && s !== 'rejected'
}

export function bankTransferSourceGroup(source: string) {
  const s = source.trim().toLowerCase()
  if (s === 'food') return 'food' as const
  if (s === 'stay' || s === 'accommodation') return 'stay' as const
  if (s === 'digital') return 'digital' as const
  return 'marketplace' as const
}

export type BankTransferPayment = {
  id: string
  txRef: string
  amountMwk: number
  proofUrl: string
  buyerUid: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  source: string
  title: string
  digitalOrderId: string | null
  foodOrderId: string | null
  stayBookingRef: string | null
  orderIds: string[]
  orderNumbers: string[]
  status: string
  createdAt: string | null
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
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return null
    }
  }
  return null
}

export function parseBankTransferPayment(
  id: string,
  data: Record<string, unknown>,
): BankTransferPayment {
  const urls = Array.isArray(data.proofUrls)
    ? data.proofUrls.map(v => str(v)).filter(Boolean)
    : []
  const orderIds = Array.isArray(data.orderIds)
    ? data.orderIds.map(v => str(v)).filter(Boolean)
    : []
  const orderNumbers = Array.isArray(data.orderNumbers)
    ? data.orderNumbers.map(v => str(v)).filter(Boolean)
    : []
  return {
    id,
    txRef: str(data.txRef),
    amountMwk: num(data.amountMwk ?? data.amount),
    proofUrl: str(data.proofUrl) || urls[0] || '',
    buyerUid: str(data.buyerUid),
    buyerName: str(data.buyerName) || 'Buyer',
    buyerEmail: str(data.buyerEmail),
    buyerPhone: str(data.buyerPhone),
    source: str(data.source) || 'checkout',
    title: str(data.title) || 'Bank transfer',
    digitalOrderId: str(data.digitalOrderId) || null,
    foodOrderId: str(data.foodOrderId) || null,
    stayBookingRef: str(data.stayBookingRef) || null,
    orderIds,
    orderNumbers,
    status: str(data.status) || 'pending_review',
    createdAt: tsToIso(data.createdAt),
  }
}

export function bankLedgerKeys(items: BankTransferPayment[]): {
  txRefs: Set<string>
  docIds: Set<string>
} {
  const txRefs = new Set<string>()
  const docIds = new Set<string>()
  for (const item of items) {
    if (item.txRef) txRefs.add(item.txRef)
    for (const id of item.orderIds) {
      if (id) docIds.add(id)
    }
    if (item.foodOrderId) docIds.add(item.foodOrderId)
    if (item.stayBookingRef) {
      const safe = item.stayBookingRef
        .trim()
        .replace(/[/\s.#$[\] ]/g, '_')
        .replace(/_+/g, '_')
      if (safe) docIds.add(`acc_${safe}`)
    }
  }
  return { txRefs, docIds }
}

export async function listBankTransferPayments(limit = 200): Promise<BankTransferPayment[]> {
  const snap = await getAdminDb()
    .collection(BANK_TRANSFER_PAYMENTS_COLLECTION)
    .limit(limit)
    .get()
  return snap.docs
    .map(d => parseBankTransferPayment(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })
}
