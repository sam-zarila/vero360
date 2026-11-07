import { NextResponse } from 'next/server'
import {
  authErrorResponse,
  requirePanelAdmin,
  type VerifiedPanelAdmin,
} from '@/lib/admin-auth'
import { isFullAdminRole, isMarketerRole } from '@/lib/admins'
import {
  countAttributedSignups,
  deleteMarketingCampaign,
  getMarketingCampaign,
  updateMarketingCampaign,
} from '@/lib/marketing-campaigns-admin'
import { buildTrackedLinks } from '@/lib/marketing-campaigns'
import type { UpdateMarketingCampaignInput } from '@/lib/marketing-campaigns'
import { listMarketingTasks } from '@/lib/marketing-tasks-admin'
import { fetchCampaignTraffic } from '@/lib/google-analytics'
import { recordPanelAudit } from '@/lib/audit-trail-admin'

export const dynamic = 'force-dynamic'

function canAccess(actor: VerifiedPanelAdmin) {
  return isFullAdminRole(actor.admin.role) || isMarketerRole(actor.admin.role)
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!canAccess(actor)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await context.params
    const item = await getMarketingCampaign(id)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const tasks = await listMarketingTasks({ limit: 500 })
    const linkedTasks = tasks.filter(t => t.campaignId === item.id)
    const attributedSignups = await countAttributedSignups(item.utmCampaign)
    let campaignTraffic = null
    try {
      campaignTraffic = await fetchCampaignTraffic({
        utmCampaign: item.utmCampaign,
        days: 28,
      })
    } catch {
      campaignTraffic = null
    }

    return NextResponse.json({
      success: true,
      item,
      links: buildTrackedLinks(item),
      linkedTasks,
      performance: {
        attributedSignups,
        linkedTaskCount: linkedTasks.length,
        completedTasks: linkedTasks.filter(t => t.status === 'completed').length,
        website: campaignTraffic,
      },
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Marketing campaign GET:', err)
    return NextResponse.json({ error: 'Failed to load campaign' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!canAccess(actor)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as UpdateMarketingCampaignInput
    const item = await updateMarketingCampaign(id, body)
    await recordPanelAudit(actor, {
      action: 'marketing_campaign.update',
      resource: 'marketing_campaign',
      resourceId: item.id,
      summary: `Updated campaign ${item.name}`,
    })
    return NextResponse.json({
      success: true,
      item,
      links: buildTrackedLinks(item),
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const message = err instanceof Error ? err.message : 'Failed to update campaign'
    console.error('Marketing campaign PATCH:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await context.params
    await deleteMarketingCampaign(id)
    await recordPanelAudit(actor, {
      action: 'marketing_campaign.delete',
      resource: 'marketing_campaign',
      resourceId: id,
      summary: `Deleted campaign ${id}`,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Marketing campaign DELETE:', err)
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
}
