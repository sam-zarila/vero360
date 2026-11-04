import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  adminContentSecurityPolicy,
  getAdminOrigin,
  getPublicOrigin,
  isAdminApiPath,
  isAdminSurfacePath,
  isAllowedOnAdminHost,
  isCronPath,
  isDashboardPath,
  isDevPassthroughHost,
  isKnownAdminHost,
  isSingleHostDeployment,
  isStaticAssetPath,
  requestHost,
  surfaceForRequest,
  VERO_SURFACE_HEADER,
  type VeroSurface,
} from '@/lib/site-hosts'

function withSurface(request: NextRequest, surface: VeroSurface): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(VERO_SURFACE_HEADER, surface)
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  applySecurityHeaders(response, surface, request.nextUrl.pathname)
  return response
}

function applySecurityHeaders(
  response: NextResponse,
  surface: VeroSurface,
  pathname: string,
) {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  // Public site may use GPS for Vero Courier pickup; admin keeps geolocation off.
  response.headers.set(
    'Permissions-Policy',
    surface === 'admin'
      ? 'camera=(), microphone=(), geolocation=(), payment=()'
      : 'camera=(), microphone=(), geolocation=(self), payment=()',
  )
  if (surface === 'admin') {
    response.headers.set('Referrer-Policy', 'same-origin')
    if (!isStaticAssetPath(pathname) || pathname === '/robots.txt') {
      response.headers.set('Content-Security-Policy', adminContentSecurityPolicy())
    }
    if (isDashboardPath(pathname)) {
      response.headers.set('Cache-Control', 'no-store')
    }
    return
  }
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
}

function redirectTo(origin: string, request: NextRequest): NextResponse {
  const url = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    `${origin.replace(/\/$/, '')}/`,
  )
  return NextResponse.redirect(url, 308)
}

function notFoundJson(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function middleware(request: NextRequest) {
  const host = requestHost(request)
  const { pathname } = request.nextUrl

  if (isDevPassthroughHost(host)) {
    return withSurface(request, surfaceForRequest(host, pathname))
  }

  // Single-origin deployments (IP address, one domain, or the pm2/VPS setup)
  // serve the public site and the admin panel from the same host. Redirecting
  // /dashboard to another host would send visitors to an unreachable address,
  // so the path decides the surface instead.
  if (isSingleHostDeployment()) {
    const surface: VeroSurface = isAdminSurfacePath(pathname) ? 'admin' : 'public'
    return withSurface(request, surface)
  }

  const surface = surfaceForRequest(host, pathname)

  if (isKnownAdminHost(host)) {
    if (isAllowedOnAdminHost(pathname)) {
      return withSurface(request, 'admin')
    }
    return redirectTo(getPublicOrigin(), request)
  }

  if (isAdminApiPath(pathname) || isCronPath(pathname)) {
    return notFoundJson()
  }

  if (isDashboardPath(pathname)) {
    return redirectTo(getAdminOrigin(), request)
  }

  return withSurface(request, surface)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
