import { NextResponse } from 'next/server'
import { listPublicTenders } from '@/lib/tenders-admin'
import { PUBLIC_CATALOG_CACHE } from '@/lib/public-catalog-cache'

export const dynamic = 'force-dynamic'

/** Public tenders feed for the Vero360 mobile app / website. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawLimit = Number(searchParams.get('limit') || 120)
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), 500)
      : 120
    const items = await listPublicTenders(limit)
    return NextResponse.json(
      { success: true, items },
      { headers: { 'Cache-Control': PUBLIC_CATALOG_CACHE } },
    )
  } catch (err) {
    console.error('Public tenders GET:', err)
    return NextResponse.json({ error: 'Failed to load tenders' }, { status: 500 })
  }
}
