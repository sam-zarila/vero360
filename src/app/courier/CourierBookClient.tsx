'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
import GuestBuyForm, {
  guestFieldInput,
  guestFieldLabel,
} from '@/app/components/open-listing/GuestBuyForm'
import {
  COURIER_CITY,
  COURIER_GOODS_TYPES,
  courierWeightRequired,
  type CourierPriceQuote,
} from '@/lib/courier-pricing'

type LatLng = { lat: number; lng: number }

export default function CourierBookClient() {
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [pickupPoint, setPickupPoint] = useState<LatLng | null>(null)
  const [goodsType, setGoodsType] = useState<(typeof COURIER_GOODS_TYPES)[number]>('Documents')
  const [weightKg, setWeightKg] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [quote, setQuote] = useState<CourierPriceQuote | null>(null)
  const [quoteHint, setQuoteHint] = useState('')
  const [quoting, setQuoting] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [trackCode, setTrackCode] = useState('')
  const [trackResult, setTrackResult] = useState('')
  const [trackError, setTrackError] = useState('')
  const [tracking, setTracking] = useState(false)

  const weightNeeded = courierWeightRequired(goodsType)
  const weightValue = Number(weightKg)
  const weightReady =
    !weightNeeded || (Number.isFinite(weightValue) && weightValue > 0 && weightValue <= 80)

  const refreshQuote = useCallback(async () => {
    if (pickup.trim().length < 3 || dropoff.trim().length < 3) {
      setQuote(null)
      setQuoteHint('Enter pickup and drop-off in Lilongwe to see the fare.')
      return
    }
    if (!weightReady) {
      setQuote(null)
      setQuoteHint(`Enter weight (kg) for ${goodsType} — required for this goods type.`)
      return
    }

    setQuoting(true)
    setQuoteHint('')
    try {
      const res = await fetch('/api/public/courier/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          city: COURIER_CITY,
          pickupLocation: pickup.trim(),
          dropoffLocation: dropoff.trim(),
          ...(pickupPoint
            ? { pickupLat: pickupPoint.lat, pickupLng: pickupPoint.lng }
            : {}),
          goodsType,
          description: [description, notes].filter(Boolean).join(' '),
          weightKg: weightKg.trim() ? Number(weightKg) : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not estimate fare')
      setQuote(data.quote as CourierPriceQuote)
      if (data.pickupLocation && !pickupPoint) setPickup(String(data.pickupLocation))
      if (data.dropoffLocation) setDropoff(String(data.dropoffLocation))
    } catch (err) {
      setQuote(null)
      setQuoteHint(err instanceof Error ? err.message : 'Could not estimate fare')
    } finally {
      setQuoting(false)
    }
  }, [
    pickup,
    dropoff,
    pickupPoint,
    goodsType,
    description,
    notes,
    weightKg,
    weightReady,
  ])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshQuote()
    }, 450)
    return () => window.clearTimeout(timer)
  }, [refreshQuote])

  async function useCurrentLocation() {
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError('This browser cannot share your location. Type the pickup area instead.')
      return
    }
    setLocating(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30_000,
        })
      })
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const res = await fetch('/api/public/courier/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ mode: 'reverse', lat, lng }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not use current location')
      const pointLat = Number(data.point?.lat ?? lat)
      const pointLng = Number(data.point?.lng ?? lng)
      const label = String(
        data.point?.label || `Lilongwe (${pointLat.toFixed(4)}, ${pointLng.toFixed(4)})`,
      )
      setPickup(label)
      setPickupPoint({ lat: pointLat, lng: pointLng })
      setLocationError('')
    } catch (err) {
      const geo = err as { code?: number }
      const message =
        typeof geo?.code === 'number'
          ? geo.code === 1
            ? 'Location was blocked. Allow it once for pickup, or type the area.'
            : 'Could not read GPS. Type the pickup area instead.'
          : err instanceof Error
            ? err.message
            : 'Could not use current location'
      setLocationError(message)
      setPickupPoint(null)
    } finally {
      setLocating(false)
    }
  }

  async function onTrack(e: FormEvent) {
    e.preventDefault()
    setTrackError('')
    setTrackResult('')
    setTracking(true)
    try {
      const res = await fetch(
        `/api/public/courier/track?code=${encodeURIComponent(trackCode.trim())}`,
        { cache: 'no-store' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Not found')
      const d = data.delivery || {}
      setTrackResult(
        `${d.trackingNumber || trackCode}: ${d.status || 'PENDING'} · ${d.pickupLocation || '—'} → ${d.dropoffLocation || '—'}`,
      )
    } catch (err) {
      setTrackError(err instanceof Error ? err.message : 'Could not track')
    } finally {
      setTracking(false)
    }
  }

  const amountMwk = quote?.amountMwk || 0
  const canPay =
    Boolean(quote) &&
    amountMwk > 0 &&
    weightReady &&
    pickup.trim().length >= 4 &&
    dropoff.trim().length >= 4

  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <header
        style={{
          background: 'linear-gradient(135deg, #9A3412 0%, #F97316 45%, #EA580C 100%)',
          padding: '28px 24px 36px',
        }}
      >
        <div
          style={{
            maxWidth: 560,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Logo height={40} textColor="#fff" />
          </Link>
          <Link
            href="/browse/marketplace"
            style={{ color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
          >
            Marketplace
          </Link>
        </div>
      </header>

      <section style={{ maxWidth: 560, margin: '-28px auto 0', padding: '0 24px 80px' }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 20,
            boxShadow: 'var(--shadow)',
            marginTop: 18,
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: '#EA580C',
              margin: 0,
            }}
          >
            Vero Courier · Lilongwe only
          </p>
          <h1
            style={{
              margin: '6px 0 8px',
              fontSize: 26,
              letterSpacing: '-0.4px',
              fontFamily: 'var(--font-display)',
            }}
          >
            Same-day parcels in {COURIER_CITY}
          </h1>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 15, lineHeight: 1.6 }}>
            Use current location for pickup (we check you are in Lilongwe), type the drop-off,
            choose goods type, and add weight when needed. Fare updates from distance and goods
            {weightNeeded ? ' (and weight)' : ''}.
          </p>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 20,
            boxShadow: 'var(--shadow)',
            marginTop: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Book a delivery</h2>
          <GuestBuyForm
            checkoutUrl="/api/public/courier"
            amountMwk={canPay ? amountMwk : 0}
            submitLabel={
              quoting
                ? 'Calculating fare…'
                : canPay
                  ? `Pay MWK ${amountMwk.toLocaleString('en-MW')} and book`
                  : 'Complete details to book'
            }
            successMessage="Payment received. A courier will accept your parcel shortly."
            payload={{
              pickupLocation: pickup,
              dropoffLocation: dropoff,
              goodsType,
              description,
              notes,
              weightKg: weightKg.trim() ? Number(weightKg) : null,
              distanceKm: quote?.distanceKm || null,
              ...(pickupPoint
                ? { pickupLat: pickupPoint.lat, pickupLng: pickupPoint.lng }
                : {}),
              city: COURIER_CITY,
            }}
            extraFields={
              <>
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <label style={{ ...guestFieldLabel, margin: 0 }} htmlFor="c-pickup">
                      Pickup (Lilongwe)
                    </label>
                    <button
                      type="button"
                      onClick={() => void useCurrentLocation()}
                      disabled={locating}
                      style={{
                        border: '1px solid #FDBA74',
                        background: '#FFF7ED',
                        color: '#C2410C',
                        borderRadius: 999,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: locating ? 'wait' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {locating ? 'Checking…' : 'Use current location'}
                    </button>
                  </div>
                  <input
                    id="c-pickup"
                    style={guestFieldInput}
                    required
                    placeholder="Area 18, shop name, landmark — or use current location"
                    value={pickup}
                    onChange={e => {
                      setPickup(e.target.value)
                      setPickupPoint(null)
                      setLocationError('')
                    }}
                  />
                  {locationError ? (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#991B1B', fontWeight: 600 }}>
                      {locationError}
                    </p>
                  ) : pickupPoint ? (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#065F46' }}>
                      Pickup locked to your GPS in Lilongwe.
                    </p>
                  ) : null}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={guestFieldLabel} htmlFor="c-drop">
                    Drop-off (type a Lilongwe place)
                  </label>
                  <input
                    id="c-drop"
                    style={guestFieldInput}
                    required
                    placeholder="City Centre, Area 47, house, landmark"
                    value={dropoff}
                    onChange={e => setDropoff(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={guestFieldLabel} htmlFor="c-goods">
                    Type of goods
                  </label>
                  <select
                    id="c-goods"
                    style={guestFieldInput}
                    value={goodsType}
                    onChange={e =>
                      setGoodsType(e.target.value as (typeof COURIER_GOODS_TYPES)[number])
                    }
                  >
                    {COURIER_GOODS_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={guestFieldLabel} htmlFor="c-weight">
                    Weight (kg){weightNeeded ? ' — required' : ' — optional'}
                  </label>
                  <input
                    id="c-weight"
                    style={guestFieldInput}
                    type="number"
                    min={0.1}
                    max={80}
                    step={0.1}
                    required={weightNeeded}
                    placeholder={weightNeeded ? 'e.g. 3.5' : 'Optional, e.g. 2'}
                    value={weightKg}
                    onChange={e => setWeightKg(e.target.value)}
                  />
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                    {weightNeeded
                      ? `${goodsType} needs a weight so we can price heavier parcels fairly.`
                      : 'Weight is optional for this goods type. Extra kilos above 5 kg add to the fare.'}
                  </p>
                </div>

                <div
                  style={{
                    marginBottom: 12,
                    padding: 14,
                    borderRadius: 14,
                    background: '#FFF7ED',
                    border: '1px solid #FDBA74',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#C2410C' }}>
                    Automatic fare
                  </div>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>
                    {quoting
                      ? 'Calculating…'
                      : quote
                        ? quote.summary
                        : 'Waiting for pickup & drop-off'}
                  </div>
                  {quoteHint ? (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9A3412', lineHeight: 1.45 }}>
                      {quoteHint}
                    </p>
                  ) : (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>
                      Based on Lilongwe road distance, goods type
                      {weightKg ? ', and weight' : ''}. Final price may be confirmed by the courier.
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={guestFieldLabel} htmlFor="c-desc">
                    Description
                  </label>
                  <input
                    id="c-desc"
                    style={guestFieldInput}
                    placeholder="2 sealed boxes, handle with care"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={guestFieldLabel} htmlFor="c-notes">
                    Extra notes (optional)
                  </label>
                  <input
                    id="c-notes"
                    style={guestFieldInput}
                    placeholder="Call on arrival, gate code…"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </>
            }
          />
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 20,
            boxShadow: 'var(--shadow)',
            marginTop: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Track a parcel</h2>
          <form onSubmit={onTrack}>
            <label style={guestFieldLabel} htmlFor="c-track">
              Tracking number
            </label>
            <input
              id="c-track"
              style={guestFieldInput}
              placeholder="VC123456"
              value={trackCode}
              onChange={e => setTrackCode(e.target.value)}
            />
            <button
              type="submit"
              disabled={tracking || !trackCode.trim()}
              style={{
                marginTop: 10,
                width: '100%',
                border: 'none',
                borderRadius: 14,
                padding: '12px 16px',
                fontWeight: 800,
                background: 'var(--primary-dark)',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tracking ? 'Checking…' : 'Track'}
            </button>
          </form>
          {trackResult ? (
            <p style={{ margin: '12px 0 0', color: '#065F46', fontWeight: 600, lineHeight: 1.5 }}>
              {trackResult}
            </p>
          ) : null}
          {trackError ? (
            <p style={{ margin: '12px 0 0', color: '#991B1B', fontWeight: 600 }}>{trackError}</p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
