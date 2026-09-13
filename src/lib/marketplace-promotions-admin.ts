import 'server-only'

import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  MARKETPLACE_PROMOTIONS_COLLECTION,
  isMarketplaceBoostLive,
  type MarketplacePromotion,
  type MarketplacePromotionCounts,
  type FacebookFulfillmentStatus,
} from '@/lib/marketplace-promotions'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return Number(String(value ?? '').replace(/,/g, '')) || 0
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
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
  }
  return null
}

export function parseMarketplacePromotion(
  id: string,
  data: DocumentData | Record<string, unknown>,
): MarketplacePromotion {
  const channel = str(data.channel) || 'marketplace_top'
  const fulfillment =
    channel === 'facebook_ads'
      ? (str(data.fulfillmentStatus) || 'queued')
      : null

  return {
    id,
    itemId: str(data.itemId),
    itemName: str(data.itemName) || 'Marketplace item',
    itemImage: str(data.itemImage),
    merchantId: str(data.merchantId),
    merchantName: str(data.merchantName),
    planId: str(data.planId),
    channel,
    amountMwk: num(data.amountMwk ?? data.amount),
    durationHours: num(data.durationHours) || 0,
    reachLabel: str(data.reachLabel),
    status: str(data.status) || 'pending_payment',
    fulfillmentStatus: fulfillment,
    adminNotes: str(data.adminNotes),
    txRef: str(data.txRef) || null,
    createdAt: tsToIso(data.createdAt),
    paidAt: tsToIso(data.paidAt),
    expiresAt: tsToIso(data.expiresAt),
  }
}

export function buildPromotionCounts(items: MarketplacePromotion[]): MarketplacePromotionCounts {
  const now = Date.now()
  let marketplaceActive = 0
  let marketplaceExpired = 0
  let facebookQueued = 0
  let facebookRunning = 0
  let facebookDone = 0
  let pendingPayment = 0

  for (const p of items) {
    if (p.status === 'pending_payment') pendingPayment += 1
    if (p.channel === 'marketplace_top') {
      if (isMarketplaceBoostLive(p, now)) marketplaceActive += 1
      else if (p.status !== 'pending_payment') marketplaceExpired += 1
    } else if (p.channel === 'facebook_ads') {
      if (p.status === 'pending_payment') continue
      const f = (p.fulfillmentStatus || 'queued') as FacebookFulfillmentStatus
      if (f === 'done' || p.status === 'fulfilled') facebookDone += 1
      else if (f === 'running') facebookRunning += 1
      else facebookQueued += 1
    }
  }

  return {
    all: items.length,
    marketplaceActive,
    marketplaceExpired,
    facebookQueued,
    facebookRunning,
    facebookDone,
    pendingPayment,
  }
}

export async function listMarketplacePromotions(limit = 500): Promise<MarketplacePromotion[]> {
  const db = getAdminDb()
  const snap = await db
    .collection(MARKETPLACE_PROMOTIONS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(Math.max(limit, 1), 1000))
    .get()

  return snap.docs.map(doc => parseMarketplacePromotion(doc.id, doc.data()))
}

export async function updateFacebookFulfillment(params: {
  id: string
  fulfillmentStatus: 'queued' | 'running' | 'done'
  adminNotes?: string
}): Promise<MarketplacePromotion | null> {
  const db = getAdminDb()
  const ref = db.collection(MARKETPLACE_PROMOTIONS_COLLECTION).doc(params.id)
  const snap = await ref.get()
  if (!snap.exists) return null

  const data = snap.data() || {}
  if (str(data.channel) !== 'facebook_ads') {
    throw new Error('Only Facebook ad orders support fulfillment updates')
  }

  const patch: Record<string, unknown> = {
    fulfillmentStatus: params.fulfillmentStatus,
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (params.adminNotes != null) patch.adminNotes = params.adminNotes
  if (params.fulfillmentStatus === 'done') {
    patch.status = 'fulfilled'
  } else if (str(data.status) === 'pending_payment') {
    // leave pending
  } else {
    patch.status = 'paid'
  }

  await ref.set(patch, { merge: true })
  const next = await ref.get()
  return parseMarketplacePromotion(next.id, next.data() || {})
}
