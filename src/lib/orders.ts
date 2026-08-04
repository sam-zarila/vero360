import {
  formatDateTime,
  formatMwk,
  resolveVeroMediaUrl,
  unwrapList,
} from '@/lib/vero-api'

export const ORDER_STATUSES = ['pending', 'confirmed', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_STATUSES = ['PAID', 'UNPAID', 'FAILED', 'PENDING'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number] | string

export type MarketplaceOrder = {
  id: number
  orderNumber: string
  itemName: string
  itemImage: string | null
  category: string
  price: number
  quantity: number
  total: number
  description: string | null
  status: OrderStatus
  paymentStatus: string
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  customerFirebaseUid: string | null
  merchantName: string | null
  merchantEmail: string | null
  merchantPhone: string | null
  merchantFirebaseUid: string | null
  addressCity: string | null
  addressDescription: string | null
  orderDate: string | null
  /** Courier key from description or Firestore delivery proof (ankolo, smart, …). */
  courierMethod: string | null
  tracking: string | null
  /** Firebase Storage download URL from `order_delivery_proofs`. */
  proofUrl: string | null
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value)
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function parseStatus(raw: unknown): OrderStatus {
  const s = str(raw).toLowerCase()
  if (s === 'confirmed') return 'confirmed'
  if (s === 'delivered') return 'delivered'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  return 'pending'
}

function parsePayment(raw: unknown): string {
  const s = str(raw).toUpperCase()
  if (!s) return 'UNPAID'
  if (['PAID', 'SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'COMPLETE'].includes(s)) return 'PAID'
  if (['PENDING', 'PROCESSING', 'AWAITING'].includes(s)) return 'PENDING'
  if (s === 'FAILED') return 'FAILED'
  return s
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  return null
}

function personName(user: Record<string, unknown> | null): string | null {
  if (!user) return null
  return str(user.name) || str(user.displayName) || str(user.businessName) || null
}

/** Matches Flutter `[Delivery: ankolo]` tags embedded in order Description. */
export function parseCourierFromDescription(description: string | null | undefined): string | null {
  const d = str(description).toLowerCase()
  if (!d) return null
  const tagged = d.match(/\[?\s*delivery:\s*([a-z0-9_-]+)\s*\]?/)
  if (tagged?.[1]) return tagged[1]
  if (d.includes('delivery: ankolo') || d.includes('[delivery: ankolo]')) return 'ankolo'
  if (d.includes('delivery: smart') || d.includes('[delivery: smart]')) return 'smart'
  if (d.includes('delivery: speed') || d.includes('[delivery: speed]')) return 'speed'
  if (d.includes('delivery: cts') || d.includes('[delivery: cts]')) return 'cts'
  if (d.includes('delivery: pickup') || d.includes('[delivery: pickup]')) return 'pickup'
  return null
}

export function courierLabel(method: string | null | undefined): string {
  switch (str(method).toLowerCase()) {
    case 'ankolo':
      return 'Ankolo courier'
    case 'smart':
      return 'Smart courier'
    case 'speed':
      return 'Speed courier'
    case 'cts':
      return 'CTS courier'
    case 'pickup':
      return 'Shop pickup'
    case '':
      return '—'
    default:
      return `${str(method)} courier`
  }
}

export function courierTrackingUrl(method: string | null | undefined): string | null {
  const m = str(method).toLowerCase()
  if (m === 'ankolo') return 'https://ankolo.com/track-parcel'
  if (m === 'smart') return 'https://tracking.smartdeliveriesmw.com/'
  return null
}

export type DeliveryMeta = {
  courierMethod: string | null
  tracking: string | null
  proofUrl: string | null
}

export function applyDeliveryMeta(
  order: MarketplaceOrder,
  meta: DeliveryMeta | null | undefined,
): MarketplaceOrder {
  if (!meta) return order
  return {
    ...order,
    courierMethod: meta.courierMethod || order.courierMethod,
    tracking: meta.tracking || order.tracking,
    proofUrl: meta.proofUrl || order.proofUrl,
  }
}

/** Backend placeholder when a real phone was never stored. */
export function isPlaceholderPhone(phone: string | null | undefined): boolean {
  const s = str(phone).toLowerCase()
  if (!s) return true
  return s.includes('firebase')
}

export function isRealPhone(phone: string | null | undefined): boolean {
  const s = str(phone)
  if (!s || isPlaceholderPhone(s)) return false
  const digits = s.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return false
  // Reject encoded ids that still contain letters
  if (/[a-zA-Z]/.test(s)) return false
  return true
}

export function cleanContactEmail(email: string | null | undefined): string | null {
  const e = str(email)
  if (!e) return null
  const lower = e.toLowerCase()
  if (lower.endsWith('@phone.vero360.app')) return null
  if (lower.includes('firebase')) return null
  return e
}

export function cleanContactPhone(phone: string | null | undefined): string | null {
  return isRealPhone(phone) ? str(phone) : null
}

/** Pull Firebase UID from legacy `+firebase_{uid}` phone keys. */
export function firebaseUidFromPhone(phone: string | null | undefined): string | null {
  const s = str(phone)
  const m = s.match(/^\+?firebase[_:](.+)$/i)
  const uid = m?.[1]?.trim()
  return uid || null
}

export function partyFirebaseUid(
  user: Record<string, unknown> | null,
  fallbackPhone?: string | null,
): string | null {
  if (user) {
    const direct =
      str(user.firebaseUid) ||
      str(user.firebase_uid) ||
      str(user.uid) ||
      str(user.firebaseUserId)
    if (direct) return direct
  }
  return firebaseUidFromPhone(fallbackPhone)
}

/** Prefer real phone, then email — never show Firebase placeholder phones. */
export function partyContactLine(
  phone: string | null | undefined,
  email: string | null | undefined,
): string | null {
  return cleanContactPhone(phone) || cleanContactEmail(email) || null
}

export function parseMarketplaceOrders(body: unknown): MarketplaceOrder[] {
  return unwrapList(body)
    .map(row => asRecord(row))
    .filter((row): row is Record<string, unknown> => !!row)
    .map(row => {
      const customer = asRecord(row.customer)
      const merchant = asRecord(row.merchant)
      const address = asRecord(row.address)

      const id = num(row.ID ?? row.id)
      const price = num(row.Price ?? row.price)
      const quantity = Math.max(1, Math.round(num(row.Quantity ?? row.quantity) || 1))

      const rawCustomerPhone = customer ? str(customer.phone) : ''
      const rawMerchantPhone = merchant ? str(merchant.phone) : ''
      const description = str(row.Description ?? row.description) || null

      return {
        id,
        orderNumber: str(row.OrderNumber ?? row.orderNumber) || `#${id}`,
        itemName: str(row.ItemName ?? row.itemName) || 'Item',
        itemImage: str(row.ItemImage ?? row.itemImage) || null,
        category: str(row.Category ?? row.category) || 'other',
        price,
        quantity,
        total: price * quantity,
        description,
        status: parseStatus(row.Status ?? row.status),
        paymentStatus: parsePayment(row.paymentStatus ?? row.PaymentStatus),
        customerName: personName(customer),
        customerEmail: customer ? cleanContactEmail(str(customer.email) || str(customer.contactEmail)) : null,
        customerPhone: cleanContactPhone(rawCustomerPhone),
        customerFirebaseUid: partyFirebaseUid(customer, rawCustomerPhone),
        merchantName: personName(merchant),
        merchantEmail: merchant ? cleanContactEmail(str(merchant.email) || str(merchant.contactEmail)) : null,
        merchantPhone: cleanContactPhone(rawMerchantPhone),
        merchantFirebaseUid: partyFirebaseUid(merchant, rawMerchantPhone),
        addressCity: address
          ? str(address.city ?? address.City) || null
          : null,
        addressDescription: address
          ? str(address.description ?? address.Description ?? address.address) || null
          : null,
        orderDate: tsToIso(row.OrderDate ?? row.orderDate),
        courierMethod: parseCourierFromDescription(description),
        tracking: null,
        proofUrl: null,
      } satisfies MarketplaceOrder
    })
    .filter(o => o.id > 0)
}

export type ContactProfile = {
  name: string | null
  phone: string | null
  email: string | null
}

/** Merge Nest user fields with Firestore / Auth profile (real phone & email). */
export function applyContactProfile(
  order: MarketplaceOrder,
  side: 'customer' | 'merchant',
  profile: ContactProfile | null | undefined,
): MarketplaceOrder {
  if (!profile) return order
  if (side === 'customer') {
    return {
      ...order,
      customerName: order.customerName || profile.name,
      customerPhone: order.customerPhone || profile.phone,
      customerEmail: order.customerEmail || profile.email,
    }
  }
  return {
    ...order,
    merchantName: order.merchantName || profile.name,
    merchantPhone: order.merchantPhone || profile.phone,
    merchantEmail: order.merchantEmail || profile.email,
  }
}

export function statusLabel(status: OrderStatus) {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'confirmed':
      return 'Confirmed'
    case 'delivered':
      return 'Delivered'
    case 'cancelled':
      return 'Cancelled'
  }
}

export function statusTone(status: OrderStatus): { bg: string; color: string; border: string } {
  switch (status) {
    case 'pending':
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
    case 'confirmed':
      return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
    case 'delivered':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    case 'cancelled':
      return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
  }
}

export function paymentTone(payment: string): { bg: string; color: string; border: string } {
  const p = payment.toUpperCase()
  if (p === 'PAID') return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
  if (p === 'PENDING') return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
  return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
}

export function resolveOrderImage(image?: string | null) {
  return resolveVeroMediaUrl(image)
}

export { formatMwk, formatDateTime }
