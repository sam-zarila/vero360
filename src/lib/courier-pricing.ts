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
  weightKg: number | null
  weightRequired: boolean
  summary: string
}

const BASE_MWK = 1800
const PER_KM_MWK = 500
const MIN_CHARGE_KM = 1.5
/** First kilos included in the goods surcharge. */
const FREE_WEIGHT_KG = 5
const PER_KG_ABOVE_FREE_MWK = 250

/** Goods types where weight must be entered before booking. */
export const COURIER_WEIGHT_REQUIRED_TYPES: readonly string[] = [
  'Electronics',
  'Groceries',
  'Fragile item',
  'Other',
]

export function courierWeightRequired(goodsType: string): boolean {
  const t = goodsType.trim().toLowerCase()
  return COURIER_WEIGHT_REQUIRED_TYPES.some(x => x.toLowerCase() === t)
}

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

function weightSurchargeMwk(weightKg: number | null | undefined): number {
  const w = Number(weightKg)
  if (!Number.isFinite(w) || w <= 0) return 0
  const extra = Math.max(0, w - FREE_WEIGHT_KG)
  return Math.round(extra * PER_KG_ABOVE_FREE_MWK)
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

export function parseCourierWeightKg(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 10) / 10
}

export function assertCourierWeight(opts: {
  goodsType: string
  weightKg?: unknown
}): number | null {
  const required = courierWeightRequired(opts.goodsType)
  const weightKg = parseCourierWeightKg(opts.weightKg)
  if (required && (weightKg == null || weightKg <= 0)) {
    throw new Error(`Enter the parcel weight (kg) for ${opts.goodsType}.`)
  }
  if (weightKg != null && weightKg > 80) {
    throw new Error('Weight must be 80 kg or less for Vero Courier.')
  }
  return weightKg
}

export function estimateCourierPrice(opts: {
  distanceKm?: number
  goodsType?: string
  description?: string
  etaMinutes?: number
  weightKg?: number | null
}): CourierPriceQuote {
  const rawKm = Number(opts.distanceKm)
  const km = Number.isFinite(rawKm) && rawKm > 0 ? rawKm : MIN_CHARGE_KM
  const billedKm = Math.max(km, MIN_CHARGE_KM)
  const type = (opts.goodsType || 'Other').trim() || 'Other'
  const desc = (opts.description || '').trim()
  const weightRequired = courierWeightRequired(type)
  const weightKg = parseCourierWeightKg(opts.weightKg)

  let amount = BASE_MWK + billedKm * PER_KM_MWK
  amount += goodsSurchargeMwk(type)
  amount += weightSurchargeMwk(weightKg)
  amount *= descriptionMultiplier(desc)

  const rounded = roundToFifty(Math.round(amount))
  const eta =
    opts.etaMinutes ?? Math.max(15, Math.round((km / 22) * 60) + 8)

  const weightBit =
    weightKg != null && weightKg > 0 ? ` · ${weightKg} kg` : weightRequired ? ' · weight needed' : ''

  return {
    distanceKm: Math.round(km * 10) / 10,
    etaMinutes: eta,
    amountMwk: rounded,
    goodsType: type,
    weightKg,
    weightRequired,
    summary: `About MWK ${fmt(rounded)} · ${km.toFixed(1)} km · ~${eta} min${weightBit}`,
  }
}

export function isLilongweCity(value: string): boolean {
  const t = value.trim().toLowerCase()
  return t === 'lilongwe' || t === 'll' || t.includes('lilongwe')
}
