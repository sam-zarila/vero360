/**
 * Car-hire contract types + tolerant parsers.
 *
 * This module is client-safe. It intentionally models only public-safe vehicle
 * fields: registration plate, owner/operator identifiers and tracker data are
 * never read or returned here.
 */

import { formatMwk, resolveVeroMediaUrl, unwrapList } from '@/lib/vero-api'

/** Re-exported so provider views can resolve relative media paths from the car-hire module. */
export { resolveVeroMediaUrl }

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
  operatorId: string | null
  operator: PublicOperator | null
  listingId: string | null
  /** Identical units in service, when the backend reports them. */
  unitCount: number | null
  /** Units free for the searched dates (or in service when undated). */
  availableUnits: number | null
}

/** The company or individual host a listing is provided by. */
export type PublicOperator = {
  id: string
  name: string
  type: string
  logoUrl: string | null
}

export function parsePublicOperator(value: unknown): PublicOperator | null {
  const row = asRecord(value)
  if (!row) return null
  const id = str(row.id)
  const name = str(first(row, ['name', 'displayName']))
  if (!id || !name) return null
  return {
    id,
    name,
    type: (str(row.type) || '').toUpperCase(),
    logoUrl: str(row.logoUrl) || null,
  }
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
  listingId: string | null
  /** The physical unit (registration) currently assigned to the booking. */
  assignedUnit: {
    carId: number
    licensePlate: string | null
    color: string | null
    unitLabel: string | null
  } | null
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
    operatorId: str(row.operatorId) || null,
    operator: parsePublicOperator(row.operator),
    listingId: str(row.listingId) || null,
    unitCount: asOptionalNumber(row.unitCount),
    availableUnits: asOptionalNumber(row.availableUnits),
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

/** Fields a provider may set on a vehicle they own. */
export type VehicleInput = {
  make: string
  model: string
  year: number
  licensePlate: string
  color: string
  dailyRate: number
  seats?: number | null
  transmission?: string
  fuelType?: string
  bodyType?: string
  pickupArea?: string
  description?: string
  imageUrl?: string
  images?: string[]
  depositAmount?: number
  minRentalDays?: number
  maxRentalDays?: number | null
  isAvailable?: boolean
}

/**
 * Owner fleet row. Adds the private fields the owner endpoint returns but the
 * public listing parsers deliberately drop (registration plate, operator link).
 */
export type OwnerVehicle = CarListing & {
  licensePlate: string | null
  listingGroupId: string | null
  unitLabel: string | null
}

/** One listing in the provider fleet: identical units share a listing group. */
export type FleetListing = {
  key: string
  primary: OwnerVehicle
  units: OwnerVehicle[]
}

export function groupFleetListings(cars: OwnerVehicle[]): FleetListing[] {
  const byKey = new Map<string, FleetListing>()
  for (const car of cars) {
    const key = car.listingGroupId ?? `car:${car.id}`
    const existing = byKey.get(key)
    if (existing) {
      existing.units.push(car)
    } else {
      byKey.set(key, { key, primary: car, units: [car] })
    }
  }
  return Array.from(byKey.values())
}

function parseAssignedUnit(value: unknown): CarHireBooking['assignedUnit'] {
  const row = asRecord(value)
  if (!row) return null
  const carId = asNumber(row.carId)
  if (!(carId > 0)) return null
  return {
    carId,
    licensePlate: str(row.licensePlate) || null,
    color: str(row.color) || null,
    unitLabel: str(row.unitLabel) || null,
  }
}

export type BookingUnitOption = {
  carId: number
  licensePlate: string | null
  color: string | null
  unitLabel: string | null
  inService: boolean
  freeForBooking: boolean
  current: boolean
}

export function parseBookingUnitOptions(body: unknown): BookingUnitOption[] {
  const out: BookingUnitOption[] = []
  for (const row of unwrapList(asRecord(body)?.data ?? body)) {
    const record = asRecord(row)
    if (!record) continue
    const carId = asNumber(record.carId)
    if (!(carId > 0)) continue
    out.push({
      carId,
      licensePlate: str(record.licensePlate) || null,
      color: str(record.color) || null,
      unitLabel: str(record.unitLabel) || null,
      inService: record.inService !== false,
      freeForBooking: record.freeForBooking === true,
      current: record.current === true,
    })
  }
  return out
}

export function parseOwnerVehicles(body: unknown): OwnerVehicle[] {
  const byId = new Map<number, Record<string, unknown>>()
  for (const row of rowsOf(body)) {
    const record = asRecord(row)
    if (!record) continue
    const id = asNumber(first(record, ['id', 'carId', 'car_id']))
    if (id > 0) byId.set(id, record)
  }

  return parseCarListings(body).map(car => {
    const record = byId.get(car.id)
    return {
      ...car,
      licensePlate: record
        ? str(first(record, ['licensePlate', 'license_plate'])) || null
        : null,
      listingGroupId: record ? str(record.listingGroupId) || null : null,
      unitLabel: record ? str(record.unitLabel) || null : null,
    }
  })
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
    listingId: str(row.listingId) || null,
    assignedUnit: parseAssignedUnit(row.assignedUnit),
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

/* ------------------------------------------------------------------------- */
/* Handover inspections                                                      */
/* ------------------------------------------------------------------------- */

export type InspectionType = 'PICKUP' | 'RETURN'

export type ConditionGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED'

export type InspectionAcknowledgement = {
  id: string
  /** `RENTER` or `OWNER`; kept as a tolerant string for forward compatibility. */
  party: string
  decision: string
  note: string | null
  createdAt: string | null
}

export type HandoverInspection = {
  id: string
  bookingId: string
  type: string
  actorRole: string
  odometer: number | null
  fuelLevel: number | null
  condition: string | null
  checklist: Record<string, string>
  notes: string | null
  media: string[]
  status: string
  acknowledgedAt: string | null
  declinedAt: string | null
  disputeReason: string | null
  createdAt: string | null
  acknowledgements: InspectionAcknowledgement[]
}

export type InspectionList = {
  inspections: HandoverInspection[]
  pickup: HandoverInspection[]
  returns: HandoverInspection[]
  latestPickup: HandoverInspection | null
  latestReturn: HandoverInspection | null
}

export type SubmitInspectionInput = {
  odometer?: number
  fuelLevel?: number
  condition?: ConditionGrade
  checklist?: Record<string, string>
  notes?: string
  media?: string[]
}

export type AcknowledgeInspectionInput = {
  decision: 'ACCEPTED' | 'DECLINED'
  note?: string
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === 'string') return item.trim()
        const record = asRecord(item)
        if (!record) return ''
        return str(first(record, ['url', 'src', 'imageUrl', 'href', 'name', 'label']))
      })
      .filter(Boolean)
  }
  const raw = str(value)
  if (!raw) return []
  return raw
    .split(/[,;|]/)
    .map(part => part.trim())
    .filter(Boolean)
}

/** Tolerant map parser: accepts `{ exterior: "OK" }` and `[{ key, value }]`. */
function checklistOf(value: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  const record = asRecord(value)
  if (record) {
    for (const [key, item] of Object.entries(record)) {
      const text = str(item)
      if (text) out[key] = text
    }
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const row = asRecord(item)
      if (!row) continue
      const key = str(first(row, ['key', 'label', 'name', 'item']))
      const text = str(first(row, ['value', 'status', 'result', 'state'])) || 'OK'
      if (key) out[key] = text
    }
  }
  return out
}

function acknowledgementOf(value: unknown): InspectionAcknowledgement | null {
  const row = asRecord(value)
  if (!row) return null
  const party = (str(first(row, ['party', 'actorRole', 'actor_role'])) || '').toUpperCase()
  const id = str(first(row, ['id', 'acknowledgementId']))
  if (!id && !party) return null
  return {
    id,
    party,
    decision: (str(row.decision) || 'PENDING').toUpperCase(),
    note: str(first(row, ['note', 'message', 'comment'])) || null,
    createdAt: asIso(first(row, ['createdAt', 'created_at'])),
  }
}

export function parseInspection(value: unknown): HandoverInspection | null {
  const row = asRecord(value)
  if (!row) return null
  const id = str(first(row, ['id', 'inspectionId']))
  if (!id) return null
  const rawAcks = Array.isArray(row.acknowledgements) ? row.acknowledgements : []
  return {
    id,
    bookingId: str(first(row, ['bookingId', 'booking_id'])),
    type: (str(row.type) || '').toUpperCase(),
    actorRole: (str(first(row, ['actorRole', 'actor_role', 'role'])) || '').toUpperCase(),
    odometer: asOptionalNumber(row.odometer),
    fuelLevel: asOptionalNumber(first(row, ['fuelLevel', 'fuel_level'])),
    condition: (str(row.condition) || '').toUpperCase() || null,
    checklist: checklistOf(row.checklist),
    notes: str(row.notes) || null,
    media: stringList(row.media),
    status: (str(first(row, ['status', 'inspectionStatus'])) || 'PENDING').toUpperCase(),
    acknowledgedAt: asIso(first(row, ['acknowledgedAt', 'acknowledged_at'])),
    declinedAt: asIso(first(row, ['declinedAt', 'declined_at'])),
    disputeReason: str(first(row, ['disputeReason', 'dispute_reason'])) || null,
    createdAt: asIso(first(row, ['createdAt', 'created_at'])),
    acknowledgements: rawAcks
      .map(acknowledgementOf)
      .filter((ack): ack is InspectionAcknowledgement => !!ack),
  }
}

export function parseInspections(body: unknown): HandoverInspection[] {
  const out: HandoverInspection[] = []
  const seen = new Set<string>()
  for (const row of rowsOf(body)) {
    const inspection = parseInspection(row)
    if (!inspection || seen.has(inspection.id)) continue
    seen.add(inspection.id)
    out.push(inspection)
  }
  return out
}

function mostRecent(rows: HandoverInspection[]): HandoverInspection | null {
  let best: HandoverInspection | null = null
  for (const row of rows) {
    if (!best) {
      best = row
      continue
    }
    const at = row.createdAt ? Date.parse(row.createdAt) : Number.NaN
    const bestAt = best.createdAt ? Date.parse(best.createdAt) : Number.NaN
    if (Number.isFinite(at) && (!Number.isFinite(bestAt) || at > bestAt)) best = row
  }
  return best
}

export function parseInspectionList(body: unknown): InspectionList {
  const inspections = parseInspections(body)
  const pickup = inspections.filter(item => item.type === 'PICKUP')
  const returns = inspections.filter(item => item.type === 'RETURN')
  return {
    inspections,
    pickup,
    returns,
    latestPickup: mostRecent(pickup),
    latestReturn: mostRecent(returns),
  }
}

/* ------------------------------------------------------------------------- */
/* Incidents                                                                 */
/* ------------------------------------------------------------------------- */

export type IncidentType =
  | 'ACCIDENT'
  | 'BREAKDOWN'
  | 'THEFT'
  | 'UNSAFE_VEHICLE'
  | 'NO_SHOW'
  | 'FAILED_PICKUP'
  | 'OWNER_UNAVAILABLE'
  | 'OTHER'

export type IncidentRemedy =
  | 'NONE'
  | 'REPLACEMENT'
  | 'REFUND'
  | 'PARTIAL_REFUND'
  | 'EXTENSION'
  | 'ESCALATION'

export type IncidentReport = {
  id: string
  bookingId: string
  type: string
  status: string
  description: string
  occurredAt: string | null
  contactPhone: string | null
  remedy: string | null
  resolution: string | null
  evidence: string[]
  createdAt: string | null
}

export type ReportIncidentInput = {
  type: IncidentType
  description: string
  occurredAt?: string
  contactPhone?: string
}

export type ResolveIncidentInput = {
  resolution: string
  remedy?: IncidentRemedy
}

export function parseIncident(value: unknown): IncidentReport | null {
  const row = asRecord(value)
  if (!row) return null
  const id = str(first(row, ['id', 'incidentId']))
  if (!id) return null
  return {
    id,
    bookingId: str(first(row, ['bookingId', 'booking_id'])),
    type: (str(row.type) || 'OTHER').toUpperCase(),
    status: (str(first(row, ['status', 'incidentStatus'])) || 'OPEN').toUpperCase(),
    description: str(first(row, ['description', 'details', 'message'])),
    occurredAt: asIso(first(row, ['occurredAt', 'occurred_at'])),
    contactPhone: str(first(row, ['contactPhone', 'contact_phone', 'phone'])) || null,
    remedy: (str(row.remedy) || '').toUpperCase() || null,
    resolution: str(first(row, ['resolution', 'resolutionNotes', 'outcome'])) || null,
    evidence: stringList(row.evidence),
    createdAt: asIso(first(row, ['createdAt', 'created_at'])),
  }
}

export function parseIncidents(body: unknown): IncidentReport[] {
  const out: IncidentReport[] = []
  const seen = new Set<string>()
  for (const row of rowsOf(body)) {
    const incident = parseIncident(row)
    if (!incident || seen.has(incident.id)) continue
    seen.add(incident.id)
    out.push(incident)
  }
  return out
}

/* ------------------------------------------------------------------------- */
/* Support cases                                                             */
/* ------------------------------------------------------------------------- */

export type SupportCaseCategory =
  | 'BOOKING'
  | 'PAYMENT'
  | 'DAMAGE'
  | 'HANDOVER'
  | 'SAFETY'
  | 'OTHER'

export type SupportCase = {
  id: string
  bookingId: string
  category: string
  subject: string
  message: string
  status: string
  resolution: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type OpenSupportCaseInput = {
  category: SupportCaseCategory
  subject: string
  message: string
}

export function parseSupportCase(value: unknown): SupportCase | null {
  const row = asRecord(value)
  if (!row) return null
  const id = str(first(row, ['id', 'caseId']))
  if (!id) return null
  return {
    id,
    bookingId: str(first(row, ['bookingId', 'booking_id'])),
    category: (str(row.category) || 'OTHER').toUpperCase(),
    subject: str(row.subject) || 'Support case',
    message: str(first(row, ['message', 'description', 'body'])),
    status: (str(row.status) || 'OPEN').toUpperCase(),
    resolution: str(first(row, ['resolution', 'resolutionNotes'])) || null,
    createdAt: asIso(first(row, ['createdAt', 'created_at'])),
    updatedAt: asIso(first(row, ['updatedAt', 'updated_at'])),
  }
}

export function parseSupportCases(body: unknown): SupportCase[] {
  const out: SupportCase[] = []
  const seen = new Set<string>()
  for (const row of rowsOf(body)) {
    const supportCase = parseSupportCase(row)
    if (!supportCase || seen.has(supportCase.id)) continue
    seen.add(supportCase.id)
    out.push(supportCase)
  }
  return out
}

/* ------------------------------------------------------------------------- */
/* Booking extensions                                                        */
/* ------------------------------------------------------------------------- */

export type BookingExtension = {
  id: string
  bookingId: string
  requestedEndAt: string | null
  previousEndAt: string | null
  status: string
  /** Null when the API omits the amount — never coerce to 0. */
  additionalAmount: number | null
  currency: string
  decisionReason: string | null
  createdAt: string | null
}

export function parseBookingExtension(value: unknown): BookingExtension | null {
  const row = asRecord(value)
  if (!row) return null
  const id = str(first(row, ['id', 'extensionId']))
  if (!id) return null
  return {
    id,
    bookingId: str(first(row, ['bookingId', 'booking_id'])),
    requestedEndAt: asIso(first(row, ['requestedEndAt', 'requested_end_at', 'newEndAt'])),
    previousEndAt: asIso(first(row, ['previousEndAt', 'previous_end_at', 'oldEndAt'])),
    status: (str(row.status) || 'PENDING').toUpperCase(),
    additionalAmount: asOptionalNumber(
      first(row, ['additionalAmount', 'additional_amount', 'amount']),
    ),
    currency: str(row.currency) || 'MWK',
    decisionReason: str(first(row, ['decisionReason', 'decision_reason', 'reason'])) || null,
    createdAt: asIso(first(row, ['createdAt', 'created_at'])),
  }
}

export function parseBookingExtensions(body: unknown): BookingExtension[] {
  const out: BookingExtension[] = []
  const seen = new Set<string>()
  for (const row of rowsOf(body)) {
    const extension = parseBookingExtension(row)
    if (!extension || seen.has(extension.id)) continue
    seen.add(extension.id)
    out.push(extension)
  }
  return out
}

/* ------------------------------------------------------------------------- */
/* Operators / team                                                          */
/* ------------------------------------------------------------------------- */

export type OperatorMembership = {
  role: string
  permissions: string[]
  status: string
}

export type OperatorSummary = {
  id: string
  type: string
  displayName: string
  status: string
  contactPhone: string | null
  serviceAreas: string[]
  logoUrl: string | null
  defaultDepositAmount: number | null
  defaultMinRentalDays: number | null
  defaultMaxRentalDays: number | null
  reviewerNote: string | null
  membership: OperatorMembership | null
}

export type OperatorProfileInput = {
  displayName?: string
  contactPhone?: string
  serviceAreas?: string[]
  logoUrl?: string | null
  defaultDepositAmount?: number | null
  defaultMinRentalDays?: number | null
  defaultMaxRentalDays?: number | null
}

export type OperatorInvitation = {
  id: string
  email: string
  token: string | null
  status: string
  expiresAt: string | null
  permissions: string[]
}

export function parseOperator(value: unknown): OperatorSummary | null {
  const row = asRecord(value)
  if (!row) return null
  const id = str(first(row, ['id', 'operatorId']))
  if (!id) return null
  const membershipRow = asRecord(row.membership)
  const membership: OperatorMembership | null = membershipRow
    ? {
        role: (str(first(membershipRow, ['role', 'membershipRole'])) || '').toUpperCase(),
        permissions: stringList(membershipRow.permissions ?? row.permissions),
        status: (str(first(membershipRow, ['status', 'membershipStatus'])) || '').toUpperCase(),
      }
    : null
  return {
    id,
    type: (str(row.type) || '').toUpperCase(),
    displayName: str(first(row, ['displayName', 'name', 'businessName'])) || `Operator ${id}`,
    status: (str(row.status) || '').toUpperCase(),
    contactPhone: str(row.contactPhone) || null,
    serviceAreas: stringList(row.serviceAreas),
    logoUrl: str(row.logoUrl) || null,
    defaultDepositAmount: asOptionalNumber(row.defaultDepositAmount),
    defaultMinRentalDays: asOptionalNumber(row.defaultMinRentalDays),
    defaultMaxRentalDays: asOptionalNumber(row.defaultMaxRentalDays),
    reviewerNote: str(row.reviewerNote) || null,
    membership,
  }
}

export function parseOperators(body: unknown): OperatorSummary[] {
  const out: OperatorSummary[] = []
  const seen = new Set<string>()
  for (const row of rowsOf(body)) {
    const operator = parseOperator(row)
    if (!operator || seen.has(operator.id)) continue
    seen.add(operator.id)
    out.push(operator)
  }
  return out
}

export function parseOperatorInvitation(body: unknown): OperatorInvitation | null {
  const record = asRecord(body)
  const row = asRecord(record?.data) ?? record
  if (!row) return null
  const id = str(first(row, ['id', 'invitationId']))
  const email = str(row.email)
  if (!id && !email) return null
  return {
    id,
    email,
    token: str(row.token) || null,
    status: (str(row.status) || 'PENDING').toUpperCase(),
    expiresAt: asIso(first(row, ['expiresAt', 'expires_at'])),
    permissions: stringList(row.permissions),
  }
}

/* ------------------------------------------------------------------------- */
/* Performance analytics                                                     */
/* ------------------------------------------------------------------------- */

export type AnalyticsStatusCount = {
  status: string
  count: number
}

export type ProviderAnalytics = {
  /** Null when the API omits the figure — the UI renders an em dash, never 0. */
  revenue: number | null
  bookings: number | null
  completed: number | null
  cancelled: number | null
  completionRate: number | null
  currency: string
  byStatus: AnalyticsStatusCount[]
  asOf: string | null
  from: string | null
  to: string | null
}

function optionalCount(value: unknown): number | null {
  const record = asRecord(value)
  if (record) return asOptionalNumber(first(record, ['total', 'count', 'value', 'bookings']))
  return asOptionalNumber(value)
}

function analyticsByStatus(value: unknown): AnalyticsStatusCount[] {
  const out: AnalyticsStatusCount[] = []
  if (Array.isArray(value)) {
    for (const item of value) {
      const row = asRecord(item)
      if (!row) continue
      const status = str(first(row, ['status', 'code', 'key', 'name'])).toUpperCase()
      if (!status) continue
      out.push({ status, count: asNumber(first(row, ['count', 'total', 'value', 'bookings'])) })
    }
    return out
  }
  const record = asRecord(value)
  if (record) {
    for (const [key, item] of Object.entries(record)) {
      const status = key.trim().toUpperCase()
      if (!status) continue
      const nested = asRecord(item)
      out.push({
        status,
        count: nested
          ? asNumber(first(nested, ['count', 'total', 'value']))
          : asNumber(item),
      })
    }
  }
  return out
}

export function parseProviderAnalytics(body: unknown): ProviderAnalytics | null {
  const record = asRecord(body)
  const row = asRecord(record?.data) ?? record
  if (!row) return null
  const revenueRow = asRecord(row.revenue)
  const rawRate = asOptionalNumber(first(row, ['completionRate', 'completion_rate']))
  return {
    revenue: revenueRow
      ? asOptionalNumber(first(revenueRow, ['amount', 'total', 'value', 'gross', 'net']))
      : asOptionalNumber(row.revenue),
    bookings: optionalCount(row.bookings),
    completed: optionalCount(
      first(row, ['completed', 'completedBookings', 'completed_bookings']),
    ),
    cancelled: optionalCount(
      first(row, ['cancelled', 'canceled', 'cancelledBookings', 'cancelled_bookings']),
    ),
    // The backend may send a 0–1 ratio or a 0–100 percentage; normalise to a percentage.
    completionRate:
      rawRate == null ? null : rawRate > 0 && rawRate <= 1 ? rawRate * 100 : rawRate,
    currency: str(row.currency) || (revenueRow ? str(revenueRow.currency) : '') || 'MWK',
    byStatus: analyticsByStatus(row.byStatus ?? row.by_status),
    asOf: asIso(first(row, ['asOf', 'as_of'])),
    from: asIso(row.from),
    to: asIso(row.to),
  }
}

/** Completion rate as a percentage, derived only from figures the API returned. */
export function analyticsCompletionRate(analytics: ProviderAnalytics): number | null {
  if (analytics.completionRate != null) return analytics.completionRate
  if (analytics.bookings == null || analytics.completed == null || analytics.bookings <= 0) {
    return null
  }
  return (analytics.completed / analytics.bookings) * 100
}

/** Wraps a single-booking response that may be raw or nested under `data`. */
export function parseCarHireBookingResponse(body: unknown): CarHireBooking | null {
  const direct = parseCarHireBooking(body)
  if (direct) return direct
  for (const row of rowsOf(body)) {
    const booking = parseCarHireBooking(row)
    if (booking) return booking
  }
  return null
}

/* ------------------------------------------------------------------------- */
/* Labels                                                                    */
/* ------------------------------------------------------------------------- */

export function inspectionTypeLabel(type: string | null | undefined): string {
  const raw = str(type).toUpperCase()
  if (raw === 'PICKUP') return 'Pickup inspection'
  if (raw === 'RETURN') return 'Return inspection'
  return prettyStatus(type)
}

export function inspectionStatusLabel(status: string | null | undefined): string {
  const raw = str(status).toUpperCase()
  if (!raw) return 'Status not recorded'
  if (['PENDING', 'PENDING_ACKNOWLEDGEMENT', 'AWAITING_ACKNOWLEDGEMENT'].includes(raw)) {
    return 'Awaiting acknowledgement'
  }
  if (['ACKNOWLEDGED', 'ACCEPTED', 'CONFIRMED'].includes(raw)) return 'Acknowledged'
  if (['DECLINED', 'DISPUTED'].includes(raw)) return 'Declined'
  if (['CLOSED', 'COMPLETED'].includes(raw)) return 'Closed'
  return prettyStatus(status)
}

export function incidentTypeLabel(type: string | null | undefined): string {
  const raw = str(type).toUpperCase()
  if (raw === 'ACCIDENT') return 'Accident'
  if (raw === 'BREAKDOWN') return 'Breakdown'
  if (raw === 'THEFT') return 'Theft'
  if (raw === 'UNSAFE_VEHICLE') return 'Unsafe vehicle'
  if (raw === 'NO_SHOW') return 'Renter no-show'
  if (raw === 'FAILED_PICKUP') return 'Failed pickup'
  if (raw === 'OWNER_UNAVAILABLE') return 'Owner unavailable'
  if (raw === 'OTHER') return 'Other'
  return prettyStatus(type)
}

export function incidentStatusLabel(status: string | null | undefined): string {
  const raw = str(status).toUpperCase()
  if (raw === 'OPEN' || raw === 'REPORTED') return 'Open'
  if (raw === 'ACKNOWLEDGED') return 'Acknowledged'
  if (raw === 'INVESTIGATING') return 'Investigating'
  if (raw === 'ESCALATED') return 'Escalated'
  if (raw === 'RESOLVED') return 'Resolved'
  if (raw === 'CLOSED') return 'Closed'
  if (raw === 'CANCELLED') return 'Cancelled'
  return prettyStatus(status)
}

export function extensionStatusLabel(status: string | null | undefined): string {
  const raw = str(status).toUpperCase()
  if (['PENDING', 'REQUESTED'].includes(raw)) return 'Awaiting decision'
  if (raw === 'APPROVED') return 'Approved'
  if (raw === 'DECLINED') return 'Declined'
  if (raw === 'CANCELLED') return 'Cancelled'
  if (raw === 'EXPIRED') return 'Expired'
  return prettyStatus(status)
}
