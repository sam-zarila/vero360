/**
 * Single source of truth for Vero360 backend API.
 * Change base URL / token here (or via env) — pages and feature libs should not hardcode hosts.
 */

export const VERO_API_BASE = (
  process.env.NEXT_PUBLIC_VERO_API_BASE ||
  process.env.VERO_API_BASE ||
  'http://67.211.220.69:3000'
).replace(/\/$/, '')

/** Path prefix used by Nest (`app.setGlobalPrefix('vero')`) */
export const VERO_API_PREFIX = '/vero'

export function veroEndpoint(...segments: Array<string | number>) {
  const path = segments
    .map(s => String(s).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
  return `${VERO_API_BASE}${VERO_API_PREFIX}/${path}`
}

export function getVeroAdminToken() {
  return process.env.VERO_API_TOKEN || process.env.VERO_ADMIN_TOKEN || ''
}

/** Prefer server env token. Do not forward a Firebase panel token to Nest. */
export function getVeroAuthHeader(_request?: Request) {
  const token = getVeroAdminToken()
  return token ? `Bearer ${token}` : null
}

function mediaFileName(absolute: string) {
  try {
    const name = new URL(absolute).pathname.split('/').filter(Boolean).pop() || 'image'
    return name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'image'
  } catch {
    return 'image'
  }
}

/**
 * Some marketplace rows store the file bytes themselves (a base64 JPEG starts
 * with `/9j/`) instead of a URL. Treat that as an image, not a path on the API.
 * Slashes inside the payload are normal base64; only a failed alphabet check
 * means this is a real path.
 */
function inlineImageDataUrl(value: string): string | null {
  let payload = value.trim()
  if (payload.startsWith('http://') || payload.startsWith('https://')) {
    try {
      payload = new URL(payload).pathname
    } catch {
      return null
    }
  }
  try {
    payload = decodeURIComponent(payload)
  } catch {
    // Pathname is already decoded, or contains a stray percent sign.
  }
  payload = payload.replace(/\s+/g, '')
  while (payload.startsWith('/')) payload = payload.slice(1)
  if (payload.length < 80) return null

  const mime = payload.startsWith('9j/')
    ? 'image/jpeg'
    : payload.startsWith('iVBORw0KGgo')
      ? 'image/png'
      : payload.startsWith('R0lGOD')
        ? 'image/gif'
        : payload.startsWith('UklGR')
          ? 'image/webp'
          : null
  if (!mime) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return null
  return `data:${mime};base64,${payload}`
}

/** Hosts that already serve the same upload over TLS. Avoid the media proxy. */
function hostServesHttps(hostname: string) {
  const host = hostname.trim().toLowerCase()
  return host === 'vero360.app' || host.endsWith('.vero360.app')
}

function upgradeSecureMediaUrl(absolute: string) {
  try {
    const parsed = new URL(absolute)
    if (parsed.protocol === 'http:' && hostServesHttps(parsed.hostname)) {
      parsed.protocol = 'https:'
      return parsed.toString()
    }
  } catch {
    // keep the original string
  }
  return absolute
}

export function isRenderableMediaUrl(src: string) {
  return (
    src.startsWith('https://') ||
    src.startsWith('http://') ||
    src.startsWith('/api/media') ||
    src.startsWith('data:') ||
    src.startsWith('blob:')
  )
}

export function resolveVeroMediaUrl(image?: string | null) {
  const raw = image?.trim()
  if (!raw) return null
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw
  const inline = inlineImageDataUrl(raw)
  if (inline) return inline
  // Already same-origin proxied — do not wrap again (that made every photo collide).
  if (raw.startsWith('/api/media')) return raw

  let absolute = raw
  if (raw.startsWith('//')) {
    absolute = `https:${raw}`
  } else if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    const path = raw.startsWith('/') ? raw : `/${raw}`
    absolute = `${VERO_API_BASE}${path}`
  }

  try {
    const parsed = new URL(absolute)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      absolute = `${VERO_API_BASE}${parsed.pathname}${parsed.search}`
    }
  } catch {
    return absolute
  }

  absolute = upgradeSecureMediaUrl(absolute)
  const inlinedAbsolute = inlineImageDataUrl(absolute)
  if (inlinedAbsolute) return inlinedAbsolute

  // HTTPS pages (vero360.app) block plain HTTP images. Serve them same-origin.
  // Put the filename in the path so CDNs cannot reuse one cached /api/media response.
  if (mustProxyMedia(absolute)) {
    return `/api/media/${encodeURIComponent(mediaFileName(absolute))}?u=${encodeURIComponent(absolute)}`
  }
  return absolute
}

export function mustProxyMedia(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:') return true
    return false
  } catch {
    return false
  }
}

export function isAllowedMediaHost(hostname: string) {
  const allowed = new Set<string>([
    '67.211.220.69',
    'firebasestorage.googleapis.com',
    'storage.googleapis.com',
    'vero360app-ca423.firebasestorage.app',
  ])
  try {
    allowed.add(new URL(VERO_API_BASE).hostname)
  } catch {
    // ignore
  }
  const host = hostname.trim().toLowerCase()
  if (allowed.has(host)) return true
  if (host.endsWith('.firebasestorage.app')) return true
  if (host.endsWith('.googleapis.com')) return true
  if (host === 'vero360.app' || host.endsWith('.vero360.app')) return true
  return false
}

export async function readJsonSafe(res: Response) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export function apiErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object') {
    const msg =
      (body as { message?: unknown; error?: unknown }).message ??
      (body as { error?: unknown }).error
    if (Array.isArray(msg) && msg[0]) return String(msg[0])
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}

export function unwrapList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: unknown[] }).data
  }
  return []
}

export function formatMwk(price: number) {
  if (!Number.isFinite(price) || price <= 0) return 'MWK 0'
  return `MWK ${Math.round(price).toLocaleString('en-MW')}`
}

export function formatDateTime(value?: string | null) {
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
