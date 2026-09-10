import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  deleteHomepageCrawl,
  updateHomepageCrawl,
} from '@/lib/homepage-crawls-admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const item = await updateHomepageCrawl(id, {
      title: body.title !== undefined ? String(body.title) : undefined,
      subtitle: body.subtitle !== undefined ? String(body.subtitle) : undefined,
      linkType: body.linkType !== undefined ? String(body.linkType) : undefined,
      linkId: body.linkId !== undefined ? String(body.linkId) : undefined,
      active: body.active !== undefined ? !!body.active : undefined,
      sortOrder:
        body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    })
    return NextResponse.json({ success: true, item })
  } catch (err) {
    console.error('Admin homepage crawls PATCH:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(_request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    await deleteHomepageCrawl(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin homepage crawls DELETE:', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
