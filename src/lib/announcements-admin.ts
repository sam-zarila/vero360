import 'server-only'

import { randomUUID } from 'crypto'
import { unstable_noStore as noStore } from 'next/cache'
import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import type { Announcement } from '@/lib/announcements'
import { getAdminDb, getAdminStorage, getAdminStorageBucket } from '@/lib/firebase-admin'

export const ANNOUNCEMENTS_COLLECTION = 'site_announcements'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

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

export function parseAnnouncement(id: string, data: DocumentData | Record<string, unknown>): Announcement {
  const postedAt =
    tsToIso(data.postedAt) ||
    tsToIso(data.createdAt) ||
    null
  return {
    id,
    title: str(data.title) || 'Announcement',
    description: str(data.description),
    imageUrl: str(data.imageUrl) || null,
    postedAt,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    active: data.active !== false,
  }
}

export async function listAnnouncements(opts?: {
  activeOnly?: boolean
  limit?: number
}): Promise<Announcement[]> {
  const snap = await getAdminDb()
    .collection(ANNOUNCEMENTS_COLLECTION)
    .orderBy('postedAt', 'desc')
    .limit(opts?.limit ?? 50)
    .get()

  let items = snap.docs.map(doc => parseAnnouncement(doc.id, doc.data()))
  if (opts?.activeOnly) items = items.filter(item => item.active)
  return items
}

export async function listPublicAnnouncements(limit = 12): Promise<Announcement[]> {
  noStore()
  try {
    return await listAnnouncements({ activeOnly: true, limit })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!/not configured|parse private key/i.test(message)) {
      console.warn('listPublicAnnouncements:', message)
    }
    return []
  }
}

export async function getAnnouncement(id: string): Promise<Announcement | null> {
  const doc = await getAdminDb().collection(ANNOUNCEMENTS_COLLECTION).doc(id).get()
  if (!doc.exists) return null
  return parseAnnouncement(doc.id, doc.data() || {})
}

export async function createAnnouncement(input: {
  title: string
  description: string
  imageUrl: string
  postedAt?: string | null
  active?: boolean
}): Promise<Announcement> {
  const title = str(input.title)
  const description = str(input.description)
  const imageUrl = str(input.imageUrl)
  if (!title) throw new Error('Title is required')
  if (!description) throw new Error('Description is required')
  if (!imageUrl) throw new Error('A photo upload is required')

  const postedDate = input.postedAt ? new Date(input.postedAt) : new Date()
  if (Number.isNaN(postedDate.getTime())) throw new Error('Invalid posted date')

  const ref = getAdminDb().collection(ANNOUNCEMENTS_COLLECTION).doc()
  const payload = {
    title,
    description,
    imageUrl,
    postedAt: postedDate,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    active: input.active !== false,
  }
  await ref.set(payload)
  return {
    id: ref.id,
    title,
    description,
    imageUrl,
    postedAt: postedDate.toISOString(),
    createdAt: postedDate.toISOString(),
    updatedAt: postedDate.toISOString(),
    active: input.active !== false,
  }
}

export async function updateAnnouncement(
  id: string,
  input: {
    title?: string
    description?: string
    imageUrl?: string | null
    postedAt?: string | null
    active?: boolean
  },
): Promise<Announcement> {
  const existing = await getAnnouncement(id)
  if (!existing) throw Object.assign(new Error('Announcement not found'), { status: 404 })

  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (input.title !== undefined) {
    const title = str(input.title)
    if (!title) throw new Error('Title is required')
    patch.title = title
  }
  if (input.description !== undefined) {
    const description = str(input.description)
    if (!description) throw new Error('Description is required')
    patch.description = description
  }
  if (input.imageUrl !== undefined) {
    const next = str(input.imageUrl)
    if (!next) throw new Error('A photo upload is required')
    patch.imageUrl = next
  }
  if (input.postedAt !== undefined) {
    if (!input.postedAt) throw new Error('Invalid posted date')
    const postedDate = new Date(input.postedAt)
    if (Number.isNaN(postedDate.getTime())) throw new Error('Invalid posted date')
    patch.postedAt = postedDate
  }
  if (input.active !== undefined) {
    patch.active = input.active
  }

  await getAdminDb().collection(ANNOUNCEMENTS_COLLECTION).doc(id).set(patch, { merge: true })
  const updated = await getAnnouncement(id)
  if (!updated) throw new Error('Announcement missing after update')
  return updated
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const existing = await getAnnouncement(id)
  if (!existing) throw Object.assign(new Error('Announcement not found'), { status: 404 })

  if (existing.imageUrl?.includes('firebasestorage.googleapis.com')) {
    try {
      const u = new URL(existing.imageUrl)
      const objectMatch = u.pathname.match(/\/o\/(.+)$/)
      if (objectMatch) {
        const objectPath = decodeURIComponent(objectMatch[1])
        await getAdminStorage()
          .bucket(getAdminStorageBucket())
          .file(objectPath)
          .delete({ ignoreNotFound: true })
      }
    } catch (err) {
      console.warn('deleteAnnouncement storage cleanup:', err)
    }
  }

  await getAdminDb().collection(ANNOUNCEMENTS_COLLECTION).doc(id).delete()
}

export async function uploadAnnouncementImage(file: File): Promise<string> {
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
  const objectPath = `site_announcements/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
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
