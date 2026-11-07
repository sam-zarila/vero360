import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import {
  getAdminPushPublicKey,
  saveAdminPushSubscription,
  type AdminPushSubscriptionInput,
} from '@/lib/admin-web-push'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)
    const publicKey = await getAdminPushPublicKey()
    return NextResponse.json({ success: true, publicKey })
  } catch (err) {
    const mapped = authErrorResponse(err)
    if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    console.error('Admin push key GET:', err)
    return NextResponse.json({ error: 'Could not prepare device alerts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePanelAdmin(request)
    const body = (await request.json()) as AdminPushSubscriptionInput
    await saveAdminPushSubscription(admin.uid, body)
    return NextResponse.json({ success: true })
  } catch (err) {
    const mapped = authErrorResponse(err)
    if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    const message = err instanceof Error ? err.message : 'Could not save this device'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
