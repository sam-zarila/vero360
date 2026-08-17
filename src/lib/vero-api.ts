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

export function resolveVeroMediaUrl(image?: string | null) {
  const raw = image?.trim()
  if (!raw) return null
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw
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
