import type { WalletTxRow } from '@/lib/finance'

/**
 * Malawi published Standard-plan rates (PawaPay 1% + MMO pass-through).
 * https://www.pawapay.io/fees
 *
 * Collections: 3.33% (2.33% MMO + 1% PawaPay)
 * Disbursements: Airtel 2.7625% / TNM 2.75% (MMO + 1% PawaPay)
 */
export const PAWAPAY_COLLECTION_FEE_RATE = 0.0333
export const PAWAPAY_PAYOUT_FEE_RATE_TNM = 0.0275
export const PAWAPAY_PAYOUT_FEE_RATE_AIRTEL = 0.027625

const PAWAPAY_COLLECTION_SERVICES = new Set(['digital', 'promotions', 'homepage_ads'])

export function pawapayPayoutFeeRate(provider?: string | null): number {
  const p = (provider || '').toUpperCase()
  if (p.includes('AIRTEL')) return PAWAPAY_PAYOUT_FEE_RATE_AIRTEL
  return PAWAPAY_PAYOUT_FEE_RATE_TNM
}

export function pawapayFeeMwk(amount: number, rate: number): number {
  if (!(amount > 0) || !(rate > 0)) return 0
  return Math.round(amount * rate)
}

export function pawapayCollectionFeeMwk(amount: number): number {
  return pawapayFeeMwk(amount, PAWAPAY_COLLECTION_FEE_RATE)
}

export function pawapayPayoutFeeMwk(amount: number, provider?: string | null): number {
  return pawapayFeeMwk(amount, pawapayPayoutFeeRate(provider))
}

export function pawapayCollectionFeePercentLabel(): string {
  return '3.33%'
}

export function pawapayPayoutFeePercentLabel(provider?: string | null): string {
  const rate = pawapayPayoutFeeRate(provider)
  const pct = Math.round(rate * 10000) / 100
  return Number.isInteger(pct) ? `${pct}%` : `${pct}%`
}

function looksPawaPay(text: string): boolean {
  return text.toLowerCase().includes('pawapay')
}

export function isPawaPayPayoutTx(
  t: Pick<WalletTxRow, 'payoutProvider' | 'payoutMethod' | 'description' | 'type' | 'userId'>,
): boolean {
  const type = t.type.toLowerCase()
  if (type !== 'payout' && type !== 'cashout' && type !== 'cash_out' && type !== 'withdrawal') {
    return false
  }
  if (String(t.payoutProvider || '').toLowerCase() === 'pawapay') return true
  if (looksPawaPay(t.description || '')) return true
  return (
    String(t.userId || '') === 'super_admin' &&
    String(t.payoutMethod || '').toLowerCase() === 'mobile_money'
  )
}

export function isPawaPayCollectionTx(
  t: Pick<WalletTxRow, 'type' | 'service' | 'description'>,
): boolean {
  if (t.type.toLowerCase() !== 'service_fee' && t.type.toLowerCase() !== 'fee') return false
  if (PAWAPAY_COLLECTION_SERVICES.has(t.service)) return true
  return looksPawaPay(t.description || '')
}

function txCountsTowardFees(t: Pick<WalletTxRow, 'status'>): boolean {
  const status = t.status.toLowerCase()
  return status !== 'failed' && status !== 'cancelled'
}

export function resolvedPawaPayPayoutFee(t: WalletTxRow): number {
  if (typeof t.fee === 'number' && t.fee > 0) return Math.round(t.fee)
  return pawapayPayoutFeeMwk(t.amount, t.payoutProvider)
}

export type PawaPayFeeSummary = {
  payoutFees: number
  payoutVolume: number
  payoutCount: number
  collectionFees: number
  collectionVolume: number
  collectionCount: number
  totalFees: number
}

export function summarizePawaPayFees(txs: WalletTxRow[]): PawaPayFeeSummary {
  let payoutFees = 0
  let payoutVolume = 0
  let payoutCount = 0
  let collectionFees = 0
  let collectionVolume = 0
  let collectionCount = 0

  for (const t of txs) {
    if (!txCountsTowardFees(t)) continue
    if (isPawaPayPayoutTx(t)) {
      payoutFees += resolvedPawaPayPayoutFee(t)
      payoutVolume += t.amount
      payoutCount += 1
      continue
    }
    if (isPawaPayCollectionTx(t)) {
      collectionFees += pawapayCollectionFeeMwk(t.amount)
      collectionVolume += t.amount
      collectionCount += 1
    }
  }

  return {
    payoutFees,
    payoutVolume,
    payoutCount,
    collectionFees,
    collectionVolume,
    collectionCount,
    totalFees: payoutFees + collectionFees,
  }
}
