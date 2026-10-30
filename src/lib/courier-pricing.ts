/** Same-city Vero Courier quote (matches the Flutter Lilongwe launch pricing). */

export const COURIER_CITY = 'Lilongwe'

export const COURIER_GOODS_TYPES = [
  'Documents',
  'Electronics',
  'Groceries',
  'Food',
  'Fragile item',
  'Clothes',
  'Other',
] as const

export type CourierGoodsType = (typeof COURIER_GOODS_TYPES)[number]

export type CourierPriceQuote = {
  distanceKm: number
  etaMinutes: number
  amountMwk: number
  goodsType: string
  summary: string
}

const BASE_MWK = 1800
const PER_KM_MWK = 500
const MIN_CHARGE_KM = 1.5

function goodsSurchargeMwk(type: string): number {
  switch (type.toLowerCase().trim()) {
    case 'documents':
      return 1000
    case 'electronics':
      return 2000
    case 'groceries':
      return 2000
    case 'food':
      return 1500
    case 'fragile item':
    case 'fragile':
      return 3500
    case 'clothes':
      return 500
    case 'other':
    default:
      return 500
  }
}

function descriptionMultiplier(text: string): number {
  const t = text.toLowerCase()
  let m = 1
  if (/\b(fragile|glass|breakable|ceramic)\b/.test(t)) m += 0.08
  if (/\b(heavy|bulky|furniture|fridge|mattress)\b/.test(t)) m += 0.12
  if (/\b(urgent|express|asap|same[- ]?day)\b/.test(t)) m += 0.08
  if (/\b(envelope|letter|small|light)\b/.test(t)) m -= 0.06
  return m < 0.92 ? 0.92 : m
}

function roundToFifty(n: number): number {
  if (n < 1000) return 1000
  return Math.round(n / 50) * 50
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-MW')
}

export function estimateCourierPrice(opts: {
  distanceKm?: number
  goodsType?: string
  description?: string
  etaMinutes?: number
}): CourierPriceQuote {
  const rawKm = Number(opts.distanceKm)
  const km = Number.isFinite(rawKm) && rawKm > 0 ? rawKm : MIN_CHARGE_KM
  const billedKm = Math.max(km, MIN_CHARGE_KM)
  const type = (opts.goodsType || 'Other').trim() || 'Other'
  const desc = (opts.description || '').trim()

  let amount = BASE_MWK + billedKm * PER_KM_MWK
  amount += goodsSurchargeMwk(type)
  amount *= descriptionMultiplier(desc)

  const rounded = roundToFifty(Math.round(amount))
  const eta =
    opts.etaMinutes ?? Math.max(15, Math.round((km / 22) * 60) + 8)

  return {
    distanceKm: km,
    etaMinutes: eta,
    amountMwk: rounded,
    goodsType: type,
    summary: `About MWK ${fmt(rounded)} · ${km.toFixed(1)} km · ~${eta} min`,
  }
}

export function isLilongweCity(value: string): boolean {
  const t = value.trim().toLowerCase()
  return t === 'lilongwe' || t === 'll' || t.includes('lilongwe')
}
