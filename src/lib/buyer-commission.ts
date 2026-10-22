/**
 * Buyer-paid commission for marketplace listings.
 * Same bands as the app (BuyerCommission): added on top of the seller's
 * price, never stored back onto the listing.
 */
export function buyerCommissionRate(providerPrice: number): number {
  if (providerPrice <= 0) return 0
  if (providerPrice <= 5000) return 0.1
  if (providerPrice <= 10000) return 0.09
  if (providerPrice <= 20000) return 0.08
  if (providerPrice <= 50000) return 0.07
  if (providerPrice <= 100000) return 0.06
  if (providerPrice <= 500000) return 0.05
  if (providerPrice <= 2000000) return 0.04
  if (providerPrice <= 10000000) return 0.033
  return 0.03
}

function money(value: number): number {
  return Math.round(value * 100) / 100
}

/** Malawi collections: 2.33% MMO + 1% PawaPay, taken from Vero commission. */
export const PAWAPAY_COLLECTION_FEE_RATE = 0.0333

export function pawapayProcessingFee(buyerTotal: number, commission: number): number {
  if (!(buyerTotal > 0) || !(commission > 0)) return 0
  const fee = money(buyerTotal * PAWAPAY_COLLECTION_FEE_RATE)
  if (!(fee > 0)) return 0
  return fee > commission ? commission : fee
}

/** Amount a customer sees: seller price plus commission. */
export function buyerFacingPrice(providerPrice: number): number {
  const price = money(providerPrice < 0 ? 0 : providerPrice)
  const commission = money(price * buyerCommissionRate(price))
  return money(price + commission)
}
