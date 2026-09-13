/** Shared marketplace promotion types (Firestore `marketplace_promotions`). */

export const MARKETPLACE_PROMOTIONS_COLLECTION = 'marketplace_promotions'

export type MarketplacePromotionChannel = 'marketplace_top' | 'facebook_ads' | string

export type MarketplacePromotionStatus =
  | 'pending_payment'
  | 'paid'
  | 'active'
  | 'fulfilled'
  | 'expired'
  | string

export type FacebookFulfillmentStatus = 'queued' | 'running' | 'done' | string

export type MarketplacePromotion = {
  id: string
  itemId: string
  itemName: string
  itemImage: string
  merchantId: string
  merchantName: string
  /** marketplace | food | accommodation */
  vertical: string
  planId: string
  channel: MarketplacePromotionChannel
  amountMwk: number
  durationHours: number
  reachLabel: string
  status: MarketplacePromotionStatus
  fulfillmentStatus: FacebookFulfillmentStatus | null
  adminNotes: string
  txRef: string | null
  createdAt: string | null
  paidAt: string | null
  expiresAt: string | null
  platformFeeCredited: boolean
  platformFeeTxId: string | null
  platformFeeAmount: number
}

export type MarketplacePromotionCounts = {
  all: number
  marketplaceActive: number
  marketplaceExpired: number
  facebookQueued: number
  facebookRunning: number
  facebookDone: number
  pendingPayment: number
  feeCredited: number
  feePending: number
  revenuePaid: number
  revenueCredited: number
}

export function isPromotionPaid(promo: MarketplacePromotion): boolean {
  if (promo.status === 'pending_payment') return false
  if (promo.paidAt) return true
  return (
    promo.status === 'paid' ||
    promo.status === 'active' ||
    promo.status === 'fulfilled' ||
    promo.status === 'expired'
  )
}

export function isMarketplaceBoostLive(promo: MarketplacePromotion, now = Date.now()): boolean {
  if (!String(promo.channel || '').endsWith('_top')) return false
  if (promo.status === 'expired') return false
  if (promo.status !== 'active' && promo.status !== 'paid') return false
  if (!promo.expiresAt) return promo.status === 'active'
  const t = new Date(promo.expiresAt).getTime()
  return Number.isFinite(t) && t > now
}

export function planLabel(planId: string): string {
  switch (planId) {
    case 'mp_24h':
      return '24h marketplace top'
    case 'mp_7d':
      return '1 week marketplace top'
    case 'food_24h':
      return '24h food top'
    case 'food_7d':
      return '1 week food top'
    case 'stay_24h':
      return '24h stay top'
    case 'stay_7d':
      return '1 week stay top'
    case 'fb_3d_local':
      return 'Facebook · 3 days local'
    case 'fb_7d_wider':
      return 'Facebook · 7 days wider'
    default:
      return planId || '—'
  }
}

export function verticalLabel(vertical: string): string {
  switch ((vertical || '').toLowerCase()) {
    case 'food':
      return 'Food'
    case 'accommodation':
    case 'stay':
      return 'Stay'
    default:
      return 'Marketplace'
  }
}
