'use client'

import { useState } from 'react'
import {
  DashboardBackLink,
  DashboardPageHeader,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../PanelSessionProvider'
import AppActivityPanel from '../marketing/AppActivityPanel'
import WebsitePerformancePanel from '../marketing/WebsitePerformancePanel'
import GrowthOverviewPanel from '../marketing/GrowthOverviewPanel'

type View = 'growth' | 'app' | 'website'

const TABS: Array<{ id: View; label: string; hint: string }> = [
  { id: 'growth', label: 'Overview', hint: 'MAU, sessions, campaigns' },
  { id: 'app', label: 'App activity', hint: 'Users and services' },
  { id: 'website', label: 'Website', hint: 'GA traffic' },
]

export default function AppWebsitePerformancePage() {
  const { isMarketer, isFullAdmin, loading: sessionLoading } = usePanelSession()
  const [view, setView] = useState<View>('growth')

  if (!sessionLoading && !isFullAdmin && !isMarketer) {
    return (
      <div>
        <DashboardBackLink />
        <p style={{ color: 'var(--text-3)' }}>
          Only admins and marketers can view growth analytics.
        </p>
      </div>
    )
  }

  return (
    <div>
      {isMarketer ? null : <DashboardBackLink />}
      <DashboardPageHeader
        sectionId="analytics"
        title="Growth analytics"
        description="Live pulse for visits, downloads, MAU, campaigns, and service activity — same density as the car-hire ops hub."
      />

      <div
        role="tablist"
        aria-label="Performance view"
        className="mb-5 inline-flex max-w-full flex-wrap gap-1.5 rounded-xl bg-surface-container p-1"
      >
        {TABS.map(tab => {
          const active = view === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(tab.id)}
              className={`rounded-lg px-4 py-2.5 text-left transition-all ${
                active
                  ? 'bg-primary text-on-primary shadow-[0_2px_8px_rgba(0,31,63,0.18)]'
                  : 'text-on-surface-variant hover:bg-surface-container-lowest'
              }`}
            >
              <span className="block text-[13px] font-bold leading-none">{tab.label}</span>
              <span
                className={`mt-1 block text-[11px] font-medium ${
                  active ? 'text-secondary-fixed' : 'text-on-surface-variant/80'
                }`}
              >
                {tab.hint}
              </span>
            </button>
          )
        })}
      </div>

      <div hidden={view !== 'growth'}>
        <GrowthOverviewPanel />
      </div>
      <div hidden={view !== 'app'}>
        <AppActivityPanel />
      </div>
      <div hidden={view !== 'website'}>
        <WebsitePerformancePanel />
      </div>
    </div>
  )
}
