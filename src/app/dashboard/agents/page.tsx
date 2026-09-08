'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/panel-client-auth'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../PanelSessionProvider'
import { AgentSubNav } from '../agent/AgentSubNav'
import { adminStatusTone, formatDateTime } from '@/lib/admins'

type AgentRow = {
  id: string
  email: string
  displayName: string
  status: 'active' | 'suspended'
  createdAt: string | null
  registrationCount: number
}

export default function AdminAgentsPage() {
  const router = useRouter()
  const { isFullAdmin, isAgent, loading: sessionLoading } = usePanelSession()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [totalRegistrations, setTotalRegistrations] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (sessionLoading) return
    if (isAgent) router.replace('/dashboard/agent')
  }, [sessionLoading, isAgent, router])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/agents', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load agents')
      setAgents(data.agents || [])
      setTotalRegistrations(data.totalRegistrations || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionLoading || isAgent || !isFullAdmin) return
    void load()
  }, [load, sessionLoading, isAgent, isFullAdmin])

  if (sessionLoading || isAgent) {
    return <div style={{ padding: 24, fontWeight: 600, color: 'var(--text-3)' }}>Loading…</div>
  }

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="agents"
        title="Agents"
        description="Field agents who onboard customers, merchants, and drivers. Create agents under Admins."
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
        <Metric label="Agents" value={String(agents.length)} />
        <Metric label="Registrations" value={String(totalRegistrations)} />
        <Metric
          label="Active"
          value={String(agents.filter(a => a.status === 'active').length)}
        />
      </div>

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
        <p style={{ fontWeight: 600, color: 'var(--text-3)' }}>Loading agents…</p>
      ) : agents.length === 0 ? (
        <DashboardEmptyState
          icon="briefcase"
          color="#047857"
          title="No agents yet"
          hint="Create an agent account from Admins → role Agent."
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {agents.map(agent => {
            const tone = adminStatusTone(agent.status)
            return (
              <article key={agent.id} style={card}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{agent.displayName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                      {agent.email}
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
                    {tone.label}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 16,
                    marginTop: 12,
                    fontSize: 13,
                    color: 'var(--text-2)',
                  }}
                >
                  <span>
                    <strong>{agent.registrationCount}</strong> registrations
                  </span>
                  <span>Joined {formatDateTime(agent.createdAt) || '—'}</span>
                </div>
                <Link
                  href={`/dashboard/agents/registrations?agentUid=${encodeURIComponent(agent.id)}`}
                  style={{
                    display: 'inline-block',
                    marginTop: 12,
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#047857',
                  }}
                >
                  View registrations →
                </Link>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  )
}

const card: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
}
