import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import {
  createHomepageCrawl,
  listHomepageCrawls,
} from '@/lib/homepage-crawls-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const items = await listHomepageCrawls({ limit: 80 })
    return NextResponse.json({
      success: true,
      items,
      counts: {
        all: items.length,
        active: items.filter((i) => i.active).length,
      },
    })
  } catch (err) {
    console.error('Admin homepage crawls GET:', err)
    return NextResponse.json({ error: 'Failed to load crawls' }, { status: 500 })
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
    const item = await createHomepageCrawl({
      title: String(body.title || ''),
      subtitle: String(body.subtitle || body.body || ''),
      linkType: String(body.linkType || 'none'),
      linkId: String(body.linkId || ''),
      active: body.active !== false,
      sortOrder:
        typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
      createdByEmail: admin.email,
    })
    return NextResponse.json({ success: true, item })
  } catch (err) {
    console.error('Admin homepage crawls POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create crawl' },
      { status: 500 },
    )
  }
}
