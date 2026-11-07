import { NextResponse } from 'next/server'
import {
  authErrorResponse,
  requirePanelAdmin,
  type VerifiedPanelAdmin,
} from '@/lib/admin-auth'
import { isFullAdminRole, isMarketerRole } from '@/lib/admins'
import {
  createMarketingCampaign,
  listMarketingCampaigns,
} from '@/lib/marketing-campaigns-admin'
import type { CreateMarketingCampaignInput } from '@/lib/marketing-campaigns'
import { recordPanelAudit } from '@/lib/audit-trail-admin'

export const dynamic = 'force-dynamic'

function canAccess(actor: VerifiedPanelAdmin) {
  return isFullAdminRole(actor.admin.role) || isMarketerRole(actor.admin.role)
}

export async function GET(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!canAccess(actor)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const items = await listMarketingCampaigns({ limit: 200 })
    return NextResponse.json({ success: true, items })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Marketing campaigns GET:', err)
    return NextResponse.json({ error: 'Failed to load campaigns' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!canAccess(actor)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = (await request.json().catch(() => ({}))) as CreateMarketingCampaignInput
    const item = await createMarketingCampaign(body, {
      uid: actor.uid,
      displayName: actor.admin.displayName,
    })
    await recordPanelAudit(actor, {
      action: 'marketing_campaign.create',
      resource: 'marketing_campaign',
      resourceId: item.id,
      summary: `Created campaign ${item.name}`,
    })
    return NextResponse.json({ success: true, item })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const message = err instanceof Error ? err.message : 'Failed to create campaign'
    console.error('Marketing campaigns POST:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
