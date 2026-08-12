import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import {
  completeGetStartedUpload,
  createGetStartedUploadUrl,
} from '@/lib/get-started-videos-admin'
import { isGetStartedRoleId } from '@/lib/get-started-videos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    await requirePanelAdmin(request)
    const body = (await request.json()) as {
      action?: string
      role?: string
      contentType?: string
      fileName?: string
      size?: number
      objectPath?: string
    }

    if (!isGetStartedRoleId(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (body.action === 'start') {
      const origin = request.headers.get('origin') || undefined
      const started = await createGetStartedUploadUrl({
        role: body.role,
        contentType: String(body.contentType || ''),
        fileName: String(body.fileName || 'video.mp4'),
        size: Number(body.size || 0),
        origin,
      })
      return NextResponse.json({ success: true, ...started })
    }

    if (body.action === 'complete') {
      const video = await completeGetStartedUpload({
        role: body.role,
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
    const message = err instanceof Error ? err.message : 'Upload failed'
    const status =
      /MP4|200MB|Invalid|did not finish|Paste/i.test(message) ? 400 : 500
    if (status === 500) console.error('get-started-videos upload:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
