import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { parseOpsCompanyPage } from '@/lib/car-hire-ops'
import { nestOpsFetch } from '@/lib/nest-ops'

function count(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** Lightweight poll endpoint for car-hire moderation badges / notifications. */
export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)

    const [moderation, leads, companies] = await Promise.all([
      nestOpsFetch(['car-rental', 'moderation', 'pending-count'], undefined, request),
      nestOpsFetch(['car-hire/leads?status=NEW'], undefined, request),
      nestOpsFetch(['car-rental', 'operator-reviews?status=QUEUE'], undefined, request),
    ])

    if (!moderation.res.ok && !leads.res.ok && !companies.res.ok) {
      return NextResponse.json(
        { error: moderation.error || leads.error || companies.error },
        { status: moderation.res.status || 502 },
      )
    }

    const source =
      moderation.body && typeof moderation.body === 'object'
        ? ((moderation.body as { data?: unknown }).data ?? moderation.body)
        : moderation.body
    const row = asRecord(source)

    const leadBody = asRecord(leads.body)
    const leadCounts = asRecord(leadBody.counts)
    const leadItems = Array.isArray(leadBody.items) ? leadBody.items : []
    const newLeads = count(leadCounts.NEW) || leadItems.length

    return NextResponse.json({
      success: true,
      pendingReview: count(row.pendingReview),
      suspended: count(row.suspended),
      draft: count(row.draft),
      newLeads,
      companiesQueue: companies.res.ok ? parseOpsCompanyPage(companies.body).length : 0,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Admin car-hire pending GET error:', err)
    return NextResponse.json({ error: 'Could not reach car-hire moderation API' }, { status: 502 })
  }
}
