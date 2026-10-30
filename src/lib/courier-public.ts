import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import { COURIER_CITY } from '@/lib/courier-pricing'
import { WEB_GUEST_ORDERS_COLLECTION } from '@/lib/guest-checkout'
import { apiErrorMessage, readJsonSafe, veroEndpoint } from '@/lib/vero-api'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

export type NestCourierDelivery = {
  CourierID?: number
  id?: number
  trackingNumber?: string
  CourierStatus?: string
  CourierPhone?: string
  CourierEmail?: string
  CourierCity?: string
  pickupLocation?: string
  dropoffLocation?: string
  TypeOfGoods?: string
  DescriptionOfGoods?: string
}

export async function createNestCourierDelivery(input: {
  phone: string
  email: string
  pickup: string
  dropoff: string
  goodsType: string
  description: string
  notes?: string
  amountMwk?: number
  txRef?: string
}): Promise<NestCourierDelivery> {
  const extra = [
    input.notes?.trim() ? `Notes: ${input.notes.trim()}` : '',
    input.amountMwk ? `WebFare: MWK ${Math.round(input.amountMwk)}` : '',
    input.txRef ? `TxRef: ${input.txRef}` : '',
    'Source: web_guest',
  ]
    .filter(Boolean)
    .join(' | ')

  const res = await fetch(veroEndpoint('verocourier', 'create', 'deliveries'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      CourierPhone: input.phone,
      CourierEmail: input.email,
      CourierCity: COURIER_CITY,
      pickupLocation: input.pickup,
      dropoffLocation: input.dropoff,
      TypeOfGoods: input.goodsType,
      DescriptionOfGoods: input.description || undefined,
      AdditionalInformation: extra || undefined,
    }),
    cache: 'no-store',
  })
  const body = await readJsonSafe(res)
  if (!res.ok) {
    throw new Error(apiErrorMessage(body, 'Could not create the courier delivery'))
  }
  return (asDelivery(body) || body) as NestCourierDelivery
}

function asDelivery(body: unknown): NestCourierDelivery | null {
  if (!body || typeof body !== 'object') return null
  const rec = body as Record<string, unknown>
  const nested = rec.data
  if (nested && typeof nested === 'object') return nested as NestCourierDelivery
  if (rec.CourierID != null || rec.trackingNumber != null) return rec as NestCourierDelivery
  return rec as NestCourierDelivery
}

export function nestDeliveryId(row: NestCourierDelivery): number | null {
  const n = Number(row.CourierID ?? row.id)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function trackNestCourier(code: string): Promise<Record<string, unknown>> {
  const tracking = code.trim().toUpperCase()
  if (!tracking) throw new Error('Enter a tracking number')
  const res = await fetch(veroEndpoint('verocourier', 'track', tracking), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const body = await readJsonSafe(res)
  if (!res.ok) {
    throw new Error(apiErrorMessage(body, 'Tracking number not found'))
  }
  const row = (asDelivery(body) || body) as Record<string, unknown>
  return {
    trackingNumber: str(row.trackingNumber) || tracking,
    status: str(row.CourierStatus || row.status) || 'PENDING',
    pickupLocation: str(row.pickupLocation),
    dropoffLocation: str(row.dropoffLocation),
    city: str(row.CourierCity) || COURIER_CITY,
    goodsType: str(row.TypeOfGoods),
    createdAt: str(row.createdAt) || null,
  }
}

export async function fulfillCourierGuestOrder(opts: {
  orderId: string
  data: Record<string, unknown>
}): Promise<{ trackingNumber: string; nestId: number | null }> {
  const existingTrack = str(opts.data.trackingNumber)
  const existingId = Number(opts.data.nestDeliveryId)
  if (existingTrack) {
    return {
      trackingNumber: existingTrack,
      nestId: Number.isFinite(existingId) ? existingId : null,
    }
  }

  const created = await createNestCourierDelivery({
    phone: str(opts.data.buyerPhone),
    email: str(opts.data.buyerEmail),
    pickup: str(opts.data.pickupLocation),
    dropoff: str(opts.data.dropoffLocation),
    goodsType: str(opts.data.goodsType) || 'Other',
    description: str(opts.data.description),
    notes: str(opts.data.notes),
    amountMwk: Number(opts.data.amountMwk) || 0,
    txRef: str(opts.data.txRef),
  })
  const nestId = nestDeliveryId(created)
  const trackingNumber = str(created.trackingNumber)
  await getAdminDb()
    .collection(WEB_GUEST_ORDERS_COLLECTION)
    .doc(opts.orderId)
    .set(
      {
        nestDeliveryId: nestId,
        trackingNumber,
        nestStatus: str(created.CourierStatus) || 'PENDING',
        fulfilledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  await notifyCourierInbox({
    id: nestId,
    trackingNumber,
    phone: str(opts.data.buyerPhone),
    pickupLocation: str(opts.data.pickupLocation),
    dropoffLocation: str(opts.data.dropoffLocation),
  }).catch(err => console.warn('Courier inbox email:', err))
  return { trackingNumber, nestId }
}

async function notifyCourierInbox(opts: {
  id: number | null
  trackingNumber: string
  phone: string
  pickupLocation: string
  dropoffLocation: string
}): Promise<void> {
  const to =
    process.env.CONTACT_TO_EMAIL ||
    process.env.VEROCHAT_NOTIFY_EMAIL ||
    'info@vero360.app'
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return
  const adminBase = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://vero360.app'
  const inboxUrl = `${adminBase.replace(/\/$/, '')}/dashboard/vero-courier`
  const idLabel = opts.id ? `#${opts.id}` : 'new order'
  const tracking = opts.trackingNumber ? ` (${opts.trackingNumber})` : ''
  const text = [
    `A new Vero Courier order was placed on the website: ${idLabel}${tracking}`,
    '',
    `City: ${COURIER_CITY}`,
    `Phone: ${opts.phone || '—'}`,
    `Pickup: ${opts.pickupLocation || '—'}`,
    `Drop-off: ${opts.dropoffLocation || '—'}`,
    '',
    `Open admin: ${inboxUrl}`,
  ].join('\n')
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Vero360 <onboarding@resend.dev>',
      to: [to],
      subject: `[Vero Courier] Website order ${idLabel}${tracking}`,
      text,
    }),
  })
}
