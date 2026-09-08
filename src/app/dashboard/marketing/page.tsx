'use client'

import Link from 'next/link'
import { DASHBOARD_SECTION_MAP } from '@/lib/dashboard-sections'
import { DashboardBackLink, DashboardPageHeader } from '@/app/dashboard/DashboardChrome'
import { usePanelSession } from '../PanelSessionProvider'
import { MarketingSubNav } from './MarketingSubNav'

const SECTION = DASHBOARD_SECTION_MAP.marketing

export default function MarketingHubPage() {
  const { isMarketer } = usePanelSession()

  const cards = [
    {
      href: '/dashboard/marketing/tasks',
      title: 'Tasks',
      desc: isMarketer
        ? 'Log content you posted and update task status.'
        : 'Assign content tasks and track what marketers are posting.',
    },
    ...(!isMarketer
      ? [
          {
            href: '/dashboard/marketing/kpi',
            title: 'KPI tracker',
            desc: 'See how every marketer is working — scores, streaks, and daily posting.',
          },
        ]
      : []),
  ]

  return (
    <div>
      {!isMarketer ? <DashboardBackLink label="Back to dashboard" /> : null}

      <DashboardPageHeader
        sectionId="marketing"
        title="Marketing"
        description={
          isMarketer
            ? 'Your marketing workspace — tasks and personal progress.'
            : 'Manage marketer tasks and track team performance.'
        }
      />

      <MarketingSubNav />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {cards.map(card => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              display: 'block',
              padding: 20,
              borderRadius: 16,
              border: '1px solid var(--border)',
              background: SECTION.bg,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: SECTION.color }}>{card.title}</div>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.45 }}>
              {card.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
