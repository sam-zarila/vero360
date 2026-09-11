import { NextResponse } from 'next/server'
import { listPublicDigitalServices } from '@/lib/public-catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') || 500)
    const items = await listPublicDigitalServices(limit)
    return NextResponse.json({ success: true, items })
  } catch (err) {
    console.error('Public digital-services GET:', err)
    return NextResponse.json({ success: true, items: [] })
  }
}
