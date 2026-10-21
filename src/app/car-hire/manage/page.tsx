'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { APP_STORE_URL, PLAY_STORE_URL } from '@/app/components/landing/veroServices'
import { getDispatchBoard, getFleet, getSummary, ProviderApiError } from '@/lib/car-hire-owner-api'
import type { DispatchBoard, OwnerVehicle, ProviderSummary } from '@/lib/car-hire'
import { formatDateTime } from '@/lib/vero-api'
import { useProviderAuth } from './components/ProviderShell'
import { ProviderNotice, ghostButton, primaryButton } from './components/ProviderUI'
import { PulseMetrics } from './components/hub/PulseMetrics'
import { FleetReadinessBoard, FocusUnitPanel } from './components/hub/FleetReadiness'
import { AlertsFeed } from './components/hub/AlertsFeed'
import { DispatchStream } from './components/hub/DispatchStream'
import { needsAttention } from './components/hub/format'
import {
  LuArrowUpRight,
  LuCircleAlert,
  LuPlus,
  LuRefreshCw,
  LuRoute,
  LuTriangleAlert,
} from 'react-icons/lu'

type ViewState = 'loading' | 'ready' | 'no-operator' | 'error'

function todayKey(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Client clock, kept `null` during SSR so server and client markup agree. */
function useNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribing to the system clock, not derived state
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function agoLabel(iso: string | null | undefined, now: number | null): string {
  if (!iso || now == null) return 'live'
  const diff = Math.round((now - Date.parse(iso)) / 60000)
  if (!Number.isFinite(diff)) return 'live'
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

function safeActionHref(href: string | null): string | null {
  if (!href) return null
  if (href.startsWith('/')) return href
  if (href.startsWith('car-hire/')) return `/${href}`
  return null
}

export default function ProviderOverviewPage() {
  const { signOutNow } = useProviderAuth()
  const now = useNow(30000)

  const [state, setState] = useState<ViewState>('loading')
  const [summary, setSummary] = useState<ProviderSummary | null>(null)
  const [fleet, setFleet] = useState<OwnerVehicle[] | null>(null)
  const [board, setBoard] = useState<DispatchBoard | null>(null)
  const [auxError, setAuxError] = useState('')
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const ticket = ++requestId.current
    setError('')
    setAuxError('')
    setSessionExpired(false)
    try {
      const [summaryResult, fleetResult, boardResult] = await Promise.allSettled([
        getSummary(),
        getFleet(),
        getDispatchBoard(todayKey()),
      ])
      if (ticket !== requestId.current) return

      if (summaryResult.status === 'rejected') {
        const apiErr =
          summaryResult.reason instanceof ProviderApiError ? summaryResult.reason : null
        if (apiErr && (apiErr.status === 403 || apiErr.status === 404)) {
          setState('no-operator')
          return
        }
        if (apiErr && apiErr.status === 401) setSessionExpired(true)
        setError(
          summaryResult.reason instanceof Error
            ? summaryResult.reason.message
            : 'Could not load your provider overview. Please try again.',
        )
        setState('error')
        return
      }

      setSummary(summaryResult.value)

      const failed: string[] = []
      if (fleetResult.status === 'fulfilled') {
        setFleet(fleetResult.value)
      } else {
        setFleet(null)
        failed.push('fleet units')
      }
      if (boardResult.status === 'fulfilled') {
        setBoard(boardResult.value)
      } else {
        setBoard(null)
        failed.push('today’s dispatch board')
      }
      setAuxError(failed.length > 0 ? `Could not load ${failed.join(' or ')}.` : '')
      setState('ready')
    } finally {
      if (ticket === requestId.current) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial server fetch on mount; state settles in the promise callbacks
    void load()
  }, [load])

  // Effective focus unit: an explicit pick wins, otherwise the first unit that
  // needs attention. Derived during render so there is no state to sync.
  const selectedUnit = useMemo(() => {
    if (!fleet || fleet.length === 0) return null
    const picked = pickedId != null ? fleet.find(car => car.id === pickedId) : undefined
    return picked ?? fleet.find(needsAttention) ?? fleet[0]
  }, [fleet, pickedId])

  const synced = agoLabel(summary?.asOf, now)
  const clockLabel = useMemo(() => {
    if (now == null) return ''
    return new Date(now).toLocaleString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [now])

  async function refresh() {
    setRefreshing(true)
    if (state !== 'ready') setState('loading')
    await load()
  }

  if (state === 'loading') {
    return (
      <div className="space-y-4">
        <HubHeader
          synced="connecting"
          clockLabel=""
          onRefresh={() => void refresh()}
          refreshing
          currency={null}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[132px] animate-pulse rounded-xl bg-surface-container-lowest shadow-[0_2px_10px_rgba(0,31,63,0.06)]"
            />
          ))}
        </div>
        <div className="h-[420px] animate-pulse rounded-2xl bg-surface-container-lowest shadow-[0_2px_12px_rgba(0,31,63,0.06)]" />
      </div>
    )
  }

  if (state === 'no-operator') {
    return (
      <div className="space-y-4">
        <HubHeader
          synced="no operator"
          clockLabel={clockLabel}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
          currency={null}
        />
        <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-[0_2px_12px_rgba(0,31,63,0.06)]">
          <h2 className="font-heading text-[20px] font-bold tracking-tight text-primary">
            Your provider workspace is not active yet
          </h2>
          <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-on-surface-variant">
            Approved car-hire owners and businesses manage their fleet here. Provider applications
            and vehicle approval happen in the Vero360 app. An approved operator profile does not
            automatically publish a vehicle, and this page never creates a second account.
          </p>
          <div className="mt-4 grid max-w-[720px] gap-2.5">
            <ProviderNotice tone="info">
              Applying in the app? Open Vero360 → Car hire → Become a provider. Staff should ask the
              operator owner to invite their existing Vero360 email.
            </ProviderNotice>
            <ProviderNotice tone="warn">
              If you were recently approved, retry in a moment. Membership and approval changes are
              enforced by the backend on every request.
            </ProviderNotice>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => void refresh()} style={primaryButton}>
              Retry
            </button>
            <Link href="/car-hire" style={ghostButton}>
              Browse public cars
            </Link>
            <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" style={ghostButton}>
              Google Play
            </a>
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" style={ghostButton}>
              App Store
            </a>
          </div>
        </section>
      </div>
    )
  }

  if (state === 'error' || !summary) {
    return (
      <div className="space-y-4">
        <HubHeader
          synced="offline"
          clockLabel={clockLabel}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
          currency={null}
        />
        <section className="rounded-2xl border border-error-container bg-error-container/30 p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-error-container text-error">
              <LuTriangleAlert className="text-[18px]" aria-hidden />
            </span>
            <div>
              <h2 className="text-[14px] font-bold text-error">
                {sessionExpired ? 'Your session is no longer valid' : 'Could not load the hub'}
              </h2>
              <p className="mt-1 max-w-[720px] text-[13px] leading-relaxed text-error/90">
                {sessionExpired
                  ? 'Sign out and sign in again to continue. Nothing was changed by this request.'
                  : error || 'Could not load your provider overview.'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void refresh()} style={primaryButton}>
              Try again
            </button>
            {sessionExpired ? (
              <button type="button" onClick={() => void signOutNow()} style={ghostButton}>
                Sign out
              </button>
            ) : (
              <Link href="/car-hire" style={ghostButton}>
                Browse public cars
              </Link>
            )}
          </div>
        </section>
      </div>
    )
  }

  const actions = summary.actions
    .map(action => ({ ...action, href: safeActionHref(action.href) }))
    .filter(action => action.href)

  return (
    <div className="space-y-4">
      <HubHeader
        synced={synced}
        clockLabel={clockLabel}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
        currency={summary.currency}
      />

      {actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-lowest px-3 py-2 shadow-[0_1px_6px_rgba(0,31,63,0.05)]">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
            Action queues
          </span>
          {actions.map(action => (
            <Link
              key={action.code || action.label}
              href={action.href as string}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                action.count > 0
                  ? 'border-secondary-fixed bg-secondary-fixed/50 font-bold text-on-secondary-fixed hover:bg-secondary-fixed'
                  : 'border-outline-variant/60 font-medium text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {action.label}
              <span className="rounded-full bg-surface-container-lowest px-1.5 text-[10px] font-bold text-on-surface">
                {action.count}
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      {auxError ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-secondary-fixed bg-secondary-fixed/30 px-3.5 py-2.5">
          <LuCircleAlert className="mt-0.5 shrink-0 text-[15px] text-secondary" aria-hidden />
          <p className="text-[12px] leading-relaxed text-on-secondary-fixed">
            {auxError} The counters above are still authoritative; refresh to retry the rest of the
            hub.
          </p>
        </div>
      ) : null}

      <PulseMetrics summary={summary} board={board} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <FleetReadinessBoard
            cars={fleet ?? []}
            loading={fleet == null}
            selectedId={selectedUnit?.id ?? null}
            onSelect={setPickedId}
          />
        </div>
        <div className="xl:col-span-4">
          <FocusUnitPanel
            car={selectedUnit}
            currency={summary.currency}
            fleetTotal={summary.fleet.total}
            now={now}
          />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-heading text-[16px] font-bold text-primary">Fleet health alerts</h2>
            <p className="text-[11.5px] text-on-surface-variant">
              Overdue returns, unhanded pickups, decisions and service windows, straight from
              today&apos;s board.
            </p>
          </div>
          <Link
            href="/car-hire/manage/dispatch"
            className="flex items-center gap-1 text-[11.5px] font-bold text-primary hover:text-secondary"
          >
            Open dispatch board
            <LuArrowUpRight className="text-[13px]" aria-hidden />
          </Link>
        </div>
        <AlertsFeed board={board} now={now} />
      </section>

      <DispatchStream board={board} currency={summary.currency} now={now} />

      <div className="space-y-2.5 pb-2">
        <p className="text-[11.5px] text-on-surface-variant">
          Data as of{' '}
          <strong className="font-semibold text-on-surface">
            {summary.asOf ? formatDateTime(summary.asOf) : 'a time not provided by the API'}
          </strong>
          . Time-sensitive availability is rechecked by the backend at booking time.
        </p>
        <ProviderNotice tone="info">
          This workspace shows operational fleet and booking status only. Booking totals are not
          settled provider payouts, and no payout or revenue figure is inferred from these counts.
        </ProviderNotice>
      </div>
    </div>
  )
}

function HubHeader({
  synced,
  clockLabel,
  onRefresh,
  refreshing,
  currency,
}: {
  synced: string
  clockLabel: string
  onRefresh: () => void
  refreshing: boolean
  currency: string | null
}) {
  return (
    <div className="flex flex-col justify-between gap-4 pt-2 xl:flex-row xl:items-end">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">
          <span className="font-bold text-secondary">Car hire HQ</span>
          <span className="text-outline">/</span>
          <span>Command console</span>
          <span className="text-outline">/</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2 py-0.5 normal-case tracking-normal">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Data sync · {synced}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
          <h1 className="font-heading text-[26px] font-extrabold leading-none tracking-tight text-primary sm:text-[32px]">
            Fleet operations hub
          </h1>
          {clockLabel ? (
            <span className="text-[12px] text-on-surface-variant">{clockLabel}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-xl bg-surface-container-lowest px-3 py-2 text-[11.5px] font-semibold text-on-surface shadow-[0_1px_4px_rgba(0,31,63,0.06)]">
          Currency: {currency || '—'}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh from the backend"
          aria-label="Refresh from the backend"
          className="grid h-10 w-10 place-items-center rounded-xl bg-surface-container-lowest text-on-surface shadow-[0_1px_4px_rgba(0,31,63,0.06)] transition-colors hover:bg-surface-container disabled:opacity-60"
        >
          <LuRefreshCw className={`text-[18px] ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
        </button>
        <Link
          href="/car-hire/manage/dispatch"
          className="flex h-10 items-center gap-1.5 rounded-full bg-surface-container-lowest px-3.5 text-[12px] font-bold text-on-surface shadow-[0_1px_4px_rgba(0,31,63,0.06)] transition-colors hover:bg-surface-container"
        >
          <LuRoute className="text-[16px]" aria-hidden />
          Dispatch
        </Link>
        <Link
          href="/car-hire/manage/fleet"
          className="flex h-10 items-center gap-1.5 rounded-full bg-secondary-container px-4 text-[12px] font-bold text-on-secondary shadow-[0_2px_8px_rgba(255,133,27,0.28)] transition-all active:scale-95 hover:bg-secondary"
        >
          <LuPlus className="text-[16px]" aria-hidden />
          Add vehicle
        </Link>
      </div>
    </div>
  )
}
