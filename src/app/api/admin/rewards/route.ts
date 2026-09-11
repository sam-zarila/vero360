import { NextResponse } from 'next/server'
import { authErrorResponse, requireSuperAdmin } from '@/lib/admin-auth'
import {
  COINS_PER_REDEEM,
  MWK_PER_COIN,
  MWK_PER_REDEEM,
  listRewardsAdmin,
} from '@/lib/rewards-admin'

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
    const { rows, summary } = await listRewardsAdmin()
    return NextResponse.json({
      success: true,
      rows,
      summary,
      rules: {
        mwkPerCoin: MWK_PER_COIN,
        coinsPerRedeem: COINS_PER_REDEEM,
        mwkPerRedeem: MWK_PER_REDEEM,
        note:
          '1 coin = MWK 100. Users cash out in batches of 5 coins (MWK 1,000). Pending = coins not yet in a full batch.',
      },
    })
  } catch (err) {
    console.error('Admin rewards GET:', err)
    const message =
      err instanceof Error ? err.message : 'Failed to load Vero Coin rewards'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
