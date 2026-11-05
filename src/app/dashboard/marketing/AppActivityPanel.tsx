'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import { DashboardRefreshButton } from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../PanelSessionProvider'

type UserBreakdown = {
  total: number
  customers: number
  merchants: number
  drivers: number
  other: number
  newLast7Days: number
  newLast30Days: number
}

type ServiceRow = {
  id: string
  name: string
  plain: string
  activity: number
  completed: number
  pending: number
  moneyMwk: number
  health: 'strong' | 'steady' | 'quiet'
  detail: string
}

type Overview = {
  users: UserBreakdown
  services: ServiceRow[]
  rankingNote: string
  activityNote: string
  financeNote: string
  platformBalanceMwk: number | null
  fetchedAt: string
}

type SortKey = 'activity' | 'completed' | 'pending'
type RoleKey = 'customers' | 'merchants' | 'drivers' | 'other'

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 16,
  boxShadow: 'var(--shadow-sm)',
}

const ROLE_COLOR: Record<RoleKey, string> = {
  customers: '#2563EB',
  merchants: '#EA580C',
  drivers: '#059669',
  other: '#94A3B8',
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-MW')
}

function healthLabel(health: ServiceRow['health']): { text: string; color: string } {
  if (health === 'strong') return { text: 'High', color: '#047857' }
  if (health === 'steady') return { text: 'Steady', color: '#B45309' }
  return { text: 'Low', color: '#6B7280' }
}

function barColor(health: ServiceRow['health']): string {
  if (health === 'strong') return '#059669'
  if (health === 'steady') return '#D97706'
  return '#94A3B8'
}

export default function AppActivityPanel() {
  const { isMarketer, isSuperAdmin } = usePanelSession()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<SortKey>('activity')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [roleFocus, setRoleFocus] = useState<RoleKey | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/analytics/app-overview', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load app activity')
      setOverview(data.overview as Overview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load app activity')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const services = useMemo(() => {
    if (!overview) return []
    return [...overview.services].sort((a, b) => b[sort] - a[sort] || b.activity - a.activity)
  }, [overview, sort])

  const selected = services.find(service => service.id === selectedId) || services[0] || null
  const maxSort = Math.max(1, ...services.map(service => service[sort]))
  const users = overview?.users
  const roleTotal = users ? Math.max(1, users.customers + users.merchants + users.drivers + users.other) : 1

  const roles: { key: RoleKey; label: string; value: number }[] = users
    ? [
        { key: 'customers', label: 'Customers', value: users.customers },
        { key: 'merchants', label: 'Merchants', value: users.merchants },
        { key: 'drivers', label: 'Drivers', value: users.drivers },
        ...(users.other > 0 ? [{ key: 'other' as const, label: 'Other', value: users.other }] : []),
      ]
    : []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
          {overview ? `Updated ${new Date(overview.fetchedAt).toLocaleString()}` : 'App accounts and services'}
        </p>
        <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
      </div>

      {loading && !overview ? (
        <div style={{ ...card, color: 'var(--text-3)' }}>Loading app performance…</div>
      ) : null}

      {error ? (
        <div style={{ ...card, marginBottom: 16, borderColor: '#FECACA', background: '#FEF2F2', color: '#991B1B' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Could not load app activity.</p>
          <p style={{ margin: '8px 0 0', fontSize: 14 }}>{error}</p>
        </div>
      ) : null}

      {users ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              { label: 'Accounts', value: fmt(users.total), accent: '#0F172A' },
              { label: 'New · 7 days', value: fmt(users.newLast7Days), accent: '#2563EB' },
              { label: 'New · 30 days', value: fmt(users.newLast30Days), accent: '#7C3AED' },
              ...(!isMarketer
                ? [{
                    label: 'Paid volume',
                    value: `MWK ${fmt(overview?.services.reduce((sum, service) => sum + service.moneyMwk, 0) || 0)}`,
                    accent: '#0F766E',
                  }]
                : []),
            ].map(item => (
              <div key={item.label} style={{ ...card, borderTop: `3px solid ${item.accent}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-3)' }}>
                  {item.label}
                </div>
                <div style={{ marginTop: 8, fontSize: item.label === 'Paid volume' ? 22 : 30, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>
                  {item.value}
                </div>
              </div>
            ))}
            {!isMarketer && isSuperAdmin && overview?.platformBalanceMwk != null ? (
              <div style={{ ...card, borderTop: '3px solid #0F766E' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-3)' }}>
                  Platform wallet
                </div>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.4px' }}>
                  MWK {fmt(overview.platformBalanceMwk)}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Account mix</h3>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {roleFocus ? roles.find(role => role.key === roleFocus)?.label : 'All roles'}
              </span>
            </div>
            <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', background: '#F1F5F9' }}>
              {roles.map(role => (
                <button
                  key={role.key}
                  type="button"
                  aria-label={`${role.label}: ${fmt(role.value)}`}
                  aria-pressed={roleFocus === role.key}
                  onClick={() => setRoleFocus(current => (current === role.key ? null : role.key))}
                  style={{
                    width: `${(role.value / roleTotal) * 100}%`,
                    minWidth: role.value > 0 ? 8 : 0,
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                    background: ROLE_COLOR[role.key],
                    opacity: roleFocus && roleFocus !== role.key ? 0.35 : 1,
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {roles.map(role => {
                const active = roleFocus === role.key
                const share = Math.round((role.value / roleTotal) * 100)
                return (
                  <button
                    key={role.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setRoleFocus(current => (current === role.key ? null : role.key))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      border: active ? `1px solid ${ROLE_COLOR[role.key]}` : '1px solid var(--border)',
                      background: active ? '#F8FAFC' : '#fff',
                      borderRadius: 999,
                      padding: '6px 10px',
                      font: 'inherit',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: ROLE_COLOR[role.key] }} />
                    {role.label}
                    <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>{fmt(role.value)} · {share}%</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) minmax(240px, 0.8fr)',
              gap: 12,
            }}
            className="perf-service-grid"
          >
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Services</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(
                    [
                      { id: 'activity', label: 'Activity' },
                      { id: 'completed', label: 'Done' },
                      { id: 'pending', label: 'Open' },
                    ] as const
                  ).map(option => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={sort === option.id}
                      onClick={() => setSort(option.id)}
                      style={{
                        border: sort === option.id ? '1px solid #0F172A' : '1px solid var(--border)',
                        background: sort === option.id ? '#0F172A' : '#fff',
                        color: sort === option.id ? '#fff' : 'var(--text-2)',
                        borderRadius: 999,
                        padding: '5px 10px',
                        font: 'inherit',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {services.map(service => {
                  const active = selected?.id === service.id
                  const width = Math.max(2, (service[sort] / maxSort) * 100)
                  return (
                    <button
                      key={service.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedId(service.id)}
                      style={{
                        textAlign: 'left',
                        border: active ? '1px solid #0F172A' : '1px solid transparent',
                        background: active ? '#F8FAFC' : 'transparent',
                        borderRadius: 12,
                        padding: '8px 10px',
                        font: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{service.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{fmt(service[sort])}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
                        <div style={{ width: `${width}%`, height: '100%', borderRadius: 99, background: barColor(service.health) }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {selected ? (
              <ServiceDetail service={selected} showMoney={!isMarketer} />
            ) : null}
          </div>
          <style>{`
            @media (max-width: 800px) {
              .perf-service-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </>
      ) : null}
    </div>
  )
}

function ServiceDetail({ service, showMoney }: { service: ServiceRow; showMoney: boolean }) {
  const badge = healthLabel(service.health)
  const doneShare = service.activity > 0 ? Math.round((service.completed / service.activity) * 100) : 0
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{service.plain}</div>
          <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800 }}>{service.name}</h3>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: badge.color }}>{badge.text}</span>
      </div>
      <div style={{ marginTop: 16, fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.6px' }}>
        {fmt(service.activity)}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>Activity</div>
      <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ width: `${doneShare}%`, height: '100%', background: '#059669' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Stat label="Done" value={fmt(service.completed)} note={`${doneShare}%`} />
        <Stat label="Open" value={fmt(service.pending)} />
      </div>
      {showMoney && service.moneyMwk > 0 ? (
        <p style={{ margin: '14px 0 0', fontSize: 14, fontWeight: 800, color: '#0F766E' }}>
          Paid MWK {fmt(service.moneyMwk)}
        </p>
      ) : null}
      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>{service.detail}</p>
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800 }}>
        {value}
        {note ? <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{note}</span> : null}
      </div>
    </div>
  )
}
