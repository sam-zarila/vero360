'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  analyticsCompletionRate,
  prettyStatus,
  type ProviderAnalytics,
} from '@/lib/car-hire'
import { getAnalytics, ProviderApiError } from '@/lib/car-hire-owner-api'
import { formatDateTime, formatMwk } from '@/lib/vero-api'
import { useProviderAuth } from '../components/ProviderShell'
import {
  ProviderCard,
  ProviderError,
  ProviderLoading,
  ProviderNotice,
  ProviderPageHeading,
  StatCard,
  ghostButton,
  primaryButton,
} from '../components/ProviderUI'

type ViewState = 'loading' | 'ready' | 'error'

type Preset = 7 | 30 | 90

const PRESETS: { days: Preset; label: string }[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
]

const DAY_MS = 24 * 60 * 60 * 1000

type BreakdownRow = {
  key: string
  title: string
  subtitle: string
  bookings: number
  bookedDays: number
  utilizationRate: number
  revenue: number
}

function BreakdownCard({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: BreakdownRow[]
}) {
  return (
    <ProviderCard style={{ marginTop: 16 }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, letterSpacing: '-0.2px' }}>{title}</h2>
      <p style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--text-3)' }}>
        {description}
      </p>
      <div style={{ display: 'grid', gap: 7, marginTop: 11 }}>
        {rows.map(row => (
          <div
            key={row.key}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 10,
              padding: '10px 11px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{row.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {row.subtitle} · {row.bookings} {row.bookings === 1 ? 'booking' : 'bookings'} ·{' '}
                {row.bookedDays} days on hire
              </div>
              <div
                aria-hidden
                style={{
                  marginTop: 7,
                  height: 5,
                  borderRadius: 999,
                  background: 'var(--border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, row.utilizationRate))}%`,
                    height: '100%',
                    background: '#F97316',
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)' }}>
                {formatMwk(row.revenue)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {row.utilizationRate}% used
              </div>
            </div>
          </div>
        ))}
      </div>
    </ProviderCard>
  )
}

export default function ProviderPerformancePage() {
  const { signOutNow } = useProviderAuth()
  const [days, setDays] = useState<Preset>(30)
  const [state, setState] = useState<ViewState>('loading')
  const [analytics, setAnalytics] = useState<ProviderAnalytics | null>(null)
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    setSessionExpired(false)
    setForbidden(false)
    const to = new Date()
    const from = new Date(to.getTime() - days * DAY_MS)
    try {
      const next = await getAnalytics(from.toISOString(), to.toISOString())
      setAnalytics(next)
      setRange({ from: from.toISOString(), to: to.toISOString() })
      setState('ready')
    } catch (err) {
      if (err instanceof ProviderApiError && err.status === 401) setSessionExpired(true)
      if (err instanceof ProviderApiError && (err.status === 403 || err.status === 404)) {
        setForbidden(true)
      }
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load performance analytics. Please try again.',
      )
      setState('error')
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const heading = (
    <ProviderPageHeading
      eyebrow="Provider workspace"
      title="Performance"
      description="Bookings, completion, cancellations, and revenue for the selected period. Figures come from the backend and are never estimated on this page."
      actions={
        <button type="button" onClick={() => void load()} style={ghostButton}>
          Refresh
        </button>
      }
    />
  )

  if (state === 'loading') {
    return (
      <>
        {heading}
        <ProviderLoading label="Loading performance analytics…" />
      </>
    )
  }

  if (state === 'error' || !analytics) {
    return (
      <>
        {heading}
        <ProviderError
          message={
            forbidden
              ? 'This Vero360 account does not have permission to view performance analytics. Ask the operator owner to grant the performance.view permission.'
              : sessionExpired
                ? 'Your session expired or is no longer valid. Sign out and sign in again to continue.'
                : error || 'Could not load performance analytics.'
          }
          onRetry={() => void load()}
          action={
            sessionExpired ? (
              <button type="button" onClick={() => void signOutNow()} style={ghostButton}>
                Sign out
              </button>
            ) : (
              <Link href="/car-hire/manage/bookings" style={ghostButton}>
                Open bookings
              </Link>
            )
          }
        />
      </>
    )
  }

  const rate = analyticsCompletionRate(analytics)
  const noFigures =
    analytics.bookings == null &&
    analytics.completed == null &&
    analytics.cancelled == null &&
    analytics.revenue == null
  const noBookings = analytics.bookings != null && analytics.bookings === 0
  const presetLabel = PRESETS.find(preset => preset.days === days)?.label ?? `Last ${days} days`

  return (
    <>
      {heading}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 7,
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }} role="group" aria-label="Date range">
          {PRESETS.map(preset => {
            const active = preset.days === days
            return (
              <button
                key={preset.days}
                type="button"
                onClick={() => setDays(preset.days)}
                aria-pressed={active}
                style={{
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
                {preset.label}
              </button>
            )
          })}
        </div>
        <span
          style={{
            display: 'inline-flex',
            padding: '5px 9px',
            borderRadius: 999,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--text-3)',
          }}
        >
          Currency: {analytics.currency}
        </span>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: 12, lineHeight: 1.6, color: 'var(--text-3)' }}>
        {presetLabel}
        {range ? ` · ${formatDateTime(range.from)} → ${formatDateTime(range.to)}` : ''}. Data as of{' '}
        <strong style={{ color: 'var(--text-2)' }}>
          {analytics.asOf ? formatDateTime(analytics.asOf) : 'a time not provided by the API'}
        </strong>
        . The backend is authoritative for these figures.
      </p>

      {noFigures ? (
        <div style={{ marginBottom: 14 }}>
          <ProviderNotice tone="warn">
            The API returned no figures for this period. Nothing is inferred or filled in here —
            choose a wider range or refresh when activity has been recorded.
          </ProviderNotice>
        </div>
      ) : noBookings ? (
        <div style={{ marginBottom: 14 }}>
          <ProviderNotice tone="info">
            No bookings were recorded in this period. Figures for other fields are shown only when
            the backend returns them.
          </ProviderNotice>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12,
        }}
      >
        <StatCard
          label="Bookings"
          value={analytics.bookings ?? '—'}
          hint="Requests recorded in the selected period"
        />
        <StatCard
          label="Completed"
          value={analytics.completed ?? '—'}
          hint="Rentals marked completed by the backend"
          tone="good"
        />
        <StatCard
          label="Cancelled"
          value={analytics.cancelled ?? '—'}
          hint="Cancelled or rejected bookings"
          tone={analytics.cancelled != null && analytics.cancelled > 0 ? 'warn' : 'muted'}
        />
        <StatCard
          label="Completion rate"
          value={rate == null ? '—' : `${Math.round(rate)}%`}
          hint="Derived from completed ÷ bookings when the API omits it"
        />
        <StatCard
          label="Revenue"
          value={analytics.revenue == null ? '—' : formatMwk(analytics.revenue)}
          hint={`Recorded in the API response (${analytics.currency})`}
          tone="good"
        />
        <StatCard
          label="Utilisation"
          value={analytics.utilizationRate == null ? '—' : `${analytics.utilizationRate}%`}
          hint="Days on hire ÷ days available across the fleet"
        />
      </div>

      {analytics.listings.length > 0 ? (
        <BreakdownCard
          title="By listing"
          description="Identical cars are grouped into one listing. Utilisation counts confirmed, active and completed rentals."
          rows={analytics.listings.map(listing => ({
            key: listing.listingId,
            title: listing.name,
            subtitle: `${listing.unitCount} ${listing.unitCount === 1 ? 'car' : 'cars'}`,
            bookings: listing.bookings,
            bookedDays: listing.bookedDays,
            utilizationRate: listing.utilizationRate,
            revenue: listing.revenue,
          }))}
        />
      ) : null}

      {analytics.units.length > analytics.listings.length ? (
        <BreakdownCard
          title="By car"
          description="Each physical car, so you can spot units that sit idle while their twins are busy."
          rows={analytics.units.map(unit => ({
            key: unit.carId,
            title: unit.unitLabel ? `${unit.name} · ${unit.unitLabel}` : unit.name,
            subtitle: unit.licensePlate || 'No plate',
            bookings: unit.bookings,
            bookedDays: unit.bookedDays,
            utilizationRate: unit.utilizationRate,
            revenue: unit.revenue,
          }))}
        />
      ) : null}

      {analytics.byStatus.length > 0 ? (
        <ProviderCard style={{ marginTop: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, letterSpacing: '-0.2px' }}>
            Bookings by status
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--text-3)' }}>
            Reported by the backend for the selected period.
          </p>
          <div style={{ display: 'grid', gap: 7, marginTop: 11 }}>
            {analytics.byStatus.map(row => (
              <div
                key={row.status}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '9px 11px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: 13,
                  fontWeight: 800,
                  color: 'var(--text-2)',
                }}
              >
                <span>{prettyStatus(row.status)}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.count}</span>
              </div>
            ))}
          </div>
        </ProviderCard>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <Link href="/car-hire/manage/bookings" style={primaryButton}>
          Open bookings
        </Link>
        <Link href="/car-hire/manage/team" style={ghostButton}>
          Team access
        </Link>
      </div>

      <div style={{ marginTop: 16 }}>
        <ProviderNotice tone="info">
          Revenue is the amount the backend returns for this range, not a settled payout. This page
          does not estimate fees, refunds, or provider earnings.
        </ProviderNotice>
      </div>
    </>
  )
}
