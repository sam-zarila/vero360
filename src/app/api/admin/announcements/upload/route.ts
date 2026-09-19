import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import {
  completeAnnouncementVideoUpload,
  createAnnouncementVideoUploadUrl,
  mapAnnouncementStorageError,
} from '@/lib/announcements-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    await requirePanelAdmin(request)
    const body = (await request.json()) as {
      action?: string
      contentType?: string
      fileName?: string
      size?: number
      objectPath?: string
    }

    if (body.action === 'start') {
      const origin = request.headers.get('origin') || undefined
      const started = await createAnnouncementVideoUploadUrl({
        contentType: String(body.contentType || ''),
        fileName: String(body.fileName || 'video.mp4'),
        size: Number(body.size || 0),
        origin,
      })
      return NextResponse.json({ success: true, ...started })
    }

    if (body.action === 'complete') {
      const video = await completeAnnouncementVideoUpload({
        objectPath: String(body.objectPath || ''),
        fileName: String(body.fileName || 'video.mp4'),
        contentType: String(body.contentType || 'video/mp4'),
      })
      return NextResponse.json({ success: true, video })
    }

    return NextResponse.json({ error: 'Unknown upload action' }, { status: 400 })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const mapped = mapAnnouncementStorageError(err)
    const message = mapped.message
    const status =
      /MP4|100MB|Invalid|did not finish|Paste|quota|usage_exceeded/i.test(message) ? 400 : 500
    if (status === 500) console.error('announcements upload:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
