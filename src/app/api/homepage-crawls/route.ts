import { NextResponse } from 'next/server'
import { listHomepageCrawls } from '@/lib/homepage-crawls-admin'

export const dynamic = 'force-dynamic'

/** Public active crawls for the Vero360 app home ticker. */
export async function GET() {
  try {
    const items = await listHomepageCrawls({ activeOnly: true, limit: 40 })
    return NextResponse.json({
      success: true,
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        subtitle: i.subtitle,
        linkType: i.linkType,
        linkId: i.linkId,
        latestVersion: i.latestVersion,
      })),
    })
  } catch (err) {
    console.error('Public homepage crawls GET:', err)
    return NextResponse.json({ error: 'Failed to load crawls' }, { status: 500 })
  }
}
