import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  deleteImportantFile,
  updateImportantFile,
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
    const item = await updateImportantFile(id, {
      name: body.name !== undefined ? String(body.name) : undefined,
      usage: body.usage !== undefined ? String(body.usage) : undefined,
    })
    return NextResponse.json({ success: true, item })
  } catch (err) {
    console.error('Admin important-files PATCH:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update file' },
      { status: 400 },
    )
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    await deleteImportantFile(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin important-files DELETE:', err)
    const message = err instanceof Error ? err.message : 'Failed to delete file'
    const status = /not found/i.test(message) ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
