import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import {
  clearGetStartedVideo,
  getGetStartedVideosMap,
  saveGetStartedExternalUrl,
} from '@/lib/get-started-videos-admin'
import { isGetStartedRoleId } from '@/lib/get-started-videos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)
    const videos = await getGetStartedVideosMap()
    return NextResponse.json({ success: true, videos })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('get-started-videos GET:', err)
    return NextResponse.json({ error: 'Could not load videos' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await requirePanelAdmin(request)
    const body = (await request.json()) as { role?: string; url?: string }
    if (!isGetStartedRoleId(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    const video = await saveGetStartedExternalUrl(body.role, String(body.url || ''))
    return NextResponse.json({ success: true, video })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const message = err instanceof Error ? err.message : 'Could not save link'
    const status = message.includes('Paste') ? 400 : 500
    if (status === 500) console.error('get-started-videos PUT:', err)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePanelAdmin(request)
    const role = new URL(request.url).searchParams.get('role')
    if (!isGetStartedRoleId(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    await clearGetStartedVideo(role)
    return NextResponse.json({ success: true })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('get-started-videos DELETE:', err)
    return NextResponse.json({ error: 'Could not remove video' }, { status: 500 })
  }
}
