import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import { recordPanelAudit } from '@/lib/audit-trail-admin'
import { getAdminDb } from '@/lib/firebase-admin'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const actor = await requirePanelAdmin(request)
  const { id } = await ctx.params
  const key = (id || '').trim()
  if (!key) {
    return NextResponse.json({ error: 'Invalid food order id' }, { status: 400 })
  }

  try {
    const ref = getAdminDb().collection('food_orders').doc(key)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Food order not found' }, { status: 404 })
    }
    await ref.delete()
    await recordPanelAudit(actor, {
      action: 'delete',
      resource: 'food-order',
      resourceId: key,
      summary: `Deleted food order ${key}`,
    })
    return NextResponse.json({ success: true, deleted: true, id: key })
  } catch (err) {
    console.error('Admin food order DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete food order' },
      { status: 500 },
    )
  }
}
