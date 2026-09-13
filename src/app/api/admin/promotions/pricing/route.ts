import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import {
  getPromotionsConfig,
  savePromotionsConfig,
} from '@/lib/promotions-config'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const config = await getPromotionsConfig()
    return NextResponse.json({ success: true, config })
  } catch (err) {
    console.error('Admin promotions pricing GET:', err)
    return NextResponse.json({ error: 'Failed to load pricing' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const admin = await requirePanelAdmin(request)
    const body = (await request.json().catch(() => null)) as {
      pricePresetsMwk?: number[]
      allowCustomPrice?: boolean
    } | null

    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const config = await savePromotionsConfig({
      pricePresetsMwk: Array.isArray(body.pricePresetsMwk)
        ? body.pricePresetsMwk
        : [],
      allowCustomPrice: body.allowCustomPrice !== false,
      updatedByEmail: admin.email,
    })

    return NextResponse.json({
      success: true,
      config,
      message: 'Promotion prices saved. Merchants see them on next open/refresh.',
    })
  } catch (err) {
    console.error('Admin promotions pricing PUT:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save pricing' },
      { status: 500 },
    )
  }
}
