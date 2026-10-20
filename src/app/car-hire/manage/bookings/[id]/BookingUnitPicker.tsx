'use client'

import { useEffect, useState } from 'react'
import type { BookingUnitOption, CarHireBooking } from '@/lib/car-hire'
import {
  assignBookingUnit,
  getBookingUnitOptions,
  ProviderApiError,
} from '@/lib/car-hire-owner-api'
import { ghostButton, inputStyle } from '../../components/ProviderUI'

const CHANGEABLE = new Set(['PENDING', 'PENDING_CONFIRMATION', 'CONFIRMED'])

/** Shows the assigned registration and lets the company swap to another free unit. */
export default function BookingUnitPicker({
  booking,
  onAssigned,
}: {
  booking: CarHireBooking
  onAssigned: (next: CarHireBooking | null, message: string) => void
}) {
  const [options, setOptions] = useState<BookingUnitOption[] | null>(null)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changeable = CHANGEABLE.has(booking.bookingStatus.toUpperCase())
  const assigned = booking.assignedUnit
  const currentId = assigned?.carId ?? booking.carId

  useEffect(() => {
    if (!changeable) return
    let cancelled = false
    getBookingUnitOptions(booking.id)
      .then(list => {
        if (!cancelled) setOptions(list)
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [booking.id, booking.carId, changeable])

  const alternatives = (options ?? []).filter(
    option => option.carId !== currentId && option.freeForBooking,
  )

  async function assign() {
    const carId = Number(selected)
    if (!carId) return
    setBusy(true)
    setError('')
    try {
      const next = await assignBookingUnit(booking.id, carId)
      const plate = options?.find(option => option.carId === carId)?.licensePlate
      setSelected('')
      onAssigned(next, `Booking moved to ${plate || `car #${carId}`}. The renter has been notified.`)
    } catch (err) {
      setError(
        err instanceof ProviderApiError && err.status === 409
          ? 'That unit is no longer free for these dates. Refresh and choose another.'
          : err instanceof Error
            ? err.message
            : 'Could not change the unit.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (!assigned && (options?.length ?? 0) <= 1) return null

  return (
    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
      Unit:{' '}
      <strong style={{ color: 'var(--text-2)', letterSpacing: 0.3 }}>
        {assigned?.licensePlate || `Car #${currentId}`}
      </strong>
      {assigned?.unitLabel ? ` · ${assigned.unitLabel}` : ''}
      {assigned?.color ? ` · ${assigned.color}` : ''}
      {changeable && alternatives.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          <select
            aria-label="Change assigned unit"
            value={selected}
            onChange={event => setSelected(event.target.value)}
            disabled={busy}
            style={{ ...inputStyle, flex: '1 1 180px', maxWidth: 260 }}
          >
            <option value="">Change unit…</option>
            {alternatives.map(option => (
              <option key={option.carId} value={option.carId}>
                {[option.licensePlate || `Car #${option.carId}`, option.unitLabel, option.color]
                  .filter(Boolean)
                  .join(' · ')}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void assign()}
            disabled={busy || !selected}
            style={ghostButton}
          >
            {busy ? 'Moving…' : 'Assign'}
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: '6px 0 0', color: '#B91C1C', fontWeight: 700 }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
