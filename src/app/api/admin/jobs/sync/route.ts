import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'

/** Triggers Nest `POST /jobs/sync` (Remotive + Jooble). */
export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const headers: HeadersInit = { Accept: 'application/json' }
    const auth = getVeroAuthHeader(request)
    if (auth) headers.Authorization = auth

    const res = await fetch(veroEndpoint('jobs', 'sync'), {
      method: 'POST',
      headers,
    })
    const body = await readJsonSafe(res)
    if (!res.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(body, 'Job sync failed') },
        { status: res.status },
      )
    }
    return NextResponse.json({ success: true, result: body })
  } catch (err) {
    console.error('Admin jobs sync error:', err)
    return NextResponse.json({ error: 'Could not sync jobs' }, { status: 502 })
  }
}
