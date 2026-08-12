export const GET_STARTED_ROLES = ['customer', 'merchant', 'driver'] as const
export type GetStartedRoleId = (typeof GET_STARTED_ROLES)[number]

export type GetStartedVideoKind = 'file' | 'youtube' | 'vimeo' | 'link'

export type GetStartedVideo = {
  role: GetStartedRoleId
  url: string | null
  embedUrl: string | null
  kind: GetStartedVideoKind | null
  fileName?: string | null
  updatedAt?: string | null
}

export type GetStartedVideosMap = Record<GetStartedRoleId, GetStartedVideo>

export const GET_STARTED_ROLE_META: Record<
  GetStartedRoleId,
  { title: string; icon: 'user' | 'merchant' | 'steering' }
> = {
  customer: { title: 'Customer', icon: 'user' },
  merchant: { title: 'Merchant', icon: 'merchant' },
  driver: { title: 'Driver', icon: 'steering' },
}

export function isGetStartedRoleId(value: string | null | undefined): value is GetStartedRoleId {
  return GET_STARTED_ROLES.some(role => role === value)
}

export function emptyGetStartedVideo(role: GetStartedRoleId): GetStartedVideo {
  return {
    role,
    url: null,
    embedUrl: null,
    kind: null,
    fileName: null,
    updatedAt: null,
  }
}

export function emptyGetStartedVideosMap(): GetStartedVideosMap {
  return {
    customer: emptyGetStartedVideo('customer'),
    merchant: emptyGetStartedVideo('merchant'),
    driver: emptyGetStartedVideo('driver'),
  }
}

function youtubeId(raw: string): string | null {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id && /^[\w-]{6,}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v')
      const parts = u.pathname.split('/').filter(Boolean)
      if ((parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') && parts[1]) {
        return parts[1]
      }
    }
  } catch {
    return null
  }
  return null
}

function vimeoId(raw: string): string | null {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, '')
    if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    const id = host === 'player.vimeo.com' && parts[0] === 'video' ? parts[1] : parts[0]
    return id && /^\d+$/.test(id) ? id : null
  } catch {
    return null
  }
}

export function parseExternalVideo(raw: string): {
  url: string
  embedUrl: string
  kind: GetStartedVideoKind
} | null {
  const url = raw.trim()
  if (!url) return null
  if (!/^https:\/\//i.test(url)) return null

  const yt = youtubeId(url)
  if (yt) {
    return {
      url: `https://www.youtube.com/watch?v=${yt}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}`,
      kind: 'youtube',
    }
  }

  const vim = vimeoId(url)
  if (vim) {
    return {
      url: `https://vimeo.com/${vim}`,
      embedUrl: `https://player.vimeo.com/video/${vim}`,
      kind: 'vimeo',
    }
  }

  return { url, embedUrl: url, kind: 'link' }
}

export function videoKindLabel(kind: GetStartedVideoKind | null): string {
  if (kind === 'file') return 'Uploaded file'
  if (kind === 'youtube') return 'YouTube'
  if (kind === 'vimeo') return 'Vimeo'
  if (kind === 'link') return 'Video link'
  return 'Not set'
}
