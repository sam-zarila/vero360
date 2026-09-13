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
}

export type MarketplacePromotionCounts = {
  all: number
  marketplaceActive: number
  marketplaceExpired: number
  facebookQueued: number
  facebookRunning: number
  facebookDone: number
  pendingPayment: number
}

export function isMarketplaceBoostLive(promo: MarketplacePromotion, now = Date.now()): boolean {
  if (promo.channel !== 'marketplace_top') return false
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
    case 'fb_3d_local':
      return 'Facebook · 3 days local'
    case 'fb_7d_wider':
      return 'Facebook · 7 days wider'
    default:
      return planId || '—'
  }
}
