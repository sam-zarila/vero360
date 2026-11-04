import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import {
  fetchWebsiteOverview,
  GA_CONSOLE_URL,
  GA_MEASUREMENT_ID,
  GA_PROPERTY_ID,
} from '@/lib/google-analytics'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requirePanelAdmin(request)
    const url = new URL(request.url)
    const days = Number(url.searchParams.get('days') || 28)
    const overview = await fetchWebsiteOverview({ days })
    return NextResponse.json({ success: true, overview })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const message = err instanceof Error ? err.message : 'Could not load analytics'
    console.error('Admin analytics overview:', err)
    return NextResponse.json(
      {
        error: message,
        consoleUrl: GA_CONSOLE_URL,
        propertyId: GA_PROPERTY_ID,
        measurementId: GA_MEASUREMENT_ID,
        setupHint:
          'Add the Firebase service account email as a Viewer on this GA4 property (Admin → Property access management), and enable the Google Analytics Data API on the GCP project.',
      },
      { status: 502 },
    )
  }
}
