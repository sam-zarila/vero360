import 'server-only'

import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  MARKETPLACE_PROMOTIONS_COLLECTION,
  isMarketplaceBoostLive,
  isPromotionPaid,
  type MarketplacePromotion,
  type MarketplacePromotionCounts,
  type FacebookFulfillmentStatus,
} from '@/lib/marketplace-promotions'

export const PLATFORM_WALLET_USER_ID = 'super_admin'
export const PLATFORM_WALLET_DOC_ID = 'super_admin'
export const PLATFORM_WALLET_NAME = 'Vero 360 Platform'
export const WALLETS_COLLECTION = 'wallets'
export const WALLET_TX_COLLECTION = 'wallet_transactions'

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
  const amountMwk = num(data.amountMwk ?? data.amount)

  return {
    id,
    itemId: str(data.itemId),
    itemName: str(data.itemName) || 'Marketplace item',
    itemImage: str(data.itemImage),
    merchantId: str(data.merchantId),
    merchantName: str(data.merchantName),
    vertical: str(data.vertical) || (str(data.channel).startsWith('food')
      ? 'food'
      : str(data.channel).startsWith('accommodation')
        ? 'accommodation'
        : 'marketplace'),
    planId: str(data.planId),
    channel,
    amountMwk,
    durationHours: num(data.durationHours) || 0,
    reachLabel: str(data.reachLabel),
    status: str(data.status) || 'pending_payment',
    fulfillmentStatus: fulfillment,
    adminNotes: str(data.adminNotes),
    txRef: str(data.txRef) || null,
    createdAt: tsToIso(data.createdAt),
    paidAt: tsToIso(data.paidAt),
    expiresAt: tsToIso(data.expiresAt),
    platformFeeCredited: data.platformFeeCredited === true,
    platformFeeTxId: str(data.platformFeeTxId) || null,
    platformFeeAmount: num(data.platformFeeAmount) || amountMwk,
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
  let feeCredited = 0
  let feePending = 0
  let revenuePaid = 0
  let revenueCredited = 0

  for (const p of items) {
    if (p.status === 'pending_payment') pendingPayment += 1
    if (String(p.channel || '').endsWith('_top')) {
      if (isMarketplaceBoostLive(p, now)) marketplaceActive += 1
      else if (p.status !== 'pending_payment') marketplaceExpired += 1
    } else if (p.channel === 'facebook_ads') {
      if (p.status === 'pending_payment') continue
      const f = (p.fulfillmentStatus || 'queued') as FacebookFulfillmentStatus
      if (f === 'done' || p.status === 'fulfilled') facebookDone += 1
      else if (f === 'running') facebookRunning += 1
      else facebookQueued += 1
    }

    if (p.amountMwk > 0 && isPromotionPaid(p)) {
      revenuePaid += p.amountMwk
    }
    if (p.platformFeeCredited) {
      feeCredited += 1
      revenueCredited += p.platformFeeAmount > 0 ? p.platformFeeAmount : p.amountMwk
    } else if (p.amountMwk > 0 && isPromotionPaid(p)) {
      feePending += 1
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
    feeCredited,
    feePending,
    revenuePaid,
    revenueCredited,
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

async function ensurePlatformWallet(): Promise<string> {
  const db = getAdminDb()
  const ref = db.collection(WALLETS_COLLECTION).doc(PLATFORM_WALLET_DOC_ID)
  const snap = await ref.get()
  if (snap.exists) return ref.id

  await ref.set({
    walletId: PLATFORM_WALLET_DOC_ID,
    userId: PLATFORM_WALLET_USER_ID,
    merchantName: PLATFORM_WALLET_NAME,
    balance: 0,
    pendingBalance: 0,
    transactions: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

/** Credit 100% of the promote package price to the platform wallet. */
export async function creditPromotionPlatformFee(promoId: string): Promise<{
  promo: MarketplacePromotion
  credited: boolean
  amount: number
  transactionId: string | null
  message: string
}> {
  const db = getAdminDb()
  const promoRef = db.collection(MARKETPLACE_PROMOTIONS_COLLECTION).doc(promoId.trim())

  return db.runTransaction(async tx => {
    const promoSnap = await tx.get(promoRef)
    if (!promoSnap.exists) throw new Error('Promotion not found')
    const data = promoSnap.data() || {}
    const promo = parseMarketplacePromotion(promoSnap.id, data)

    if (promo.platformFeeCredited) {
      return {
        promo,
        credited: false,
        amount: promo.amountMwk,
        transactionId: promo.platformFeeTxId,
        message: 'Full amount already credited for this promotion',
      }
    }

    const amount = promo.amountMwk
    if (amount <= 0) {
      throw new Error('Promotion has no paid package amount to credit')
    }

    if (!isPromotionPaid(promo)) {
      throw new Error('Promotion is still pending payment — amount not credited yet')
    }

    const walletRef = db.collection(WALLETS_COLLECTION).doc(PLATFORM_WALLET_DOC_ID)
    const walletSnap = await tx.get(walletRef)
    if (!walletSnap.exists) {
      tx.set(walletRef, {
        walletId: PLATFORM_WALLET_DOC_ID,
        userId: PLATFORM_WALLET_USER_ID,
        merchantName: PLATFORM_WALLET_NAME,
        balance: amount,
        pendingBalance: 0,
        transactions: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      const bal = num(walletSnap.data()?.balance)
      tx.update(walletRef, {
        balance: bal + amount,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    const transactionId = `TXN_PROMO_${promo.id}_${Date.now()}`
    const txRef = db.collection(WALLET_TX_COLLECTION).doc(transactionId)
    const description = `${promo.vertical} promote (full) · ${promo.itemName}`.slice(0, 180)
    const reference = promo.txRef || `marketplace_promo:${promo.id}`

    tx.set(txRef, {
      transactionId,
      walletId: PLATFORM_WALLET_DOC_ID,
      userId: PLATFORM_WALLET_USER_ID,
      type: 'service_fee',
      amount,
      status: 'completed',
      description,
      reference,
      source: 'marketplace_promotion',
      feeMode: 'full',
      promotionId: promo.id,
      vertical: promo.vertical,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    tx.set(
      promoRef,
      {
        platformFeeCredited: true,
        platformFeeTxId: transactionId,
        platformFeeCreditedAt: FieldValue.serverTimestamp(),
        platformFeeAmount: amount,
        platformFeeMode: 'full',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    return {
      promo: {
        ...promo,
        platformFeeCredited: true,
        platformFeeTxId: transactionId,
        platformFeeAmount: amount,
      },
      credited: true,
      amount,
      transactionId,
      message: `Credited full ${amount} MWK to platform wallet`,
    }
  })
}

/** Credit all paid promotions missing a platform wallet entry. */
export async function creditPendingPromotionPlatformFees(): Promise<{
  scanned: number
  credited: number
  skipped: number
  totalAmount: number
  results: Array<{ id: string; credited: boolean; amount: number; message: string }>
}> {
  await ensurePlatformWallet()
  const items = await listMarketplacePromotions(1000)
  const candidates = items.filter(
    p => !p.platformFeeCredited && p.amountMwk > 0 && isPromotionPaid(p),
  )

  const results: Array<{ id: string; credited: boolean; amount: number; message: string }> = []
  let credited = 0
  let skipped = 0
  let totalAmount = 0

  for (const p of candidates) {
    try {
      const res = await creditPromotionPlatformFee(p.id)
      results.push({
        id: p.id,
        credited: res.credited,
        amount: res.amount,
        message: res.message,
      })
      if (res.credited) {
        credited += 1
        totalAmount += res.amount
      } else {
        skipped += 1
      }
    } catch (err) {
      skipped += 1
      results.push({
        id: p.id,
        credited: false,
        amount: p.amountMwk,
        message: err instanceof Error ? err.message : 'Credit failed',
      })
    }
  }

  return {
    scanned: candidates.length,
    credited,
    skipped,
    totalAmount,
    results,
  }
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
