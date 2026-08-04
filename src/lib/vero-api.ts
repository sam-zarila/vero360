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

/** Prefer client Authorization header, else server env token. */
export function getVeroAuthHeader(request?: Request) {
  const fromClient = request?.headers.get('authorization')
  if (fromClient) return fromClient
  const token = getVeroAdminToken()
  return token ? `Bearer ${token}` : null
}

export function resolveVeroMediaUrl(image?: string | null) {
  const raw = image?.trim()
  if (!raw) return null
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  if (raw.startsWith('/')) return `${VERO_API_BASE}${raw}`
  return `${VERO_API_BASE}/${raw}`
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
