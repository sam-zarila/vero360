import 'server-only'

import { randomUUID } from 'crypto'
import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { unstable_noStore as noStore } from 'next/cache'
import { getAdminDb, getAdminStorage, getAdminStorageBucket } from '@/lib/firebase-admin'
import type { SellBanner, SellBannerAudience } from '@/lib/sell-banners'
import { parseSellBannerAudience } from '@/lib/sell-banners'

export type { SellBanner } from '@/lib/sell-banners'

export const SELL_BANNERS_COLLECTION = 'sell_banners'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

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

function firebaseDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}

function imageExt(contentType: string, fileName: string): string {
  const fromName = (fileName.split('.').pop() || '').toLowerCase()
  if (fromName === 'png' || fromName === 'webp' || fromName === 'gif' || fromName === 'jpg' || fromName === 'jpeg') {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}

function normalizeImageUrl(value: unknown): string | null {
  const url = str(value)
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return url
  }
  throw new Error('Image URL must be an http(s) link')
}

export function parseSellBanner(
  id: string,
  data: DocumentData | Record<string, unknown>,
): SellBanner {
  const audience = parseSellBannerAudience(data.audience || data.role || data.target)
  return {
    id,
    title: str(data.title) || (audience === 'driver'
      ? 'Drive with Vero360'
      : audience === 'food'
        ? 'Sell food on Vero360'
        : audience === 'accommodation'
          ? 'List stays on Vero360'
          : 'Start selling on Vero360'),
    body: str(data.body || data.subtitle || data.description),
    ctaLabel: str(data.ctaLabel) || (audience === 'driver'
      ? 'Join as driver'
      : audience === 'food'
        ? 'Sell food'
        : audience === 'accommodation'
          ? 'List stays'
          : 'Sell now'),
    imageUrl: str(data.imageUrl) || null,
    audience,
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

export async function uploadSellBannerImage(file: File): Promise<string> {
  if (file.size <= 0) throw new Error('Empty file')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 8MB or smaller')

  const contentType = (file.type || 'application/octet-stream').toLowerCase()
  if (!contentType.startsWith('image/')) {
    throw new Error('Only image files are allowed')
  }
  if (
    ALLOWED_IMAGE_TYPES.size > 0 &&
    !ALLOWED_IMAGE_TYPES.has(contentType) &&
    contentType !== 'image/jpg'
  ) {
    throw new Error('Use JPEG, PNG, WebP, or GIF')
  }

  const ext = imageExt(contentType, file.name)
  const objectPath = `sell_banners/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const bucket = getAdminStorage().bucket(getAdminStorageBucket())
  const token = randomUUID()

  await bucket.file(objectPath).save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  })

  return firebaseDownloadUrl(bucket.name, objectPath, token)
}

export async function createSellBanner(input: {
  title: string
  body?: string
  ctaLabel?: string
  imageUrl?: string | null
  audience?: SellBannerAudience
  active?: boolean
  sortOrder?: number
  createdByEmail?: string
}): Promise<SellBanner> {
  const title = str(input.title)
  if (!title) throw new Error('Title is required')

  const audience = parseSellBannerAudience(input.audience)
  const imageUrl =
    input.imageUrl === undefined ? null : normalizeImageUrl(input.imageUrl)

  const ref = getAdminDb().collection(SELL_BANNERS_COLLECTION).doc()
  const payload = {
    title,
    body: str(input.body),
    ctaLabel:
      str(input.ctaLabel) ||
      (audience === 'driver'
        ? 'Join as driver'
        : audience === 'food'
          ? 'Sell food'
          : audience === 'accommodation'
            ? 'List stays'
            : 'Sell now'),
    imageUrl,
    audience,
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
    imageUrl: string | null
    audience: SellBannerAudience
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
  if (patch.imageUrl !== undefined) next.imageUrl = normalizeImageUrl(patch.imageUrl)
  if (patch.audience !== undefined) next.audience = parseSellBannerAudience(patch.audience)
  if (patch.active !== undefined) next.active = !!patch.active
  if (patch.sortOrder !== undefined) next.sortOrder = Number(patch.sortOrder) || 0

  await ref.set(next, { merge: true })
  const fresh = await ref.get()
  return parseSellBanner(id, fresh.data() || {})
}

export async function deleteSellBanner(id: string): Promise<void> {
  await getAdminDb().collection(SELL_BANNERS_COLLECTION).doc(id).delete()
}
