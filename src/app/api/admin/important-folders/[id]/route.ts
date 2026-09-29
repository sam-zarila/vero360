import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  deleteImportantFolder,
  renameImportantFolder,
} from '@/lib/important-files-admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const folder = await renameImportantFolder(id, String(body.name || ''))
    return NextResponse.json({ success: true, folder })
  } catch (err) {
    console.error('Admin important-folders PATCH:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to rename folder' },
      { status: 400 },
    )
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    await deleteImportantFolder(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin important-folders DELETE:', err)
    const message = err instanceof Error ? err.message : 'Failed to delete folder'
    const status = /not found/i.test(message) ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
