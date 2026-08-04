import { NextResponse } from 'next/server'
import { parseJobPost, toJobApiBody, type JobInput } from '@/lib/jobs'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

type Ctx = { params: Promise<{ id: string }> }

function authHeaders(request: Request, json = false): HeadersInit {
  const headers: HeadersInit = { Accept: 'application/json' }
  if (json) headers['Content-Type'] = 'application/json'
  const auth = getVeroAuthHeader(request)
  if (auth) headers.Authorization = auth
  return headers
}

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const jobId = Number(id)
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  try {
    const res = await fetch(veroEndpoint('jobs', jobId), {
      headers: authHeaders(request),
      cache: 'no-store',
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(body, 'Job not found') },
        { status: res.status },
      )
    }
    const item = parseJobPost(body)
    return NextResponse.json({ success: true, item: item || body })
  } catch (err) {
    console.error('Admin job GET error:', err)
    return NextResponse.json({ error: 'Could not load job' }, { status: 502 })
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const jobId = Number(id)
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const input = (raw || {}) as Partial<JobInput>
    const payload = toJobApiBody(input, { partial: true })
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const res = await fetch(veroEndpoint('jobs', jobId), {
      method: 'PATCH',
      headers: authHeaders(request, true),
      body: JSON.stringify(payload),
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(body, 'Failed to update job') },
        { status: res.status },
      )
    }

    const item = parseJobPost(body)
    return NextResponse.json({ success: true, item: item || body })
  } catch (err) {
    if (err instanceof Error && err.message && !err.message.includes('fetch')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('Admin job PATCH error:', err)
    return NextResponse.json({ error: 'Could not update job' }, { status: 502 })
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const jobId = Number(id)
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  try {
    const res = await fetch(veroEndpoint('jobs', jobId), {
      method: 'DELETE',
      headers: authHeaders(request),
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(body, 'Failed to delete job') },
        { status: res.status },
      )
    }
    return NextResponse.json({ success: true, deleted: true, id: jobId })
  } catch (err) {
    console.error('Admin job DELETE error:', err)
    return NextResponse.json({ error: 'Could not delete job' }, { status: 502 })
  }
}
