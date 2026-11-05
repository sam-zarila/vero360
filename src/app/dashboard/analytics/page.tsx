'use client'

import { useState } from 'react'
import {
  DashboardBackLink,
  DashboardPageHeader,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../PanelSessionProvider'
import AppActivityPanel from '../marketing/AppActivityPanel'
import WebsitePerformancePanel from '../marketing/WebsitePerformancePanel'

type View = 'app' | 'website'

export default function AppWebsitePerformancePage() {
  const { isMarketer, isFullAdmin, loading: sessionLoading } = usePanelSession()
  const [view, setView] = useState<View>('app')

  if (!sessionLoading && !isFullAdmin && !isMarketer) {
    return (
      <div>
        <DashboardBackLink />
        <p style={{ color: 'var(--text-3)' }}>
          Only admins and marketers can view app and website performance.
        </p>
      </div>
    )
  }

  return (
    <div>
      {isMarketer ? null : <DashboardBackLink />}
      <DashboardPageHeader
        sectionId="analytics"
        title="App and website performance"
        description="Accounts, service activity, and website traffic."
      />
      <div
        role="tablist"
        aria-label="Performance view"
        style={{
          display: 'inline-flex',
          padding: 4,
          gap: 4,
          borderRadius: 12,
          background: '#F1F5F9',
          marginBottom: 16,
        }}
      >
        {(
          [
            { id: 'app', label: 'App' },
            { id: 'website', label: 'Website' },
          ] as const
        ).map(tab => {
          const active = view === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(tab.id)}
              style={{
                border: 0,
                borderRadius: 9,
                padding: '8px 16px',
                font: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                background: active ? '#fff' : 'transparent',
                color: active ? '#0F172A' : '#64748B',
                boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
              }}
            >
              {tab.label}
            </button>
          )
        })}
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
