import Link from 'next/link'
import { notFound } from 'next/navigation'

const sections: Record<
  string,
  { title: string; desc: string; icon: string }
> = {
  'vero-ride': {
    title: 'Vero Ride',
    desc: 'Manage trips, drivers, and ride activity.',
    icon: '🚗',
  },
  'vero-courier': {
    title: 'Vero Courier',
    desc: 'Manage deliveries, parcels, and couriers.',
    icon: '🚚',
  },
  food: {
    title: 'Food',
    desc: 'Manage food orders, restaurants, and menus.',
    icon: '🍔',
  },
  jobs: {
    title: 'Jobs',
    desc: 'Manage job listings, applicants, and hiring.',
    icon: '💼',
  },
  stay: {
    title: 'Stay',
    desc: 'Manage accommodation listings and bookings.',
    icon: '🏨',
  },
  promotion: {
    title: 'Promotion',
    desc: 'Manage campaigns, ads, and offers.',
    icon: '📣',
  },
  'latest-arrivals': {
    title: 'Latest arrivals',
    desc: 'Manage new products and featured items.',
    icon: '✨',
  },
  marketplace: {
    title: 'Marketplace',
    desc: 'Manage listings, merchants, and sales.',
    icon: '🛒',
  },
  orders: {
    title: 'Orders',
    desc: 'Manage marketplace orders and fulfillment.',
    icon: '📦',
  },
  refunds: {
    title: 'Refunds',
    desc: 'Track pending and completed marketplace refunds.',
    icon: '↩️',
  },
  'merchant-reports': {
    title: 'Merchant reports',
    desc: 'Review user reports about marketplace merchants.',
    icon: '🚩',
  },
  users: {
    title: 'Users',
    desc: 'Manage customers, merchants, and accounts.',
    icon: '👥',
  },
  finance: {
    title: 'Finance',
    desc: 'Manage payments, escrow, and reports.',
    icon: '💰',
  },
  admins: {
    title: 'Admins',
    desc: 'Manage admin accounts, roles, and access.',
    icon: '🛡️',
  },
  settings: {
    title: 'Settings',
    desc: 'Platform preferences, API config, and account settings.',
    icon: '⚙️',
  },
}

type Props = {
  params: Promise<{ section: string }>
}

export default async function DashboardSectionPage({ params }: Props) {
  const { section } = await params
  const data = sections[section]
  if (!data) notFound()

  return (
    <div>
      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text-3)',
          marginBottom: 20,
        }}
      >
        ← Back to dashboard
      </Link>

      <div
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <span style={{ fontSize: 36 }}>{data.icon}</span>
          <h1
            style={{
              fontSize: 'clamp(24px, 3vw, 32px)',
              fontWeight: 900,
              letterSpacing: '-0.4px',
              margin: 0,
            }}
          >
            {data.title}
          </h1>
        </div>
        <p style={{ fontSize: 16, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 28 }}>
          {data.desc}
        </p>

        <div
          style={{
            borderRadius: 14,
            border: '1px dashed var(--border-2)',
            background: 'var(--surface)',
            padding: '40px 24px',
            textAlign: 'center',
            color: 'var(--text-3)',
            fontSize: 15,
          }}
        >
          Admin data for <strong style={{ color: 'var(--text)' }}>{data.title}</strong> will appear here.
        </div>
      </div>
    </div>
  )
}
