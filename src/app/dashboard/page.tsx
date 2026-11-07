'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { IconBadge } from '@/app/components/landing/icons'
import { adminFetch } from '@/lib/panel-client-auth'
import DashboardCards from './DashboardCards'
import { MARKETER_HOME, usePanelSession } from './PanelSessionProvider'

type GrowthStrip = {
  mau: number | null
  newUsers7d: number | null
  sessions: number | null
  installs: number | null
}

function fmt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-MW')
}

export default function DashboardPage() {
  const router = useRouter()
  const { isMarketer, isAgent, loading } = usePanelSession()
  const [strip, setStrip] = useState<GrowthStrip | null>(null)

  useEffect(() => {
    if (!loading && isMarketer) router.replace(MARKETER_HOME)
  }, [loading, isMarketer, router])

  useEffect(() => {
    if (loading || isMarketer || isAgent) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await adminFetch('/api/admin/analytics/growth?days=28', {
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || cancelled) return
        setStrip({
          mau: typeof data.mau === 'number' ? data.mau : null,
          newUsers7d:
            typeof data.newSignups7d === 'number'
              ? data.newSignups7d
              : typeof data.users?.newLast7Days === 'number'
                ? data.users.newLast7Days
                : null,
          sessions: typeof data.websiteSessions === 'number' ? data.websiteSessions : null,
          installs: typeof data.installs === 'number' ? data.installs : null,
        })
      } catch {
        /* strip is optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loading, isMarketer, isAgent])

  if (!loading && isMarketer) {
    return (
      <p style={{ color: 'var(--text-3)', fontWeight: 600 }}>Opening Growth analytics…</p>
    )
  }

  if (!loading && isAgent) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 28 }}>
          <IconBadge name="briefcase" size={28} bg="#EFF6FF" color="#2563EB" />
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(26px, 3vw, 34px)',
                fontWeight: 900,
                letterSpacing: '-0.5px',
                fontFamily: 'var(--font-display)',
              }}
            >
              Agent home
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text-3)', maxWidth: 560, margin: '8px 0 0' }}>
              Open the agent portal to onboard users and verify drivers.
            </p>
          </div>
        </div>
        <DashboardCards />
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
          marginBottom: 22,
        }}
      >
        <IconBadge name="grid" size={28} bg="#EFF6FF" color="#2563EB" />
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(26px, 3vw, 34px)',
              fontWeight: 900,
              letterSpacing: '-0.5px',
              fontFamily: 'var(--font-display)',
            }}
          >
            Dashboard
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-3)', maxWidth: 560, margin: '8px 0 0' }}>
            Growth first, then operations. Use the sidebar groups to open any service.
          </p>
        </div>
      </div>

      <Link
        href="/dashboard/analytics"
        style={{
          display: 'block',
          textDecoration: 'none',
          color: 'inherit',
          marginBottom: 28,
          padding: 18,
          borderRadius: 16,
          border: '1px solid #BAE6FD',
          background: 'linear-gradient(135deg, #F0F9FF 0%, #fff 55%)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#0369A1',
              }}
            >
              Growth
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 800 }}>
              Visits, installs, MAU, and campaigns
            </p>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0369A1' }}>Open analytics →</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 10,
          }}
        >
          {[
            { label: 'MAU', value: fmt(strip?.mau) },
            { label: 'New users (7d)', value: fmt(strip?.newUsers7d) },
            { label: 'Site sessions', value: fmt(strip?.sessions) },
            { label: 'Installs', value: fmt(strip?.installs) },
          ].map(metric => (
            <div
              key={metric.label}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: '#fff',
                border: '1px solid #E0F2FE',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{metric.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, fontFamily: 'var(--font-display)' }}>
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      </Link>

      <h2
        style={{
          margin: '0 0 14px',
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--text-2)',
          letterSpacing: '0.02em',
        }}
      >
        Operations
      </h2>
      <DashboardCards />
    </div>
  )
}
