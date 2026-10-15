import { NextResponse } from 'next/server'
import { authErrorResponse, requireSuperAdmin } from '@/lib/admin-auth'
import { getAdminDb } from '@/lib/firebase-admin'
import { clearPlatformWallet } from '@/lib/platform-wallet-clear'

export async function POST(request: Request) {
  try {
    await requireSuperAdmin(request)
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await clearPlatformWallet(getAdminDb())
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Admin wallet clear error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not clear platform wallet' },
      { status: 502 },
    )
  }
}
