import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  deleteAnnouncement,
  resolveAnnouncementExternalVideo,
  updateAnnouncement,
  uploadAnnouncementImage,
  uploadAnnouncementVideo,
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

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as {
        title?: string
        description?: string
        imageUrl?: string | null
        postedAt?: string | null
        active?: boolean
        clearVideo?: boolean
        videoLink?: string
      }
      if (body.imageUrl !== undefined) {
        return NextResponse.json(
          { error: 'Upload a photo file. Image links are not allowed' },
          { status: 400 },
        )
      }
      let videoPatch: {
        videoUrl?: string | null
        videoEmbedUrl?: string | null
        videoKind?: 'file' | 'youtube' | 'vimeo' | 'link' | null
        videoFileName?: string | null
        clearVideo?: boolean
      } = {}
      if (body.clearVideo) {
        videoPatch = { clearVideo: true }
      } else if (body.videoLink !== undefined) {
        if (!String(body.videoLink || '').trim()) {
          videoPatch = { clearVideo: true }
        } else {
          const parsed = resolveAnnouncementExternalVideo(String(body.videoLink))
          videoPatch = {
            videoUrl: parsed.url,
            videoEmbedUrl: parsed.embedUrl,
            videoKind: parsed.kind,
            videoFileName: null,
          }
        }
      }
      const item = await updateAnnouncement(id, {
        title: body.title,
        description: body.description,
        postedAt: body.postedAt,
        active: body.active,
        ...videoPatch,
      })
      return NextResponse.json({ success: true, item })
    }

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const form = await request.formData()
    const patch: {
      title?: string
      description?: string
      imageUrl?: string
      videoUrl?: string | null
      videoEmbedUrl?: string | null
      videoKind?: 'file' | 'youtube' | 'vimeo' | 'link' | null
      videoFileName?: string | null
      clearVideo?: boolean
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

    const file = form.get('image')
    if (file instanceof File && file.size > 0) {
      patch.imageUrl = await uploadAnnouncementImage(file)
    }

    if (String(form.get('clearVideo') ?? '') === 'true') {
      patch.clearVideo = true
    } else {
      const videoFile = form.get('video')
      const videoLink = String(form.get('videoLink') ?? '').trim()
      if (videoFile instanceof File && videoFile.size > 0) {
        const uploaded = await uploadAnnouncementVideo(videoFile)
        patch.videoUrl = uploaded.url
        patch.videoEmbedUrl = uploaded.embedUrl
        patch.videoKind = uploaded.kind
        patch.videoFileName = uploaded.fileName
      } else if (form.has('videoLink')) {
        if (!videoLink) {
          patch.clearVideo = true
        } else {
          const parsed = resolveAnnouncementExternalVideo(videoLink)
          patch.videoUrl = parsed.url
          patch.videoEmbedUrl = parsed.embedUrl
          patch.videoKind = parsed.kind
          patch.videoFileName = null
        }
      }
    }

    const item = await updateAnnouncement(id, patch)
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
