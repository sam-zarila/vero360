'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePanelSession } from '../PanelSessionProvider'

const AGENT_LINKS = [
  { href: '/dashboard/agent', label: 'Overview', exact: true },
  { href: '/dashboard/agent/onboard', label: 'Onboard' },
  { href: '/dashboard/agent/registrations', label: 'My registrations' },
  { href: '/dashboard/agent/drivers', label: 'Verify drivers' },
] as const

const ADMIN_LINKS = [
  { href: '/dashboard/agents', label: 'Agents', exact: true },
  { href: '/dashboard/agents/registrations', label: 'Registrations' },
] as const

export function AgentSubNav() {
  const pathname = usePathname()
  const { isAgent } = usePanelSession()
  const links = isAgent ? AGENT_LINKS : ADMIN_LINKS

  return (
    <nav
      aria-label="Agent sections"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}
    >
      {links.map(link => {
        const exact = 'exact' in link && link.exact
        const active = exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`)

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
              border: active ? '1px solid #6EE7B7' : '1px solid var(--border)',
              background: active ? '#ECFDF5' : 'var(--surface)',
              color: active ? '#047857' : 'var(--text-2)',
            }}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
