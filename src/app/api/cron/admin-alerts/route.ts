import { NextResponse } from 'next/server'
import { scanAndPushAdminAlerts } from '@/lib/admin-alert-scan'
import { denyUnlessCronAuthorized } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function run(request: Request) {
  const denied = denyUnlessCronAuthorized(request)
  if (denied) return denied
  try {
    const result = await scanAndPushAdminAlerts()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Cron admin alerts:', err)
    return NextResponse.json({ error: 'Admin alert scan failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return run(request)
}

export async function POST(request: Request) {
  return run(request)
}
