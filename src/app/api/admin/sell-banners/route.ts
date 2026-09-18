import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import { createSellBanner, listSellBanners } from '@/lib/sell-banners-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const items = await listSellBanners({ limit: 80 })
    return NextResponse.json({
      success: true,
      items,
      counts: {
        all: items.length,
        active: items.filter(i => i.active).length,
      },
    })
  } catch (err) {
    console.error('Admin sell banners GET:', err)
    return NextResponse.json({ error: 'Failed to load sell banners' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const admin = await requirePanelAdmin(request)
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const item = await createSellBanner({
      title: String(body.title || ''),
      body: String(body.body || body.subtitle || body.description || ''),
      ctaLabel: String(body.ctaLabel || 'Sell now'),
      active: body.active !== false,
      sortOrder:
        typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
      createdByEmail: admin.email,
    })
    return NextResponse.json({ success: true, item }, { status: 201 })
  } catch (err) {
    console.error('Admin sell banners POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create banner' },
      { status: 500 },
    )
  }
}
