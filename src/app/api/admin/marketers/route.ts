import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { ADMINS_COLLECTION, isFullAdminRole, parsePanelAdmin } from '@/lib/admins'
import { getAdminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

/** Active marketers for task assignment (full admins only). */
export async function GET(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Only admins can list marketers' }, { status: 403 })
    }

    const snap = await getAdminDb().collection(ADMINS_COLLECTION).get()
    const marketers = snap.docs
      .map(d => parsePanelAdmin(d.id, d.data() as Record<string, unknown>))
      .filter(a => a.role === 'marketer' && a.status === 'active')
      .sort((a, b) => a.displayName.localeCompare(b.displayName))

    return NextResponse.json({
      success: true,
      marketers: marketers.map(m => ({
        id: m.id,
        email: m.email,
        displayName: m.displayName,
      })),
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Marketers GET:', err)
    return NextResponse.json({ error: 'Failed to load marketers' }, { status: 500 })
  }
}
