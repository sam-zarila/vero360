import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import ProviderShell from './components/ProviderShell'

export const metadata: Metadata = {
  title: 'Car hire provider workspace · Vero360',
  description:
    'Manage your Vero360 car-hire fleet, bookings, and availability. Approved providers and invited staff only.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export default function ProviderManageLayout({ children }: { children: ReactNode }) {
  return <ProviderShell>{children}</ProviderShell>
}
