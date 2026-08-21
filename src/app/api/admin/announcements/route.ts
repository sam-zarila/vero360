import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  createAnnouncement,
  listAnnouncements,
  uploadAnnouncementImage,
} from '@/lib/announcements-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const items = await listAnnouncements({ limit: 100 })
    return NextResponse.json({
      success: true,
      items,
      counts: {
        all: items.length,
        active: items.filter(i => i.active).length,
        inactive: items.filter(i => !i.active).length,
      },
    })
  } catch (err) {
    console.error('Admin announcements GET:', err)
    return NextResponse.json({ error: 'Failed to load announcements' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const title = String(form.get('title') ?? '')
      const description = String(form.get('description') ?? '')
      const postedAtRaw = String(form.get('postedAt') ?? '').trim()
      const active = String(form.get('active') ?? 'true') !== 'false'
      const file = form.get('image')
      const imageUrlField = String(form.get('imageUrl') ?? '').trim()

      let imageUrl = imageUrlField || null
      if (file instanceof File && file.size > 0) {
        imageUrl = await uploadAnnouncementImage(file)
      }

      const item = await createAnnouncement({
        title,
        description,
        imageUrl,
        postedAt: postedAtRaw || null,
        active,
      })
      return NextResponse.json({ success: true, item }, { status: 201 })
    }

    const body = (await request.json()) as {
      title?: string
      description?: string
      imageUrl?: string | null
      postedAt?: string | null
      active?: boolean
    }
    const item = await createAnnouncement({
      title: body.title || '',
      description: body.description || '',
      imageUrl: body.imageUrl,
      postedAt: body.postedAt,
      active: body.active,
    })
    return NextResponse.json({ success: true, item }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create announcement'
    console.error('Admin announcements POST:', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
