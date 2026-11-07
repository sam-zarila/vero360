import { formatDateTime } from '@/lib/vero-api'

export const RIDE_STATUSES = [
  'REQUESTED',
  'ACCEPTED',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const

export type RideStatus = (typeof RIDE_STATUSES)[number]

export type AdminRide = {
  id: number
  status: RideStatus
  paymentStatus: string
  paymentChannel: string | null
  paymentTxRef: string | null
  paidAt: string | null
  preferredVehicleClass: string
  pickupAddress: string | null
  pickupLatitude: number
  pickupLongitude: number
  dropoffAddress: string | null
  dropoffLatitude: number
  dropoffLongitude: number
  estimatedDistance: number
  actualDistance: number | null
  estimatedFare: number
  actualFare: number | null
  platformFee: number | null
  driverEarnings: number | null
  cancellationFee: number | null
  passengerRating: number | null
  fareBasis: string | null
  surgeMultiplier: number | null
  passengerId: number
  passengerName: string | null
  passengerPhone: string | null
  passengerEmail: string | null
  driverId: number | null
  driverName: string | null
  driverPhone: string | null
  taxiId: number | null
  taxiPlate: string | null
  taxiMake: string | null
  taxiModel: string | null
  /** Last known taxi GPS from driver location updates (may be null). */
  taxiLatitude: number | null
  taxiLongitude: number | null
  taxiLocationUpdatedAt: string | null
  cancellationReason: string | null
  passengerNotes: string | null
  startTime: string | null
  endTime: string | null
  createdAt: string | null
  updatedAt: string | null
  openSosCount: number
  lastSosAt: string | null
  needsAttention: boolean
  attentionReasons: string[]
}

export type AdminSosIncident = {
  id: number
  rideId: number
  userId: number
  message: string | null
  latitude: number | null
  longitude: number | null
  createdAt: string | null
}

export type AdminRideCounts = {
  all: number
  active: number
  requested: number
  inProgress: number
  completed: number
  cancelled: number
  unpaidCompleted: number
  issues: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function nullableStr(value: unknown): string | null {
  const s = str(value)
  return s ? s : null
}

function toId(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

function toNum(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const n = Number(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

function parseRideStatus(raw: unknown): RideStatus {
  const value = str(raw).toUpperCase()
  return (RIDE_STATUSES as readonly string[]).includes(value)
    ? (value as RideStatus)
    : 'REQUESTED'
}

function parseDate(value: unknown): string | null {
  if (value == null) return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function parseAdminRide(raw: unknown): AdminRide | null {
  const item = asRecord(raw)
  if (!item) return null

  return {
    id: toId(item.id),
    status: parseRideStatus(item.status),
    paymentStatus: str(item.paymentStatus) || 'pending',
    paymentChannel: nullableStr(item.paymentChannel),
    paymentTxRef: nullableStr(item.paymentTxRef),
    paidAt: parseDate(item.paidAt),
    preferredVehicleClass: str(item.preferredVehicleClass) || 'STANDARD',
    pickupAddress: nullableStr(item.pickupAddress),
    pickupLatitude: toNum(item.pickupLatitude),
    pickupLongitude: toNum(item.pickupLongitude),
    dropoffAddress: nullableStr(item.dropoffAddress),
    dropoffLatitude: toNum(item.dropoffLatitude),
    dropoffLongitude: toNum(item.dropoffLongitude),
    estimatedDistance: toNum(item.estimatedDistance),
    actualDistance: item.actualDistance == null ? null : toNum(item.actualDistance),
    estimatedFare: toNum(item.estimatedFare),
    actualFare: item.actualFare == null ? null : toNum(item.actualFare),
    platformFee: item.platformFee == null ? null : toNum(item.platformFee),
    driverEarnings: item.driverEarnings == null ? null : toNum(item.driverEarnings),
    cancellationFee: item.cancellationFee == null ? null : toNum(item.cancellationFee),
    passengerRating: item.passengerRating == null ? null : toNum(item.passengerRating),
    fareBasis: nullableStr(item.fareBasis),
    surgeMultiplier: item.surgeMultiplier == null ? null : toNum(item.surgeMultiplier),
    passengerId: toId(item.passengerId),
    passengerName: nullableStr(item.passengerName),
    passengerPhone: nullableStr(item.passengerPhone),
    passengerEmail: nullableStr(item.passengerEmail),
    driverId: item.driverId == null ? null : toId(item.driverId),
    driverName: nullableStr(item.driverName),
    driverPhone: nullableStr(item.driverPhone),
    taxiId: item.taxiId == null ? null : toId(item.taxiId),
    taxiPlate: nullableStr(item.taxiPlate),
    taxiMake: nullableStr(item.taxiMake),
    taxiModel: nullableStr(item.taxiModel),
    taxiLatitude: item.taxiLatitude == null ? null : toNum(item.taxiLatitude),
    taxiLongitude: item.taxiLongitude == null ? null : toNum(item.taxiLongitude),
    taxiLocationUpdatedAt: parseDate(item.taxiLocationUpdatedAt),
    cancellationReason: nullableStr(item.cancellationReason),
    passengerNotes: nullableStr(item.passengerNotes),
    startTime: parseDate(item.startTime),
    endTime: parseDate(item.endTime),
    createdAt: parseDate(item.createdAt),
    updatedAt: parseDate(item.updatedAt),
    openSosCount: toId(item.openSosCount),
    lastSosAt: parseDate(item.lastSosAt),
    needsAttention: item.needsAttention === true,
    attentionReasons: parseStringArray(item.attentionReasons),
  }
}

export function parseAdminSosIncident(raw: unknown): AdminSosIncident | null {
  const item = asRecord(raw)
  if (!item) return null
  const id = toId(item.id)
  const rideId = toId(item.rideId)
  if (!id || !rideId) return null
  return {
    id,
    rideId,
    userId: toId(item.userId),
    message: nullableStr(item.message),
    latitude: item.latitude == null ? null : toNum(item.latitude),
    longitude: item.longitude == null ? null : toNum(item.longitude),
    createdAt: parseDate(item.createdAt),
  }
}

export function parseAdminSosIncidentsResponse(body: unknown): {
  incidents: AdminSosIncident[]
  total: number
} {
  const root = asRecord(body) ?? {}
  const raw = Array.isArray(root.incidents)
    ? root.incidents
    : Array.isArray(root.items)
      ? root.items
      : []
  const incidents = raw
    .map(parseAdminSosIncident)
    .filter((item): item is AdminSosIncident => item != null)
  return {
    incidents,
    total: toId(root.total) || incidents.length,
  }
}

export function parseAdminRidesResponse(body: unknown): {
  rides: AdminRide[]
  total: number
  counts: AdminRideCounts
} {
  const root = asRecord(body) ?? {}
  const ridesRaw = Array.isArray(root.rides) ? root.rides : []
  const countsRaw = asRecord(root.counts) ?? {}

  const rides = ridesRaw
    .map(parseAdminRide)
    .filter((ride): ride is AdminRide => ride != null)

  const counts: AdminRideCounts = {
    all: toId(countsRaw.all) || rides.length,
    active: toId(countsRaw.active),
    requested: toId(countsRaw.requested),
    inProgress: toId(countsRaw.inProgress),
    completed: toId(countsRaw.completed),
    cancelled: toId(countsRaw.cancelled),
    unpaidCompleted: toId(countsRaw.unpaidCompleted),
    issues: toId(countsRaw.issues),
  }

  return {
    rides,
    total: toId(root.total) || rides.length,
    counts,
  }
}

export function rideStatusLabel(status: RideStatus): string {
  switch (status) {
    case 'REQUESTED':
      return 'Requested'
    case 'ACCEPTED':
      return 'Accepted'
    case 'DRIVER_ARRIVED':
      return 'Driver arrived'
    case 'IN_PROGRESS':
      return 'In progress'
    case 'COMPLETED':
      return 'Completed'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return status
  }
}

export function rideStatusTone(status: RideStatus): {
  bg: string
  color: string
  border: string
} {
  switch (status) {
    case 'REQUESTED':
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
    case 'ACCEPTED':
    case 'DRIVER_ARRIVED':
      return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
    case 'IN_PROGRESS':
      return { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' }
    case 'COMPLETED':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    case 'CANCELLED':
      return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
    default:
      return { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
  }
}

export function paymentStatusTone(paymentStatus: string): {
  bg: string
  color: string
  border: string
} {
  const normalized = paymentStatus.toLowerCase()
  if (normalized === 'paid') {
    return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
  }
  return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
}

export function formatRideFareMwk(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  return `MWK ${Math.round(amount).toLocaleString('en-MW')}`
}

export function formatRideDistanceKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—'
  return `${km.toFixed(1)} km`
}

export function rideRouteSummary(ride: AdminRide): string {
  const pickup = ride.pickupAddress || 'Pickup'
  const dropoff = ride.dropoffAddress || 'Drop-off'
  return `${pickup} → ${dropoff}`
}

export function ridePartySummary(ride: AdminRide): string {
  const passenger = ride.passengerName || ride.passengerPhone || `Passenger #${ride.passengerId}`
  if (ride.driverName || ride.driverPhone) {
    return `${passenger} · ${ride.driverName || ride.driverPhone}`
  }
  return passenger
}

export { formatDateTime }

export function adminCanCancelRide(ride: AdminRide): boolean {
  return ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED'
}

export function adminCanAssignRide(ride: AdminRide): boolean {
  return (
    ride.status === 'REQUESTED' ||
    ride.status === 'ACCEPTED' ||
    ride.status === 'DRIVER_ARRIVED'
  )
}

export function adminCanMarkPaid(ride: AdminRide): boolean {
  return ride.status === 'COMPLETED' && ride.paymentStatus.toLowerCase() !== 'paid'
}

export function formatTaxiCoords(ride: AdminRide): string {
  if (ride.taxiLatitude == null || ride.taxiLongitude == null) return '—'
  return `${ride.taxiLatitude.toFixed(5)}, ${ride.taxiLongitude.toFixed(5)}`
}
