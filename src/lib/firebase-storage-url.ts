import 'server-only'

import { getAdminStorage, getAdminStorageBucket } from '@/lib/firebase-admin'

function str(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

/** Turn gs://, storage paths, or firebasestorage URLs into a browser-loadable signed URL. */
export async function resolveStorageDownloadUrl(
  raw: string | null | undefined,
): Promise<string | null> {
  const s = str(raw)
  if (!s) return null

  if (s.startsWith('data:')) return s

  const storage = getAdminStorage()
  const defaultBucket = getAdminStorageBucket()
  let bucket = storage.bucket(defaultBucket)
  let objectPath: string | null = null

  if (s.startsWith('gs://')) {
    const match = s.match(/^gs:\/\/([^/]+)\/(.+)$/)
    if (match) {
      bucket = storage.bucket(match[1])
      objectPath = match[2]
    }
  } else if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const u = new URL(s)
      if (u.hostname.includes('firebasestorage.googleapis.com')) {
        const bucketMatch = u.pathname.match(/\/b\/([^/]+)\//)
        const objectMatch = u.pathname.match(/\/o\/(.+)$/)
        if (bucketMatch) bucket = storage.bucket(bucketMatch[1])
        if (objectMatch) objectPath = decodeURIComponent(objectMatch[1])
      } else {
        return s
      }
    } catch {
      return s
    }
  } else {
    objectPath = s.replace(/^\//, '')
  }

  if (!objectPath) return s.startsWith('http') ? s : null

  try {
    const file = bucket.file(objectPath)
    const [signed] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
    return signed
  } catch (err) {
    console.warn('resolveStorageDownloadUrl:', objectPath, err)
    return s.startsWith('http') ? s : null
  }
}
