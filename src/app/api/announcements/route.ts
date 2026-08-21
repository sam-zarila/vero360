import { NextResponse } from 'next/server'
import { listPublicAnnouncements } from '@/lib/announcements-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await listPublicAnnouncements(12)
    return NextResponse.json({ success: true, items })
  } catch (err) {
    console.error('Public announcements GET:', err)
    return NextResponse.json({ error: 'Failed to load announcements' }, { status: 500 })
  }
}
