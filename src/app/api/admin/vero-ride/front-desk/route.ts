import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import { getRideShareConfig, saveRideShareConfig } from '@/lib/ride-share-config'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const config = await getRideShareConfig()
    return NextResponse.json({ success: true, config })
  } catch (err) {
    console.error('Admin ride-share front desk GET:', err)
    return NextResponse.json({ error: 'Failed to load front desk number' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const admin = await requirePanelAdmin(request)
    const body = (await request.json().catch(() => null)) as {
      frontDeskWhatsApp?: string
      frontDeskPhone?: string
    } | null

    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const config = await saveRideShareConfig({
      frontDeskWhatsApp: body.frontDeskWhatsApp,
      frontDeskPhone: body.frontDeskPhone,
      updatedByEmail: admin.email,
    })

    return NextResponse.json({
      success: true,
      config,
      message: 'Front desk number saved. The app will use it the next time a passenger opens rides.',
    })
  } catch (err) {
    console.error('Admin ride-share front desk PUT:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    )
  }
}
