import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'

export const PROMOTIONS_CONFIG_DOC = 'app_config/promotions'

export type PromotionsConfig = {
  /** MWK price chips merchants pick when posting a promotion. */
  pricePresetsMwk: number[]
  /** When true, merchants can still type a custom MWK amount. */
  allowCustomPrice: boolean
  updatedAt?: string | null
  updatedByEmail?: string | null
}

export const DEFAULT_PROMOTIONS_CONFIG: PromotionsConfig = {
  pricePresetsMwk: [3000, 5000, 8000, 10000, 15000, 20000],
  allowCustomPrice: true,
  updatedAt: null,
  updatedByEmail: null,
}

function asPositiveInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function normalizePresets(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PROMOTIONS_CONFIG.pricePresetsMwk]
  const out: number[] = []
  const seen = new Set<number>()
  for (const item of raw) {
    const n = asPositiveInt(item)
    if (n == null || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  out.sort((a, b) => a - b)
  return out.length > 0 ? out : [...DEFAULT_PROMOTIONS_CONFIG.pricePresetsMwk]
}

export function normalizePromotionsConfig(
  raw: Partial<PromotionsConfig> | Record<string, unknown> | null | undefined,
): PromotionsConfig {
  const src = (raw || {}) as Record<string, unknown>
  return {
    pricePresetsMwk: normalizePresets(src.pricePresetsMwk),
    allowCustomPrice: src.allowCustomPrice !== false,
    updatedAt:
      typeof src.updatedAt === 'string'
        ? src.updatedAt
        : src.updatedAt != null
          ? String(src.updatedAt)
          : null,
    updatedByEmail:
      typeof src.updatedByEmail === 'string' ? src.updatedByEmail : null,
  }
}

export async function getPromotionsConfig(): Promise<PromotionsConfig> {
  const db = getAdminDb()
  const snap = await db.doc(PROMOTIONS_CONFIG_DOC).get()
  if (!snap.exists) return { ...DEFAULT_PROMOTIONS_CONFIG }
  return normalizePromotionsConfig(snap.data() as Record<string, unknown>)
}

export async function savePromotionsConfig(input: {
  pricePresetsMwk: number[]
  allowCustomPrice?: boolean
  updatedByEmail?: string | null
}): Promise<PromotionsConfig> {
  const config = normalizePromotionsConfig({
    pricePresetsMwk: input.pricePresetsMwk,
    allowCustomPrice: input.allowCustomPrice !== false,
    updatedByEmail: input.updatedByEmail ?? null,
  })

  const db = getAdminDb()
  await db.doc(PROMOTIONS_CONFIG_DOC).set(
    {
      pricePresetsMwk: config.pricePresetsMwk,
      allowCustomPrice: config.allowCustomPrice,
      updatedByEmail: config.updatedByEmail,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return getPromotionsConfig()
}
