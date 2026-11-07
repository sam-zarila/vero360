'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { LuActivity, LuDownload, LuGlobe, LuMegaphone, LuUsers } from 'react-icons/lu'
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

const CARD =
  'flex flex-col justify-between rounded-xl bg-surface-container-lowest p-5 shadow-[0_2px_10px_rgba(0,31,63,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,31,63,0.1)]'
const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant'
const PANEL =
  'rounded-2xl bg-surface-container-lowest shadow-[0_2px_12px_rgba(0,31,63,0.06)] overflow-hidden'

function fmt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-MW')
}

function percent(part: number, whole: number) {
  if (!whole || !Number.isFinite(part) || !Number.isFinite(whole)) return 0
  return Math.max(0, Math.min(100, (part / whole) * 100))
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

  const mau = data?.mau ?? 0
  const wau = data?.wau ?? 0
  const dau = data?.dau ?? 0
  const wauShare = percent(wau, mau || 1)
  const channelTotal = useMemo(
    () => (data?.channels || []).reduce((sum, row) => sum + row.sessions, 0),
    [data?.channels],
  )
  const campaignTotal = useMemo(
    () => (data?.campaigns || []).reduce((sum, row) => sum + row.sessions, 0),
    [data?.campaigns],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1.5 rounded-xl bg-surface-container p-1">
          {[7, 28, 90].map(d => {
            const active = days === d
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-lg px-3.5 py-2 text-[12px] font-bold transition-colors ${
                  active
                    ? 'bg-primary text-on-primary shadow-[0_2px_8px_rgba(0,31,63,0.18)]'
                    : 'text-on-surface-variant hover:bg-surface-container-lowest'
                }`}
              >
                {d}d
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data?.fetchedAt ? (
            <span className="rounded-full bg-surface-container px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant">
              Updated {new Date(data.fetchedAt).toLocaleString()}
            </span>
          ) : null}
          <Link
            href="/dashboard/marketing/campaigns"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-container px-3 py-2 text-[12px] font-bold text-secondary-container no-underline"
          >
            <LuMegaphone className="text-[14px]" aria-hidden />
            Campaigns
          </Link>
          <DashboardRefreshButton onClick={() => void load()} disabled={loading} />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-error-container bg-error-container/30 px-4 py-3 text-[13px] font-bold text-error">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={CARD}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className={EYEBROW}>Active users</p>
              <p className="font-heading text-[30px] font-extrabold leading-none tracking-tight text-primary">
                {loading && !data ? '…' : fmt(mau)}
              </p>
              <p className="text-[13px] leading-snug text-on-surface-variant">
                MAU · {fmt(wau)} WAU · {fmt(dau)} DAU
              </p>
            </div>
            <div className="relative grid h-16 w-16 shrink-0 place-items-center">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90" aria-hidden>
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="none"
                  strokeWidth="3.8"
                  className="stroke-surface-container-high"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="none"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  strokeDasharray={`${wauShare} ${100 - wauShare}`}
                  className="stroke-secondary-container transition-all duration-700 ease-out"
                />
              </svg>
              <span className="absolute text-[11px] font-bold text-primary">
                {wauShare.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-surface-container pt-3 text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-secondary-container" />
              WAU of MAU
            </span>
            <span className="font-medium text-primary">Stickiness</span>
          </div>
        </div>

        <div className={CARD}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={EYEBROW}>Acquisition</span>
            <LuUsers className="text-[19px] text-primary-container" aria-hidden />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-[30px] font-extrabold leading-none tracking-tight text-primary">
              {loading && !data ? '…' : fmt(data?.newSignups7d)}
            </span>
            <span className="text-[12px] font-semibold text-on-surface-variant">new · 7d</span>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-on-surface-variant">
            {fmt(data?.newSignupsMonth)} signups this month
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
              <span
                className="bg-emerald-500"
                style={{
                  width: `${percent(data?.newSignups7d ?? 0, Math.max(1, data?.newSignupsMonth ?? 0))}%`,
                }}
              />
              <span className="bg-sky-500" style={{ flex: 1 }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Last 7 days
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                Month to date
              </span>
            </div>
          </div>
        </div>

        <div className={CARD}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className={EYEBROW}>Website pulse</p>
              <p className="font-heading text-[30px] font-extrabold leading-none tracking-tight text-primary">
                {loading && !data ? '…' : fmt(data?.websiteSessions)}
              </p>
              <p className="text-[13px] leading-snug text-on-surface-variant">
                Sessions · last {days}d
              </p>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-container text-secondary-container">
              <LuGlobe className="text-[19px]" aria-hidden />
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface-container-low px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-on-surface-variant">
                Active
              </p>
              <p className="mt-1 text-[16px] font-extrabold text-primary">
                {fmt(data?.websiteActiveUsers)}
              </p>
            </div>
            <div className="rounded-lg bg-surface-container-low px-2.5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-on-surface-variant">
                New
              </p>
              <p className="mt-1 text-[16px] font-extrabold text-secondary-container">
                {fmt(data?.websiteNewUsers)}
              </p>
            </div>
          </div>
        </div>

        <div className={CARD}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className={EYEBROW}>App installs</p>
              <p className="font-heading text-[30px] font-extrabold leading-none tracking-tight text-primary">
                {loading && !data ? '…' : fmt(data?.installs)}
              </p>
              <p className="text-[13px] leading-snug text-on-surface-variant">
                {data?.installsSource === 'play' ? 'Play Console' : 'Link Play API for live installs'}
              </p>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-container text-on-surface">
              <LuDownload className="text-[19px]" aria-hidden />
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-2.5 py-2 text-[11px]">
            <span className="font-semibold text-on-surface-variant">
              {data?.installs != null ? 'Installs tracked' : 'Installs unavailable'}
            </span>
            <span className="font-medium text-secondary">
              <LuActivity className="mr-1 inline text-[12px]" aria-hidden />
              Growth
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownPanel
          title="Top channels"
          icon={<LuGlobe className="text-[16px]" aria-hidden />}
          rows={data?.channels || []}
          total={channelTotal}
          loading={loading && !data}
          empty="No channel data yet."
        />
        <BreakdownPanel
          title="Campaign traffic (UTM)"
          icon={<LuMegaphone className="text-[16px]" aria-hidden />}
          rows={data?.campaigns || []}
          total={campaignTotal}
          loading={loading && !data}
          empty="No campaign UTMs yet. Create a campaign and share tracked links."
        />
      </div>

      {data?.notes?.length ? (
        <ul className="m-0 list-disc space-y-1 pl-5 text-[12px] text-on-surface-variant">
          {data.notes.map(note => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function BreakdownPanel({
  title,
  icon,
  rows,
  total,
  loading,
  empty,
}: {
  title: string
  icon: ReactNode
  rows: Array<{ label: string; sessions: number; users: number }>
  total: number
  loading: boolean
  empty: string
}) {
  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between gap-3 border-b border-surface-container px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-container text-secondary-container">
            {icon}
          </span>
          <h3 className="font-heading text-[16px] font-bold leading-tight text-primary">{title}</h3>
        </div>
        <span className="text-[11px] font-semibold text-on-surface-variant">
          {total > 0 ? `${fmt(total)} sessions` : '—'}
        </span>
      </div>
      <div className="space-y-3 p-4">
        {rows.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed border-outline-variant/70 bg-surface-container-low px-4 py-8 text-center text-[12.5px] leading-relaxed text-on-surface-variant">
            {loading ? 'Loading…' : empty}
          </p>
        ) : (
          rows.map(row => {
            const share = percent(row.sessions, total || 1)
            return (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate font-semibold text-on-surface">{row.label}</span>
                  <span className="shrink-0 text-on-surface-variant">
                    {fmt(row.sessions)} · {fmt(row.users)} users
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                  <span
                    className="block h-full rounded-full bg-secondary-container transition-all duration-500"
                    style={{ width: `${share}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
