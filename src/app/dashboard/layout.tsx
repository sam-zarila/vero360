import type { Metadata } from 'next'
import DashboardShell from './DashboardShell'

export const metadata: Metadata = {
  title: 'Admin Dashboard — Vero360',
  description: 'Vero360 admin dashboard',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}
