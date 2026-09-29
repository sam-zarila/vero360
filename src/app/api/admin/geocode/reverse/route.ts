import { NextResponse } from 'next/server'
import { authErrorResponse, requirePanelAdmin } from '@/lib/admin-auth'
import { isAgentRole, isFullAdminRole } from '@/lib/admins'

export const dynamic = 'force-dynamic'

/** Reverse-geocode lat/lng to a street / place label (OpenStreetMap Nominatim). */
export async function GET(request: Request) {
  try {
    const actor = await requirePanelAdmin(request)
    if (!isAgentRole(actor.admin.role) && !isFullAdminRole(actor.admin.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const lat = Number(url.searchParams.get('lat'))
    const lng = Number(url.searchParams.get('lng'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
    }

    const nominatim = new URL('https://nominatim.openstreetmap.org/reverse')
    nominatim.searchParams.set('format', 'jsonv2')
    nominatim.searchParams.set('lat', String(lat))
    nominatim.searchParams.set('lon', String(lng))
    nominatim.searchParams.set('zoom', '18')
    nominatim.searchParams.set('addressdetails', '1')

    const res = await fetch(nominatim.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Vero360Web/1.0 (agent-onboarding; https://vero360.app)',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Could not resolve location name' },
        { status: 502 },
      )
    }

    const data = (await res.json()) as {
      display_name?: string
      name?: string
      address?: Record<string, string>
    }

    const address = data.address || {}
    const street =
      [address.road, address.pedestrian, address.footway, address.path]
        .filter(Boolean)
        .join(' ') || ''
    const building = address.building || address.amenity || address.shop || ''
    const suburb =
      address.suburb ||
      address.neighbourhood ||
      address.quarter ||
      address.village ||
      address.hamlet ||
      ''
    const city =
      address.city ||
      address.town ||
      address.municipality ||
      address.county ||
      ''
    const parts = [building, street, suburb, city, address.state].filter(Boolean)
    const label =
      parts.length > 0
        ? Array.from(new Set(parts)).join(', ')
        : String(data.display_name || data.name || '').trim()

    return NextResponse.json({
      success: true,
      label: label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      displayName: data.display_name || label,
      lat,
      lng,
    })
  } catch (err) {
    const auth = authErrorResponse(err)
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
    console.error('Reverse geocode:', err)
    return NextResponse.json({ error: 'Could not resolve location name' }, { status: 502 })
  }
}
