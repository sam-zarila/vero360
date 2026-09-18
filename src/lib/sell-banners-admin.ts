import 'server-only'

import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { unstable_noStore as noStore } from 'next/cache'
import { getAdminDb } from '@/lib/firebase-admin'
import type { SellBanner } from '@/lib/sell-banners'

export type { SellBanner } from '@/lib/sell-banners'

export const SELL_BANNERS_COLLECTION = 'sell_banners'

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return null
    }
  }
  return null
}

export function parseSellBanner(
  id: string,
  data: DocumentData | Record<string, unknown>,
): SellBanner {
  return {
    id,
    title: str(data.title) || 'Start selling on Vero360',
    body: str(data.body || data.subtitle || data.description),
    ctaLabel: str(data.ctaLabel) || 'Sell now',
    active: data.active !== false,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    createdByEmail: str(data.createdByEmail) || null,
  }
}

export async function listSellBanners(opts?: {
  activeOnly?: boolean
  limit?: number
}): Promise<SellBanner[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
  const snap = await getAdminDb()
    .collection(SELL_BANNERS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .limit(limit)
    .get()
    .catch(async () => {
      return getAdminDb().collection(SELL_BANNERS_COLLECTION).limit(limit).get()
    })

  let items = snap.docs.map(d => parseSellBanner(d.id, d.data() || {}))
  if (opts?.activeOnly) items = items.filter(i => i.active)
  items.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
  )
  return items
}

export async function listPublicSellBanners(limit = 8): Promise<SellBanner[]> {
  noStore()
  try {
    return await listSellBanners({ activeOnly: true, limit })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!/not configured|parse private key/i.test(message)) {
      console.warn('listPublicSellBanners:', message)
    }
    return []
  }
}

export async function createSellBanner(input: {
  title: string
  body?: string
  ctaLabel?: string
  active?: boolean
  sortOrder?: number
  createdByEmail?: string
}): Promise<SellBanner> {
  const title = str(input.title)
  if (!title) throw new Error('Title is required')

  const ref = getAdminDb().collection(SELL_BANNERS_COLLECTION).doc()
  const payload = {
    title,
    body: str(input.body),
    ctaLabel: str(input.ctaLabel) || 'Sell now',
    active: input.active !== false,
    sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : Date.now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdByEmail: str(input.createdByEmail) || null,
    source: 'admin_panel',
  }
  await ref.set(payload)
  const snap = await ref.get()
  return parseSellBanner(ref.id, snap.data() || payload)
}

export async function updateSellBanner(
  id: string,
  patch: Partial<{
    title: string
    body: string
    ctaLabel: string
    active: boolean
    sortOrder: number
  }>,
): Promise<SellBanner> {
  const ref = getAdminDb().collection(SELL_BANNERS_COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Sell banner not found')

  const next: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (patch.title !== undefined) {
    const title = str(patch.title)
    if (!title) throw new Error('Title is required')
    next.title = title
  }
  if (patch.body !== undefined) next.body = str(patch.body)
  if (patch.ctaLabel !== undefined) next.ctaLabel = str(patch.ctaLabel) || 'Sell now'
  if (patch.active !== undefined) next.active = !!patch.active
  if (patch.sortOrder !== undefined) next.sortOrder = Number(patch.sortOrder) || 0

  await ref.set(next, { merge: true })
  const fresh = await ref.get()
  return parseSellBanner(id, fresh.data() || {})
}

export async function deleteSellBanner(id: string): Promise<void> {
  await getAdminDb().collection(SELL_BANNERS_COLLECTION).doc(id).delete()
}
