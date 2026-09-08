'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
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
import { AgentSubNav } from '../AgentSubNav'

const emptyCounts: AgentRegistrationCounts = {
  all: 0,
  customer: 0,
  merchant: 0,
  driver: 0,
  verified: 0,
  unverified: 0,
}

export default function AgentMyRegistrationsPage() {
  const { isAgent } = usePanelSession()
  const [items, setItems] = useState<AgentRegistration[]>([])
  const [counts, setCounts] = useState(emptyCounts)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'merchant' | 'driver'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/agent-registrations', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setItems(data.items || [])
      setCounts(data.counts || emptyCounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return items.filter(item => {
      if (roleFilter !== 'all' && item.role !== roleFilter) return false
      if (!query) return true
      return (
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.phone.toLowerCase().includes(query)
      )
    })
  }, [items, q, roleFilter])

  async function toggleVerified(item: AgentRegistration) {
    const res = await adminFetch(`/api/admin/agent-registrations/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVerified: !item.isVerified }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Update failed')
      return
    }
    await load()
  }

  return (
    <div>
      {!isAgent ? <DashboardBackLink label="Back to dashboard" /> : null}

      <DashboardPageHeader
        sectionId="agents"
        title="My registrations"
        description="People you onboarded — email, phone, registered date, verification, and location."
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

      <AgentSubNav />

      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#FEF2F2',
            color: '#991B1B',
            fontWeight: 500,
          }}
        >
          {error}
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
        <Metric label="Verified" value={String(counts.verified)} />
        <Metric label="Unverified" value={String(counts.unverified)} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {(['all', 'customer', 'merchant', 'driver'] as const).map(id => (
          <button
            key={id}
            type="button"
            onClick={() => setRoleFilter(id)}
            style={{
              padding: '7px 12px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 12,
              border: roleFilter === id ? '1px solid #6EE7B7' : '1px solid var(--border)',
              background: roleFilter === id ? '#ECFDF5' : '#fff',
              color: roleFilter === id ? '#047857' : 'var(--text-2)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {id}
          </button>
        ))}
        <div style={{ flex: 1, minWidth: 180 }}>
          <DashboardSearchField value={q} onChange={setQ} placeholder="Search name, email, phone" />
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-3)', fontWeight: 600 }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <DashboardEmptyState
          icon="users"
          color="#047857"
          title="No registrations yet"
          hint="Onboard a customer, merchant, or driver to see them here."
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(item => (
            <article key={item.id} style={card}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    {item.email || '—'} · {item.phone || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Pill>{item.role}</Pill>
                  <Pill tone={item.isVerified ? 'good' : 'warn'}>
                    {item.isVerified ? 'Verified' : 'Unverified'}
                  </Pill>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 8,
                  marginTop: 12,
                  fontSize: 12,
                  color: 'var(--text-2)',
                }}
              >
                <div>
                  <strong>Registered</strong>
                  <div>{formatAgentRegisteredDate(item.registeredAt)}</div>
                </div>
                <div>
                  <strong>Location</strong>
                  <div>{formatAgentGeo(item.geo)}</div>
                </div>
                {item.businessName ? (
                  <div>
                    <strong>Business</strong>
                    <div>
                      {item.businessName}
                      {item.merchantService ? ` · ${item.merchantService}` : ''}
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void toggleVerified(item)}
                style={{ ...btnGhost, marginTop: 12 }}
              >
                Mark {item.isVerified ? 'unverified' : 'verified'}
              </button>
            </article>
          ))}
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

function Pill({
  children,
  tone,
}: {
  children: ReactNode
  tone?: 'good' | 'warn'
}) {
  const bg = tone === 'good' ? '#ECFDF5' : tone === 'warn' ? '#FFFBEB' : '#F1F5F9'
  const color = tone === 'good' ? '#047857' : tone === 'warn' ? '#B45309' : '#475569'
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        background: bg,
        color,
        textTransform: 'capitalize',
      }}
    >
      {children}
    </span>
  )
}

const card: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
}

const btnGhost: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
}
