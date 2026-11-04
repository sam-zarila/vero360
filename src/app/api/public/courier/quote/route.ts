import { NextResponse } from 'next/server'
import {
  assertCourierWeight,
  COURIER_CITY,
  estimateCourierPrice,
  isLilongweCity,
  parseCourierWeightKg,
} from '@/lib/courier-pricing'
import {
  parseOptionalCoord,
  resolveCourierPoint,
  roadDistanceKm,
} from '@/lib/courier-geocode'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const city = String(body.city || COURIER_CITY)
    if (!isLilongweCity(city)) {
      return NextResponse.json(
        { error: 'Vero Courier is currently Lilongwe only.' },
        { status: 400 },
      )
    }

    const goodsType = String(body.goodsType || 'Other')
    const description = String(body.description || '')
    const weightKg = assertCourierWeight({
      goodsType,
      weightKg: parseCourierWeightKg(body.weightKg ?? body.weight),
    })

    let distanceKm = Number(body.distanceKm)
    let fromLabel = String(body.pickupLocation || body.pickup || '').trim()
    let toLabel = String(body.dropoffLocation || body.dropoff || '').trim()

    const pickupLat = parseOptionalCoord(body.pickupLat)
    const pickupLng = parseOptionalCoord(body.pickupLng)
    const dropoffLat = parseOptionalCoord(body.dropoffLat)
    const dropoffLng = parseOptionalCoord(body.dropoffLng)
    const hasPickupCoords = pickupLat != null && pickupLng != null
    const hasDropoffCoords = dropoffLat != null && dropoffLng != null

    if (fromLabel.length >= 3 || toLabel.length >= 3 || hasPickupCoords || hasDropoffCoords) {
      try {
        const [from, to] = await Promise.all([
          resolveCourierPoint({
            label: fromLabel,
            lat: pickupLat,
            lng: pickupLng,
          }),
          resolveCourierPoint({
            label: toLabel,
            lat: dropoffLat,
            lng: dropoffLng,
          }),
        ])
        fromLabel = from.label || fromLabel
        toLabel = to.label || toLabel
        distanceKm = roadDistanceKm(from, to)
        if (distanceKm < 0.05) {
          return NextResponse.json(
            {
              error:
                'Pickup and drop-off look like the same place. Set two different Lilongwe locations.',
            },
            { status: 400 },
          )
        }
      } catch (err) {
        if (!(Number.isFinite(distanceKm) && distanceKm > 0)) {
          throw err
        }
      }
    }

    if (!(Number.isFinite(distanceKm) && distanceKm > 0)) {
      distanceKm = 6
    }

    const quote = estimateCourierPrice({
      distanceKm,
      goodsType,
      description,
      weightKg,
    })

    return NextResponse.json({
      success: true,
      city: COURIER_CITY,
      pickupLocation: fromLabel || null,
      dropoffLocation: toLabel || null,
      quote,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not quote' },
      { status: 400 },
    )
  }
}
