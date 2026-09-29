import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  deleteSellBanner,
  updateSellBanner,
  uploadSellBannerImage,
} from '@/lib/sell-banners-admin'
import { parseSellBannerAudience } from '@/lib/sell-banners'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const patch: {
        title?: string
        body?: string
        ctaLabel?: string
        imageUrl?: string | null
        audience?: ReturnType<typeof parseSellBannerAudience>
        active?: boolean
      } = {}
      if (form.has('title')) patch.title = String(form.get('title') ?? '')
      if (form.has('body')) patch.body = String(form.get('body') ?? '')
      if (form.has('ctaLabel')) patch.ctaLabel = String(form.get('ctaLabel') ?? '')
      if (form.has('audience') || form.has('role')) {
        patch.audience = parseSellBannerAudience(form.get('audience') || form.get('role'))
      }
      if (form.has('active')) patch.active = String(form.get('active')) !== 'false'

      const file = form.get('image')
      if (file instanceof File && file.size > 0) {
        patch.imageUrl = await uploadSellBannerImage(file)
      } else if (form.has('imageUrl')) {
        patch.imageUrl = String(form.get('imageUrl') ?? '').trim() || null
      } else if (String(form.get('clearImage') ?? '') === 'true') {
        patch.imageUrl = null
      }

      const item = await updateSellBanner(id, patch)
      return NextResponse.json({ success: true, item })
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const item = await updateSellBanner(id, {
      title: body.title !== undefined ? String(body.title) : undefined,
      body:
        body.body !== undefined
          ? String(body.body)
          : body.subtitle !== undefined
            ? String(body.subtitle)
            : undefined,
      ctaLabel: body.ctaLabel !== undefined ? String(body.ctaLabel) : undefined,
      imageUrl:
        body.clearImage === true
          ? null
          : body.imageUrl !== undefined
            ? String(body.imageUrl || '') || null
            : undefined,
      audience:
        body.audience !== undefined || body.role !== undefined
          ? parseSellBannerAudience(body.audience ?? body.role)
          : undefined,
      active: body.active !== undefined ? !!body.active : undefined,
      sortOrder:
        body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    })
    return NextResponse.json({ success: true, item })
  } catch (err) {
    console.error('Admin sell banners PATCH:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    await deleteSellBanner(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin sell banners DELETE:', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
