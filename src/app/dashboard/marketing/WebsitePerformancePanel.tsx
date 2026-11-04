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

const METRIC_HELP: Record<string, { title: string; plain: string }> = {
  activeUsers: {
    title: 'People who visited',
    plain: 'How many different people opened the Vero360 website in this period.',
  },
  newUsers: {
    title: 'First-time visitors',
    plain: 'People seeing the site for the first time. Useful to judge if ads and posts are bringing new traffic.',
  },
  sessions: {
    title: 'Visits',
    plain: 'Total visits. One person can visit more than once, so this can be higher than “people who visited”.',
  },
  pageViews: {
    title: 'Pages opened',
    plain: 'How many times any page was opened. More pages usually means people are exploring.',
  },
  bounceRate: {
    title: 'Left after one page',
    plain: 'Share of visits where someone opened only one page and left. Lower usually means the site held their attention.',
  },
  avgDuration: {
    title: 'Time spent',
    plain: 'How long a typical visit lasts. Longer visits often mean people are reading or browsing more.',
  },
}

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 18,
  boxShadow: 'var(--shadow-sm)',
}

function metricHelp(key: string) {
  return (
    METRIC_HELP[key] || {
      title: key,
      plain: 'A website performance number from Google Analytics.',
    }
  )
}

function buildPlainSummary(overview: Overview): string {
  const get = (key: string) => overview.metrics.find(m => m.key === key)
  const people = get('activeUsers')
  const visits = get('sessions')
  const pages = get('pageViews')
  const bounce = get('bounceRate')
  const time = get('avgDuration')
  const topPage = overview.topPages[0]
  const topCountry = overview.topCountries[0]

  const parts = [
    `In the ${overview.rangeLabel.toLowerCase()}, about ${people?.value || '—'} people visited the website across ${visits?.value || '—'} visits.`,
    `They opened about ${pages?.value || '—'} pages in total`,
  ]

  if (time) parts.push(`and stayed around ${time.value} per visit`)
  let sentence = `${parts.join(' ')}.`

  if (bounce) {
    sentence += ` About ${bounce.value} of visits ended after only one page.`
  }
  if (topPage) {
    sentence += ` The most opened page was “${topPage.label}” (${topPage.value} opens).`
  }
  if (topCountry) {
    sentence += ` Most visitors came from ${topCountry.label}.`
  }
  return sentence
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
    () => (overview ? buildPlainSummary(overview) : ''),
    [overview],
  )

  const audienceLine = isMarketer
    ? 'This shows how the Vero360 website is doing so you can see if your posts, ads, and campaigns are bringing people in.'
    : 'This shows how the Vero360 website is doing for the whole team — traffic, interest, and which pages people open most.'

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
          {isMarketer ? 'Marketing portal' : 'Admin + marketing'}
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
          How our website is performing
        </h2>
        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 15, lineHeight: 1.6 }}>
          {audienceLine} Numbers come from Google Analytics and are written in plain words below —
          you do not need to know analytics jargon.
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
        {(isFullAdmin || isMarketer) && (
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
        )}
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
          <p style={{ margin: 0, fontWeight: 700 }}>We could not pull the live numbers yet.</p>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>
            {error}
          </p>
          {setupHint && isFullAdmin ? (
            <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, color: '#7F1D1D' }}>
              Admin setup: {setupHint}
            </p>
          ) : null}
          <p style={{ margin: '12px 0 0', fontSize: 14 }}>
            You can still open the live Google report:{' '}
            <a href={consoleUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
              Website performance in Google Analytics
            </a>
          </p>
        </div>
      ) : null}

      {overview ? (
        <>
          <div style={{ ...card, marginBottom: 16, background: '#F8FAFC' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800 }}>In plain words</h3>
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
            {overview.metrics.map(metric => {
              const help = metricHelp(metric.key)
              return (
                <div key={metric.key} style={card}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>
                    {help.title}
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
                  <p
                    style={{
                      margin: '10px 0 0',
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--text-3)',
                    }}
                  >
                    {help.plain}
                  </p>
                </div>
              )
            })}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
            }}
          >
            <div style={card}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>
                Pages people open most
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
                These are the website pages getting the most attention. Promote what works, and fix
                pages that should be popular but are not.
              </p>
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
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>
                Where visitors come from
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Countries with the most visitors. Helpful when you plan local campaigns in Malawi
                or reach people abroad.
              </p>
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
