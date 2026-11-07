'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import {
  formatDateTime,
  formatTaxiCoords,
  rideStatusLabel,
  rideStatusTone,
  type AdminRide,
} from '@/lib/rides'

const SECTION = DASHBOARD_SECTION_MAP['vero-ride']
const POLL_MS = 10_000

export default function VeroRideLivePage() {
  const [items, setItems] = useState<AdminRide[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/rides?status=ACTIVE&take=200', {
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load active rides')
      setItems(data.items || [])
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load active rides')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="vero-ride"
        title="Live trips"
        description="Active rides with last-known driver coordinates from taxi location updates. Refreshes every 10s. (No map library in this panel — table view only.)"
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Link
              href="/dashboard/vero-ride/trips"
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: '#fff',
                color: 'var(--text-2)',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              All trips
            </Link>
            <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
          </div>
        }
      />

      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-3)' }}>
        {updatedAt
          ? `Last refresh ${formatDateTime(updatedAt.toISOString())} · ${items.length} active`
          : 'Waiting for first refresh…'}
      </p>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#FEF2F2',
            color: '#991B1B',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 18,
          boxShadow: 'var(--shadow-sm)',
          overflowX: 'auto',
        }}
      >
        {loading && items.length === 0 ? (
          <p style={{ color: 'var(--text-3)' }}>Loading active rides…</p>
        ) : items.length === 0 ? (
          <DashboardEmptyState
            icon={SECTION.icon}
            color={SECTION.color}
            title="No active rides"
            hint="Requested, accepted, arrived, and in-progress trips appear here."
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-3)' }}>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Trip</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Passenger</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Driver</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Last coords</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Loc. updated</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }} />
              </tr>
            </thead>
            <tbody>
              {items.map(ride => {
                const tone = rideStatusTone(ride.status)
                return (
                  <tr key={ride.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px', fontWeight: 700 }}>#{ride.id}</td>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: tone.bg,
                          color: tone.color,
                          border: `1px solid ${tone.border}`,
                        }}
                      >
                        {rideStatusLabel(ride.status)}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-2)' }}>
                      {ride.passengerName || ride.passengerPhone || `#${ride.passengerId}`}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-2)' }}>
                      {ride.driverName ||
                        ride.driverPhone ||
                        (ride.taxiPlate ? `Plate ${ride.taxiPlate}` : 'Unassigned')}
                      {ride.taxiId != null ? (
                        <span style={{ color: 'var(--text-3)' }}> · taxi #{ride.taxiId}</span>
                      ) : null}
                    </td>
                    <td
                      style={{
                        padding: '10px',
                        fontFamily: 'ui-monospace, monospace',
                        color: 'var(--text-2)',
                      }}
                    >
                      {formatTaxiCoords(ride)}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text-3)' }}>
                      {formatDateTime(ride.taxiLocationUpdatedAt) || '—'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <Link
                        href={`/dashboard/vero-ride/trips/${ride.id}`}
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--primary-dark)',
                          textDecoration: 'none',
                        }}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
