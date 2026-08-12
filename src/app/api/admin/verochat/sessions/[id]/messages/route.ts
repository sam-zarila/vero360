import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { listVeroChatMessages } from '@/lib/verochat-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: Ctx) {
  try {
    await requirePanelAdmin(request)
    const { id } = await ctx.params
    const sessionId = String(id || '').trim()
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
    }
    const messages = await listVeroChatMessages(sessionId)
    return NextResponse.json({ success: true, messages })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('admin verochat messages GET:', err)
    return NextResponse.json({ error: 'Could not load messages' }, { status: 500 })
  }
}
