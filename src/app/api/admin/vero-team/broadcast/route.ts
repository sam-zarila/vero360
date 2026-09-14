import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin, requirePanelAdmin } from '@/lib/admin-auth'
import {
  listVeroTeamBroadcasts,
  sendVeroTeamBroadcast,
  type VeroTeamBroadcastKind,
} from '@/lib/vero-team-broadcast'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const items = await listVeroTeamBroadcasts(40)
    return NextResponse.json({ success: true, items })
  } catch (err) {
    console.error('Admin vero-team broadcast GET:', err)
    return NextResponse.json(
      { error: 'Failed to load Team messages' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const admin = await requirePanelAdmin(request)
    const json = (await request.json().catch(() => null)) as {
      title?: string
      body?: string
      kind?: string
    } | null
    if (!json) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const kindRaw = String(json.kind || 'general').trim().toLowerCase()
    const kind: VeroTeamBroadcastKind =
      kindRaw === 'app_update' ? 'app_update' : 'general'

    const result = await sendVeroTeamBroadcast({
      title: String(json.title || ''),
      body: String(json.body || ''),
      kind,
      updatedByEmail: admin.email,
    })

    if (result.fcmSuccessCount <= 0) {
      return NextResponse.json(
        {
          error:
            result.broadcast.fcmError ||
            'Message saved in Team chat, but push notification failed',
          broadcast: result.broadcast,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      broadcast: result.broadcast,
      topics: result.topics,
      message:
        kind === 'app_update'
          ? 'Update message posted in Vero360 Team chat and pushed to everyone.'
          : 'Message posted in Vero360 Team chat and pushed to everyone.',
    })
  } catch (err) {
    console.error('Admin vero-team broadcast POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send' },
      { status: 500 },
    )
  }
}
