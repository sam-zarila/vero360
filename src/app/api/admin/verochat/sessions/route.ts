import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { listVeroChatSessions } from '@/lib/verochat-admin'
import { isHelpCenterSession } from '@/lib/verochat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)
    const sessions = await listVeroChatSessions()
    const unread = sessions
      .filter(isHelpCenterSession)
      .reduce((sum, s) => sum + (s.unreadForAgent || 0), 0)
    return NextResponse.json({ success: true, sessions, unread })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('admin verochat sessions GET:', err)
    return NextResponse.json({ error: 'Could not load Help Center chats' }, { status: 500 })
  }
}
