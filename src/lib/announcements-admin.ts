import 'server-only'

import { randomUUID } from 'crypto'
import { unstable_noStore as noStore } from 'next/cache'
import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import type { Announcement, AnnouncementVideoKind } from '@/lib/announcements'
import { parseExternalVideo } from '@/lib/get-started-videos'
import { getAdminDb, getAdminStorage, getAdminStorageBucket } from '@/lib/firebase-admin'

export const ANNOUNCEMENTS_COLLECTION = 'site_announcements'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
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

function videoExt(contentType: string, fileName: string): string {
  const fromName = (fileName.split('.').pop() || '').toLowerCase()
  if (fromName === 'mp4' || fromName === 'webm' || fromName === 'mov') return fromName
  if (contentType.includes('webm')) return 'webm'
  if (contentType.includes('quicktime')) return 'mov'
  return 'mp4'
}

function parseVideoKind(value: unknown): AnnouncementVideoKind | null {
  return value === 'file' || value === 'youtube' || value === 'vimeo' || value === 'link'
    ? value
    : null
}

export function parseAnnouncement(id: string, data: DocumentData | Record<string, unknown>): Announcement {
  const postedAt =
    tsToIso(data.postedAt) ||
    tsToIso(data.createdAt) ||
    null
  const videoUrl = str(data.videoUrl) || null
  return {
    id,
    title: str(data.title) || 'Announcement',
    description: str(data.description),
    imageUrl: str(data.imageUrl) || null,
    videoUrl,
    videoEmbedUrl: str(data.videoEmbedUrl) || videoUrl,
    videoKind: videoUrl ? parseVideoKind(data.videoKind) : null,
    videoFileName: str(data.videoFileName) || null,
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
  imageUrl?: string | null
  videoUrl?: string | null
  videoEmbedUrl?: string | null
  videoKind?: AnnouncementVideoKind | null
  videoFileName?: string | null
  postedAt?: string | null
  active?: boolean
}): Promise<Announcement> {
  const title = str(input.title)
  const description = str(input.description)
  const imageUrl = str(input.imageUrl) || null
  const videoUrl = str(input.videoUrl) || null
  if (!title) throw new Error('Title is required')
  if (!description) throw new Error('Description is required')
  if (!imageUrl && !videoUrl) {
    throw new Error('Add a photo and/or an announcement video')
  }

  const postedDate = input.postedAt ? new Date(input.postedAt) : new Date()
  if (Number.isNaN(postedDate.getTime())) throw new Error('Invalid posted date')

  const ref = getAdminDb().collection(ANNOUNCEMENTS_COLLECTION).doc()
  const payload = {
    title,
    description,
    imageUrl,
    videoUrl,
    videoEmbedUrl: videoUrl ? str(input.videoEmbedUrl) || videoUrl : null,
    videoKind: videoUrl ? input.videoKind || null : null,
    videoFileName: videoUrl ? str(input.videoFileName) || null : null,
    postedAt: postedDate,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    active: input.active !== false,
  }
  await ref.set(payload)
  return parseAnnouncement(ref.id, {
    ...payload,
    postedAt: postedDate.toISOString(),
    createdAt: postedDate.toISOString(),
    updatedAt: postedDate.toISOString(),
  })
}

export async function updateAnnouncement(
  id: string,
  input: {
    title?: string
    description?: string
    imageUrl?: string | null
    videoUrl?: string | null
    videoEmbedUrl?: string | null
    videoKind?: AnnouncementVideoKind | null
    videoFileName?: string | null
    clearVideo?: boolean
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
    if (!next && !existing.videoUrl && !input.videoUrl && !input.clearVideo) {
      throw new Error('A photo or video is required')
    }
    patch.imageUrl = next || null
  }
  if (input.clearVideo) {
    patch.videoUrl = null
    patch.videoEmbedUrl = null
    patch.videoKind = null
    patch.videoFileName = null
  } else if (input.videoUrl !== undefined) {
    const videoUrl = str(input.videoUrl) || null
    patch.videoUrl = videoUrl
    patch.videoEmbedUrl = videoUrl ? str(input.videoEmbedUrl) || videoUrl : null
    patch.videoKind = videoUrl ? input.videoKind || null : null
    patch.videoFileName = videoUrl ? str(input.videoFileName) || null : null
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

  const nextImage =
    input.imageUrl !== undefined ? str(input.imageUrl) || null : existing.imageUrl
  const nextVideo = input.clearVideo
    ? null
    : input.videoUrl !== undefined
      ? str(input.videoUrl) || null
      : existing.videoUrl
  if (!nextImage && !nextVideo) {
    throw new Error('Add a photo and/or an announcement video')
  }

  await getAdminDb().collection(ANNOUNCEMENTS_COLLECTION).doc(id).set(patch, { merge: true })
  const updated = await getAnnouncement(id)
  if (!updated) throw new Error('Announcement missing after update')
  return updated
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const existing = await getAnnouncement(id)
  if (!existing) throw Object.assign(new Error('Announcement not found'), { status: 404 })

  for (const url of [existing.imageUrl, existing.videoUrl]) {
    if (!url?.includes('firebasestorage.googleapis.com')) continue
    try {
      const u = new URL(url)
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

export async function uploadAnnouncementVideo(file: File): Promise<{
  url: string
  embedUrl: string
  kind: AnnouncementVideoKind
  fileName: string
}> {
  if (file.size <= 0) throw new Error('Empty video file')
  if (file.size > MAX_VIDEO_BYTES) throw new Error('Video must be 100MB or smaller')

  const contentType = (file.type || 'application/octet-stream').toLowerCase()
  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    throw new Error('Upload an MP4, WebM, or MOV video')
  }

  const ext = videoExt(contentType, file.name)
  const objectPath = `site_announcement_videos/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
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

  const url = firebaseDownloadUrl(bucket.name, objectPath, token)
  return {
    url,
    embedUrl: url,
    kind: 'file',
    fileName: file.name || `announcement.${ext}`,
  }
}

export function resolveAnnouncementExternalVideo(rawUrl: string) {
  const parsed = parseExternalVideo(rawUrl)
  if (!parsed) {
    throw new Error('Paste a full https:// YouTube, Vimeo, or MP4 link')
  }
  return parsed
}
