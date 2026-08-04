import { formatDateTime, unwrapList } from '@/lib/vero-api'

export const COURIER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'ON_THE_WAY',
  'DELIVERED',
  'CANCELLED',
] as const

export type CourierStatus = (typeof COURIER_STATUSES)[number]

export type CourierDelivery = {
  id: number
  trackingNumber: string
  phone: string
  email: string
  city: string
  pickupLocation: string
  dropoffLocation: string
  typeOfGoods: string | null
  descriptionOfGoods: string | null
  additionalInformation: string | null
  status: CourierStatus
  createdAt: string | null
  updatedAt: string | null
  senderName: string | null
  recipientName: string | null
  recipientPhone: string | null
  recipientAddress: string | null
  notes: string | null
}

export function isCourierStatus(value: string): value is CourierStatus {
  return (COURIER_STATUSES as readonly string[]).includes(value)
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

function parseStatus(raw: unknown): CourierStatus {
  const value = str(raw).toUpperCase()
  return isCourierStatus(value) ? value : 'PENDING'
}

function parseAdditionalInfo(raw: string | null) {
  if (!raw) {
    return {
      senderName: null as string | null,
      recipientName: null as string | null,
      recipientPhone: null as string | null,
      recipientAddress: null as string | null,
      notes: null as string | null,
    }
  }

  let senderName: string | null = null
  let recipientName: string | null = null
  let recipientPhone: string | null = null
  let recipientAddress: string | null = null
  const noteParts: string[] = []

  for (const part of raw
    .split('|')
    .map(s => s.trim())
    .filter(Boolean)) {
    const lower = part.toLowerCase()
    if (lower.startsWith('sender:')) {
      senderName = part.slice(part.indexOf(':') + 1).trim() || null
    } else if (lower.startsWith('recipient phone:')) {
      recipientPhone = part.slice(part.indexOf(':') + 1).trim() || null
    } else if (lower.startsWith('recipient address:')) {
      recipientAddress = part.slice(part.indexOf(':') + 1).trim() || null
    } else if (lower.startsWith('recipient:')) {
      recipientName = part.slice(part.indexOf(':') + 1).trim() || null
    } else {
      noteParts.push(part)
    }
  }

  return {
    senderName,
    recipientName,
    recipientPhone,
    recipientAddress,
    notes: noteParts.length ? noteParts.join(' · ') : null,
  }
}

export function parseCourierDeliveries(body: unknown): CourierDelivery[] {
  return unwrapList(body)
    .map(item => asRecord(item))
    .filter((item): item is Record<string, unknown> => !!item)
    .map(item => {
      const additional = nullableStr(item.AdditionalInformation ?? item.additionalInformation)
      const parsed = parseAdditionalInfo(additional)

      return {
        id: toId(item.CourierID ?? item.id),
        trackingNumber: str(item.trackingNumber),
        phone: str(item.CourierPhone ?? item.courierPhone),
        email: str(item.CourierEmail ?? item.courierEmail),
        city: str(item.CourierCity ?? item.courierCity),
        pickupLocation: str(item.pickupLocation),
        dropoffLocation: str(item.dropoffLocation),
        typeOfGoods: nullableStr(item.TypeOfGoods ?? item.typeOfGoods),
        descriptionOfGoods: nullableStr(item.DescriptionOfGoods ?? item.descriptionOfGoods),
        additionalInformation: additional,
        status: parseStatus(item.CourierStatus ?? item.status),
        createdAt: nullableStr(item.createdAt),
        updatedAt: nullableStr(item.updatedAt),
        senderName: parsed.senderName,
        recipientName: parsed.recipientName,
        recipientPhone: parsed.recipientPhone,
        recipientAddress: parsed.recipientAddress,
        notes: parsed.notes,
      } satisfies CourierDelivery
    })
    .filter(item => item.id > 0)
}

/** Labels shown to admins and matching what users see in the app. */
export function statusLabel(status: CourierStatus) {
  switch (status) {
    case 'PENDING':
      return 'Pending'
    case 'ACCEPTED':
      return 'Accepted'
    case 'ON_THE_WAY':
      return 'Coming'
    case 'DELIVERED':
      return 'Delivered'
    case 'CANCELLED':
      return 'Rejected'
  }
}

/**
 * Next admin actions for a delivery.
 * Flow: Pending → Accept / Reject → Coming → Delivered
 * Updates are pushed to the user via CourierStatus on the API.
 */
export function adminActionsFor(status: CourierStatus): Array<{
  status: CourierStatus
  label: string
  kind: 'accept' | 'coming' | 'deliver' | 'reject'
}> {
  switch (status) {
    case 'PENDING':
      return [
        { status: 'ACCEPTED', label: 'Accept', kind: 'accept' },
        { status: 'CANCELLED', label: 'Reject', kind: 'reject' },
      ]
    case 'ACCEPTED':
      return [
        { status: 'ON_THE_WAY', label: 'Coming', kind: 'coming' },
        { status: 'CANCELLED', label: 'Reject', kind: 'reject' },
      ]
    case 'ON_THE_WAY':
      return [
        { status: 'DELIVERED', label: 'Delivered', kind: 'deliver' },
        { status: 'CANCELLED', label: 'Reject', kind: 'reject' },
      ]
    default:
      return []
  }
}

export function statusTone(status: CourierStatus): { bg: string; color: string; border: string } {
  switch (status) {
    case 'PENDING':
      return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
    case 'ACCEPTED':
      return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
    case 'ON_THE_WAY':
      return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
    case 'DELIVERED':
      return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
    case 'CANCELLED':
      return { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
  }
}

export { formatDateTime }
