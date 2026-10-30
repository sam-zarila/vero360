'use client'

import { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import Logo from '@/app/components/landing/Logo'
import GuestBuyForm, {
  guestFieldInput,
  guestFieldLabel,
} from '@/app/components/open-listing/GuestBuyForm'
import {
  COURIER_CITY,
  COURIER_GOODS_TYPES,
  estimateCourierPrice,
} from '@/lib/courier-pricing'

export default function CourierBookClient() {
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [goodsType, setGoodsType] = useState<(typeof COURIER_GOODS_TYPES)[number]>('Documents')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [distanceKm, setDistanceKm] = useState('3')
  const [trackCode, setTrackCode] = useState('')
  const [trackResult, setTrackResult] = useState('')
  const [trackError, setTrackError] = useState('')
  const [tracking, setTracking] = useState(false)

  const quote = useMemo(
    () =>
      estimateCourierPrice({
        distanceKm: Number(distanceKm) || 3,
        goodsType,
        description: [description, notes].filter(Boolean).join(' '),
      }),
    [distanceKm, goodsType, description, notes],
  )

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
            Vero Courier
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
            Book as a guest. Blantyre, Zomba, and other cities are expanding soon. Fare is an
            estimate from distance and goods type.
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
            amountMwk={quote.amountMwk}
            submitLabel="Pay and book courier"
            successMessage="Payment received. A courier will accept your parcel shortly."
            payload={{
              pickupLocation: pickup,
              dropoffLocation: dropoff,
              goodsType,
              description,
              notes,
              distanceKm: Number(distanceKm) || 3,
              city: COURIER_CITY,
            }}
            extraFields={
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={guestFieldLabel} htmlFor="c-pickup">
                    Pickup (Lilongwe)
                  </label>
                  <input
                    id="c-pickup"
                    style={guestFieldInput}
                    required
                    placeholder="Area 18, shop name, landmark"
                    value={pickup}
                    onChange={e => setPickup(e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={guestFieldLabel} htmlFor="c-drop">
                    Drop-off (Lilongwe)
                  </label>
                  <input
                    id="c-drop"
                    style={guestFieldInput}
                    required
                    placeholder="City Centre, house, landmark"
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
                  <label style={guestFieldLabel} htmlFor="c-km">
                    Distance (km, estimate)
                  </label>
                  <input
                    id="c-km"
                    style={guestFieldInput}
                    type="number"
                    min={1}
                    max={80}
                    step={0.1}
                    value={distanceKm}
                    onChange={e => setDistanceKm(e.target.value)}
                  />
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                    {quote.summary}
                  </p>
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
