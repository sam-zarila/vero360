'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import {
  MARKETING_PROGRESS_START_DATE,
  buildMarketingProgress,
  formatMarketingDate,
  type MarketingTask,
} from '@/lib/marketing-tasks'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../../PanelSessionProvider'
import { MarketingSubNav } from '../MarketingSubNav'

export default function MarketingProgressPage() {
  const { isMarketer, loading: sessionLoading } = usePanelSession()
  const [items, setItems] = useState<MarketingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/marketing-tasks', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load progress')
      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionLoading) return
    void load()
  }, [load, sessionLoading])

  const progress = useMemo(() => buildMarketingProgress(items, 14), [items])
  const maxBar = Math.max(3, ...progress.days.map(d => d.count), 1)
  const ratingColor =
    progress.rating === 'good' ? '#047857' : progress.rating === 'ok' ? '#B45309' : '#B91C1C'
  const ratingBg =
    progress.rating === 'good' ? '#ECFDF5' : progress.rating === 'ok' ? '#FFFBEB' : '#FEF2F2'

  return (
    <div>
      {!isMarketer ? <DashboardBackLink label="Back to dashboard" /> : null}

      <DashboardPageHeader
        sectionId="marketing"
        title="My progress"
        description={`Daily posting score · tracking starts ${formatMarketingDate(MARKETING_PROGRESS_START_DATE)}.`}
        actions={<DashboardRefreshButton onClick={() => void load()} disabled={loading} />}
      />

      <MarketingSubNav />

      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#FEF2F2',
            color: '#991B1B',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      ) : null}

      {!progress.trackingStarted ? (
        <DashboardEmptyState
          icon="layers"
          color="#C2410C"
          title="Tracking starts soon"
          hint={`Progress scoring begins on ${formatMarketingDate(MARKETING_PROGRESS_START_DATE)}. You can still log tasks now.`}
        />
      ) : loading ? (
        <div style={{ padding: 24, color: 'var(--text-3)', fontWeight: 600 }}>Loading progress…</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <Metric label="Score" value={String(progress.score)} accent={ratingColor} />
            <Metric label="Posted" value={String(progress.totalPosted)} />
            <Metric
              label="Active days"
              value={`${progress.activeDays}/${progress.trackedDays || 14}`}
            />
            <Metric label="Avg / day" value={String(progress.avgPerDay)} />
          </div>

          <section style={card}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 16,
                alignItems: 'flex-start',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Posting activity</h2>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
                  By date posted · from {formatMarketingDate(MARKETING_PROGRESS_START_DATE)}
                </p>
              </div>
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: 12,
                  background: ratingBg,
                  color: ratingColor,
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {progress.ratingLabel}
              </div>
            </div>

            {progress.days.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-3)' }}>No tracked days yet.</p>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 6,
                    height: 160,
                    padding: '8px 4px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {progress.days.map(day => {
                    const heightPct = Math.max(day.count === 0 ? 6 : (day.count / maxBar) * 100, 6)
                    const barColor =
                      day.tone === 'good' ? '#16A34A' : day.tone === 'ok' ? '#F59E0B' : '#EF4444'
                    return (
                      <div
                        key={day.key}
                        title={`${day.label}: ${day.count} posted`}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          height: '100%',
                          gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)' }}>
                          {day.count || ''}
                        </span>
                        <div
                          style={{
                            width: '100%',
                            maxWidth: 28,
                            height: `${heightPct}%`,
                            minHeight: day.count === 0 ? 8 : 16,
                            borderRadius: '8px 8px 4px 4px',
                            background: barColor,
                            opacity: day.count === 0 ? 0.35 : 1,
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {progress.days.map(day => (
                    <div
                      key={`${day.key}-lbl`}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'center',
                        fontSize: 9,
                        color: 'var(--text-3)',
                        fontWeight: 600,
                        lineHeight: 1.2,
                      }}
                    >
                      {day.label}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 14,
                    marginTop: 14,
                    fontSize: 12,
                    color: 'var(--text-3)',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: '#16A34A' }} />
                    Good (2+ posts)
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: '#F59E0B' }} />
                    Okay (1 post)
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: '#EF4444' }} />
                    Poor (none)
                  </span>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: accent || 'inherit' }}>
        {value}
      </div>
    </div>
  )
}

const card: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
}
