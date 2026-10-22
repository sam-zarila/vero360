export type FoodOrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'sent'
  | 'delivered'
  | 'cancelled'

export type FoodAdminOrder = {
  id: string
  orderNumber: string
  status: FoodOrderStatus
  kitchen: string
  customerName: string
  customerPhone: string
  itemsSummary: string
  totalMwk: number
  paymentStatus: string
  courierTracking: string
  deliveryAddress: string
  createdAt: string
}

export const FOOD_ORDER_STATUSES: FoodOrderStatus[] = [
  'pending',
  'preparing',
  'ready',
  'sent',
  'delivered',
  'cancelled',
]

function asString(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function asNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function toIso(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString()
  if (
    typeof v === 'object' &&
    v !== null &&
    'toDate' in v &&
    typeof (v as { toDate: () => Date }).toDate === 'function'
  ) {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return ''
    }
  }
  return ''
}

function normalizeStatus(raw: string): FoodOrderStatus {
  const s = raw.trim().toLowerCase()
  if (s === 'completed') return 'delivered'
  if (s === 'out_for_delivery' || s === 'shipped') return 'sent'
  if ((FOOD_ORDER_STATUSES as string[]).includes(s)) return s as FoodOrderStatus
  return 'pending'
}

function itemsSummary(data: Record<string, unknown>): string {
  const raw = data.lineItems ?? data.items ?? data.cartItems
  if (!Array.isArray(raw) || raw.length === 0) return 'Food order'
  const names = raw
    .map(row => {
      if (!row || typeof row !== 'object') return ''
      const item = row as Record<string, unknown>
      const name = asString(item.name || item.title || item.item)
      const qty = asNumber(item.quantity ?? item.qty) || 1
      if (!name) return ''
      return qty > 1 ? `${name} ×${qty}` : name
    })
    .filter(Boolean)
  if (!names.length) return 'Food order'
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
}

export function parseFoodAdminOrder(
  id: string,
  data: Record<string, unknown>,
): FoodAdminOrder {
  return {
    id,
    orderNumber: asString(data.orderNumber) || id,
    status: normalizeStatus(asString(data.status)),
    kitchen: asString(
      data.restaurantName || data.businessName || data.merchantName || 'Kitchen',
    ),
    customerName: asString(data.customerName || data.buyerName),
    customerPhone: asString(data.customerPhone || data.phone),
    itemsSummary: itemsSummary(data),
    totalMwk: asNumber(data.totalMwk ?? data.totalAmount ?? data.total),
    paymentStatus: asString(data.paymentStatus || data.payment_status),
    courierTracking: asString(
      data.courierTrackingNumber || data.trackingNumber || data.tracking,
    ),
    deliveryAddress: asString(
      data.deliveryAddress || data.dropoffAddress || data.address,
    ),
    createdAt: toIso(data.createdAt),
  }
}

export function foodOrderStatusLabel(status: FoodOrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'preparing':
      return 'Preparing'
    case 'ready':
      return 'Ready'
    case 'sent':
      return 'Sent'
    case 'delivered':
      return 'Delivered'
    case 'cancelled':
      return 'Cancelled'
  }
}
