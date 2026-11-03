/** Public marketing origin (landing, guest checkout, partner manage). */
export const DEFAULT_PUBLIC_ORIGIN = 'https://vero360.app'
/** Admin panel origin. Must stay a different host than the public site. */
export const DEFAULT_ADMIN_ORIGIN = 'https://admin.vero360.app'
/** Set by middleware so layouts know which surface the request is on. */
export const VERO_SURFACE_HEADER = 'x-vero-surface'

const DEFAULT_PUBLIC_HOSTS = ['vero360.app', 'www.vero360.app'] as const
const DEFAULT_ADMIN_HOSTS = ['admin.vero360.app'] as const

function trimOrigin(value: string): string {
  return value.replace(/\/$/, '')
}

function hostnameFromUrl(value: string | undefined | null): string | null {
  if (!value?.trim()) return null
  try {
    const raw = value.includes('://') ? value : `https://${value}`
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return null
  }
}

function parseHostList(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
}

function uniqueHosts(hosts: Array<string | null | undefined>): string[] {
  return [...new Set(hosts.filter((host): host is string => Boolean(host)))]
}

export function getPublicOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  return trimOrigin(fromEnv || DEFAULT_PUBLIC_ORIGIN)
}

/**
 * Admin origin for emails and absolute panel links.
 *
 * When no dedicated admin host is configured, the panel lives on the same
 * origin as the public site. That is the normal single-server (pm2) setup, so
 * never invent an `admin.` subdomain the operator has not pointed at this app.
 */
export function getAdminOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ADMIN_URL?.trim()
  if (fromEnv) return trimOrigin(fromEnv)
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (site) return trimOrigin(site)
  return DEFAULT_ADMIN_ORIGIN
}

/**
 * True when the panel and the public site share one origin (IP address, single
 * domain, or a loopback admin URL). Redirecting between "surfaces" would then
 * bounce visitors to an unreachable host, so paths decide the surface instead.
 */
export function isSingleHostDeployment(): boolean {
  const adminFromEnv = process.env.NEXT_PUBLIC_ADMIN_URL?.trim()
  // No dedicated admin host configured: keep the panel where the site is served.
  if (!adminFromEnv) return true
  const adminHost = hostnameFromUrl(adminFromEnv)
  const publicHost = hostnameFromUrl(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_ORIGIN,
  )
  if (!adminHost || !publicHost) return true
  // A loopback admin origin only exists on the machine running `next dev`.
  if (isLocalHost(adminHost)) return true
  return adminHost === publicHost
}

export function getAdminPanelUrl(path = '/dashboard'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getAdminOrigin()}${normalized}`
}

export function getPublicHosts(): string[] {
  return uniqueHosts([
    ...DEFAULT_PUBLIC_HOSTS,
    hostnameFromUrl(getPublicOrigin()),
    ...parseHostList(process.env.NEXT_PUBLIC_PUBLIC_HOSTS),
    ...parseHostList(process.env.PUBLIC_HOSTS),
  ])
}

export function getAdminHosts(): string[] {
  const adminHost = hostnameFromUrl(getAdminOrigin())
  return uniqueHosts([
    ...DEFAULT_ADMIN_HOSTS,
    isSingleHostDeployment() ? null : adminHost,
    ...parseHostList(process.env.NEXT_PUBLIC_ADMIN_HOSTS),
    ...parseHostList(process.env.ADMIN_HOSTS),
  ])
}

export function normalizeHost(host: string | null | undefined): string {
  if (!host) return ''
  return host.split(',')[0]!.trim().split(':')[0]!.toLowerCase()
}

export function requestHost(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-host')
  return normalizeHost(forwarded || request.headers.get('host'))
}

export function requestHostFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-host')
  return normalizeHost(forwarded || headers.get('host'))
}

export function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.localhost')
  )
}

export function isPreviewHost(host: string): boolean {
  return host.endsWith('.netlify.app') || host.endsWith('.vercel.app')
}

/** Local + Netlify/Vercel previews serve both surfaces so deploys stay usable. */
export function isDevPassthroughHost(host: string): boolean {
  return isLocalHost(host) || isPreviewHost(host)
}

export function isKnownAdminHost(host: string): boolean {
  return getAdminHosts().includes(host)
}

export function isKnownPublicHost(host: string): boolean {
  return getPublicHosts().includes(host)
}

/** Admin APIs are allowed on the admin host, and on local/preview. */
export function isAdminApiAllowedHost(host: string): boolean {
  if (!host) return false
  if (isDevPassthroughHost(host)) return true
  return isKnownAdminHost(host)
}

export function isStrictAdminHost(host: string): boolean {
  return Boolean(host) && isKnownAdminHost(host) && !isDevPassthroughHost(host)
}

export function isDashboardPath(pathname: string): boolean {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/')
}

export function isAdminApiPath(pathname: string): boolean {
  return pathname === '/api/admin' || pathname.startsWith('/api/admin/')
}

export function isCronPath(pathname: string): boolean {
  return pathname === '/api/cron' || pathname.startsWith('/api/cron/')
}

export function isAdminSurfacePath(pathname: string): boolean {
  return isDashboardPath(pathname) || isAdminApiPath(pathname) || isCronPath(pathname)
}

export function isStaticAssetPath(pathname: string): boolean {
  if (pathname.startsWith('/_next/')) return true
  if (
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return true
  }
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}

export function isAllowedOnAdminHost(pathname: string): boolean {
  return isAdminSurfacePath(pathname) || isStaticAssetPath(pathname)
}

export type VeroSurface = 'admin' | 'public'

export function surfaceForRequest(host: string, pathname: string): VeroSurface {
  if (isDevPassthroughHost(host)) {
    return isAdminSurfacePath(pathname) ? 'admin' : 'public'
  }
  if (isKnownAdminHost(host)) return 'admin'
  return 'public'
}

export function firebaseStorageUploadOrigins(extraOrigin?: string): string[] {
  const origins = uniqueHosts([
    'https://vero360.app',
    'https://www.vero360.app',
    DEFAULT_ADMIN_ORIGIN,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    getPublicOrigin(),
    getAdminOrigin(),
    extraOrigin && /^https?:\/\//.test(extraOrigin) ? extraOrigin : null,
  ])
  return origins
}

export function adminContentSecurityPolicy(): string {
  const apiHost = hostnameFromUrl(
    process.env.NEXT_PUBLIC_VERO_API_BASE || process.env.VERO_API_BASE,
  )
  const connect = [
    "'self'",
    'https://*.googleapis.com',
    'https://*.gstatic.com',
    'https://*.google-analytics.com',
    'https://*.firebaseio.com',
    'https://*.firebasedatabase.app',
    'https://*.firebaseapp.com',
    'https://*.firebasestorage.app',
    'https://firebasestorage.googleapis.com',
    'wss://*.firebaseio.com',
    'wss://*.firebasedatabase.app',
    apiHost ? `https://${apiHost}` : null,
    apiHost ? `http://${apiHost}` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    // The panel pages are statically prerendered React shells, so a per-request
    // nonce can never be baked into their inline hydration scripts. Blocking
    // inline scripts here silently left the panel stuck on "Checking admin
    // access…" because React never hydrated.
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "frame-src 'self' https://*.firebaseapp.com https://*.google.com",
    "worker-src 'self' blob:",
  ].join('; ')
}
