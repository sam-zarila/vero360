import { formatDateTime, resolveVeroMediaUrl } from '@/lib/vero-api'

export type Announcement = {
  id: string
  title: string
  description: string
  imageUrl: string | null
  postedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  active: boolean
}

export function resolveAnnouncementImage(image?: string | null) {
  return resolveVeroMediaUrl(image)
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
