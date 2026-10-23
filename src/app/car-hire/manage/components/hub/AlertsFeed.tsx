'use client'

import Link from 'next/link'
import { carTitle, type DispatchBoard, type DispatchBooking } from '@/lib/car-hire'
import {
  LuArrowUpRight,
  LuCircleAlert,
  LuCircleCheck,
  LuClock,
  LuRoute,
  LuTimer,
  LuWrench,
} from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { dayOf, relativeLabel, timeOf } from './format'

type Tone = 'error' | 'warn' | 'service' | 'info'

type Alert = {
  id: string
  tone: Tone
  Icon: IconType
  title: string
  badge: string
  when: string
  body: string
  primary: { label: string; href: string }
  secondary?: { label: string; href: string }
}

const TONE_STYLES: Record<
  Tone,
  { bar: string; icon: string; badge: string; primary: string }
> = {
  error: {
    bar: 'bg-error',
    icon: 'bg-error-container text-error',
    badge: 'bg-error text-on-error',
    primary: 'bg-primary-container text-on-primary hover:bg-primary',
  },
  warn: {
    bar: 'bg-secondary-container',
    icon: 'bg-secondary-fixed text-secondary',
    badge: 'bg-secondary-fixed text-on-secondary-fixed',
    primary: 'bg-secondary-container text-on-secondary hover:bg-secondary',
  },
  service: {
    bar: 'bg-secondary',
    icon: 'bg-surface-container-high text-primary',
    badge: 'bg-surface-container text-primary',
    primary: 'bg-surface-container-high text-on-surface hover:bg-surface-container',
  },
  info: {
    bar: 'bg-sky-500',
    icon: 'bg-sky-50 text-sky-700',
    badge: 'bg-sky-100 text-sky-800',
    primary: 'bg-primary-container text-on-primary hover:bg-primary',
  },
}

function bookingLabel(booking: DispatchBooking): string {
  const name = booking.car ? carTitle(booking.car) : booking.bookingNumber
  const plate = booking.assignedUnit?.licensePlate
  return plate ? `${name} (${plate})` : name
}

function bookingHref(booking: DispatchBooking): string {
  return `/car-hire/manage/bookings/${booking.id}`
}

function buildAlerts(board: DispatchBoard | null, now: number | null): Alert[] {
  if (!board) return []
  const alerts: Alert[] = []

  for (const booking of board.overdueReturns.slice(0, 2)) {
    const rel = relativeLabel(booking.endAt, now)
    alerts.push({
      id: `overdue-${booking.id}`,
      tone: 'error',
      Icon: LuCircleAlert,
      title: bookingLabel(booking),
      badge: 'Overdue return',
      when: rel?.text ?? dayOf(booking.endAt),
      body: `Return was due ${timeOf(booking.endAt)} on ${dayOf(booking.endAt)}.${
        booking.renterName ? ` Renter: ${booking.renterName}.` : ''
      }`,
      primary: { label: 'Open booking', href: bookingHref(booking) },
      secondary: { label: 'Dispatch board', href: '/car-hire/manage/dispatch' },
    })
  }

  for (const booking of board.latePickups.slice(0, 2)) {
    const rel = relativeLabel(booking.startAt, now)
    alerts.push({
      id: `late-${booking.id}`,
      tone: 'warn',
      Icon: LuClock,
      title: bookingLabel(booking),
      badge: 'Late pickup',
      when: rel?.text ?? dayOf(booking.startAt),
      body: `Handover was scheduled for ${timeOf(booking.startAt)}${
        booking.branch ? ` at ${booking.branch.name}` : ''
      }. The car has not been released.`,
      primary: { label: 'Open booking', href: bookingHref(booking) },
      secondary: { label: 'Dispatch board', href: '/car-hire/manage/dispatch' },
    })
  }

  for (const booking of board.upcomingPickups.slice(0, 2)) {
    alerts.push({
      id: `upcoming-${booking.id}`,
      tone: 'info',
      Icon: LuTimer,
      title: bookingLabel(booking),
      badge: 'Paid booking',
      when: dayOf(booking.startAt),
      body: `${booking.renterName || 'A renter'} paid. Pickup ${dayOf(booking.startAt)}${
        booking.branch ? ` at ${booking.branch.name}` : ''
      }. Prepare the car.`,
      primary: { label: 'Open booking', href: bookingHref(booking) },
      secondary: { label: 'All bookings', href: '/car-hire/manage/bookings' },
    })
  }

  for (const booking of board.awaitingResponse.slice(0, 2)) {
    const rel = relativeLabel(booking.holdExpiresAt, now)
    alerts.push({
      id: `awaiting-${booking.id}`,
      tone: 'info',
      Icon: LuTimer,
      title: bookingLabel(booking),
      badge: 'Needs decision',
      when: rel?.text ?? 'hold open',
      body: `Request from ${booking.renterName || 'a renter'} is waiting for your confirm or reject decision. Hold expires ${timeOf(
        booking.holdExpiresAt,
      )}.`,
      primary: { label: 'Decide now', href: bookingHref(booking) },
      secondary: { label: 'All requests', href: '/car-hire/manage/bookings' },
    })
  }

  for (const item of board.serviceDue.slice(0, 2)) {
    alerts.push({
      id: `service-${item.carId}`,
      tone: 'service',
      Icon: LuWrench,
      title: `${item.title}${item.licensePlate ? ` (${item.licensePlate})` : ''}`,
      badge: item.overdue ? 'Service overdue' : 'Service due',
      when: dayOf(item.nextServiceDueAt),
      body: `Scheduled maintenance is ${
        item.overdue ? 'past due' : `due on ${dayOf(item.nextServiceDueAt)}`
      }. Book a slot or hold the unit out of dispatch.`,
      primary: { label: 'Open fleet', href: '/car-hire/manage/fleet' },
      secondary: { label: 'Dispatch board', href: '/car-hire/manage/dispatch' },
    })
  }

  return alerts.slice(0, 4)
}

export function AlertsFeed({
  board,
  now,
}: {
  board: DispatchBoard | null
  now: number | null
}) {
  const alerts = buildAlerts(board, now)

  if (alerts.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex items-start gap-3.5 rounded-xl bg-surface-container-lowest p-4 shadow-[0_1px_6px_rgba(0,31,63,0.06)]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <LuCircleCheck className="text-[20px]" aria-hidden />
          </span>
          <div>
            <p className="text-[12.5px] font-bold text-primary">No fleet alerts</p>
            <p className="mt-1 text-[12px] leading-relaxed text-on-surface-variant">
              {board
                ? 'Nothing is overdue, unhanded, or awaiting a decision on today’s board.'
                : 'The dispatch board could not be loaded, so alert checks are paused.'}
            </p>
          </div>
        </div>
        <Link
          href="/car-hire/manage/dispatch"
          className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-[0_1px_6px_rgba(0,31,63,0.06)] transition-colors hover:bg-surface-container-low"
        >
          <div className="flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-container text-on-surface">
              <LuRoute className="text-[20px]" aria-hidden />
            </span>
            <div>
              <p className="text-[12.5px] font-bold text-primary">Open the dispatch board</p>
              <p className="mt-1 text-[12px] text-on-surface-variant">
                Handovers, returns, and service due for today.
              </p>
            </div>
          </div>
          <LuArrowUpRight className="shrink-0 text-[16px] text-outline" aria-hidden />
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {alerts.map(alert => {
        const tone = TONE_STYLES[alert.tone]
        return (
          <article
            key={alert.id}
            className="relative flex items-start gap-3.5 overflow-hidden rounded-xl bg-surface-container-lowest p-4 shadow-[0_1px_6px_rgba(0,31,63,0.06)]"
          >
            <span className={`absolute inset-y-0 left-0 w-1.5 ${tone.bar}`} aria-hidden />
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.icon}`}
            >
              <alert.Icon className="text-[20px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="truncate text-[12.5px] font-bold text-primary">{alert.title}</p>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.badge}`}
                  >
                    {alert.badge}
                  </span>
                </div>
                <span className="shrink-0 text-[10.5px] text-on-surface-variant">{alert.when}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-on-surface-variant">
                {alert.body}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={alert.primary.href}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${tone.primary}`}
                >
                  {alert.primary.label}
                  <LuArrowUpRight className="text-[13px]" aria-hidden />
                </Link>
                {alert.secondary ? (
                  <Link
                    href={alert.secondary.href}
                    className="rounded-lg bg-surface-container-high px-3 py-1.5 text-[11px] font-semibold text-on-surface transition-colors hover:bg-surface-container"
                  >
                    {alert.secondary.label}
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
