import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getAdminDb, getAdminStorage, getAdminStorageBucket } from '@/lib/firebase-admin'

const VEROCHAT_COLLECTION = 'verochat_sessions'
const MAX_BYTES = 8 * 1024 * 1024

function safeImageExt(file: File): string {
  const fromName = (file.name.split('.').pop() || '').slice(0, 5).toLowerCase()
  if (/^[a-z0-9]+$/.test(fromName)) return fromName

  const mime = (file.type || '').toLowerCase()
  if (mime.includes('png')) return 'png'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('heic')) return 'heic'
  if (mime.includes('heif')) return 'heif'
  return 'jpg'
}

function firebaseDownloadUrl(bucketName: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const sessionId = String(form.get('sessionId') ?? '').trim()
  const file = form.get('file')

  if (!sessionId || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing sessionId or file' }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be 8MB or smaller' }, { status: 400 })
  }

  const contentType = (file.type || 'application/octet-stream').toLowerCase()
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
  }

  const db = getAdminDb()
  const sessionSnap = await db.collection(VEROCHAT_COLLECTION).doc(sessionId).get()
  if (!sessionSnap.exists) {
    return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
  }

  try {
    const ext = safeImageExt(file)
    const objectPath = `verochat/${sessionId}/${Date.now()}.${ext}`
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
    return NextResponse.json({ url })
  } catch (err) {
    console.error('VeroChat upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
