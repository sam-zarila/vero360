import 'server-only'

import { randomUUID } from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, getAdminStorage, getAdminStorageBucket } from '@/lib/firebase-admin'
import {
  emptyGetStartedVideo,
  emptyGetStartedVideosMap,
  GET_STARTED_ROLES,
  isGetStartedRoleId,
  parseExternalVideo,
  type GetStartedRoleId,
  type GetStartedVideo,
  type GetStartedVideosMap,
  type GetStartedVideoKind,
} from '@/lib/get-started-videos'

export const GET_STARTED_VIDEOS_COLLECTION = 'site_content'
export const GET_STARTED_VIDEOS_DOC = 'get_started_videos'

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

function firebaseDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}

function docRef() {
  return getAdminDb().collection(GET_STARTED_VIDEOS_COLLECTION).doc(GET_STARTED_VIDEOS_DOC)
}

function parseStored(
  role: GetStartedRoleId,
  raw: unknown,
): GetStartedVideo {
  const empty = emptyGetStartedVideo(role)
  if (!raw || typeof raw !== 'object') return empty
  const obj = raw as Record<string, unknown>
  const url = typeof obj.url === 'string' && obj.url.trim() ? obj.url.trim() : null
  const embedUrl =
    typeof obj.embedUrl === 'string' && obj.embedUrl.trim() ? obj.embedUrl.trim() : url
  const kind = obj.kind
  const validKind: GetStartedVideoKind | null =
    kind === 'file' || kind === 'youtube' || kind === 'vimeo' || kind === 'link' ? kind : null
  const updatedAt =
    obj.updatedAt && typeof obj.updatedAt === 'object' && 'toDate' in obj.updatedAt
      ? (obj.updatedAt as { toDate: () => Date }).toDate().toISOString()
      : typeof obj.updatedAt === 'string'
        ? obj.updatedAt
        : null
  return {
    role,
    url,
    embedUrl: url ? embedUrl : null,
    kind: url ? validKind : null,
    fileName: typeof obj.fileName === 'string' ? obj.fileName : null,
    updatedAt,
  }
}

export async function getGetStartedVideosMap(): Promise<GetStartedVideosMap> {
  const map = emptyGetStartedVideosMap()
  try {
    const snap = await docRef().get()
    const data = (snap.data() || {}) as Record<string, unknown>
    for (const role of GET_STARTED_ROLES) {
      map[role] = parseStored(role, data[role])
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!/not configured|parse private key/i.test(message)) {
      console.warn('getGetStartedVideosMap:', message)
    }
  }
  return map
}

export async function saveGetStartedExternalUrl(
  role: GetStartedRoleId,
  rawUrl: string,
) {
  const parsed = parseExternalVideo(rawUrl)
  if (!parsed) {
    throw new Error('Paste a full https:// YouTube, Vimeo, or MP4 link')
  }
  await docRef().set(
    {
      [role]: {
        url: parsed.url,
        embedUrl: parsed.embedUrl,
        kind: parsed.kind,
        fileName: FieldValue.delete(),
        storagePath: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  )
  return parseStored(role, {
    url: parsed.url,
    embedUrl: parsed.embedUrl,
    kind: parsed.kind,
    updatedAt: new Date().toISOString(),
  })
}

export async function clearGetStartedVideo(role: GetStartedRoleId) {
  const existing = (await getGetStartedVideosMap())[role]
  if (existing.url && existing.kind === 'file') {
    const data = ((await docRef().get()).data() || {}) as Record<string, unknown>
    const row = data[role]
    const storagePath =
      row && typeof row === 'object' && typeof (row as { storagePath?: unknown }).storagePath === 'string'
        ? String((row as { storagePath: string }).storagePath)
        : null
    if (storagePath) {
      try {
        await getAdminStorage().bucket(getAdminStorageBucket()).file(storagePath).delete({ ignoreNotFound: true })
      } catch (err) {
        console.warn('clearGetStartedVideo storage delete:', err)
      }
    }
  }
  await docRef().set(
    {
      [role]: FieldValue.delete(),
    },
    { merge: true },
  )
}

function videoExt(contentType: string, fileName: string): string {
  const fromName = (fileName.split('.').pop() || '').toLowerCase()
  if (fromName === 'mp4' || fromName === 'webm' || fromName === 'mov') return fromName
  if (contentType.includes('webm')) return 'webm'
  if (contentType.includes('quicktime')) return 'mov'
  return 'mp4'
}

export async function createGetStartedUploadUrl(opts: {
  role: GetStartedRoleId
  contentType: string
  fileName: string
  size: number
  origin?: string
}) {
  const contentType = opts.contentType.toLowerCase()
  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    throw new Error('Upload an MP4, WebM, or MOV video')
  }
  if (opts.size <= 0 || opts.size > MAX_UPLOAD_BYTES) {
    throw new Error('Video must be 200MB or smaller')
  }

  const bucket = getAdminStorage().bucket(getAdminStorageBucket())
  const origins = [
    'https://vero360.app',
    'https://www.vero360.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]
  if (opts.origin && /^https?:\/\//.test(opts.origin) && !origins.includes(opts.origin)) {
    origins.push(opts.origin)
  }
  try {
    await bucket.setCorsConfiguration([
      {
        origin: origins,
        method: ['GET', 'PUT', 'HEAD', 'OPTIONS'],
        responseHeader: ['Content-Type', 'x-goog-content-length-range'],
        maxAgeSeconds: 3600,
      },
    ])
  } catch (err) {
    console.warn('setCorsConfiguration skipped:', err)
  }

  const ext = videoExt(contentType, opts.fileName)
  const objectPath = `get-started-videos/${opts.role}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
  const file = bucket.file(objectPath)
  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 20 * 60 * 1000,
    contentType,
  })

  return { uploadUrl, objectPath, contentType }
}

export async function completeGetStartedUpload(opts: {
  role: GetStartedRoleId
  objectPath: string
  fileName: string
  contentType: string
}) {
  if (!isGetStartedRoleId(opts.role)) {
    throw new Error('Invalid role')
  }
  if (!opts.objectPath.startsWith(`get-started-videos/${opts.role}/`)) {
    throw new Error('Invalid upload path')
  }

  const bucket = getAdminStorage().bucket(getAdminStorageBucket())
  const file = bucket.file(opts.objectPath)
  const [exists] = await file.exists()
  if (!exists) {
    throw new Error('Upload did not finish. Try again.')
  }

  const token = randomUUID()
  await file.setMetadata({
    contentType: opts.contentType || 'video/mp4',
    metadata: {
      firebaseStorageDownloadTokens: token,
    },
  })

  const url = firebaseDownloadUrl(bucket.name, opts.objectPath, token)
  await docRef().set(
    {
      [opts.role]: {
        url,
        embedUrl: url,
        kind: 'file',
        fileName: opts.fileName.slice(0, 180),
        storagePath: opts.objectPath,
        updatedAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  )

  return parseStored(opts.role, {
    url,
    embedUrl: url,
    kind: 'file',
    fileName: opts.fileName.slice(0, 180),
    updatedAt: new Date().toISOString(),
  })
}
