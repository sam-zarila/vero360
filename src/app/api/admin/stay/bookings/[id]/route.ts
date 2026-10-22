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

/**
 * Admin delete — Nest DELETE /bookings/admin/:id (no owner check).
 */
export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const actor = await requirePanelAdmin(request)
  const { id: raw } = await ctx.params
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 })
  }

  try {
    const headers: HeadersInit = { Accept: 'application/json' }
    const auth = getVeroAuthHeader(request)
    if (auth) headers.Authorization = auth

    const res = await fetch(veroEndpoint('bookings', 'admin', id), {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    })
    const data = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        {
          error: apiErrorMessage(
            data,
            'Failed to delete this booking. Redeploy vero-backend with DELETE /bookings/admin/:id.',
          ),
        },
        { status: res.status },
      )
    }

    await recordPanelAudit(actor, {
      action: 'delete',
      resource: 'stay-booking',
      resourceId: String(id),
      summary: `Deleted stay booking ${id}`,
    })
    return NextResponse.json({ success: true, deleted: true, id })
  } catch (err) {
    console.error('Admin stay booking DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete booking' },
      { status: 502 },
    )
  }
}