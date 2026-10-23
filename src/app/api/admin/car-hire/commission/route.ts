import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import {
  getCarHireCommissionConfig,
  saveCarHireCommissionConfig,
} from '@/lib/car-hire-commission'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)
    const config = await getCarHireCommissionConfig()
    return NextResponse.json({ success: true, config })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin car-hire commission GET:', err)
    return NextResponse.json({ error: 'Failed to load commission' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requirePanelAdmin(request)
    const body = (await request.json().catch(() => null)) as {
      ratePercent?: number
    } | null
    const raw = Number(body?.ratePercent)
    if (!Number.isFinite(raw)) {
      return NextResponse.json({ error: 'Enter a commission percent between 0 and 50.' }, { status: 400 })
    }
    const config = await saveCarHireCommissionConfig({
      ratePercent: raw,
      updatedByEmail: admin.email,
    })
    return NextResponse.json({
      success: true,
      config,
      message: `Car hire commission is ${config.ratePercent}% of the rental.`,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin car-hire commission PUT:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save commission' },
      { status: 500 },
    )
  }
}
