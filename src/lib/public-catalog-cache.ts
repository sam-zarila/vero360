import { NextResponse } from 'next/server'

/** Short CDN/browser cache for public catalog JSON. */
export const PUBLIC_CATALOG_CACHE =
  'public, s-maxage=60, stale-while-revalidate=300'

export function publicCatalogJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      'Cache-Control': PUBLIC_CATALOG_CACHE,
    },
  })
}
