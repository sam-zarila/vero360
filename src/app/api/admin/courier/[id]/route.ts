import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import { recordPanelAudit } from '@/lib/audit-trail-admin'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const actor = await requirePanelAdmin(request)
  const { id } = await ctx.params
  const auth = getVeroAuthHeader(request)

  try {
    const headers: HeadersInit = { Accept: 'application/json' }
    if (auth) headers.Authorization = auth

    const res = await fetch(veroEndpoint('verocourier', 'deliveries', id), {
      method: 'DELETE',
      headers,
    })
    const data = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(data, 'Failed to delete delivery') },
        { status: res.status },
      )
    }
    await recordPanelAudit(actor, {
      action: 'delete',
      resource: 'courier',
      resourceId: id,
      summary: `Deleted courier delivery ${id}`,
    })
    return NextResponse.json({ success: true, deleted: true })
  } catch (err) {
    console.error('Admin courier DELETE error:', err)
    return NextResponse.json({ error: 'Could not delete delivery' }, { status: 502 })
  }
}
