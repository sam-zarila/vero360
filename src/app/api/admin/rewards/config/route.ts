import { NextResponse } from 'next/server'
import { authErrorResponse, requireSuperAdmin } from '@/lib/admin-auth'
import {
  getVeroRewardsConfig,
  saveVeroRewardsConfig,
} from '@/lib/vero-rewards-config'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request)
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const config = await getVeroRewardsConfig()
    return NextResponse.json({ success: true, config })
  } catch (err) {
    console.error('Admin rewards config GET:', err)
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireSuperAdmin(request)
    const body = (await request.json().catch(() => null)) as {
      cashOutEnabled?: boolean
      earningEnabled?: boolean
      note?: string | null
    } | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const config = await saveVeroRewardsConfig({
      cashOutEnabled: body.cashOutEnabled,
      earningEnabled: body.earningEnabled,
      note: body.note,
      updatedByEmail: admin.email,
    })

    return NextResponse.json({
      success: true,
      config,
      message: config.cashOutEnabled
        ? 'Vero Coin cash-outs are ON.'
        : 'Vero Coin cash-outs are PAUSED — users cannot redeem to wallet.',
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin rewards config PUT:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    )
  }
}
