'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { carTitle, fuelTypeLabel, transmissionLabel, type OwnerVehicle } from '@/lib/car-hire'
import {
  LuArrowUpRight,
  LuCalendarClock,
  LuCarFront,
  LuCircleAlert,
  LuGauge,
  LuMapPin,
  LuWarehouse,
} from 'react-icons/lu'
import { HubEmpty, HubSectionTitle } from './PulseMetrics'
import { dayOf, listingStateOf, money, needsAttention, percent, unitPlate } from './format'

type FilterKey = 'all' | 'published' | 'review' | 'attention'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All units' },
  { key: 'published', label: 'Published' },
  { key: 'review', label: 'In review' },
  { key: 'attention', label: 'Needs attention' },
]

export function FleetReadinessBoard({
  cars,
  loading,
  selectedId,
  onSelect,
}: {
  cars: OwnerVehicle[]
  loading: boolean
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const counts = useMemo(() => {
    let published = 0
    let review = 0
    let attention = 0
    for (const car of cars) {
      const state = listingStateOf(car)
      if (state.key === 'published') published += 1
      if (state.key === 'pending') review += 1
      if (needsAttention(car)) attention += 1
    }
    return { all: cars.length, published, review, attention }
  }, [cars])

  const visible = useMemo(() => {
    if (filter === 'published') {
      return cars.filter(car => listingStateOf(car).key === 'published')
    }
    if (filter === 'review') {
      return cars.filter(car => listingStateOf(car).key === 'pending')
    }
    if (filter === 'attention') {
      return cars.filter(needsAttention)
    }
    return cars
  }, [cars, filter])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-[0_2px_12px_rgba(0,31,63,0.06)]">
      <HubSectionTitle
        icon={<LuCarFront className="text-[17px]" aria-hidden />}
        title="Fleet readiness board"
        subtitle="Every unit in your workspace, by listing state. Select a unit to inspect it."
        trailing={
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-container-low p-1">
            {FILTERS.map(item => {
              const active = filter === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    active
                      ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {item.key === 'attention' ? (
                    <LuCircleAlert
                      className={`text-[13px] ${counts.attention > 0 ? 'text-error' : 'text-outline'}`}
                      aria-hidden
                    />
                  ) : null}
                  {item.label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-bold ${
                      active ? 'bg-surface-container text-on-surface' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {counts[item.key]}
                  </span>
                </button>
              )
            })}
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div
                key={index}
                className="h-[62px] animate-pulse rounded-xl bg-surface-container-low"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <HubEmpty>
            {cars.length === 0
              ? 'No vehicles are linked to this operator yet. Add or publish vehicles in the Vero360 app, then refresh.'
              : 'No units match this filter right now.'}
          </HubEmpty>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {visible.map(car => {
              const state = listingStateOf(car)
              const selected = selectedId === car.id
              return (
                <button
                  key={car.id}
                  type="button"
                  onClick={() => onSelect(car.id)}
                  aria-pressed={selected}
                  className={`flex w-full flex-col gap-2 rounded-xl border p-2.5 text-left transition-all ${
                    selected
                      ? 'border-primary-container bg-surface-container-low shadow-[0_0_0_2px_rgba(0,31,63,0.14)]'
                      : 'border-outline-variant/50 bg-surface-container-lowest hover:border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="flex w-full items-center gap-2.5">
                    {car.imageUrl ? (
                      <img
                        src={car.imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-container-high text-primary">
                        <LuCarFront className="text-[18px]" aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-bold leading-tight text-primary">
                        {carTitle(car)}
                      </span>
                      <span className="block truncate font-mono text-[10.5px] leading-snug text-on-surface-variant">
                        {unitPlate(car)}
                      </span>
                    </span>
                  </span>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${state.chip}`}
                    >
                      {state.short}
                    </span>
                    {car.isAvailable === false ? (
                      <span className="flex items-center gap-1 text-[9.5px] font-semibold text-error">
                        <LuCircleAlert className="text-[11px]" aria-hidden />
                        Unavailable
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-medium text-on-surface-variant">
                        {money(car.dailyRate, car.currency)} / day
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-surface-container bg-surface-container-low px-4 py-2.5 text-[11px] font-medium text-on-surface-variant">
        <span>
          {visible.length.toLocaleString()} of {cars.length.toLocaleString()}{' '}
          {`unit${cars.length === 1 ? '' : 's'} shown`}
        </span>
        <Link
          href="/car-hire/manage/fleet"
          className="flex items-center gap-1 font-bold text-primary hover:text-secondary"
        >
          Open fleet
          <LuArrowUpRight className="text-[13px]" aria-hidden />
        </Link>
      </div>
    </div>
  )
}

export function FocusUnitPanel({
  car,
  currency,
  fleetTotal,
  now,
}: {
  car: OwnerVehicle | null
  currency: string
  fleetTotal: number
  now: number | null
}) {
  if (!car) {
    return (
      <div className="flex h-full flex-col rounded-2xl bg-surface-container-lowest p-6 shadow-[0_2px_12px_rgba(0,31,63,0.06)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-secondary">
          Focus unit
        </p>
        <h2 className="mt-1 font-heading text-[18px] font-bold leading-tight text-primary">
          No unit selected
        </h2>
        <div className="mt-4 grid flex-1 place-items-center rounded-xl bg-surface-container-low p-6 text-center">
          <div>
            <LuCarFront className="mx-auto text-[30px] text-outline" aria-hidden />
            <p className="mt-2 text-[12.5px] leading-relaxed text-on-surface-variant">
              Pick a unit from the readiness board to see its listing state, pricing, and service
              schedule.
            </p>
          </div>
        </div>
        <Link
          href="/car-hire/manage/fleet"
          className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-primary-container px-3 py-2.5 text-[12px] font-bold text-on-primary transition-colors hover:bg-primary"
        >
          Manage fleet
          <LuArrowUpRight className="text-[14px]" aria-hidden />
        </Link>
      </div>
    )
  }

  const state = listingStateOf(car)
  const dueTs = car.nextServiceDueAt ? Date.parse(car.nextServiceDueAt) : null
  const serviceKnown = dueTs != null && Number.isFinite(dueTs) && now != null
  const serviceOverdue = serviceKnown && dueTs < (now as number)
  const serviceShare =
    serviceKnown && !serviceOverdue
      ? percent((dueTs as number) - (now as number), 30 * 24 * 60 * 60 * 1000)
      : 0

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl bg-surface-container-lowest p-5 shadow-[0_2px_12px_rgba(0,31,63,0.06)]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-secondary">
              Focus unit
            </p>
            <h2 className="mt-0.5 truncate font-heading text-[18px] font-bold leading-tight text-primary">
              {carTitle(car)}
            </h2>
            <span className="mt-1 inline-block rounded bg-surface-container-high px-2 py-0.5 font-mono text-[11px] text-on-surface-variant">
              REG: {car.licensePlate || 'not set'}
            </span>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${state.chip}`}>
            {state.label}
          </span>
        </div>

        <div className="relative my-4 h-36 overflow-hidden rounded-xl bg-surface-container-low">
          {car.imageUrl ? (
            <img src={car.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#001f3f_0%,#000613_100%)]">
              <LuCarFront className="text-[42px] text-secondary-container/80" aria-hidden />
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-primary/80 px-2.5 py-1 text-[11px] text-on-primary backdrop-blur-md">
            <LuWarehouse className="text-[13px] text-secondary-container" aria-hidden />
            {car.location?.name || car.pickupArea || 'Pickup area not set'}
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-container-low p-3">
            <p className="text-[10.5px] text-on-surface-variant">Daily rate</p>
            <p className="mt-0.5 text-[13px] font-bold text-primary">
              {money(car.dailyRate, car.currency || currency)}
            </p>
            <p className="mt-1 text-[10.5px] text-on-surface-variant">
              Min {car.minRentalDays} day{car.minRentalDays === 1 ? '' : 's'}
            </p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-3">
            <p className="text-[10.5px] text-on-surface-variant">Security deposit</p>
            <p className="mt-0.5 text-[13px] font-bold text-primary">
              {money(car.depositAmount, car.currency || currency)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[10.5px] text-on-surface-variant">
              <LuCircleAlert
                className={`text-[11px] ${car.isAvailable === false ? 'text-error' : 'text-emerald-600'}`}
                aria-hidden
              />
              {car.isAvailable === false ? 'Unavailable now' : 'Available to book'}
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl bg-surface-container-low p-3.5">
          <Row
            label="Service due"
            value={car.nextServiceDueAt ? dayOf(car.nextServiceDueAt) : 'Not scheduled'}
          />
          <Row label="Body / fuel" value={[car.bodyType, fuelTypeLabel(car.fuelType)].filter(Boolean).join(' · ') || '—'} />
          <Row label="Transmission" value={transmissionLabel(car.transmission)} />
          <Row label="Seats" value={car.seats ? String(car.seats) : '—'} />
        </div>

        <div className="mt-3 rounded-xl bg-surface-container-low p-3">
          <div className="flex items-center justify-between text-[10.5px] text-on-surface-variant">
            <span className="flex items-center gap-1">
              <LuCalendarClock className="text-[12px]" aria-hidden />
              Service window
            </span>
            <span className={`font-bold ${serviceOverdue ? 'text-error' : 'text-primary'}`}>
              {!car.nextServiceDueAt
                ? 'Not scheduled'
                : !serviceKnown
                  ? `Due ${dayOf(car.nextServiceDueAt)}`
                  : serviceOverdue
                    ? 'Overdue'
                    : `${Math.round(serviceShare)}% of 30d left`}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div
              className={`h-full rounded-full ${serviceOverdue ? 'bg-error' : 'bg-emerald-500'}`}
              style={{ width: `${serviceKnown ? Math.max(4, serviceShare) : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4">
        <Link
          href="/car-hire/manage/fleet"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container px-3 py-2.5 text-[12px] font-bold text-on-primary transition-colors hover:bg-primary"
        >
          <LuGauge className="text-[15px]" aria-hidden />
          Manage unit
        </Link>
        <Link
          href="/car-hire/manage/bookings"
          title="Bookings for this fleet"
          className="grid h-10 w-10 place-items-center rounded-xl bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container"
        >
          <LuCalendarClock className="text-[17px]" aria-hidden />
        </Link>
        <a
          href={`/car-hire/${car.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open public listing"
          className="grid h-10 w-10 place-items-center rounded-xl bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container"
        >
          <LuMapPin className="text-[17px]" aria-hidden />
        </a>
      </div>
      <p className="mt-2 text-center text-[10px] text-on-surface-variant">
        Showing 1 of {fleetTotal.toLocaleString()}{' '}
        {`unit${fleetTotal === 1 ? '' : 's'} in this workspace`}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] text-on-surface-variant">{label}</span>
      <span className="text-right text-[11.5px] font-semibold text-primary">{value}</span>
    </div>
  )
}
