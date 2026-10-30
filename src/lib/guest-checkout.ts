import 'server-only'

import { randomUUID } from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import { buyerFacingPrice } from '@/lib/buyer-commission'
import { sendFcmToUid } from '@/lib/courier-push'
import {
  normalizeMalawiPhone,
  splitBuyerName,
} from '@/lib/digital-services-checkout'
import { fetchPublicFoodById, type FoodItem } from '@/lib/food'
import {
  MARKETPLACE_ITEMS_COLLECTION,
  parseFirestoreMarketplaceListing,
  type MarketplaceListing,
} from '@/lib/marketplace'
import type { MarketplaceOrder } from '@/lib/orders'
import { savePawaPayDeposit } from '@/lib/pawapay-deposits'
import {
  createPawaPayDeposit,
  networkFromMalawiPhone,
  pawaPayConfigured,
  providerForNetwork,
  type PawaPayNetwork,
} from '@/lib/pawapay'
import {
  getBankTransferConfig,
  publicBankTransferPayload,
} from '@/lib/bank-transfer-config'
import { parseStayListings, type StayBooking, type StayListing } from '@/lib/stay'
import { ACCOMMODATION_ROOMS_COLLECTION } from '@/lib/stay-rooms'
import {
  readJsonSafe,
  unwrapList,
  veroEndpoint,
} from '@/lib/vero-api'

export { normalizeMalawiPhone, splitBuyerName }

export const WEB_GUEST_ORDERS_COLLECTION = 'web_guest_orders'
export const GUEST_ADMIN_ID_BASE = 900_000_000

export type GuestOrderKind = 'marketplace' | 'food' | 'stay' | 'courier'

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function guestNumericId(docId: string): number {
  let h = 0
  for (let i = 0; i < docId.length; i += 1) {
    h = (h * 31 + docId.charCodeAt(i)) >>> 0
  }
  return GUEST_ADMIN_ID_BASE + (h % 99_000_000)
}

export function isGuestAdminId(id: number): boolean {
  return id >= GUEST_ADMIN_ID_BASE
}

export function parsePayMethod(raw: unknown): 'bank' | 'momo' {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'bank' || s === 'bank_transfer') return 'bank'
  return 'momo'
}

export function resolvePawaPayNetwork(
  phone: string,
  requestedRaw: unknown,
): PawaPayNetwork | '' {
  const guessed = networkFromMalawiPhone(phone)
  const requested = String(requestedRaw || '').trim().toLowerCase()
  const network: PawaPayNetwork | '' =
    requested === 'airtel' || requested === 'tnm' ? requested : guessed
  if (guessed && network && network !== guessed) {
    throw new Error('This number does not match the network you selected.')
  }
  return network
}

export async function parseGuestBuyer(body: Record<string, unknown>): Promise<{
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  buyerUid: string
  isBank: boolean
  network: PawaPayNetwork | ''
  proofUrl: string
}> {
  const buyerName = String(body.buyerName || '').trim()
  const buyerEmail = String(body.buyerEmail || '').trim().toLowerCase()
  const phoneRaw = String(body.buyerPhone || '').trim()
  const isBank = parsePayMethod(body.method || body.payMethod) === 'bank'

  if (buyerName.length < 2) throw new Error('Enter your full name')
  if (!isEmail(buyerEmail)) throw new Error('Enter a valid email address')

  const buyerPhone = normalizeMalawiPhone(phoneRaw)
  const network = isBank ? '' : resolvePawaPayNetwork(buyerPhone, body.network)
  if (!isBank && !network) {
    throw new Error('Use an Airtel Money (099) or TNM Mpamba (088) number.')
  }
  if (!isBank && !pawaPayConfigured()) {
    throw new Error(
      'Online payments are not configured yet. Add PAWAPAY_API_TOKEN in Netlify env.',
    )
  }

  const proofUrl = String(body.proofUrl || body.bankProofUrl || '').trim()
  if (isBank && !/^https?:\/\//i.test(proofUrl)) {
    throw new Error('Upload a photo of your transfer slip so we can confirm the payment.')
  }

  return {
    buyerName,
    buyerEmail,
    buyerPhone,
    buyerUid: `web:${randomUUID()}`,
    isBank,
    network,
    proofUrl,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function listingRows(body: unknown): Record<string, unknown>[] {
  const list = unwrapList(body)
  if (list.length) {
    return list.map(asRecord).filter((row): row is Record<string, unknown> => !!row)
  }
  const rec = asRecord(body)
  if (!rec) return []
  const nested =
    asRecord(rec.data) ||
    asRecord(rec.item) ||
    asRecord(rec.accommodation) ||
    asRecord(rec.product)
  if (nested) return [nested]
  if (rec.id != null || rec.name != null) return [rec]
  return []
}

export async function loadMarketplaceForCheckout(
  id: string,
): Promise<MarketplaceListing> {
  const clean = id.trim()
  if (!clean) throw new Error('Missing product')
  const db = getAdminDb()
  let doc = await db.collection(MARKETPLACE_ITEMS_COLLECTION).doc(clean).get()
  const sqlId = Number(clean)
  if (!doc.exists && Number.isFinite(sqlId) && sqlId > 0) {
    const snap = await db
      .collection(MARKETPLACE_ITEMS_COLLECTION)
      .where('sqlItemId', '==', sqlId)
      .limit(1)
      .get()
    if (!snap.empty) doc = snap.docs[0]!
  }
  if (doc.exists) {
    const parsed = parseFirestoreMarketplaceListing(
      doc.id,
      doc.data() as Record<string, unknown>,
    )
    if (parsed && parsed.price > 0) return parsed
  }
  if (Number.isFinite(sqlId) && sqlId > 0) {
    const res = await fetch(veroEndpoint('marketplace', sqlId), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    })
    if (res.ok) {
      const body = await readJsonSafe(res)
      const row = listingRows(body)[0]
      if (row) {
        const parsed = parseFirestoreMarketplaceListing('api', row)
        if (parsed && parsed.price > 0) return parsed
      }
    }
  }
  throw new Error('Product not found')
}

export async function loadFoodForCheckout(id: string): Promise<FoodItem> {
  const item = await fetchPublicFoodById(id.trim())
  if (!item || !(item.price > 0)) throw new Error('Meal not found')
  return item
}

export async function loadStayForCheckout(id: string): Promise<StayListing> {
  const clean = id.trim()
  if (!clean) throw new Error('Missing stay')
  const n = Number(clean)
  if (Number.isFinite(n) && n > 0) {
    const headers = { Accept: 'application/json' }
    for (const url of [
      veroEndpoint('accommodations', n),
      veroEndpoint('accommodations', 'all'),
    ]) {
      try {
        const res = await fetch(url, { headers, cache: 'no-store' })
        if (!res.ok) continue
        const body = await readJsonSafe(res)
        const items = parseStayListings(listingRows(body))
        const stay = items.find(item => item.id === n)
        if (stay && stay.price > 0) return stay
      } catch {
        // try next
      }
    }
  }
  const db = getAdminDb()
  let doc = await db.collection(ACCOMMODATION_ROOMS_COLLECTION).doc(clean).get()
  if (!doc.exists) doc = await db.collection('accommodations').doc(clean).get()
  if (doc.exists) {
    const data = (doc.data() || {}) as Record<string, unknown>
    const apiId =
      Number(data.accommodationId ?? data.sqlId ?? data.id ?? data.ID) ||
      (clean.includes('_') ? Number(clean.split('_').pop()) : 0)
    if (apiId > 0 && String(apiId) !== clean) {
      try {
        const nested = await loadStayForCheckout(String(apiId))
        if (nested.price > 0) return nested
      } catch {
        // fall through to Firestore fields
      }
    }
    const price = Number(data.price ?? data.pricePerNight) || 0
    if (price > 0) {
      return {
        id: apiId > 0 ? apiId : 0,
        name: String(data.name || data.title || 'Stay on Vero360').trim(),
        location: String(data.location || '—').trim(),
        description: String(data.description || '').trim() || null,
        price,
        accommodationType: String(data.accommodationType || data.type || 'lodge'),
        image: String(data.image || data.imageUrl || data.coverImage || '') || null,
        gallery: Array.isArray(data.gallery)
          ? data.gallery.map(x => String(x).trim()).filter(Boolean)
          : [],
        hostName: String(data.hostName || data.merchantName || '') || null,
        hostEmail: null,
        hostPhone: null,
        hostFirebaseUid: String(data.merchantId || data.hostFirebaseUid || '') || null,
        pricingPeriod: String(data.pricingPeriod || data.pricePeriod || 'night') || 'night',
        capacity: null,
        isAvailable: true,
        hostelGender: null,
        roomType: null,
      }
    }
  }
  throw new Error('Stay not found')
}

export function marketplaceGuestTotal(listing: MarketplaceListing): number {
  return Math.round(buyerFacingPrice(listing.price))
}

export async function createGuestOrder(input: {
  kind: GuestOrderKind
  amountMwk: number
  txRef: string
  buyerUid: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  title: string
  paymentProvider: 'pawapay' | 'bank_transfer'
  bankProofUrl?: string
  extra?: Record<string, unknown>
}): Promise<{ id: string; adminNumericId: number }> {
  const ref = getAdminDb().collection(WEB_GUEST_ORDERS_COLLECTION).doc()
  const adminNumericId = guestNumericId(ref.id)
  const extra = Object.fromEntries(
    Object.entries(input.extra || {}).filter(([, value]) => value !== undefined),
  )
  await ref.set({
    kind: input.kind,
    title: input.title,
    amountMwk: input.amountMwk,
    currency: 'MWK',
    status: input.paymentProvider === 'bank_transfer' ? 'pending_review' : 'pending_payment',
    paymentStatus: input.paymentProvider === 'bank_transfer' ? 'PENDING' : 'UNPAID',
    txRef: input.txRef,
    depositId: null,
    paymentProvider: input.paymentProvider,
    buyerUid: input.buyerUid,
    isGuest: true,
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
    buyerPhone: input.buyerPhone,
    source: 'web',
    adminNumericId,
    ...(input.bankProofUrl
      ? {
          bankProofUrl: input.bankProofUrl,
          bankProofUrls: [input.bankProofUrl],
          bankTransferReportedAt: FieldValue.serverTimestamp(),
        }
      : {}),
    ...extra,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return { id: ref.id, adminNumericId }
}

export async function startGuestPawaPay(opts: {
  orderId: string
  buyerUid: string
  amountMwk: number
  buyerPhone: string
  network: PawaPayNetwork
  txRef: string
  kind: GuestOrderKind
}): Promise<string> {
  const depositId = randomUUID()
  const depositKind =
    opts.kind === 'marketplace'
      ? 'marketplace_order'
      : opts.kind === 'food'
        ? 'food_order'
        : opts.kind === 'stay'
          ? 'stay_booking'
          : 'courier_delivery'
  try {
    await savePawaPayDeposit({
      depositId,
      userId: opts.buyerUid,
      amount: opts.amountMwk,
      phone: opts.buyerPhone,
      provider: providerForNetwork(opts.network),
      reference: opts.txRef,
      orderId: opts.orderId,
      kind: depositKind,
    })
    await createPawaPayDeposit({
      depositId,
      amountMwk: opts.amountMwk,
      phone: opts.buyerPhone,
      network: opts.network,
      reference: opts.txRef,
    })
    await getAdminDb()
      .collection(WEB_GUEST_ORDERS_COLLECTION)
      .doc(opts.orderId)
      .set(
        {
          depositId,
          paymentProvider: 'pawapay',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    return depositId
  } catch (err) {
    await getAdminDb()
      .collection(WEB_GUEST_ORDERS_COLLECTION)
      .doc(opts.orderId)
      .set(
        {
          status: 'failed',
          paymentStatus: 'FAILED',
          depositId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      .catch(() => {})
    throw err
  }
}

export async function recordGuestBankTransfer(opts: {
  orderId: string
  txRef: string
  amountMwk: number
  proofUrl: string
  buyerUid: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  kind: GuestOrderKind
  title: string
}): Promise<void> {
  const bank = await getBankTransferConfig()
  if (!bank.enabled) {
    throw new Error('Bank transfer is not available right now. Use mobile money.')
  }
  await getAdminDb()
    .collection('bank_transfer_payments')
    .doc(opts.orderId)
    .set({
      txRef: opts.txRef,
      amountMwk: opts.amountMwk,
      proofUrl: opts.proofUrl,
      proofUrls: [opts.proofUrl],
      buyerUid: opts.buyerUid,
      buyerName: opts.buyerName,
      buyerEmail: opts.buyerEmail,
      buyerPhone: opts.buyerPhone,
      source: opts.kind,
      title: opts.title,
      guestOrderId: opts.orderId,
      status: 'pending_review',
      paymentProvider: 'bank_transfer',
      createdAt: FieldValue.serverTimestamp(),
    })
}

export function guestBankPayload() {
  return getBankTransferConfig().then(publicBankTransferPayload)
}

export async function findGuestOrderByTxRef(txRef: string) {
  const clean = txRef.trim()
  if (!clean) return null
  const snap = await getAdminDb()
    .collection(WEB_GUEST_ORDERS_COLLECTION)
    .where('txRef', '==', clean)
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, data: doc.data() as Record<string, unknown> }
}

export async function findGuestOrderById(orderId: string) {
  const clean = orderId.trim()
  if (!clean) return null
  const snap = await getAdminDb().collection(WEB_GUEST_ORDERS_COLLECTION).doc(clean).get()
  if (!snap.exists) return null
  return { id: snap.id, data: snap.data() as Record<string, unknown> }
}

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
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
  return null
}

async function notifyMerchant(opts: {
  uid: string
  title: string
  body: string
  type: string
  extra?: Record<string, string>
}): Promise<void> {
  const uid = opts.uid.trim()
  if (!uid || uid.startsWith('web:')) return
  try {
    await getAdminDb().collection('order_party_alerts').add({
      toUid: uid,
      title: opts.title,
      body: opts.body,
      payload: {
        type: opts.type,
        ...opts.extra,
      },
      createdAt: FieldValue.serverTimestamp(),
      consumed: false,
      read: false,
    })
  } catch (err) {
    console.warn('guest notify firestore:', err)
  }
  try {
    await sendFcmToUid(uid, opts.title, opts.body, {
      type: opts.type,
      ...opts.extra,
    })
  } catch (err) {
    console.warn('guest notify fcm:', err)
  }
}

async function writeFoodOrderFromGuest(opts: {
  guestId: string
  data: Record<string, unknown>
  paid: boolean
}): Promise<string> {
  const existing = str(opts.data.foodOrderId)
  const db = getAdminDb()
  const ref = existing
    ? db.collection('food_orders').doc(existing)
    : db.collection('food_orders').doc()
  const qty = Math.max(1, Number(opts.data.quantity) || 1)
  const unit = Number(opts.data.unitPriceMwk) || Number(opts.data.amountMwk) || 0
  const name = str(opts.data.title) || 'Food order'
  const payload: Record<string, unknown> = {
    orderId: ref.id,
    orderNumber: str(opts.data.txRef) || ref.id,
    restaurantId: str(opts.data.restaurantId),
    merchantId: str(opts.data.merchantId),
    merchantName: str(opts.data.merchantName) || 'Kitchen',
    restaurantName: str(opts.data.merchantName) || 'Kitchen',
    customerUid: str(opts.data.buyerUid),
    customerId: str(opts.data.buyerUid),
    customerName: str(opts.data.buyerName),
    customerPhone: str(opts.data.buyerPhone),
    customerEmail: str(opts.data.buyerEmail),
    deliveryAddress: str(opts.data.deliveryAddress),
    lineItems: [
      {
        menuItemId: str(opts.data.listingId),
        name,
        unitPriceMwk: unit,
        quantity: qty,
        imageUrl: str(opts.data.imageUrl) || null,
      },
    ],
    items: [
      {
        name,
        price: unit,
        quantity: qty,
        imageUrl: str(opts.data.imageUrl) || null,
      },
    ],
    subtotalMwk: unit * qty,
    deliveryFeeMwk: 0,
    serviceFeeMwk: 0,
    totalMwk: Number(opts.data.amountMwk) || unit * qty,
    totalAmount: Number(opts.data.amountMwk) || unit * qty,
    status: 'pending',
    paymentTxRef: str(opts.data.txRef),
    paymentStatus: opts.paid ? 'paid' : 'pending',
    paymentProvider: str(opts.data.paymentProvider) || 'pawapay',
    source: 'web_guest',
    isGuest: true,
    guestOrderId: opts.guestId,
    coverImageUrl: str(opts.data.imageUrl) || null,
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (str(opts.data.bankProofUrl)) payload.bankProofUrl = str(opts.data.bankProofUrl)
  const snap = await ref.get()
  if (!snap.exists) payload.createdAt = FieldValue.serverTimestamp()
  await ref.set(payload, { merge: true })
  await db
    .collection(WEB_GUEST_ORDERS_COLLECTION)
    .doc(opts.guestId)
    .set({ foodOrderId: ref.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  return ref.id
}

export async function settleGuestOrderPayment(opts: {
  orderId: string
  txRef: string
}): Promise<{ alreadyPaid: boolean; kind: GuestOrderKind; data: Record<string, unknown> }> {
  const ref = getAdminDb().collection(WEB_GUEST_ORDERS_COLLECTION).doc(opts.orderId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Order not found')
  const data = snap.data() || {}
  const kind = str(data.kind) as GuestOrderKind
  const alreadyPaid =
    String(data.status || '').toLowerCase() === 'paid' ||
    String(data.paymentStatus || '').toUpperCase() === 'PAID'

  if (!alreadyPaid) {
    await ref.set(
      {
        status: 'paid',
        paymentStatus: 'PAID',
        txRef: opts.txRef,
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }

  const next = { ...data, status: 'paid', paymentStatus: 'PAID', txRef: opts.txRef }

  if (kind === 'food') {
    await writeFoodOrderFromGuest({ guestId: opts.orderId, data: next, paid: true })
    await notifyMerchant({
      uid: str(data.merchantId),
      title: `New food order · ${str(data.title) || 'Meal'}`,
      body: `${str(data.buyerName)} ordered ${str(data.title) || 'a meal'}. Open Food orders.`,
      type: 'food',
      extra: { guestOrderId: opts.orderId, badgeRoute: 'food_orders' },
    })
  } else if (kind === 'marketplace') {
    await notifyMerchant({
      uid: str(data.merchantFirebaseUid),
      title: `New marketplace order · ${str(data.title) || 'Item'}`,
      body: `${str(data.buyerName)} bought ${str(data.title) || 'an item'} as a guest.`,
      type: 'order',
      extra: { guestOrderId: opts.orderId },
    })
  } else if (kind === 'stay') {
    await notifyMerchant({
      uid: str(data.hostFirebaseUid),
      title: `New stay booking · ${str(data.title) || 'Stay'}`,
      body: `${str(data.buyerName)} booked ${str(data.title) || 'a stay'} as a guest.`,
      type: 'booking',
      extra: { guestOrderId: opts.orderId },
    })
  }

  return { alreadyPaid, kind, data: next }
}

export async function markGuestBankSubmitted(orderId: string): Promise<void> {
  const found = await findGuestOrderById(orderId)
  if (!found) return
  const kind = str(found.data.kind) as GuestOrderKind
  if (kind === 'food') {
    await writeFoodOrderFromGuest({
      guestId: orderId,
      data: found.data,
      paid: false,
    })
  }
}

export async function listGuestOrders(kind: GuestOrderKind, limit = 200) {
  const db = getAdminDb()
  let snap
  try {
    snap = await db
      .collection(WEB_GUEST_ORDERS_COLLECTION)
      .where('kind', '==', kind)
      .limit(limit)
      .get()
  } catch {
    snap = await db.collection(WEB_GUEST_ORDERS_COLLECTION).limit(limit).get()
  }
  return snap.docs
    .map(doc => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
    .filter(row => str(row.data.kind) === kind)
    .filter(row => {
      const status = str(row.data.status).toLowerCase()
      return status !== 'failed'
    })
}

export function guestOrderToMarketplace(row: {
  id: string
  data: Record<string, unknown>
}): MarketplaceOrder {
  const d = row.data
  const paid = str(d.paymentStatus).toUpperCase() === 'PAID' || str(d.status) === 'paid'
  const pendingBank = str(d.paymentProvider) === 'bank_transfer' && !paid
  return {
    id: Number(d.adminNumericId) || guestNumericId(row.id),
    orderNumber: str(d.txRef) || row.id,
    itemName: str(d.title) || 'Marketplace item',
    itemImage: str(d.imageUrl) || null,
    category: str(d.category) || 'other',
    price: Number(d.unitPriceMwk) || Number(d.amountMwk) || 0,
    quantity: Math.max(1, Number(d.quantity) || 1),
    total: Number(d.amountMwk) || 0,
    description: str(d.deliveryAddress) || str(d.notes) || 'Web guest order',
    status: 'pending',
    paymentStatus: paid ? 'PAID' : pendingBank ? 'PENDING' : 'UNPAID',
    customerName: str(d.buyerName) || null,
    customerEmail: str(d.buyerEmail) || null,
    customerPhone: str(d.buyerPhone) || null,
    customerFirebaseUid: str(d.buyerUid) || null,
    merchantName: str(d.merchantName) || null,
    merchantEmail: str(d.merchantEmail) || null,
    merchantPhone: str(d.merchantPhone) || null,
    merchantFirebaseUid: str(d.merchantFirebaseUid) || null,
    addressCity: str(d.city) || null,
    addressDescription: str(d.deliveryAddress) || null,
    orderDate: tsToIso(d.createdAt),
    courierMethod: null,
    tracking: null,
    proofUrl: null,
    paymentProvider: str(d.paymentProvider) || 'pawapay',
    bankProofUrl: str(d.bankProofUrl) || null,
  }
}

export function guestOrderToStayBooking(row: {
  id: string
  data: Record<string, unknown>
}): StayBooking {
  const d = row.data
  const paid = str(d.paymentStatus).toUpperCase() === 'PAID' || str(d.status) === 'paid'
  const nights = Math.max(1, Number(d.nights) || 1)
  const checkIn = str(d.checkInDate)
  let checkOut: string | null = str(d.checkOutDate) || null
  if (checkIn && !checkOut) {
    const start = new Date(`${checkIn}T12:00:00`)
    if (!Number.isNaN(start.getTime())) {
      start.setDate(start.getDate() + nights)
      checkOut = start.toISOString()
    }
  }
  return {
    id: Number(d.adminNumericId) || guestNumericId(row.id),
    bookingNumber: str(d.txRef) || row.id,
    bookingDate: checkIn ? new Date(`${checkIn}T12:00:00`).toISOString() : tsToIso(d.createdAt),
    checkOutDate: checkOut,
    createdAt: tsToIso(d.createdAt),
    price: Number(d.amountMwk) || 0,
    bookingFee: null,
    paymentStatus: paid ? 'PAID' : 'PENDING',
    bookingStatus: paid ? 'confirmed' : 'pending',
    paid,
    accommodationId: Number(d.accommodationId) || null,
    accommodationName: str(d.title) || null,
    accommodationType: str(d.accommodationType) || null,
    accommodationLocation: str(d.location) || null,
    accommodationImage: str(d.imageUrl) || null,
    guestName: str(d.buyerName) || null,
    guestEmail: str(d.buyerEmail) || null,
    guestPhone: str(d.buyerPhone) || null,
    guestFirebaseUid: str(d.buyerUid) || null,
    hostName: str(d.hostName) || null,
    hostEmail: str(d.hostEmail) || null,
    hostPhone: str(d.hostPhone) || null,
    hostFirebaseUid: str(d.hostFirebaseUid) || null,
    paymentProvider: str(d.paymentProvider) || 'pawapay',
    bankProofUrl: str(d.bankProofUrl) || null,
  }
}

export async function deleteGuestOrderByAdminId(adminId: number): Promise<boolean> {
  if (!isGuestAdminId(adminId)) return false
  const snap = await getAdminDb()
    .collection(WEB_GUEST_ORDERS_COLLECTION)
    .where('adminNumericId', '==', adminId)
    .limit(1)
    .get()
  if (snap.empty) return false
  const doc = snap.docs[0]
  const foodOrderId = str(doc.data()?.foodOrderId)
  await doc.ref.delete()
  if (foodOrderId) {
    await getAdminDb().collection('food_orders').doc(foodOrderId).delete().catch(() => {})
  }
  return true
}
