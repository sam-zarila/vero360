import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  buildPromotionCounts,
  listMarketplacePromotions,
} from '@/lib/marketplace-promotions-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const items = await listMarketplacePromotions(500)
    const counts = buildPromotionCounts(items)
    return NextResponse.json({
      success: true,
      items,
      counts,
    })
  } catch (err) {
    console.error('Admin marketplace-promotions GET:', err)
    return NextResponse.json({ error: 'Failed to load marketplace promotions' }, { status: 500 })
  }
}
