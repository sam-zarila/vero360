import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import {
  createSellBanner,
  listSellBanners,
  uploadSellBannerImage,
} from '@/lib/sell-banners-admin'

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
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('image')
      let imageUrl: string | null = String(form.get('imageUrl') ?? '').trim() || null
      if (file instanceof File && file.size > 0) {
        imageUrl = await uploadSellBannerImage(file)
      }
      const item = await createSellBanner({
        title: String(form.get('title') ?? ''),
        body: String(form.get('body') ?? form.get('subtitle') ?? ''),
        ctaLabel: String(form.get('ctaLabel') || 'Sell now'),
        imageUrl,
        active: String(form.get('active') ?? 'true') !== 'false',
        createdByEmail: admin.email,
      })
      return NextResponse.json({ success: true, item }, { status: 201 })
    }

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
      imageUrl:
        body.imageUrl !== undefined ? String(body.imageUrl || '') || null : null,
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
