import {
  carHireStatusTone,
  listingStatusLabel,
  type StatusTone,
} from '@/lib/car-hire'

/**
 * Shared contract for the car-hire verification (ops) console.
 *
 * The backend moderation service is the only writer of `listingStatus`.
 * Everything here is read-only parsing plus the action rules the UI needs,
 * so the queue page, the detail page, and the proxy routes cannot drift.
 */

export const CAR_HIRE_LISTING_STATUSES = [
  'PENDING_REVIEW',
  'DRAFT',
  'PUBLISHED',
  'SUSPENDED',
  'RETIRED',
] as const

export type CarHireListingStatus = (typeof CAR_HIRE_LISTING_STATUSES)[number]

export type CarHireModerationAction = 'approve' | 'reject' | 'suspend' | 'restore'

export const CAR_HIRE_MODERATION_ACTIONS: CarHireModerationAction[] = [
  'approve',
  'reject',
  'suspend',
  'restore',
]

export type OpsListingCounts = Record<CarHireListingStatus, number>

export type OpsListing = {
  id: number
  make: string
  model: string
  year: number | null
  color: string
  licensePlate: string
  dailyRate: number
  currency: string
  seats: number | null
  transmission: string | null
  fuelType: string | null
  bodyType: string | null
  pickupArea: string | null
  depositAmount: number | null
  minRentalDays: number | null
  maxRentalDays: number | null
  description: string | null
  nextServiceDueAt: string | null
  images: string[]
  imageUrl: string | null
  listingStatus: CarHireListingStatus
  isAvailable: boolean
  listingGroupId: string | null
  unitLabel: string | null
  operatorId: string | null
  operatorName: string | null
  ownerId: number | null
  ownerName: string | null
  ownerEmail: string | null
  updatedAt: string | null
  createdAt: string | null
}

export type OpsModerationEvent = {
  id: string
  action: string
  fromStatus: string | null
  toStatus: string | null
  actorLabel: string | null
  note: string | null
  createdAt: string | null
}

export type OpsListingDetail = {
  listing: OpsListing
  events: OpsModerationEvent[]
}

export type OpsListingPage = {
  items: OpsListing[]
  counts: OpsListingCounts
}

export const EMPTY_LISTING_COUNTS: OpsListingCounts = {
  PENDING_REVIEW: 0,
  DRAFT: 0,
  PUBLISHED: 0,
  SUSPENDED: 0,
  RETIRED: 0,
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function textOrNull(value: unknown): string | null {
  const value2 = text(value)
  return value2.length > 0 ? value2 : null
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(item => text(item)).filter(item => item.length > 0)
}

export function normalizeListingStatus(raw: unknown): CarHireListingStatus {
  // Rows created before listing status existed are public, matching the
  // backend's own default.
  const value = text(raw).toUpperCase()
  return (CAR_HIRE_LISTING_STATUSES as readonly string[]).includes(value)
    ? (value as CarHireListingStatus)
    : 'PUBLISHED'
}

export function parseOpsListing(value: unknown): OpsListing | null {
  const row = record(value)
  if (!row) return null
  const id = numeric(row.id ?? row.carId)
  if (id == null || id <= 0) return null

  const images = list(row.images)
  const imageUrl = textOrNull(row.imageUrl) ?? (images.length > 0 ? images[0] : null)

  return {
    id: Math.round(id),
    make: text(row.make),
    model: text(row.model),
    year: numeric(row.year),
    color: text(row.color),
    licensePlate: text(row.licensePlate),
    dailyRate: numeric(row.dailyRate) ?? 0,
    currency: text(row.currency) || 'MWK',
    seats: numeric(row.seats),
    transmission: textOrNull(row.transmission),
    fuelType: textOrNull(row.fuelType),
    bodyType: textOrNull(row.bodyType),
    pickupArea: textOrNull(row.pickupArea),
    depositAmount: numeric(row.depositAmount),
    minRentalDays: numeric(row.minRentalDays),
    maxRentalDays: numeric(row.maxRentalDays),
    description: textOrNull(row.description),
    nextServiceDueAt: textOrNull(row.nextServiceDueAt),
    images,
    imageUrl,
    listingStatus: normalizeListingStatus(row.listingStatus),
    isAvailable: row.isAvailable !== false,
    listingGroupId: textOrNull(row.listingGroupId),
    unitLabel: textOrNull(row.unitLabel),
    operatorId: textOrNull(row.operatorId),
    operatorName: textOrNull(row.operatorName),
    ownerId: numeric(row.ownerId),
    ownerName: textOrNull(row.ownerName),
    ownerEmail: textOrNull(row.ownerEmail),
    updatedAt: textOrNull(row.updatedAt),
    createdAt: textOrNull(row.createdAt),
  }
}

export function parseOpsModerationEvent(value: unknown): OpsModerationEvent | null {
  const row = record(value)
  if (!row) return null
  const id = text(row.id)
  if (!id) return null
  return {
    id,
    action: text(row.action) || 'UNKNOWN',
    fromStatus: textOrNull(row.fromStatus),
    toStatus: textOrNull(row.toStatus),
    actorLabel: textOrNull(row.actorLabel),
    note: textOrNull(row.note),
    createdAt: textOrNull(row.createdAt),
  }
}

/**
 * Accepts either the plain `{ data: [...] }` shape or a wrapper that also
 * carries per-status counts, so the proxy can stay thin.
 */
export function parseOpsListingPage(value: unknown): OpsListingPage {
  const body = record(value)
  const rows = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.items)
      ? body.items
      : []

  const items = rows
    .map(parseOpsListing)
    .filter((item): item is OpsListing => item !== null)

  const counts: OpsListingCounts = { ...EMPTY_LISTING_COUNTS }
  const rawCounts = record(body?.counts)
  if (rawCounts) {
    for (const status of CAR_HIRE_LISTING_STATUSES) {
      const count = numeric(rawCounts[status])
      if (count != null && count >= 0) counts[status] = Math.round(count)
    }
  } else {
    // Fall back to the rows we have so tabs never read zero by accident.
    for (const item of items) counts[item.listingStatus] += 1
  }

  return { items, counts }
}

export function parseOpsListingDetail(value: unknown): OpsListingDetail | null {
  const body = record(value)
  // The backend may nest the row under `data` or return it directly.
  const listing =
    parseOpsListing(body?.data) ??
    parseOpsListing(body?.listing) ??
    parseOpsListing(body)
  if (!listing) return null

  const rawEventsSource = record(body?.data)?.events ?? body?.events
  const events = Array.isArray(rawEventsSource)
    ? rawEventsSource
        .map(parseOpsModerationEvent)
        .filter((event): event is OpsModerationEvent => event !== null)
    : []

  return { listing, events }
}

export function opsListingTitle(listing: OpsListing): string {
  const title = [listing.make, listing.model].filter(Boolean).join(' ').trim()
  return title || `Vehicle #${listing.id}`
}

export function opsListingSubtitle(listing: OpsListing): string {
  const parts = [
    listing.year ? String(Math.round(listing.year)) : '',
    listing.color,
    listing.bodyType ? prettyToken(listing.bodyType) : '',
    listing.seats ? `${Math.round(listing.seats)} seats` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

export function opsListingTone(status: CarHireListingStatus): StatusTone {
  return carHireStatusTone(status)
}

export function opsListingLabel(status: CarHireListingStatus): string {
  if (status === 'PENDING_REVIEW') return 'Pending review'
  return listingStatusLabel(status)
}

function prettyToken(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Actions the reviewer can take from a given listing state. */
export function opsListingActions(
  status: CarHireListingStatus,
): CarHireModerationAction[] {
  switch (status) {
    case 'PENDING_REVIEW':
      return ['approve', 'reject']
    case 'DRAFT':
      return ['approve']
    case 'SUSPENDED':
      return ['restore']
    case 'PUBLISHED':
      return ['suspend']
    default:
      return []
  }
}

/** Reject and suspend require a note; the backend rejects the call otherwise. */
export function actionRequiresNote(action: CarHireModerationAction): boolean {
  return action === 'reject' || action === 'suspend'
}

export function actionLabel(action: CarHireModerationAction): string {
  switch (action) {
    case 'approve':
      return 'Approve & publish'
    case 'reject':
      return 'Send back'
    case 'suspend':
      return 'Suspend'
    case 'restore':
      return 'Restore'
  }
}

// ---------------------------------------------------------------------------
// Company review
// ---------------------------------------------------------------------------

export type CarHireCompanyReviewAction =
  | 'approve'
  | 'reject'
  | 'request-info'
  | 'suspend'
  | 'restore'

export type OpsDocument = {
  type: string
  url: string
  uploadedAt: string | null
}

export type OpsCompany = {
  id: string
  displayName: string
  type: string
  status: string
  contactPhone: string | null
  serviceAreas: string[]
  reviewerNote: string | null
  logoUrl: string | null
  registrationNumber: string | null
  taxId: string | null
  idNumber: string | null
  payoutMethod: string | null
  payoutBankName: string | null
  /** Account holder name, shown in full. */
  payoutAccountName: string | null
  /** Raw account number. Render it through `maskAccountNumber`. */
  payoutAccountNumber: string | null
  documents: OpsDocument[]
  /** Labels for verification detail this company has not supplied yet. */
  verificationGaps: string[]
  ownerId: number | null
  ownerName: string | null
  ownerEmail: string | null
  ownerPhone: string | null
  createdAt: string | null
  updatedAt: string | null
}

function parseOpsDocument(value: unknown): OpsDocument | null {
  const row = record(value)
  if (!row) return null
  const url = text(row.url)
  if (!url) return null
  return {
    type: text(row.type).toUpperCase() || 'DOCUMENT',
    url,
    uploadedAt: textOrNull(row.uploadedAt),
  }
}

/**
 * Payout account numbers are sensitive: the console shows the last four
 * digits only, whatever the raw value looks like.
 */
export function maskAccountNumber(value: unknown): string {
  const raw = text(value)
  if (!raw) return ''
  return raw.length <= 4 ? '••••' : `•••• ${raw.slice(-4)}`
}

export function parseOpsCompany(value: unknown): OpsCompany | null {
  const row = record(value)
  if (!row) return null
  const id = text(row.id ?? row.operatorId)
  if (!id) return null
  const owner = record(row.owner)
  const documents = Array.isArray(row.documents)
    ? row.documents
        .map(parseOpsDocument)
        .filter((document): document is OpsDocument => document !== null)
    : []
  return {
    id,
    displayName: text(row.displayName) || text(row.companyName) || `Company ${id.slice(0, 8)}`,
    type: text(row.type) || 'BUSINESS',
    status: text(row.status).toUpperCase() || 'SUBMITTED',
    contactPhone: textOrNull(row.contactPhone),
    serviceAreas: list(row.serviceAreas),
    reviewerNote: textOrNull(row.reviewerNote),
    logoUrl: textOrNull(row.logoUrl),
    registrationNumber: textOrNull(row.registrationNumber),
    taxId: textOrNull(row.taxId),
    idNumber: textOrNull(row.idNumber),
    payoutMethod: textOrNull(row.payoutMethod)?.toUpperCase() ?? null,
    payoutBankName: textOrNull(row.payoutBankName),
    payoutAccountName: textOrNull(row.payoutAccountName),
    payoutAccountNumber: textOrNull(row.payoutAccountNumber),
    documents,
    verificationGaps: list(row.verificationGaps),
    ownerId: numeric(owner?.id ?? row.ownerUserId),
    ownerName: textOrNull(owner?.name) ?? textOrNull(row.ownerName),
    ownerEmail: textOrNull(owner?.email) ?? textOrNull(row.ownerEmail),
    ownerPhone: textOrNull(owner?.phone) ?? textOrNull(row.ownerPhone),
    createdAt: textOrNull(row.createdAt),
    updatedAt: textOrNull(row.updatedAt),
  }
}

export function parseOpsCompanyPage(value: unknown): OpsCompany[] {
  const body = record(value)
  const rows = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.items)
      ? body.items
      : []
  return rows.map(parseOpsCompany).filter((row): row is OpsCompany => row !== null)
}

/** Actions a reviewer can take on a company, mirroring the backend rules. */
export function opsCompanyActions(status: string): CarHireCompanyReviewAction[] {
  switch (status.toUpperCase()) {
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return ['approve', 'request-info', 'reject']
    case 'NEEDS_INFORMATION':
      return ['approve', 'reject']
    case 'ACTIVE':
      return ['suspend']
    case 'SUSPENDED':
      return ['restore']
    case 'REJECTED':
      return ['approve']
    default:
      return []
  }
}

export function companyActionRequiresNote(
  action: CarHireCompanyReviewAction,
): boolean {
  return action === 'reject' || action === 'request-info' || action === 'suspend'
}

export function companyActionLabel(action: CarHireCompanyReviewAction): string {
  switch (action) {
    case 'approve':
      return 'Approve company'
    case 'reject':
      return 'Reject'
    case 'request-info':
      return 'Request info'
    case 'suspend':
      return 'Suspend'
    case 'restore':
      return 'Restore'
  }
}
