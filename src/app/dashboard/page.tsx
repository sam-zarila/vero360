'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LuActivity, LuArrowUpRight, LuDownload, LuGlobe, LuUsers } from 'react-icons/lu'
import { adminFetch } from '@/lib/panel-client-auth'
import DashboardCards from './DashboardCards'
import { MARKETER_HOME, usePanelSession } from './PanelSessionProvider'

type GrowthStrip = {
  mau: number | null
  newUsers7d: number | null
  sessions: number | null
  installs: number | null
}

function fmt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-MW')
}

export default function DashboardPage() {
  const router = useRouter()
  const { isMarketer, isAgent, loading } = usePanelSession()
  const [strip, setStrip] = useState<GrowthStrip | null>(null)

  useEffect(() => {
    if (!loading && isMarketer) router.replace(MARKETER_HOME)
  }, [loading, isMarketer, router])

  useEffect(() => {
    if (loading || isMarketer || isAgent) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await adminFetch('/api/admin/analytics/growth?days=28', {
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || cancelled) return
        setStrip({
          mau: typeof data.mau === 'number' ? data.mau : null,
          newUsers7d:
            typeof data.newSignups7d === 'number'
              ? data.newSignups7d
              : typeof data.users?.newLast7Days === 'number'
                ? data.users.newLast7Days
                : null,
          sessions: typeof data.websiteSessions === 'number' ? data.websiteSessions : null,
          installs: typeof data.installs === 'number' ? data.installs : null,
        })
      } catch {
        /* strip is optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loading, isMarketer, isAgent])

  if (!loading && isMarketer) {
    return (
      <p style={{ color: 'var(--text-3)', fontWeight: 600 }}>Opening Growth analytics…</p>
    )
  }

  if (!loading && isAgent) {
    return (
      <div>
        <div className="mb-6">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
            Agent portal
          </p>
          <h1 className="font-heading text-[26px] font-extrabold leading-none tracking-tight text-primary">
            Agent home
          </h1>
          <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-on-surface-variant">
            Open the agent portal to onboard users and verify drivers.
          </p>
        </div>
        <DashboardCards />
      </div>
    )
  }

  const metrics = [
    { label: 'MAU', value: fmt(strip?.mau), Icon: LuUsers, hint: 'Active last 30d' },
    { label: 'New users', value: fmt(strip?.newUsers7d), Icon: LuActivity, hint: 'Last 7 days' },
    { label: 'Site sessions', value: fmt(strip?.sessions), Icon: LuGlobe, hint: 'Last 28 days' },
    { label: 'Installs', value: fmt(strip?.installs), Icon: LuDownload, hint: 'Play / tracked' },
  ]

  return (
    <div>
      <div className="mb-5">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
          Operations hub
        </p>
        <h1 className="font-heading text-[26px] font-extrabold leading-none tracking-tight text-primary">
          Dashboard
        </h1>
        <p className="mt-2 max-w-[620px] text-[13px] leading-relaxed text-on-surface-variant">
          Growth first, then operations. Expand any sidebar group to open a service.
        </p>
      </div>

      <Link
        href="/dashboard/analytics"
        className="mb-7 block no-underline text-inherit"
      >
        <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-[0_2px_12px_rgba(0,31,63,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,31,63,0.1)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
                Growth pulse
              </p>
              <p className="mt-1 font-heading text-[18px] font-bold text-primary">
                Visits, installs, MAU, and campaigns
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary-container px-3 py-2 text-[12px] font-bold text-secondary-container">
              Open analytics
              <LuArrowUpRight className="text-[14px]" aria-hidden />
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(metric => (
              <div
                key={metric.label}
                className="rounded-xl bg-surface-container-low px-4 py-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-on-surface-variant">
                    {metric.label}
                  </span>
                  <metric.Icon className="text-[15px] text-primary-container" aria-hidden />
                </div>
                <p className="font-heading text-[24px] font-extrabold leading-none tracking-tight text-primary">
                  {metric.value}
                </p>
                <p className="mt-1 text-[11px] text-on-surface-variant">{metric.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </Link>

      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-container text-secondary-container">
          <LuActivity className="text-[16px]" aria-hidden />
        </span>
        <h2 className="font-heading text-[16px] font-bold text-primary">Operations</h2>
      </div>
      <DashboardCards />
    </div>
  )
}
