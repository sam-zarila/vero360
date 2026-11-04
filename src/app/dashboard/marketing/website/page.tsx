'use client'

import {
  DashboardBackLink,
  DashboardPageHeader,
} from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../../PanelSessionProvider'
import { MarketingSubNav } from '../MarketingSubNav'
import AppActivityPanel from '../AppActivityPanel'
import WebsitePerformancePanel from '../WebsitePerformancePanel'

export default function MarketingWebsitePerformancePage() {
  const { isMarketer, isFullAdmin, loading: sessionLoading } = usePanelSession()

  if (!sessionLoading && !isFullAdmin && !isMarketer) {
    return (
      <div>
        <DashboardBackLink />
        <p style={{ color: 'var(--text-3)' }}>
          Only admins and marketers can view website and app performance.
        </p>
      </div>
    )
  }

  return (
    <div>
      {isMarketer ? null : <DashboardBackLink />}
      <DashboardPageHeader
        sectionId="marketing"
        title="Website & app performance"
        description="Account totals, service activity, and website traffic."
      />
      <MarketingSubNav />
      <AppActivityPanel />
      <div style={{ marginTop: 28 }}>
        <WebsitePerformancePanel />
      </div>
    </div>
  )
}
