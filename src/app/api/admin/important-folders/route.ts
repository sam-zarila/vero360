import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import {
  createImportantFolder,
  listImportantFolders,
} from '@/lib/important-files-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const parentRaw = searchParams.get('parentId')
    const parentId =
      parentRaw === null ? null : parentRaw.trim() === '' ? null : parentRaw.trim()
    const folders = await listImportantFolders(parentId)
    return NextResponse.json({ success: true, folders })
  } catch (err) {
    console.error('Admin important-folders GET:', err)
    return NextResponse.json({ error: 'Failed to load folders' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const admin = await requirePanelAdmin(request)
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const folder = await createImportantFolder({
      name: String(body.name || ''),
      parentId:
        body.parentId === null || body.parentId === undefined || body.parentId === ''
          ? null
          : String(body.parentId),
      createdByEmail: admin.email,
    })
    return NextResponse.json({ success: true, folder }, { status: 201 })
  } catch (err) {
    console.error('Admin important-folders POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create folder' },
      { status: 400 },
    )
  }
}
