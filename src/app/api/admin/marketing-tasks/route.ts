import { NextResponse } from 'next/server'
import {
  authErrorResponse,
  requirePanelAdmin,
  type VerifiedPanelAdmin,
} from '@/lib/admin-auth'
import { isFullAdminRole, isMarketerRole } from '@/lib/admins'
import {
  buildMarketingTaskCounts,
  createMarketingTask,
  listMarketingTasks,
} from '@/lib/marketing-tasks-admin'
import type { CreateMarketingTaskInput } from '@/lib/marketing-tasks'

export const dynamic = 'force-dynamic'

function actorCanSeeAll(actor: VerifiedPanelAdmin) {
  return isFullAdminRole(actor.admin.role)
}

export async function GET(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    const url = new URL(request.url)
    const marketerUidParam = url.searchParams.get('marketerUid')?.trim() || ''

    let items
    if (actorCanSeeAll(actor)) {
      items = await listMarketingTasks({
        marketerUid: marketerUidParam || undefined,
        limit: 500,
      })
    } else if (isMarketerRole(actor.admin.role)) {
      items = await listMarketingTasks({ marketerUid: actor.uid, limit: 500 })
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      items,
      counts: buildMarketingTaskCounts(items),
      me: actor.admin,
      canManageAll: actorCanSeeAll(actor),
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Marketing tasks GET:', err)
    return NextResponse.json({ error: 'Failed to load marketing tasks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    const body = (await request.json().catch(() => ({}))) as CreateMarketingTaskInput

    const isAdmin = actorCanSeeAll(actor)
    const isMarketer = isMarketerRole(actor.admin.role)
    if (!isAdmin && !isMarketer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let marketerUid = String(body.marketerUid || '').trim()
    let marketerName = String(body.marketerName || '').trim()
    let marketerEmail = String(body.marketerEmail || '').trim().toLowerCase()

    if (isMarketer) {
      marketerUid = actor.uid
      marketerName = actor.admin.displayName
      marketerEmail = actor.admin.email
    }

    if (!marketerUid) {
      return NextResponse.json({ error: 'Select a marketer' }, { status: 400 })
    }

    const item = await createMarketingTask(
      {
        ...body,
        marketerUid,
        marketerName,
        marketerEmail,
        approvedBy: isAdmin ? body.approvedBy : null,
      },
      {
        createdByUid: actor.uid,
        createdByRole: actor.admin.role,
      },
    )

    return NextResponse.json({ success: true, item }, { status: 201 })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Marketing tasks POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create task' },
      { status: 400 },
    )
  }
}
