import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import {
  buildFolderBreadcrumb,
  createImportantFile,
  listImportantFiles,
  listImportantFolders,
} from '@/lib/important-files-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const folderId = (searchParams.get('folderId') || '').trim()
    if (!folderId) {
      return NextResponse.json({ error: 'folderId is required' }, { status: 400 })
    }

    const [files, folders, breadcrumb] = await Promise.all([
      listImportantFiles(folderId),
      listImportantFolders(folderId),
      buildFolderBreadcrumb(folderId),
    ])

    return NextResponse.json({
      success: true,
      files,
      folders,
      breadcrumb,
    })
  } catch (err) {
    console.error('Admin important-files GET:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load files' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const admin = await requirePanelAdmin(request)
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Upload files with multipart form data' },
        { status: 400 },
      )
    }

    const form = await request.formData()
    const folderId = String(form.get('folderId') ?? '').trim()
    const name = String(form.get('name') ?? '').trim()
    const usage = String(form.get('usage') ?? '').trim()
    const file = form.get('file')

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: 'A file upload is required' }, { status: 400 })
    }

    const item = await createImportantFile({
      folderId,
      name: name || file.name,
      usage,
      file,
      createdByEmail: admin.email,
    })

    return NextResponse.json({ success: true, item }, { status: 201 })
  } catch (err) {
    console.error('Admin important-files POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to upload file' },
      { status: 400 },
    )
  }
}
