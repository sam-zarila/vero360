import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'

export const PROMOTE_PACKAGES_CONFIG_DOC = 'app_config/promote_packages'

export type PromotePackageConfig = {
  /** Stable key used by the app (top_24h, top_7d, fb_3d_local, fb_7d_wider). */
  key: string
  label: string
  subtitle?: string
  /** feed_top | facebook_ads */
  kind: 'feed_top' | 'facebook_ads'
  priceMwk: number
  durationHours: number
  reachLabel?: string
  active?: boolean
}

export type PromotePackagesConfig = {
  packages: PromotePackageConfig[]
  updatedAt?: string | null
  updatedByEmail?: string | null
}

export const DEFAULT_PROMOTE_PACKAGES_CONFIG: PromotePackagesConfig = {
  packages: [
    {
      key: 'top_24h',
      label: '24 hours on top',
      subtitle: 'Stay at the top of the feed for 24 hours',
      kind: 'feed_top',
      priceMwk: 2000,
      durationHours: 24,
      active: true,
    },
    {
      key: 'top_7d',
      label: '1 week on top',
      subtitle: 'Stay at the top of the feed for 7 days',
      kind: 'feed_top',
      priceMwk: 5000,
      durationHours: 168,
      active: true,
    },
    {
      key: 'fb_3d_local',
      label: 'Facebook ads · 3 days',
      subtitle: 'Local reach · Vero360 runs the campaign for you',
      kind: 'facebook_ads',
      priceMwk: 7500,
      durationHours: 72,
      reachLabel: 'Local · ~1k–5k people',
      active: true,
    },
    {
      key: 'fb_7d_wider',
      label: 'Facebook ads · 7 days',
      subtitle: 'Wider reach · Vero360 runs the campaign for you',
      kind: 'facebook_ads',
      priceMwk: 15000,
      durationHours: 168,
      reachLabel: 'Wider · ~5k–15k people',
      active: true,
    },
  ],
  updatedAt: null,
  updatedByEmail: null,
}

function asPositiveInt(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.round(n)
}

function normalizePackage(
  raw: Record<string, unknown>,
  fallback: PromotePackageConfig,
): PromotePackageConfig {
  const kindRaw = String(raw.kind || fallback.kind).trim()
  const kind = kindRaw === 'facebook_ads' ? 'facebook_ads' : 'feed_top'
  const subtitle =
    String(raw.subtitle ?? fallback.subtitle ?? '').trim() || undefined
  const reachLabel =
    String(raw.reachLabel ?? fallback.reachLabel ?? '').trim() || undefined
  return {
    key: String(raw.key || fallback.key).trim() || fallback.key,
    label: String(raw.label || fallback.label).trim() || fallback.label,
    ...(subtitle ? { subtitle } : {}),
    kind,
    priceMwk: asPositiveInt(raw.priceMwk, fallback.priceMwk),
    durationHours: Math.max(1, asPositiveInt(raw.durationHours, fallback.durationHours)),
    ...(reachLabel ? { reachLabel } : {}),
    active: raw.active !== false,
  }
}

/** Firestore rejects `undefined` field values. */
function packageForFirestore(p: PromotePackageConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {
    key: p.key,
    label: p.label,
    kind: p.kind === 'facebook_ads' ? 'facebook_ads' : 'feed_top',
    priceMwk: Math.max(0, Math.round(Number(p.priceMwk) || 0)),
    durationHours: Math.max(1, Math.round(Number(p.durationHours) || 1)),
    active: p.active !== false,
  }
  const subtitle = (p.subtitle || '').trim()
  if (subtitle) out.subtitle = subtitle
  const reachLabel = (p.reachLabel || '').trim()
  if (reachLabel) out.reachLabel = reachLabel
  return out
}

export function normalizePromotePackagesConfig(
  raw: Partial<PromotePackagesConfig> | Record<string, unknown> | null | undefined,
): PromotePackagesConfig {
  const src = (raw || {}) as Record<string, unknown>
  const defaultsByKey = new Map(
    DEFAULT_PROMOTE_PACKAGES_CONFIG.packages.map(p => [p.key, p]),
  )
  const out: PromotePackageConfig[] = []
  const seen = new Set<string>()

  if (Array.isArray(src.packages)) {
    for (const item of src.packages) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const key = String(row.key || '').trim()
      const fallback = defaultsByKey.get(key) || DEFAULT_PROMOTE_PACKAGES_CONFIG.packages[0]
      const normalized = normalizePackage(row, fallback)
      if (!normalized.key || seen.has(normalized.key)) continue
      seen.add(normalized.key)
      out.push(normalized)
    }
  }

  // Keep known defaults if admin removed them accidentally.
  for (const def of DEFAULT_PROMOTE_PACKAGES_CONFIG.packages) {
    if (!seen.has(def.key)) out.push({ ...def })
  }

  return {
    packages: out,
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

export async function getPromotePackagesConfig(): Promise<PromotePackagesConfig> {
  const db = getAdminDb()
  const snap = await db.doc(PROMOTE_PACKAGES_CONFIG_DOC).get()
  if (!snap.exists) return { ...DEFAULT_PROMOTE_PACKAGES_CONFIG, packages: [...DEFAULT_PROMOTE_PACKAGES_CONFIG.packages] }
  return normalizePromotePackagesConfig(snap.data() as Record<string, unknown>)
}

export async function savePromotePackagesConfig(input: {
  packages: PromotePackageConfig[]
  updatedByEmail?: string | null
}): Promise<PromotePackagesConfig> {
  const config = normalizePromotePackagesConfig({
    packages: input.packages,
    updatedByEmail: input.updatedByEmail ?? null,
  })

  const db = getAdminDb()
  await db.doc(PROMOTE_PACKAGES_CONFIG_DOC).set(
    {
      packages: config.packages.map(packageForFirestore),
      updatedByEmail: (config.updatedByEmail || '').trim() || null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return getPromotePackagesConfig()
}
