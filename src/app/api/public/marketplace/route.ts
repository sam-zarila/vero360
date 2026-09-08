import { NextResponse } from 'next/server'
import { listPublicMarketplace } from '@/lib/public-catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') || 8)
    const items = await listPublicMarketplace(limit)
    return NextResponse.json({ success: true, items })
  } catch (err) {
    console.error('Public marketplace GET:', err)
    return NextResponse.json({ success: true, items: [] })
  }
}
