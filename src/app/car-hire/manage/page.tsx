'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { APP_STORE_URL, PLAY_STORE_URL } from '@/app/components/landing/veroServices'
import { getSummary, ProviderApiError } from '@/lib/car-hire-owner-api'
import type { ProviderSummary } from '@/lib/car-hire'
import { formatDateTime } from '@/lib/vero-api'
import { useProviderAuth } from './components/ProviderShell'
import {
  ProviderCard,
  ProviderError,
  ProviderLoading,
  ProviderNotice,
  ProviderPageHeading,
  StatCard,
  ghostButton,
  primaryButton,
} from './components/ProviderUI'

type ViewState = 'loading' | 'ready' | 'no-operator' | 'error'

export default function ProviderOverviewPage() {
  const { signOutNow } = useProviderAuth()
  const [state, setState] = useState<ViewState>('loading')
  const [summary, setSummary] = useState<ProviderSummary | null>(null)
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    setSessionExpired(false)
    try {
      const next = await getSummary()
      setSummary(next)
      setState('ready')
    } catch (err) {
      const apiErr = err instanceof ProviderApiError ? err : null
      if (apiErr && (apiErr.status === 403 || apiErr.status === 404)) {
        setState('no-operator')
        return
      }
      if (apiErr && apiErr.status === 401) {
        setSessionExpired(true)
      }
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load your provider overview. Please try again.',
      )
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (state === 'loading') {
    return (
      <>
        <ProviderPageHeading
          eyebrow="Provider workspace"
          title="Overview"
          description="Fleet readiness, booking decisions, and rentals that need attention."
        />
        <ProviderLoading label="Loading your provider summary…" />
      </>
    )
  }

  if (state === 'no-operator') {
    return (
      <>
        <ProviderPageHeading
          eyebrow="Provider workspace"
          title="Overview"
          description="Fleet readiness, booking decisions, and rentals that need attention."
        />
        <ProviderCard style={{ padding: 26 }}>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 900, letterSpacing: '-0.3px' }}>
            Your provider workspace is not active yet
          </h2>
          <p style={{ margin: '9px 0 0', fontSize: 14, lineHeight: 1.7, color: 'var(--text-3)', maxWidth: 720 }}>
            Approved car-hire owners and businesses manage their fleet here. Provider applications
            and vehicle approval happen in the Vero360 app. An approved operator profile does not
            automatically publish a vehicle, and this page never creates a second account.
          </p>
          <div style={{ display: 'grid', gap: 10, marginTop: 16, maxWidth: 720 }}>
            <ProviderNotice tone="info">
              Applying in the app? Open Vero360 → Car hire → Become a provider. Staff should ask
              the operator owner to invite their existing Vero360 email.
            </ProviderNotice>
            <ProviderNotice tone="warn">
              If you were recently approved, retry in a moment. Membership and approval changes are
              enforced by the backend on every request.
            </ProviderNotice>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            <button type="button" onClick={() => void load()} style={primaryButton}>
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
        </ProviderCard>
      </>
    )
  }

  if (state === 'error' || !summary) {
    return (
      <>
        <ProviderPageHeading
          eyebrow="Provider workspace"
          title="Overview"
          description="Fleet readiness, booking decisions, and rentals that need attention."
        />
        <ProviderError
          message={
            sessionExpired
              ? 'Your session expired or is no longer valid. Sign out and sign in again to continue.'
              : error || 'Could not load your provider overview.'
          }
          onRetry={() => void load()}
          action={
            sessionExpired ? (
              <button type="button" onClick={() => void signOutNow()} style={ghostButton}>
                Sign out
              </button>
            ) : (
              <Link href="/car-hire" style={ghostButton}>
                Browse public cars
              </Link>
            )
          }
        />
      </>
    )
  }

  const fleet = summary.fleet
  const bookings = summary.bookings
  const maintenanceAndUnavailable = Math.max(fleet.maintenanceBlocked, fleet.unavailableNow)

  return (
    <>
      <ProviderPageHeading
        eyebrow="Provider workspace"
        title="Overview"
        description="Actionable fleet and booking status for your operator workspace. Counts come from the backend; refresh for the latest state."
        actions={
          <button type="button" onClick={() => void load()} style={ghostButton}>
            Refresh
          </button>
        }
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
          Data as of{' '}
          <strong style={{ color: 'var(--text-2)' }}>
            {summary.asOf ? formatDateTime(summary.asOf) : 'a time not provided by the API'}
          </strong>
          . Time-sensitive availability is rechecked by the backend.
        </p>
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
          Currency: {summary.currency}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard
          label="Fleet total"
          value={fleet.total}
          hint={`${fleet.published} published · ${fleet.pendingReview} pending review · ${fleet.draft} draft`}
          href="/car-hire/manage/fleet"
        />
        <StatCard
          label="Pending decisions"
          value={bookings.pendingDecision}
          hint="Booking requests waiting for your response"
          href="/car-hire/manage/bookings"
          tone={bookings.pendingDecision > 0 ? 'warn' : 'default'}
        />
        <StatCard
          label="Upcoming rentals"
          value={bookings.upcoming}
          hint={`${bookings.active} active now · ${bookings.completedThisMonth} completed this month`}
          href="/car-hire/manage/calendar"
        />
        <StatCard
          label="Maintenance / unavailable"
          value={maintenanceAndUnavailable}
          hint={`${fleet.maintenanceBlocked} maintenance blocked · ${fleet.unavailableNow} unavailable now`}
          href="/car-hire/manage/fleet"
          tone={maintenanceAndUnavailable > 0 ? 'warn' : 'muted'}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        <ProviderCard>
          <h2 style={sectionTitle}>Fleet readiness</h2>
          <p style={sectionBody}>
            {fleet.total === 0
              ? 'No vehicles are linked to this operator yet. Add or publish vehicles in the Vero360 app, then refresh.'
              : `${fleet.published} of ${fleet.total} vehicles are published. Listing approval and vehicle documents remain separate from operator approval.`}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <Link href="/car-hire/manage/fleet" style={primaryButton}>
              Open fleet
            </Link>
            {fleet.suspended > 0 ? (
              <span style={{ fontSize: 12, color: '#B91C1C', fontWeight: 800, alignSelf: 'center' }}>
                {fleet.suspended} suspended
              </span>
            ) : null}
          </div>
        </ProviderCard>

        <ProviderCard>
          <h2 style={sectionTitle}>Booking decisions</h2>
          <p style={sectionBody}>
            {bookings.pendingDecision > 0
              ? `${bookings.pendingDecision} request${bookings.pendingDecision === 1 ? '' : 's'} need a confirm or reject decision. Respond before the hold expires so the renter is not left waiting.`
              : 'No booking requests are waiting for a decision right now.'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <Link href="/car-hire/manage/bookings" style={primaryButton}>
              Review bookings
            </Link>
          </div>
        </ProviderCard>

        <ProviderCard>
          <h2 style={sectionTitle}>Rental schedule</h2>
          <p style={sectionBody}>
            {bookings.upcoming + bookings.active > 0
              ? `${bookings.active} active rental${bookings.active === 1 ? '' : 's'} and ${bookings.upcoming} upcoming. Check pickup and return timing before handover.`
              : 'No active or upcoming rentals are recorded for this workspace.'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <Link href="/car-hire/manage/calendar" style={ghostButton}>
              Open calendar
            </Link>
          </div>
        </ProviderCard>
      </div>

      {summary.actions.length > 0 ? (
        <ProviderCard style={{ marginTop: 16 }}>
          <h2 style={sectionTitle}>Actions from the backend</h2>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {summary.actions.map(action => {
              const href = safeActionHref(action.href)
              const row = (
                <>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)' }}>
                    {action.label}
                  </span>
                  <span
                    style={{
                      minWidth: 26,
                      height: 26,
                      padding: '0 8px',
                      borderRadius: 999,
                      background: action.count > 0 ? '#FFF7ED' : 'var(--surface)',
                      border: `1px solid ${action.count > 0 ? '#FED7AA' : 'var(--border)'}`,
                      color: action.count > 0 ? '#9A3412' : 'var(--text-3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {action.count}
                  </span>
                </>
              )
              return href ? (
                <Link
                  key={action.code || action.label}
                  href={href}
                  style={actionRowStyle}
                >
                  {row}
                </Link>
              ) : (
                <div key={action.code || action.label} style={actionRowStyle}>
                  {row}
                </div>
              )
            })}
          </div>
        </ProviderCard>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <ProviderNotice tone="info">
          This workspace shows operational fleet and booking status only. Booking totals are not
          settled provider payouts, and no payout or revenue figure is inferred from these counts.
        </ProviderNotice>
      </div>
    </>
  )
}

function safeActionHref(href: string | null): string | null {
  if (!href) return null
  if (href.startsWith('/')) return href
  if (href.startsWith('car-hire/')) return `/${href}`
  return null
}

const sectionTitle = {
  margin: 0,
  fontSize: 17,
  fontWeight: 900,
  letterSpacing: '-0.2px',
} as const

const sectionBody = {
  margin: '7px 0 0',
  fontSize: 13,
  lineHeight: 1.65,
  color: 'var(--text-3)',
} as const

const actionRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: '#fff',
  textDecoration: 'none',
  color: 'inherit',
} as const
