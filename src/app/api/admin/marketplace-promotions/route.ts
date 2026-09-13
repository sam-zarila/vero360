import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  buildPromotionCounts,
  creditPendingPromotionPlatformFees,
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

/** POST JSON { action: 'credit_pending_fees' } — credit paid promote fees to platform wallet. */
export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string }
    if (body.action !== 'credit_pending_fees') {
      return NextResponse.json(
        { error: 'Unsupported action. Use action: credit_pending_fees' },
        { status: 400 },
      )
    }

    const result = await creditPendingPromotionPlatformFees()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Admin marketplace-promotions POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to credit promotion fees' },
      { status: 500 },
    )
  }
}
