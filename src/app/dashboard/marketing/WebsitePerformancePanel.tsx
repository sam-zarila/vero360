'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
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
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 18,
  boxShadow: 'var(--shadow-sm)',
}

function buildSummary(overview: Overview): string {
  const get = (key: string) => overview.metrics.find(m => m.key === key)
  const people = get('activeUsers')
  const visits = get('sessions')
  const pages = get('pageViews')
  const bounce = get('bounceRate')
  const time = get('avgDuration')
  const topPage = overview.topPages[0]
  const topCountry = overview.topCountries[0]

  const bits = [
    `${overview.rangeLabel}: ${people?.value || '—'} active users, ${visits?.value || '—'} sessions, ${pages?.value || '—'} page views.`,
  ]
  if (time || bounce) {
    const extra = [
      time ? `Average session ${time.value}` : '',
      bounce ? `Bounce rate ${bounce.value}` : '',
    ].filter(Boolean)
    bits.push(`${extra.join('. ')}.`)
  }
  if (topPage) bits.push(`Top page: ${topPage.label} (${topPage.value}).`)
  if (topCountry) bits.push(`Top country: ${topCountry.label}.`)
  return bits.join(' ')
}

export default function WebsitePerformancePanel() {
  const { isMarketer, isFullAdmin } = usePanelSession()
  const [days, setDays] = useState(28)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [setupHint, setSetupHint] = useState('')
  const [consoleUrl, setConsoleUrl] = useState(
    'https://analytics.google.com/analytics/web/#/a273004667p509919249/reports/intelligenthome',
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSetupHint('')
    try {
      const res = await adminFetch(`/api/admin/analytics/overview?days=${days}`, {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (data.consoleUrl) setConsoleUrl(String(data.consoleUrl))
      if (!res.ok) {
        setOverview(null)
        setSetupHint(typeof data.setupHint === 'string' ? data.setupHint : '')
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

  const summary = useMemo(
    () => (overview ? buildSummary(overview) : ''),
    [overview],
  )

  return (
    <div>
      <div
        style={{
          ...card,
          marginBottom: 16,
          background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 70%)',
          borderColor: '#FDBA74',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: '#C2410C',
          }}
        >
          Website
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
          Website performance
        </h2>
        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 15, lineHeight: 1.6 }}>
          Traffic and page activity from Google Analytics.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          aria-label="Date range"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '8px 12px',
            font: 'inherit',
            background: '#fff',
          }}
        >
          <option value={7}>Last 7 days</option>
          <option value={28}>Last 28 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
        {isFullAdmin ? (
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '9px 14px',
              borderRadius: 10,
              background: 'var(--primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Open full Google Analytics
          </a>
        ) : null}
      </div>

      {loading && !overview ? (
        <div style={{ ...card, color: 'var(--text-3)' }}>Loading website performance…</div>
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
          <p style={{ margin: 0, fontWeight: 700 }}>
            {isMarketer ? 'Website numbers are not available yet.' : 'Website numbers are unavailable.'}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>
            {isMarketer ? 'Google Analytics is still being connected. Account and service figures above are current.' : error}
          </p>
          {setupHint && isFullAdmin ? (
            <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, color: '#7F1D1D' }}>
              Admin setup: {setupHint}
            </p>
          ) : null}
          {isFullAdmin ? (
            <p style={{ margin: '12px 0 0', fontSize: 14 }}>
              <a href={consoleUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
                Open Google Analytics
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {overview ? (
        <>
          <div style={{ ...card, marginBottom: 16, background: '#F8FAFC' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800 }}>Summary</h3>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--text-2)' }}>
              {summary}
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
              {overview.rangeLabel}
              {overview.fetchedAt
                ? ` · Updated ${new Date(overview.fetchedAt).toLocaleString()}`
                : ''}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {overview.metrics.map(metric => (
                <div key={metric.key} style={card}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>
                    {metric.label}
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
                    {metric.value}
                  </div>
                </div>
              ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
            }}
          >
            <div style={card}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>
                Top pages
              </h3>
              {overview.topPages.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 14 }}>No page data yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {overview.topPages.map(row => (
                    <li
                      key={row.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '8px 0',
                        borderBottom: '1px solid var(--border)',
                        fontSize: 14,
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</span>
                      <strong>{row.value}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={card}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>
                Top countries
              </h3>
              {overview.topCountries.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 14 }}>No country data yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {overview.topCountries.map(row => (
                    <li
                      key={row.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '8px 0',
                        borderBottom: '1px solid var(--border)',
                        fontSize: 14,
                      }}
                    >
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
