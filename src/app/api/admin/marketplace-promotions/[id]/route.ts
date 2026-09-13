import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { updateFacebookFulfillment } from '@/lib/marketplace-promotions-admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const { id } = await ctx.params
    const body = (await request.json().catch(() => ({}))) as {
      fulfillmentStatus?: string
      adminNotes?: string
    }

    const status = (body.fulfillmentStatus || '').trim().toLowerCase()
    if (status !== 'queued' && status !== 'running' && status !== 'done') {
      return NextResponse.json(
        { error: 'fulfillmentStatus must be queued, running, or done' },
        { status: 400 },
      )
    }

    const item = await updateFacebookFulfillment({
      id,
      fulfillmentStatus: status,
      adminNotes: body.adminNotes,
    })
    if (!item) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, item })
  } catch (err) {
    console.error('Admin marketplace-promotions [id] PATCH:', err)
    const message = err instanceof Error ? err.message : 'Failed to update promotion'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
