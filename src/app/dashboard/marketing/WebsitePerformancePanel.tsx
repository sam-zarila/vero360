'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import { DashboardRefreshButton } from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../PanelSessionProvider'

type GaMetric = { key: string; label: string; value: string; raw: number }
type GaRow = { label: string; value: string; raw: number }
type Overview = {
  propertyId: string
  measurementId: string
  consoleUrl: string
  rangeLabel: string
  metrics: GaMetric[]
  topPages: GaRow[]
  topCountries: GaRow[]
  fetchedAt: string
}

const card: CSSProperties = {
  background: '#fff',
  border: 'none',
  borderRadius: 16,
  padding: 18,
  boxShadow: '0 2px 12px rgba(0,31,63,0.06)',
}

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 28, label: '28 days' },
  { days: 90, label: '90 days' },
] as const

export default function WebsitePerformancePanel() {
  const { isFullAdmin } = usePanelSession()
  const [days, setDays] = useState(28)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [focusKey, setFocusKey] = useState('activeUsers')
  const [consoleUrl, setConsoleUrl] = useState(
    'https://analytics.google.com/analytics/web/#/a273004667p509919249/reports/intelligenthome',
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/analytics/overview?days=${days}`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (data.consoleUrl) setConsoleUrl(String(data.consoleUrl))
      if (!res.ok) {
        setOverview(null)
        throw new Error(data.error || 'Could not load website performance')
      }
      setOverview(data.overview as Overview)
      if (data.overview?.consoleUrl) setConsoleUrl(String(data.overview.consoleUrl))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load website performance')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const focused = overview?.metrics.find(metric => metric.key === focusKey) || overview?.metrics[0]

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {RANGES.map(range => {
            const active = days === range.days
            return (
              <button
                key={range.days}
                type="button"
                aria-pressed={active}
                onClick={() => setDays(range.days)}
                style={{
                  border: 'none',
                  background: active ? 'var(--primary)' : '#fff',
                  color: active ? '#fff' : 'var(--text-2)',
                  borderRadius: 10,
                  padding: '7px 12px',
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: active
                    ? '0 2px 8px rgba(0,31,63,0.18)'
                    : '0 1px 4px rgba(0,31,63,0.06)',
                }}
              >
                {range.label}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {overview ? (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {overview.rangeLabel} · {new Date(overview.fetchedAt).toLocaleString()}
            </span>
          ) : null}
          <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
          {isFullAdmin ? (
            <a
              href={consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 10,
                background: 'var(--primary)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Open Analytics
            </a>
          ) : null}
        </div>
      </div>

      {loading && !overview ? (
        <div style={{ ...card, color: 'var(--text-3)' }}>Loading website performance…</div>
      ) : null}

      {error ? (
        <div style={{ ...card, borderColor: '#FECACA', background: '#FEF2F2', color: '#991B1B' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Website traffic unavailable.</p>
          {isFullAdmin ? (
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>
              The Data API is on. Add{' '}
              <strong>firebase-adminsdk-fbsvc@vero360app-ca423.iam.gserviceaccount.com</strong> as a Viewer on the GA4 property, then refresh.{' '}
              <a
                href="https://analytics.google.com/analytics/web/#/a273004667p509919249/admin/property/access-management"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 700 }}
              >
                Open property access
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {overview && focused ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {overview.metrics.map(metric => {
              const active = metric.key === focused.key
              return (
                <button
                  key={metric.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFocusKey(metric.key)}
                  style={{
                    ...card,
                    textAlign: 'left',
                    font: 'inherit',
                    cursor: 'pointer',
                    borderColor: active ? '#C2410C' : 'var(--border)',
                    background: active ? '#FFF7ED' : '#fff',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-3)' }}>
                    {metric.label}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.5px' }}>
                    {metric.value}
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ ...card, marginBottom: 14, background: '#0F172A', color: '#fff', borderColor: '#0F172A' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#FDBA74' }}>
              {focused.label}
            </div>
            <div style={{ marginTop: 6, fontSize: 40, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.8px' }}>
              {focused.value}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#CBD5E1' }}>{overview.rangeLabel}</div>
          </div>

          <div className="perf-web-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <RankCard title="Top pages" rows={overview.topPages} empty="No page data yet." color="#EA580C" />
            <RankCard title="Top countries" rows={overview.topCountries} empty="No country data yet." color="#2563EB" />
          </div>
          <style>{`
            @media (max-width: 800px) {
              .perf-web-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </>
      ) : null}
    </div>
  )
}

function RankCard({
  title,
  rows,
  empty,
  color,
}: {
  title: string
  rows: GaRow[]
  empty: string
  color: string
}) {
  const [active, setActive] = useState(0)
  const max = Math.max(1, ...rows.map(row => row.raw))
  const current = rows[active] || null
  const share = current && rows.reduce((sum, row) => sum + row.raw, 0) > 0
    ? Math.round((current.raw / rows.reduce((sum, row) => sum + row.raw, 0)) * 100)
    : 0

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h3>
        {current ? (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{share}% of this list</span>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 14 }}>{empty}</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {rows.map((row, index) => {
            const selected = index === active
            return (
              <button
                key={`${row.label}-${index}`}
                type="button"
                aria-pressed={selected}
                onClick={() => setActive(index)}
                style={{
                  textAlign: 'left',
                  border: selected ? `1px solid ${color}` : '1px solid transparent',
                  background: selected ? '#F8FAFC' : 'transparent',
                  borderRadius: 10,
                  padding: '7px 8px',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{row.value}</span>
                </div>
                <div style={{ height: 7, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(2, (row.raw / max) * 100)}%`, height: '100%', background: color }} />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
