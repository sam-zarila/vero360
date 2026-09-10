import 'server-only'

import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'

export const HOMEPAGE_CRAWLS_COLLECTION = 'homepage_crawls'

export type HomepageCrawlItem = {
  id: string
  title: string
  subtitle: string
  /** Optional deep-link hint for the app: promotions | announcements | marketplace | none */
  linkType: string
  linkId: string
  active: boolean
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
  createdByEmail: string | null
}

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

export function parseHomepageCrawl(
  id: string,
  data: DocumentData | Record<string, unknown>,
): HomepageCrawlItem {
  return {
    id,
    title: str(data.title) || 'Vero360',
    subtitle: str(data.subtitle || data.body || data.description),
    linkType: str(data.linkType || 'none') || 'none',
    linkId: str(data.linkId),
    active: data.active !== false,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    createdByEmail: str(data.createdByEmail) || null,
  }
}

export async function listHomepageCrawls(opts?: {
  activeOnly?: boolean
  limit?: number
}): Promise<HomepageCrawlItem[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
  const snap = await getAdminDb()
    .collection(HOMEPAGE_CRAWLS_COLLECTION)
    .orderBy('sortOrder', 'asc')
    .limit(limit)
    .get()
    .catch(async () => {
      // Fallback if sortOrder index missing.
      return getAdminDb()
        .collection(HOMEPAGE_CRAWLS_COLLECTION)
        .limit(limit)
        .get()
    })

  let items = snap.docs.map((d) => parseHomepageCrawl(d.id, d.data() || {}))
  if (opts?.activeOnly) items = items.filter((i) => i.active)
  items.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
  return items
}

export async function createHomepageCrawl(input: {
  title: string
  subtitle?: string
  linkType?: string
  linkId?: string
  active?: boolean
  sortOrder?: number
  createdByEmail?: string
}): Promise<HomepageCrawlItem> {
  const title = str(input.title)
  if (!title) throw new Error('Title is required')

  const ref = getAdminDb().collection(HOMEPAGE_CRAWLS_COLLECTION).doc()
  const payload = {
    title,
    subtitle: str(input.subtitle),
    linkType: str(input.linkType) || 'none',
    linkId: str(input.linkId),
    active: input.active !== false,
    sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : Date.now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdByEmail: str(input.createdByEmail) || null,
    source: 'admin_panel',
  }
  await ref.set(payload)
  const snap = await ref.get()
  return parseHomepageCrawl(ref.id, snap.data() || payload)
}

export async function updateHomepageCrawl(
  id: string,
  patch: Partial<{
    title: string
    subtitle: string
    linkType: string
    linkId: string
    active: boolean
    sortOrder: number
  }>,
): Promise<HomepageCrawlItem> {
  const ref = getAdminDb().collection(HOMEPAGE_CRAWLS_COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Crawl item not found')

  const next: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (patch.title !== undefined) next.title = str(patch.title)
  if (patch.subtitle !== undefined) next.subtitle = str(patch.subtitle)
  if (patch.linkType !== undefined) next.linkType = str(patch.linkType) || 'none'
  if (patch.linkId !== undefined) next.linkId = str(patch.linkId)
  if (patch.active !== undefined) next.active = !!patch.active
  if (patch.sortOrder !== undefined) next.sortOrder = Number(patch.sortOrder) || 0

  await ref.set(next, { merge: true })
  const fresh = await ref.get()
  return parseHomepageCrawl(id, fresh.data() || {})
}

export async function deleteHomepageCrawl(id: string): Promise<void> {
  await getAdminDb().collection(HOMEPAGE_CRAWLS_COLLECTION).doc(id).delete()
}
