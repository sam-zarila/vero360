'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { adminFetch } from '@/lib/panel-client-auth'
import {
  formatAgentGeo,
  formatAgentRegisteredDate,
  type AgentRegistration,
  type AgentRegistrationCounts,
} from '@/lib/agent-registrations'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
  DashboardSearchField,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../../PanelSessionProvider'
import { AgentSubNav } from '../../agent/AgentSubNav'

const emptyCounts: AgentRegistrationCounts = {
  all: 0,
  customer: 0,
  merchant: 0,
  driver: 0,
  verified: 0,
  unverified: 0,
}

export default function AdminAgentRegistrationsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentUid = searchParams.get('agentUid') || ''
  const { isFullAdmin, isAgent, loading: sessionLoading } = usePanelSession()

  const [items, setItems] = useState<AgentRegistration[]>([])
  const [counts, setCounts] = useState(emptyCounts)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (sessionLoading) return
    if (isAgent) router.replace('/dashboard/agent/registrations')
  }, [sessionLoading, isAgent, router])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = agentUid ? `?agentUid=${encodeURIComponent(agentUid)}` : ''
      const res = await adminFetch(`/api/admin/agent-registrations${qs}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setItems(data.items || [])
      setCounts(data.counts || emptyCounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [agentUid])

  useEffect(() => {
    if (sessionLoading || isAgent || !isFullAdmin) return
    void load()
  }, [load, sessionLoading, isAgent, isFullAdmin])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return items
    return items.filter(
      item =>
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.phone.toLowerCase().includes(query) ||
        item.agentName.toLowerCase().includes(query) ||
        item.agentEmail.toLowerCase().includes(query),
    )
  }, [items, q])

  if (sessionLoading || isAgent) {
    return <div style={{ padding: 24, fontWeight: 600, color: 'var(--text-3)' }}>Loading…</div>
  }

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="agents"
        title="Agent registrations"
        description="All users onboarded by agents — email, phone, registered date, verified status, and geo."
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

      <AgentSubNav />

      {agentUid ? (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 12,
            background: '#ECFDF5',
            color: '#047857',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Filtered to one agent.{' '}
          <button
            type="button"
            onClick={() => router.push('/dashboard/agents/registrations')}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#047857',
              fontWeight: 800,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Show all
          </button>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Metric label="All" value={String(counts.all)} />
        <Metric label="Customers" value={String(counts.customer)} />
        <Metric label="Merchants" value={String(counts.merchant)} />
        <Metric label="Drivers" value={String(counts.driver)} />
        <Metric label="Verified" value={String(counts.verified)} />
      </div>

      <DashboardSearchField
        value={q}
        onChange={setQ}
        placeholder="Search user or agent…"
        label="Search"
        onClear={() => setQ('')}
      />

      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            background: '#FEF2F2',
            color: '#991B1B',
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p style={{ fontWeight: 600, color: 'var(--text-3)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <DashboardEmptyState
          icon="users"
          color="#047857"
          title="No agent registrations"
          hint="When agents onboard users, they appear here."
        />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#ECFDF5', textAlign: 'left' }}>
                {[
                  'Name',
                  'Email',
                  'Phone',
                  'Role',
                  'Registered',
                  'Verified',
                  'Location',
                  'Agent',
                ].map(h => (
                  <th key={h} style={{ padding: '12px 14px', fontWeight: 800 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{item.name}</td>
                  <td style={td}>{item.email || '—'}</td>
                  <td style={td}>{item.phone || '—'}</td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{item.role}</td>
                  <td style={td}>{formatAgentRegisteredDate(item.registeredAt)}</td>
                  <td style={td}>{item.isVerified ? 'Yes' : 'No'}</td>
                  <td style={td}>{formatAgentGeo(item.geo)}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{item.agentName || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.agentEmail}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800 }}>{value}</div>
    </div>
  )
}

const card: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
}

const td: CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'top',
}
