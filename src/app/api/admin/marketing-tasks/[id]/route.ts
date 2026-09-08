import { NextResponse } from 'next/server'
import {
  authErrorResponse,
  requirePanelAdmin,
} from '@/lib/admin-auth'
import { isFullAdminRole, isMarketerRole } from '@/lib/admins'
import {
  deleteMarketingTask,
  getMarketingTask,
  updateMarketingTask,
} from '@/lib/marketing-tasks-admin'
import type { UpdateMarketingTaskInput } from '@/lib/marketing-tasks'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    const { id } = await ctx.params
    const item = await getMarketingTask(id)
    if (!item) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    if (isMarketerRole(actor.admin.role) && item.marketerUid !== actor.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!isFullAdminRole(actor.admin.role) && !isMarketerRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true, item })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ error: 'Failed to load task' }, { status: 500 })
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    const { id } = await ctx.params
    const existing = await getMarketingTask(id)
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    const isAdmin = isFullAdminRole(actor.admin.role)
    const isMarketer = isMarketerRole(actor.admin.role)

    if (!isAdmin && !isMarketer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (isMarketer && existing.marketerUid !== actor.uid) {
      return NextResponse.json({ error: 'You can only edit your own tasks' }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as UpdateMarketingTaskInput & {
      action?: string
    }

    if (body.action === 'approve') {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Only admins can approve tasks' }, { status: 403 })
      }
      const item = await updateMarketingTask(
        id,
        {
          approvedBy: actor.admin.displayName || actor.admin.email,
          status: body.status || existing.status,
        },
        { allowAssignee: true, allowApprovedBy: true },
      )
      return NextResponse.json({ success: true, item, message: 'Task approved' })
    }

    const patch: UpdateMarketingTaskInput = {
      taskTitle: body.taskTitle,
      category: body.category,
      platform: body.platform,
      dueDate: body.dueDate,
      status: body.status,
      dateCompleted: body.dateCompleted,
      notes: body.notes,
      dateAssigned: body.dateAssigned,
    }

    if (isAdmin) {
      patch.marketerUid = body.marketerUid
      patch.marketerName = body.marketerName
      patch.marketerEmail = body.marketerEmail
      patch.approvedBy = body.approvedBy
    }

    const item = await updateMarketingTask(id, patch, {
      allowAssignee: isAdmin,
      allowApprovedBy: isAdmin,
    })
    return NextResponse.json({ success: true, item })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Marketing tasks PATCH:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update task' },
      { status: 400 },
    )
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePanelAdmin(request)
    const { id } = await ctx.params
    const existing = await getMarketingTask(id)
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    const isAdmin = isFullAdminRole(actor.admin.role)
    const isMarketer = isMarketerRole(actor.admin.role)

    if (isAdmin) {
      await deleteMarketingTask(id)
      return NextResponse.json({ success: true })
    }

    if (isMarketer && existing.marketerUid === actor.uid) {
      await deleteMarketingTask(id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete task' },
      { status: 400 },
    )
  }
}
