import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { nestOpsFetch } from '@/lib/nest-ops'

type Ctx = { params: Promise<{ leadId: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    const { leadId } = await ctx.params

    const id = (leadId || '').trim()
    if (!id || id.length > 64) {
      return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 })
    }

    const payload = (await request.json().catch(() => ({}))) as {
      status?: unknown
      note?: unknown
      actorLabel?: unknown
    }
    const status = typeof payload.status === 'string' ? payload.status.trim().toUpperCase() : ''
    if (!status) {
      return NextResponse.json({ error: 'Choose a lead status' }, { status: 400 })
    }
    const note = typeof payload.note === 'string' ? payload.note.trim().slice(0, 2000) : ''
    const requestedLabel =
      typeof payload.actorLabel === 'string' ? payload.actorLabel.trim().slice(0, 160) : ''
    const actorLabel = requestedLabel || actor.email || 'operations'

    const { res, error } = await nestOpsFetch(
      ['car-hire', 'leads', id],
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(note ? { note } : {}), actorLabel }),
      },
      request,
    )

    if (!res.ok) {
      return NextResponse.json({ error }, { status: res.status })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin car-hire lead PATCH error:', err)
    return NextResponse.json({ error: 'Could not update this lead' }, { status: 502 })
  }
}
