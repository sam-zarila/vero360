import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  deleteAnnouncement,
  updateAnnouncement,
  uploadAnnouncementImage,
} from '@/lib/announcements-admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const { id } = await ctx.params
  if (!id.trim()) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const patch: {
        title?: string
        description?: string
        imageUrl?: string | null
        postedAt?: string | null
        active?: boolean
      } = {}

      if (form.has('title')) patch.title = String(form.get('title') ?? '')
      if (form.has('description')) patch.description = String(form.get('description') ?? '')
      if (form.has('postedAt')) {
        const postedAt = String(form.get('postedAt') ?? '').trim()
        patch.postedAt = postedAt || null
      }
      if (form.has('active')) patch.active = String(form.get('active')) !== 'false'
      if (form.has('imageUrl')) patch.imageUrl = String(form.get('imageUrl') ?? '').trim() || null

      const file = form.get('image')
      if (file instanceof File && file.size > 0) {
        patch.imageUrl = await uploadAnnouncementImage(file)
      }

      const item = await updateAnnouncement(id, patch)
      return NextResponse.json({ success: true, item })
    }

    const body = (await request.json()) as {
      title?: string
      description?: string
      imageUrl?: string | null
      postedAt?: string | null
      active?: boolean
    }
    const item = await updateAnnouncement(id, body)
    return NextResponse.json({ success: true, item })
  } catch (err) {
    const status =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status: number }).status) || 400
        : 400
    const message = err instanceof Error ? err.message : 'Failed to update announcement'
    if (status >= 500) console.error('Admin announcements PATCH:', err)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const { id } = await ctx.params
  if (!id.trim()) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  try {
    await deleteAnnouncement(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const status =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status: number }).status) || 400
        : 400
    const message = err instanceof Error ? err.message : 'Failed to delete announcement'
    if (status >= 500) console.error('Admin announcements DELETE:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
