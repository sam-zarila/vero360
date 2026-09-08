'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/panel-client-auth'
import {
  MARKETING_PROGRESS_START_DATE,
  buildMarketerKpiBoard,
  buildMarketingProgress,
  formatMarketingDate,
  type MarketingTask,
  type MarketerKpiRow,
} from '@/lib/marketing-tasks'
import {
  DashboardBackLink,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardRefreshButton,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../../PanelSessionProvider'
import { MarketingSubNav } from '../MarketingSubNav'

export default function MarketingKpiPage() {
  const router = useRouter()
  const { isMarketer, isFullAdmin, loading: sessionLoading } = usePanelSession()

  const [items, setItems] = useState<MarketingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dayCount, setDayCount] = useState(14)

  useEffect(() => {
    if (sessionLoading) return
    if (isMarketer) router.replace('/dashboard/marketing/tasks')
  }, [sessionLoading, isMarketer, router])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/marketing-tasks', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load KPI data')
      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load KPI data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionLoading || isMarketer) return
    void load()
  }, [load, sessionLoading, isMarketer])

  const board = useMemo(() => buildMarketerKpiBoard(items, dayCount), [items, dayCount])
  const teamProgress = useMemo(() => buildMarketingProgress(items, dayCount), [items, dayCount])

  const teamRatingColor =
    teamProgress.rating === 'good' ? '#047857' : teamProgress.rating === 'ok' ? '#B45309' : '#B91C1C'
  const teamRatingBg =
    teamProgress.rating === 'good' ? '#ECFDF5' : teamProgress.rating === 'ok' ? '#FFFBEB' : '#FEF2F2'

  if (sessionLoading || isMarketer) {
    return (
      <div style={{ padding: 24, color: 'var(--text-3)', fontWeight: 600 }}>Loading…</div>
    )
  }

  if (!isFullAdmin) {
    return (
      <div>
        <DashboardBackLink label="Back to dashboard" />
        <DashboardEmptyState
          icon="layers"
          color="#C2410C"
          title="Admins only"
          hint="KPI tracker is available to admins and super admins."
        />
      </div>
    )
  }

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader
        sectionId="marketing"
        title="Marketing KPI tracker"
        description={`See how every marketer is working. Scoring starts ${formatMarketingDate(MARKETING_PROGRESS_START_DATE)}.`}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              Window{' '}
              <select
                value={dayCount}
                onChange={e => setDayCount(Number(e.target.value))}
                style={selectStyle}
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </label>
            <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
          </div>
        }
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

      {!teamProgress.trackingStarted ? (
        <DashboardEmptyState
          icon="layers"
          color="#C2410C"
          title="Tracking starts soon"
          hint={`KPI scoring begins on ${formatMarketingDate(MARKETING_PROGRESS_START_DATE)}.`}
        />
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
        <Metric label="Marketers" value={String(board.length)} />
        <Metric label={`Posted (${teamProgress.trackedDays}d)`} value={String(teamProgress.totalPosted)} />
        <Metric label="Team avg / day" value={String(teamProgress.avgPerDay)} />
        <Metric label="Team score" value={String(teamProgress.score)} accent={teamRatingColor} />
      </div>

      <section style={{ ...card, marginBottom: 18 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Team posting activity</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
              All marketers combined · last {dayCount} days
            </p>
          </div>
          <div
            style={{
              padding: '8px 14px',
              borderRadius: 12,
              background: teamRatingBg,
              color: teamRatingColor,
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {teamProgress.ratingLabel}
          </div>
        </div>
        <ProgressBars days={teamProgress.days} />
      </section>

      {loading ? (
        <div style={{ padding: 24, color: 'var(--text-3)', fontWeight: 600 }}>Loading KPIs…</div>
      ) : board.length === 0 ? (
        <DashboardEmptyState
          icon="layers"
          color="#C2410C"
          title="No marketer activity yet"
          hint="Once marketers log tasks, their KPIs will show up here."
        />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {board.map(row => (
            <MarketerKpiCard key={row.marketerUid} row={row} dayCount={dayCount} />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}

function MarketerKpiCard({ row, dayCount }: { row: MarketerKpiRow; dayCount: number }) {
  const { progress } = row
  const ratingColor =
    progress.rating === 'good' ? '#047857' : progress.rating === 'ok' ? '#B45309' : '#B91C1C'
  const ratingBg =
    progress.rating === 'good' ? '#ECFDF5' : progress.rating === 'ok' ? '#FFFBEB' : '#FEF2F2'

  return (
    <section style={card}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{row.marketerName}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
            {row.marketerEmail || row.marketerUid}
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
          Score {progress.score}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <MiniStat label={`Posted (${progress.trackedDays}d)`} value={String(progress.totalPosted)} />
        <MiniStat label="Active days" value={`${progress.activeDays}/${progress.trackedDays || dayCount}`} />
        <MiniStat label="Avg / day" value={String(progress.avgPerDay)} />
        <MiniStat label="Tasks" value={String(row.taskCount)} />
        <MiniStat label="Completed" value={String(row.completedCount)} />
        <MiniStat label="In progress" value={String(row.inProgressCount)} />
      </div>

      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: ratingColor }}>
        {progress.ratingLabel}
      </p>
      <ProgressBars days={progress.days} compact />
    </section>
  )
}

function ProgressBars({
  days,
  compact,
}: {
  days: ReturnType<typeof buildMarketingProgress>['days']
  compact?: boolean
}) {
  const maxBar = Math.max(3, ...days.map(d => d.count))
  const height = compact ? 100 : 140

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          height,
          padding: '8px 4px 0',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {days.map(day => {
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
                gap: 4,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)' }}>
                {day.count || ''}
              </span>
              <div
                style={{
                  width: '100%',
                  maxWidth: compact ? 22 : 28,
                  height: `${heightPct}%`,
                  minHeight: day.count === 0 ? 8 : 14,
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
        {days.map(day => (
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
    </>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 12,
        background: '#FFF7ED',
        border: '1px solid #FED7AA',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>{value}</div>
    </div>
  )
}

const card: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
}

const selectStyle: CSSProperties = {
  marginLeft: 6,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontWeight: 600,
  fontSize: 13,
}
