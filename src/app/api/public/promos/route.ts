import { NextResponse } from 'next/server'
import { parsePromoList } from '@/lib/promo'
import { veroEndpoint } from '@/lib/vero-api'

export const dynamic = 'force-dynamic'

/** Public active promotions for the homepage crawl (no auth). */
export async function GET() {
  try {
    const res = await fetch(veroEndpoint('promos'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      return NextResponse.json({ success: true, items: [] })
    }
    const promos = parsePromoList(body)
      .filter(p => p.isActive && p.title.trim())
      .slice(0, 12)
      .map(p => ({
        id: p.id,
        title: p.title.trim(),
      }))
    return NextResponse.json({ success: true, items: promos })
  } catch (err) {
    console.error('Public promos GET:', err)
    return NextResponse.json({ success: true, items: [] })
  }
}
