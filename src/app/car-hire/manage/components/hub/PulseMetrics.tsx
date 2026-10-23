'use client'

import type { ReactNode } from 'react'
import type { DispatchBoard, ProviderSummary } from '@/lib/car-hire'
import { LuCarFront, LuKeyRound, LuTimer } from 'react-icons/lu'
import { percent } from './format'

const CARD =
  'flex flex-col justify-between rounded-xl bg-surface-container-lowest p-5 shadow-[0_2px_10px_rgba(0,31,63,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,31,63,0.1)]'
const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant'

export function PulseMetrics({
  summary,
  board,
}: {
  summary: ProviderSummary
  board: DispatchBoard | null
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <UtilisationCard summary={summary} />
      <ListingStateCard summary={summary} />
      <RentalsCard summary={summary} />
      <TurnaroundCard board={board} />
    </div>
  )
}

function UtilisationCard({ summary }: { summary: ProviderSummary }) {
  const { total, published, draft, pendingReview, suspended } = summary.fleet
  const utilisation = percent(published, total)
  const ring = 'stroke-secondary-container'

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className={EYEBROW}>Live utilisation</p>
          <p className="font-heading text-[30px] font-extrabold leading-none tracking-tight text-primary">
            {utilisation.toFixed(1)}%
          </p>
          <p className="text-[13px] leading-snug text-on-surface-variant">
            {published.toLocaleString()} of {total.toLocaleString()} units published
          </p>
        </div>
        <div className="relative grid h-16 w-16 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90" aria-hidden>
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              strokeWidth="3.8"
              className="stroke-surface-container-high"
            />
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              strokeWidth="3.8"
              strokeLinecap="round"
              strokeDasharray={`${utilisation} ${100 - utilisation}`}
              className={`${ring} transition-all duration-700 ease-out`}
            />
          </svg>
          <span className="absolute text-[12px] font-bold text-primary">
            {published.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-surface-container pt-3 text-[11px] text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-secondary-container" />
          {pendingReview > 0 ? `${pendingReview} awaiting review` : 'All listings reviewed'}
        </span>
        <span className="font-medium text-primary">
          {suspended > 0 ? `${suspended} suspended` : `${draft} draft`}
        </span>
      </div>
    </div>
  )
}

function ListingStateCard({ summary }: { summary: ProviderSummary }) {
  const { published, pendingReview, draft, suspended, unavailableNow, maintenanceBlocked } =
    summary.fleet

  const rows = [
    { label: 'Published', value: published, dot: 'bg-emerald-500' },
    { label: 'Awaiting review', value: pendingReview, dot: 'bg-secondary-container' },
    { label: 'Draft', value: draft, dot: 'bg-slate-400' },
    { label: 'Suspended', value: suspended, dot: 'bg-error' },
  ]
  const denominator = rows.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className={CARD}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={EYEBROW}>Fleet health</span>
        <LuCarFront className="text-[19px] text-primary-container" aria-hidden />
      </div>

      <div className="space-y-1.5">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 text-on-surface-variant">
              <span className={`h-2.5 w-2.5 rounded-sm ${row.dot}`} />
              {row.label}
            </span>
            <span
              className={`font-bold ${row.label === 'Suspended' && row.value > 0 ? 'text-error' : 'text-on-surface'}`}
            >
              {row.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-surface-container">
        {denominator > 0
          ? rows.map(row => (
              <span
                key={row.label}
                className={row.dot}
                style={{ width: `${percent(row.value, denominator)}%` }}
                title={`${row.label}: ${row.value}`}
              />
            ))
          : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full bg-surface-container px-2 py-0.5 font-medium text-on-surface-variant">
          {unavailableNow} unavailable now
        </span>
        <span className="rounded-full bg-surface-container px-2 py-0.5 font-medium text-on-surface-variant">
          {maintenanceBlocked} in maintenance
        </span>
      </div>
    </div>
  )
}

function RentalsCard({ summary }: { summary: ProviderSummary }) {
  const { active, upcoming, completedThisMonth, pendingDecision } = summary.bookings
  const onRoadShare = percent(active, active + upcoming)

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className={EYEBROW}>Rentals right now</p>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-[30px] font-extrabold leading-none tracking-tight text-primary">
              {active.toLocaleString()}
            </span>
            <span className="text-[12px] font-semibold text-on-surface-variant">on rental</span>
          </div>
          <p className="text-[13px] leading-snug text-on-surface-variant">
            {upcoming.toLocaleString()} upcoming · {completedThisMonth.toLocaleString()} completed
            this month
          </p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-container text-secondary-container">
          <LuKeyRound className="text-[19px]" aria-hidden />
        </span>
      </div>

      <div className="mt-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
          {active + upcoming > 0 ? (
            <>
              <span className="bg-emerald-500" style={{ width: `${onRoadShare}%` }} />
              <span className="bg-sky-500" style={{ width: `${100 - onRoadShare}%` }} />
            </>
          ) : null}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Active now
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            Upcoming
          </span>
        </div>
      </div>

      <div className="mt-3 border-t border-surface-container pt-3 text-[11px]">
        {pendingDecision > 0 ? (
          <span className="font-bold text-secondary">
            {pendingDecision} booking request{pendingDecision === 1 ? '' : 's'} need a decision
          </span>
        ) : (
          <span className="text-on-surface-variant">No booking requests waiting on you</span>
        )}
      </div>
    </div>
  )
}

function TurnaroundCard({ board }: { board: DispatchBoard | null }) {
  const departures = board ? board.pickups.length : 0
  const returns = board ? board.returns.length : 0
  const attention = board
    ? board.latePickups.length +
      board.overdueReturns.length +
      board.awaitingResponse.length +
      board.upcomingPickups.length
    : 0
  const serviceDue = board ? board.serviceDue.length : 0

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={EYEBROW}>Today&apos;s turnaround</p>
          <div className="mt-1 flex items-center gap-4">
            <div>
              <span className="font-heading text-[30px] font-extrabold leading-none tracking-tight text-primary">
                {departures}
              </span>
              <span className="mt-1 block text-[11px] text-on-surface-variant">Handovers</span>
            </div>
            <span className="h-8 w-px bg-surface-container" />
            <div>
              <span className="font-heading text-[30px] font-extrabold leading-none tracking-tight text-secondary-container">
                {returns}
              </span>
              <span className="mt-1 block text-[11px] text-on-surface-variant">Returns</span>
            </div>
          </div>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-container text-on-surface">
          <LuTimer className="text-[19px]" aria-hidden />
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-2.5 py-2 text-[11px]">
        <span
          className={`font-semibold ${attention > 0 ? 'text-error' : 'text-on-surface-variant'}`}
        >
          {board == null
            ? 'Dispatch board unavailable'
            : attention > 0
              ? `${attention} need attention`
              : 'Nothing overdue'}
        </span>
        <span className="font-medium text-secondary">
          {serviceDue > 0 ? `${serviceDue} service due` : 'No service due'}
        </span>
      </div>
    </div>
  )
}

/** Shared empty/placeholder card used by the hub sections. */
export function HubEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-outline-variant/70 bg-surface-container-low px-4 py-8 text-center text-[12.5px] leading-relaxed text-on-surface-variant">
      {children}
    </div>
  )
}

export function HubSectionTitle({
  icon,
  title,
  subtitle,
  trailing,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  trailing?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-container p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-container text-secondary-container">
          {icon}
        </span>
        <div>
          <h2 className="font-heading text-[16px] font-bold leading-tight text-primary">{title}</h2>
          <p className="text-[11px] leading-snug text-on-surface-variant">{subtitle}</p>
        </div>
      </div>
      {trailing}
    </div>
  )
}
