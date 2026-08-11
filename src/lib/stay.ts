import {
  cleanContactEmail,
  cleanContactPhone,
  partyContactLine,
  partyFirebaseUid,
} from '@/lib/orders'
import {
  formatDateTime,
  formatMwk,
  resolveVeroMediaUrl,
  unwrapList,
} from '@/lib/vero-api'

export const ACCOMMODATION_TYPES = [
  'hotel',
  'lodge',
  'bnb',
  'house',
  'hostel',
  'apartment',
] as const

export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number]

export const PRICING_PERIODS = ['night', 'day', 'month'] as const
export type PricingPeriod = (typeof PRICING_PERIODS)[number]

export const BOOKING_PAYMENT_STATUSES = ['PAID', 'UNPAID', 'FAILED'] as const
export type BookingPaymentStatus = (typeof BOOKING_PAYMENT_STATUSES)[number]

export type StayListing = {
  id: number
  name: string
  location: string
  description: string | null
  price: number
  accommodationType: AccommodationType | string
  image: string | null
  gallery: string[]
  hostName: string | null
  hostEmail: string | null
  hostPhone: string | null
  hostFirebaseUid: string | null
  pricingPeriod: PricingPeriod | string | null
  capacity: number | null
  isAvailable: boolean | null
  hostelGender: string | null
  roomType: string | null
}

export type StayBooking = {
  id: number
  bookingNumber: string
  bookingDate: string | null
  checkOutDate: string | null
  createdAt: string | null
  price: number
  bookingFee: number | null
  paymentStatus: string
  /** App lifecycle status: pending / confirmed / cancelled / completed */
  bookingStatus: string
  paid: boolean
  accommodationId: number | null
  accommodationName: string | null
  accommodationType: string | null
  accommodationLocation: string | null
  accommodationImage: string | null
  guestName: string | null
  guestEmail: string | null
  guestPhone: string | null
  guestFirebaseUid: string | null
  hostName: string | null
  hostEmail: string | null
  hostPhone: string | null
  hostFirebaseUid: string | null
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

function first(m: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (m[k] != null && str(m[k]) !== '') return m[k]
  }
  return null
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  return null
}

function parseType(raw: unknown): AccommodationType | string {
  let t = str(raw).toLowerCase()
  if (t === 'apartments') t = 'apartment'
  if (t === 'houses') t = 'house'
  if ((ACCOMMODATION_TYPES as readonly string[]).includes(t)) return t
  return t || 'hotel'
}

/** Matches Flutter `accommodationPricePeriodFromDynamic` + pricingPeriodRaw keys. */
function parsePricingPeriod(row: Record<string, unknown>): PricingPeriod | string | null {
  const keys = [
    'pricingPeriod',
    'pricePeriod',
    'billingPeriod',
    'billing_period',
    'priceUnit',
    'price_unit',
    'ratePeriod',
    'rateType',
  ]
  let raw: unknown = null
  for (const k of keys) {
    if (row[k] != null) {
      raw = row[k]
      break
    }
  }
  const pricing = asRecord(row.pricing)
  if (raw == null && pricing) {
    for (const k of [...keys, 'period', 'unit', 'interval']) {
      if (pricing[k] != null) {
        raw = pricing[k]
        break
      }
    }
  }
  const p = str(raw).toLowerCase().replace(/[\s_-]+/g, '')
  if (!p) return null
  if (['day', 'perday', 'daily'].includes(p)) return 'day'
  if (['month', 'permonth', 'monthly'].includes(p)) return 'month'
  if (['night', 'pernight', 'nightly'].includes(p)) return 'night'
  return str(raw).toLowerCase() || null
}

function personName(user: Record<string, unknown> | null): string | null {
  if (!user) return null
  return (
    str(user.name) ||
    str(user.displayName) ||
    str(user.fullName) ||
    str(user.businessName) ||
    null
  )
}

function looksLikeFirebaseUid(s: string): boolean {
  const t = s.trim()
  if (t.length < 20 || t.length > 128) return false
  return /^[a-zA-Z0-9_-]+$/.test(t)
}

/** Matches Flutter `Accommodation._resolveHostFirebaseUid`. */
function resolveHostFirebaseUid(
  row: Record<string, unknown>,
  owner: Record<string, unknown> | null,
): string | null {
  const candidates: string[] = []
  const take = (v: unknown) => {
    const s = str(v)
    if (s) candidates.push(s)
  }
  if (owner) {
    for (const k of [
      'firebaseUid',
      'firebase_uid',
      'firebaseUserId',
      'uid',
      'merchantUid',
    ]) {
      take(owner[k])
    }
  }
  for (const k of [
    'hostUid',
    'hostMerchantUid',
    'merchantFirebaseUid',
    'merchantId',
  ]) {
    take(row[k])
  }
  for (const c of candidates) {
    if (looksLikeFirebaseUid(c)) return c
  }
  return partyFirebaseUid(owner, owner ? str(owner.phone) : null)
}

function galleryOf(row: Record<string, unknown>): string[] {
  const g = row.gallery
  if (!Array.isArray(g)) return []
  return g.map(x => str(x)).filter(Boolean)
}

function sanitizePhone(raw: string | null | undefined): string | null {
  return cleanContactPhone(raw)
}

/** Nest `GET /accommodations/all` returns a raw JSON array (same as Flutter). */
export function parseStayListings(body: unknown): StayListing[] {
  return unwrapList(body)
    .map(row => asRecord(row))
    .filter((row): row is Record<string, unknown> => !!row)
    .map(row => {
      const owner = asRecord(row.owner)
      const rawPhone = owner ? str(owner.phone) : ''
      const id = num(row.id ?? row.ID)
      const roomsRaw = row.roomsAvailable ?? row.roomCount ?? row.capacity ?? 1
      const capacity = Math.max(1, Math.round(num(roomsRaw) || 1))

      return {
        id,
        name: str(row.name) || 'Listing',
        location: str(row.location) || '—',
        description: str(row.description) || null,
        price: num(row.pricePerNight ?? row.price),
        accommodationType: parseType(row.accommodationType ?? row.type),
        image: str(row.image ?? row.imageUrl) || null,
        gallery: galleryOf(row),
        hostName: personName(owner),
        hostEmail: owner
          ? cleanContactEmail(str(owner.email) || str(owner.contactEmail))
          : null,
        hostPhone: sanitizePhone(rawPhone),
        hostFirebaseUid: resolveHostFirebaseUid(row, owner),
        pricingPeriod: parsePricingPeriod(row),
        capacity,
        isAvailable:
          typeof row.isAvailable === 'boolean'
            ? row.isAvailable
            : row.isAvailable == null
              ? null
              : Boolean(row.isAvailable),
        hostelGender: str(row.hostelGender).toLowerCase() || null,
        roomType: str(row.roomType).toLowerCase() || null,
      } satisfies StayListing
    })
    .filter(item => item.id > 0)
}

function normalizeBookingStatus(raw: unknown): string {
  const s = str(raw).toLowerCase().replace(/[\s_-]+/g, '')
  if (['pending', 'processing', 'inprogress', 'awaitingpayment', 'unpaid', 'open'].includes(s)) {
    return 'pending'
  }
  if (['confirmed', 'confirm', 'active', 'approved', 'booked', 'accepted'].includes(s)) {
    return 'confirmed'
  }
  if (['cancelled', 'canceled', 'declined', 'failed', 'rejected'].includes(s)) {
    return 'cancelled'
  }
  if (
    ['completed', 'complete', 'done', 'paid', 'successful', 'success', 'succeeded', 'settled'].includes(
      s,
    )
  ) {
    return 'completed'
  }
  return s || 'pending'
}

function normalizePaymentStatus(row: Record<string, unknown>): string {
  const raw = str(row.paymentStatus ?? row.PaymentStatus ?? row.payment_status).toUpperCase()
  if (raw === 'PAID' || row.paid === true || row.isPaid === true) return 'PAID'
  if (raw === 'FAILED') return 'FAILED'
  if (raw === 'PENDING' || raw === 'PROCESSING') return 'PENDING'
  if (raw) return raw
  return 'UNPAID'
}

/** Format like Flutter `formatVeroAccommodationBookingRef`. */
export function formatBookingRef(raw: string | null | undefined): string {
  const s = str(raw)
  if (!s) return ''
  const lower = s.toLowerCase()
  if (lower.startsWith('vero')) {
    const rest = s.length > 4 ? s.slice(4).trim() : ''
    return rest ? `VERO${rest}` : 'VERO'
  }
  if (s.startsWith('#')) return s
  return `VERO${s}`
}

/**
 * Parses Nest bookings (admin/all, me, merchant/me) using the same field
 * aliases as Flutter `BookingItem.fromJson`.
 */
export function parseStayBookings(body: unknown): StayBooking[] {
  return unwrapList(body)
    .map(row => asRecord(row))
    .filter((row): row is Record<string, unknown> => !!row)
    .map(row => {
      const acc =
        asRecord(row.accommodation) ||
        asRecord(row.Accommodation) ||
        null
      const person =
        asRecord(row.customer) ||
        asRecord(row.guest) ||
        asRecord(row.user) ||
        asRecord(row.booker) ||
        asRecord(row.client) ||
        null
      const owner = acc ? asRecord(acc.owner) : null

      const id = num(first(row, ['ID', 'id', 'bookingId', 'BookingId']))
      const paymentStatus = normalizePaymentStatus(row)
      const statusRaw =
        first(row, ['status', 'Status', 'bookingStatus', 'BookingStatus']) ??
        first(row, ['paymentStatus', 'payment_status'])
      const bookingStatus = normalizeBookingStatus(
        statusRaw ?? (paymentStatus === 'PAID' ? 'paid' : 'pending'),
      )

      const guestPhoneRaw =
        str(
          first(row, [
            'guestPhone',
            'guest_phone',
            'customerPhone',
            'phone_number',
            'phoneNumber',
            'phone',
          ]),
        ) || (person ? str(person.phone ?? person.phoneNumber) : '')

      const bookingNumber =
        str(
          first(row, [
            'bookingNumber',
            'BookingNumber',
            'bookingRef',
            'reference',
            'referenceNumber',
            'orderNumber',
            'tx_ref',
            'txRef',
          ]),
        ) || String(id)

      return {
        id,
        bookingNumber: formatBookingRef(bookingNumber) || `#${id}`,
        bookingDate: tsToIso(
          first(row, ['bookingDate', 'BookingDate', 'date', 'createdAt']),
        ),
        checkOutDate: tsToIso(
          first(row, [
            'checkOut',
            'checkOutDate',
            'checkout',
            'endDate',
            'departureDate',
          ]),
        ),
        createdAt: tsToIso(row.createdAt),
        price: num(first(row, ['price', 'Price'])),
        bookingFee: (() => {
          const fee = first(row, ['bookingFee', 'BookingFee'])
          if (fee == null || fee === '') return null
          return num(fee)
        })(),
        paymentStatus,
        bookingStatus,
        paid: paymentStatus === 'PAID',
        accommodationId:
          num(first(row, ['accommodationId', 'AccommodationId'])) ||
          (acc ? num(acc.id) : 0) ||
          null,
        accommodationName:
          (acc ? str(acc.name) : '') ||
          str(first(row, ['accommodationName', 'propertyName', 'title'])) ||
          null,
        accommodationType: acc
          ? parseType(acc.accommodationType ?? acc.type)
          : parseType(row.accommodationType) || null,
        accommodationLocation:
          (acc ? str(acc.location) : '') ||
          str(first(row, ['accommodationLocation', 'location'])) ||
          null,
        accommodationImage: acc
          ? str(acc.image ?? acc.imageUrl) || null
          : str(row.imageUrl ?? row.image) || null,
        guestName:
          str(
            first(row, [
              'guestName',
              'guest_name',
              'customerName',
              'bookerName',
            ]),
          ) ||
          personName(person) ||
          null,
        guestEmail:
          cleanContactEmail(
            str(first(row, ['guestEmail', 'guest_email', 'customerEmail'])) ||
              (person ? str(person.email) : ''),
          ) || null,
        guestPhone: sanitizePhone(guestPhoneRaw),
        guestFirebaseUid: partyFirebaseUid(person, guestPhoneRaw),
        hostName: personName(owner),
        hostEmail: owner
          ? cleanContactEmail(str(owner.email) || str(owner.contactEmail))
          : null,
        hostPhone: sanitizePhone(owner ? str(owner.phone) : ''),
        hostFirebaseUid: acc ? resolveHostFirebaseUid(acc, owner) : null,
      } satisfies StayBooking
    })
    .filter(item => item.id > 0)
}

export type RoomMeta = {
  pricingPeriod: PricingPeriod | string | null
  capacity: number | null
  isAvailable: boolean | null
  hostelGender: string | null
  roomType: string | null
}

export function applyRoomMeta(
  listing: StayListing,
  meta: RoomMeta | null | undefined,
): StayListing {
  if (!meta) return listing
  return {
    ...listing,
    pricingPeriod: meta.pricingPeriod || listing.pricingPeriod,
    capacity: meta.capacity ?? listing.capacity,
    isAvailable: meta.isAvailable ?? listing.isAvailable,
    hostelGender: meta.hostelGender || listing.hostelGender,
    roomType: meta.roomType || listing.roomType,
  }
}

export function typeLabel(type: string) {
  const t = type.toLowerCase()
  if (t === 'bnb') return 'BnB'
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Stay'
}

export function pricingLabel(period: string | null | undefined, price: number) {
  const amount = formatMwk(price)
  switch (str(period).toLowerCase()) {
    case 'day':
      return `${amount} / day`
    case 'month':
      return `${amount} / month`
    case 'night':
    default:
      return `${amount} / night`
  }
}

export function bookingStatusLabel(status: string) {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'Pending'
    case 'confirmed':
      return 'Confirmed'
    case 'cancelled':
      return 'Cancelled'
    case 'completed':
      return 'Completed'
    default:
      return status || '—'
  }
}

export function paymentTone(payment: string): { bg: string; color: string; border: string } {
  const p = payment.toUpperCase()
  if (p === 'PAID') return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
  if (p === 'PENDING') return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
  if (p === 'FAILED') return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
  return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
}

export function typeTone(type: string): { bg: string; color: string; border: string } {
  switch (type.toLowerCase()) {
    case 'hotel':
      return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
    case 'lodge':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    case 'bnb':
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
    case 'hostel':
      return { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' }
    case 'apartment':
      return { bg: '#F0F9FF', color: '#0369A1', border: '#BAE6FD' }
    case 'house':
      return { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' }
    default:
      return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
  }
}

export function availabilityLabel(value: boolean | null | undefined) {
  if (value === true) return 'Available'
  if (value === false) return 'Unavailable'
  return 'Unknown'
}

export function resolveStayImage(image?: string | null) {
  return resolveVeroMediaUrl(image)
}

export { formatDateTime, formatMwk, partyContactLine }
