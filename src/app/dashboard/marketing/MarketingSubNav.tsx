'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePanelSession } from '../PanelSessionProvider'

export function MarketingSubNav() {
  const pathname = usePathname()
  const { isMarketer } = usePanelSession()

  const links = [
    { href: '/dashboard/marketing/tasks', label: 'Tasks' },
    ...(isMarketer
      ? [{ href: '/dashboard/marketing/progress', label: 'My progress' }]
      : [{ href: '/dashboard/marketing/kpi', label: 'KPI tracker' }]),
  ]

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
      {links.map(link => {
        const active =
          pathname === link.href ||
          pathname.startsWith(`${link.href}/`) ||
          (link.href === '/dashboard/marketing/tasks' && pathname === '/dashboard/marketing-tasks')

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
