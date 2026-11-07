'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/panel-client-auth'
import { DashboardRefreshButton } from '@/app/dashboard/DashboardChrome'

type GrowthData = {
  mau: number
  wau: number
  dau: number
  newSignups7d: number
  newSignupsMonth: number
  websiteSessions: number
  websiteActiveUsers: number
  websiteNewUsers: number
  installs: number | null
  installsSource: string
  channels: Array<{ label: string; sessions: number; users: number }>
  campaigns: Array<{ label: string; sessions: number; users: number }>
  notes: string[]
  fetchedAt: string
  days: number
}

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 16,
  boxShadow: 'var(--shadow-sm)',
}

function fmt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-MW')
}

export default function GrowthOverviewPanel() {
  const [days, setDays] = useState(28)
  const [data, setData] = useState<GrowthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/analytics/growth?days=${days}`, {
        cache: 'no-store',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not load growth metrics')
      setData(body as GrowthData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load growth metrics')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const metrics = [
    { label: 'MAU', value: fmt(data?.mau), hint: 'Active in last 30 days' },
    { label: 'WAU', value: fmt(data?.wau), hint: 'Active in last 7 days' },
    { label: 'DAU', value: fmt(data?.dau), hint: 'Active in last 24h' },
    { label: 'New signups (7d)', value: fmt(data?.newSignups7d), hint: 'App accounts' },
    { label: 'Site sessions', value: fmt(data?.websiteSessions), hint: `Last ${days} days` },
    {
      label: 'App installs',
      value: fmt(data?.installs),
      hint: data?.installsSource === 'play' ? 'Play Console' : 'Link Play API',
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[7, 28, 90].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              style={{
                border: days === d ? '1px solid #7DD3FC' : '1px solid var(--border)',
                background: days === d ? '#F0F9FF' : '#fff',
                color: days === d ? '#0369A1' : 'var(--text-2)',
                borderRadius: 999,
                padding: '6px 12px',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link
            href="/dashboard/marketing/campaigns"
            style={{ fontSize: 13, fontWeight: 700, color: '#0369A1' }}
          >
            Campaigns →
          </Link>
          <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
        </div>
      </div>

      {error ? (
        <p style={{ color: '#B91C1C', fontWeight: 600 }}>{error}</p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {metrics.map(m => (
          <div key={m.label} style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{m.label}</div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                marginTop: 6,
                fontFamily: 'var(--font-display)',
              }}
            >
              {loading && !data ? '…' : m.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{m.hint}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        <div style={card}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800 }}>Top channels</h3>
          {(data?.channels || []).length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>
              {loading ? 'Loading…' : 'No channel data yet.'}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {data!.channels.map(row => (
                <li
                  key={row.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{row.label}</span>
                  <span style={{ color: 'var(--text-3)' }}>
                    {fmt(row.sessions)} sessions
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={card}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800 }}>
            Campaign traffic (UTM)
          </h3>
          {(data?.campaigns || []).length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>
              {loading
                ? 'Loading…'
                : 'No campaign UTMs yet. Create a campaign and share tracked links.'}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {data!.campaigns.map(row => (
                <li
                  key={row.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{row.label}</span>
                  <span style={{ color: 'var(--text-3)' }}>
                    {fmt(row.sessions)} sessions
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {data?.notes?.length ? (
        <ul style={{ margin: '14px 0 0', paddingLeft: 18, color: 'var(--text-3)', fontSize: 12 }}>
          {data.notes.map(note => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      {data?.fetchedAt ? (
        <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text-4)' }}>
          Updated {new Date(data.fetchedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  )
}
