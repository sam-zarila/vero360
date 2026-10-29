'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PLAY_STORE_URL } from '@/app/components/landing/veroServices'
import { IosStoreCta } from '@/app/components/landing/IosReviewNotice'
import { carHireAppHref } from '@/lib/car-hire'
import { formatMwk } from '@/lib/vero-api'

type Props = {
  carId: number
  dailyRate: number
  currency: string
  minRentalDays: number
  maxRentalDays: number | null
  depositAmount: number
  available: boolean
  pickupArea: string | null
  initialStartAt: string | null
  initialEndAt: string | null
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

function localInputToIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export default function CarHireBookingPanel({
  carId,
  dailyRate,
  currency,
  minRentalDays,
  maxRentalDays,
  depositAmount,
  available,
  pickupArea,
  initialStartAt,
  initialEndAt,
}: Props) {
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    setStartInput(isoToLocalInput(initialStartAt))
    setEndInput(isoToLocalInput(initialEndAt))
  }, [initialStartAt, initialEndAt])

  const startAt = localInputToIso(startInput)
  const endAt = localInputToIso(endInput)

  const days = useMemo(() => {
    if (!startAt || !endAt) return 0
    const diff = new Date(endAt).getTime() - new Date(startAt).getTime()
    if (!(diff > 0)) return 0
    return Math.max(1, Math.ceil(diff / 86_400_000))
  }, [startAt, endAt])

  const appHref = carHireAppHref(carId, startAt, endAt)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!startAt || !endAt) {
      setError('Choose both a pickup and return date and time.')
      return
    }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      setError('The return date must be after the pickup date.')
      return
    }
    if (days < minRentalDays) {
      setError(`This car has a minimum rental of ${minRentalDays} ${minRentalDays === 1 ? 'day' : 'days'}.`)
      return
    }
    if (maxRentalDays != null && days > maxRentalDays) {
      setError(`This car has a maximum rental of ${maxRentalDays} days.`)
      return
    }

    setOpening(true)
    window.location.href = appHref
    window.setTimeout(() => setOpening(false), 2500)
  }

  if (!available) {
    return (
      <div style={{ ...cardStyle, padding: 20 }}>
        <p style={eyebrowStyle}>Unavailable for new bookings</p>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.3px' }}>
          Continue in the app
        </h2>
        <p style={{ margin: '9px 0 0', fontSize: 14, lineHeight: 1.65, color: 'var(--text-3)' }}>
          This vehicle is not currently available for new rentals. Open the app to see similar cars
          or contact support for help with an existing booking.
        </p>
        <a href={carHireAppHref(carId)} style={{ ...primaryButtonStyle, marginTop: 16 }}>
          Continue in the app
        </a>
        <StoreFallback />
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ ...cardStyle, padding: 20 }}>
      <p style={eyebrowStyle}>Book this car</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text)' }}>
          {formatMwk(dailyRate)}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)' }}>/ day</span>
      </div>
      <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
        {currency} · {pickupArea || 'Pickup area confirmed in app'}
      </p>

      <div style={{ display: 'grid', gap: 11, marginTop: 16 }}>
        <div>
          <label htmlFor="booking-start" style={labelStyle}>
            Pickup date &amp; time
          </label>
          <input
            id="booking-start"
            type="datetime-local"
            value={startInput}
            onChange={event => {
              setStartInput(event.target.value)
              setError('')
            }}
            style={inputStyle}
            required
          />
        </div>
        <div>
          <label htmlFor="booking-end" style={labelStyle}>
            Return date &amp; time
          </label>
          <input
            id="booking-end"
            type="datetime-local"
            value={endInput}
            onChange={event => {
              setEndInput(event.target.value)
              setError('')
            }}
            style={inputStyle}
            required
          />
        </div>
      </div>

      {days > 0 ? (
        <div
          style={{
            marginTop: 13,
            padding: '11px 12px',
            borderRadius: 12,
            background: 'var(--primary-50)',
            border: '1px solid #FED7AA',
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#9A3412' }}>
            {days} {days === 1 ? 'day' : 'days'} · {formatMwk(dailyRate * days)} base rate
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, lineHeight: 1.5, color: '#9A3412' }}>
            Estimate only. Fees, deposit, taxes, and the final quote are confirmed in the app.
          </p>
        </div>
      ) : null}

      <p style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--text-3)' }}>
        {minRentalDays} {minRentalDays === 1 ? 'day' : 'days'} minimum
        {maxRentalDays != null ? ` · ${maxRentalDays} days maximum` : ''}
        {depositAmount > 0 ? ` · Deposit ${formatMwk(depositAmount)}` : ''}
      </p>

      {error ? (
        <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: '#B91C1C', lineHeight: 1.5 }}>
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={opening} style={{ ...primaryButtonStyle, marginTop: 15 }}>
        {opening ? 'Opening the app…' : 'Continue in the app'}
      </button>

      <p style={{ margin: '10px 0 0', fontSize: 11, lineHeight: 1.6, color: 'var(--text-3)' }}>
        Web checkout is not available yet. Your selected dates are passed to the Vero360 app, where
        the backend confirms live availability, the final quote, and payment.
      </p>

      <StoreFallback />
    </form>
  )
}

function StoreFallback() {
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--text-3)' }}>
        Don&apos;t have the app?
      </p>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 7 }}>
        <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" style={storeLink}>
          Google Play
        </a>
        <IosStoreCta style={storeLink}>App Store</IosStoreCta>
      </div>
    </div>
  )
}

const cardStyle = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 20,
  boxShadow: 'var(--shadow)',
} as const

const eyebrowStyle = {
  margin: '0 0 8px',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: 'uppercase',
  color: '#C2410C',
} as const

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--text-2)',
  marginBottom: 6,
} as const

const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 11,
  border: '1px solid var(--border)',
  background: '#fff',
  fontSize: 14,
  fontFamily: 'inherit',
  color: 'var(--text)',
  outline: 'none',
} as const

const primaryButtonStyle = {
  display: 'block',
  width: '100%',
  padding: '13px 16px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 800,
  textAlign: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const

const storeLink = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 10px',
  borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-2)',
  fontSize: 11,
  fontWeight: 800,
  textDecoration: 'none',
} as const
