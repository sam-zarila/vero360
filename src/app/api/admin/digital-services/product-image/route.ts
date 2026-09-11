import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { uploadDigitalProductImage } from '@/lib/digital-services-config'

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
      return NextResponse.json({ error: 'A photo is required' }, { status: 400 })
    }

    const imageUrl = await uploadDigitalProductImage(file)
    return NextResponse.json({ success: true, imageUrl })
  } catch (err) {
    console.error('Admin digital product image upload:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    )
  }
}
