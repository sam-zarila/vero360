import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import {
  getDigitalServicesConfig,
  saveDigitalServicesConfig,
  type DigitalProductPriceConfig,
} from '@/lib/digital-services-config'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const config = await getDigitalServicesConfig()
    return NextResponse.json({ success: true, config })
  } catch (err) {
    console.error('Admin digital-services pricing GET:', err)
    return NextResponse.json({ error: 'Failed to load pricing' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const admin = await requirePanelAdmin(request)
    const body = (await request.json().catch(() => null)) as {
      usdToMwkRate?: number
      products?: DigitalProductPriceConfig[]
    } | null

    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const config = await saveDigitalServicesConfig({
      usdToMwkRate: Number(body.usdToMwkRate),
      products: Array.isArray(body.products) ? body.products : [],
      updatedByEmail: admin.email,
    })

    return NextResponse.json({
      success: true,
      config,
      message: 'Pricing saved. App users will see new rates on next open/refresh.',
    })
  } catch (err) {
    console.error('Admin digital-services pricing PUT:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save pricing' },
      { status: 500 },
    )
  }
}
