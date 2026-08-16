import { NextResponse } from 'next/server'
import { isAllowedMediaHost } from '@/lib/vero-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 12 * 1024 * 1024

/**
 * Same-origin image proxy so HTTPS admin pages can load HTTP backend uploads
 * without mixed-content blocking.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('u')?.trim()
  if (!raw) {
    return NextResponse.json({ error: 'Missing image url' }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid image url' }, { status: 400 })
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 })
  }
  if (!isAllowedMediaHost(target.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 })
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { Accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow',
      cache: 'no-store',
    })
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: upstream.status === 404 ? 404 : 502 },
      )
    }

    const finalHost = (() => {
      try {
        return new URL(upstream.url).hostname
      } catch {
        return target.hostname
      }
    })()
    if (!isAllowedMediaHost(finalHost)) {
      return NextResponse.json({ error: 'Redirect host not allowed' }, { status: 403 })
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    if (contentType.startsWith('text/') || contentType.includes('json')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 502 })
    }

    const length = Number(upstream.headers.get('content-length') || 0)
    if (length > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 })
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    })
  } catch (err) {
    console.error('Media proxy error:', err)
    return NextResponse.json({ error: 'Could not load image' }, { status: 502 })
  }
}
