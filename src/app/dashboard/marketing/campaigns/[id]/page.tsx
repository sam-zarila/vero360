'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/panel-client-auth'
import type { MarketingCampaign } from '@/lib/marketing-campaigns'
import type { MarketingTask } from '@/lib/marketing-tasks'
import {
  DashboardBackLink,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../../../PanelSessionProvider'
import { MarketingSubNav } from '../../MarketingSubNav'

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 16,
  boxShadow: 'var(--shadow-sm)',
}

type DetailResponse = {
  item: MarketingCampaign
  links: { website: string; deepLink: string; store: string; utmQuery: string }
  linkedTasks: MarketingTask[]
  performance: {
    attributedSignups: number
    linkedTaskCount: number
    completedTasks: number
    website: {
      sessions: number
      users: number
      newUsers: number
      rangeLabel: string
    } | null
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function MarketingCampaignDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const { isMarketer, isFullAdmin, loading: sessionLoading } = usePanelSession()
  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/marketing-campaigns/${id}`, {
        cache: 'no-store',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to load campaign')
      setData(body as DetailResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!sessionLoading && !isFullAdmin && !isMarketer) {
    return (
      <div>
        <DashboardBackLink label="Campaigns" />
        <p style={{ color: 'var(--text-3)' }}>Only admins and marketers can view campaigns.</p>
      </div>
    )
  }

  const item = data?.item
  const perf = data?.performance

  return (
    <div>
      {isMarketer ? null : (
        <Link
          href="/dashboard/marketing/campaigns"
          style={{
            display: 'inline-flex',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-3)',
            marginBottom: 18,
          }}
        >
          ← Campaigns
        </Link>
      )}
      <DashboardPageHeader
        sectionId="marketing"
        title={item?.name || 'Campaign'}
        description={
          item
            ? `${item.status} · utm_campaign=${item.utmCampaign}`
            : 'Campaign detail and performance'
        }
      />
      <MarketingSubNav />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
      </div>

      {error ? <p style={{ color: '#B91C1C', fontWeight: 600 }}>{error}</p> : null}
      {loading && !data ? <p style={{ color: 'var(--text-3)' }}>Loading…</p> : null}

      {item && data ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {[
              {
                label: 'Site sessions',
                value: perf?.website?.sessions ?? '—',
                hint: perf?.website?.rangeLabel || 'GA4',
              },
              {
                label: 'Site users',
                value: perf?.website?.users ?? '—',
                hint: 'Campaign UTM',
              },
              {
                label: 'Attributed signups',
                value: perf?.attributedSignups ?? 0,
                hint: 'First-touch in app',
              },
              {
                label: 'Linked tasks',
                value: `${perf?.completedTasks ?? 0}/${perf?.linkedTaskCount ?? 0}`,
                hint: 'Completed / total',
              },
              {
                label: 'Target installs',
                value: item.targetInstalls ?? '—',
                hint: 'Goal',
              },
              {
                label: 'Target signups',
                value: item.targetSignups ?? '—',
                hint: 'Goal',
              },
            ].map(metric => (
              <div key={metric.label} style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                  {metric.label}
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    marginTop: 6,
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {metric.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  {metric.hint}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...card, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Tracked links</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-3)' }}>
              Use these on Buffer, TikTok, Facebook, email, and QR codes so Growth can attribute
              traffic.
            </p>
            {(
              [
                { key: 'website', label: 'Website / deep link', value: data.links.website },
                { key: 'store', label: 'Play Store', value: data.links.store },
              ] as const
            ).map(link => (
              <div key={link.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{link.label}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <code
                    style={{
                      flex: 1,
                      minWidth: 200,
                      fontSize: 12,
                      wordBreak: 'break-all',
                      background: '#F8FAFC',
                      padding: 10,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                    }}
                  >
                    {link.value}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyText(link.value)
                      setCopied(ok ? link.key : '')
                      if (ok) window.setTimeout(() => setCopied(''), 2000)
                    }}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      background: '#fff',
                      padding: '8px 12px',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {copied === link.key ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-4)' }}>
              Channel naming tip: utm_source = facebook|tiktok|email · utm_medium = paid|organic|social
            </p>
          </div>

          <div style={{ ...card, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800 }}>Brief</h3>
            <p style={{ margin: '0 0 6px', fontSize: 13 }}>
              <strong>Objective:</strong> {item.objective || '—'}
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 13 }}>
              <strong>Audience:</strong> {item.audience || '—'}
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 13 }}>
              <strong>CTA:</strong> {item.cta || '—'}
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 13 }}>
              <strong>Creative:</strong> {item.creativeNotes || '—'}
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Notes:</strong> {item.notes || '—'}
            </p>
          </div>

          <div style={card}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Linked tasks</h3>
              <Link
                href="/dashboard/marketing/tasks"
                style={{ fontSize: 13, fontWeight: 700, color: '#C2410C' }}
              >
                Open tasks →
              </Link>
            </div>
            {(data.linkedTasks || []).length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>
                No tasks linked yet. Attach this campaign when creating a marketing task.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                {data.linkedTasks.map(task => (
                  <li
                    key={task.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 13,
                      padding: '8px 10px',
                      borderRadius: 10,
                      background: '#F8FAFC',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{task.taskTitle}</span>
                    <span style={{ color: 'var(--text-3)' }}>
                      {task.platform} · {task.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
