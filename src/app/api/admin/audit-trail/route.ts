import { NextResponse } from 'next/server'
import { authErrorResponse, requireSuperAdmin } from '@/lib/admin-auth'
import { listAuditEvents } from '@/lib/audit-trail-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request)
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') || 200)
    const items = await listAuditEvents(Number.isFinite(limit) ? limit : 200)
    return NextResponse.json({ success: true, items })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Audit trail GET:', err)
    return NextResponse.json({ error: 'Failed to load audit trail' }, { status: 500 })
  }
}
