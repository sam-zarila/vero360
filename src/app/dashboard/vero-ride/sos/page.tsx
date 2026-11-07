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
import { formatDateTime, type AdminSosIncident } from '@/lib/rides'

const SECTION = DASHBOARD_SECTION_MAP['vero-ride']

export default function VeroRideSosPage() {
  const [items, setItems] = useState<AdminSosIncident[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/rides/sos?take=100', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load SOS incidents')
      setItems(Array.isArray(data.items) ? data.items : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SOS incidents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="vero-ride"
        title="SOS queue"
        description="Recent emergency SOS reports from active Vero Ride trips. Open a trip to coordinate follow-up."
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Link
              href="/dashboard/vero-ride/live"
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
              Live
            </Link>
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
        {loading ? 'Loading…' : `${total} incident${total === 1 ? '' : 's'}`}
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
          <p style={{ color: 'var(--text-3)' }}>Loading SOS incidents…</p>
        ) : items.length === 0 ? (
          <DashboardEmptyState
            icon={SECTION.icon}
            color={SECTION.color}
            title="No SOS incidents"
            hint="When a passenger or driver triggers SOS, incidents appear here."
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-3)' }}>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Incident</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Trip</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>User</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Message</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Created</th>
                <th style={{ padding: '8px 10px', fontWeight: 700 }} />
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px', fontWeight: 700 }}>#{item.id}</td>
                  <td style={{ padding: '10px', fontWeight: 700 }}>
                    <Link
                      href={`/dashboard/vero-ride/trips/${item.rideId}`}
                      style={{ color: 'var(--primary-dark)', textDecoration: 'none' }}
                    >
                      #{item.rideId}
                    </Link>
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-2)' }}>#{item.userId}</td>
                  <td style={{ padding: '10px', color: 'var(--text-2)', maxWidth: 320 }}>
                    {item.message || '—'}
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-3)' }}>
                    {formatDateTime(item.createdAt) || '—'}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <Link
                      href={`/dashboard/vero-ride/trips/${item.rideId}`}
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--primary-dark)',
                        textDecoration: 'none',
                      }}
                    >
                      Open trip
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
