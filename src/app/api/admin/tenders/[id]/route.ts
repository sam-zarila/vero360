import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { deleteTender, updateTender } from '@/lib/tenders-admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Missing tender id' }, { status: 400 })

  try {
    const body = (await request.json()) as Record<string, unknown>
    const item = await updateTender(id, {
      title: body.title == null ? undefined : String(body.title),
      description: body.description == null ? undefined : String(body.description),
      buyer: body.buyer == null ? undefined : String(body.buyer),
      reference: body.reference == null ? undefined : String(body.reference),
      location: body.location == null ? undefined : String(body.location),
      publishedAt: body.publishedAt == null ? undefined : String(body.publishedAt),
      closingAt: body.closingAt == null ? undefined : String(body.closingAt),
      tenderUrl: body.tenderUrl == null ? undefined : String(body.tenderUrl),
      documentUrl: body.documentUrl == null ? undefined : String(body.documentUrl),
      active: body.active == null ? undefined : Boolean(body.active),
    })
    return NextResponse.json({ success: true, item })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update tender'
    const status = (err as { status?: number })?.status || 500
    if (status >= 500) console.error('Admin tenders PATCH:', err)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Missing tender id' }, { status: 400 })

  try {
    await deleteTender(id)
    return NextResponse.json({ success: true, deleted: true, id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete tender'
    const status = (err as { status?: number })?.status || 500
    if (status >= 500) console.error('Admin tenders DELETE:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
