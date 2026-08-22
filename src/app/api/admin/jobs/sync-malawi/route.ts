import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { parseJobPosts, toJobApiBody } from '@/lib/jobs'

import {
  apiErrorMessage,
  getVeroAuthHeader,
  readJsonSafe,
  veroEndpoint,
} from '@/lib/vero-api'
import { fetchAllMalawiJobs } from '@/lib/malawi-job-sources'

/**
 * Pull Malawi listings from onlinejobmw.com, jobsearchmalawi.com, and mwayi.mw,
 * then create any that are not already in Nest (matched by externalId or jobLink).
 */
export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const auth = getVeroAuthHeader(request)
    const jsonHeaders: HeadersInit = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    }
    const getHeaders: HeadersInit = {
      Accept: 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    }

    const existingRes = await fetch(
      `${veroEndpoint('jobs')}?activeOnly=false&region=malawi`,
      { headers: getHeaders, cache: 'no-store' },
    )
    const existingBody = await readJsonSafe(existingRes)
    if (!existingRes.ok) {
      return NextResponse.json(
        { error: apiErrorMessage(existingBody, 'Failed to load existing Malawi jobs') },
        { status: existingRes.status },
      )
    }

    const existing = parseJobPosts(existingBody)
    const knownExternal = new Set(
      existing
        .map(j => (j.externalId || '').trim().toLowerCase())
        .filter(Boolean),
    )
    const knownLinks = new Set(
      existing.map(j => j.jobLink.trim().toLowerCase()).filter(Boolean),
    )

    const { jobs, results } = await fetchAllMalawiJobs({ perSource: 40 })

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const draft of jobs) {
      const ext = draft.externalId.toLowerCase()
      const link = draft.jobLink.toLowerCase()
      if (knownExternal.has(ext) || knownLinks.has(link)) {
        skipped += 1
        continue
      }

      try {
        const payload = toJobApiBody({
          position: draft.position,
          description: draft.description || draft.position,
          jobLink: draft.jobLink,
          photoUrl: draft.photoUrl,
          isActive: true,
          region: 'malawi',
          company: draft.company,
          location: draft.location,
          isRemote: draft.isRemote,
          source: draft.source,
          externalId: draft.externalId,
        })

        const res = await fetch(veroEndpoint('jobs'), {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(payload),
        })
        const body = await readJsonSafe(res)
        if (!res.ok) {
          errors.push(
            `${draft.source}:${draft.externalId} — ${apiErrorMessage(body, 'create failed')}`,
          )
          continue
        }
        created += 1
        knownExternal.add(ext)
        knownLinks.add(link)
      } catch (err) {
        errors.push(
          `${draft.source}:${draft.externalId} — ${
            err instanceof Error ? err.message : 'create failed'
          }`,
        )
      }
    }

    return NextResponse.json({
      success: true,
      fetched: jobs.length,
      created,
      skipped,
      sources: results,
      errors: errors.slice(0, 12),
    })
  } catch (err) {
    console.error('Admin Malawi jobs sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not sync Malawi jobs' },
      { status: 502 },
    )
  }
}
