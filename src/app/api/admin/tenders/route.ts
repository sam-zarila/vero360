import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { createTender, listTenders } from '@/lib/tenders-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || undefined
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const items = await listTenders({ source, activeOnly, limit: 300 })
    return NextResponse.json({
      success: true,
      items,
      counts: {
        all: items.length,
        active: items.filter(i => i.active).length,
        inactive: items.filter(i => !i.active).length,
        malawitenders: items.filter(i => i.source === 'malawitenders').length,
        maneps: items.filter(i => i.source === 'maneps').length,
        ppda: items.filter(i => i.source === 'ppda').length,
        manual: items.filter(i => i.source === 'manual').length,
        open: items.filter(i => {
          if (!i.closingAt) return i.active
          return i.active && new Date(i.closingAt).getTime() >= Date.now()
        }).length,
      },
    })
  } catch (err) {
    console.error('Admin tenders GET:', err)
    return NextResponse.json({ error: 'Failed to load tenders' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const body = (await request.json()) as Record<string, unknown>
    const item = await createTender({
      title: String(body.title || ''),
      description: String(body.description || ''),
      buyer: body.buyer == null ? null : String(body.buyer),
      reference: body.reference == null ? null : String(body.reference),
      location: body.location == null ? null : String(body.location),
      publishedAt: body.publishedAt == null ? null : String(body.publishedAt),
      closingAt: body.closingAt == null ? null : String(body.closingAt),
      tenderUrl: String(body.tenderUrl || ''),
      documentUrl: body.documentUrl == null ? null : String(body.documentUrl),
      source: 'manual',
      active: body.active !== false,
    })
    return NextResponse.json({ success: true, item }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create tender'
    const status = (err as { status?: number })?.status || 500
    if (status >= 500) console.error('Admin tenders POST:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
