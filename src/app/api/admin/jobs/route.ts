import { NextResponse } from 'next/server'
import {
  parseJobPost,
  parseJobPosts,
  toJobApiBody,
  type JobInput,
} from '@/lib/jobs'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

function authHeaders(request: Request, json = false): HeadersInit {
  const headers: HeadersInit = { Accept: 'application/json' }
  if (json) headers['Content-Type'] = 'application/json'
  const auth = getVeroAuthHeader(request)
  if (auth) headers.Authorization = auth
  return headers
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') ?? 'false'
    const region = searchParams.get('region')

    const qs = new URLSearchParams()
    qs.set('activeOnly', activeOnly === 'true' ? 'true' : 'false')
    if (region === 'malawi' || region === 'international') {
      qs.set('region', region)
    }

    const res = await fetch(`${veroEndpoint('jobs')}?${qs.toString()}`, {
      headers: authHeaders(request),
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(body, 'Failed to load jobs') },
        { status: res.status },
      )
    }

    const items = parseJobPosts(body)
    return NextResponse.json({
      success: true,
      items,
      counts: {
        all: items.length,
        active: items.filter(j => j.isActive).length,
        inactive: items.filter(j => !j.isActive).length,
        malawi: items.filter(j => j.region === 'malawi').length,
        international: items.filter(j => j.region === 'international').length,
        manual: items.filter(j => j.source === 'manual').length,
        synced: items.filter(j => j.source !== 'manual').length,
      },
    })
  } catch (err) {
    console.error('Admin jobs GET error:', err)
    return NextResponse.json({ error: 'Could not reach jobs API' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const input = (raw || {}) as Partial<JobInput>
    // Always ensure jobLink for create — Nest requires a URL.
    if (!input.jobLink?.trim()) {
      input.jobLink = 'https://vero360.app/careers'
    }
    const payload = toJobApiBody(input, { partial: false })
    if (!payload.jobLink) {
      payload.jobLink = 'https://vero360.app/careers'
    }

    const res = await fetch(veroEndpoint('jobs'), {
      method: 'POST',
      headers: authHeaders(request, true),
      body: JSON.stringify(payload),
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(body, 'Failed to create job') },
        { status: res.status },
      )
    }

    const item = parseJobPost(body)
    return NextResponse.json({ success: true, item: item || body }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message && !err.message.includes('fetch')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('Admin jobs POST error:', err)
    return NextResponse.json({ error: 'Could not create job' }, { status: 502 })
  }
}
