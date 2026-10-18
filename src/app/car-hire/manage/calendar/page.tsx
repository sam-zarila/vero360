'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  bookingStatusLabel,
  bookingStatusTone,
  carTitle,
  type CarHireBooking,
  type CarListing,
} from '@/lib/car-hire'
import { getFleet, getOwnerBookings, ProviderApiError } from '@/lib/car-hire-owner-api'
import { formatDateTime } from '@/lib/vero-api'
import { useProviderAuth } from '../components/ProviderShell'
import {
  ProviderCard,
  ProviderEmpty,
  ProviderError,
  ProviderLoading,
  ProviderNotice,
  ProviderPageHeading,
  StatusBadge,
  ghostButton,
  primaryButton,
} from '../components/ProviderUI'

type ViewState = 'loading' | 'ready' | 'error'

const DAYS = 21
const BLOCKING_STATUSES = new Set([
  'PENDING',
  'CONFIRMED',
  'ACTIVE',
  'INCIDENT_REPORTED',
])

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function overlappingBookings(
  bookings: CarHireBooking[],
  carId: number,
  from: Date,
  to: Date,
): CarHireBooking[] {
  return bookings.filter(booking => {
    if (booking.carId !== carId) return false
    if (!BLOCKING_STATUSES.has(booking.bookingStatus)) return false
    const start = booking.startAt ? new Date(booking.startAt) : null
    const end = booking.endAt ? new Date(booking.endAt) : null
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return false
    }
    return start.getTime() < to.getTime() && end.getTime() > from.getTime()
  })
}

export default function ProviderCalendarPage() {
  const { signOutNow } = useProviderAuth()
  const [state, setState] = useState<ViewState>('loading')
  const [fleet, setFleet] = useState<CarListing[]>([])
  const [bookings, setBookings] = useState<CarHireBooking[]>([])
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [lastLoaded, setLastLoaded] = useState<string>('')

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    setSessionExpired(false)
    setForbidden(false)
    try {
      const [cars, rows] = await Promise.all([getFleet(), getOwnerBookings({ limit: 100 })])
      setFleet(cars)
      setBookings(rows)
      setLastLoaded(new Date().toLocaleString())
      setState('ready')
    } catch (err) {
      if (err instanceof ProviderApiError && err.status === 401) {
        setSessionExpired(true)
      }
      if (err instanceof ProviderApiError && (err.status === 403 || err.status === 404)) {
        setForbidden(true)
      }
      setError(
        err instanceof Error ? err.message : 'Could not load the availability calendar.',
      )
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const days = useMemo(() => {
    const today = startOfDay(new Date())
    return Array.from({ length: DAYS }, (_, index) => addDays(today, index))
  }, [])

  const rangeStart = days[0]
  const rangeEnd = addDays(days[days.length - 1], 1)

  const rows = useMemo(
    () =>
      fleet.map(car => ({
        car,
        bookings: overlappingBookings(bookings, car.id, rangeStart, rangeEnd),
      })),
    [fleet, bookings, rangeStart, rangeEnd],
  )

  const upcoming = useMemo(() => {
    return bookings
      .filter(booking => {
        if (!BLOCKING_STATUSES.has(booking.bookingStatus)) return false
        const end = booking.endAt ? new Date(booking.endAt) : null
        return end && !Number.isNaN(end.getTime()) && end.getTime() >= rangeStart.getTime()
      })
      .sort((a, b) => {
        const at = a.startAt ? new Date(a.startAt).getTime() : 0
        const bt = b.startAt ? new Date(b.startAt).getTime() : 0
        return at - bt
      })
      .slice(0, 12)
  }, [bookings, rangeStart])

  if (state === 'loading') {
    return (
      <>
        <ProviderPageHeading
          eyebrow="Provider workspace"
          title="Calendar"
          description="Read-only view of vehicle availability and upcoming rentals."
        />
        <ProviderLoading label="Building your availability calendar…" />
      </>
    )
  }

  if (state === 'error') {
    return (
      <>
        <ProviderPageHeading
          eyebrow="Provider workspace"
          title="Calendar"
          description="Read-only view of vehicle availability and upcoming rentals."
        />
        <ProviderError
          message={
            forbidden
              ? 'This Vero360 account is not authorised to view an operator calendar yet. Applications are made in the app; staff need an invitation from the operator owner.'
              : sessionExpired
                ? 'Your session expired or is no longer valid. Sign out and sign in again to continue.'
                : error || 'Could not load the availability calendar.'
          }
          onRetry={() => void load()}
          action={
            sessionExpired ? (
              <button type="button" onClick={() => void signOutNow()} style={ghostButton}>
                Sign out
              </button>
            ) : (
              <Link href="/car-hire/manage/fleet" style={ghostButton}>
                Open fleet
              </Link>
            )
          }
        />
      </>
    )
  }

  return (
    <>
      <ProviderPageHeading
        eyebrow="Provider workspace"
        title="Calendar"
        description="A read-only 21-day view built from your fleet and bookings. Maintenance blocks are added from Fleet and remove vehicles from date-based search."
        actions={
          <button type="button" onClick={() => void load()} style={ghostButton}>
            Refresh calendar
          </button>
        }
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Legend swatch="#F97316" label="Reserved / pending hold" />
          <Legend swatch="#FDE68A" label="Today" />
          <Legend swatch="#F3F4F6" label="No blocking booking" />
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
          {lastLoaded ? `Loaded ${lastLoaded}` : 'Loaded from the backend'}
        </p>
      </div>

      {fleet.length === 0 ? (
        <ProviderEmpty
          title="No vehicles to schedule"
          body="Once your fleet is set up, reservations and holds appear on this calendar. Add or submit vehicles in the Vero360 app."
          action={
            <Link href="/car-hire/manage/fleet" style={primaryButton}>
              Open fleet
            </Link>
          }
        />
      ) : (
        <ProviderCard padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 760, padding: '12px 14px 16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `190px repeat(${DAYS}, minmax(24px, 1fr))`,
                  gap: 3,
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Vehicle
                </span>
                {days.map(day => (
                  <span
                    key={day.toISOString()}
                    style={{
                      textAlign: 'center',
                      fontSize: 9,
                      fontWeight: 900,
                      color: day.getTime() === startOfDay(new Date()).getTime() ? '#C2410C' : 'var(--text-4)',
                      lineHeight: 1.2,
                    }}
                  >
                    {day.getDate()}
                    <br />
                    {day.toLocaleString(undefined, { month: 'short' })}
                  </span>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 5 }}>
                {rows.map(({ car, bookings: carBookings }) => {
                  const unavailable = car.isAvailable === false
                  return (
                    <div
                      key={car.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `190px repeat(${DAYS}, minmax(24px, 1fr))`,
                        gap: 3,
                        alignItems: 'stretch',
                        minHeight: 36,
                      }}
                    >
                      <div style={{ minWidth: 0, padding: '5px 6px 5px 0' }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 11,
                            fontWeight: 900,
                            color: 'var(--text-2)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={carTitle(car)}
                        >
                          {carTitle(car)}
                        </p>
                        <p style={{ margin: '1px 0 0', fontSize: 9, color: unavailable ? '#B91C1C' : 'var(--text-4)', fontWeight: 700 }}>
                          {unavailable ? 'Unavailable now' : 'In service'}
                        </p>
                      </div>
                      {days.map(day => {
                        const dayStart = day.getTime()
                        const dayEnd = addDays(day, 1).getTime()
                        const isToday = dayStart === startOfDay(new Date()).getTime()
                        const hit = carBookings.some(booking => {
                          const start = booking.startAt ? new Date(booking.startAt).getTime() : 0
                          const end = booking.endAt ? new Date(booking.endAt).getTime() : 0
                          return start < dayEnd && end > dayStart
                        })
                        return (
                          <div
                            key={`${car.id}-${day.toISOString()}`}
                            title={
                              hit
                                ? `${carTitle(car)} has a reservation or hold on ${day.toDateString()}`
                                : `${carTitle(car)} has no blocking booking on ${day.toDateString()}`
                            }
                            style={{
                              borderRadius: 5,
                              background: hit ? '#F97316' : isToday ? '#FDE68A' : 'var(--surface-2)',
                              border: isToday && !hit ? '1px solid #F59E0B' : '1px solid transparent',
                              minHeight: 32,
                            }}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </ProviderCard>
      )}

      <div style={{ marginTop: 16 }}>
        <ProviderCard>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>Upcoming bookings</h2>
          {upcoming.length === 0 ? (
            <p style={{ margin: '7px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
              No blocking bookings in the next {DAYS} days.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 7, marginTop: 11 }}>
              {upcoming.map(booking => {
                const car = fleet.find(item => item.id === booking.carId)
                return (
                  <div
                    key={booking.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 11px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: 'var(--text-2)' }}>
                        {booking.bookingNumber} · {car ? carTitle(car) : `Car #${booking.carId ?? '—'}`}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-3)' }}>
                        {formatDateTime(booking.startAt)} → {formatDateTime(booking.endAt)}
                      </p>
                    </div>
                    <StatusBadge
                      tone={bookingStatusTone(booking.bookingStatus)}
                      label={bookingStatusLabel(booking.bookingStatus)}
                    />
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <ProviderNotice tone="info">
              This calendar uses fleet availability and booking intervals only. It does not expose
              live GPS location or tracking. Add maintenance or safety blocks from Fleet.
            </ProviderNotice>
          </div>
        </ProviderCard>
      </div>
    </>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>
      <span
        aria-hidden
        style={{
          width: 11,
          height: 11,
          borderRadius: 3,
          background: swatch,
          border: '1px solid rgba(0,0,0,0.06)',
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  )
}
