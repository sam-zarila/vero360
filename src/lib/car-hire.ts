/**
 * Car-hire contract types + tolerant parsers.
 *
 * This module is client-safe. It intentionally models only public-safe vehicle
 * fields: registration plate, owner/operator identifiers and tracker data are
 * never read or returned here.
 */

import { formatMwk, resolveVeroMediaUrl, unwrapList } from '@/lib/vero-api'

export type StatusTone = { bg: string; color: string; border: string }

export type CarListing = {
  id: number
  make: string
  model: string
  year: number | null
  color: string | null
  dailyRate: number
  currency: string
  isAvailable: boolean | null
  imageUrl: string | null
  images: string[]
  description: string | null
  seats: number | null
  transmission: string | null
  fuelType: string | null
  bodyType: string | null
  pickupArea: string | null
  latitude: number | null
  longitude: number | null
  rating: number
  reviews: number
  listingStatus: string
  availableForDates: boolean | null
  depositAmount: number
  minRentalDays: number
  maxRentalDays: number | null
}

/** Derived booking-page metadata for a listing (no private fields). */
export type BookingPage = {
  carId: number
  minRentalDays: number
  maxRentalDays: number | null
  depositAmount: number
  dailyRate: number
  currency: string
  pickupArea: string | null
  isAvailable: boolean
}

export type RentalQuoteLineItem = {
  code: string
  label: string
  amount: number
}

export type RentalQuoteDeposit = {
  amount: number
  collectionMode: string | null
}

export type RentalQuote = {
  quoteId: string
  carId: number | null
  currency: string
  startAt: string | null
  endAt: string | null
  expiresAt: string | null
  days: number
  dailyRate: number
  lineItems: RentalQuoteLineItem[]
  subtotal: number
  surcharges: number
  discounts: number
  insurance: number
  deposit: RentalQuoteDeposit
  totalDueNow: number
  totalDueLater: number
  total: number
  status: string | null
}

export type CarHireBooking = {
  id: number
  bookingNumber: string
  carId: number | null
  startAt: string | null
  endAt: string | null
  startDate: string | null
  endDate: string | null
  bookingStatus: string
  status: string
  paymentStatus: string
  currency: string
  quoteId: string | null
  baseCost: number
  distanceCost: number
  surcharges: number
  discounts: number
  insurance: number
  totalCost: number
  total: number
  renterNotes: string | null
  holdExpiresAt: string | null
  cancellationReason: string | null
  cancelledAt: string | null
  createdAt: string | null
  updatedAt: string | null
  nextAction: string | null
  car: CarListing | null
  /** Renter-safe contact fields shown to the owning provider only. */
  renterName: string | null
  renterPhone: string | null
  renterEmail: string | null
}

export type ProviderFleetStats = {
  total: number
  published: number
  draft: number
  pendingReview: number
  suspended: number
  unavailableNow: number
  upcomingRentals: number
  maintenanceBlocked: number
}

export type ProviderBookingStats = {
  pendingDecision: number
  upcoming: number
  active: number
  completedThisMonth: number
}

export type ProviderSummaryAction = {
  code: string
  label: string
  count: number
  href: string | null
}

export type ProviderSummary = {
  asOf: string | null
  currency: string
  fleet: ProviderFleetStats
  bookings: ProviderBookingStats
  actions: ProviderSummaryAction[]
}

export type MaintenanceCategory = 'MAINTENANCE' | 'CLEANING' | 'SAFETY'

export type MaintenanceBlock = {
  id: string
  carId: number | null
  startAt: string | null
  endAt: string | null
  category: string
  reason: string | null
  active: boolean | null
  createdAt: string | null
}

export type CreateMaintenanceBlockInput = {
  startAt: string
  endAt: string
  category: MaintenanceCategory
  reason?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function first(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && str(row[key]) !== '') return row[key]
  }
  return null
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const raw = str(value).toLowerCase()
  if (!raw) return null
  if (['true', '1', 'yes', 'available', 'published', 'active'].includes(raw)) return true
  if (['false', '0', 'no', 'unavailable', 'blocked', 'inactive'].includes(raw)) return false
  return null
}

/**
 * Tolerant number parser. Accepts numbers and decimal/currency strings such as
 * `"45,000.50"` or `"MWK 45,000"`. Returns 0 for empty/invalid input.
 */
export function asNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'bigint') return Number(value)
  if (typeof value !== 'string') return 0
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return 0
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Like `asNumber`, but preserves "not provided" as null. */
export function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '')
    if (!cleaned || cleaned === '-' || cleaned === '.' || !/[0-9]/.test(cleaned)) return null
  }
  const parsed = asNumber(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Tolerant ISO/date parser. Returns null for empty or invalid values. */
export function asDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'number') {
    const fromNumber = new Date(value)
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber
  }
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function asIso(value: unknown): string | null {
  const date = asDate(value)
  return date ? date.toISOString() : null
}

function imagesOf(row: Record<string, unknown>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (value: unknown) => {
    const raw = str(value)
    if (!raw || seen.has(raw)) return
    seen.add(raw)
    out.push(raw)
  }
  const rawImages = row.images ?? row.gallery ?? row.photos
  if (Array.isArray(rawImages)) {
    for (const item of rawImages) {
      if (typeof item === 'string') push(item)
      else {
        const record = asRecord(item)
        if (record) push(record.url ?? record.imageUrl ?? record.src)
      }
    }
  } else if (typeof rawImages === 'string' && rawImages.trim()) {
    for (const item of rawImages.split(/[,;|]/)) push(item)
  }
  push(first(row, ['imageUrl', 'image', 'coverImage', 'photoUrl']))
  return out
}

function parseListingStatus(row: Record<string, unknown>): string {
  // Rows created before listing status existed are public. Never borrow a
  // generic `status` field here — it can mean operational availability.
  const raw = str(first(row, ['listingStatus', 'listing_state', 'listingstatus'])).toUpperCase()
  return raw || 'PUBLISHED'
}

/** Parses one public-safe vehicle row. Private fields are deliberately ignored. */
export function parseCar(value: unknown): CarListing | null {
  const row = asRecord(value)
  if (!row) return null
  const id = asNumber(first(row, ['id', 'carId', 'car_id', 'ID']))
  if (!(id > 0)) return null
  const images = imagesOf(row)
  const year = asOptionalNumber(row.year ?? row.modelYear)
  return {
    id,
    make: str(first(row, ['make', 'brand', 'manufacturer'])) || 'Vehicle',
    model: str(first(row, ['model', 'modelName', 'variant'])) || '',
    year: year && year > 1900 ? Math.round(year) : null,
    color: str(row.color) || null,
    dailyRate: asNumber(first(row, ['dailyRate', 'pricePerDay', 'price', 'rate'])),
    currency: str(row.currency) || 'MWK',
    isAvailable: asBoolean(row.isAvailable ?? row.available),
    imageUrl: images[0] ?? null,
    images,
    description: str(row.description) || null,
    seats: asOptionalNumber(row.seats ?? row.capacity),
    transmission: str(row.transmission) || null,
    fuelType: str(row.fuelType ?? row.fuel_type) || null,
    bodyType: str(row.bodyType ?? row.body_type ?? row.body) || null,
    pickupArea: str(row.pickupArea ?? row.pickup_area ?? row.location) || null,
    latitude: asOptionalNumber(row.latitude ?? row.lat),
    longitude: asOptionalNumber(row.longitude ?? row.lng ?? row.lon),
    rating: asNumber(row.rating),
    reviews: asNumber(row.reviews ?? row.reviewCount),
    listingStatus: parseListingStatus(row),
    availableForDates: asBoolean(row.availableForDates),
    depositAmount: asNumber(row.depositAmount ?? row.deposit),
    minRentalDays: Math.max(1, Math.round(asNumber(row.minRentalDays) || 1)),
    maxRentalDays: asOptionalNumber(row.maxRentalDays),
  }
}

function rowsOf(body: unknown): unknown[] {
  const list = unwrapList(body)
  if (list.length > 0) return list
  const record = asRecord(body)
  if (!record) return []
  const nested =
    asRecord(record.data) ||
    asRecord(record.item) ||
    asRecord(record.car) ||
    asRecord(record.block)
  if (nested) return [nested]
  if (record.id != null || record.make != null || record.model != null) return [record]
  return []
}

export function parseCarListings(body: unknown): CarListing[] {
  const out: CarListing[] = []
  const seen = new Set<number>()
  for (const row of rowsOf(body)) {
    const car = parseCar(row)
    if (!car || seen.has(car.id)) continue
    seen.add(car.id)
    out.push(car)
  }
  return out
}

function parseRenter(row: Record<string, unknown>): {
  name: string | null
  phone: string | null
  email: string | null
} {
  const person =
    asRecord(row.renter) ||
    asRecord(row.customer) ||
    asRecord(row.user) ||
    asRecord(row.guest) ||
    null
  return {
    name:
      str(first(row, ['renterName', 'customerName', 'guestName'])) ||
      (person
        ? str(first(person, ['name', 'displayName', 'fullName'])) || null
        : null),
    phone:
      str(first(row, ['renterPhone', 'customerPhone', 'guestPhone'])) ||
      (person ? str(first(person, ['phone', 'phoneNumber'])) || null : null),
    email:
      str(first(row, ['renterEmail', 'customerEmail', 'guestEmail'])) ||
      (person ? str(first(person, ['email'])) || null : null),
  }
}

export function parseCarHireBooking(value: unknown): CarHireBooking | null {
  const row = asRecord(value)
  if (!row) return null
  const id = asNumber(first(row, ['id', 'bookingId', 'ID']))
  if (!(id > 0)) return null

  const bookingStatus = (
    str(first(row, ['bookingStatus', 'status', 'booking_status'])) || 'PENDING'
  ).toUpperCase()
  const paymentStatus = (
    str(first(row, ['paymentStatus', 'payment_status'])) || 'NOT_STARTED'
  ).toUpperCase()
  const car = parseCar(asRecord(row.car) ?? asRecord(row.vehicle))
  const renter = parseRenter(row)
  const startAt = asIso(first(row, ['startAt', 'startDate']))
  const endAt = asIso(first(row, ['endAt', 'endDate']))

  return {
    id,
    bookingNumber:
      str(first(row, ['bookingNumber', 'bookingRef', 'reference'])) || `VCH-${id}`,
    carId: asOptionalNumber(first(row, ['carId', 'car_id'])) ?? car?.id ?? null,
    startAt,
    endAt,
    startDate: asIso(first(row, ['startDate', 'startAt'])) ?? startAt,
    endDate: asIso(first(row, ['endDate', 'endAt'])) ?? endAt,
    bookingStatus,
    status: (str(row.status) || bookingStatus).toUpperCase(),
    paymentStatus,
    currency: str(row.currency) || 'MWK',
    quoteId: str(row.quoteId) || null,
    baseCost: asNumber(first(row, ['baseCost', 'base_cost'])),
    distanceCost: asNumber(first(row, ['distanceCost', 'distance_cost'])),
    surcharges: asNumber(row.surcharges),
    discounts: asNumber(row.discounts),
    insurance: asNumber(row.insurance),
    totalCost: asNumber(first(row, ['totalCost', 'total'])),
    total: asNumber(first(row, ['total', 'totalCost'])),
    renterNotes: str(first(row, ['renterNotes', 'notes'])) || null,
    holdExpiresAt: asIso(row.holdExpiresAt),
    cancellationReason: str(row.cancellationReason) || null,
    cancelledAt: asIso(row.cancelledAt),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt),
    nextAction: str(row.nextAction) || null,
    car,
    renterName: renter.name,
    renterPhone: renter.phone,
    renterEmail: renter.email,
  }
}

export function parseCarHireBookings(body: unknown): CarHireBooking[] {
  const out: CarHireBooking[] = []
  const seen = new Set<number>()
  for (const row of rowsOf(body)) {
    const booking = parseCarHireBooking(row)
    if (!booking || seen.has(booking.id)) continue
    seen.add(booking.id)
    out.push(booking)
  }
  return out
}

export function parseQuote(body: unknown): RentalQuote | null {
  const record = asRecord(body)
  const row = asRecord(record?.data) ?? record
  if (!row) return null
  const quoteId = str(row.quoteId)
  if (!quoteId) return null

  const lineRows = Array.isArray(row.lineItems) ? row.lineItems : []
  const depositRow = asRecord(row.deposit)
  return {
    quoteId,
    carId: asOptionalNumber(row.carId),
    currency: str(row.currency) || 'MWK',
    startAt: asIso(row.startAt),
    endAt: asIso(row.endAt),
    expiresAt: asIso(row.expiresAt),
    days: Math.max(0, Math.round(asNumber(row.days))),
    dailyRate: asNumber(row.dailyRate),
    lineItems: lineRows
      .map(item => {
        const line = asRecord(item)
        if (!line) return null
        return {
          code: str(line.code),
          label: str(line.label) || str(line.code),
          amount: asNumber(line.amount),
        }
      })
      .filter((line): line is RentalQuoteLineItem => !!line),
    subtotal: asNumber(row.subtotal),
    surcharges: asNumber(row.surcharges),
    discounts: asNumber(row.discounts),
    insurance: asNumber(row.insurance),
    deposit: {
      amount: asNumber(depositRow?.amount),
      collectionMode: str(depositRow?.collectionMode) || null,
    },
    totalDueNow: asNumber(row.totalDueNow),
    totalDueLater: asNumber(row.totalDueLater),
    total: asNumber(first(row, ['total', 'totalCost'])),
    status: str(row.status) || null,
  }
}

export function parseProviderSummary(body: unknown): ProviderSummary | null {
  const record = asRecord(body)
  const row = asRecord(record?.data) ?? record
  if (!row) return null
  const fleet = asRecord(row.fleet)
  const bookings = asRecord(row.bookings)
  if (!fleet && !bookings) return null
  const fleetRow = fleet ?? {}
  const bookingsRow = bookings ?? {}
  const actions = Array.isArray(row.actions) ? row.actions : []
  return {
    asOf: asIso(row.asOf),
    currency: str(row.currency) || 'MWK',
    fleet: {
      total: asNumber(fleetRow.total),
      published: asNumber(fleetRow.published),
      draft: asNumber(fleetRow.draft),
      pendingReview: asNumber(fleetRow.pendingReview),
      suspended: asNumber(fleetRow.suspended),
      unavailableNow: asNumber(fleetRow.unavailableNow),
      upcomingRentals: asNumber(fleetRow.upcomingRentals),
      maintenanceBlocked: asNumber(fleetRow.maintenanceBlocked),
    },
    bookings: {
      pendingDecision: asNumber(bookingsRow.pendingDecision),
      upcoming: asNumber(bookingsRow.upcoming),
      active: asNumber(bookingsRow.active),
      completedThisMonth: asNumber(bookingsRow.completedThisMonth),
    },
    actions: actions
      .map(item => {
        const action = asRecord(item)
        if (!action) return null
        return {
          code: str(action.code),
          label: str(action.label) || str(action.code),
          count: asNumber(action.count),
          href: str(action.href) || null,
        }
      })
      .filter((action): action is ProviderSummaryAction => !!action),
  }
}

export function parseMaintenanceBlocks(body: unknown): MaintenanceBlock[] {
  return rowsOf(body)
    .map(item => {
      const row = asRecord(item)
      if (!row) return null
      // Maintenance block ids are UUID strings from the backend.
      const id = str(first(row, ['id', 'blockId']))
      if (!id) return null
      return {
        id,
        carId: asOptionalNumber(row.carId),
        startAt: asIso(row.startAt),
        endAt: asIso(row.endAt),
        category: (str(row.category) || 'MAINTENANCE').toUpperCase(),
        reason: str(row.reason) || null,
        active:
          asBoolean(row.active ?? row.isActive) ??
          (str(row.status).toUpperCase() === 'ACTIVE' ? true : null),
        createdAt: asIso(row.createdAt),
      }
    })
    .filter((block): block is MaintenanceBlock => !!block)
}

/** Booking-page metadata derived from an already-parsed listing. */
export function carBookingPageMeta(car: CarListing): BookingPage {
  return {
    carId: car.id,
    minRentalDays: car.minRentalDays,
    maxRentalDays: car.maxRentalDays,
    depositAmount: car.depositAmount,
    dailyRate: car.dailyRate,
    currency: car.currency,
    pickupArea: car.pickupArea,
    isAvailable: car.isAvailable !== false && car.availableForDates !== false,
  }
}

export function carHref(id: number | string): string {
  return `/car-hire/${encodeURIComponent(String(id))}`
}

export function carHireAppHref(
  id: number | string,
  startAt?: string | null,
  endAt?: string | null,
): string {
  const params = new URLSearchParams()
  if (startAt) params.set('startAt', startAt)
  if (endAt) params.set('endAt', endAt)
  const query = params.toString()
  return `vero360://car-hire/${encodeURIComponent(String(id))}${query ? `?${query}` : ''}`
}

export function carTitle(car: CarListing): string {
  const name = [car.make, car.model].filter(Boolean).join(' ').trim()
  if (!name) return `Vehicle #${car.id}`
  return car.year ? `${car.year} ${name}` : name
}

export function transmissionLabel(value: string | null | undefined): string {
  const raw = str(value).toUpperCase()
  if (raw === 'AUTOMATIC' || raw === 'AUTO') return 'Automatic'
  if (raw === 'MANUAL') return 'Manual'
  if (!raw) return 'Transmission not listed'
  return raw.charAt(0) + raw.slice(1).toLowerCase()
}

export function fuelTypeLabel(value: string | null | undefined): string {
  const raw = str(value).toUpperCase()
  if (!raw) return ''
  if (raw === 'PETROL') return 'Petrol'
  if (raw === 'DIESEL') return 'Diesel'
  if (raw === 'HYBRID') return 'Hybrid'
  if (raw === 'ELECTRIC') return 'Electric'
  return raw.charAt(0) + raw.slice(1).toLowerCase()
}

export function carSubtitle(car: CarListing): string {
  return [
    car.seats ? `${Math.round(car.seats)} seats` : null,
    car.transmission ? transmissionLabel(car.transmission) : null,
    car.fuelType ? fuelTypeLabel(car.fuelType) : null,
    car.pickupArea,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function prettyStatus(value: string | null | undefined): string {
  const raw = str(value).replace(/[_-]+/g, ' ').trim()
  if (!raw) return '—'
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function carHireStatusTone(status: string | null | undefined): StatusTone {
  const raw = str(status).toUpperCase()
  if (['PUBLISHED', 'ACTIVE', 'CONFIRMED', 'AVAILABLE', 'SUCCEEDED', 'COMPLETED'].includes(raw)) {
    return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
  }
  if (['PENDING', 'PENDING_REVIEW', 'PENDING_DECISION', 'REVIEW'].includes(raw)) {
    return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
  }
  if (['DRAFT', 'RETIRED', 'NOT_STARTED', 'NOT_REQUIRED', 'UNKNOWN'].includes(raw)) {
    return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
  }
  if (
    ['SUSPENDED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED', 'UNAVAILABLE', 'BLOCKED'].includes(
      raw,
    )
  ) {
    return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
  }
  return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
}

export function listingStatusLabel(status: string | null | undefined): string {
  const raw = str(status).toUpperCase()
  if (raw === 'PENDING_REVIEW') return 'Pending review'
  if (raw === 'PUBLISHED') return 'Published'
  if (raw === 'DRAFT') return 'Draft'
  if (raw === 'SUSPENDED') return 'Suspended'
  if (raw === 'RETIRED') return 'Retired'
  return prettyStatus(status)
}

export function paymentTone(status: string | null | undefined): StatusTone {
  const raw = str(status).toUpperCase()
  if (raw === 'SUCCEEDED' || raw === 'PAID') {
    return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
  }
  if (raw === 'PENDING' || raw === 'PROCESSING') {
    return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
  }
  if (raw === 'FAILED') return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
  if (raw === 'REFUNDED') return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
  return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
}

export function bookingStatusTone(status: string | null | undefined): StatusTone {
  const raw = str(status).toUpperCase()
  if (raw === 'PENDING') return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
  if (raw === 'CONFIRMED') return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
  if (raw === 'ACTIVE') return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
  if (raw === 'COMPLETED') return { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' }
  if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(raw)) {
    return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
  }
  if (raw === 'INCIDENT_REPORTED') return { bg: '#FFF1F2', color: '#9F1239', border: '#FECDD3' }
  return carHireStatusTone(raw)
}

export function bookingStatusLabel(status: string | null | undefined): string {
  const raw = str(status).toUpperCase()
  if (raw === 'PENDING') return 'Awaiting decision'
  if (raw === 'CONFIRMED') return 'Confirmed'
  if (raw === 'ACTIVE') return 'Active rental'
  if (raw === 'COMPLETED') return 'Completed'
  if (raw === 'CANCELLED') return 'Cancelled'
  if (raw === 'REJECTED') return 'Rejected'
  if (raw === 'EXPIRED') return 'Expired'
  if (raw === 'INCIDENT_REPORTED') return 'Incident reported'
  return prettyStatus(status)
}

export function paymentStatusLabel(status: string | null | undefined): string {
  const raw = str(status).toUpperCase()
  if (raw === 'NOT_REQUIRED') return 'No payment required'
  if (raw === 'NOT_STARTED') return 'Payment not started'
  if (raw === 'PENDING') return 'Payment pending'
  if (raw === 'SUCCEEDED') return 'Paid'
  if (raw === 'FAILED') return 'Payment failed'
  if (raw === 'REFUNDED') return 'Refunded'
  return prettyStatus(status)
}

export function resolveCarImage(car: CarListing): string | null {
  const raw = car.imageUrl || car.images[0] || null
  return raw ? resolveVeroMediaUrl(raw) : null
}

export function carPriceLabel(car: CarListing): string {
  return `${formatMwk(car.dailyRate)} / day`
}

export function isPublicCar(car: CarListing): boolean {
  return car.listingStatus.toUpperCase() === 'PUBLISHED'
}

export function bookingIsPending(booking: CarHireBooking): boolean {
  return booking.bookingStatus === 'PENDING' && booking.status === 'PENDING'
}

export function bookingRenterLabel(booking: CarHireBooking): string {
  return booking.renterName || booking.renterEmail || 'Renter details in app'
}

export function maintenanceCategoryLabel(category: string | null | undefined): string {
  const raw = str(category).toUpperCase()
  if (raw === 'CLEANING') return 'Cleaning'
  if (raw === 'SAFETY') return 'Safety hold'
  if (raw === 'MAINTENANCE') return 'Maintenance'
  return prettyStatus(category)
}
