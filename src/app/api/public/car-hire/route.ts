import { listPublicCarHireFiltered } from '@/lib/public-catalog'
import { publicCatalogJson } from '@/lib/public-catalog-cache'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') || 120)
    const items = await listPublicCarHireFiltered({
      limit,
      pickupArea: searchParams.get('pickupArea'),
      startAt: searchParams.get('startAt'),
      endAt: searchParams.get('endAt'),
    })
    return publicCatalogJson({ success: true, items })
  } catch (err) {
    console.error('Public car hire GET:', err)
    return publicCatalogJson({ success: true, items: [] })
  }
}
