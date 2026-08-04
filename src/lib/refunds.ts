import { formatDateTime, formatMwk } from '@/lib/vero-api'

/** Same collection as Flutter `OrderRefundService.collectionName`. */
export const REFUND_REQUESTS_COLLECTION = 'refund_requests'

export const REFUND_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'rejected',
] as const

export type RefundStatus = (typeof REFUND_STATUSES)[number]

export const REFUND_TYPES = ['cancel_order', 'return_goods'] as const
export type RefundType = (typeof REFUND_TYPES)[number]

export type RefundRequest = {
  id: string
  orderId: string
  orderNumber: string
  itemName: string
  amount: number
  currency: string
  refundType: string
  reason: string
  txRef: string | null
  status: RefundStatus | string
  refundId: string | null
  processingDays: number
  initiatedBySeller: boolean
  requestedByUid: string | null
  buyerUid: string | null
  merchantUid: string | null
  createdAt: string | null
  updatedAt: string | null
  completedAt: string | null
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

export function normalizeRefundStatus(raw: unknown): RefundStatus | string {
  const s = str(raw).toLowerCase()
  if (!s) return 'pending'
  if (s === 'complete' || s === 'done' || s === 'success' || s === 'successful' || s === 'settled') {
    return 'completed'
  }
  if (s === 'in_progress' || s === 'inprogress' || s === 'processing') return 'processing'
  if (s === 'fail' || s === 'failed' || s === 'error') return 'failed'
  if (s === 'reject' || s === 'rejected' || s === 'declined') return 'rejected'
  if ((REFUND_STATUSES as readonly string[]).includes(s)) return s
  return s
}

export function isRefundStatus(value: string): value is RefundStatus {
  return (REFUND_STATUSES as readonly string[]).includes(value)
}

export function parseRefundRequest(
  id: string,
  data: Record<string, unknown>,
): RefundRequest {
  return {
    id,
    orderId: str(data.orderId),
    orderNumber: str(data.orderNumber) || str(data.orderId) || '—',
    itemName: str(data.itemName) || 'Item',
    amount: num(data.amount),
    currency: str(data.currency) || 'MWK',
    refundType: str(data.refundType) || 'cancel_order',
    reason: str(data.reason) || '—',
    txRef: str(data.txRef) || null,
    status: normalizeRefundStatus(data.status),
    refundId: str(data.refundId) || null,
    processingDays: Math.max(0, Math.round(num(data.processingDays) || 3)),
    initiatedBySeller: data.initiatedBySeller === true,
    requestedByUid: str(data.requestedByUid) || null,
    buyerUid: str(data.buyerUid) || null,
    merchantUid: str(data.merchantUid) || null,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    completedAt: tsToIso(data.completedAt),
  }
}

export function refundTypeLabel(type: string) {
  switch (type.toLowerCase()) {
    case 'cancel_order':
      return 'Cancel order & refund'
    case 'return_goods':
      return 'Return goods & refund'
    default:
      return type || 'Refund'
  }
}

export function refundStatusLabel(status: string) {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'Pending'
    case 'processing':
      return 'Processing'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'rejected':
      return 'Rejected'
    default:
      return status || '—'
  }
}

export function refundStatusTone(status: string): {
  bg: string
  color: string
  border: string
} {
  switch (status.toLowerCase()) {
    case 'pending':
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
    case 'processing':
      return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
    case 'completed':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    case 'failed':
    case 'rejected':
      return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
    default:
      return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
  }
}

export function countRefunds(items: RefundRequest[]) {
  return {
    all: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    processing: items.filter(i => i.status === 'processing').length,
    completed: items.filter(i => i.status === 'completed').length,
    failed: items.filter(i => i.status === 'failed' || i.status === 'rejected').length,
  }
}

/** SLA due date from createdAt + processingDays (app default 3). */
export function refundDueAt(item: RefundRequest): string | null {
  if (!item.createdAt) return null
  const d = new Date(item.createdAt)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + (item.processingDays || 3))
  return d.toISOString()
}

export { formatDateTime, formatMwk }
