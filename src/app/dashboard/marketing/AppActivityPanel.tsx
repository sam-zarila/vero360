'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
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

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 18,
  boxShadow: 'var(--shadow-sm)',
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-MW')
}

function healthLabel(health: ServiceRow['health']): { text: string; color: string; bg: string } {
  if (health === 'strong') return { text: 'High', color: '#047857', bg: '#ECFDF5' }
  if (health === 'steady') return { text: 'Steady', color: '#B45309', bg: '#FFFBEB' }
  return { text: 'Low', color: '#6B7280', bg: '#F3F4F6' }
}

export default function AppActivityPanel() {
  const { isMarketer, isSuperAdmin } = usePanelSession()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <div style={{ marginTop: 28 }}>
      <div
        style={{
          ...card,
          marginBottom: 16,
          background: 'linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 70%)',
          borderColor: '#BFDBFE',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: '#1D4ED8',
              }}
            >
              App
            </p>
            <h2
              style={{
                margin: '6px 0 8px',
                fontSize: 22,
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.3px',
              }}
            >
              App performance
            </h2>
            <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 15, lineHeight: 1.6 }}>
              Accounts by role and recent activity for Vero Ride, Vero Bike, Courier, Food, Marketplace, Stays, and Digital Services.
            </p>
          </div>
          <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
        </div>
      </div>

      {loading && !overview ? (
        <div style={{ ...card, color: 'var(--text-3)' }}>Loading app users and service activity…</div>
      ) : null}

      {error ? (
        <div
          style={{
            ...card,
            marginBottom: 16,
            borderColor: '#FECACA',
            background: '#FEF2F2',
            color: '#991B1B',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>Could not load app activity.</p>
          <p style={{ margin: '8px 0 0', fontSize: 14 }}>{error}</p>
        </div>
      ) : null}

      {overview ? (
        <>
          <div style={{ ...card, marginBottom: 16, background: '#F8FAFC' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800 }}>Summary</h3>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--text-2)' }}>
              {overview.activityNote}
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.65, color: 'var(--text-2)' }}>
              {overview.rankingNote}
            </p>
            {!isMarketer && overview.financeNote ? (
              <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.65, color: 'var(--text-2)' }}>
                {overview.financeNote}
              </p>
            ) : null}
            {!isMarketer && isSuperAdmin && overview.platformBalanceMwk != null ? (
              <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--text-3)' }}>
                Platform wallet: MWK {fmt(overview.platformBalanceMwk)}
              </p>
            ) : null}
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
              Updated {new Date(overview.fetchedAt).toLocaleString()}
            </p>
          </div>

          <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800 }}>Accounts</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
              marginBottom: 18,
            }}
          >
            {[
              { label: 'Total', value: overview.users.total },
              { label: 'Customers', value: overview.users.customers },
              { label: 'Merchants', value: overview.users.merchants },
              { label: 'Drivers', value: overview.users.drivers },
              { label: 'New (7 days)', value: overview.users.newLast7Days },
              { label: 'New (30 days)', value: overview.users.newLast30Days },
            ].map(item => (
              <div key={item.label} style={card}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>
                  {item.label}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 28,
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.4px',
                  }}
                >
                  {fmt(item.value)}
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>
            Services
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {overview.services.map((service, index) => {
              const badge = healthLabel(service.health)
              return (
                <div key={service.id} style={card}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>
                        #{index + 1}
                      </div>
                      <h4 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 800 }}>
                        {service.name}
                      </h4>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '4px 8px',
                        borderRadius: 999,
                        background: badge.bg,
                        color: badge.color,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {badge.text}
                    </span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    {service.plain}
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                      marginTop: 14,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Activity</div>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>{fmt(service.activity)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Done</div>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>{fmt(service.completed)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Open</div>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>{fmt(service.pending)}</div>
                    </div>
                  </div>
                  {!isMarketer && service.moneyMwk > 0 ? (
                    <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 700, color: '#0F766E' }}>
                      Paid: MWK {fmt(service.moneyMwk)}
                    </p>
                  ) : null}
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>
                    {service.detail}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
