import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { uploadDigitalFulfillmentFile } from '@/lib/digital-services-config'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Upload with multipart form data' },
        { status: 400 },
      )
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: 'A file is required' }, { status: 400 })
    }

    const fileUrl = await uploadDigitalFulfillmentFile(file)
    return NextResponse.json({ success: true, fileUrl })
  } catch (err) {
    console.error('Admin digital fulfillment file upload:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    )
  }
}
