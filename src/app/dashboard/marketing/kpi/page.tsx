'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { adminFetch } from '@/lib/panel-client-auth'
import {
  MARKETING_PROGRESS_START_DATE,
  buildDemoMarketingTasks,
  buildMarketerKpiBoard,
  buildMarketingProgress,
  formatMarketingDate,
  isMarketingKpiDemoAvailable,
  isMarketingLiveTrackingActive,
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

type KpiMode = 'demo' | 'live'

export default function MarketingKpiPage() {
  const { isMarketer, isFullAdmin, loading: sessionLoading } = usePanelSession()

  const demoAvailable = isMarketingKpiDemoAvailable()
  const liveActive = isMarketingLiveTrackingActive()

  const [mode, setMode] = useState<KpiMode>(demoAvailable ? 'demo' : 'live')
  const [items, setItems] = useState<MarketingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dayCount, setDayCount] = useState(14)

  useEffect(() => {
    if (!demoAvailable && mode === 'demo') setMode('live')
  }, [demoAvailable, mode])

  // Marketers stay on Demo while it exists (their own tasks only).
  useEffect(() => {
    if (isMarketer && demoAvailable && mode !== 'demo') setMode('demo')
  }, [isMarketer, demoAvailable, mode])

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
    if (sessionLoading) return
    // Marketers always load their own tasks (API-scoped). Admins load for Live;
    // admin Demo uses sample data and skips the fetch.
    if (isMarketer) {
      void load()
      return
    }
    if (!isFullAdmin) {
      setLoading(false)
      return
    }
    if (mode === 'live') void load()
    else setLoading(false)
  }, [load, sessionLoading, isMarketer, isFullAdmin, mode])

  const isDemo = mode === 'demo' && demoAvailable
  const sourceTasks = useMemo(() => {
    if (isMarketer) return items
    if (isDemo) return buildDemoMarketingTasks(dayCount)
    return items
  }, [isMarketer, isDemo, dayCount, items])

  const progressOpts = useMemo(
    () => (isDemo ? { demo: true as const } : undefined),
    [isDemo],
  )
  const board = useMemo(
    () => buildMarketerKpiBoard(sourceTasks, dayCount, progressOpts),
    [sourceTasks, dayCount, progressOpts],
  )
  const personalProgress = useMemo(
    () => buildMarketingProgress(sourceTasks, dayCount, progressOpts),
    [sourceTasks, dayCount, progressOpts],
  )
  const teamProgress = personalProgress

  const teamRatingColor =
    teamProgress.rating === 'good' ? '#047857' : teamProgress.rating === 'ok' ? '#B45309' : '#B91C1C'
  const teamRatingBg =
    teamProgress.rating === 'good' ? '#ECFDF5' : teamProgress.rating === 'ok' ? '#FFFBEB' : '#FEF2F2'

  if (sessionLoading) {
    return (
      <div style={{ padding: 24, color: 'var(--text-3)', fontWeight: 600 }}>Loading…</div>
    )
  }

  if (!isFullAdmin && !isMarketer) {
    return (
      <div>
        <DashboardBackLink label="Back to dashboard" />
        <DashboardEmptyState
          icon="layers"
          color="#C2410C"
          title="Admins only"
          hint="KPI tracker is available to admins, super admins, and marketers."
        />
      </div>
    )
  }

  const title = isMarketer
    ? isDemo
      ? 'My Demo KPI'
      : 'My KPI'
    : 'Marketing KPI tracker'

  const description = isMarketer
    ? isDemo
      ? `Demo scoring on your posted tasks only — not official until ${formatMarketingDate(MARKETING_PROGRESS_START_DATE)}.`
      : `Live scoring from ${formatMarketingDate(MARKETING_PROGRESS_START_DATE)}.`
    : isDemo
      ? `Demo preview with sample marketers. Demo vanishes on ${formatMarketingDate(MARKETING_PROGRESS_START_DATE)}.`
      : `Live marketer scoring from ${formatMarketingDate(MARKETING_PROGRESS_START_DATE)}.`

  const showLiveEmpty = mode === 'live' && !liveActive
  const needsLoad = isMarketer || mode === 'live'

  return (
    <div>
      {!isMarketer ? <DashboardBackLink label="Back to dashboard" /> : null}

      <DashboardPageHeader
        sectionId="marketing"
        title={title}
        description={description}
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
            {needsLoad ? (
              <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
            ) : null}
          </div>
        }
      />

      <MarketingSubNav />

      {!isMarketer ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16,
            alignItems: 'center',
          }}
        >
          {demoAvailable ? (
            <ModeTab active={mode === 'demo'} onClick={() => setMode('demo')}>
              Demo
            </ModeTab>
          ) : null}
          <ModeTab active={mode === 'live'} onClick={() => setMode('live')}>
            Live
          </ModeTab>
          {demoAvailable ? (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>
              Demo ends {formatMarketingDate(MARKETING_PROGRESS_START_DATE)}
            </span>
          ) : null}
        </div>
      ) : null}

      {isDemo ? (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#FFF7ED',
            border: '1px solid #FED7AA',
            color: '#9A3412',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {isMarketer ? (
            <>
              This is a <strong>demo</strong> — only your own tasks are scored here. Not official
              until {formatMarketingDate(MARKETING_PROGRESS_START_DATE)}.
            </>
          ) : (
            <>
              This is a <strong>demo</strong> — sample marketers only, not real data. Switches to
              Live on {formatMarketingDate(MARKETING_PROGRESS_START_DATE)}.
            </>
          )}
        </div>
      ) : null}

      {error && needsLoad ? (
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

      {showLiveEmpty ? (
        <DashboardEmptyState
          icon="layers"
          color="#C2410C"
          title="Live tracking starts soon"
          hint={`Real KPI scoring begins on ${formatMarketingDate(MARKETING_PROGRESS_START_DATE)}. Use Demo until then.`}
        />
      ) : loading && needsLoad ? (
        <div style={{ padding: 24, color: 'var(--text-3)', fontWeight: 600 }}>Loading KPIs…</div>
      ) : isMarketer ? (
        board.length === 0 && sourceTasks.length === 0 ? (
          <DashboardEmptyState
            icon="layers"
            color="#C2410C"
            title={isDemo ? 'No demo activity yet' : 'No activity yet'}
            hint="Log your marketing tasks to see your score here."
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
              <Metric
                label={`Posted (${personalProgress.trackedDays}d)`}
                value={String(personalProgress.totalPosted)}
              />
              <Metric label="Avg / day" value={String(personalProgress.avgPerDay)} />
              <Metric
                label={isDemo ? 'Demo score' : 'Score'}
                value={String(personalProgress.score)}
                accent={teamRatingColor}
              />
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
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                    {isDemo ? 'Your demo activity' : 'Your posting activity'}
                  </h2>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
                    Only your tasks · last {dayCount} days
                    {isDemo ? ' · Demo' : ''}
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
                  {isDemo ? `Demo · ${personalProgress.ratingLabel}` : personalProgress.ratingLabel}
                </div>
              </div>
              <ProgressBars days={personalProgress.days} />
            </section>
            {board.map(row => (
              <MarketerKpiCard
                key={row.marketerUid}
                row={row}
                dayCount={dayCount}
                demo={isDemo}
              />
            ))}
          </>
        )
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
            <Metric
              label={`Posted (${teamProgress.trackedDays}d)`}
              value={String(teamProgress.totalPosted)}
            />
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
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  {isDemo ? 'Demo team activity' : 'Team posting activity'}
                </h2>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
                  {isDemo
                    ? `Sample marketers · last ${dayCount} days`
                    : `All marketers combined · last ${dayCount} days`}
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

          {board.length === 0 ? (
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

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 800,
        border: active ? '1px solid #FDBA74' : '1px solid var(--border)',
        background: active ? '#FFF7ED' : 'var(--surface)',
        color: active ? '#C2410C' : 'var(--text-2)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function MarketerKpiCard({
  row,
  dayCount,
  demo,
}: {
  row: MarketerKpiRow
  dayCount: number
  demo?: boolean
}) {
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
            {demo ? ' · Demo' : ''}
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
          {demo ? 'Demo score' : 'Score'} {progress.score}
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
        <MiniStat
          label="Active days"
          value={`${progress.activeDays}/${progress.trackedDays || dayCount}`}
        />
        <MiniStat label="Avg / day" value={String(progress.avgPerDay)} />
        <MiniStat label="Tasks" value={String(row.taskCount)} />
        <MiniStat label="Completed" value={String(row.completedCount)} />
        <MiniStat label="In progress" value={String(row.inProgressCount)} />
      </div>

      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: ratingColor }}>
        {demo ? `Demo · ${progress.ratingLabel}` : progress.ratingLabel}
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
  const maxBar = Math.max(3, ...days.map(d => d.count), 1)
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
