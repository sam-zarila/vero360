'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  bookingStatusLabel,
  bookingStatusTone,
  carTitle,
  paymentStatusLabel,
  type DispatchBoard,
  type DispatchBooking,
} from '@/lib/car-hire'
import { LuArrowUpRight, LuDownload, LuListFilter } from 'react-icons/lu'
import { HubEmpty, HubSectionTitle } from './PulseMetrics'
import { money, relativeLabel, timeOf, uniqueById } from './format'

type TabKey = 'all' | 'handovers' | 'returns'

const PAGE_SIZE = 6

export function DispatchStream({
  board,
  currency,
  now,
}: {
  board: DispatchBoard | null
  currency: string
  now: number | null
}) {
  const [tab, setTab] = useState<TabKey>('all')
  const [page, setPage] = useState(0)

  const handovers = useMemo(
    () => (board ? uniqueById([...board.pickups, ...board.latePickups]) : []),
    [board],
  )
  const returns = useMemo(
    () => (board ? uniqueById([...board.returns, ...board.overdueReturns]) : []),
    [board],
  )
  const allRows = useMemo(() => uniqueById([...handovers, ...returns]), [handovers, returns])

  const rows = tab === 'handovers' ? handovers : tab === 'returns' ? returns : allRows
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  function selectTab(next: TabKey) {
    setTab(next)
    setPage(0)
  }

  function exportCsv() {
    const header = [
      'booking_number',
      'vehicle',
      'plate',
      'renter',
      'phone',
      'start_at',
      'end_at',
      'branch',
      'status',
      'payment',
      'deposit',
      'total',
    ]
    const lines = rows.map(booking => {
      const cells = [
        booking.bookingNumber,
        booking.car ? carTitle(booking.car) : `Car #${booking.carId ?? ''}`,
        booking.assignedUnit?.licensePlate || '',
        booking.renterName || '',
        booking.renterPhone || '',
        booking.startAt || '',
        booking.endAt || '',
        booking.branch?.name || '',
        bookingStatusLabel(booking.bookingStatus),
        paymentStatusLabel(booking.paymentStatus),
        String(booking.car?.depositAmount ?? ''),
        String(booking.totalCost ?? booking.total ?? ''),
      ]
      return cells
        .map(value => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    })
    const blob = new Blob([`\uFEFF${[header.join(','), ...lines].join('\r\n')}`], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `vero360-dispatch-${board?.date || 'today'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: allRows.length },
    { key: 'handovers', label: 'Handovers', count: handovers.length },
    { key: 'returns', label: 'Returns', count: returns.length },
  ]

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-[0_2px_12px_rgba(0,31,63,0.06)]">
      <HubSectionTitle
        icon={<LuListFilter className="text-[17px]" aria-hidden />}
        title="Live turnaround & dispatch stream"
        subtitle="Scheduled handovers, return bays, and deposit reconciliations for today."
        trailing={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-surface-container-low p-1">
              {tabs.map(item => {
                const active = tab === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => selectTab(item.key)}
                    aria-pressed={active}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] transition-all ${
                      active
                        ? 'bg-surface-container-lowest font-bold text-primary shadow-sm'
                        : 'font-medium text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {item.label} ({item.count})
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={exportCsv}
              disabled={rows.length === 0}
              title="Export this queue as CSV"
              className="rounded-xl bg-surface-container p-2 text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40"
            >
              <LuDownload className="text-[18px]" aria-hidden />
            </button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <div className="p-4">
          <HubEmpty>
            {board
              ? 'No handovers or returns are scheduled for today.'
              : 'The dispatch board could not be loaded. Open the dispatch board to retry.'}
          </HubEmpty>
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-low text-[10px] uppercase tracking-wider text-on-surface-variant">
                  <th className="px-5 py-2.5 font-semibold">Vehicle &amp; reg</th>
                  <th className="px-4 py-2.5 font-semibold">Purpose</th>
                  <th className="px-4 py-2.5 font-semibold">Client / driver</th>
                  <th className="px-4 py-2.5 font-semibold">Slot &amp; hub</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Payment &amp; deposit</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {visible.map(booking => (
                  <Row
                    key={booking.id}
                    booking={booking}
                    currency={currency}
                    now={now}
                    isReturn={returns.some(item => item.id === booking.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-2 bg-surface-container-low px-4 py-3 text-[11px] text-on-surface-variant sm:flex-row">
            <span>
              Showing {visible.length} of {rows.length}{' '}
              {`scheduled operation${rows.length === 1 ? '' : 's'} for ${board?.date || 'today'}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(value => Math.max(0, value - 1))}
                disabled={safePage === 0}
                className="rounded-lg bg-surface-container-lowest px-2.5 py-1 font-medium text-on-surface shadow-sm transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                Previous
              </button>
              <span className="font-semibold text-primary">
                Page {safePage + 1} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}
                disabled={safePage >= pageCount - 1}
                className="rounded-lg bg-surface-container-lowest px-2.5 py-1 font-medium text-on-surface shadow-sm transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Row({
  booking,
  currency,
  now,
  isReturn,
}: {
  booking: DispatchBooking
  currency: string
  now: number | null
  isReturn: boolean
}) {
  const tone = bookingStatusTone(booking.bookingStatus)
  const slotIso = isReturn ? booking.endAt : booking.startAt
  const rel = relativeLabel(slotIso, now)
  const deposit = booking.car?.depositAmount ?? 0

  return (
    <tr className="transition-colors hover:bg-surface-container-low/60">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-container-high text-[11px] font-bold text-primary">
            {booking.car?.imageUrl ? (
              <img src={booking.car.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (booking.car?.make || 'V').slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <span className="block max-w-[190px] truncate text-[12px] font-bold text-primary">
              {booking.car ? carTitle(booking.car) : `Car #${booking.carId ?? '—'}`}
            </span>
            <span className="block truncate font-mono text-[10.5px] text-on-surface-variant">
              {booking.assignedUnit?.licensePlate || 'Unit not assigned'} · {booking.bookingNumber}
            </span>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className="inline-flex rounded bg-surface-container px-2 py-0.5 text-[10.5px] font-semibold text-primary">
          {booking.bookingMode === 'INSTANT' ? 'Instant booking' : 'Request to book'}
        </span>
      </td>

      <td className="px-4 py-3">
        <span className="block max-w-[160px] truncate text-[12px] font-semibold text-primary">
          {booking.renterName || 'Renter not provided'}
        </span>
        <span className="block max-w-[160px] truncate text-[10.5px] text-on-surface-variant">
          {booking.renterPhone || booking.renterEmail || 'No contact on file'}
        </span>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span
            className={`text-[12px] font-bold ${
              rel?.overdue ? 'text-error' : 'text-primary'
            }`}
          >
            {isReturn ? 'Return' : 'Pickup'} {timeOf(slotIso)}
          </span>
          <span className="text-[10.5px] text-on-surface-variant">
            {rel ? `${rel.text} · ` : ''}
            {booking.branch?.name || 'Hub not set'}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <span
          className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-bold"
          style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}
        >
          {bookingStatusLabel(booking.bookingStatus)}
        </span>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-[11.5px] font-semibold text-primary">
            {paymentStatusLabel(booking.paymentStatus)}
          </span>
          <span className="text-[10.5px] text-on-surface-variant">
            {deposit > 0 ? `${money(deposit, booking.currency || currency)} hold` : 'No deposit'}
          </span>
        </div>
      </td>

      <td className="px-5 py-3 text-right">
        <Link
          href={`/car-hire/manage/bookings/${booking.id}`}
          className="inline-flex items-center gap-1 rounded-lg bg-primary-container px-2.5 py-1.5 text-[11px] font-bold text-on-primary transition-colors hover:bg-primary"
        >
          Open
          <LuArrowUpRight className="text-[12px]" aria-hidden />
        </Link>
      </td>
    </tr>
  )
}
