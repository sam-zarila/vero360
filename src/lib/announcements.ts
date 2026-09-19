import { formatDateTime, resolveVeroMediaUrl } from '@/lib/vero-api'
import type { GetStartedVideoKind } from '@/lib/get-started-videos'

export type AnnouncementVideoKind = GetStartedVideoKind

export type Announcement = {
  id: string
  title: string
  description: string
  imageUrl: string | null
  /** Direct playable URL (uploaded file or external). */
  videoUrl: string | null
  /** Embed URL for YouTube/Vimeo when applicable. */
  videoEmbedUrl: string | null
  videoKind: AnnouncementVideoKind | null
  videoFileName: string | null
  postedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  active: boolean
}

export function resolveAnnouncementImage(image?: string | null) {
  return resolveVeroMediaUrl(image)
}

export function resolveAnnouncementVideo(url?: string | null) {
  return resolveVeroMediaUrl(url)
}

export function formatAnnouncementPostedAt(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export { formatDateTime }
