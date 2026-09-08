'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/panel-client-auth'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import type { AgentRegistrationCounts } from '@/lib/agent-registrations'
import {
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../PanelSessionProvider'
import { AgentSubNav } from './AgentSubNav'

const SECTION = DASHBOARD_SECTION_MAP.agents

const emptyCounts: AgentRegistrationCounts = {
  all: 0,
  customer: 0,
  merchant: 0,
  driver: 0,
  verified: 0,
  unverified: 0,
}

export default function AgentPortalHome() {
  const router = useRouter()
  const { me, isAgent, isFullAdmin, loading: sessionLoading } = usePanelSession()
  const [counts, setCounts] = useState(emptyCounts)
  const [driversPending, setDriversPending] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionLoading) return
    if (isFullAdmin && !isAgent) router.replace('/dashboard/agents')
  }, [sessionLoading, isFullAdmin, isAgent, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [regsRes, driversRes] = await Promise.all([
        adminFetch('/api/admin/agent-registrations', { cache: 'no-store' }),
        adminFetch('/api/admin/drivers', { cache: 'no-store' }),
      ])
      const regs = await regsRes.json()
      const drivers = await driversRes.json()
      if (regsRes.ok) setCounts(regs.counts || emptyCounts)
      if (driversRes.ok) setDriversPending(drivers.counts?.pending || 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAgent) return
    void load()
  }, [load, isAgent])

  if (sessionLoading || (isFullAdmin && !isAgent)) {
    return <div style={{ padding: 24, fontWeight: 600, color: 'var(--text-3)' }}>Loading…</div>
  }

  const cards = [
    {
      href: '/dashboard/agent/onboard',
      title: 'Onboard user',
      desc: 'Register a customer, merchant, or driver with email, phone, and location.',
    },
    {
      href: '/dashboard/agent/registrations',
      title: 'My registrations',
      desc: `${counts.all} people you’ve registered · ${counts.verified} verified`,
    },
    {
      href: '/dashboard/agent/drivers',
      title: 'Verify drivers',
      desc:
        driversPending > 0
          ? `${driversPending} drivers waiting for verification`
          : 'Review Vero Ride driver applications',
    },
  ]

  return (
    <div>
      <DashboardPageHeader
        sectionId="agents"
        title="Agent portal"
        description={
          isAgent
            ? `Welcome${me?.displayName ? `, ${me.displayName}` : ''}. Onboard users and verify ride drivers.`
            : 'Agent workspace overview.'
        }
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

      <AgentSubNav />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Metric label="Registered" value={String(counts.all)} />
        <Metric label="Customers" value={String(counts.customer)} />
        <Metric label="Merchants" value={String(counts.merchant)} />
        <Metric label="Drivers" value={String(counts.driver)} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {cards.map(card => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              display: 'block',
              padding: 20,
              borderRadius: 16,
              border: '1px solid var(--border)',
              background: SECTION.bg,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: SECTION.color }}>{card.title}</div>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.45 }}>
              {card.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  )
}
