import 'server-only'

import { unstable_noStore as noStore } from 'next/cache'
import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import type { Tender, TenderInput, TenderSource } from '@/lib/tenders'

export const TENDERS_COLLECTION = 'site_tenders'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function tsToIso(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString()
      } catch {
        return null
      }
    }
    const seconds =
      (value as { _seconds?: number; seconds?: number })._seconds ??
      (value as { seconds?: number }).seconds
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString()
  }
  return null
}

export function parseTender(id: string, data: DocumentData | Record<string, unknown>): Tender {
  return {
    id,
    title: str(data.title) || 'Tender',
    description: str(data.description),
    buyer: str(data.buyer) || null,
    reference: str(data.reference) || null,
    location: str(data.location) || null,
    publishedAt: tsToIso(data.publishedAt),
    closingAt: tsToIso(data.closingAt),
    tenderUrl: str(data.tenderUrl),
    documentUrl: str(data.documentUrl) || null,
    source: (str(data.source) || 'manual') as TenderSource,
    externalId: str(data.externalId) || id,
    active: data.active !== false,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    syncedAt: tsToIso(data.syncedAt),
  }
}

export async function listTenders(opts?: {
  activeOnly?: boolean
  source?: string
  limit?: number
}): Promise<Tender[]> {
  noStore()
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 500)
  const snap = await getAdminDb()
    .collection(TENDERS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()

  let items = snap.docs.map(doc => parseTender(doc.id, doc.data()))
  if (opts?.activeOnly) items = items.filter(t => t.active)
  if (opts?.source) {
    const src = opts.source.toLowerCase()
    items = items.filter(t => String(t.source).toLowerCase() === src)
  }
  return items
}

export async function getTender(id: string): Promise<Tender | null> {
  noStore()
  const doc = await getAdminDb().collection(TENDERS_COLLECTION).doc(id).get()
  if (!doc.exists) return null
  return parseTender(doc.id, doc.data() || {})
}

export async function createTender(input: TenderInput): Promise<Tender> {
  const title = str(input.title)
  const tenderUrl = str(input.tenderUrl)
  if (!title) throw Object.assign(new Error('Title is required'), { status: 400 })
  if (!tenderUrl) throw Object.assign(new Error('Tender link is required'), { status: 400 })

  const externalId = str(input.externalId) || `manual-${Date.now()}`
  const source = (str(input.source) || 'manual') as TenderSource
  const now = FieldValue.serverTimestamp()
  const payload = {
    title,
    description: str(input.description),
    buyer: str(input.buyer) || null,
    reference: str(input.reference) || null,
    location: str(input.location) || 'Malawi',
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
    closingAt: input.closingAt ? new Date(input.closingAt) : null,
    tenderUrl,
    documentUrl: str(input.documentUrl) || null,
    source,
    externalId,
    active: input.active !== false,
    createdAt: now,
    updatedAt: now,
    syncedAt: source === 'manual' ? null : now,
  }

  const ref = await getAdminDb().collection(TENDERS_COLLECTION).add(payload)
  const created = await getTender(ref.id)
  if (!created) throw new Error('Tender missing after create')
  return created
}

export async function upsertSyncedTender(
  input: TenderInput & {
    externalId: string
    source: TenderSource
  },
): Promise<'created' | 'updated' | 'skipped'> {
  const externalId = str(input.externalId)
  const source = str(input.source) as TenderSource
  if (!externalId || !source) return 'skipped'

  const db = getAdminDb()
  const existing = await db
    .collection(TENDERS_COLLECTION)
    .where('externalId', '==', externalId)
    .limit(1)
    .get()

  const title = str(input.title)
  const tenderUrl = str(input.tenderUrl)
  if (!title || !tenderUrl) return 'skipped'

  const now = FieldValue.serverTimestamp()
  const payload = {
    title,
    description: str(input.description),
    buyer: str(input.buyer) || null,
    reference: str(input.reference) || null,
    location: str(input.location) || 'Malawi',
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
    closingAt: input.closingAt ? new Date(input.closingAt) : null,
    tenderUrl,
    documentUrl: str(input.documentUrl) || null,
    source,
    externalId,
    active: true,
    updatedAt: now,
    syncedAt: now,
  }

  if (!existing.empty) {
    await existing.docs[0].ref.set(payload, { merge: true })
    return 'updated'
  }

  await db.collection(TENDERS_COLLECTION).add({
    ...payload,
    createdAt: now,
  })
  return 'created'
}

export async function updateTender(
  id: string,
  patch: Partial<TenderInput>,
): Promise<Tender> {
  const existing = await getTender(id)
  if (!existing) throw Object.assign(new Error('Tender not found'), { status: 404 })

  const data: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  if (patch.title !== undefined) {
    const title = str(patch.title)
    if (!title) throw Object.assign(new Error('Title is required'), { status: 400 })
    data.title = title
  }
  if (patch.description !== undefined) data.description = str(patch.description)
  if (patch.buyer !== undefined) data.buyer = str(patch.buyer) || null
  if (patch.reference !== undefined) data.reference = str(patch.reference) || null
  if (patch.location !== undefined) data.location = str(patch.location) || null
  if (patch.tenderUrl !== undefined) {
    const url = str(patch.tenderUrl)
    if (!url) throw Object.assign(new Error('Tender link is required'), { status: 400 })
    data.tenderUrl = url
  }
  if (patch.documentUrl !== undefined) data.documentUrl = str(patch.documentUrl) || null
  if (patch.active !== undefined) data.active = Boolean(patch.active)
  if (patch.publishedAt !== undefined) {
    data.publishedAt = patch.publishedAt ? new Date(patch.publishedAt) : null
  }
  if (patch.closingAt !== undefined) {
    data.closingAt = patch.closingAt ? new Date(patch.closingAt) : null
  }

  await getAdminDb().collection(TENDERS_COLLECTION).doc(id).set(data, { merge: true })
  const updated = await getTender(id)
  if (!updated) throw new Error('Tender missing after update')
  return updated
}

export async function deleteTender(id: string): Promise<void> {
  const existing = await getTender(id)
  if (!existing) throw Object.assign(new Error('Tender not found'), { status: 404 })
  await getAdminDb().collection(TENDERS_COLLECTION).doc(id).delete()
}
