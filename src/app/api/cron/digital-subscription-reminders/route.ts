import { NextResponse } from 'next/server'
import { denyUnlessCronAuthorized } from '@/lib/cron-auth'
import { sendDueSubscriptionReminders } from '@/lib/digital-subscription-reminders'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Daily reminders for subscriptions ending within 10 days. */
export async function GET(request: Request) {
  const denied = denyUnlessCronAuthorized(request)
  if (denied) return denied

  try {
    const result = await sendDueSubscriptionReminders()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Subscription reminder cron:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Subscription reminders failed' },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
