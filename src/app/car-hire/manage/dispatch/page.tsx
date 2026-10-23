'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  bookingStatusLabel,
  bookingStatusTone,
  carTitle,
  type DispatchBoard,
  type DispatchBooking,
  type StatusTone,
} from '@/lib/car-hire'
import { getDispatchBoard, ProviderApiError } from '@/lib/car-hire-owner-api'
import { formatDateTime } from '@/lib/vero-api'
import { useProviderAuth } from '../components/ProviderShell'
import {
  ProviderCard,
  ProviderError,
  ProviderLoading,
  ProviderPageHeading,
  StatusBadge,
  ghostButton,
  inputStyle,
  mutedText,
} from '../components/ProviderUI'

type ViewState = 'loading' | 'ready' | 'error'

const TONES: Record<'warning' | 'danger', StatusTone> = {
  warning: { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  danger: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
}

function todayKey(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export default function ProviderDispatchPage() {
  const { signOutNow } = useProviderAuth()
  const [state, setState] = useState<ViewState>('loading')
  const [date, setDate] = useState(todayKey)
  const [board, setBoard] = useState<DispatchBoard | null>(null)
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  const load = useCallback(async (day: string) => {
    setState('loading')
    setError('')
    setSessionExpired(false)
    try {
      setBoard(await getDispatchBoard(day))
      setState('ready')
    } catch (err) {
      if (err instanceof ProviderApiError && err.status === 401) setSessionExpired(true)
      setError(err instanceof Error ? err.message : 'Could not load the dispatch board.')
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load(date)
  }, [load, date])

  const heading = (
    <ProviderPageHeading
      eyebrow="Provider workspace"
      title="Dispatch"
      description="Today's handovers and returns, plus anything that needs attention."
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            aria-label="Dispatch date"
            value={date}
            onChange={event => event.target.value && setDate(event.target.value)}
            style={{ ...inputStyle, width: 'auto', padding: '8px 10px' }}
          />
          <button type="button" onClick={() => void load(date)} style={ghostButton}>
            Refresh
          </button>
        </div>
      }
    />
  )

  if (state === 'loading' || (state === 'ready' && !board)) {
    return (
      <>
        {heading}
        <ProviderLoading label="Loading the dispatch board…" />
      </>
    )
  }

  if (state === 'error' || !board) {
    return (
      <>
        {heading}
        <ProviderError
          message={
            sessionExpired
              ? 'Your session expired or is no longer valid. Sign out and sign in again to continue.'
              : error || 'Could not load the dispatch board.'
          }
          onRetry={() => void load(date)}
          action={
            sessionExpired ? (
              <button type="button" onClick={() => void signOutNow()} style={ghostButton}>
                Sign out
              </button>
            ) : undefined
          }
        />
      </>
    )
  }

  return (
    <>
      {heading}
      <div style={{ display: 'grid', gap: 14 }}>
        {board.awaitingResponse.length > 0 ? (
          <BookingSection
            title="Awaiting your response"
            hint="Request-to-book. Accept or decline before the request expires."
            rows={board.awaitingResponse}
            time="hold"
            tone="warning"
          />
        ) : null}
        {board.upcomingPickups.length > 0 ? (
          <BookingSection
            title="Paid upcoming pickups"
            hint="The renter has paid. Prepare the car before the pickup date."
            rows={board.upcomingPickups}
            time="start"
          />
        ) : null}
        {board.latePickups.length > 0 ? (
          <BookingSection
            title="Late pickups"
            hint="Start time has passed but the car has not been handed over."
            rows={board.latePickups}
            time="start"
            tone="danger"
          />
        ) : null}
        {board.overdueReturns.length > 0 ? (
          <BookingSection
            title="Overdue returns"
            hint="Rental end has passed and the car is still out."
            rows={board.overdueReturns}
            time="end"
            tone="danger"
          />
        ) : null}
        <BookingSection
          title="Pickups"
          rows={board.pickups}
          time="start"
          empty="No pickups on this day."
        />
        <BookingSection
          title="Returns"
          rows={board.returns}
          time="end"
          empty="No returns on this day."
        />
        <ProviderCard>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Service due</h2>
          {board.serviceDue.length === 0 ? (
            <p style={{ ...mutedText, marginTop: 6 }}>
              Nothing due in the next 14 days. Set service dates on each unit in Fleet.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
              {board.serviceDue.map(item => (
                <div key={item.carId} style={rowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <p style={rowTitle}>
                      {item.title}
                      {item.licensePlate ? ` · ${item.licensePlate}` : ''}
                    </p>
                    <p style={rowMeta}>Due {item.nextServiceDueAt}</p>
                  </div>
                  <StatusBadge
                    tone={item.overdue ? TONES.danger : TONES.warning}
                    label={item.overdue ? 'Overdue' : 'Due soon'}
                  />
                </div>
              ))}
            </div>
          )}
        </ProviderCard>
      </div>
    </>
  )
}

function BookingSection({
  title,
  hint,
  rows,
  time,
  tone,
  empty,
}: {
  title: string
  hint?: string
  rows: DispatchBooking[]
  time: 'start' | 'end' | 'hold'
  tone?: 'warning' | 'danger'
  empty?: string
}) {
  return (
    <ProviderCard>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{title}</h2>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-3)' }}>{rows.length}</span>
      </div>
      {hint ? <p style={{ ...mutedText, marginTop: 4 }}>{hint}</p> : null}
      {rows.length === 0 ? (
        <p style={{ ...mutedText, marginTop: 6 }}>{empty}</p>
      ) : (
        <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
          {rows.map(booking => {
            const when =
              time === 'start'
                ? `Pickup ${formatDateTime(booking.startAt)}`
                : time === 'end'
                  ? `Return ${formatDateTime(booking.endAt)}`
                  : `Respond by ${formatDateTime(booking.holdExpiresAt)}`
            const plate = booking.assignedUnit?.licensePlate
            return (
              <Link
                key={booking.id}
                href={`/car-hire/manage/bookings/${booking.id}`}
                style={{ ...rowStyle, textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={rowTitle}>
                    {booking.bookingNumber} · {booking.car ? carTitle(booking.car) : `Car #${booking.carId ?? '—'}`}
                    {plate ? ` · ${plate}` : ''}
                  </p>
                  <p style={rowMeta}>
                    {when}
                    {booking.renterName ? ` · ${booking.renterName}` : ''}
                    {booking.renterPhone ? ` · ${booking.renterPhone}` : ''}
                    {booking.branch ? ` · ${booking.branch.name}` : ''}
                  </p>
                </div>
                <StatusBadge
                  tone={tone ? TONES[tone] : bookingStatusTone(booking.bookingStatus)}
                  label={bookingStatusLabel(booking.bookingStatus)}
                />
              </Link>
            )
          })}
        </div>
      )}
    </ProviderCard>
  )
}

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 8,
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '9px 11px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
}

const rowTitle = { margin: 0, fontSize: 12, fontWeight: 900, color: 'var(--text-2)' }
const rowMeta = { margin: '2px 0 0', fontSize: 11, color: 'var(--text-3)' }
