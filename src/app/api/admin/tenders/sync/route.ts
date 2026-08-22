import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { fetchAllMalawiTenders } from '@/lib/malawi-tender-sources'
import { upsertSyncedTender } from '@/lib/tenders-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Pull Malawi tenders from:
 * - malawitenders.com
 * - maneps.mw/procurement-notice
 * - ppda.mw/tenders
 */
export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const { tenders, results } = await fetchAllMalawiTenders({ perSource: 50 })

    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const draft of tenders) {
      try {
        const outcome = await upsertSyncedTender({
          title: draft.title,
          description: draft.description,
          buyer: draft.buyer,
          reference: draft.reference,
          location: draft.location,
          publishedAt: draft.publishedAt,
          closingAt: draft.closingAt,
          tenderUrl: draft.tenderUrl,
          documentUrl: draft.documentUrl,
          source: draft.source,
          externalId: draft.externalId,
          active: true,
        })
        if (outcome === 'created') created += 1
        else if (outcome === 'updated') updated += 1
        else skipped += 1
      } catch (err) {
        errors.push(
          `${draft.source}:${draft.externalId} — ${
            err instanceof Error ? err.message : 'upsert failed'
          }`,
        )
      }
    }

    for (const r of results) {
      if (!r.ok && r.error) errors.push(`${r.source}: ${r.error}`)
    }

    return NextResponse.json({
      success: true,
      fetched: tenders.length,
      created,
      updated,
      skipped,
      sources: results,
      errors: errors.slice(0, 12),
    })
  } catch (err) {
    console.error('Admin Malawi tenders sync error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not sync Malawi tenders' },
      { status: 502 },
    )
  }
}
