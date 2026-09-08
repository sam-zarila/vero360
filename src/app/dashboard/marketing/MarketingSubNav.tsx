'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePanelSession } from '../PanelSessionProvider'

const LINKS = [
  { href: '/dashboard/marketing', label: 'Overview', adminOnly: false },
  { href: '/dashboard/marketing/tasks', label: 'Tasks', adminOnly: false },
  { href: '/dashboard/marketing/kpi', label: 'KPI tracker', adminOnly: true },
] as const

export function MarketingSubNav() {
  const pathname = usePathname()
  const { isMarketer } = usePanelSession()

  return (
    <nav
      aria-label="Marketing sections"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 18,
      }}
    >
      {LINKS.filter(link => !link.adminOnly || !isMarketer).map(link => {
        const active =
          link.href === '/dashboard/marketing'
            ? pathname === '/dashboard/marketing'
            : pathname === link.href ||
              pathname.startsWith(`${link.href}/`) ||
              (link.href === '/dashboard/marketing/tasks' &&
                pathname === '/dashboard/marketing-tasks')

        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              border: active ? '1px solid #FDBA74' : '1px solid var(--border)',
              background: active ? '#FFF7ED' : 'var(--surface)',
              color: active ? '#C2410C' : 'var(--text-2)',
            }}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
