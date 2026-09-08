'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  driverStatusLabel,
  driverStatusTone,
  type DriverStatus,
  type FleetDriver,
} from '@/lib/drivers'
import { adminFetch, panelAuthHeaders } from '@/lib/panel-client-auth'
import {
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
} from '@/app/dashboard/DashboardChrome'
import { AgentSubNav } from '../AgentSubNav'

type Tab = 'all' | DriverStatus | 'VEHICLE_PENDING'

type Counts = {
  all: number
  pending: number
  verified: number
  rejected: number
  suspended: number
  pendingVehicles: number
}

const EMPTY: Counts = {
  all: 0,
  pending: 0,
  verified: 0,
  rejected: 0,
  suspended: 0,
  pendingVehicles: 0,
}

export default function AgentDriversPage() {
  const [items, setItems] = useState<FleetDriver[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY)
  const [tab, setTab] = useState<Tab>('PENDING_VERIFICATION')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = await panelAuthHeaders()
      const res = await adminFetch('/api/admin/drivers', { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load drivers')
      setItems(data.drivers || [])
      setCounts(data.counts || EMPTY)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drivers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items
    if (tab === 'VEHICLE_PENDING') {
      list = items.filter(d => d.taxis.some(t => t.status === 'PENDING_REVIEW'))
    } else if (tab !== 'all') {
      list = items.filter(d => d.status === tab)
    }
    if (!q) return list
    return list.filter(d =>
      `${d.name} ${d.email} ${d.phone} ${d.id}`.toLowerCase().includes(q),
    )
  }, [items, tab, query])

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'PENDING_VERIFICATION', label: 'Pending', count: counts.pending },
    { id: 'VEHICLE_PENDING', label: 'Vehicle review', count: counts.pendingVehicles },
    { id: 'VERIFIED', label: 'Verified', count: counts.verified },
    { id: 'REJECTED', label: 'Rejected', count: counts.rejected },
    { id: 'all', label: 'All', count: counts.all },
  ]

  return (
    <div>
      <DashboardPageHeader
        sectionId="agents"
        title="Verify drivers"
        description="Review Vero Ride driver applications and approve documents."
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

      <AgentSubNav />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {tabs.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                border: `1px solid ${active ? '#047857' : 'var(--border)'}`,
                background: active ? '#ECFDF5' : 'var(--surface)',
                color: active ? '#047857' : 'var(--text)',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {t.label} ({t.count})
            </button>
          )
        })}
      </div>

      <DashboardSearchField
        value={query}
        onChange={setQuery}
        placeholder="Search name, email, phone…"
        label="Search drivers"
        onClear={() => setQuery('')}
      />

      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#FEF2F2',
            color: '#B91C1C',
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: 'var(--text-3)', fontWeight: 600 }}>Loading drivers…</p>
      ) : filtered.length === 0 ? (
        <DashboardEmptyState
          icon="car"
          color="#047857"
          title="No drivers in this view"
          hint="Pending applications will show up here for verification."
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(driver => {
            const tone = driverStatusTone(driver.status)
            return (
              <Link
                key={driver.id}
                href={`/dashboard/agent/drivers/${driver.id}`}
                style={{
                  display: 'block',
                  padding: 14,
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{driver.name || 'Driver'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                      {driver.email || '—'} · {driver.phone || '—'}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      background: tone.bg,
                      color: tone.color,
                    }}
                  >
                    {driverStatusLabel(driver.status)}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
