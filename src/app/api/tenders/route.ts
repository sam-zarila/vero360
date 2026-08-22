import { NextResponse } from 'next/server'
import { listPublicTenders } from '@/lib/tenders-admin'

export const dynamic = 'force-dynamic'

/** Public tenders feed for the Vero360 mobile app. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawLimit = Number(searchParams.get('limit') || 100)
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), 200)
      : 100
    const items = await listPublicTenders(limit)
    return NextResponse.json({ success: true, items })
  } catch (err) {
    console.error('Public tenders GET:', err)
    return NextResponse.json({ error: 'Failed to load tenders' }, { status: 500 })
  }
}
