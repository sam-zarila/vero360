import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  adminContentSecurityPolicy,
  getAdminOrigin,
  getPublicOrigin,
  isAdminApiPath,
  isAllowedOnAdminHost,
  isCronPath,
  isDashboardPath,
  isDevPassthroughHost,
  isKnownAdminHost,
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
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
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
  const surface = surfaceForRequest(host, pathname)

  if (isDevPassthroughHost(host)) {
    return withSurface(request, surface)
  }

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

  return withSurface(request, 'public')
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
