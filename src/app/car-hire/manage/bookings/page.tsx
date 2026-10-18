'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  bookingIsPending,
  bookingRenterLabel,
  bookingStatusLabel,
  bookingStatusTone,
  carTitle,
  paymentStatusLabel,
  paymentTone,
  resolveCarImage,
  type CarHireBooking,
} from '@/lib/car-hire'
import {
  confirmBooking,
  getOwnerBookings,
  ProviderApiError,
  rejectBooking,
} from '@/lib/car-hire-owner-api'
import { formatDateTime, formatMwk } from '@/lib/vero-api'
import { useProviderAuth } from '../components/ProviderShell'
import {
  ProviderCard,
  ProviderEmpty,
  ProviderError,
  ProviderLoading,
  ProviderNotice,
  ProviderPageHeading,
  StatusBadge,
  dangerButton,
  ghostButton,
  inputStyle,
  labelStyle,
  primaryButton,
} from '../components/ProviderUI'

type ViewState = 'loading' | 'ready' | 'error'

type Filter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CLOSED'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending decision' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CLOSED', label: 'Closed' },
]

function matchesFilter(booking: CarHireBooking, filter: Filter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'CLOSED') {
    return ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(booking.bookingStatus)
  }
  return booking.bookingStatus === filter
}

export default function ProviderBookingsPage() {
  const { signOutNow } = useProviderAuth()
  const [state, setState] = useState<ViewState>('loading')
  const [bookings, setBookings] = useState<CarHireBooking[]>([])
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    setSessionExpired(false)
    setForbidden(false)
    try {
      const rows = await getOwnerBookings({ limit: 100 })
      setBookings(rows)
      setState('ready')
    } catch (err) {
      if (err instanceof ProviderApiError && err.status === 401) {
        setSessionExpired(true)
      }
      if (err instanceof ProviderApiError && (err.status === 403 || err.status === 404)) {
        setForbidden(true)
      }
      setError(
        err instanceof Error ? err.message : 'Could not load provider bookings. Please try again.',
      )
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    const map = new Map<Filter, number>()
    for (const item of FILTERS) {
      map.set(item.id, bookings.filter(booking => matchesFilter(booking, item.id)).length)
    }
    return map
  }, [bookings])

  const visible = useMemo(
    () => bookings.filter(booking => matchesFilter(booking, filter)),
    [bookings, filter],
  )

  async function runConfirm(booking: CarHireBooking) {
    setActionBusy(true)
    setActionError('')
    setNotice('')
    try {
      await confirmBooking(booking.id)
      setNotice(`${booking.bookingNumber} was confirmed. Refreshing from the backend…`)
      setConfirmId(null)
      await load()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not confirm this booking.',
      )
    } finally {
      setActionBusy(false)
    }
  }

  async function runReject(booking: CarHireBooking) {
    const reason = rejectReason.trim()
    if (reason.length < 3) {
      setActionError('Add a short rejection reason (at least 3 characters).')
      return
    }
    setActionBusy(true)
    setActionError('')
    setNotice('')
    try {
      await rejectBooking(booking.id, reason)
      setNotice(`${booking.bookingNumber} was rejected. The backend has released the hold.`)
      setRejectId(null)
      setRejectReason('')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reject this booking.')
    } finally {
      setActionBusy(false)
    }
  }

  if (state === 'loading') {
    return (
      <>
        <ProviderPageHeading
          eyebrow="Provider workspace"
          title="Bookings"
          description="Review authorised booking requests and rentals for your operator's vehicles."
        />
        <ProviderLoading label="Loading provider bookings…" />
      </>
    )
  }

  if (state === 'error') {
    return (
      <>
        <ProviderPageHeading
          eyebrow="Provider workspace"
          title="Bookings"
          description="Review authorised booking requests and rentals for your operator's vehicles."
        />
        <ProviderError
          message={
            forbidden
              ? 'This Vero360 account is not authorised to view bookings for a car-hire operator yet. Applications are made in the app; staff need an invitation from the operator owner.'
              : sessionExpired
                ? 'Your session expired or is no longer valid. Sign out and sign in again to continue.'
                : error || 'Could not load provider bookings.'
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
        title="Bookings"
        description="Confirm or reject pending requests, then check the schedule. The backend is authoritative for status and availability."
        actions={
          <button type="button" onClick={() => void load()} style={ghostButton}>
            Refresh bookings
          </button>
        }
      />

      {notice ? (
        <div style={{ marginBottom: 14 }}>
          <ProviderNotice tone="success">{notice}</ProviderNotice>
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: 7,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        {FILTERS.map(item => {
          const active = filter === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFilter(item.id)
                setConfirmId(null)
                setRejectId(null)
                setActionError('')
              }}
              aria-pressed={active}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 999,
                border: `1px solid ${active ? '#FDBA74' : 'var(--border)'}`,
                background: active ? '#FFF7ED' : '#fff',
                color: active ? '#9A3412' : 'var(--text-2)',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {item.label}
              <span
                style={{
                  minWidth: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: active ? '#FED7AA' : 'var(--surface)',
                  color: active ? '#9A3412' : 'var(--text-3)',
                  fontSize: 10,
                  fontWeight: 900,
                  lineHeight: '17px',
                  textAlign: 'center',
                }}
              >
                {counts.get(item.id) ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {bookings.length === 0 ? (
        <ProviderEmpty
          title="No bookings yet"
          body="Booking requests for your published vehicles will appear here. New requests stay pending only until their hold expires."
          action={
            <Link href="/car-hire/manage/fleet" style={primaryButton}>
              Review fleet
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <ProviderEmpty
          title="No bookings with this status"
          body="Choose another status filter or refresh to check for new requests."
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {visible.map(booking => {
            const car = booking.car
            const image = car ? resolveCarImage(car) : null
            const pending = bookingIsPending(booking)
            const carLabel = car ? carTitle(car) : `Car #${booking.carId ?? '—'}`
            const start = booking.startAt || booking.startDate
            const end = booking.endAt || booking.endDate
            const showingConfirm = confirmId === booking.id
            const showingReject = rejectId === booking.id

            return (
              <ProviderCard key={booking.id}>
                <div
                  style={{
                    display: 'flex',
                    gap: 13,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0, flex: '1 1 320px' }}>
                    <div
                      style={{
                        width: 70,
                        height: 54,
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: 'linear-gradient(160deg, #FFF7ED, #FFEDD5)',
                        flexShrink: 0,
                      }}
                    >
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt=""
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'grid',
                            placeItems: 'center',
                            color: '#C2410C',
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        >
                          Car
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
                          <Link
                            href={`/car-hire/manage/bookings/${booking.id}`}
                            aria-label={`Open booking ${booking.bookingNumber}`}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            {booking.bookingNumber}
                          </Link>
                        </h2>
                        <StatusBadge
                          tone={bookingStatusTone(booking.bookingStatus)}
                          label={bookingStatusLabel(booking.bookingStatus)}
                        />
                        <StatusBadge
                          tone={paymentTone(booking.paymentStatus)}
                          label={paymentStatusLabel(booking.paymentStatus)}
                        />
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 800, color: 'var(--text-2)' }}>
                        {carLabel}
                      </p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                        {formatDateTime(start)} → {formatDateTime(end)}
                      </p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                        Renter: <strong style={{ color: 'var(--text-2)' }}>{bookingRenterLabel(booking)}</strong>
                        {booking.renterPhone ? (
                          <>
                            {' · '}
                            <a href={`tel:${booking.renterPhone}`} style={inlineLink}>
                              {booking.renterPhone}
                            </a>
                          </>
                        ) : null}
                        {booking.renterEmail ? (
                          <>
                            {' · '}
                            <a href={`mailto:${booking.renterEmail}`} style={inlineLink}>
                              {booking.renterEmail}
                            </a>
                          </>
                        ) : null}
                      </p>
                      {booking.renterNotes ? (
                        <p
                          style={{
                            margin: '6px 0 0',
                            padding: '7px 9px',
                            borderRadius: 8,
                            background: 'var(--surface)',
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: 'var(--text-2)',
                          }}
                        >
                          Note: {booking.renterNotes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ minWidth: 150, textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Booking total
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>
                      {formatMwk(booking.total || booking.totalCost)}
                    </p>
                    {booking.holdExpiresAt && pending ? (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#B45309', fontWeight: 700 }}>
                        Hold expires {formatDateTime(booking.holdExpiresAt)}
                      </p>
                    ) : null}
                    <Link
                      href={`/car-hire/manage/bookings/${booking.id}`}
                      style={{ ...inlineLink, display: 'inline-block', marginTop: 8, fontSize: 12 }}
                    >
                      Booking details →
                    </Link>
                  </div>
                </div>

                {pending ? (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    {!showingConfirm && !showingReject ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmId(booking.id)
                            setRejectId(null)
                            setActionError('')
                            setNotice('')
                          }}
                          style={primaryButton}
                        >
                          Confirm request
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectId(booking.id)
                            setConfirmId(null)
                            setRejectReason('')
                            setActionError('')
                            setNotice('')
                          }}
                          style={ghostButton}
                        >
                          Reject request
                        </button>
                      </div>
                    ) : null}

                    {showingConfirm ? (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 11,
                          border: '1px solid #A7F3D0',
                          background: '#F0FDF4',
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#065F46', lineHeight: 1.55 }}>
                          Confirm {booking.bookingNumber} for {bookingRenterLabel(booking)}? The
                          backend will recheck availability and move the request to confirmed.
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                          <button
                            type="button"
                            onClick={() => void runConfirm(booking)}
                            disabled={actionBusy}
                            style={primaryButton}
                          >
                            {actionBusy ? 'Confirming…' : 'Yes, confirm booking'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            disabled={actionBusy}
                            style={ghostButton}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {showingReject ? (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 11,
                          border: '1px solid #FECACA',
                          background: '#FFF7F7',
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#991B1B', lineHeight: 1.55 }}>
                          Reject {booking.bookingNumber}? The renter&apos;s hold is released and
                          the rejection reason is recorded.
                        </p>
                        <div style={{ marginTop: 9 }}>
                          <label htmlFor={`reject-${booking.id}`} style={labelStyle}>
                            Rejection reason (required)
                          </label>
                          <textarea
                            id={`reject-${booking.id}`}
                            value={rejectReason}
                            onChange={event => setRejectReason(event.target.value)}
                            rows={2}
                            placeholder="e.g. Vehicle unavailable for these dates"
                            style={{ ...inputStyle, resize: 'vertical' }}
                            disabled={actionBusy}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                          <button
                            type="button"
                            onClick={() => void runReject(booking)}
                            disabled={actionBusy}
                            style={dangerButton}
                          >
                            {actionBusy ? 'Rejecting…' : 'Yes, reject request'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectId(null)}
                            disabled={actionBusy}
                            style={ghostButton}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {actionError ? (
                      <p role="alert" style={{ margin: '9px 0 0', fontSize: 12, color: '#B91C1C', lineHeight: 1.5 }}>
                        {actionError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </ProviderCard>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <ProviderNotice tone="info">
          Booking totals are the amounts recorded on each booking, not settled provider payouts.
          Payment status is shown separately; this workspace does not infer revenue.
        </ProviderNotice>
      </div>
    </>
  )
}

const inlineLink = {
  color: '#C2410C',
  fontWeight: 700,
  textDecoration: 'none',
} as const
