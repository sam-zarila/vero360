import 'server-only'

import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'

export const HOMEPAGE_CRAWLS_COLLECTION = 'homepage_crawls'

export type HomepageCrawlItem = {
  id: string
  title: string
  subtitle: string
  /** promotions | announcements | marketplace | app_update | none */
  linkType: string
  linkId: string
  /** Target app version for linkType=app_update (e.g. 1.2.0). */
  latestVersion: string
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
    latestVersion: str(data.latestVersion || data.version || data.linkId),
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
      return getAdminDb()
        .collection(HOMEPAGE_CRAWLS_COLLECTION)
        .limit(limit)
        .get()
    })

  let items = snap.docs.map(d => parseHomepageCrawl(d.id, d.data() || {}))
  if (opts?.activeOnly) items = items.filter(i => i.active)
  items.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
  return items
}

/** Only one active app_update notice at a time. */
async function deactivateOtherAppUpdates(exceptId?: string) {
  const snap = await getAdminDb()
    .collection(HOMEPAGE_CRAWLS_COLLECTION)
    .where('linkType', '==', 'app_update')
    .get()
    .catch(async () => {
      const all = await getAdminDb().collection(HOMEPAGE_CRAWLS_COLLECTION).get()
      return {
        docs: all.docs.filter(d => str(d.data()?.linkType) === 'app_update'),
      }
    })

  const batch = getAdminDb().batch()
  let n = 0
  for (const d of snap.docs) {
    if (exceptId && d.id === exceptId) continue
    if (d.data()?.active === false) continue
    batch.set(
      d.ref,
      { active: false, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    n += 1
  }
  if (n > 0) await batch.commit()
}

export async function createHomepageCrawl(input: {
  title: string
  subtitle?: string
  linkType?: string
  linkId?: string
  latestVersion?: string
  active?: boolean
  sortOrder?: number
  createdByEmail?: string
}): Promise<HomepageCrawlItem> {
  const title = str(input.title)
  if (!title) throw new Error('Title is required')

  const linkType = str(input.linkType) || 'none'
  const latestVersion = str(input.latestVersion || input.linkId)
  if (linkType === 'app_update' && !latestVersion) {
    throw new Error('Latest version is required for an app update notice')
  }

  if (linkType === 'app_update' && input.active !== false) {
    await deactivateOtherAppUpdates()
  }

  const ref = getAdminDb().collection(HOMEPAGE_CRAWLS_COLLECTION).doc()
  const payload = {
    title,
    subtitle: str(input.subtitle),
    linkType,
    linkId: linkType === 'app_update' ? latestVersion : str(input.linkId),
    latestVersion: linkType === 'app_update' ? latestVersion : '',
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
    latestVersion: string
    active: boolean
    sortOrder: number
  }>,
): Promise<HomepageCrawlItem> {
  const ref = getAdminDb().collection(HOMEPAGE_CRAWLS_COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Crawl item not found')

  const current = parseHomepageCrawl(id, snap.data() || {})
  const nextLinkType =
    patch.linkType !== undefined ? str(patch.linkType) || 'none' : current.linkType
  const nextVersion =
    patch.latestVersion !== undefined
      ? str(patch.latestVersion)
      : patch.linkId !== undefined && nextLinkType === 'app_update'
        ? str(patch.linkId)
        : current.latestVersion

  if (nextLinkType === 'app_update' && !nextVersion) {
    throw new Error('Latest version is required for an app update notice')
  }

  const becomingActive =
    patch.active === true || (patch.active === undefined && current.active)
  if (nextLinkType === 'app_update' && becomingActive) {
    await deactivateOtherAppUpdates(id)
  }

  const next: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  }
  if (patch.title !== undefined) next.title = str(patch.title)
  if (patch.subtitle !== undefined) next.subtitle = str(patch.subtitle)
  if (patch.linkType !== undefined) next.linkType = nextLinkType
  if (patch.linkId !== undefined || nextLinkType === 'app_update') {
    next.linkId = nextLinkType === 'app_update' ? nextVersion : str(patch.linkId)
  }
  if (patch.latestVersion !== undefined || nextLinkType === 'app_update') {
    next.latestVersion = nextLinkType === 'app_update' ? nextVersion : ''
  }
  if (patch.active !== undefined) next.active = !!patch.active
  if (patch.sortOrder !== undefined) next.sortOrder = Number(patch.sortOrder) || 0

  await ref.set(next, { merge: true })
  const fresh = await ref.get()
  return parseHomepageCrawl(id, fresh.data() || {})
}

export async function deleteHomepageCrawl(id: string): Promise<void> {
  await getAdminDb().collection(HOMEPAGE_CRAWLS_COLLECTION).doc(id).delete()
}
